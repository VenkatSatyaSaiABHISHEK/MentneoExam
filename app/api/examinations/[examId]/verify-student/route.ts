import { NextResponse } from 'next/server';
import { db } from '@/lib/db/store';
import { createAdminClient } from '@/lib/supabase/admin';

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
      const supabase = createAdminClient();
      if (supabase) {
        try {
          const { data: sbAtt } = await supabase
            .from('examination_attempts')
            .select('id, status')
            .eq('registration_id', regId)
            .in('status', ['submitted', 'timed_out', 'terminated'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sbAtt) {
            hasCompletedAttempt = true;
            completedAttemptId = sbAtt.id;
          }
        } catch {}
      }
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

