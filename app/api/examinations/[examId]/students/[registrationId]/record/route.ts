import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string; registrationId: string }> }
) {
  try {
    const { examId, registrationId } = await params;
    const record = await db.getStudentDetailedRecord(examId, registrationId);
    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve student detailed record';
    return NextResponse.json({ success: false, error: message }, { status: 404 });
  }
}

