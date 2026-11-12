import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const roundId = (formData.get('roundId') as string) || undefined;

    const documentName = file ? file.name : `Question_Paper_${new Date().toISOString().slice(0, 10)}.pdf`;

    const job = await db.createOCRJob({
      documentName,
      roundId,
    });

    return NextResponse.json({
      success: true,
      data: job,
      message: 'Question PDF uploaded. OCR background pipeline queued.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const jobs = await db.getOCRJobs();
    return NextResponse.json({ success: true, data: jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

