import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { roundId, count } = await req.json();

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'roundId is required' },
        { status: 400 }
      );
    }

    const totalInPool = await db.populateRoundQuestionPool(roundId, count || 100);
    const questions = await db.getQuestionsByRoundId(roundId, true);

    return NextResponse.json({
      success: true,
      message: `Successfully populated question bank. Total questions in pool: ${totalInPool}.`,
      data: {
        roundId,
        questionPoolCount: totalInPool,
      },
      questions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to populate questions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

