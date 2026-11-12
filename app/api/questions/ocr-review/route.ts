import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const { action, questionIds } = await req.json();

    if (!questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json({ success: false, error: 'questionIds array required' }, { status: 400 });
    }

    if (action === 'approve') {
      const all = await db.getAllQuestions();
      for (const q of all) {
        if (questionIds.includes(q.id)) {
          q.status = 'approved';
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${questionIds.length} question(s) with action: ${action}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

