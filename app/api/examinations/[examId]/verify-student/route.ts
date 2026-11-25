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

    if (verification.examination?.admission_locked) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          admissionLocked: true,
          error: 'Candidate admission is currently closed by the exam administrator. Please wait for the proctor to open entry.',
        },
        { status: 403 }
      );
    }

    // Authoritative candidate multi-round progression check
    let hasCompletedAttempt = false;
    let completedAttemptId: string | null = null;
    let nextRoute: string | null = null;
    let progressData: any = null;
    const regId = verification.registration?.id;

    if (regId) {
      try {
        progressData = await db.getCandidateExamProgress({
          examId: verification.examination?.id || examId,
          registrationId: regId,
        });
        hasCompletedAttempt = progressData.status === 'eliminated' || progressData.status === 'completed_all';
        completedAttemptId = progressData.attemptId || null;
        nextRoute = progressData.route || null;
      } catch (progErr) {
        console.warn('[verify-student progression warning]', progErr);
      }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      hasCompletedAttempt,
      completedAttemptId,
      nextRoute,
      progress: progressData,
      data: {
        student: verification.student,
        registrationId: verification.registration?.id,
        status: verification.registration?.status,
        hasCompletedAttempt,
        completedAttemptId,
        nextRoute,
        progress: progressData,
        examination: {
          id: verification.examination?.id,
          name: verification.examination?.name,
          slug: verification.examination?.slug,
          status: verification.examination?.status,
          admissionLocked: verification.examination?.admission_locked ?? false,
          emergencyAnnouncement: verification.examination?.emergency_announcement ?? null,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

