import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { ExamStatus } from '@/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const { status } = (await req.json()) as { status: ExamStatus };
    const validStatuses: ExamStatus[] = ['draft', 'published', 'scheduled', 'live', 'completed', 'archived'];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const updated = await db.updateExaminationStatus(examId, status);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

