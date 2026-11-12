import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    const { loginId } = await req.json();

    if (!loginId || typeof loginId !== 'string' || !loginId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Login identifier is required.' },
        { status: 400 }
      );
    }

    const verification = await db.verifyStudentLogin({
      examSlugOrId: examId,
      loginId: loginId.trim(),
    });

    if (!verification.verified) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error:
            verification.error ||
            'Candidate not found in the authorized roster for this examination.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      data: {
        student: verification.student,
        registrationId: verification.registration?.id,
        status: verification.registration?.status,
        examination: {
          id: verification.examination?.id,
          name: verification.examination?.name,
          slug: verification.examination?.slug,
          status: verification.examination?.status,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

