import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const exam = await db.getExaminationById(examId);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: exam });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

