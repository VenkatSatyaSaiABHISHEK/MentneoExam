import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    await db.clearStudentRoster(examId);

    return NextResponse.json({
      success: true,
      message: 'Student roster cleared successfully for this examination.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear student roster';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

