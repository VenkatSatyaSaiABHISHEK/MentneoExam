-- ============================================================
-- Migration 003: Functions and Triggers
-- ExamS Multi-Round Examination Platform
-- ============================================================

-- ============================================================
-- UTILITY: Auto-update updated_at on row change
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to all tables with updated_at
CREATE TRIGGER trg_examinations_updated_at
  BEFORE UPDATE ON examinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rounds_updated_at
  BEFORE UPDATE ON examination_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_answer_keys_updated_at
  BEFORE UPDATE ON answer_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_attempt_answers_updated_at
  BEFORE UPDATE ON attempt_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Auto-create profile after Supabase Auth user signs up
-- Runs with SECURITY DEFINER so it can write to profiles
-- regardless of RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Audit log helper: insert an audit row (call from server API)
-- ============================================================
CREATE OR REPLACE FUNCTION log_exam_action(
  p_examination_id UUID,
  p_actor_id       UUID,
  p_action         TEXT,
  p_metadata       JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO examination_audit_logs (examination_id, actor_id, action, metadata)
  VALUES (p_examination_id, p_actor_id, p_action, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Cheating warning: increment warning counter on attempt,
-- auto-terminate if max_cheating_warnings is reached.
-- Called from server-side cheating event handler.
-- ============================================================
CREATE OR REPLACE FUNCTION record_cheating_event(
  p_attempt_id    UUID,
  p_violation     TEXT,
  p_metadata      JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
  v_attempt     examination_attempts%ROWTYPE;
  v_round       examination_rounds%ROWTYPE;
  v_exam        examinations%ROWTYPE;
  v_warning_no  INTEGER;
  v_terminated  BOOLEAN := false;
BEGIN
  -- Lock the attempt row
  SELECT * INTO v_attempt
  FROM examination_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Attempt not found');
  END IF;

  IF v_attempt.status != 'in_progress' THEN
    RETURN jsonb_build_object('error', 'Attempt is not in progress');
  END IF;

  -- Increment warning counter
  v_warning_no := v_attempt.cheating_warnings + 1;

  UPDATE examination_attempts
  SET cheating_warnings = v_warning_no
  WHERE id = p_attempt_id;

  -- Insert cheating event record
  INSERT INTO cheating_events (attempt_id, violation_type, warning_number, metadata)
  VALUES (p_attempt_id, p_violation, v_warning_no, p_metadata);

  -- Check if we should terminate the attempt
  SELECT * INTO v_round FROM examination_rounds WHERE id = v_attempt.round_id;
  SELECT * INTO v_exam  FROM examinations       WHERE id = v_round.examination_id;

  IF v_warning_no >= v_exam.max_cheating_warnings THEN
    UPDATE examination_attempts
    SET status = 'terminated', submitted_at = NOW()
    WHERE id = p_attempt_id;
    v_terminated := true;
  END IF;

  RETURN jsonb_build_object(
    'warning_number',  v_warning_no,
    'max_warnings',    v_exam.max_cheating_warnings,
    'terminated',      v_terminated
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Finalize expired attempts
-- Called by a background cron job (pg_cron or external worker).
-- Marks all in_progress attempts whose deadline has passed as
-- timed_out and sets submitted_at = deadline_at.
-- Returns the number of attempts finalized.
-- ============================================================
CREATE OR REPLACE FUNCTION finalize_expired_attempts()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER := 0;
  attempt_rec   RECORD;
BEGIN
  FOR attempt_rec IN
    SELECT id, deadline_at
    FROM examination_attempts
    WHERE status = 'in_progress'
    AND deadline_at < NOW()
  LOOP
    UPDATE examination_attempts
    SET status = 'timed_out', submitted_at = attempt_rec.deadline_at
    WHERE id = attempt_rec.id;

    expired_count := expired_count + 1;
  END LOOP;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Submit examination attempt
-- Idempotent, transactional. Must be called with service-role
-- key from a secure API route — never from the browser.
--
-- Steps:
--   1. Lock attempt row (prevents double submission)
--   2. If already submitted, return existing result (idempotent)
--   3. Evaluate answers against answer_keys
--   4. Compute score (positive marks - negative marks, floor 0)
--   5. Determine qualification
--   6. Persist result and qualification records
--   7. Return full result JSON
-- ============================================================
CREATE OR REPLACE FUNCTION submit_examination_attempt(
  p_attempt_id      UUID,
  p_registration_id UUID,
  p_round_id        UUID
)
RETURNS JSONB AS $$
DECLARE
  v_attempt           examination_attempts%ROWTYPE;
  v_round             examination_rounds%ROWTYPE;
  v_result            examination_results%ROWTYPE;
  v_correct           INTEGER  := 0;
  v_wrong             INTEGER  := 0;
  v_unanswered        INTEGER  := 0;
  v_score             NUMERIC  := 0;
  v_qualified         BOOLEAN;
  v_next_round_number INTEGER;
  v_answer            RECORD;
  v_question_count    INTEGER;
BEGIN
  -- Step 1: Lock the attempt row to prevent concurrent submissions
  SELECT * INTO v_attempt
  FROM examination_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Attempt not found');
  END IF;

  -- Step 2: Idempotency — already submitted
  IF v_attempt.status IN ('submitted', 'timed_out', 'terminated') THEN
    SELECT * INTO v_result
    FROM examination_results
    WHERE attempt_id = p_attempt_id;

    RETURN jsonb_build_object(
      'status',           'already_submitted',
      'correct',          v_result.correct_count,
      'wrong',            v_result.wrong_count,
      'unanswered',       v_result.unanswered_count,
      'score',            v_result.score,
      'total_marks',      v_result.total_marks,
      'qualifying_marks', v_result.qualifying_marks,
      'is_qualified',     v_result.is_qualified
    );
  END IF;

  -- Step 3: Get round details for scoring config
  SELECT * INTO v_round FROM examination_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Round not found');
  END IF;

  -- Count assigned questions
  v_question_count := array_length(v_attempt.assigned_question_ids, 1);
  IF v_question_count IS NULL THEN
    v_question_count := 0;
  END IF;

  -- Step 3: Evaluate each assigned question
  FOR v_answer IN
    SELECT
      aa.selected_option,
      ak.correct_option_label
    FROM unnest(v_attempt.assigned_question_ids) AS q_id
    LEFT JOIN attempt_answers aa
           ON aa.attempt_id = p_attempt_id
          AND aa.question_id = q_id
    LEFT JOIN answer_keys ak ON ak.question_id = q_id
  LOOP
    IF v_answer.selected_option IS NULL OR v_answer.selected_option = '' THEN
      v_unanswered := v_unanswered + 1;
    ELSIF v_answer.selected_option = v_answer.correct_option_label THEN
      v_correct := v_correct + 1;
      v_score   := v_score + v_round.marks_per_question;
    ELSE
      v_wrong := v_wrong + 1;
      v_score := v_score - v_round.negative_marks;
    END IF;
  END LOOP;

  -- Floor score at 0
  v_score := GREATEST(v_score, 0);

  -- Step 4: Determine qualification
  v_qualified := v_score >= v_round.qualifying_marks;

  -- Step 5: Find next round if qualified
  IF v_qualified THEN
    SELECT er.round_number INTO v_next_round_number
    FROM examination_rounds er
    WHERE er.examination_id = v_round.examination_id
    AND er.round_number > v_round.round_number
    ORDER BY er.round_number ASC
    LIMIT 1;
  END IF;

  -- Step 6a: Mark attempt as submitted
  UPDATE examination_attempts
  SET status = 'submitted', submitted_at = NOW()
  WHERE id = p_attempt_id;

  -- Step 6b: Insert result (ON CONFLICT for safety on retries)
  INSERT INTO examination_results (
    attempt_id, registration_id, round_id,
    correct_count, wrong_count, unanswered_count,
    score, total_marks, qualifying_marks, is_qualified
  ) VALUES (
    p_attempt_id, p_registration_id, p_round_id,
    v_correct, v_wrong, v_unanswered,
    v_score, v_round.total_marks, v_round.qualifying_marks, v_qualified
  )
  ON CONFLICT (attempt_id) DO NOTHING;

  -- Step 6c: Insert qualification record
  INSERT INTO round_qualifications (
    registration_id, round_id, qualified, next_round_number
  ) VALUES (
    p_registration_id, p_round_id, v_qualified, v_next_round_number
  )
  ON CONFLICT (registration_id, round_id) DO NOTHING;

  -- Step 7: Return result
  RETURN jsonb_build_object(
    'status',             'submitted',
    'correct',            v_correct,
    'wrong',              v_wrong,
    'unanswered',         v_unanswered,
    'score',              v_score,
    'total_marks',        v_round.total_marks,
    'qualifying_marks',   v_round.qualifying_marks,
    'is_qualified',       v_qualified,
    'next_round_number',  v_next_round_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Assign questions to an attempt (sequential or random)
-- Called when a student begins a round.
-- ============================================================
CREATE OR REPLACE FUNCTION assign_questions_to_attempt(
  p_attempt_id UUID,
  p_round_id   UUID
)
RETURNS UUID[] AS $$
DECLARE
  v_round    examination_rounds%ROWTYPE;
  v_q_ids    UUID[];
BEGIN
  SELECT * INTO v_round FROM examination_rounds WHERE id = p_round_id;

  IF v_round.question_selection_strategy = 'random' THEN
    SELECT ARRAY(
      SELECT id FROM questions
      WHERE round_id = p_round_id
      AND status = 'approved'
      ORDER BY random()
      LIMIT v_round.total_questions
    ) INTO v_q_ids;
  ELSE
    -- sequential: order by sort_order
    SELECT ARRAY(
      SELECT id FROM questions
      WHERE round_id = p_round_id
      AND status = 'approved'
      ORDER BY sort_order ASC, created_at ASC
      LIMIT v_round.total_questions
    ) INTO v_q_ids;
  END IF;

  -- Persist assigned question IDs on the attempt
  UPDATE examination_attempts
  SET assigned_question_ids = v_q_ids
  WHERE id = p_attempt_id;

  RETURN v_q_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
