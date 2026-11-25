import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { getPgPool } from '@/lib/db/pg';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const url = new URL(req.url);
    const pin = url.searchParams.get('pin') || req.headers.get('x-remote-pin');

    let exam = await db.getExaminationById(examId);
    if (!exam) {
      exam = await db.getExaminationBySlug(examId);
    }
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found.' }, { status: 404 });
    }

    const expectedPin = exam.remote_pin || '12345678';
    if (!pin || pin.trim() !== expectedPin.trim()) {
      return NextResponse.json({
        success: false,
        pinRequired: true,
        error: 'Invalid or missing remote PIN.',
      }, { status: 401 });
    }

    const monitoringData = await db.getLiveMonitoringData(exam.id);

    // Calculate aggregated metrics
    const rows = monitoringData.rows || [];
    const totalRegistered = rows.filter((r: any) => r.attemptStatus === 'registered' || r.attemptStatus !== 'registered').length;
    const totalWriting = rows.filter((r: any) => r.attemptStatus === 'in_progress').length;
    const totalSubmitted = rows.filter((r: any) => r.attemptStatus === 'submitted' || r.attemptStatus === 'timed_out').length;
    const totalQualified = rows.filter((r: any) => r.isQualified === true).length;
    const totalFailed = rows.filter((r: any) => r.isQualified === false).length;

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          name: exam.name,
          slug: exam.slug,
          status: exam.status,
          auth_mode: exam.auth_mode,
          admission_locked: exam.admission_locked ?? false,
          emergency_announcement: exam.emergency_announcement ?? null,
          remote_pin: expectedPin,
        },
        summary: {
          totalRegistered,
          totalWriting,
          totalSubmitted,
          totalQualified,
          totalFailed,
        },
        rounds: monitoringData.rounds || [],
        roundSummaries: monitoringData.roundSummaries || [],
        candidates: rows.map((r: any) => ({
          attemptId: r.attemptId,
          registrationId: r.registrationId,
          studentName: r.studentName,
          rollNumber: r.rollNumber,
          loginId: r.loginId,
          email: r.email,
          roundId: r.roundId,
          roundName: r.roundName,
          roundNumber: r.roundNumber,
          roundType: r.roundType,
          attemptStatus: r.attemptStatus,
          score: r.score,
          totalMarks: r.totalMarks,
          qualifyingMarks: r.qualifyingMarks,
          isQualified: r.isQualified,
          secondsRemaining: r.secondsRemaining,
          cheatingWarnings: r.cheatingWarnings,
          startedAt: r.startedAt,
          submittedAt: r.submittedAt,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error in remote control.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const body = await req.json();
    const { pin, action, data } = body;

    let exam = await db.getExaminationById(examId);
    if (!exam) {
      exam = await db.getExaminationBySlug(examId);
    }
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found.' }, { status: 404 });
    }

    const expectedPin = exam.remote_pin || '12345678';
    if (!pin || String(pin).trim() !== expectedPin.trim()) {
      return NextResponse.json({
        success: false,
        pinRequired: true,
        error: 'Invalid remote PIN entered.',
      }, { status: 401 });
    }

    switch (action) {
      case 'verify_pin':
        return NextResponse.json({ success: true, verified: true });

      case 'toggle_admission': {
        const locked = Boolean(data?.locked);
        await db.updateExamRemoteSettings({
          examId: exam.id,
          admissionLocked: locked,
        });
        return NextResponse.json({
          success: true,
          message: locked ? 'Candidate admission has been locked.' : 'Candidate admission is now open.',
          admission_locked: locked,
        });
      }

      case 'set_status': {
        const newStatus = data?.status;
        if (!['live', 'paused', 'completed', 'draft'].includes(newStatus)) {
          return NextResponse.json({ success: false, error: 'Invalid exam status.' }, { status: 400 });
        }
        await db.updateExamRemoteSettings({
          examId: exam.id,
          status: newStatus,
        });
        return NextResponse.json({
          success: true,
          message: `Examination status updated to ${newStatus.toUpperCase()}.`,
          status: newStatus,
        });
      }

      case 'set_announcement': {
        const message = data?.message !== undefined ? (String(data.message).trim() || null) : null;
        await db.updateExamRemoteSettings({
          examId: exam.id,
          emergencyAnnouncement: message,
        });
        return NextResponse.json({
          success: true,
          message: message ? 'Emergency alert broadcast to candidates.' : 'Emergency alert cleared.',
          emergency_announcement: message,
        });
      }

      case 'update_pin': {
        const newPin = String(data?.newPin || '').trim();
        if (newPin.length < 4 || newPin.length > 12) {
          return NextResponse.json({ success: false, error: 'PIN must be between 4 and 12 digits.' }, { status: 400 });
        }
        await db.updateExamRemoteSettings({
          examId: exam.id,
          remotePin: newPin,
        });
        return NextResponse.json({
          success: true,
          message: 'Remote PIN updated successfully.',
          newPin,
        });
      }

      case 'extend_time': {
        const attemptId = data?.attemptId;
        const minutes = Number(data?.minutes || 5);
        if (!attemptId) {
          return NextResponse.json({ success: false, error: 'attemptId is required.' }, { status: 400 });
        }
        const attempt = await db.getAttemptById(attemptId);
        if (!attempt) {
          return NextResponse.json({ success: false, error: 'Attempt not found.' }, { status: 404 });
        }
        const currentDeadline = new Date(attempt.deadline_at).getTime();
        const extendedDeadline = new Date(Math.max(Date.now(), currentDeadline) + minutes * 60 * 1000).toISOString();
        attempt.deadline_at = extendedDeadline;
        if (attempt.status === 'timed_out') {
          attempt.status = 'in_progress';
          attempt.submitted_at = null;
        }

        try {
          const pool = getPgPool();
          await pool.query(
            'UPDATE examination_attempts SET deadline_at = $1, status = $2, submitted_at = $3 WHERE id = $4',
            [extendedDeadline, attempt.status, attempt.submitted_at, attempt.id]
          );
        } catch {}

        return NextResponse.json({
          success: true,
          message: `Granted +${minutes} minutes to candidate.`,
          newDeadline: extendedDeadline,
        });
      }

      case 'force_submit': {
        const attemptId = data?.attemptId;
        if (!attemptId) {
          return NextResponse.json({ success: false, error: 'attemptId is required.' }, { status: 400 });
        }
        const result = await db.submitAttempt(attemptId, true);
        return NextResponse.json({
          success: true,
          message: 'Attempt finalized and submitted by invigilator.',
          result,
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown remote action.' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error in remote action.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
