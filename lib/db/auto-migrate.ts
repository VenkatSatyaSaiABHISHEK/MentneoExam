import { queryPg } from '@/lib/db/pg';

let migrationRan = false;

export async function ensureDatabaseSchema(): Promise<{ success: boolean; message: string }> {
  if (migrationRan) {
    return { success: true, message: 'Schema already verified' };
  }

  try {
    // 1. Extensions
    await queryPg(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryPg(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2. Examinations Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.examinations (
        id                       TEXT        PRIMARY KEY,
        name                     TEXT        NOT NULL,
        slug                     TEXT        NOT NULL UNIQUE,
        description              TEXT,
        status                   TEXT        NOT NULL DEFAULT 'draft',
        exam_date                TIMESTAMPTZ,
        start_time               TIMESTAMPTZ,
        registration_deadline    TIMESTAMPTZ,
        student_limit            INTEGER,
        instructions             TEXT,
        qualification_config     JSONB       DEFAULT '{}',
        show_marks_to_students   BOOLEAN     NOT NULL DEFAULT true,
        max_cheating_warnings    INTEGER     NOT NULL DEFAULT 3,
        auth_mode                TEXT        DEFAULT 'roster',
        login_identifier_field   TEXT        DEFAULT 'roll_number',
        login_identifier_label   TEXT        DEFAULT 'Roll Number',
        roster_count             INTEGER     DEFAULT 0,
        created_by               TEXT,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Examination Rounds Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.examination_rounds (
        id                          TEXT        PRIMARY KEY,
        examination_id              TEXT        NOT NULL REFERENCES public.examinations(id) ON DELETE CASCADE,
        round_number                INTEGER     NOT NULL,
        name                        TEXT        NOT NULL,
        duration_minutes            INTEGER     NOT NULL DEFAULT 60,
        total_questions             INTEGER     NOT NULL DEFAULT 30,
        marks_per_question          NUMERIC(5,2) NOT NULL DEFAULT 1,
        negative_marks              NUMERIC(5,2) NOT NULL DEFAULT 0,
        qualifying_marks            NUMERIC(8,2) NOT NULL DEFAULT 10,
        total_marks                 NUMERIC(8,2) NOT NULL DEFAULT 30,
        question_selection_strategy TEXT        NOT NULL DEFAULT 'sequential',
        scheduled_start             TIMESTAMPTZ,
        status                      TEXT        NOT NULL DEFAULT 'draft',
        auto_qualify                BOOLEAN     NOT NULL DEFAULT true,
        round_type                  TEXT        NOT NULL DEFAULT 'mcq',
        allow_tab_switch            BOOLEAN     NOT NULL DEFAULT false,
        coding_starter_templates    JSONB       DEFAULT '{}',
        min_time_before_submit_minutes INTEGER  DEFAULT 1,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_exam_round UNIQUE (examination_id, round_number)
      );
    `);

    // 4. Questions Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.questions (
        id                  TEXT        PRIMARY KEY,
        round_id            TEXT        REFERENCES public.examination_rounds(id) ON DELETE CASCADE,
        question_text       TEXT        NOT NULL,
        question_type       TEXT        NOT NULL DEFAULT 'single_choice',
        difficulty          TEXT        NOT NULL DEFAULT 'medium',
        marks               NUMERIC(5,2) NOT NULL DEFAULT 1,
        negative_marks      NUMERIC(5,2) NOT NULL DEFAULT 0,
        explanation         TEXT,
        status              TEXT        NOT NULL DEFAULT 'approved',
        sort_order          INTEGER     NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Question Options Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.question_options (
        id                  TEXT        PRIMARY KEY,
        question_id         TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
        label               TEXT        NOT NULL,
        option_text         TEXT        NOT NULL,
        sort_order          INTEGER     NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 6. Answer Keys Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.answer_keys (
        id                  TEXT        PRIMARY KEY,
        question_id         TEXT        NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
        correct_option      TEXT        NOT NULL,
        explanation         TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. Students Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.students (
        id                  TEXT        PRIMARY KEY,
        roll_number         TEXT        NOT NULL UNIQUE,
        login_id            TEXT,
        full_name           TEXT        NOT NULL,
        email               TEXT        NOT NULL UNIQUE,
        phone               TEXT,
        attributes          JSONB       DEFAULT '{}',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 8. Registrations Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.registrations (
        id                  TEXT        PRIMARY KEY,
        examination_id      TEXT        NOT NULL REFERENCES public.examinations(id) ON DELETE CASCADE,
        student_id          TEXT        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
        registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status              TEXT        NOT NULL DEFAULT 'registered',
        CONSTRAINT uq_exam_student UNIQUE (examination_id, student_id)
      );
    `);

    // 9. Examination Attempts Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.examination_attempts (
        id                  TEXT        PRIMARY KEY,
        registration_id     TEXT        NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
        round_id            TEXT        NOT NULL REFERENCES public.examination_rounds(id) ON DELETE CASCADE,
        started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at        TIMESTAMPTZ,
        status              TEXT        NOT NULL DEFAULT 'in_progress',
        score               NUMERIC(8,2) DEFAULT 0,
        cheating_warnings   INTEGER     NOT NULL DEFAULT 0,
        is_disqualified     BOOLEAN     NOT NULL DEFAULT false,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_reg_round_attempt UNIQUE (registration_id, round_id)
      );
    `);

    // 10. Attempt Answers Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.attempt_answers (
        id                   TEXT        PRIMARY KEY,
        attempt_id           TEXT        NOT NULL REFERENCES public.examination_attempts(id) ON DELETE CASCADE,
        question_id          TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
        selected_option      TEXT,
        code_snippet         TEXT,
        code_language        TEXT,
        is_marked_for_review BOOLEAN     NOT NULL DEFAULT false,
        answered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
      );
    `);

    // 11. Examination Results Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.examination_results (
        id                   TEXT        PRIMARY KEY,
        registration_id      TEXT        NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
        round_id             TEXT        NOT NULL REFERENCES public.examination_rounds(id) ON DELETE CASCADE,
        attempt_id           TEXT        NOT NULL REFERENCES public.examination_attempts(id) ON DELETE CASCADE,
        total_questions      INTEGER     NOT NULL DEFAULT 0,
        attempted            INTEGER     NOT NULL DEFAULT 0,
        correct              INTEGER     NOT NULL DEFAULT 0,
        wrong                INTEGER     NOT NULL DEFAULT 0,
        unanswered           INTEGER     NOT NULL DEFAULT 0,
        score                NUMERIC(8,2) NOT NULL DEFAULT 0,
        accuracy_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
        is_qualified         BOOLEAN     NOT NULL DEFAULT false,
        evaluated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_result_attempt UNIQUE (attempt_id)
      );
    `);

    // 12. Cheating Events Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.cheating_events (
        id                  TEXT        PRIMARY KEY,
        attempt_id          TEXT        NOT NULL REFERENCES public.examination_attempts(id) ON DELETE CASCADE,
        event_type          TEXT        NOT NULL,
        reason              TEXT,
        warning_number      INTEGER     NOT NULL,
        occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 13. System Audit Logs Table
    await queryPg(`
      CREATE TABLE IF NOT EXISTS public.examination_audit_logs (
        id                  TEXT        PRIMARY KEY,
        examination_id      TEXT,
        actor_role          TEXT        NOT NULL DEFAULT 'system',
        action              TEXT        NOT NULL,
        details             JSONB       DEFAULT '{}',
        timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    migrationRan = true;
    return { success: true, message: 'Database schema verified and up-to-date.' };
  } catch (error: any) {
    console.error('[Database Auto-Migrate Error]:', error.message);
    return { success: false, message: error.message };
  }
}
