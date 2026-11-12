import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug parameter is required.' }, { status: 400 });
    }

    const exam = await db.getExaminationBySlug(slug);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: exam });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

