import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const rounds = await db.getRoundsByExamId(examId);
    return NextResponse.json({ success: true, data: rounds });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const body = await req.json();
    const created = await db.createOrUpdateRound({ ...body, examination_id: examId });
    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const { searchParams } = new URL(req.url);
    let roundId = searchParams.get('roundId');

    if (!roundId) {
      try {
        const body = await req.json();
        roundId = body.roundId;
      } catch {
        // Ignored if body empty
      }
    }

    if (!roundId) {
      return NextResponse.json({ success: false, error: 'roundId is required' }, { status: 400 });
    }

    await db.deleteRound(examId, roundId);
    return NextResponse.json({ success: true, message: 'Round deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

