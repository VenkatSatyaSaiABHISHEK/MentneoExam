const fs = require('fs');
const path = './data/exams_resilient_store.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. Update round 3
data.rounds['round-qc-3'] = {
  ...data.rounds['round-qc-3'],
  status: 'active',
  round_type: 'coding',
  coding_language_support: ['python', 'java'],
  min_time_before_submit_minutes: 1,
  next_round_delay_seconds: 120,
  success_message: 'Congratulations! You have completed all 3 assessment rounds with distinction. Our admissions committee will review your final score and submitted code.',
  failure_message: 'Thank you for participating in the Quantum Computing Selection examination. Your score did not meet the final round threshold.',
  instructions: 'Implement the syndrome decoding algorithm in Python 3 or Java OpenJDK. Run syntax checks before submitting.'
};

// 2. Add question q-301
data.questions['q-301'] = {
  id: 'q-301',
  round_id: 'round-qc-3',
  question_text: 'Implement an efficient error syndrome decoder for a 3-qubit bit-flip code.\n\nInput:\nsyndrome_bits: string of length 2 representing measurement parity (M1=q0^q1, M2=q1^q2).\n\nOutput:\nInteger index (0, 1, or 2) of the corrupted qubit that should be inverted to restore state integrity, or -1 if no error occurred.',
  question_type: 'coding',
  difficulty: 'hard',
  marks: 20,
  negative_marks: 0,
  status: 'approved',
  sort_order: 1,
  options: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const regDavid = 'reg-exam-qc-2026-student-exam-qc-2026-stu-2026-101';
const regSara = 'reg-exam-qc-2026-student-exam-qc-2026-stu-2026-102';
const regMarcus = 'reg-exam-qc-2026-student-exam-qc-2026-stu-2026-103';
const regAarav = 'reg-demo-01';

// Seed Attempts
data.attempts['att-david-r1'] = {
  id: 'att-david-r1',
  registration_id: regDavid,
  round_id: 'round-qc-1',
  started_at: new Date(Date.now() - 7200000).toISOString(),
  deadline_at: new Date(Date.now() - 5400000).toISOString(),
  submitted_at: new Date(Date.now() - 5500000).toISOString(),
  status: 'submitted',
  cheating_warnings: 0,
  assigned_question_ids: ['q-101', 'q-102', 'q-103', 'q-104', 'q-105'],
  created_at: new Date(Date.now() - 7200000).toISOString(),
  updated_at: new Date(Date.now() - 5500000).toISOString()
};

data.results['att-david-r1'] = {
  id: 'res-att-david-r1',
  attempt_id: 'att-david-r1',
  registration_id: regDavid,
  round_id: 'round-qc-1',
  correct_count: 4,
  wrong_count: 1,
  unanswered_count: 0,
  score: 8,
  total_marks: 10,
  qualifying_marks: 4,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 5500000).toISOString()
};

data.attempts['att-david-r2'] = {
  id: 'att-david-r2',
  registration_id: regDavid,
  round_id: 'round-qc-2',
  started_at: new Date(Date.now() - 5000000).toISOString(),
  deadline_at: new Date(Date.now() - 2300000).toISOString(),
  submitted_at: new Date(Date.now() - 2500000).toISOString(),
  status: 'submitted',
  cheating_warnings: 0,
  assigned_question_ids: ['q-201', 'q-202', 'q-203', 'q-204', 'q-205'],
  created_at: new Date(Date.now() - 5000000).toISOString(),
  updated_at: new Date(Date.now() - 2500000).toISOString()
};

data.results['att-david-r2'] = {
  id: 'res-att-david-r2',
  attempt_id: 'att-david-r2',
  registration_id: regDavid,
  round_id: 'round-qc-2',
  correct_count: 5,
  wrong_count: 0,
  unanswered_count: 0,
  score: 15,
  total_marks: 15,
  qualifying_marks: 8,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 2500000).toISOString()
};

const pythonCodeDavid = `def decode_syndrome(syndrome_bits: str) -> int:
    """
    3-Qubit Bit-Flip Code Error Syndrome Decoder
    M1 = q0 XOR q1, M2 = q1 XOR q2
    """
    lookup = {
        "00": -1, # No bit-flip detected
        "10": 0,  # Qubit 0 flipped
        "11": 1,  # Qubit 1 flipped
        "01": 2   # Qubit 2 flipped
    }
    return lookup.get(syndrome_bits, -1)

# Verification
assert decode_syndrome("10") == 0
assert decode_syndrome("11") == 1
assert decode_syndrome("01") == 2
assert decode_syndrome("00") == -1
print("All parity test vectors passed.")`;

