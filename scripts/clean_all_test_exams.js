const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function clean() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/exams_db' });
  await client.connect();

  console.log('Cleaning all demo/test examinations and attempts...');
  await client.query('DELETE FROM attempt_answers');
  await client.query('DELETE FROM examination_results');
  await client.query('DELETE FROM examination_attempts');
  await client.query('DELETE FROM answer_keys');
  await client.query('DELETE FROM question_options');
  await client.query('DELETE FROM questions');
  await client.query('DELETE FROM registrations');
  await client.query('DELETE FROM students');
  await client.query('DELETE FROM examination_rounds');
  await client.query('DELETE FROM examinations');

  console.log('PostgreSQL database cleaned successfully. 0 test exams remaining.');

  // Clean resilient store JSON
  const cleanSnapshot = {
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
    ocrJobs: {}
  };

  const storePath = path.join(__dirname, '..', 'data', 'exams_resilient_store.json');
  fs.writeFileSync(storePath, JSON.stringify(cleanSnapshot, null, 2), 'utf8');
  console.log('data/exams_resilient_store.json reset to clean empty state.');

  await client.end();
}

clean().catch(console.error);

