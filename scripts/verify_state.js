const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/exams_db' });
  await client.connect();

  console.log('\n--- EXAMINATION ROUNDS ---');
  const rounds = await client.query('SELECT id, examination_id, round_number, name FROM examination_rounds');
  console.table(rounds.rows);

  console.log('\n--- REGISTRATIONS ---');
  const regs = await client.query(`
    SELECT r.id, r.examination_id, r.student_id, s.roll_number, s.full_name 
    FROM registrations r 
    JOIN students s ON s.id = r.student_id
  `);
  console.table(regs.rows);

  console.log('\n--- ATTEMPTS ---');
  const atts = await client.query('SELECT id, registration_id, round_id, status FROM examination_attempts');
  console.table(atts.rows);

  console.log('\n--- RESULTS ---');
  const results = await client.query('SELECT id, attempt_id, score, is_qualified FROM examination_results');
  console.table(results.rows);

  await client.end();
}

check().catch(console.error);
