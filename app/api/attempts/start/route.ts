import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const { registrationId, roundId } = await req.json();

    if (!registrationId || !roundId) {
      return NextResponse.json(
        { success: false, error: 'registrationId and roundId are required.' },
        { status: 400 }
      );
    }

    const reg = await db.getRegistration(registrationId);
    if (!reg) {
      return NextResponse.json({ success: false, error: 'Registration record not found.' }, { status: 404 });
    }

    if (reg.status === 'disqualified') {
      return NextResponse.json(
        {
          success: false,
          isDisqualified: true,
          error: 'DISQUALIFIED: You have been disqualified from this examination by the invigilator. You cannot write this examination.',
        },
        { status: 403 }
      );
    }

    const { attempt, questions, answers } = await db.startAttempt({
      registrationId,
      roundId,
    });

    // Authoritative remaining time calculation
    const now = Date.now();
    const deadline = new Date(attempt.deadline_at).getTime();
    const secondsRemaining = Math.max(0, Math.floor((deadline - now) / 1000));

    return NextResponse.json({
      success: true,
      data: {
        attempt,
        questions,
        answers,
        secondsRemaining,
        isExpired: secondsRemaining <= 0,
      },
    });
  } catch (error: any) {
    if (error?.alreadySubmitted) {
      return NextResponse.json(
        {
          success: false,
          alreadySubmitted: true,
          attemptId: error.attemptId,
          attemptStatus: error.attemptStatus,
          error: error.message || 'You have already completed this examination round.',
        },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to start attempt.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

