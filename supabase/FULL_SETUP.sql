-- ============================================================
-- ExamS Multi-Round Examination Platform
-- Complete Database Schema & Supabase Setup Script
-- Compatible with string/UUID identifiers & Serverless Lambdas
-- ============================================================

-- Enable required Postgres extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. EXAMINATIONS TABLE
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

-- 2. EXAMINATION ROUNDS TABLE
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
  instructions                TEXT,
  round_type                  TEXT        DEFAULT 'mcq',
  allow_tab_switch            BOOLEAN     DEFAULT false,
  allow_copy_paste            BOOLEAN     DEFAULT false,
  enforce_fullscreen          BOOLEAN     DEFAULT true,
  coding_language_support     TEXT[]      DEFAULT '{python,java}',
  coding_starter_templates    JSONB       DEFAULT '{}',
  min_time_before_submit_minutes INTEGER DEFAULT 1,
  success_message             TEXT        DEFAULT '',
  failure_message             TEXT        DEFAULT '',
  next_round_delay_seconds    INTEGER     DEFAULT 120,
  question_pool_count         INTEGER     DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS public.students (
  id          TEXT        PRIMARY KEY,
  full_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  roll_number TEXT        NOT NULL,
  login_id    TEXT,
  examination_id TEXT,
  attributes  JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
  id             TEXT        PRIMARY KEY,
  examination_id TEXT        NOT NULL REFERENCES public.examinations(id) ON DELETE CASCADE,
  student_id     TEXT        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         TEXT        NOT NULL DEFAULT 'registered',
  login_id       TEXT,
  UNIQUE(examination_id, student_id)
);

