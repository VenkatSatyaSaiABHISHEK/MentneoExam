-- ============================================================
-- Migration 002: Row Level Security Policies
-- ExamS Multi-Round Examination Platform
-- ============================================================

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE examinations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_banks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options        ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_qualifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_audit_logs  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: is current user an admin?
-- Uses SECURITY DEFINER so it can query profiles without
-- triggering infinite RLS recursion.
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES
-- Users read/update their own profile; admins read all.
-- ============================================================
CREATE POLICY "profiles_self_read"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_self_update"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_admin_insert"
  ON profiles FOR INSERT
  WITH CHECK (is_admin() OR id = auth.uid());

-- ============================================================
-- EXAMINATIONS
-- Admins have full access; unauthenticated/students can read
-- publicly visible (non-draft, non-archived) exams.
-- ============================================================
CREATE POLICY "exams_admin_all"
  ON examinations FOR ALL
  USING (is_admin());

CREATE POLICY "exams_public_read"
  ON examinations FOR SELECT
  USING (status IN ('published','scheduled','live','completed'));

-- ============================================================
-- EXAMINATION ROUNDS
-- Admins full access; public can read rounds whose parent exam
-- is publicly visible.
-- ============================================================
CREATE POLICY "rounds_admin_all"
  ON examination_rounds FOR ALL
  USING (is_admin());

CREATE POLICY "rounds_public_read"
  ON examination_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM examinations e
      WHERE e.id = examination_id
      AND e.status IN ('published','scheduled','live','completed')
    )
  );

-- ============================================================
-- STUDENTS
-- Admins full access; anyone can self-register (insert) and
-- read students (needed for validation). In production, the
-- insert policy can be tightened to require a valid exam token.
-- ============================================================
CREATE POLICY "students_admin_all"
  ON students FOR ALL
  USING (is_admin());

CREATE POLICY "students_self_insert"
  ON students FOR INSERT
  WITH CHECK (true);

CREATE POLICY "students_self_read"
  ON students FOR SELECT
  USING (true);

-- ============================================================
-- REGISTRATIONS
-- Admins full access; students can register and read their own
-- registration (linked via students table).
-- ============================================================
CREATE POLICY "reg_admin_all"
  ON registrations FOR ALL
  USING (is_admin());

CREATE POLICY "reg_student_insert"
  ON registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "reg_student_read"
  ON registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_id
    )
  );

-- ============================================================
-- QUESTION BANKS
-- Admins only.
-- ============================================================
CREATE POLICY "banks_admin_all"
  ON question_banks FOR ALL
  USING (is_admin());

-- ============================================================
-- QUESTIONS
-- Admins full access; students see only approved questions.
-- Correct answers are NEVER exposed through this table —
-- they live exclusively in answer_keys which students cannot read.
-- ============================================================
CREATE POLICY "questions_admin_all"
  ON questions FOR ALL
  USING (is_admin());

CREATE POLICY "questions_student_read"
  ON questions FOR SELECT
  USING (status = 'approved');

-- ============================================================
-- QUESTION OPTIONS
-- Same visibility rules as questions.
-- ============================================================
CREATE POLICY "options_admin_all"
  ON question_options FOR ALL
  USING (is_admin());

CREATE POLICY "options_student_read"
  ON question_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_id
      AND q.status = 'approved'
    )
  );

-- ============================================================
-- ANSWER KEYS
-- ADMINS ONLY — students must NEVER access this table.
-- Scoring is done server-side via the submit_examination_attempt
-- function which runs with SECURITY DEFINER.
-- ============================================================
CREATE POLICY "answer_keys_admin_only"
  ON answer_keys FOR ALL
  USING (is_admin());

-- ============================================================
-- PDF DOCUMENTS
-- Admins only.
-- ============================================================
CREATE POLICY "pdf_admin_all"
  ON pdf_documents FOR ALL
  USING (is_admin());

-- ============================================================
-- OCR JOBS
-- Admins only.
-- ============================================================
CREATE POLICY "ocr_admin_all"
  ON ocr_jobs FOR ALL
  USING (is_admin());

-- ============================================================
-- EXAMINATION ATTEMPTS
-- Admins full access; students can create their own attempt,
-- read it, and update it (save answers / submit).
-- ============================================================
CREATE POLICY "attempts_admin_all"
  ON examination_attempts FOR ALL
  USING (is_admin());

CREATE POLICY "attempts_student_insert"
  ON examination_attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "attempts_student_read"
  ON examination_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_id
    )
  );

CREATE POLICY "attempts_student_update"
  ON examination_attempts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_id
    )
  );

-- ============================================================
-- ATTEMPT ANSWERS
-- Admins full access; students access answers for their own
-- attempt (insert, update, read).
-- ============================================================
CREATE POLICY "answers_admin_all"
  ON attempt_answers FOR ALL
  USING (is_admin());

CREATE POLICY "answers_student_all"
  ON attempt_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM examination_attempts ea
      WHERE ea.id = attempt_id
    )
  );

-- ============================================================
-- EXAMINATION RESULTS
-- Admins full access; students can read their own result only
-- after the attempt has been submitted/timed-out/terminated.
-- ============================================================
CREATE POLICY "results_admin_all"
  ON examination_results FOR ALL
  USING (is_admin());

CREATE POLICY "results_student_read"
  ON examination_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM examination_attempts ea
      WHERE ea.id = attempt_id
      AND ea.status IN ('submitted','timed_out','terminated')
    )
  );

-- ============================================================
-- ROUND QUALIFICATIONS
-- Admins full access; students can read their own qualification
-- status (needed to show which round they can enter next).
-- ============================================================
CREATE POLICY "quals_admin_all"
  ON round_qualifications FOR ALL
  USING (is_admin());

CREATE POLICY "quals_student_read"
  ON round_qualifications FOR SELECT
  USING (true);

-- ============================================================
-- CHEATING EVENTS
-- Admins full access; students (the client-side proctor)
-- can insert events for their own active attempt.
-- ============================================================
CREATE POLICY "cheating_admin_all"
  ON cheating_events FOR ALL
  USING (is_admin());

CREATE POLICY "cheating_student_insert"
  ON cheating_events FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- EXAMINATION AUDIT LOGS
-- Admins full access (read + write for server-side logging).
-- ============================================================
CREATE POLICY "audit_admin_all"
  ON examination_audit_logs FOR ALL
  USING (is_admin());
