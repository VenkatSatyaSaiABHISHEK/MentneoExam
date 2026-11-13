import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const roundId = (formData.get('roundId') as string) || undefined;

    const documentName = file ? file.name : `Question_Paper_${new Date().toISOString().slice(0, 10)}.pdf`;

    const targetCount = Number(formData.get('count')) || 100;

    let fileBuffer: Buffer | undefined = undefined;
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    }

    const job = await db.createOCRJob({
      documentName,
      roundId,
      targetCount,
      fileBuffer,
    });

    const questions = (job as any).questions || (roundId ? await db.getQuestionsByRoundId(roundId, true) : []);
    const activePdf = roundId ? await db.getActivePdfForRound(roundId) : null;

    return NextResponse.json({
      success: true,
      data: job,
      activePdf,
      questions,
      message: `Question PDF uploaded. ${job.questions_extracted || targetCount} questions extracted and added to round question bank.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get('roundId') || undefined;
    const jobs = await db.getOCRJobs();
    const activePdf = roundId ? await db.getActivePdfForRound(roundId) : null;

    // Check bound OCR service health if configured (bypass localhost in cloud/serverless)
    let ocrServiceStatus = 'not_configured';
    const isLocalhost = Boolean(
      process.env.OCR_SERVICE_URL &&
        (process.env.OCR_SERVICE_URL.includes('localhost') || process.env.OCR_SERVICE_URL.includes('127.0.0.1'))
    );
    const isCloudEnv = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
    if (process.env.OCR_SERVICE_URL && !(isCloudEnv && isLocalhost)) {
      try {
        const baseUrl = process.env.OCR_SERVICE_URL.endsWith('/')
          ? process.env.OCR_SERVICE_URL
          : `${process.env.OCR_SERVICE_URL}/`;
        const healthUrl = new URL('health', baseUrl);
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
        ocrServiceStatus = res.ok ? 'connected' : `status_${res.status}`;
      } catch {
        ocrServiceStatus = 'unreachable';
      }
    }

    return NextResponse.json({
      success: true,
      data: jobs,
      activePdf,
      ocrService: {
        status: ocrServiceStatus,
        configured: Boolean(process.env.OCR_SERVICE_URL),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

