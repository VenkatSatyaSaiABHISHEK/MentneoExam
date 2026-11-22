import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { getPgPool } from '@/lib/db/pg';

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

    // Check if this candidate already has completed attempts (prevent rewriting)
    let hasCompletedAttempt = false;
    let completedAttemptId: string | null = null;
    const regId = verification.registration?.id;

    if (regId) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query(
          "SELECT id, status FROM examination_attempts WHERE registration_id = $1 AND status IN ('submitted', 'timed_out', 'terminated') ORDER BY created_at DESC LIMIT 1",
          [regId]
        );
        if (rows.length > 0) {
          hasCompletedAttempt = true;
          completedAttemptId = rows[0].id;
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      verified: true,
      hasCompletedAttempt,
      completedAttemptId,
      data: {
        student: verification.student,
        registrationId: verification.registration?.id,
        status: verification.registration?.status,
        hasCompletedAttempt,
        completedAttemptId,
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