data.attempts['att-david-r3'] = {
  id: 'att-david-r3',
  registration_id: regDavid,
  round_id: 'round-qc-3',
  started_at: new Date(Date.now() - 2000000).toISOString(),
  deadline_at: new Date(Date.now() + 1600000).toISOString(),
  submitted_at: new Date(Date.now() - 400000).toISOString(),
  status: 'submitted',
  cheating_warnings: 0,
  assigned_question_ids: ['q-301'],
  created_at: new Date(Date.now() - 2000000).toISOString(),
  updated_at: new Date(Date.now() - 400000).toISOString()
};

data.answers['att-david-r3_q-301'] = {
  id: 'ans-david-r3',
  attempt_id: 'att-david-r3',
  question_id: 'q-301',
  code_snippet: pythonCodeDavid,
  code_language: 'python',
  time_spent_seconds: 1600,
  is_flagged: false,
  updated_at: new Date(Date.now() - 400000).toISOString()
};

data.results['att-david-r3'] = {
  id: 'res-att-david-r3',
  attempt_id: 'att-david-r3',
  registration_id: regDavid,
  round_id: 'round-qc-3',
  correct_count: 1,
  wrong_count: 0,
  unanswered_count: 0,
  score: 20,
  total_marks: 20,
  qualifying_marks: 12,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 400000).toISOString()
};

// Sara Chen (stu-2026-102) - R1, R2, R3
data.attempts['att-sara-r1'] = {
  id: 'att-sara-r1',
  registration_id: regSara,
  round_id: 'round-qc-1',
  started_at: new Date(Date.now() - 7200000).toISOString(),
  deadline_at: new Date(Date.now() - 5400000).toISOString(),
  submitted_at: new Date(Date.now() - 5600000).toISOString(),
  status: 'submitted',
  cheating_warnings: 0,
  assigned_question_ids: ['q-101', 'q-102', 'q-103', 'q-104', 'q-105'],
  created_at: new Date(Date.now() - 7200000).toISOString(),
  updated_at: new Date(Date.now() - 5600000).toISOString()
};

data.results['att-sara-r1'] = {
  id: 'res-att-sara-r1',
  attempt_id: 'att-sara-r1',
  registration_id: regSara,
  round_id: 'round-qc-1',
  correct_count: 5,
  wrong_count: 0,
  unanswered_count: 0,
  score: 10,
  total_marks: 10,
  qualifying_marks: 4,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 5600000).toISOString()
};

data.attempts['att-sara-r2'] = {
  id: 'att-sara-r2',
  registration_id: regSara,
  round_id: 'round-qc-2',
  started_at: new Date(Date.now() - 5000000).toISOString(),
  deadline_at: new Date(Date.now() - 2300000).toISOString(),
  submitted_at: new Date(Date.now() - 2600000).toISOString(),
  status: 'submitted',
  cheating_warnings: 1,
  assigned_question_ids: ['q-201', 'q-202', 'q-203', 'q-204', 'q-205'],
  created_at: new Date(Date.now() - 5000000).toISOString(),
  updated_at: new Date(Date.now() - 2600000).toISOString()
};

data.results['att-sara-r2'] = {
  id: 'res-att-sara-r2',
  attempt_id: 'att-sara-r2',
  registration_id: regSara,
  round_id: 'round-qc-2',
  correct_count: 4,
  wrong_count: 1,
  unanswered_count: 0,
  score: 11,
  total_marks: 15,
  qualifying_marks: 8,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 2600000).toISOString()
};

const javaCodeSara = `public class Solution {
    public static int decodeSyndrome(String syndromeBits) {
        if (syndromeBits == null || syndromeBits.length() != 2) return -1;
        switch (syndromeBits) {
            case "00": return -1; // No error detected
            case "10": return 0;  // Qubit 0 flipped
            case "11": return 1;  // Qubit 1 flipped
            case "01": return 2;  // Qubit 2 flipped
            default: return -1;
        }
    }

    public static void main(String[] args) {
        assert decodeSyndrome("10") == 0;
        System.out.println("Java error syndrome decoder verified.");
    }
}`;

