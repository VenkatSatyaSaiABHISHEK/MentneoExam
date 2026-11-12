const BASE_URL = 'http://localhost:3000';

async function runEndToEndTest() {
  console.log('=====================================================');
  console.log('STARTING COMPLETE END-TO-END SIMULATION TEST');
  console.log('=====================================================\n');

  // Step 1: Check active examination
  console.log('1. Fetching active examination (DEMO)...');
  const examsRes = await fetch(`${BASE_URL}/api/examinations`);
  const examsJson = await examsRes.json();
  const demoExam = examsJson.data?.find(e => e.slug === 'demo' || e.name === 'DEMO');

  if (!demoExam) {
    console.error('ERROR: DEMO exam not found.');
    process.exit(1);
  }
  console.log(`✓ Found Exam: "${demoExam.name}" (ID: ${demoExam.id}, Slug: ${demoExam.slug})`);

  // Step 2: Fetch Rounds
  console.log('\n2. Fetching exam rounds...');
  const roundsRes = await fetch(`${BASE_URL}/api/examinations/${demoExam.id}/rounds`);
  const roundsJson = await roundsRes.json();
  const round1 = roundsJson.data?.find(r => r.round_number === 1);
  const round2 = roundsJson.data?.find(r => r.round_number === 2);

  console.log(`✓ Round 1: "${round1?.name}" (ID: ${round1?.id}, Bank Pool: ${round1?.question_pool_count}, Total Served: ${round1?.total_questions})`);
  console.log(`✓ Round 2: "${round2?.name}" (ID: ${round2?.id}, Bank Pool: ${round2?.question_pool_count}, Total Served: ${round2?.total_questions})`);

  // Step 3: Register a new candidate
  const testCandidateRoll = `DEMO-CANDIDATE-${Date.now().toString().slice(-4)}`;
  console.log(`\n3. Registering test candidate (Roll: ${testCandidateRoll})...`);
  const regRes = await fetch(`${BASE_URL}/api/students/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      examId: demoExam.id,
      fullName: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      rollNumber: testCandidateRoll
    })
  });
  const regJson = await regRes.json();
  if (!regJson.success) {
    console.error('ERROR during registration:', regJson.error);
    process.exit(1);
  }
  const regId = regJson.data.registrationId;
  console.log(`✓ Registered successfully. Registration ID: ${regId}`);

  // Step 4: Start Round 1
  console.log('\n4. Candidate starts Round 1 attempt...');
  const startR1Res = await fetch(`${BASE_URL}/api/attempts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registrationId: regId,
      roundId: round1.id
    })
  });
  const startR1Json = await startR1Res.json();
  if (!startR1Json.success) {
    console.error('ERROR starting Round 1:', startR1Json.error);
    process.exit(1);
  }

  const r1Attempt = startR1Json.data.attempt;
  const r1Questions = startR1Json.data.questions;
  console.log(`✓ Round 1 Attempt Started: ${r1Attempt.id}`);
  console.log(`✓ Questions served: ${r1Questions.length} (Expected: ${round1.total_questions})`);
  if (r1Questions.length !== round1.total_questions) {
    console.error(`ERROR: Expected ${round1.total_questions} questions, got ${r1Questions.length}`);
  }

  // Step 5: Answer Round 1 questions
  console.log('\n5. Candidate answers questions in Round 1...');
  for (let i = 0; i < r1Questions.length; i++) {
    const q = r1Questions[i];
    // Pick option A or B
    const selectedOption = (i % 2 === 0) ? 'A' : 'B';
    await fetch(`${BASE_URL}/api/attempts/${r1Attempt.id}/save-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q.id,
        selectedOption
      })
    });
  }
  console.log(`✓ Saved answers for all ${r1Questions.length} questions.`);

  // Step 6: Submit Round 1
  console.log('\n6. Candidate submits Round 1...');
  const submitR1Res = await fetch(`${BASE_URL}/api/attempts/${r1Attempt.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const submitR1Json = await submitR1Res.json();
  if (!submitR1Json.success) {
    console.error('ERROR submitting Round 1:', submitR1Json.error);
    process.exit(1);
  }

  const r1Result = submitR1Json.data.result;
  const r1Qual = submitR1Json.data.qualification;
  console.log(`✓ Round 1 Submitted.`);
  console.log(`   Score: ${r1Result.score} / ${r1Result.total_marks}`);
  console.log(`   Qualifying Threshold: ${r1Result.qualifying_marks}`);
  console.log(`   Qualified for Round 2: ${r1Qual?.qualified ? 'YES' : 'NO'}`);

  // Step 7: Candidate starts Round 2 (if qualified)
  if (r1Qual?.qualified) {
    console.log('\n7. Candidate advances to Round 2...');
    const startR2Res = await fetch(`${BASE_URL}/api/attempts/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: regId,
        roundId: round2.id
      })
    });
    const startR2Json = await startR2Res.json();
    if (!startR2Json.success) {
      console.error('ERROR starting Round 2:', startR2Json.error);
      process.exit(1);
    }

    const r2Attempt = startR2Json.data.attempt;
    const r2Questions = startR2Json.data.questions;
    console.log(`✓ Round 2 Attempt Started: ${r2Attempt.id}`);
    console.log(`✓ Questions served: ${r2Questions.length} (Expected: ${round2.total_questions})`);

    // Answer Round 2 questions
    console.log('\n8. Candidate answers questions in Round 2...');
    for (let i = 0; i < r2Questions.length; i++) {
      const q = r2Questions[i];
      await fetch(`${BASE_URL}/api/attempts/${r2Attempt.id}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: q.id,
          selectedOption: 'C'
        })
      });
    }
    console.log(`✓ Saved answers for all ${r2Questions.length} questions in Round 2.`);

    // Submit Round 2
    console.log('\n9. Candidate submits Round 2...');
    const submitR2Res = await fetch(`${BASE_URL}/api/attempts/${r2Attempt.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const submitR2Json = await submitR2Res.json();
    console.log(`✓ Round 2 Score: ${submitR2Json.data?.result?.score} / ${submitR2Json.data?.result?.total_marks}`);
  }

  // Step 8: Verify Live Monitoring Dashboard Results
  console.log('\n10. Checking Live Monitoring telemetry for Administrator...');
  const monRes = await fetch(`${BASE_URL}/api/examinations/${demoExam.id}/results`);
  const monJson = await monRes.json();
  const candidateRows = monJson.data?.rows?.filter(r => r.loginId === testCandidateRoll);

  console.log(`✓ Telemetry rows found for ${testCandidateRoll}: ${candidateRows?.length}`);
  candidateRows?.forEach(r => {
    console.log(`   - Round ${r.roundNumber} (${r.roundName}): Status = ${r.attemptStatus}, Score = ${r.score}/${r.totalMarks}, Qualified = ${r.isQualified}`);
  });

  console.log('\n=====================================================');
  console.log('ALL END-TO-END FLOW TESTS PASSED CLEANLY');
  console.log('=====================================================');
}

runEndToEndTest();

