const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function syncPgToResilient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exams_db',
    ssl: false,
  });
  await client.connect();

  const examsRes = await client.query('SELECT * FROM examinations');
  const roundsRes = await client.query('SELECT * FROM examination_rounds');
  const studentsRes = await client.query('SELECT * FROM students');
  const regsRes = await client.query('SELECT * FROM registrations');
  const attemptsRes = await client.query('SELECT * FROM examination_attempts');
  const resultsRes = await client.query('SELECT * FROM examination_results');
  const questionsRes = await client.query('SELECT * FROM questions');
  const optionsRes = await client.query('SELECT * FROM question_options ORDER BY sort_order ASC');
  const answerKeysRes = await client.query('SELECT * FROM answer_keys');
  const answersRes = await client.query('SELECT * FROM attempt_answers');

  const snapshot = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    examinations: {},
    rounds: {},
    students: {},
    registrations: {},
    questions: {},
    answerKeys: {},
    attempts: {},
    answers: {},
    results: {},
    qualifications: {},
    cheatingEvents: [],
    auditLogs: [],
    ocrJobs: {},
  };

  for (const row of examsRes.rows) {
    snapshot.examinations[row.id] = row;
  }
  for (const row of roundsRes.rows) {
    snapshot.rounds[row.id] = row;
  }
  for (const row of studentsRes.rows) {
    snapshot.students[row.id] = row;
  }
  for (const row of regsRes.rows) {
    snapshot.registrations[row.id] = {
      ...row,
      student: snapshot.students[row.student_id] || null,
    };
  }
  for (const row of attemptsRes.rows) {
    snapshot.attempts[row.id] = row;
  }
  for (const row of resultsRes.rows) {
    snapshot.results[row.attempt_id] = row;
  }
  for (const row of questionsRes.rows) {
    const opts = optionsRes.rows.filter(o => o.question_id === row.id);
    snapshot.questions[row.id] = {
      ...row,
      options: opts,
    };
  }
  for (const row of answerKeysRes.rows) {
    snapshot.answerKeys[row.question_id] = row;
  }
  for (const row of answersRes.rows) {
    snapshot.answers[`${row.attempt_id}_${row.question_id}`] = row;
  }

  const outPath = path.join(process.cwd(), 'data', 'exams_resilient_store.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`Successfully synced ${examsRes.rows.length} exams, ${roundsRes.rows.length} rounds, ${regsRes.rows.length} registrations, ${attemptsRes.rows.length} attempts, ${resultsRes.rows.length} results to ${outPath}`);

  await client.end();
}

syncPgToResilient().catch(console.error);

