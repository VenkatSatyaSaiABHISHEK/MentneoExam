-- ============================================================
-- Migration 004: Performance Indexes
-- ExamS Multi-Round Examination Platform
-- ============================================================

-- ============================================================
-- EXAMINATIONS
-- ============================================================
-- Fast slug lookups (used in public exam pages)
CREATE INDEX idx_examinations_slug   ON examinations(slug);
-- Filter by status (dashboard listing, public exam list)
CREATE INDEX idx_examinations_status ON examinations(status);
-- Partial index: active / live exams (most common filter)
CREATE INDEX idx_examinations_live   ON examinations(id) WHERE status IN ('live','scheduled');

-- ============================================================
-- EXAMINATION ROUNDS
-- ============================================================
CREATE INDEX idx_examination_rounds_exam_id ON examination_rounds(examination_id);
CREATE INDEX idx_examination_rounds_status  ON examination_rounds(status);
-- Composite for fetching rounds of an exam sorted by number
CREATE INDEX idx_rounds_exam_number ON examination_rounds(examination_id, round_number);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE INDEX idx_students_email       ON students(email);
CREATE INDEX idx_students_roll_number ON students(roll_number);

-- ============================================================
-- REGISTRATIONS
-- ============================================================
CREATE INDEX idx_registrations_exam_id    ON registrations(examination_id);
CREATE INDEX idx_registrations_student_id ON registrations(student_id);
-- Composite used to check if student is registered for an exam
CREATE INDEX idx_registrations_exam_student ON registrations(examination_id, student_id);

-- Roll-number uniqueness per exam:
-- Since roll_number lives on students, we enforce uniqueness of
-- (examination_id, students.roll_number) via a unique index on a view
-- or we do it application-side. Here we add a denormalized index helper:
-- A unique constraint cannot directly span two tables, so we document
-- this is enforced at the application/API layer and checked on insert.

-- ============================================================
-- QUESTION BANKS
-- ============================================================
CREATE INDEX idx_question_banks_exam_id  ON question_banks(examination_id);
CREATE INDEX idx_question_banks_round_id ON question_banks(round_id);

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE INDEX idx_questions_round_id ON questions(round_id);
CREATE INDEX idx_questions_bank_id  ON questions(bank_id);
CREATE INDEX idx_questions_status   ON questions(status);
-- Composite for pulling approved questions for a round
CREATE INDEX idx_questions_round_approved ON questions(round_id, sort_order)
  WHERE status = 'approved';

-- ============================================================
-- QUESTION OPTIONS
-- ============================================================
CREATE INDEX idx_question_options_question_id ON question_options(question_id);

-- ============================================================
-- ANSWER KEYS
-- ============================================================
-- question_id already has a UNIQUE constraint (implicit index)

-- ============================================================
-- PDF DOCUMENTS
-- ============================================================
CREATE INDEX idx_pdf_documents_round_id ON pdf_documents(round_id);

-- ============================================================
-- OCR JOBS
-- ============================================================
CREATE INDEX idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX idx_ocr_jobs_pdf_id ON ocr_jobs(pdf_document_id);
-- Partial: only pending/processing jobs need frequent polling
CREATE INDEX idx_ocr_jobs_active ON ocr_jobs(created_at)
  WHERE status IN ('uploaded','queued','processing');

-- ============================================================
-- EXAMINATION ATTEMPTS
-- ============================================================
CREATE INDEX idx_attempts_registration_id ON examination_attempts(registration_id);
CREATE INDEX idx_attempts_round_id        ON examination_attempts(round_id);
CREATE INDEX idx_attempts_status          ON examination_attempts(status);
-- Partial: only active attempts need deadline scanning
CREATE INDEX idx_attempts_deadline ON examination_attempts(deadline_at)
  WHERE status = 'in_progress';
-- Composite for student fetching their own attempt for a round
CREATE INDEX idx_attempts_reg_round ON examination_attempts(registration_id, round_id);

-- ============================================================
-- ATTEMPT ANSWERS
-- ============================================================
CREATE INDEX idx_attempt_answers_attempt_id  ON attempt_answers(attempt_id);
CREATE INDEX idx_attempt_answers_question_id ON attempt_answers(question_id);
-- Composite for fetching all answers of an attempt
CREATE INDEX idx_attempt_answers_attempt_question ON attempt_answers(attempt_id, question_id);

-- ============================================================
-- EXAMINATION RESULTS
-- ============================================================
CREATE INDEX idx_results_attempt_id      ON examination_results(attempt_id);
CREATE INDEX idx_results_registration_id ON examination_results(registration_id);
CREATE INDEX idx_results_round_id        ON examination_results(round_id);
-- Composite for leaderboard queries
CREATE INDEX idx_results_round_score ON examination_results(round_id, score DESC);

-- ============================================================
-- ROUND QUALIFICATIONS
-- ============================================================
CREATE INDEX idx_round_quals_registration_id ON round_qualifications(registration_id);
CREATE INDEX idx_round_quals_round_id        ON round_qualifications(round_id);
-- Composite used to check a student's qualification for a round
CREATE INDEX idx_round_quals_reg_round ON round_qualifications(registration_id, round_id);

-- ============================================================
-- CHEATING EVENTS
-- ============================================================
CREATE INDEX idx_cheating_attempt_id ON cheating_events(attempt_id);
CREATE INDEX idx_cheating_occurred   ON cheating_events(occurred_at);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE INDEX idx_audit_logs_exam_id    ON examination_audit_logs(examination_id);
CREATE INDEX idx_audit_logs_actor_id   ON examination_audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON examination_audit_logs(created_at);
