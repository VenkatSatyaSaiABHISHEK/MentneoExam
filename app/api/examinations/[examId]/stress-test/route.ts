import { NextResponse } from 'next/server';
import { db, store } from '@/lib/db/store';
import { resilientStorage } from '@/lib/db/resilient-storage';

export async function POST(req: Request, context: { params: Promise<{ examId: string }> }) {
  const { examId } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const candidateCount = Math.min(Math.max(Number(body.candidateCount) || 300, 10), 500);
    const roundNumber = Number(body.roundNumber) || 1;

    const exam = await db.getExaminationById(examId);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found.' }, { status: 404 });
    }

    const round = (exam.rounds || []).find((r) => r.round_number === roundNumber) || exam.rounds?.[0];
    if (!round) {
      return NextResponse.json({ success: false, error: 'Target round not found.' }, { status: 404 });
    }

    const startMemory = process.memoryUsage();
    const startTime = Date.now();

    const timestampPrefix = Date.now().toString().slice(-4);
    const studentsCreated: string[] = [];
    const registrationsCreated: string[] = [];
    const attemptsCreated: string[] = [];
    const errors: string[] = [];

    let totalAnswersSaved = 0;
    let qualifiedCount = 0;
    let failedCount = 0;

    // -------------------------------------------------------------
    // STAGE 1: Batch Student Registration (e.g. 300 candidates)
    // -------------------------------------------------------------
    const regStartTime = Date.now();
    for (let i = 1; i <= candidateCount; i++) {
      const padded = i.toString().padStart(3, '0');
      const roll = `STRESS-${timestampPrefix}-${padded}`;
      const name = `Simulated Candidate ${padded}`;
      const email = `candidate.${padded}@stress-test.internal`;

      try {
        const { registration } = await db.registerStudent({
          examId,
          fullName: name,
          email,
          rollNumber: roll,
        });
        registrationsCreated.push(registration.id);
        studentsCreated.push(registration.student_id);
      } catch (err: any) {
        errors.push(`Reg failed for ${roll}: ${err?.message}`);
      }
    }
    const regDurationMs = Date.now() - regStartTime;

    // -------------------------------------------------------------
    // STAGE 2: Concurrent Attempt Initialization (Fisher-Yates Sampling)
    // -------------------------------------------------------------
    const startAttemptsTime = Date.now();
    const attemptResults = await Promise.all(
      registrationsCreated.map(async (regId) => {
        try {
          const res = await db.startAttempt({
            registrationId: regId,
            roundId: round.id,
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 Concurrency Simulation Harness',
          });
          return { regId, attemptId: res.attempt.id, questions: res.questions };
        } catch (err: any) {
          errors.push(`Attempt start failed for ${regId}: ${err?.message}`);
          return null;
        }
      })
    );

    const validAttempts = attemptResults.filter((r): r is NonNullable<typeof r> => Boolean(r));
    validAttempts.forEach((v) => attemptsCreated.push(v.attemptId));
    const startAttemptsDurationMs = Date.now() - startAttemptsTime;

    // -------------------------------------------------------------
    // STAGE 3: Concurrent Answers Transaction Stream
    // -------------------------------------------------------------
    const answersStartTime = Date.now();
    const answerPromises: Promise<any>[] = [];

    for (const item of validAttempts) {
      // Simulate answer selection for each served question
      for (let qIdx = 0; qIdx < item.questions.length; qIdx++) {
        const q = item.questions[qIdx];
        const selectedOption = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
        answerPromises.push(
          db.saveAttemptAnswer({
            attemptId: item.attemptId,
            questionId: q.id,
            selectedOption,
            isMarkedForReview: qIdx % 5 === 0,
          }).then(() => {
            totalAnswersSaved++;
          }).catch((err) => {
            errors.push(`Save answer failed: ${err?.message}`);
          })
        );
      }
    }

    // Process all concurrent answer transactions in parallel
    await Promise.all(answerPromises);
    const answersDurationMs = Date.now() - answersStartTime;

    // -------------------------------------------------------------
    // STAGE 4: Concurrent Attempt Submission & Server-Side Scoring
    // -------------------------------------------------------------
    const submitStartTime = Date.now();
    const submitResults = await Promise.all(
      validAttempts.map(async (item) => {
        try {
          const outcome = await db.submitAttempt(item.attemptId);
          if (outcome.is_qualified) {
            qualifiedCount++;
          } else {
            failedCount++;
          }
          return outcome;
        } catch (err: any) {
          errors.push(`Submit failed for attempt ${item.attemptId}: ${err?.message}`);
          return null;
        }
      })
    );
    const submitDurationMs = Date.now() - submitStartTime;

    const totalDurationMs = Date.now() - startTime;
    const endMemory = process.memoryUsage();

    // Flush state to resilient disk storage
    resilientStorage.scheduleSave(() => store.toSnapshot());

    const totalTransactions = candidateCount + validAttempts.length + totalAnswersSaved + validAttempts.length;
    const transactionsPerSecond = Math.round((totalTransactions / Math.max(1, totalDurationMs)) * 1000);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          examName: exam.name,
          roundName: round.name,
          roundNumber: round.round_number,
          candidateCount,
          completedSuccessfully: validAttempts.length,
          totalAnswersSaved,
          qualifiedCount,
          failedCount,
          passPercentage: validAttempts.length > 0 ? Math.round((qualifiedCount / validAttempts.length) * 100) : 0,
          errorsCount: errors.length,
          systemStatus: errors.length === 0 ? 'CRASH-FREE / 100% OPERATIONAL' : 'ERRORS ENCOUNTERED',
        },
        performance: {
          totalDurationMs,
          transactionsPerSecond,
          registrationDurationMs: regDurationMs,
          attemptStartDurationMs: startAttemptsDurationMs,
          answerSaveDurationMs: answersDurationMs,
          scoringDurationMs: submitDurationMs,
          avgLatencyPerTransactionMs: (totalDurationMs / Math.max(1, totalTransactions)).toFixed(2),
        },
        memory: {
          heapUsedMb: Math.round(endMemory.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(endMemory.heapTotal / 1024 / 1024),
          memoryDeltaMb: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024),
        },
        errors: errors.slice(0, 10),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Stress test execution failed.' },
      { status: 500 }
    );
  }
}
