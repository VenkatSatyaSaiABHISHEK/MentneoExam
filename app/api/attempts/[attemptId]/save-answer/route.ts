import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const { questionId, selectedOption, codeSnippet, codeLanguage, isMarkedForReview } = await req.json();

    if (!questionId) {
      return NextResponse.json({ success: false, error: 'questionId is required' }, { status: 400 });
    }

    const answer = await db.saveAttemptAnswer({
      attemptId,
      questionId,
      selectedOption,
      codeSnippet,
      codeLanguage,
      isMarkedForReview,
    });

    return NextResponse.json({ success: true, data: answer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save answer';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

