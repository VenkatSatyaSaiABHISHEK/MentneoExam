import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://xyeedgccjcfxyibeqifc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MtKTwymZqz1XbtYr4zySBw_ZD-TXOdC';
const EXAM_ID = 'exam-1794553187434';
const ROUND_1_ID = 'round-exam-1794553187434-1';
const ROUND_2_ID = 'round-exam-1794553187434-2';
const ROUND_3_ID = 'round-exam-1794553187434-3';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('1. Setting Round 2 to active status...');
  const { error: r2Err } = await supabase
    .from('examination_rounds')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', ROUND_2_ID);
  console.log('Round 2 status update result:', r2Err || 'SUCCESS');

  console.log('\n2. Upserting Question Banks in question_banks table...');
  const banks = [
    {
      id: `bank-${ROUND_1_ID}`,
      examination_id: EXAM_ID,
      round_id: ROUND_1_ID,
      name: 'Round 1: Basic Aptitude & Reasoning Question Bank',
      created_at: new Date().toISOString(),
    },
    {
      id: `bank-${ROUND_2_ID}`,
      examination_id: EXAM_ID,
      round_id: ROUND_2_ID,
      name: 'Round 2: High Aptitude & Reasoning Question Bank',
      created_at: new Date().toISOString(),
    },
    {
      id: `bank-${ROUND_3_ID}`,
      examination_id: EXAM_ID,
      round_id: ROUND_3_ID,
      name: 'Round 3: Advanced Hardware Architecture Question Bank',
      created_at: new Date().toISOString(),
    },
  ];
  const { error: bErr } = await supabase.from('question_banks').upsert(banks);
  console.log('Question banks upsert result:', bErr || 'SUCCESS');

  console.log('\n3. Seeding 10 registered students in students and registrations tables...');
  const students = [
    { roll: '2026CS001', name: 'Rahul Sharma', email: 'rahul.sharma@student.mentneo.com' },
    { roll: '2026CS002', name: 'Priya Patel', email: 'priya.patel@student.mentneo.com' },
    { roll: '2026CS003', name: 'Amit Kumar', email: 'amit.kumar@student.mentneo.com' },
    { roll: '2026CS004', name: 'Sneha Reddy', email: 'sneha.reddy@student.mentneo.com' },
    { roll: '2026CS005', name: 'Vikram Singh', email: 'vikram.singh@student.mentneo.com' },
    { roll: '2026CS006', name: 'Ananya Roy', email: 'ananya.roy@student.mentneo.com' },
    { roll: '2026CS007', name: 'Rohit Verma', email: 'rohit.verma@student.mentneo.com' },
    { roll: '2026CS008', name: 'Pooja Nair', email: 'pooja.nair@student.mentneo.com' },
    { roll: '2026CS009', name: 'Karthik Iyer', email: 'karthik.iyer@student.mentneo.com' },
    { roll: '2026CS010', name: 'Divya Joshi', email: 'divya.joshi@student.mentneo.com' },
  ];

  for (const s of students) {
    const studentId = `student-${s.roll.toLowerCase()}`;
    const regId = `reg-${EXAM_ID}-${studentId}`;

    await supabase.from('students').upsert({
      id: studentId,
      full_name: s.name,
      email: s.email,
      roll_number: s.roll,
      login_id: s.roll,
      examination_id: EXAM_ID,
      created_at: new Date().toISOString(),
    });

    await supabase.from('registrations').upsert({
      id: regId,
      examination_id: EXAM_ID,
      student_id: studentId,
      login_id: s.roll,
      registered_at: new Date().toISOString(),
      status: 'registered',
    });
  }
  console.log('10 candidates registered successfully in Supabase!');

  console.log('\n4. Loading question bank data from extractor.ts...');
  const extractorCode = fs.readFileSync('lib/pdf/extractor.ts', 'utf-8');

  function parseBank(varName) {
    const regex = new RegExp(`export const ${varName}: ParsedQuestionItem\\[\\] = ([\\s\\S]*?\\n\\];)`);
    const match = extractorCode.match(regex);
    if (!match) return [];
    // Evaluate array safely using Function
    const fn = new Function(`return ${match[1].replace(/;$/, '')}`);
    return fn();
  }

  const bank1 = parseBank('APTITUDE_REASONING_BANK');
  const bank2 = parseBank('MEDIUM_APTITUDE_REASONING_BANK');
  console.log(`Parsed bank 1 items: ${bank1.length}, bank 2 items: ${bank2.length}`);

  async function seedBankQuestions(roundId, bankId, items, count = 100) {
    console.log(`Seeding ${count} questions for round ${roundId}...`);
    const qRows = [];
    const optRows = [];
    const akRows = [];

    for (let i = 1; i <= count; i++) {
      const qNum = i;
      const qId = `q-${roundId}-${String(qNum).padStart(3, '0')}`;
      const item = items[(qNum - 1) % items.length];
      const cycle = Math.floor((qNum - 1) / items.length);
      const text = cycle > 0 ? `[Set ${cycle + 1}] ${item.question_text}` : item.question_text;

      qRows.push({
        id: qId,
        bank_id: bankId,
        round_id: roundId,
        question_text: text,
        question_type: 'single_choice',
        difficulty: item.difficulty || 'medium',
        marks: 1,
        negative_marks: 0,
        status: 'approved',
        ocr_confidence: 98,
        sort_order: qNum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const labels = ['A', 'B', 'C', 'D'];
      item.options.forEach((optText, idx) => {
        const lbl = labels[idx] || 'A';
        optRows.push({
          id: `opt-${qId}-${lbl.toLowerCase()}`,
          question_id: qId,
          label: lbl,
          option_text: optText,
          sort_order: idx + 1,
          created_at: new Date().toISOString(),
        });
      });

      akRows.push({
        id: `ak-${qId}`,
        question_id: qId,
        correct_option_label: item.correct_answer || 'A',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Chunked upsert
    const chunkSize = 50;
    for (let i = 0; i < qRows.length; i += chunkSize) {
      const { error: qErr } = await supabase.from('questions').upsert(qRows.slice(i, i + chunkSize));
      if (qErr) console.error('qErr batch', i, qErr);
    }
    for (let i = 0; i < optRows.length; i += chunkSize) {
      const { error: oErr } = await supabase.from('question_options').upsert(optRows.slice(i, i + chunkSize));
      if (oErr) console.error('oErr batch', i, oErr);
    }
    for (let i = 0; i < akRows.length; i += chunkSize) {
      const { error: aErr } = await supabase.from('answer_keys').upsert(akRows.slice(i, i + chunkSize));
      if (aErr) console.error('aErr batch', i, aErr);
    }

    await supabase
      .from('examination_rounds')
      .update({ question_pool_count: count, updated_at: new Date().toISOString() })
      .eq('id', roundId);

    console.log(`Done seeding ${count} questions for ${roundId}!`);
  }

  await seedBankQuestions(ROUND_1_ID, `bank-${ROUND_1_ID}`, bank1, 100);
  await seedBankQuestions(ROUND_2_ID, `bank-${ROUND_2_ID}`, bank2, 100);

  console.log('\n5. Verifying final Supabase state:');
  const { data: stFinal } = await supabase.from('students').select('id, full_name, roll_number');
  const { data: regFinal } = await supabase.from('registrations').select('id, student_id, login_id');
  const { data: rdFinal } = await supabase.from('examination_rounds').select('id, round_number, name, status, question_pool_count');
  const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });

  console.log('Students count:', stFinal?.length);
  console.log('Registrations count:', regFinal?.length);
  console.log('Rounds:', rdFinal);
  console.log('Total Questions count in Supabase:', qCount);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

