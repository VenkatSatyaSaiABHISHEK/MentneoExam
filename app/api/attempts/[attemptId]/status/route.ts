import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const attempt = await db.getAttemptById(attemptId);
    if (!attempt) {
      return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });
    }

    // Check if candidate registration is disqualified
    const reg = await db.getRegistration(attempt.registration_id);
    if (reg?.status === 'disqualified') {
      return NextResponse.json({
        success: true,
        data: {
          status: 'terminated',
          isDisqualified: true,
          secondsRemaining: 0,
          cheatingWarnings: attempt.cheating_warnings,
          isExpired: true,
          emergencyAnnouncement: null,
          isExamPaused: false,
        },
      });
    }

    const now = Date.now();
    const round = await db.getRoundById(attempt.round_id);
    const durationMs = (round?.duration_minutes || 20) * 60 * 1000;
    const startedMs = attempt.started_at ? new Date(attempt.started_at).getTime() : now;
    const deadlineMs = attempt.deadline_at ? new Date(attempt.deadline_at).getTime() : (startedMs + durationMs);
    const rawSec = Math.floor((deadlineMs - now) / 1000);
    const secondsRemaining = attempt.status === 'in_progress' ? Math.max(0, rawSec) : 0;

    if (secondsRemaining <= 0 && attempt.status === 'in_progress') {
      try {
        await db.submitAttempt(attemptId, true);
        attempt.status = 'timed_out';
      } catch {
        attempt.status = 'timed_out';
      }
    }

    let emergencyAnnouncement: string | null = null;
    let isExamPaused = false;
    try {
      if (round) {
        const exam = await db.getExaminationById(round.examination_id);
        if (exam) {
          emergencyAnnouncement = exam.emergency_announcement || null;
          isExamPaused = exam.status === 'paused';
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        status: attempt.status,
        secondsRemaining,
        cheatingWarnings: attempt.cheating_warnings,
        isExpired: secondsRemaining <= 0 && attempt.status === 'in_progress',
        emergencyAnnouncement,
        isExamPaused,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
