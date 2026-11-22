const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function seed() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/exams_db' });
  await client.connect();
  console.log('Connected to PostgreSQL exams_db');

  const examId = 'exam-1794587134752';
  const round1Id = 'round-exam-1794587134752-1';
  const round2Id = 'round-exam-1794587134752-2';
  const round3Id = 'round-exam-1794587134752-3';

  // 1. Round 1 Questions (Basic Aptitude And Reasoning)
  const round1Questions = [
    {
      id: 'q-r1-1',
      round_id: round1Id,
      question_text: 'A train 240 m long passes a pole in 24 seconds. How long will it take to pass a platform 650 m long?',
      question_type: 'single_choice',
      difficulty: 'medium',
      marks: 6,
      negative_marks: 1,
      sort_order: 1,
      options: [
        { id: 'opt-q-r1-1-A', label: 'A', option_text: '65 seconds', sort_order: 1 },
        { id: 'opt-q-r1-1-B', label: 'B', option_text: '89 seconds', sort_order: 2 },
        { id: 'opt-q-r1-1-C', label: 'C', option_text: '100 seconds', sort_order: 3 },
        { id: 'opt-q-r1-1-D', label: 'D', option_text: '150 seconds', sort_order: 4 },
      ],
      correct: 'B',
      explanation: 'Speed = 240/24 = 10 m/s. Total distance = 240 + 650 = 890 m. Time = 890 / 10 = 89 seconds.'
    },
    {
      id: 'q-r1-2',
      round_id: round1Id,
      question_text: 'If 20% of a number is 120, what is 120% of that number?',
      question_type: 'single_choice',
      difficulty: 'easy',
      marks: 6,
      negative_marks: 1,
      sort_order: 2,
      options: [
        { id: 'opt-q-r1-2-A', label: 'A', option_text: '20', sort_order: 1 },
        { id: 'opt-q-r1-2-B', label: 'B', option_text: '120', sort_order: 2 },
        { id: 'opt-q-r1-2-C', label: 'C', option_text: '480', sort_order: 3 },
        { id: 'opt-q-r1-2-D', label: 'D', option_text: '720', sort_order: 4 },
      ],
      correct: 'D',
      explanation: 'Number = 120 / 0.20 = 600. 120% of 600 = 1.20 * 600 = 720.'
    },
    {
      id: 'q-r1-3',
      round_id: round1Id,
      question_text: 'Pointing to a photograph of a boy Suresh said, "He is the son of the only son of my mother." How is Suresh related to that boy?',
      question_type: 'single_choice',
      difficulty: 'easy',
      marks: 6,
      negative_marks: 1,
      sort_order: 3,
      options: [
        { id: 'opt-q-r1-3-A', label: 'A', option_text: 'Brother', sort_order: 1 },
        { id: 'opt-q-r1-3-B', label: 'B', option_text: 'Uncle', sort_order: 2 },
        { id: 'opt-q-r1-3-C', label: 'C', option_text: 'Father', sort_order: 3 },
        { id: 'opt-q-r1-3-D', label: 'D', option_text: 'Cousin', sort_order: 4 },
      ],
      correct: 'C',
      explanation: 'The only son of Suresh mother is Suresh himself. So the boy is Suresh son.'
    },
    {
      id: 'q-r1-4',
      round_id: round1Id,
      question_text: 'Find the next number in the sequence: 3, 7, 15, 31, 63, ?',
      question_type: 'single_choice',
      difficulty: 'medium',
      marks: 6,
      negative_marks: 1,
      sort_order: 4,
      options: [
        { id: 'opt-q-r1-4-A', label: 'A', option_text: '92', sort_order: 1 },
        { id: 'opt-q-r1-4-B', label: 'B', option_text: '115', sort_order: 2 },
        { id: 'opt-q-r1-4-C', label: 'C', option_text: '127', sort_order: 3 },
        { id: 'opt-q-r1-4-D', label: 'D', option_text: '131', sort_order: 4 },
      ],
      correct: 'C',
      explanation: 'Each term is (previous * 2) + 1: 63 * 2 + 1 = 127.'
    },
    {
      id: 'q-r1-5',
      round_id: round1Id,
      question_text: 'Statements: All mangoes are golden in colour. No golden-coloured things are cheap. Conclusions: I. All mangoes are cheap. II. Golden-coloured mangoes are not cheap.',
      question_type: 'single_choice',
      difficulty: 'hard',
      marks: 6,
      negative_marks: 1,
      sort_order: 5,
      options: [
        { id: 'opt-q-r1-5-A', label: 'A', option_text: 'Only conclusion I follows', sort_order: 1 },
        { id: 'opt-q-r1-5-B', label: 'B', option_text: 'Only conclusion II follows', sort_order: 2 },
        { id: 'opt-q-r1-5-C', label: 'C', option_text: 'Either I or II follows', sort_order: 3 },
        { id: 'opt-q-r1-5-D', label: 'D', option_text: 'Neither I nor II follows', sort_order: 4 },
      ],
      correct: 'B',
      explanation: 'Since all mangoes are golden and no golden things are cheap, golden mangoes cannot be cheap.'
    }
  ];

  // 2. Round 2 Questions (High Aptitude And Reasoning)
  const round2Questions = [
    {
      id: 'q-r2-1',
      round_id: round2Id,
      question_text: 'In a box of 100 light bulbs, 10 are defective. If 3 bulbs are chosen at random without replacement, what is the probability that none of them is defective?',
      question_type: 'single_choice',
      difficulty: 'hard',
      marks: 6,
      negative_marks: 1,
      sort_order: 1,
      options: [
        { id: 'opt-q-r2-1-A', label: 'A', option_text: '(90/100) * (89/99) * (88/98)', sort_order: 1 },
        { id: 'opt-q-r2-1-B', label: 'B', option_text: '(90/100)^3', sort_order: 2 },
        { id: 'opt-q-r2-1-C', label: 'C', option_text: '1 - (10/100)^3', sort_order: 3 },
        { id: 'opt-q-r2-1-D', label: 'D', option_text: '(10/100) * (9/99) * (8/98)', sort_order: 4 },
      ],
      correct: 'A',
      explanation: 'Probability of selecting non-defective bulbs sequentially without replacement: 90/100 * 89/99 * 88/98.'
    },
    {
      id: 'q-r2-2',
      round_id: round2Id,
      question_text: 'In a certain code language, "PENCIL" is written as ?QGPEKN?. How is "ERASER" written in that code?',
      question_type: 'single_choice',
      difficulty: 'medium',
      marks: 6,
      negative_marks: 1,
      sort_order: 2,
      options: [
        { id: 'opt-q-r2-2-A', label: 'A', option_text: 'FTCVGU', sort_order: 1 },
        { id: 'opt-q-r2-2-B', label: 'B', option_text: 'FSDSFR', sort_order: 2 },
        { id: 'opt-q-r2-2-C', label: 'C', option_text: 'FSBVHT', sort_order: 3 },
        { id: 'opt-q-r2-2-D', label: 'D', option_text: 'FTCVHT', sort_order: 4 },
      ],
      correct: 'A',
      explanation: 'Pattern: +1, +2, +1, +2, +1, +2: E+1=F, R+2=T, A+1=B... FTCVGU'
    },
    {
      id: 'q-r2-3',
      round_id: round2Id,
      question_text: 'Question: Is x > y? Statement I: x + y > 0. Statement II: x - y > 0.',
      question_type: 'single_choice',
      difficulty: 'hard',
      marks: 6,
      negative_marks: 1,
      sort_order: 3,
      options: [
        { id: 'opt-q-r2-3-A', label: 'A', option_text: 'Statement I alone is sufficient', sort_order: 1 },
        { id: 'opt-q-r2-3-B', label: 'B', option_text: 'Statement II alone is sufficient', sort_order: 2 },
        { id: 'opt-q-r2-3-C', label: 'C', option_text: 'Both statements together are needed', sort_order: 3 },
        { id: 'opt-q-r2-3-D', label: 'D', option_text: 'Neither statement is sufficient', sort_order: 4 },
      ],
      correct: 'B',
      explanation: 'x - y > 0 directly implies x > y. Hence Statement II alone is sufficient.'
    },
    {
      id: 'q-r2-4',
      round_id: round2Id,
      question_text: 'A clock shows 3:40. What is the angle between the hour hand and the minute hand?',
      question_type: 'single_choice',
      difficulty: 'medium',
      marks: 6,
      negative_marks: 1,
      sort_order: 4,
      options: [
        { id: 'opt-q-r2-4-A', label: 'A', option_text: '120 degrees', sort_order: 1 },
        { id: 'opt-q-r2-4-B', label: 'B', option_text: '130 degrees', sort_order: 2 },
        { id: 'opt-q-r2-4-C', label: 'C', option_text: '140 degrees', sort_order: 3 },
        { id: 'opt-q-r2-4-D', label: 'D', option_text: '150 degrees', sort_order: 4 },
      ],
      correct: 'B',
      explanation: 'Angle = |30*H - (11/2)*M| = |30*3 - 5.5*40| = |90 - 220| = 130 degrees.'
    },
    {
      id: 'q-r2-5',
      round_id: round2Id,
      question_text: 'Six persons A, B, C, D, E and F are sitting in two rows, three in each row. E is not at the end of any row. D is second to the left of F. C, the neighbour of E, is sitting diagonally opposite to D. B is the neighbour of F. Who is opposite to B?',
      question_type: 'single_choice',
      difficulty: 'hard',
      marks: 6,
      negative_marks: 1,
      sort_order: 5,
      options: [
        { id: 'opt-q-r2-5-A', label: 'A', option_text: 'A', sort_order: 1 },
        { id: 'opt-q-r2-5-B', label: 'B', option_text: 'E', sort_order: 2 },
        { id: 'opt-q-r2-5-C', label: 'C', option_text: 'C', sort_order: 3 },
        { id: 'opt-q-r2-5-D', label: 'D', option_text: 'D', sort_order: 4 },
      ],
      correct: 'B',
      explanation: 'Row 1: D, A, F. Row 2: C, E, B. Therefore, opposite to B is F/E, solving yields E.'
    }
  ];

  // 3. Round 3 Questions (Coding Sandbox)
  const round3Questions = [
    {
      id: 'q-r3-1',
      round_id: round3Id,
      question_text: 'Two Sum Problem: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.\n\nExample 1:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].\n\nExample 2:\nInput: nums = [3,2,4], target = 6\nOutput: [1,2]\n\nConstraints:\n- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- -10^9 <= target <= 10^9\n- Only one valid answer exists.',
      question_type: 'coding',
      difficulty: 'medium',
      marks: 50,
      negative_marks: 0,
      sort_order: 1,
      options: [],
      correct: 'CODING',
      explanation: 'Optimal solution uses a Hash Map for O(N) time and O(N) space.'
    }
  ];

  const allQuestions = [...round1Questions, ...round2Questions, ...round3Questions];

  // Insert or Upsert Questions, Options, Answer Keys into PostgreSQL
  for (const q of allQuestions) {
    await client.query(`
      INSERT INTO questions (id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        round_id = EXCLUDED.round_id,
        question_text = EXCLUDED.question_text,
        question_type = EXCLUDED.question_type,
        difficulty = EXCLUDED.difficulty,
        marks = EXCLUDED.marks,
        negative_marks = EXCLUDED.negative_marks,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `, [q.id, q.round_id, q.question_text, q.question_type, q.difficulty, q.marks, q.negative_marks, q.sort_order]);

    for (const opt of q.options) {
      await client.query(`
        INSERT INTO question_options (id, question_id, label, option_text, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          question_id = EXCLUDED.question_id,
          label = EXCLUDED.label,
          option_text = EXCLUDED.option_text,
          sort_order = EXCLUDED.sort_order
      `, [opt.id, q.id, opt.label, opt.option_text, opt.sort_order]);
    }

    if (q.correct && q.correct !== 'CODING') {
      await client.query(`
        INSERT INTO answer_keys (id, question_id, correct_option_label, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET 
          question_id = EXCLUDED.question_id,
          correct_option_label = EXCLUDED.correct_option_label,
          updated_at = NOW()
      `, [`ak-${q.id}`, q.id, q.correct]);
    }
  }

  console.log('Seeded ' + allQuestions.length + ' questions with options and answer keys.');

  // 4. Seed Attempt Answers for Abhi (s1-r1, s1-r2)
  const abhiR1Answers = [
    { qId: 'q-r1-1', opt: 'B' }, // Correct
    { qId: 'q-r1-2', opt: 'D' }, // Correct
    { qId: 'q-r1-3', opt: 'C' }, // Correct
    { qId: 'q-r1-4', opt: 'C' }, // Correct
    { qId: 'q-r1-5', opt: 'A' }, // Wrong (earned 24 - 1 = 23, or 4 correct = 24)
  ];

  for (const a of abhiR1Answers) {
    await client.query(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option, is_marked_for_review, answered_at, updated_at)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET selected_option = EXCLUDED.selected_option
    `, [`ans-s1r1-${a.qId}`, 'att-exam-1794587134752-s1-r1', a.qId, a.opt]);
  }

  const abhiR2Answers = [
    { qId: 'q-r2-1', opt: 'A' }, // Correct
    { qId: 'q-r2-2', opt: 'A' }, // Correct
    { qId: 'q-r2-3', opt: 'B' }, // Correct
    { qId: 'q-r2-4', opt: 'B' }, // Correct
    { qId: 'q-r2-5', opt: 'A' }, // Selected A
  ];

  for (const a of abhiR2Answers) {
    await client.query(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option, is_marked_for_review, answered_at, updated_at)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET selected_option = EXCLUDED.selected_option
    `, [`ans-s1r2-${a.qId}`, 'att-exam-1794587134752-s1-r2', a.qId, a.opt]);
  }

  // Karthik (s3-r1) answers
  const karthikAnswers = [
    { qId: 'q-r1-1', opt: 'A' }, // Wrong
    { qId: 'q-r1-2', opt: 'D' }, // Correct
    { qId: 'q-r1-3', opt: 'A' }, // Wrong
    { qId: 'q-r1-4', opt: 'B' }, // Wrong
    { qId: 'q-r1-5', opt: 'C' }, // Wrong
  ];

  for (const a of karthikAnswers) {
    await client.query(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option, is_marked_for_review, answered_at, updated_at)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET selected_option = EXCLUDED.selected_option
    `, [`ans-s3r1-${a.qId}`, 'att-exam-1794587134752-s3-r1', a.qId, a.opt]);
  }

  // Update assigned_question_ids on examination_attempts
  await client.query(`
    UPDATE examination_attempts 
    SET assigned_question_ids = $1 
    WHERE id = 'att-exam-1794587134752-s1-r1' OR id = 'att-exam-1794587134752-s2-r1' OR id = 'att-exam-1794587134752-s3-r1'
  `, [round1Questions.map(q => q.id)]);

  await client.query(`
    UPDATE examination_attempts 
    SET assigned_question_ids = $1 
    WHERE id = 'att-exam-1794587134752-s1-r2' OR id = 'att-exam-1794587134752-s2-r2'
  `, [round2Questions.map(q => q.id)]);

  console.log('Seeded candidate answers and updated assigned_question_ids.');

  await client.end();
}

seed().catch(console.error);
