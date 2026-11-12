import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string; registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const body = await req.json().catch(() => ({}));
    const roundId = body.roundId;

    if (!roundId) {
      return NextResponse.json({ success: false, error: 'roundId is required' }, { status: 400 });
    }

    const result = await db.reconductRoundAttempt(registrationId, roundId);
    return NextResponse.json({ success: true, message: result.message });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reconduct round attempt';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

