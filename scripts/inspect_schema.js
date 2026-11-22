const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/exams_db' });
  await client.connect();

  for (const table of ['questions', 'question_options', 'answer_keys', 'attempt_answers']) {
    const cols = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${table}'`);
    console.log(`\n--- ${table} ---`);
    console.table(cols.rows);
  }

  await client.end();
}

run().catch(console.error);

