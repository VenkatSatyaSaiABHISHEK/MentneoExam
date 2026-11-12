-- ============================================================
-- Migration 005: High-Concurrency Batching & Connection Scaling
-- ExamS Multi-Round Examination Platform (500 Concurrent Students)
-- ============================================================

-- 1. High-Performance Composite Index for Rapid Answer Lookups & Upserts
CREATE INDEX IF NOT EXISTS idx_attempt_answers_concurrency 
  ON attempt_answers(attempt_id, question_id, updated_at);

-- 2. Server-Authoritative High-Concurrency Batch Upsert Function
-- Processes an array of answer objects in a single database transaction,
-- avoiding hundreds of individual network roundtrips per examination cohort.
CREATE OR REPLACE FUNCTION save_attempt_answers_batch(
  p_attempt_id UUID,
  p_answers    JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_attempt examination_attempts%ROWTYPE;
  v_count   INTEGER := 0;
BEGIN
  -- Verify attempt exists, is currently in progress, and deadline has not passed
  SELECT * INTO v_attempt
  FROM examination_attempts
  WHERE id = p_attempt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  IF v_attempt.status != 'in_progress' OR v_attempt.deadline_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt is finalized or expired');
  END IF;

  -- Atomic batch upsert using jsonb_to_recordset
  INSERT INTO attempt_answers (
    attempt_id,
    question_id,
    selected_option,
    is_marked_for_review,
    answered_at,
    updated_at
  )
  SELECT
    p_attempt_id,
    (item->>'questionId')::UUID,
    item->>'selectedOption',
    COALESCE((item->>'isMarkedForReview')::BOOLEAN, false),
    NOW(),
    NOW()
  FROM jsonb_array_elements(p_answers) AS item
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    selected_option      = EXCLUDED.selected_option,
    is_marked_for_review = EXCLUDED.is_marked_for_review,
    updated_at           = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', p_attempt_id,
    'upserted_count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. SUPAVISOR TRANSACTION POOLING CONFIGURATION REFERENCE
--
-- For 500 simultaneous candidates, connect via Supavisor pooler:
-- Host: aws-0-[region].pooler.supabase.com (or project ref pooler)
-- Port: 6543 (Transaction Mode)
-- User: postgres.[project-ref]
--
-- In transaction pooling mode (port 6543):
-- - Client connections can scale up to 10,000+ virtual clients.
-- - Connections are released back to the pool immediately after each query/transaction.
-- - Never use LISTEN/NOTIFY or PREPARE statements on transaction poolers.
-- ============================================================

