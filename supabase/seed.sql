-- ============================================================
-- Seed Data — DEVELOPMENT ONLY
-- ExamS Multi-Round Examination Platform
-- ============================================================
-- WARNING: This file is for local development and testing.
-- DO NOT run against production databases.
-- Run with: supabase db seed
-- ============================================================

-- ============================================================
-- Sample Examination
-- ============================================================
INSERT INTO examinations (
  id,
  name,
  slug,
  description,
  status,
  exam_date,
  registration_deadline,
  student_limit,
  instructions,
  show_marks_to_students,
  max_cheating_warnings
) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Sample Engineering Entrance Exam 2026',
  'sample-engineering-2026',
  'A multi-round engineering entrance examination for demonstration purposes.',
  'draft',
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '25 days',
  500,
  E'1. All questions are multiple-choice.\n2. Each question carries equal marks.\n3. Negative marking applies for wrong answers.\n4. Do not switch tabs during the exam.\n5. Submit before the timer runs out.',
  true,
  3
);

-- ============================================================
-- Round 1: Screening Round
-- ============================================================
INSERT INTO examination_rounds (
  id,
  examination_id,
  round_number,
  name,
  duration_minutes,
  total_questions,
  marks_per_question,
  negative_marks,
  qualifying_marks,
  total_marks,
  question_selection_strategy,
  status,
  auto_qualify,
  instructions
) VALUES (
  'b1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  1,
  'Round 1 — Screening',
  60,
  30,
  4.00,
  1.00,
  60.00,
  120.00,
  'sequential',
  'draft',
  true,
  'Answer all 30 questions. Each correct answer awards 4 marks. Each wrong answer deducts 1 mark.'
);

-- ============================================================
-- Round 2: Advanced Round
-- ============================================================
INSERT INTO examination_rounds (
  id,
  examination_id,
  round_number,
  name,
  duration_minutes,
  total_questions,
  marks_per_question,
  negative_marks,
  qualifying_marks,
  total_marks,
  question_selection_strategy,
  status,
  auto_qualify,
  instructions
) VALUES (
  'c1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  2,
  'Round 2 — Advanced',
  90,
  40,
  4.00,
  1.00,
  100.00,
  160.00,
  'random',
  'draft',
  true,
  'Answer all 40 questions. Questions are randomized for each student.'
);

-- ============================================================
-- Sample Question Bank
-- ============================================================
INSERT INTO question_banks (
  id,
  examination_id,
  round_id,
  name
) VALUES (
  'd1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'Round 1 Question Bank'
);

-- ============================================================
-- Sample Questions (Round 1, approved)
-- ============================================================

-- Question 1
INSERT INTO questions (id, bank_id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order)
VALUES (
  'e1000000-0000-0000-0000-000000000001',
  'd1b2c3d4-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'What is the speed of light in a vacuum?',
  'single_choice', 'easy', 4.00, 1.00, 'approved', 1
);

INSERT INTO question_options (question_id, label, option_text, sort_order) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'A', '3 × 10⁸ m/s',  1),
  ('e1000000-0000-0000-0000-000000000001', 'B', '3 × 10⁶ m/s',  2),
  ('e1000000-0000-0000-0000-000000000001', 'C', '3 × 10¹⁰ m/s', 3),
  ('e1000000-0000-0000-0000-000000000001', 'D', '3 × 10⁴ m/s',  4);

INSERT INTO answer_keys (question_id, correct_option_label)
VALUES ('e1000000-0000-0000-0000-000000000001', 'A');

-- Question 2
INSERT INTO questions (id, bank_id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order)
VALUES (
  'e1000000-0000-0000-0000-000000000002',
  'd1b2c3d4-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'Which of the following is NOT a programming paradigm?',
  'single_choice', 'medium', 4.00, 1.00, 'approved', 2
);

INSERT INTO question_options (question_id, label, option_text, sort_order) VALUES
  ('e1000000-0000-0000-0000-000000000002', 'A', 'Object-Oriented', 1),
  ('e1000000-0000-0000-0000-000000000002', 'B', 'Functional',      2),
  ('e1000000-0000-0000-0000-000000000002', 'C', 'Declarative',     3),
  ('e1000000-0000-0000-0000-000000000002', 'D', 'Sequential',      4);

INSERT INTO answer_keys (question_id, correct_option_label)
VALUES ('e1000000-0000-0000-0000-000000000002', 'D');

-- Question 3
INSERT INTO questions (id, bank_id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order)
VALUES (
  'e1000000-0000-0000-0000-000000000003',
  'd1b2c3d4-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'The derivative of sin(x) with respect to x is:',
  'single_choice', 'easy', 4.00, 1.00, 'approved', 3
);

INSERT INTO question_options (question_id, label, option_text, sort_order) VALUES
  ('e1000000-0000-0000-0000-000000000003', 'A', 'cos(x)',  1),
  ('e1000000-0000-0000-0000-000000000003', 'B', '-cos(x)', 2),
  ('e1000000-0000-0000-0000-000000000003', 'C', 'sin(x)',  3),
  ('e1000000-0000-0000-0000-000000000003', 'D', 'tan(x)',  4);

INSERT INTO answer_keys (question_id, correct_option_label)
VALUES ('e1000000-0000-0000-0000-000000000003', 'A');

-- Question 4
INSERT INTO questions (id, bank_id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order)
VALUES (
  'e1000000-0000-0000-0000-000000000004',
  'd1b2c3d4-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'Which data structure operates on a LIFO (Last In, First Out) principle?',
  'single_choice', 'easy', 4.00, 1.00, 'approved', 4
);

INSERT INTO question_options (question_id, label, option_text, sort_order) VALUES
  ('e1000000-0000-0000-0000-000000000004', 'A', 'Queue',  1),
  ('e1000000-0000-0000-0000-000000000004', 'B', 'Stack',  2),
  ('e1000000-0000-0000-0000-000000000004', 'C', 'Heap',   3),
  ('e1000000-0000-0000-0000-000000000004', 'D', 'Graph',  4);

INSERT INTO answer_keys (question_id, correct_option_label)
VALUES ('e1000000-0000-0000-0000-000000000004', 'B');

-- Question 5
INSERT INTO questions (id, bank_id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order)
VALUES (
  'e1000000-0000-0000-0000-000000000005',
  'd1b2c3d4-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'The chemical formula for water is:',
  'single_choice', 'easy', 4.00, 1.00, 'approved', 5
);

INSERT INTO question_options (question_id, label, option_text, sort_order) VALUES
  ('e1000000-0000-0000-0000-000000000005', 'A', 'H₂O₂', 1),
  ('e1000000-0000-0000-0000-000000000005', 'B', 'CO₂',  2),
  ('e1000000-0000-0000-0000-000000000005', 'C', 'H₂O',  3),
  ('e1000000-0000-0000-0000-000000000005', 'D', 'NaCl', 4);

INSERT INTO answer_keys (question_id, correct_option_label)
VALUES ('e1000000-0000-0000-0000-000000000005', 'C');

-- ============================================================
-- Sample Students (for testing)
-- ============================================================
INSERT INTO students (id, full_name, email, roll_number) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'Alice Johnson',  'alice@example.com', 'ROLL001'),
  ('f1000000-0000-0000-0000-000000000002', 'Bob Smith',      'bob@example.com',   'ROLL002'),
  ('f1000000-0000-0000-0000-000000000003', 'Carol Williams', 'carol@example.com', 'ROLL003');

-- Sample Registrations
INSERT INTO registrations (examination_id, student_id, status) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'registered'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'registered'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003', 'registered');
