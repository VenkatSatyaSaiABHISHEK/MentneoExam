const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'exams_resilient_store.json');
if (!fs.existsSync(filePath)) {
  console.log('Store file not found');
  process.exit(0);
}

const raw = fs.readFileSync(filePath, 'utf8');
const snapshot = JSON.parse(raw);

// 1. Update exam-qc-2026 metadata if present
if (snapshot.examinations && snapshot.examinations['exam-qc-2026']) {
  const ex = snapshot.examinations['exam-qc-2026'];
  ex.name = 'Computer Science & Engineering Assessment 2026';
  ex.slug = 'cs-engineering-assessment-2026';
  ex.description = 'National multi-round examination assessing foundational algorithms, software systems architecture, and applied algorithmic programming.';
}

// 2. Update rounds of exam-qc-2026
if (snapshot.rounds) {
  if (snapshot.rounds['round-qc-1']) {
    snapshot.rounds['round-qc-1'].name = 'Round 1: Screening & Core Fundamentals';
    snapshot.rounds['round-qc-1'].instructions = 'Answer all questions. Each correct answer carries 2 marks; incorrect answers deduct 0.5 marks.';
  }
  if (snapshot.rounds['round-qc-2']) {
    snapshot.rounds['round-qc-2'].name = 'Round 2: Advanced Problem Solving & Synthesis (Open AI Permitted)';
    snapshot.rounds['round-qc-2'].instructions = 'Deep dive into advanced algorithms and systems. Open research and AI assistance are permitted for this round.';
    snapshot.rounds['round-qc-2'].failure_message = 'Thank you for applying. You did not achieve the required qualification marks for Round 2. Best of luck for future opportunities.';
  }
}

// 3. Remove all questions containing 'quantum' or 'qubit' or 'No-Cloning' or 'Bell state' or 'Shor'
let removedCount = 0;
if (snapshot.questions) {
  for (const [id, q] of Object.entries(snapshot.questions)) {
    const text = (q.question_text || '').toLowerCase();
    if (
      text.includes('quantum') ||
      text.includes('qubit') ||
      text.includes('no-cloning') ||
      text.includes('bell state') ||
      text.includes('hadamard') ||
      text.includes('depolarizing') ||
      text.includes('pauli')
    ) {
      delete snapshot.questions[id];
      if (snapshot.answerKeys && snapshot.answerKeys[id]) {
        delete snapshot.answerKeys[id];
      }
      removedCount++;
    }
  }
}

// 4. Update students with QC2026
if (snapshot.students) {
  for (const s of Object.values(snapshot.students)) {
    if (s.roll_number && s.roll_number.startsWith('QC2026')) {
      s.roll_number = s.roll_number.replace('QC2026', 'CS2026');
      s.login_id = s.roll_number;
    }
    if (s.attributes && s.attributes.department === 'Quantum Engineering') {
      s.attributes.department = 'Computer Science & Engineering';
    }
  }
}
if (snapshot.registrations) {
  for (const r of Object.values(snapshot.registrations)) {
    if (r.login_id && r.login_id.startsWith('QC2026')) {
      r.login_id = r.login_id.replace('QC2026', 'CS2026');
    }
  }
}

// 5. Update OCR jobs
if (snapshot.ocrJobs) {
  for (const j of Object.values(snapshot.ocrJobs)) {
    if (j.document_name && j.document_name.includes('quantum')) {
      j.document_name = j.document_name.replace('quantum', 'assessment');
    }
  }
}

fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
console.log(`Cleaned store. Removed ${removedCount} outdated quantum questions. File updated successfully.`);

