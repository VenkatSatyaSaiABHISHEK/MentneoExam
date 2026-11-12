-- ============================================================
-- Migration 001: Initial Schema
-- ExamS Multi-Round Examination Platform
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'super_admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXAMINATIONS
-- ============================================================
CREATE TABLE examinations (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     TEXT        NOT NULL,
  slug                     TEXT        NOT NULL UNIQUE,
  description              TEXT,
  status                   TEXT        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','published','scheduled','live','completed','archived')),
  exam_date                TIMESTAMPTZ,
  start_time               TIMESTAMPTZ,
  registration_deadline    TIMESTAMPTZ,
  student_limit            INTEGER,
  instructions             TEXT,
  qualification_config     JSONB       DEFAULT '{}',
  show_marks_to_students   BOOLEAN     NOT NULL DEFAULT true,
  max_cheating_warnings    INTEGER     NOT NULL DEFAULT 3,
  created_by               UUID        REFERENCES profiles(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXAMINATION ROUNDS
-- ============================================================
CREATE TABLE examination_rounds (
  id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  examination_id              UUID        NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  round_number                INTEGER     NOT NULL,
  name                        TEXT        NOT NULL,
  duration_minutes            INTEGER     NOT NULL DEFAULT 60,
  total_questions             INTEGER     NOT NULL DEFAULT 30,
  marks_per_question          NUMERIC(5,2) NOT NULL DEFAULT 1,
  negative_marks              NUMERIC(5,2) NOT NULL DEFAULT 0,
  qualifying_marks            NUMERIC(8,2) NOT NULL,
  total_marks                 NUMERIC(8,2) NOT NULL,
  question_selection_strategy TEXT        NOT NULL DEFAULT 'sequential'
                                CHECK (question_selection_strategy IN ('sequential','random')),
  scheduled_start             TIMESTAMPTZ,
  status                      TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','completed','cancelled')),
  auto_qualify                BOOLEAN     NOT NULL DEFAULT true,
  instructions                TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(examination_id, round_number)
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  roll_number TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, roll_number)
);

-- ============================================================
-- REGISTRATIONS
-- Note: roll_number uniqueness per exam is enforced via a
-- partial unique index (see migration 004) using a join-based
-- approach. The UNIQUE constraint here covers only
-- (examination_id, student_id) so a student cannot register
-- twice for the same exam.
-- ============================================================
CREATE TABLE registrations (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  examination_id UUID        NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  student_id     UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         TEXT        NOT NULL DEFAULT 'registered'
                   CHECK (status IN ('registered','started','completed','disqualified')),
  UNIQUE(examination_id, student_id)
);

-- ============================================================
-- QUESTION BANKS
-- ============================================================
CREATE TABLE question_banks (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  examination_id UUID        REFERENCES examinations(id) ON DELETE CASCADE,
  round_id       UUID        REFERENCES examination_rounds(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE TABLE questions (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id         UUID         REFERENCES question_banks(id) ON DELETE SET NULL,
  round_id        UUID         REFERENCES examination_rounds(id) ON DELETE SET NULL,
  question_text   TEXT         NOT NULL,
  question_type   TEXT         NOT NULL DEFAULT 'single_choice'
                    CHECK (question_type IN ('single_choice','multiple_choice','true_false')),
  difficulty      TEXT         NOT NULL DEFAULT 'medium'
                    CHECK (difficulty IN ('easy','medium','hard')),
  marks           NUMERIC(5,2) NOT NULL DEFAULT 1,
  negative_marks  NUMERIC(5,2) NOT NULL DEFAULT 0,
  status          TEXT         NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_review','approved','rejected')),
  ocr_confidence  INTEGER,
  image_url       TEXT,
  explanation     TEXT,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUESTION OPTIONS (A, B, C, D, E, True, False)
-- ============================================================
CREATE TABLE question_options (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL
                CHECK (label IN ('A','B','C','D','E','True','False')),
  option_text TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, label)
);

-- ============================================================
-- ANSWER KEYS (stored separately for security)
-- Answer keys are only accessible to admins via RLS policy.
-- Students never see this table.
-- ============================================================
CREATE TABLE answer_keys (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id          UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE UNIQUE,
  correct_option_label TEXT        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PDF DOCUMENTS
-- ============================================================
CREATE TABLE pdf_documents (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id          UUID        REFERENCES examination_rounds(id) ON DELETE SET NULL,
  storage_path      TEXT        NOT NULL,
  original_filename TEXT        NOT NULL,
  file_size_bytes   BIGINT,
  uploaded_by       UUID        REFERENCES profiles(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OCR JOBS
-- ============================================================
CREATE TABLE ocr_jobs (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pdf_document_id   UUID        NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'uploaded'
                      CHECK (status IN ('uploaded','queued','processing','completed','failed')),
  progress_percent  INTEGER     NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  questions_extracted INTEGER,
  error_message     TEXT,
  worker_id         TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXAMINATION ATTEMPTS (one per student per round)
-- ============================================================
CREATE TABLE examination_attempts (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id        UUID        NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  round_id               UUID        NOT NULL REFERENCES examination_rounds(id) ON DELETE CASCADE,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at            TIMESTAMPTZ NOT NULL,
  submitted_at           TIMESTAMPTZ,
  status                 TEXT        NOT NULL DEFAULT 'in_progress'
                           CHECK (status IN ('in_progress','submitted','timed_out','terminated')),
  assigned_question_ids  UUID[]      NOT NULL DEFAULT '{}',
  cheating_warnings      INTEGER     NOT NULL DEFAULT 0,
  ip_address             INET,
  user_agent             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(registration_id, round_id)
);

-- ============================================================
-- ATTEMPT ANSWERS (incrementally saved as student answers)
-- ============================================================
CREATE TABLE attempt_answers (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id            UUID        NOT NULL REFERENCES examination_attempts(id) ON DELETE CASCADE,
  question_id           UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option       TEXT,
  is_marked_for_review  BOOLEAN     NOT NULL DEFAULT false,
  answered_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

-- ============================================================
-- EXAMINATION RESULTS
-- ============================================================
CREATE TABLE examination_results (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id        UUID        NOT NULL REFERENCES examination_attempts(id) ON DELETE CASCADE UNIQUE,
  registration_id   UUID        NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  round_id          UUID        NOT NULL REFERENCES examination_rounds(id) ON DELETE CASCADE,
  correct_count     INTEGER     NOT NULL DEFAULT 0,
  wrong_count       INTEGER     NOT NULL DEFAULT 0,
  unanswered_count  INTEGER     NOT NULL DEFAULT 0,
  score             NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_marks       NUMERIC(8,2) NOT NULL,
  qualifying_marks  NUMERIC(8,2) NOT NULL,
  is_qualified      BOOLEAN     NOT NULL,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROUND QUALIFICATIONS
-- ============================================================
CREATE TABLE round_qualifications (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id   UUID        NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  round_id          UUID        NOT NULL REFERENCES examination_rounds(id) ON DELETE CASCADE,
  qualified         BOOLEAN     NOT NULL,
  next_round_number INTEGER,
  qualified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(registration_id, round_id)
);

-- ============================================================
-- CHEATING EVENTS
-- ============================================================
CREATE TABLE cheating_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id      UUID        NOT NULL REFERENCES examination_attempts(id) ON DELETE CASCADE,
  violation_type  TEXT        NOT NULL
                    CHECK (violation_type IN (
                      'tab_switch','window_blur','fullscreen_exit',
                      'copy_attempt','paste_attempt','keyboard_shortcut'
                    )),
  warning_number  INTEGER     NOT NULL,
  metadata        JSONB       DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXAMINATION AUDIT LOGS
-- ============================================================
CREATE TABLE examination_audit_logs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  examination_id UUID        REFERENCES examinations(id) ON DELETE SET NULL,
  actor_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action         TEXT        NOT NULL,
  metadata       JSONB       DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
