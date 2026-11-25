import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      examId,
      fullName,
      email,
      rollNumber,
      phone,
      branch,
      specialization,
      college,
      yearOfStudy,
      attributes,
    } = body;

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

    if (exam.admission_locked) {
      return NextResponse.json(
        { success: false, error: 'Candidate admission is currently closed by the exam administrator. Please wait for the proctor to open entry.' },
        { status: 403 }
      );
    }

    // Validate dynamic required fields configured for this examination
    const configuredFields = exam.registration_fields || [];
    for (const field of configuredFields) {
      if (field.enabled && field.required) {
        if (field.key === 'phone' && (!phone || !String(phone).trim())) {
          return NextResponse.json({ success: false, error: `${field.label || 'Phone number'} is required.` }, { status: 400 });
        }
        if (field.key === 'branch' && (!branch || !String(branch).trim())) {
          return NextResponse.json({ success: false, error: `${field.label || 'Branch / Department'} is required.` }, { status: 400 });
        }
        if (field.key === 'specialization' && (!specialization || !String(specialization).trim())) {
          return NextResponse.json({ success: false, error: `${field.label || 'Specialization'} is required.` }, { status: 400 });
        }
        if (field.key === 'college' && (!college || !String(college).trim())) {
          return NextResponse.json({ success: false, error: `${field.label || 'College'} is required.` }, { status: 400 });
        }
        if (field.key === 'year_of_study' && (!yearOfStudy || !String(yearOfStudy).trim())) {
          return NextResponse.json({ success: false, error: `${field.label || 'Year / Semester'} is required.` }, { status: 400 });
        }
      }
    }

    const result = await db.registerStudent({
      examId,
      fullName,
      email,
      rollNumber,
      phone,
      branch,
      specialization,
      college,
      yearOfStudy,
      attributes,
    });

    let progress: any = null;
    try {
      progress = await db.getCandidateExamProgress({
        examId,
        registrationId: result.registration.id,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        registrationId: result.registration.id,
        student: result.student,
        isNew: result.isNew,
        nextRoute: progress?.route || null,
        progress,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

