import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { CheatingViolationType } from '@/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const { violationType, metadata } = (await req.json()) as {
      violationType: CheatingViolationType;
      metadata?: Record<string, unknown>;
    };

    if (!violationType) {
      return NextResponse.json({ success: false, error: 'violationType is required' }, { status: 400 });
    }

    const outcome = await db.recordCheatingViolation({
      attemptId,
      violationType,
      metadata,
    });

    return NextResponse.json({ success: true, data: outcome });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record event';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

