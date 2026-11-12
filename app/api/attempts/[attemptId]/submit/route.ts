import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const result = await db.submitAttempt(attemptId);
    const attempt = await db.getAttemptById(attemptId);
    const round = attempt ? await db.getRoundById(attempt.round_id) : null;
    const qualification = attempt
      ? await db.getQualification(attempt.registration_id, attempt.round_id)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        result,
        qualification,
        round,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit examination attempt';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

