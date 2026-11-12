import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET() {
  try {
    const examinations = await db.getExaminations();
    return NextResponse.json({ success: true, data: examinations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch examinations';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.slug) {
      return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
    }

    const created = await db.createExamination(body, body.rounds);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create examination';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

