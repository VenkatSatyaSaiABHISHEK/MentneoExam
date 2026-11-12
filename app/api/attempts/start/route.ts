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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start attempt.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

