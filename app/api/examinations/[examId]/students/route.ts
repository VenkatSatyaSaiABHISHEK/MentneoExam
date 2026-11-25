import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const registrations = await db.getRegistrationsByExamId(examId);
    return NextResponse.json({ success: true, data: registrations });
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
    const { fullName, email, rollNumber, loginId, phone, branch, specialization, college, yearOfStudy } = body;

    const roll = (rollNumber || loginId || '').trim();
    if (!roll) {
      return NextResponse.json(
        { success: false, error: 'Roll number or Login ID is required' },
        { status: 400 }
      );
    }

    const name = (fullName || `Candidate ${roll}`).trim();
    const studentEmail = (email || `${roll.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.exam`).trim();

    const result = await db.registerStudent({
      examId,
      fullName: name,
      email: studentEmail,
      rollNumber: roll,
      phone,
      branch,
      specialization,
      college,
      yearOfStudy,
    });

    const registrations = await db.getRegistrationsByExamId(examId);

    return NextResponse.json({
      success: true,
      data: result.registration,
      student: result.student,
      registrations,
      message: `Candidate ${name} added to roster.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add student';
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    await db.deleteRegistration(id);
    const registrations = await db.getRegistrationsByExamId(examId);

    return NextResponse.json({
      success: true,
      registrations,
      message: 'Candidate removed from roster.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete student';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const body = await req.json();
    const { registrationId, status } = body;

    if (!registrationId || !status) {
      return NextResponse.json({ success: false, error: 'registrationId and status are required' }, { status: 400 });
    }

    await db.updateRegistrationStatus(registrationId, status);
    const registrations = await db.getRegistrationsByExamId(examId);

    return NextResponse.json({
      success: true,
      registrations,
      message: `Candidate status updated to ${status}.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update candidate status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

