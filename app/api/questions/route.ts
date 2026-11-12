import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get('roundId');
    const isAdmin = searchParams.get('isAdmin') === 'true';

    let questions;
    if (roundId) {
      questions = await db.getQuestionsByRoundId(roundId, isAdmin);
    } else {
      questions = await db.getAllQuestions();
    }

    return NextResponse.json({ success: true, data: questions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.question_text) {
      return NextResponse.json({ success: false, error: 'Question text is required' }, { status: 400 });
    }

    const question = await db.createQuestion(body);
    return NextResponse.json({ success: true, data: question }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Question ID is required' }, { status: 400 });
    }

    await db.deleteQuestion(id);
    return NextResponse.json({ success: true, message: 'Question deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

