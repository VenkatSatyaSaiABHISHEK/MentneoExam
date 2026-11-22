const { Client } = require('pg');

async function seedUserExam() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exams_db',
    ssl: false,
  });
  await client.connect();

  const examId = 'exam-1794587134752';
  
  // 1. Exam
  await client.query(`
    INSERT INTO examinations (id, name, slug, description, status, exam_date, show_marks_to_students, max_cheating_warnings, auth_mode, login_identifier_field, login_identifier_label)
    VALUES ($1, 'National Tech Assessment 2026', $1, 'Multi-round campus assessment', 'published', NOW(), true, 3, 'roster', 'roll_number', 'Roll Number')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;
  `, [examId]);

  // 2. Rounds
  const r1Id = `round-${examId}-1`;
  const r2Id = `round-${examId}-2`;
  const r3Id = `round-${examId}-3`;

  await client.query(`
    INSERT INTO examination_rounds (id, examination_id, round_number, name, duration_minutes, total_questions, marks_per_question, qualifying_marks, total_marks, status, round_type, auto_qualify)
    VALUES 
      ($1, $2, 1, 'Basic Aptitude And Reasoning', 60, 30, 1, 10, 30, 'published', 'mcq', true),
      ($3, $2, 2, 'High Aptitude And Reasoning', 60, 30, 1, 15, 30, 'published', 'mcq', true),
      ($4, $2, 3, 'Coding', 60, 2, 25, 25, 50, 'published', 'coding', true)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;
  `, [r1Id, examId, r2Id, r3Id]);

  // 3. Students
  const students = [
    { id: 'stud-1', roll: '23B21A4565', name: 'Abhi', email: 'abhi31mahi@gmail.com', dept: 'CSE' },
    { id: 'stud-2', roll: '23B21A4566', name: 'Abhishek', email: 'abhi@inducodes.tech', dept: 'ECE' },
    { id: 'stud-3', roll: '23B21A4567', name: 'Karthik', email: 'karthik@example.com', dept: 'MECH' },
    { id: 'stud-4', roll: '23B21A4568', name: 'Pooja', email: 'pooja@example.com', dept: 'IT' }
  ];

  for (const s of students) {
    await client.query(`
      INSERT INTO students (id, roll_number, login_id, full_name, email, attributes)
      VALUES ($1, $2, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, attributes = EXCLUDED.attributes;
    `, [s.id, s.roll, s.name, s.email, JSON.stringify({ Department: s.dept, Batch: '2026' })]);

    const regId = `reg-${examId}-${s.id}`;
    await client.query(`
      INSERT INTO registrations (id, examination_id, student_id, status)
      VALUES ($1, $2, $3, 'registered')
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `, [regId, examId, s.id]);
  }

  // 4. Attempts & Results
  // Student 1 (Abhi): Passed R1, Passed R2
  const reg1 = `reg-${examId}-stud-1`;
  const att1_r1 = `att-${examId}-s1-r1`;
  const att1_r2 = `att-${examId}-s1-r2`;

  await client.query(`
    INSERT INTO examination_attempts (id, registration_id, round_id, started_at, deadline_at, submitted_at, status, cheating_warnings)
    VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 'submitted', 0)
    ON CONFLICT (id) DO NOTHING;
  `, [att1_r1, reg1, r1Id]);

  await client.query(`
    INSERT INTO examination_results (id, attempt_id, registration_id, round_id, score, total_marks, qualifying_marks, is_qualified, correct_count, wrong_count, unanswered_count, evaluated_at)
    VALUES ($1, $2, $3, $4, 26, 30, 10, true, 26, 4, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [`res-${att1_r1}`, att1_r1, reg1, r1Id]);

  await client.query(`
    INSERT INTO examination_attempts (id, registration_id, round_id, started_at, deadline_at, submitted_at, status, cheating_warnings)
    VALUES ($1, $2, $3, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes', 'submitted', 0)
    ON CONFLICT (id) DO NOTHING;
  `, [att1_r2, reg1, r2Id]);

  await client.query(`
    INSERT INTO examination_results (id, attempt_id, registration_id, round_id, score, total_marks, qualifying_marks, is_qualified, correct_count, wrong_count, unanswered_count, evaluated_at)
    VALUES ($1, $2, $3, $4, 25, 30, 15, true, 25, 5, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [`res-${att1_r2}`, att1_r2, reg1, r2Id]);

  // Student 2 (Abhishek): Passed R1, R2 In Progress
  const reg2 = `reg-${examId}-stud-2`;
  const att2_r1 = `att-${examId}-s2-r1`;
  const att2_r2 = `att-${examId}-s2-r2`;

  await client.query(`
    INSERT INTO examination_attempts (id, registration_id, round_id, started_at, deadline_at, submitted_at, status, cheating_warnings)
    VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 'submitted', 0)
    ON CONFLICT (id) DO NOTHING;
  `, [att2_r1, reg2, r1Id]);

  await client.query(`
    INSERT INTO examination_results (id, attempt_id, registration_id, round_id, score, total_marks, qualifying_marks, is_qualified, correct_count, wrong_count, unanswered_count, evaluated_at)
    VALUES ($1, $2, $3, $4, 21, 30, 10, true, 21, 9, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [`res-${att2_r1}`, att2_r1, reg2, r1Id]);

  await client.query(`
    INSERT INTO examination_attempts (id, registration_id, round_id, started_at, deadline_at, submitted_at, status, cheating_warnings)
    VALUES ($1, $2, $3, NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '45 minutes', NULL, 'in_progress', 0)
    ON CONFLICT (id) DO NOTHING;
  `, [att2_r2, reg2, r2Id]);

  // Student 3 (Karthik): Disqualified in R1
  const reg3 = `reg-${examId}-stud-3`;
  const att3_r1 = `att-${examId}-s3-r1`;

  await client.query(`
    INSERT INTO examination_attempts (id, registration_id, round_id, started_at, deadline_at, submitted_at, status, cheating_warnings)
    VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 'submitted', 0)
    ON CONFLICT (id) DO NOTHING;
  `, [att3_r1, reg3, r1Id]);

  await client.query(`
    INSERT INTO examination_results (id, attempt_id, registration_id, round_id, score, total_marks, qualifying_marks, is_qualified, correct_count, wrong_count, unanswered_count, evaluated_at)
    VALUES ($1, $2, $3, $4, 8, 30, 10, false, 8, 22, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [`res-${att3_r1}`, att3_r1, reg3, r1Id]);

  // Student 4 (Pooja): Registered, not started yet.

  console.log('Seeded exam-1794587134752 with 4 students, attempts, and results successfully!');
  await client.end();
}

seedUserExam().catch(console.error);

