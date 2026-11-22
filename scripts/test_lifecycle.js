const { Client } = require('pg');

async function test() {
  const fetch = globalThis.fetch;
  
  console.log('=== 1. Checking /api/examinations (clean state) ===');
  const t0 = Date.now();
  const r1 = await fetch('http://localhost:3000/api/examinations');
  const d1 = await r1.json();
  console.log('Fetch time:', Date.now() - t0, 'ms | Count:', d1.data?.length);

  console.log('\n=== 2. Checking /api/admin/stats (sub-millisecond speed) ===');
  const t1 = Date.now();
  const r2 = await fetch('http://localhost:3000/api/admin/stats');
  const d2 = await r2.json();
  console.log('Fetch time:', Date.now() - t1, 'ms | Stats:', d2.data);

  console.log('\n=== 3. Testing Exam Creation & Live Status Persistence ===');
  const examPayload = {
    name: 'Real Production Test Exam',
    slug: 'real-production-test',
    description: 'Testing live status persistence without draft regression',
    status: 'draft',
    rounds: [
      { round_number: 1, name: 'Round 1 Screening', duration_minutes: 45, total_questions: 20, marks_per_question: 1, qualifying_marks: 10 }
    ]
  };
  const rCreate = await fetch('http://localhost:3000/api/examinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(examPayload)
  });
  const dCreate = await rCreate.json();
  console.log('Exam created:', dCreate.data?.id, '| Status:', dCreate.data?.status);
  const examId = dCreate.data?.id;

  console.log('\n=== 4. Toggling Status to published ===');
  const rStatus = await fetch('http://localhost:3000/api/examinations/' + examId + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'published' })
  });
  const dStatus = await rStatus.json();
  console.log('Toggle response status:', dStatus.data?.status);

  console.log('\n=== 5. Simulating Page Refresh (Reading Fresh from Server & PostgreSQL) ===');
  const rFresh = await fetch('http://localhost:3000/api/examinations/' + examId);
  const dFresh = await rFresh.json();
  console.log('Refreshed exam status from PostgreSQL:', dFresh.data?.status);
  console.log('Did it stay published?', dFresh.data?.status === 'published' ? 'YES! FIXED!' : 'NO - FAILED');

  console.log('\n=== 6. Cleaning Up Test Exam ===');
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/exams_db' });
  await client.connect();
  await client.query('DELETE FROM examination_rounds WHERE examination_id = $1', [examId]);
  await client.query('DELETE FROM examinations WHERE id = $1', [examId]);
  await client.end();
  console.log('Database cleaned. Ready for real user examinations.');
}

test().catch(console.error);

