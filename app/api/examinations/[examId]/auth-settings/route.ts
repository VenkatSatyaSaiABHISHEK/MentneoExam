import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const { authMode, loginIdentifierField, loginIdentifierLabel } = await req.json();

    if (!authMode || (authMode !== 'roster' && authMode !== 'open')) {
      return NextResponse.json(
        { success: false, error: 'authMode must be "roster" or "open".' },
        { status: 400 }
      );
    }

    const updated = await db.updateExamAuthSettings({
      examId,
      authMode,
      loginIdentifierField,
      loginIdentifierLabel,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update auth settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

