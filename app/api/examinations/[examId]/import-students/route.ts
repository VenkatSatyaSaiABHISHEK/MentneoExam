import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const body = await req.json();

    const {
      students,
      loginIdentifierField,
      loginIdentifierLabel,
      nameField,
      emailField,
      authMode,
      replaceExisting,
    } = body;

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No student records provided.' },
        { status: 400 }
      );
    }

    if (!loginIdentifierField || !nameField) {
      return NextResponse.json(
        {
          success: false,
          error: 'Login identifier field and Candidate name field are required.',
        },
        { status: 400 }
      );
    }

    const result = await db.importStudentRoster({
      examId,
      students,
      loginIdentifierField,
      loginIdentifierLabel: loginIdentifierLabel || loginIdentifierField,
      nameField,
      emailField,
      authMode: authMode || 'roster',
      replaceExisting: Boolean(replaceExisting),
    });

    const registrations = await db.getRegistrationsByExamId(examId);

    return NextResponse.json({
      success: true,
      data: result,
      registrations,
      message: `Successfully imported ${result.importedCount} candidates into the examination roster.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to import student roster';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