data.attempts['att-sara-r3'] = {
  id: 'att-sara-r3',
  registration_id: regSara,
  round_id: 'round-qc-3',
  started_at: new Date(Date.now() - 2000000).toISOString(),
  deadline_at: new Date(Date.now() + 1600000).toISOString(),
  submitted_at: new Date(Date.now() - 300000).toISOString(),
  status: 'submitted',
  cheating_warnings: 0,
  assigned_question_ids: ['q-301'],
  created_at: new Date(Date.now() - 2000000).toISOString(),
  updated_at: new Date(Date.now() - 300000).toISOString()
};

data.answers['att-sara-r3_q-301'] = {
  id: 'ans-sara-r3',
  attempt_id: 'att-sara-r3',
  question_id: 'q-301',
  code_snippet: javaCodeSara,
  code_language: 'java',
  time_spent_seconds: 1700,
  is_flagged: false,
  updated_at: new Date(Date.now() - 300000).toISOString()
};

data.results['att-sara-r3'] = {
  id: 'res-att-sara-r3',
  attempt_id: 'att-sara-r3',
  registration_id: regSara,
  round_id: 'round-qc-3',
  correct_count: 1,
  wrong_count: 0,
  unanswered_count: 0,
  score: 20,
  total_marks: 20,
  qualifying_marks: 12,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 300000).toISOString()
};

// Marcus Vance (stu-2026-103) - R1 (passed), R2 (failed)
data.attempts['att-marcus-r1'] = {
  id: 'att-marcus-r1',
  registration_id: regMarcus,
  round_id: 'round-qc-1',
  started_at: new Date(Date.now() - 7200000).toISOString(),
  deadline_at: new Date(Date.now() - 5400000).toISOString(),
  submitted_at: new Date(Date.now() - 5800000).toISOString(),
  status: 'submitted',
  cheating_warnings: 0,
  assigned_question_ids: ['q-101', 'q-102', 'q-103', 'q-104', 'q-105'],
  created_at: new Date(Date.now() - 7200000).toISOString(),
  updated_at: new Date(Date.now() - 5800000).toISOString()
};

data.results['att-marcus-r1'] = {
  id: 'res-att-marcus-r1',
  attempt_id: 'att-marcus-r1',
  registration_id: regMarcus,
  round_id: 'round-qc-1',
  correct_count: 3,
  wrong_count: 2,
  unanswered_count: 0,
  score: 5,
  total_marks: 10,
  qualifying_marks: 4,
  is_qualified: true,
  evaluated_at: new Date(Date.now() - 5800000).toISOString()
};

data.attempts['att-marcus-r2'] = {
  id: 'att-marcus-r2',
  registration_id: regMarcus,
  round_id: 'round-qc-2',
  started_at: new Date(Date.now() - 5000000).toISOString(),
  deadline_at: new Date(Date.now() - 2300000).toISOString(),
  submitted_at: new Date(Date.now() - 2700000).toISOString(),
  status: 'submitted',
  cheating_warnings: 2,
  assigned_question_ids: ['q-201', 'q-202', 'q-203', 'q-204', 'q-205'],
  created_at: new Date(Date.now() - 5000000).toISOString(),
  updated_at: new Date(Date.now() - 2700000).toISOString()
};

data.results['att-marcus-r2'] = {
  id: 'res-att-marcus-r2',
  attempt_id: 'att-marcus-r2',
  registration_id: regMarcus,
  round_id: 'round-qc-2',
  correct_count: 2,
  wrong_count: 3,
  unanswered_count: 0,
  score: 3,
  total_marks: 15,
  qualifying_marks: 8,
  is_qualified: false,
  evaluated_at: new Date(Date.now() - 2700000).toISOString()
};

// Aarav Sharma (QC2026-042) - Currently writing Round 1
data.attempts['att-aarav-r1'] = {
  id: 'att-aarav-r1',
  registration_id: regAarav,
  round_id: 'round-qc-1',
  started_at: new Date(Date.now() - 600000).toISOString(),
  deadline_at: new Date(Date.now() + 1200000).toISOString(),
  submitted_at: null,
  status: 'in_progress',
  cheating_warnings: 0,
  assigned_question_ids: ['q-101', 'q-102', 'q-103', 'q-104', 'q-105'],
  created_at: new Date(Date.now() - 600000).toISOString(),
  updated_at: new Date(Date.now() - 100000).toISOString()
};

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Seeded data into exams_resilient_store.json successfully.');

