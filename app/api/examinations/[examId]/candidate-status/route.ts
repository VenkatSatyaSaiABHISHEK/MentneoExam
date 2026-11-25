import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const { searchParams } = new URL(req.url);
    const registrationId = searchParams.get('registrationId');

    if (!registrationId) {
      return NextResponse.json(
        { success: false, error: 'registrationId is required.' },
        { status: 400 }
      );
    }

    const progress = await db.getCandidateExamProgress({
      examId,
      registrationId,
    });

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query candidate progress.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
