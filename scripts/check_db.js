const { Client } = require('pg');

async function run() {
  const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to Local PG successfully!');

  const exams = await client.query('SELECT id, name FROM examinations');
  console.log('Exams (' + exams.rows.length + '):', exams.rows);

  const rounds = await client.query('SELECT id, round_number, name FROM examination_rounds');
  console.log('Rounds (' + rounds.rows.length + '):', rounds.rows);

  const students = await client.query('SELECT id, roll_number, full_name FROM students');
  console.log('Students (' + students.rows.length + '):', students.rows);

  await client.end();
}

run().catch(err => {
  console.error('DB check error:', err);
  process.exit(1);
});