-- 5. QUESTION BANKS TABLE
CREATE TABLE IF NOT EXISTS public.question_banks (
  id             TEXT        PRIMARY KEY,
  examination_id TEXT        REFERENCES public.examinations(id) ON DELETE CASCADE,
  round_id       TEXT        REFERENCES public.examination_rounds(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
  id              TEXT         PRIMARY KEY,
  bank_id         TEXT         REFERENCES public.question_banks(id) ON DELETE SET NULL,
  round_id        TEXT         REFERENCES public.examination_rounds(id) ON DELETE SET NULL,
  question_text   TEXT         NOT NULL,
  question_type   TEXT         NOT NULL DEFAULT 'single_choice',
  difficulty      TEXT         NOT NULL DEFAULT 'medium',
  marks           NUMERIC(5,2) NOT NULL DEFAULT 1,
  negative_marks  NUMERIC(5,2) NOT NULL DEFAULT 0,
  status          TEXT         NOT NULL DEFAULT 'approved',
  ocr_confidence  INTEGER,
  image_url       TEXT,
  explanation     TEXT,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 7. QUESTION OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.question_options (
  id          TEXT        PRIMARY KEY,
  question_id TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  option_text TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ANSWER KEYS TABLE
CREATE TABLE IF NOT EXISTS public.answer_keys (
  id                   TEXT        PRIMARY KEY,
  question_id          TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE UNIQUE,
  correct_option_label TEXT        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PDF DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.pdf_documents (
  id                TEXT        PRIMARY KEY,
  round_id          TEXT        REFERENCES public.examination_rounds(id) ON DELETE SET NULL,
  storage_path      TEXT        NOT NULL,
  original_filename TEXT        NOT NULL,
  file_size_bytes   BIGINT,
  uploaded_by       TEXT,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. OCR JOBS TABLE
CREATE TABLE IF NOT EXISTS public.ocr_jobs (
  id                  TEXT        PRIMARY KEY,
  pdf_document_id     TEXT        REFERENCES public.pdf_documents(id) ON DELETE CASCADE,
  round_id            TEXT,
  round_name          TEXT,
  status              TEXT        NOT NULL DEFAULT 'completed',
  progress_percent    INTEGER     NOT NULL DEFAULT 100,
  questions_extracted INTEGER     DEFAULT 0,
  error_message       TEXT,
  worker_id           TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. EXAMINATION ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.examination_attempts (
  id                     TEXT        PRIMARY KEY,
  registration_id        TEXT        NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  round_id               TEXT        NOT NULL REFERENCES public.examination_rounds(id) ON DELETE CASCADE,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at            TIMESTAMPTZ NOT NULL,
  submitted_at           TIMESTAMPTZ,
  status                 TEXT        NOT NULL DEFAULT 'in_progress',
  assigned_question_ids  TEXT[]      NOT NULL DEFAULT '{}',
  shuffled_option_orders JSONB       DEFAULT '{}',
  cheating_warnings      INTEGER     NOT NULL DEFAULT 0,
  ip_address             TEXT,
  user_agent             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. ATTEMPT ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id                    TEXT        PRIMARY KEY,
  attempt_id            TEXT        NOT NULL REFERENCES public.examination_attempts(id) ON DELETE CASCADE,
  question_id           TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option       TEXT,
  code_snippet          TEXT,
  code_language         TEXT,
  is_marked_for_review  BOOLEAN     NOT NULL DEFAULT false,
  answered_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

-- 13. EXAMINATION RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.examination_results (
  id                TEXT        PRIMARY KEY,
  attempt_id        TEXT        NOT NULL REFERENCES public.examination_attempts(id) ON DELETE CASCADE UNIQUE,
  registration_id   TEXT        NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  round_id          TEXT        NOT NULL REFERENCES public.examination_rounds(id) ON DELETE CASCADE,
  correct_count     INTEGER     NOT NULL DEFAULT 0,
  wrong_count       INTEGER     NOT NULL DEFAULT 0,
  unanswered_count  INTEGER     NOT NULL DEFAULT 0,
  score             NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_marks       NUMERIC(8,2) NOT NULL,
  qualifying_marks  NUMERIC(8,2) NOT NULL,
  is_qualified      BOOLEAN     NOT NULL,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. ROUND QUALIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.round_qualifications (
  id                TEXT        PRIMARY KEY,
  registration_id   TEXT        NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  round_id          TEXT        NOT NULL REFERENCES public.examination_rounds(id) ON DELETE CASCADE,
  qualified         BOOLEAN     NOT NULL,
  next_round_number INTEGER,
  qualified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(registration_id, round_id)
);

-- 15. CHEATING EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.cheating_events (
  id              TEXT        PRIMARY KEY,
  attempt_id      TEXT        NOT NULL REFERENCES public.examination_attempts(id) ON DELETE CASCADE,
  violation_type  TEXT        NOT NULL,
  warning_number  INTEGER     NOT NULL,
  metadata        JSONB       DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. EXAMINATION AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.examination_audit_logs (
  id             TEXT        PRIMARY KEY,
  examination_id TEXT,
  actor_id       TEXT,
  action         TEXT        NOT NULL,
  metadata       JSONB       DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exam_slug ON public.examinations(slug);
CREATE INDEX IF NOT EXISTS idx_rounds_exam ON public.examination_rounds(examination_id);
CREATE INDEX IF NOT EXISTS idx_questions_round ON public.questions(round_id);
CREATE INDEX IF NOT EXISTS idx_options_question ON public.question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_students_roll ON public.students(roll_number);
CREATE INDEX IF NOT EXISTS idx_regs_exam ON public.registrations(examination_id);
CREATE INDEX IF NOT EXISTS idx_attempts_reg ON public.examination_attempts(registration_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON public.attempt_answers(attempt_id, question_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) & PERMISSIVE ACCESS
-- Allows API routes and client interfaces to query and mutate data
-- ============================================================
ALTER TABLE public.examinations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_qualifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheating_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_audit_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for full operational functionality
DROP POLICY IF EXISTS "allow_all_examinations" ON public.examinations;
CREATE POLICY "allow_all_examinations" ON public.examinations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_rounds" ON public.examination_rounds;
CREATE POLICY "allow_all_rounds" ON public.examination_rounds FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_students" ON public.students;
CREATE POLICY "allow_all_students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_registrations" ON public.registrations;
CREATE POLICY "allow_all_registrations" ON public.registrations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_question_banks" ON public.question_banks;
CREATE POLICY "allow_all_question_banks" ON public.question_banks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_questions" ON public.questions;
CREATE POLICY "allow_all_questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_question_options" ON public.question_options;
CREATE POLICY "allow_all_question_options" ON public.question_options FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_answer_keys" ON public.answer_keys;
CREATE POLICY "allow_all_answer_keys" ON public.answer_keys FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_pdf_documents" ON public.pdf_documents;
CREATE POLICY "allow_all_pdf_documents" ON public.pdf_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ocr_jobs" ON public.ocr_jobs;
CREATE POLICY "allow_all_ocr_jobs" ON public.ocr_jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_attempts" ON public.examination_attempts;
CREATE POLICY "allow_all_attempts" ON public.examination_attempts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_attempt_answers" ON public.attempt_answers;
CREATE POLICY "allow_all_attempt_answers" ON public.attempt_answers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_results" ON public.examination_results;
CREATE POLICY "allow_all_results" ON public.examination_results FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_qualifications" ON public.round_qualifications;
CREATE POLICY "allow_all_qualifications" ON public.round_qualifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_cheating" ON public.cheating_events;
CREATE POLICY "allow_all_cheating" ON public.cheating_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_audit" ON public.examination_audit_logs;
CREATE POLICY "allow_all_audit" ON public.examination_audit_logs FOR ALL USING (true) WITH CHECK (true);
