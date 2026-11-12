import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const { examId, fullName, email, rollNumber } = await req.json();

    if (!examId || !fullName || !email || !rollNumber) {
      return NextResponse.json(
        { success: false, error: 'Full name, email, roll number, and examId are required.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const exam = await db.getExaminationById(examId);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Examination not found.' }, { status: 404 });
    }

    if (exam.status === 'draft' || exam.status === 'archived') {
      return NextResponse.json(
        { success: false, error: `Examination is currently in ${exam.status} state and cannot accept registrations.` },
        { status: 403 }
      );
    }

    const result = await db.registerStudent({
      examId,
      fullName,
      email,
      rollNumber,
    });

    return NextResponse.json({
      success: true,
      data: {
        registrationId: result.registration.id,
        student: result.student,
        isNew: result.isNew,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

