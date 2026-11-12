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

    const now = Date.now();
    const deadline = new Date(attempt.deadline_at).getTime();
    const secondsRemaining = attempt.status === 'in_progress' ? Math.max(0, Math.floor((deadline - now) / 1000)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        status: attempt.status,
        secondsRemaining,
        cheatingWarnings: attempt.cheating_warnings,
        isExpired: secondsRemaining <= 0 && attempt.status === 'in_progress',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

