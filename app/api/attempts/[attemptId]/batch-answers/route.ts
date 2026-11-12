import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const body = await req.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'A non-empty answers array is required.' },
        { status: 400 }
      );
    }

    const saved = await db.saveAttemptAnswersBatch({
      attemptId,
      answers,
    });

    return NextResponse.json({
      success: true,
      data: saved,
      count: saved.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save batch answers';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

