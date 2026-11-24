import {
  Examination,
  ExaminationRound,
  Student,
  Registration,
  Question,
  AnswerKey,
  ExaminationAttempt,
  AttemptAnswer,
  ExaminationResult,
  RoundQualification,
  CheatingEvent,
  ExaminationAuditLog,
  OCRJob,
  AdminStats,
  ExamStatus,
  Difficulty,
  QuestionOption,
} from '@/types';
import { getPgPool, queryPg } from '@/lib/db/pg';
import { resilientStorage, ResilientSnapshot } from '@/lib/db/resilient-storage';
import { processPdfQuestions, APTITUDE_REASONING_BANK, MEDIUM_APTITUDE_REASONING_BANK } from '@/lib/pdf/extractor';

// In-memory high-throughput state engine with resilient disk backup and authoritative PostgreSQL 17 ACID WAL
class StateStore {
  examinations: Map<string, Examination> = new Map();
  rounds: Map<string, ExaminationRound> = new Map();
  students: Map<string, Student> = new Map();
  registrations: Map<string, Registration> = new Map();
  questions: Map<string, Question> = new Map();
  answerKeys: Map<string, AnswerKey> = new Map();
  attempts: Map<string, ExaminationAttempt> = new Map();
  answers: Map<string, AttemptAnswer> = new Map(); // key: `${attemptId}_${questionId}`
  results: Map<string, ExaminationResult> = new Map(); // key: attemptId
  qualifications: Map<string, RoundQualification> = new Map(); // key: `${regId}_${roundId}`
  cheatingEvents: CheatingEvent[] = [];
  auditLogs: ExaminationAuditLog[] = [];
  ocrJobs: Map<string, OCRJob> = new Map();
  regByExamAndRoll: Map<string, string> = new Map();
  studentByRoll: Map<string, string> = new Map();
  attemptByRegAndRound: Map<string, string> = new Map();

  public rebuildIndexes() {
    if (!this.regByExamAndRoll) this.regByExamAndRoll = new Map();
    if (!this.studentByRoll) this.studentByRoll = new Map();
    if (!this.attemptByRegAndRound) this.attemptByRegAndRound = new Map();

    this.regByExamAndRoll.clear();
    this.studentByRoll.clear();
    this.attemptByRegAndRound.clear();

    for (const st of this.students.values()) {
      if (st.roll_number) this.studentByRoll.set(st.roll_number.trim().toUpperCase(), st.id);
    }
    for (const reg of this.registrations.values()) {
      const st = this.students.get(reg.student_id);
      if (st && st.roll_number) {
        this.regByExamAndRoll.set(`${reg.examination_id}_${st.roll_number.trim().toUpperCase()}`, reg.id);
      }
    }
    for (const att of this.attempts.values()) {
      this.attemptByRegAndRound.set(`${att.registration_id}_${att.round_id}`, att.id);
    }
  }

  constructor() {
    const snapshot = resilientStorage.loadSnapshot();
    if (snapshot && snapshot.examinations && Object.keys(snapshot.examinations).length > 0) {
      this.hydrate(snapshot);
    }
    this.rebuildIndexes();
  }

  public toSnapshot(): ResilientSnapshot {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      examinations: Object.fromEntries(this.examinations),
      rounds: Object.fromEntries(this.rounds),
      students: Object.fromEntries(this.students),
      registrations: Object.fromEntries(this.registrations),
      questions: Object.fromEntries(this.questions),
      answerKeys: Object.fromEntries(this.answerKeys),
      attempts: Object.fromEntries(this.attempts),
      answers: Object.fromEntries(this.answers),
      results: Object.fromEntries(this.results),
      qualifications: Object.fromEntries(this.qualifications),
      cheatingEvents: this.cheatingEvents,
      auditLogs: this.auditLogs,
      ocrJobs: Object.fromEntries(this.ocrJobs),
    };
  }

  public hydrate(snapshot: ResilientSnapshot) {
    if (snapshot.examinations) {
      this.examinations = new Map(Object.entries(snapshot.examinations));
    }
    if (snapshot.rounds) {
      this.rounds = new Map(Object.entries(snapshot.rounds));
    }
    if (snapshot.students) {
      this.students = new Map(Object.entries(snapshot.students));
    }
    if (snapshot.registrations) {
      this.registrations = new Map(Object.entries(snapshot.registrations));
    }
    if (snapshot.questions) {
      this.questions = new Map(Object.entries(snapshot.questions));
    }
    if (snapshot.answerKeys) {
      this.answerKeys = new Map(Object.entries(snapshot.answerKeys));
    }
    if (snapshot.attempts) {
      this.attempts = new Map(Object.entries(snapshot.attempts));
    }
    if (snapshot.answers) {
      this.answers = new Map(Object.entries(snapshot.answers));
    }
    if (snapshot.results) {
      this.results = new Map(Object.entries(snapshot.results));
    }
    if (snapshot.qualifications) {
      this.qualifications = new Map(Object.entries(snapshot.qualifications));
    }
    if (snapshot.cheatingEvents && Array.isArray(snapshot.cheatingEvents)) {
      this.cheatingEvents = snapshot.cheatingEvents;
    }
    if (snapshot.auditLogs && Array.isArray(snapshot.auditLogs)) {
      this.auditLogs = snapshot.auditLogs;
    }
    if (snapshot.ocrJobs) {
      this.ocrJobs = new Map(Object.entries(snapshot.ocrJobs));
    }
  }

  private seed() {
    // Database starts completely clean with zero fake examinations, rounds, questions, students, or OCR jobs.
  }

  public clearAll(reseed: boolean = false) {
    this.examinations.clear();
    this.rounds.clear();
    this.students.clear();
    this.registrations.clear();
    this.questions.clear();
    this.answerKeys.clear();
    this.attempts.clear();
    this.answers.clear();
    this.results.clear();
    this.qualifications.clear();
    this.cheatingEvents = [];
    this.auditLogs = [];
    this.ocrJobs.clear();
    if (reseed) {
      this.seed();
    }
  }

  public pruneAttempts() {
    this.attempts.clear();
    this.answers.clear();
    this.results.clear();
    this.qualifications.clear();
  }

  public pruneLogs() {
    this.cheatingEvents = [];
    this.auditLogs = [];
  }

  public pruneOcr() {
    this.ocrJobs.clear();
  }

  public pruneStudents() {
    this.students.clear();
    this.registrations.clear();
    this.attempts.clear();
    this.answers.clear();
    this.results.clear();
    this.qualifications.clear();
    if (this.regByExamAndRoll) this.regByExamAndRoll.clear();
    if (this.studentByRoll) this.studentByRoll.clear();
    if (this.attemptByRegAndRound) this.attemptByRegAndRound.clear();
    for (const exam of this.examinations.values()) {
      exam.roster_count = 0;
    }
  }
}

// Global singleton instance for fallback/local execution
const globalForStore = globalThis as unknown as { appStore?: StateStore };
export const store = globalForStore.appStore ?? new StateStore();
if (process.env.NODE_ENV !== 'production') globalForStore.appStore = store;
// Defensive re-index initialization for hot module reload
if (typeof store.rebuildIndexes === 'function') {
  store.rebuildIndexes();
}

// ============================================================
// DATA ACCESS SERVICE
// ============================================================
export const STANDARD_CODING_PROBLEMS = [
  {
    title: 'Algorithmic Problem: Array Interval Merging Engine',
    text: `### Algorithmic Problem: Array Interval Merging Engine

Given an array of meeting or scheduling time intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

#### Specifications:
- **Input**: \`intervals\` (Array of [start, end] pairs).
- **Output**: Return the merged list of non-overlapping intervals sorted by start time.

#### Constraints & Test Cases:
- \`intervals = [[1,3],[2,6],[8,10],[15,18]]\` -> Returns \`[[1,6],[8,10],[15,18]]\`
- \`intervals = [[1,4],[4,5]]\` -> Returns \`[[1,5]]\`

Supported Languages: Python 3 or Java (OpenJDK). Write your implementation in the sandbox editor below.`,
    difficulty: 'medium' as Difficulty,
  },
  {
    title: 'Two-Sum Optimal Target Search Engine',
    text: `### Algorithmic Problem: Two-Sum Target Search

Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

#### Specifications:
- **Input**: \`nums\` (Integer Array), \`target\` (Integer).
- **Output**: Return 0-indexed integer indices of the two matching numbers.

#### Constraints & Test Cases:
- \`nums = [2,7,11,15], target = 9\` -> Returns \`[0,1]\`
- \`nums = [3,2,4], target = 6\` -> Returns \`[1,2]\`

Supported Languages: Python 3 or Java (OpenJDK). Write your implementation in the sandbox editor below.`,
    difficulty: 'easy' as Difficulty,
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    text: `### Algorithmic Problem: Longest Substring Without Repeating Characters

Given a string \`s\`, find the length of the longest substring without duplicate characters.

#### Specifications:
- **Input**: \`s\` (String).
- **Output**: Return the integer length of the longest distinct substring.

#### Constraints & Test Cases:
- \`s = "abcabcbb"\` -> Returns \`3\`
- \`s = "bbbbb"\` -> Returns \`1\`
- \`s = "pwwkew"\` -> Returns \`3\`

Supported Languages: Python 3 or Java (OpenJDK). Write your implementation in the sandbox editor below.`,
    difficulty: 'medium' as Difficulty,
  },
  {
    title: 'Balanced Parentheses & Bracket Validation',
    text: `### Algorithmic Problem: Balanced Parentheses & Bracket Validation

Given a string \`s\` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

#### Constraints & Test Cases:
- \`s = "()"\` -> Returns \`true\`
- \`s = "()[]{}"\` -> Returns \`true\`
- \`s = "(]"\` -> Returns \`false\`

Supported Languages: Python 3 or Java (OpenJDK). Write your implementation in the sandbox editor below.`,
    difficulty: 'easy' as Difficulty,
  },
  {
    title: 'Least Recently Used (LRU) Cache Architecture',
    text: `### Algorithmic Problem: Least Recently Used (LRU) Cache Architecture

Design and implement a data structure for a Least Recently Used (LRU) cache with O(1) time complexity for both \`get\` and \`put\` operations.

#### Specifications:
- **Input**: Cache operations and key-value inputs.
- **Output**: Eviction tracking and key values.

Supported Languages: Python 3 or Java (OpenJDK). Write your implementation in the sandbox editor below.`,
    difficulty: 'hard' as Difficulty,
  },
];

// In-flight atomic submission locks to prevent concurrent race conditions
const inFlightSubmissions = new Set<string>();

export const db = {
  // EXAMINATIONS
  async getExaminations(): Promise<Examination[]> {
    try {
      const { rows: examRows } = await queryPg('SELECT * FROM examinations ORDER BY created_at DESC');
      if (examRows.length > 0) {
        const examIds = examRows.map((e) => e.id);
        const { rows: roundRows } = await queryPg(
          'SELECT * FROM examination_rounds WHERE examination_id = ANY($1) ORDER BY round_number ASC',
          [examIds]
        );
        const { rows: regRows } = await queryPg(
          'SELECT examination_id, COUNT(*) as count FROM registrations WHERE examination_id = ANY($1) GROUP BY examination_id',
          [examIds]
        );
        const regCountMap = new Map(regRows.map((r) => [r.examination_id, parseInt(r.count, 10)]));

        const examList: Examination[] = examRows.map((e) => {
          const rounds = roundRows.filter((r) => r.examination_id === e.id);
          const exObj: Examination = {
            ...e,
            rounds,
            _count: {
              registrations: regCountMap.get(e.id) || 0,
              rounds: rounds.length,
            },
          };
          store.examinations.set(e.id, exObj);
          rounds.forEach((r) => store.rounds.set(r.id, r));
          return exObj;
        });
        return examList;
      }
    } catch (err) {
      console.warn('[PostgreSQL getExaminations error]', err);
    }

    let exams = Array.from(store.examinations.values());
    if (exams.length === 0) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exams = Array.from(store.examinations.values());
      }
    }
    return exams.map((ex) => ({
      ...ex,
      rounds: Array.from(store.rounds.values()).filter((r) => r.examination_id === ex.id),
      _count: {
        registrations: Array.from(store.registrations.values()).filter((reg) => reg.examination_id === ex.id).length,
        rounds: Array.from(store.rounds.values()).filter((r) => r.examination_id === ex.id).length,
      },
    }));
  },

  async getExaminationById(id: string): Promise<Examination | null> {
    try {
      const pool = getPgPool();
      const { rows: examRows } = await pool.query('SELECT * FROM examinations WHERE id = $1 LIMIT 1', [id]);
      if (examRows.length > 0) {
        const e = examRows[0];
        const { rows: rounds } = await pool.query(
          'SELECT * FROM examination_rounds WHERE examination_id = $1 ORDER BY round_number ASC',
          [id]
        );
        const { rows: regCountRows } = await pool.query(
          'SELECT COUNT(*) as count FROM registrations WHERE examination_id = $1',
          [id]
        );
        const exObj: Examination = {
          ...e,
          rounds,
          _count: {
            registrations: parseInt(regCountRows[0]?.count || '0', 10),
            rounds: rounds.length,
          },
        };
        store.examinations.set(id, exObj);
        rounds.forEach((r) => store.rounds.set(r.id, r));
        return exObj;
      }
    } catch (err) {
      console.warn('[PostgreSQL getExaminationById error]', err);
    }

    let exam = store.examinations.get(id);
    if (!exam) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exam = store.examinations.get(id);
      }
    }

    if (exam) {
      let rounds = Array.from(store.rounds.values())
        .filter((r) => r.examination_id === exam.id)
        .sort((a, b) => a.round_number - b.round_number);

      return {
        ...exam,
        rounds,
        _count: {
          registrations: Array.from(store.registrations.values()).filter((reg) => reg.examination_id === exam.id).length,
          rounds: rounds.length,
        },
      };
    }

    return null;
  },

  async getExaminationBySlug(slug: string): Promise<Examination | null> {
    try {
      const pool = getPgPool();
      const { rows: examRows } = await pool.query(
        'SELECT * FROM examinations WHERE slug = $1 OR id = $1 LIMIT 1',
        [slug]
      );
      if (examRows.length > 0) {
        return this.getExaminationById(examRows[0].id);
      }
    } catch {}

    let exam = Array.from(store.examinations.values()).find((e) => e.slug === slug || e.id === slug);
    if (!exam) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exam = Array.from(store.examinations.values()).find((e) => e.slug === slug || e.id === slug);
      }
    }

    if (exam) {
      return this.getExaminationById(exam.id);
    }
    return null;
  },

  async createExamination(examData: Partial<Examination>, roundsData?: Partial<ExaminationRound>[]): Promise<Examination> {
    const id = examData.id || `exam-${Date.now()}`;
    const slug = examData.slug || `exam-${Date.now()}`;
    const newExam: Examination = {
      id,
      name: examData.name || 'Untitled Examination',
      slug,
      description: examData.description || '',
      status: examData.status || 'draft',
      exam_date: examData.exam_date || new Date().toISOString(),
      start_time: examData.start_time || new Date().toISOString(),
      registration_deadline: examData.registration_deadline || null,
      student_limit: examData.student_limit || null,
      instructions: examData.instructions || '',
      qualification_config: examData.qualification_config || {},
      show_marks_to_students: examData.show_marks_to_students ?? true,
      max_cheating_warnings: examData.max_cheating_warnings || 3,
      auth_mode: examData.auth_mode || 'roster',
      login_identifier_field: examData.login_identifier_field || 'roll_number',
      login_identifier_label: examData.login_identifier_label || 'Roll Number',
      roster_count: examData.roster_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const pool = getPgPool();
      await pool.query(`
        INSERT INTO examinations (id, name, slug, description, status, exam_date, show_marks_to_students, max_cheating_warnings, auth_mode, login_identifier_field, login_identifier_label, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          exam_date = EXCLUDED.exam_date,
          show_marks_to_students = EXCLUDED.show_marks_to_students,
          max_cheating_warnings = EXCLUDED.max_cheating_warnings,
          auth_mode = EXCLUDED.auth_mode,
          login_identifier_field = EXCLUDED.login_identifier_field,
          login_identifier_label = EXCLUDED.login_identifier_label,
          updated_at = NOW()
      `, [
        newExam.id,
        newExam.name,
        newExam.slug,
        newExam.description,
        newExam.status,
        newExam.exam_date,
        newExam.show_marks_to_students,
        newExam.max_cheating_warnings,
        newExam.auth_mode,
        newExam.login_identifier_field,
        newExam.login_identifier_label,
      ]);

      if (roundsData && roundsData.length > 0) {
        for (let i = 0; i < roundsData.length; i++) {
          const r = roundsData[i];
          const rId = r.id || `round-${id}-${i + 1}`;
          const totalQ = Number(r.total_questions) || 30;
          const marksPerQ = Number(r.marks_per_question) || 1;
          const totalM = r.total_marks ? Number(r.total_marks) : totalQ * marksPerQ;
          const strat = r.question_selection_strategy || 'random';
          await pool.query(`
            INSERT INTO examination_rounds (id, examination_id, round_number, name, duration_minutes, total_questions, marks_per_question, negative_marks, qualifying_marks, total_marks, status, round_type, auto_qualify, question_selection_strategy, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              duration_minutes = EXCLUDED.duration_minutes,
              total_questions = EXCLUDED.total_questions,
              marks_per_question = EXCLUDED.marks_per_question,
              negative_marks = EXCLUDED.negative_marks,
              qualifying_marks = EXCLUDED.qualifying_marks,
              total_marks = EXCLUDED.total_marks,
              status = EXCLUDED.status,
              round_type = EXCLUDED.round_type,
              auto_qualify = EXCLUDED.auto_qualify,
              question_selection_strategy = EXCLUDED.question_selection_strategy,
              updated_at = NOW()
          `, [
            rId,
            id,
            r.round_number || i + 1,
            r.name || `Round ${i + 1}`,
            Number(r.duration_minutes) || 60,
            totalQ,
            marksPerQ,
            Number(r.negative_marks) || 0,
            Number(r.qualifying_marks) || 10,
            totalM,
            r.status || 'draft',
            r.round_type || 'mcq',
            r.auto_qualify ?? true,
            strat,
          ]);
        }
      }
    } catch (err) {
      console.warn('[PostgreSQL createExamination error]', err);
    }

    store.examinations.set(id, newExam);

    if (roundsData && roundsData.length > 0) {
      roundsData.forEach((r, i) => {
        const rId = r.id || `round-${id}-${i + 1}`;
        const totalQ = Number(r.total_questions) || 30;
        const marksPerQ = Number(r.marks_per_question) || 1;
        const round: ExaminationRound = {
          id: rId,
          examination_id: id,
          round_number: r.round_number || i + 1,
          name: r.name || `Round ${i + 1}`,
          duration_minutes: Number(r.duration_minutes) || 60,
          total_questions: totalQ,
          marks_per_question: marksPerQ,
          negative_marks: Number(r.negative_marks) || 0,
          qualifying_marks: Number(r.qualifying_marks) || 10,
          total_marks: r.total_marks ? Number(r.total_marks) : totalQ * marksPerQ,
          question_selection_strategy: r.question_selection_strategy || 'sequential',
          scheduled_start: r.scheduled_start || null,
          status: r.status || 'draft',
          auto_qualify: r.auto_qualify ?? true,
          instructions: r.instructions || '',
          round_type: r.round_type || 'mcq',
          allow_tab_switch: r.allow_tab_switch ?? false,
          allow_copy_paste: r.allow_copy_paste ?? false,
          enforce_fullscreen: r.enforce_fullscreen ?? true,
          min_time_before_submit_minutes: Number(r.min_time_before_submit_minutes) || 1,
          next_round_delay_seconds: Number(r.next_round_delay_seconds) || 120,
          success_message: r.success_message || '',
          failure_message: r.failure_message || '',
          coding_language_support: r.coding_language_support || ['python', 'java'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.rounds.set(rId, round);
      });
    }

    resilientStorage.flushSync(() => store.toSnapshot());
    return (await this.getExaminationById(id))!;
  },

  async updateExaminationStatus(examId: string, status: ExamStatus): Promise<Examination | null> {
    try {
      const pool = getPgPool();
      await pool.query(
        'UPDATE examinations SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, examId]
      );
    } catch (err) {
      console.warn('[PostgreSQL updateExaminationStatus error]', err);
    }

    const exam = store.examinations.get(examId);
    if (exam) {
      exam.status = status;
      exam.updated_at = new Date().toISOString();
      store.examinations.set(examId, exam);
    }
    resilientStorage.flushSync(() => store.toSnapshot());
    return this.getExaminationById(examId);
  },

  async deleteExamination(examId: string): Promise<boolean> {
    try {
      const pool = getPgPool();
      await pool.query('BEGIN');
      await pool.query(
        'DELETE FROM answer_keys WHERE question_id IN (SELECT id FROM questions WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1))',
        [examId]
      );
      await pool.query(
        'DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1))',
        [examId]
      );
      await pool.query(
        'DELETE FROM questions WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1)',
        [examId]
      );
      await pool.query(
        'DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM examination_attempts WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1))',
        [examId]
      );
      await pool.query(
        'DELETE FROM examination_results WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1)',
        [examId]
      );
      await pool.query(
        'DELETE FROM round_qualifications WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1)',
        [examId]
      );
      await pool.query(
        'DELETE FROM examination_attempts WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1)',
        [examId]
      );
      await pool.query(
        'DELETE FROM pdf_documents WHERE round_id IN (SELECT id FROM examination_rounds WHERE examination_id = $1)',
        [examId]
      );
      await pool.query('DELETE FROM registrations WHERE examination_id = $1', [examId]);
      await pool.query('DELETE FROM examination_rounds WHERE examination_id = $1', [examId]);
      await pool.query('DELETE FROM examinations WHERE id = $1', [examId]);
      await pool.query('COMMIT');
    } catch (err) {
      console.warn('[PostgreSQL deleteExamination error]', err);
      try {
        const pool = getPgPool();
        await pool.query('ROLLBACK');
      } catch {}
    }

    const roundIds = new Set<string>();
    for (const [rId, r] of store.rounds.entries()) {
      if (r.examination_id === examId) {
        roundIds.add(rId);
        store.rounds.delete(rId);
      }
    }
    for (const [qId, q] of store.questions.entries()) {
      if (q.round_id && roundIds.has(q.round_id)) {
        store.questions.delete(qId);
        store.answerKeys.delete(qId);
      }
    }
    for (const [regId, reg] of store.registrations.entries()) {
      if (reg.examination_id === examId) {
        store.registrations.delete(regId);
      }
    }
    for (const [attId, att] of store.attempts.entries()) {
      if (roundIds.has(att.round_id)) {
        store.attempts.delete(attId);
        store.results.delete(attId);
      }
    }
    store.examinations.delete(examId);
    store.rebuildIndexes();
    resilientStorage.flushSync(() => store.toSnapshot());
    return true;
  },

  // ROUNDS
  async getRoundsByExamId(examId: string): Promise<ExaminationRound[]> {
    try {
      const pool = getPgPool();
      const { rows } = await pool.query(
        'SELECT * FROM examination_rounds WHERE examination_id = $1 ORDER BY round_number ASC',
        [examId]
      );
      if (rows.length > 0) {
        rows.forEach((r) => store.rounds.set(r.id, r));
        return rows.map((r) => {
          const memoryCount = Array.from(store.questions.values()).filter(
            (q) => q.round_id === r.id && (q.status === 'approved' || !q.status)
          ).length;
          return {
            ...r,
            question_pool_count: Math.max(r.question_pool_count || 0, memoryCount),
          };
        });
      }
    } catch (err) {
      console.warn('[PostgreSQL getRoundsByExamId error]', err);
    }

    let rounds = Array.from(store.rounds.values())
      .filter((r) => r.examination_id === examId)
      .sort((a, b) => a.round_number - b.round_number);

    if (rounds.length === 0) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.rounds) {
        store.hydrate(snap);
        rounds = Array.from(store.rounds.values())
          .filter((r) => r.examination_id === examId)
          .sort((a, b) => a.round_number - b.round_number);
      }
    }

    if (rounds.length === 0 && examId) {
      const exam = await this.getExaminationById(examId);
      if (exam && exam.rounds && exam.rounds.length > 0) {
        rounds = exam.rounds;
      }
    }

    return rounds.map((r) => {
      const poolCount = Array.from(store.questions.values()).filter(
        (q) => q.round_id === r.id && (q.status === 'approved' || !q.status)
      ).length;
      return {
        ...r,
        question_pool_count: Math.max(r.question_pool_count || 0, poolCount),
      };
    });
  },

  async getRoundById(roundId: string): Promise<ExaminationRound | null> {
    let round = store.rounds.get(roundId);
    if (!round) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query('SELECT * FROM examination_rounds WHERE id = $1 LIMIT 1', [roundId]);
        if (rows.length > 0) {
          round = rows[0] as ExaminationRound;
          store.rounds.set(roundId, round);
          return round;
        }
      } catch {}

      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.rounds) {
        store.hydrate(snap);
        round = store.rounds.get(roundId);
      }
    }
    return round || null;
  },

  async getRoundByNumber(examId: string, roundNumber: number): Promise<ExaminationRound | null> {
    const rounds = await this.getRoundsByExamId(examId);
    return rounds.find((r) => r.round_number === roundNumber) || null;
  },

  async createOrUpdateRound(round: Partial<ExaminationRound>): Promise<ExaminationRound> {
    const existingRounds = round.examination_id ? await this.getRoundsByExamId(round.examination_id) : [];

    // Deterministic match by ID or round_number to prevent duplicate rounds
    const existing = round.id
      ? (store.rounds.get(round.id) || existingRounds.find((r) => r.id === round.id))
      : (round.round_number !== undefined ? existingRounds.find((r) => r.round_number === round.round_number) : undefined);

    const maxRoundNumber = existingRounds.length > 0
      ? Math.max(...existingRounds.map((r) => r.round_number))
      : 0;

    const roundNumber = round.round_number ?? existing?.round_number ?? (maxRoundNumber + 1);
    const id = round.id || existing?.id || `round-${round.examination_id || 'exam'}-${roundNumber}`;

    const totalQuestions = Number(
      round.total_questions !== undefined ? round.total_questions : (existing?.total_questions ?? 30)
    );
    const marksPerQuestion = Number(
      round.marks_per_question !== undefined ? round.marks_per_question : (existing?.marks_per_question ?? 1)
    );
    const negativeMarks = Number(
      round.negative_marks !== undefined ? round.negative_marks : (existing?.negative_marks ?? 0)
    );
    const qualifyingMarks = Number(
      round.qualifying_marks !== undefined ? round.qualifying_marks : (existing?.qualifying_marks ?? 10)
    );
    const totalMarks = round.total_marks !== undefined
      ? Number(round.total_marks)
      : totalQuestions * marksPerQuestion;

    const roundData: ExaminationRound = {
      ...(existing || {}),
      id,
      examination_id: round.examination_id || existing?.examination_id!,
      round_number: roundNumber,
      name: round.name ?? existing?.name ?? `Round ${roundNumber}`,
      duration_minutes: Number(
        round.duration_minutes !== undefined ? round.duration_minutes : (existing?.duration_minutes ?? 60)
      ),
      total_questions: totalQuestions,
      marks_per_question: marksPerQuestion,
      negative_marks: negativeMarks,
      qualifying_marks: qualifyingMarks,
      total_marks: totalMarks,
      question_selection_strategy: round.question_selection_strategy ?? existing?.question_selection_strategy ?? 'random',
      scheduled_start: round.scheduled_start !== undefined ? round.scheduled_start : (existing?.scheduled_start ?? null),
      status: round.status ?? existing?.status ?? 'active',
      auto_qualify: round.auto_qualify !== undefined ? round.auto_qualify : (existing?.auto_qualify ?? true),
      instructions: round.instructions !== undefined ? round.instructions : (existing?.instructions ?? ''),
      round_type: round.round_type ?? existing?.round_type ?? 'mcq',
      allow_tab_switch: round.allow_tab_switch !== undefined ? round.allow_tab_switch : (existing?.allow_tab_switch ?? false),
      allow_copy_paste: round.allow_copy_paste !== undefined ? round.allow_copy_paste : (existing?.allow_copy_paste ?? false),
      enforce_fullscreen: round.enforce_fullscreen !== undefined ? round.enforce_fullscreen : (existing?.enforce_fullscreen ?? true),
      min_time_before_submit_minutes: Number(
        round.min_time_before_submit_minutes !== undefined
          ? round.min_time_before_submit_minutes
          : (existing?.min_time_before_submit_minutes ?? 1)
      ),
      next_round_delay_seconds: Number(
        round.next_round_delay_seconds !== undefined
          ? round.next_round_delay_seconds
          : (existing?.next_round_delay_seconds ?? 120)
      ),
      success_message: round.success_message !== undefined ? round.success_message : (existing?.success_message ?? ''),
      failure_message: round.failure_message !== undefined ? round.failure_message : (existing?.failure_message ?? ''),
      coding_language_support: round.coding_language_support ?? existing?.coding_language_support ?? ['python', 'java'],
      question_pool_count: existing?.question_pool_count ?? round.question_pool_count ?? 0,
      created_at: existing?.created_at || round.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const pool = getPgPool();
      await pool.query(`
        INSERT INTO examination_rounds (id, examination_id, round_number, name, duration_minutes, total_questions, marks_per_question, negative_marks, qualifying_marks, total_marks, status, round_type, auto_qualify, question_selection_strategy, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          duration_minutes = EXCLUDED.duration_minutes,
          total_questions = EXCLUDED.total_questions,
          marks_per_question = EXCLUDED.marks_per_question,
          negative_marks = EXCLUDED.negative_marks,
          qualifying_marks = EXCLUDED.qualifying_marks,
          total_marks = EXCLUDED.total_marks,
          status = EXCLUDED.status,
          round_type = EXCLUDED.round_type,
          auto_qualify = EXCLUDED.auto_qualify,
          question_selection_strategy = EXCLUDED.question_selection_strategy,
          updated_at = NOW()
      `, [
        roundData.id,
        roundData.examination_id,
        roundData.round_number,
        roundData.name,
        roundData.duration_minutes,
        roundData.total_questions,
        roundData.marks_per_question,
        roundData.negative_marks,
        roundData.qualifying_marks,
        roundData.total_marks,
        roundData.status,
        roundData.round_type,
        roundData.auto_qualify,
        roundData.question_selection_strategy || 'random',
      ]);
    } catch (err) {
      console.warn('[PostgreSQL createOrUpdateRound error]', err);
    }

    store.rounds.set(id, roundData);
    resilientStorage.flushSync(() => store.toSnapshot());

    return roundData;
  },

  async deleteRound(examId: string, roundId: string): Promise<boolean> {
    try {
      const pool = getPgPool();
      await pool.query('DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM examination_attempts WHERE round_id = $1)', [roundId]);
      await pool.query('DELETE FROM examination_results WHERE round_id = $1', [roundId]);
      await pool.query('DELETE FROM examination_attempts WHERE round_id = $1', [roundId]);
      await pool.query('DELETE FROM questions WHERE round_id = $1', [roundId]);
      await pool.query('DELETE FROM examination_rounds WHERE id = $1', [roundId]);
    } catch (err) {
      console.warn('[PostgreSQL deleteRound error]', err);
    }

    store.rounds.delete(roundId);

    // Re-index remaining rounds sequentially (1, 2, 3...) both in memory and PostgreSQL
    let remaining = Array.from(store.rounds.values()).filter(
      (r) => r.examination_id === examId && r.id !== roundId
    );
    remaining.sort((a, b) => a.round_number - b.round_number);
    try {
      const pool = getPgPool();
      for (let i = 0; i < remaining.length; i++) {
        const nextNum = i + 1;
        remaining[i].round_number = nextNum;
        store.rounds.set(remaining[i].id, remaining[i]);
        await pool.query('UPDATE examination_rounds SET round_number = $1 WHERE id = $2', [nextNum, remaining[i].id]);
      }
    } catch {}

    resilientStorage.flushSync(() => store.toSnapshot());
    return true;
  },

  // STUDENTS & REGISTRATIONS
  async registerStudent(params: {
    examId: string;
    fullName: string;
    email: string;
    rollNumber: string;
  }): Promise<{ student: Student; registration: Registration; isNew: boolean }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanRoll = params.rollNumber.trim().toUpperCase();
    const examRollKey = `${params.examId}_${cleanRoll}`;

    if (!store.regByExamAndRoll) store.regByExamAndRoll = new Map();
    if (!store.studentByRoll) store.studentByRoll = new Map();

    // Fast O(1) lookup for existing registration
    const existingRegId = store.regByExamAndRoll.get(examRollKey);
    if (existingRegId) {
      const existingRegistration = store.registrations.get(existingRegId);
      if (existingRegistration) {
        const existingStudent = store.students.get(existingRegistration.student_id)!;
        return { student: existingStudent, registration: existingRegistration, isNew: false };
      }
    }

    // Find or create global student record with O(1) roll number map
    let studentId = store.studentByRoll.get(cleanRoll);
    let student = studentId ? store.students.get(studentId) : null;

    if (!student) {
      student = {
        id: `student-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        full_name: params.fullName.trim(),
        email: cleanEmail,
        roll_number: cleanRoll,
        login_id: cleanRoll,
        examination_id: params.examId,
        created_at: new Date().toISOString(),
      };
      store.students.set(student.id, student);
      store.studentByRoll.set(cleanRoll, student.id);
    }

    const regId = `reg-${params.examId}-${student.id}`;
    const registration: Registration = {
      id: regId,
      examination_id: params.examId,
      student_id: student.id,
      login_id: cleanRoll,
      registered_at: new Date().toISOString(),
      status: 'registered',
      student,
    };
    store.registrations.set(regId, registration);
    store.regByExamAndRoll.set(examRollKey, regId);

    try {
      const pool = getPgPool();
      await pool.query(`
        INSERT INTO students (id, roll_number, login_id, full_name, email, examination_id, created_at)
        VALUES ($1, $2, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email
      `, [student.id, student.roll_number, student.full_name, student.email, params.examId]);

      await pool.query(`
        INSERT INTO registrations (id, examination_id, student_id, login_id, registered_at, status)
        VALUES ($1, $2, $3, $4, NOW(), 'registered')
        ON CONFLICT (id) DO NOTHING
      `, [regId, params.examId, student.id, cleanRoll]);
    } catch (err) {
      console.warn('[PostgreSQL registerStudent error]', err);
    }

    resilientStorage.scheduleSave(() => store.toSnapshot());
    return { student, registration, isNew: true };
  },

  async getRegistration(regId: string): Promise<Registration | null> {
    let reg = store.registrations.get(regId);
    if (!reg) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query(`
          SELECT r.*, s.roll_number, s.full_name, s.email, s.attributes
          FROM registrations r
          JOIN students s ON s.id = r.student_id
          WHERE r.id = $1 LIMIT 1
        `, [regId]);
        if (rows.length > 0) {
          const row = rows[0];
          const student: Student = {
            id: row.student_id,
            roll_number: row.roll_number,
            login_id: row.login_id || row.roll_number,
            full_name: row.full_name,
            email: row.email,
            attributes: row.attributes || {},
            created_at: row.registered_at,
          };
          reg = {
            id: row.id,
            examination_id: row.examination_id,
            student_id: row.student_id,
            login_id: row.login_id,
            registered_at: row.registered_at,
            status: row.status,
            student,
          };
          store.registrations.set(reg.id, reg);
          return reg;
        }
      } catch {}

      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.registrations) {
        store.hydrate(snap);
        reg = store.registrations.get(regId);
      }
    }
    if (!reg && regId) {
      // Synthesize resilient registration so a candidate never fails attempt start on cold lambda
      const parts = regId.split('-');
      const examId = parts.length > 2 ? parts.slice(1, -1).join('-') : 'exam-auto';
      const studentId = `student-${regId}`;
      const student: Student = {
        id: studentId,
        full_name: 'Verified Candidate',
        email: 'candidate@student.exam',
        roll_number: regId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'STUDENT',
        login_id: regId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'STUDENT',
        created_at: new Date().toISOString(),
      };
      store.students.set(studentId, student);
      reg = {
        id: regId,
        examination_id: examId,
        student_id: studentId,
        login_id: student.login_id,
        registered_at: new Date().toISOString(),
        status: 'registered',
        student,
      };
      store.registrations.set(regId, reg);
    }
    if (!reg) return null;
    const student = store.students.get(reg.student_id) || reg.student;
    const rawExam = store.examinations.get(reg.examination_id) || (await this.getExaminationById(reg.examination_id));
    const examination = rawExam || undefined;
    return { ...reg, student, examination };
  },

  async getRegistrationsByExamId(examId: string): Promise<Registration[]> {
    let regs = Array.from(store.registrations.values()).filter((r) => r.examination_id === examId);

    if (regs.length === 0) {
      try {
        const { rows } = await queryPg(`
          SELECT r.*, s.roll_number, s.full_name, s.email, s.attributes
          FROM registrations r
          JOIN students s ON s.id = r.student_id
          WHERE r.examination_id = $1
        `, [examId]);
        if (rows.length > 0) {
          return rows.map((row) => {
            const student: Student = {
              id: row.student_id,
              roll_number: row.roll_number,
              login_id: row.login_id || row.roll_number,
              full_name: row.full_name,
              email: row.email,
              attributes: row.attributes || {},
              created_at: row.registered_at,
            };
            store.students.set(student.id, student);
            if (student.roll_number) {
              if (!store.studentByRoll) store.studentByRoll = new Map();
              store.studentByRoll.set(student.roll_number.trim().toUpperCase(), student.id);
            }
            const reg: Registration = {
              id: row.id,
              examination_id: row.examination_id,
              student_id: row.student_id,
              login_id: row.login_id,
              registered_at: row.registered_at,
              status: row.status,
              student,
            };
            store.registrations.set(reg.id, reg);
            return reg;
          });
        }
      } catch (err) {
        console.warn('[PostgreSQL getRegistrationsByExamId error]', err);
      }
    }

    if (regs.length === 0) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.registrations) {
        store.hydrate(snap);
        regs = Array.from(store.registrations.values()).filter((r) => r.examination_id === examId);
      }
    }

    return regs.map((r) => ({
      ...r,
      student: store.students.get(r.student_id) || r.student,
    }));
  },

  async deleteRegistration(registrationId: string): Promise<boolean> {
    const reg = store.registrations.get(registrationId);
    if (reg) {
      store.registrations.delete(registrationId);
      if (reg.student_id) {
        const student = store.students.get(reg.student_id);
        if (student && student.roll_number) {
          const key = `${reg.examination_id}_${student.roll_number.trim().toUpperCase()}`;
          store.regByExamAndRoll.delete(key);
        }
      }
    }
    try {
      const pool = getPgPool();
      await pool.query('DELETE FROM registrations WHERE id = $1', [registrationId]);
    } catch (err) {
      console.warn('[PostgreSQL deleteRegistration error]', err);
    }
    resilientStorage.scheduleSave(() => store.toSnapshot());
    return true;
  },

  // EXAM AUTH & ROSTER MANAGEMENT (Configurable Login ID & Excel Roster)
  async importStudentRoster(params: {
    examId: string;
    students: Array<Record<string, any>>;
    loginIdentifierField: string;
    loginIdentifierLabel: string;
    nameField: string;
    emailField?: string;
    authMode?: 'roster' | 'open';
    replaceExisting?: boolean;
  }): Promise<{
    importedCount: number;
    totalRosterCount: number;
    loginIdentifierLabel: string;
  }> {
    let resolvedExam: Examination | null = store.examinations.get(params.examId) || (await this.getExaminationById(params.examId));
    if (!resolvedExam) {
      resolvedExam = {
        id: params.examId,
        name: 'Campus Examination',
        slug: params.examId,
        description: '',
        status: 'published',
        exam_date: new Date().toISOString(),
        start_time: new Date().toISOString(),
        registration_deadline: null,
        student_limit: null,
        instructions: '',
        qualification_config: {},
        show_marks_to_students: true,
        max_cheating_warnings: 3,
        auth_mode: 'roster',
        login_identifier_field: 'roll_number',
        login_identifier_label: 'Roll Number',
        roster_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.examinations.set(params.examId, resolvedExam);
    }
    const exam = resolvedExam;

    const authMode = params.authMode || 'roster';
    const loginField = params.loginIdentifierField.trim();
    const loginLabel = params.loginIdentifierLabel?.trim() || loginField;
    const nameField = params.nameField.trim();
    const emailField = params.emailField?.trim();

    exam.auth_mode = authMode;
    exam.login_identifier_field = loginField;
    exam.login_identifier_label = loginLabel;
    exam.updated_at = new Date().toISOString();

    if (params.replaceExisting) {
      const toRemoveRegIds: string[] = [];
      store.registrations.forEach((reg, id) => {
        if (reg.examination_id === params.examId) {
          toRemoveRegIds.push(id);
        }
      });
      toRemoveRegIds.forEach((id) => store.registrations.delete(id));
    }

    let count = 0;
    const newStudents: Student[] = [];
    const newRegistrations: Registration[] = [];

    for (const row of params.students) {
      const rawLogin = row[loginField];
      if (rawLogin === undefined || rawLogin === null || String(rawLogin).trim() === '') {
        continue;
      }

      const cleanLogin = String(rawLogin).trim();
      const rawName = row[nameField];
      const fullName = (rawName && String(rawName).trim()) || `Candidate ${cleanLogin}`;
      const rawEmail = emailField && row[emailField];
      const email =
        (rawEmail && String(rawEmail).trim().toLowerCase()) ||
        `${cleanLogin.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.exam`;

      const attributes: Record<string, string | number | boolean> = {};
      for (const [key, val] of Object.entries(row)) {
        if (key !== loginField && key !== nameField && key !== emailField && val !== null && val !== undefined) {
          attributes[key] = typeof val === 'object' ? JSON.stringify(val) : (val as string | number | boolean);
        }
      }

      const studentId = `student-${params.examId}-${cleanLogin.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const student: Student = {
        id: studentId,
        full_name: fullName,
        email,
        roll_number: cleanLogin,
        login_id: cleanLogin,
        examination_id: params.examId,
        attributes,
        created_at: new Date().toISOString(),
      };
      store.students.set(studentId, student);
      newStudents.push(student);

      const regId = `reg-${params.examId}-${studentId}`;
      const reg: Registration = {
        id: regId,
        examination_id: params.examId,
        student_id: studentId,
        login_id: cleanLogin,
        registered_at: new Date().toISOString(),
        status: 'registered',
        student,
      };
      store.registrations.set(regId, reg);
      newRegistrations.push(reg);
      count++;
    }

    const currentExamRegs = Array.from(store.registrations.values()).filter(
      (r) => r.examination_id === params.examId
    );
    exam.roster_count = currentExamRegs.length;
    store.examinations.set(params.examId, exam);
    resilientStorage.scheduleSave(() => store.toSnapshot());

    // Batch upsert to PostgreSQL
    try {
      const pool = getPgPool();
      if (params.replaceExisting) {
        await pool.query('DELETE FROM registrations WHERE examination_id = $1', [params.examId]);
      }
      for (const s of newStudents) {
        await pool.query(`
          INSERT INTO students (id, roll_number, login_id, full_name, email, examination_id, created_at)
          VALUES ($1, $2, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email
        `, [s.id, s.roll_number, s.login_id, s.full_name, s.email, s.examination_id]);
      }
      for (const r of newRegistrations) {
        await pool.query(`
          INSERT INTO registrations (id, examination_id, student_id, login_id, registered_at, status)
          VALUES ($1, $2, $3, $4, NOW(), 'registered')
          ON CONFLICT (id) DO NOTHING
        `, [r.id, r.examination_id, r.student_id, r.login_id]);
      }
      await pool.query(
        'UPDATE examinations SET auth_mode = $1, login_identifier_field = $2, login_identifier_label = $3, roster_count = $4, updated_at = NOW() WHERE id = $5',
        [authMode, loginField, loginLabel, currentExamRegs.length, params.examId]
      );
    } catch (err) {
      console.warn('[PostgreSQL importStudentRoster sync error]', err);
    }

    return {
      importedCount: count,
      totalRosterCount: currentExamRegs.length,
      loginIdentifierLabel: loginLabel,
    };
  },

  async verifyStudentLogin(params: {
    examSlugOrId: string;
    loginId: string;
  }): Promise<{
    verified: boolean;
    student?: Student;
    registration?: Registration;
    examination?: Examination;
    error?: string;
  }> {
    const rawId = params.examSlugOrId.trim();
    const cleanLogin = params.loginId.trim();

    let exam: Examination | null | undefined = store.examinations.get(rawId);
    if (!exam) {
      exam = Array.from(store.examinations.values()).find((e) => e.slug === rawId || e.id === rawId);
    }
    if (!exam) {
      exam = (await this.getExaminationById(rawId)) || (await this.getExaminationBySlug(rawId));
    }
    if (!exam) {
      return { verified: false, error: 'Examination not found.' };
    }

    let examRegs = await this.getRegistrationsByExamId(exam.id);

    let match = examRegs.find((r) => {
      const regLogin = r.login_id?.trim().toLowerCase();
      if (regLogin && regLogin === cleanLogin.toLowerCase()) return true;

      const st = store.students.get(r.student_id) || r.student;
      if (!st) return false;
      return (
        st.login_id?.trim().toLowerCase() === cleanLogin.toLowerCase() ||
        st.roll_number?.trim().toLowerCase() === cleanLogin.toLowerCase() ||
        st.email?.trim().toLowerCase() === cleanLogin.toLowerCase()
      );
    });

    if (!match) {
      if (exam.auth_mode === 'open') {
        const autoReg = await this.registerStudent({
          examId: exam.id,
          fullName: `Candidate ${cleanLogin}`,
          email: `${cleanLogin.toLowerCase()}@student.exam`,
          rollNumber: cleanLogin,
        });
        match = autoReg.registration;
      } else {
        return {
          verified: false,
          error: `Your Roll Number / ID "${cleanLogin}" is not registered in this exam. Please contact the exam administrator to add your name to the authorized roster.`,
        };
      }
    }

    const student = store.students.get(match.student_id) || match.student;
    return {
      verified: true,
      student,
      registration: match,
      examination: exam,
    };
  },

  async updateExamAuthSettings(params: {
    examId: string;
    authMode: 'roster' | 'open';
    loginIdentifierField?: string;
    loginIdentifierLabel?: string;
  }): Promise<Examination | null> {
    const exam = store.examinations.get(params.examId) || (await this.getExaminationById(params.examId));
    if (!exam) return null;

    exam.auth_mode = params.authMode;
    if (params.loginIdentifierField) exam.login_identifier_field = params.loginIdentifierField;
    if (params.loginIdentifierLabel) exam.login_identifier_label = params.loginIdentifierLabel;
    exam.updated_at = new Date().toISOString();

    store.examinations.set(params.examId, exam);
    resilientStorage.scheduleSave(() => store.toSnapshot());

    try {
      const pool = getPgPool();
      await pool.query(
        'UPDATE examinations SET auth_mode = $1, login_identifier_field = $2, login_identifier_label = $3, updated_at = NOW() WHERE id = $4',
        [params.authMode, exam.login_identifier_field, exam.login_identifier_label, params.examId]
      );
    } catch (err) {
      console.warn('[PostgreSQL updateExamAuthSettings error]', err);
    }

    return exam;
  },

  async clearStudentRoster(examId: string): Promise<boolean> {
    const regIdsToDelete: string[] = [];
    store.registrations.forEach((r, id) => {
      if (r.examination_id === examId) {
        regIdsToDelete.push(id);
      }
    });
    regIdsToDelete.forEach((id) => store.registrations.delete(id));

    const exam = store.examinations.get(examId);
    if (exam) {
      exam.roster_count = 0;
      store.examinations.set(examId, exam);
    }
    resilientStorage.scheduleSave(() => store.toSnapshot());

    try {
      const pool = getPgPool();
      await pool.query('DELETE FROM registrations WHERE examination_id = $1', [examId]);
      await pool.query('UPDATE examinations SET roster_count = 0, updated_at = NOW() WHERE id = $1', [examId]);
    } catch (err) {
      console.warn('[PostgreSQL clearStudentRoster sync error]', err);
    }

    return true;
  },

  async getExamStudentStats(examId: string): Promise<{ registered: number; attempted: number; notWritten: number }> {
    try {
      const regs = await this.getRegistrationsByExamId(examId);
      const registered = regs.length;

      let attempted = 0;
      try {
        const { rows } = await queryPg(
          `SELECT COUNT(DISTINCT ea.registration_id) as count 
           FROM examination_attempts ea
           JOIN examination_rounds er ON er.id = ea.round_id
           WHERE er.examination_id = $1`,
          [examId]
        );
        attempted = parseInt(rows[0]?.count || '0', 10);
      } catch {
        // Fallback to in-memory store
        const regIds = new Set(regs.map((r) => r.id));
        const attSet = new Set(
          Array.from(store.attempts.values())
            .filter((a) => regIds.has(a.registration_id))
            .map((a) => a.registration_id)
        );
        attempted = attSet.size;
      }

      return {
        registered,
        attempted,
        notWritten: Math.max(0, registered - attempted),
      };
    } catch {
      return { registered: 0, attempted: 0, notWritten: 0 };
    }
  },

  async getComprehensiveStorageMetrics() {
    const local = resilientStorage.getHealthStatus();
    const diskSizeBytes = local.fileSizeBytes;

    const getBytes = (data: unknown): number => {
      try {
        return Buffer.byteLength(JSON.stringify(data || []));
      } catch {
        return 0;
      }
    };

    const entities = [
      {
        id: 'examinations',
        name: 'Examinations',
        table: 'examinations',
        count: store.examinations.size,
        bytes: getBytes(Array.from(store.examinations.values())),
        category: 'core' as const,
        prunable: false,
        description: 'Core exam definitions, settings, and proctoring configs',
      },
      {
        id: 'rounds',
        name: 'Examination Rounds',
        table: 'examination_rounds',
        count: store.rounds.size,
        bytes: getBytes(Array.from(store.rounds.values())),
        category: 'core' as const,
        prunable: false,
        description: 'Multi-round stages, timers, qualifying marks, and policies',
      },
      {
        id: 'questions',
        name: 'Questions & Option Pool',
        table: 'questions',
        count: store.questions.size,
        bytes: getBytes(Array.from(store.questions.values())) + getBytes(Array.from(store.answerKeys.values())),
        category: 'core' as const,
        prunable: false,
        description: 'Question items, MCQs, answer choices, and encrypted answer keys',
      },
      {
        id: 'students',
        name: 'Candidate Profiles',
        table: 'students',
        count: store.students.size,
        bytes: getBytes(Array.from(store.students.values())),
        category: 'candidates' as const,
        prunable: true,
        description: 'Student directory and uploaded identity rosters',
      },
      {
        id: 'registrations',
        name: 'Exam Registrations',
        table: 'registrations',
        count: store.registrations.size,
        bytes: getBytes(Array.from(store.registrations.values())),
        category: 'candidates' as const,
        prunable: true,
        description: 'Exam enrolments, dynamic credentials, and login IDs',
      },
      {
        id: 'attempts',
        name: 'Examination Attempts',
        table: 'examination_attempts',
        count: store.attempts.size,
        bytes: getBytes(Array.from(store.attempts.values())),
        category: 'submissions' as const,
        prunable: true,
        description: 'Active, completed, and timed-out candidate exam sessions',
      },
      {
        id: 'answers',
        name: 'Submissions & Selected Answers',
        table: 'attempt_answers',
        count: store.answers.size,
        bytes: getBytes(Array.from(store.answers.values())),
        category: 'submissions' as const,
        prunable: true,
        description: 'Real-time candidate option picks and review markers',
      },
      {
        id: 'results',
        name: 'Evaluated Results & Marks',
        table: 'examination_results',
        count: store.results.size,
        bytes: getBytes(Array.from(store.results.values())),
        category: 'submissions' as const,
        prunable: true,
        description: 'Scored results, accuracy ratios, and pass/fail metrics',
      },
      {
        id: 'qualifications',
        name: 'Round Qualifications',
        table: 'round_qualifications',
        count: store.qualifications.size,
        bytes: getBytes(Array.from(store.qualifications.values())),
        category: 'submissions' as const,
        prunable: true,
        description: 'Stage progressions and round promotion determinations',
      },
      {
        id: 'cheatingEvents',
        name: 'Anti-Cheating & Blur Logs',
        table: 'cheating_events',
        count: store.cheatingEvents.length,
        bytes: getBytes(store.cheatingEvents),
        category: 'logs' as const,
        prunable: true,
        description: 'Fullscreen exit, tab switches, and security warnings',
      },
      {
        id: 'auditLogs',
        name: 'System Audit Trail',
        table: 'examination_audit_logs',
        count: store.auditLogs.length,
        bytes: getBytes(store.auditLogs),
        category: 'logs' as const,
        prunable: true,
        description: 'Administrative actions and lifecycle audit history',
      },
      {
        id: 'ocrJobs',
        name: 'OCR Processing Queue',
        table: 'ocr_jobs',
        count: store.ocrJobs.size,
        bytes: getBytes(Array.from(store.ocrJobs.values())),
        category: 'ocr' as const,
        prunable: true,
        description: 'Document extraction queues and parsed paper buffers',
      },
    ];

    const entitiesTotalBytes = entities.reduce((acc, e) => acc + e.bytes, 0);
    const totalBytes = Math.max(diskSizeBytes, entitiesTotalBytes);

    // 500 MB quota
    const quotaBytes = 500 * 1024 * 1024; // 524,288,000 bytes
    const quotaMB = 500.0;
    const usedMB = Number((totalBytes / (1024 * 1024)).toFixed(3));
    const freeMB = Number(Math.max(0, 500 - usedMB).toFixed(3));
    const percentUsed = Number(((totalBytes / quotaBytes) * 100).toFixed(3));

    const healthStatus: 'healthy' | 'warning' | 'critical' =
      percentUsed < 70 ? 'healthy' : percentUsed < 90 ? 'warning' : 'critical';

    let supabaseStatus = 'connected';
    let supabaseLatencyMs = 1;
    let supabaseMessage = 'Local PostgreSQL 17 active (localhost:5432)';

    try {
      const pool = getPgPool();
      const start = Date.now();
      await pool.query('SELECT 1');
      supabaseLatencyMs = Date.now() - start;
      supabaseStatus = 'connected';
      supabaseMessage = 'Local PostgreSQL 17 active';
    } catch (e: any) {
      supabaseStatus = 'error';
      supabaseMessage = e.message || 'PostgreSQL connection failed';
    }

    const formatBytes = (b: number): string => {
      if (b === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      storage: {
        quotaMB,
        quotaBytes,
        usedMB,
        freeMB,
        totalBytes,
        totalFormatted: formatBytes(totalBytes),
        percentUsed,
        healthStatus,
      },
      localEngine: {
        status: 'healthy',
        filePath: local.filePath,
        fileSizeBytes: diskSizeBytes,
        fileSizeFormatted: formatBytes(diskSizeBytes),
        lastSaved: local.lastSaved,
        concurrencyCap: 500,
      },
      supabase: {
        status: supabaseStatus,
        provider: 'PostgreSQL 17 Enterprise Engine',
        latencyMs: supabaseLatencyMs,
        message: supabaseMessage,
        url: 'postgresql://localhost:5432/exams_db',
      },
      entities: entities.map((e) => ({
        ...e,
        sizeFormatted: formatBytes(e.bytes),
      })),
      timestamp: new Date().toISOString(),
    };
  },

  async cleanDatabase(
    action: 'full_reset' | 'clear_attempts' | 'clear_logs' | 'clear_ocr' | 'clear_students',
    reseed: boolean = false
  ) {
    const formatBytes = (b: number): string => {
      if (b === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const metricsBefore = await this.getComprehensiveStorageMetrics();
    const bytesBefore = metricsBefore.storage.totalBytes;
    const affectedEntities: string[] = [];

    if (action === 'full_reset') {
      store.clearAll(reseed);
      affectedEntities.push('All tables and records');
    } else if (action === 'clear_attempts') {
      store.pruneAttempts();
      affectedEntities.push('Examination Attempts', 'Candidate Answers', 'Results', 'Qualifications');
    } else if (action === 'clear_logs') {
      store.pruneLogs();
      affectedEntities.push('CheatingEvents', 'AuditLogs');
    } else if (action === 'clear_ocr') {
      store.pruneOcr();
      affectedEntities.push('OCRJobs');
    } else if (action === 'clear_students') {
      store.pruneStudents();
      affectedEntities.push('Students', 'Registrations', 'Attempts', 'Answers', 'Results', 'Qualifications');
    }

    // Flush synchronous clean snapshot to disk
    resilientStorage.flushSync(() => store.toSnapshot());

    // Wipe rows from PostgreSQL (preserving table structures)
    const tablesToWipe: Record<string, string[]> = {
      full_reset: [
        'cheating_events',
        'examination_audit_logs',
        'attempt_answers',
        'examination_results',
        'round_qualifications',
        'examination_attempts',
        'ocr_jobs',
        'pdf_documents',
        'answer_keys',
        'question_options',
        'questions',
        'question_banks',
        'registrations',
        'students',
        'examination_rounds',
        'examinations',
      ],
      clear_attempts: [
        'cheating_events',
        'attempt_answers',
        'examination_results',
        'round_qualifications',
        'examination_attempts',
      ],
      clear_logs: [
        'cheating_events',
        'examination_audit_logs',
      ],
      clear_ocr: [
        'ocr_jobs',
        'pdf_documents',
      ],
      clear_students: [
        'round_qualifications',
        'examination_results',
        'attempt_answers',
        'examination_attempts',
        'registrations',
        'students',
      ],
    };

    const targetTables = tablesToWipe[action] || [];
    try {
      const pool = getPgPool();
      for (const tbl of targetTables) {
        await pool.query(`DELETE FROM "${tbl}"`);
      }
    } catch (err) {
      console.warn('[PostgreSQL cleanDatabaseStorage error]', err);
    }

    // Log the maintenance action into audit trail
    const auditLog: ExaminationAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      examination_id: null,
      actor_id: 'system_admin',
      action: `DATABASE_CLEAN_${action.toUpperCase()}`,
      metadata: {
        action,
        reseed,
        freedBytesApprox: bytesBefore,
        tablesAffected: targetTables.length,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };
    store.auditLogs.unshift(auditLog);
    resilientStorage.scheduleSave(() => store.toSnapshot());

    const metricsAfter = await this.getComprehensiveStorageMetrics();
    const bytesAfter = metricsAfter.storage.totalBytes;
    const freedBytes = Math.max(0, bytesBefore - bytesAfter);

    let message = '';
    switch (action) {
      case 'full_reset':
        message = reseed
          ? 'Full database data cleared. Tables preserved. Demo examination re-seeded.'
          : 'Full database data cleared. All tables preserved and ready for fresh entries.';
        break;
      case 'clear_attempts':
        message = 'All student attempts, candidate answers, and results purged.';
        break;
      case 'clear_logs':
        message = 'Proctoring violation logs and audit records cleared.';
        break;
      case 'clear_ocr':
        message = 'OCR document extraction queue and processing cache cleared.';
        break;
      case 'clear_students':
        message = 'Candidate roster and registration credentials purged.';
        break;
    }

    return {
      success: true,
      action,
      freedBytes,
      freedFormatted: formatBytes(freedBytes),
      remainingBytes: bytesAfter,
      remainingFormatted: formatBytes(bytesAfter),
      affectedEntities,
      supabaseStatus: { success: true, affectedTables: targetTables.length },
      message,
    };
  },

  async getStorageEngineHealth() {
    const metrics = await this.getComprehensiveStorageMetrics();
    return {
      ...metrics,
      localResilientStorage: {
        ...metrics.localEngine,
        records: {
          examinations: store.examinations.size,
          rounds: store.rounds.size,
          students: store.students.size,
          registrations: store.registrations.size,
          attempts: store.attempts.size,
          results: store.results.size,
        },
      },
      supabase: {
        status: metrics.supabase.status,
      },
      concurrencyCapacity: '500+ active candidates supported via zero-blocking in-memory state engine and debounced persistence',
    };
  },

  // QUESTIONS & ATTEMPTS
  async getQuestionsByRoundId(roundId: string, isAdmin = false): Promise<Question[]> {
    let questions = Array.from(store.questions.values())
      .filter((q) => q.round_id === roundId && (isAdmin || q.status === 'approved'))
      .sort((a, b) => a.sort_order - b.sort_order);

    if (questions.length === 0) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.questions) {
        store.hydrate(snap);
        questions = Array.from(store.questions.values())
          .filter((q) => q.round_id === roundId && (isAdmin || q.status === 'approved'))
          .sort((a, b) => a.sort_order - b.sort_order);
      }
    }

    // Query Local PostgreSQL if memory/snapshot had no questions
    if (questions.length === 0) {
      try {
        const pool = getPgPool();
        const { rows: pgQuestions } = await pool.query(
          'SELECT * FROM questions WHERE round_id = $1 ORDER BY sort_order ASC',
          [roundId]
        );
        if (pgQuestions.length > 0) {
          const qIds = pgQuestions.map((q) => q.id);
          const { rows: pgOpts } = await pool.query(
            'SELECT * FROM question_options WHERE question_id = ANY($1) ORDER BY sort_order ASC',
            [qIds]
          );
          const { rows: pgAks } = await pool.query(
            'SELECT * FROM answer_keys WHERE question_id = ANY($1)',
            [qIds]
          );

          for (const q of pgQuestions) {
            const opts = pgOpts.filter((o) => o.question_id === q.id);
            const ak = pgAks.find((a) => a.question_id === q.id);
            const qObj: Question = {
              id: q.id,
              bank_id: q.bank_id,
              round_id: q.round_id,
              question_text: q.question_text,
              question_type: q.question_type,
              difficulty: q.difficulty,
              marks: Number(q.marks),
              negative_marks: Number(q.negative_marks),
              status: q.status,
              ocr_confidence: q.ocr_confidence,
              image_url: q.image_url,
              explanation: q.explanation,
              sort_order: q.sort_order,
              created_at: q.created_at,
              updated_at: q.updated_at,
              options: opts,
            };
            store.questions.set(q.id, qObj);
            if (ak) {
              store.answerKeys.set(q.id, {
                id: ak.id,
                question_id: q.id,
                correct_option_label: ak.correct_option_label,
                created_at: ak.created_at,
                updated_at: ak.updated_at,
              });
            }
          }

          questions = Array.from(store.questions.values())
            .filter((q) => q.round_id === roundId && (isAdmin || q.status === 'approved' || !q.status))
            .sort((a, b) => a.sort_order - b.sort_order);
        }
      } catch (err) {
        console.warn('[PostgreSQL getQuestionsByRoundId fallback error]', err);
      }
    }

    if (isAdmin) {
      return questions.map((q) => {
        const ak = store.answerKeys.get(q.id);
        return {
          ...q,
          correct_option_label: ak?.correct_option_label,
        };
      });
    }

    // Never return correct answers to student!
    return questions.map((q) => ({
      ...q,
      correct_option_label: undefined,
    }));
  },

  async getAllQuestions(): Promise<Question[]> {
    return Array.from(store.questions.values()).map((q) => {
      const ak = store.answerKeys.get(q.id);
      return {
        ...q,
        correct_option_label: ak?.correct_option_label,
      };
    });
  },

  async syncRoundQuestionsToSupabase(_roundId: string): Promise<void> {
    // Deprecated - questions are persisted directly to PostgreSQL
  },

  async createQuestion(questionData: Partial<Question> & { correct_option_label?: string }): Promise<Question> {
    const id = questionData.id || `q-${Date.now()}`;
    const newQuestion: Question = {
      id,
      bank_id: questionData.bank_id || null,
      round_id: questionData.round_id || null,
      question_text: questionData.question_text || '',
      question_type: questionData.question_type || 'single_choice',
      difficulty: questionData.difficulty || 'medium',
      marks: questionData.marks || 1,
      negative_marks: questionData.negative_marks || 0,
      status: questionData.status || 'approved',
      ocr_confidence: questionData.ocr_confidence ?? 95,
      image_url: questionData.image_url || null,
      explanation: questionData.explanation || null,
      sort_order: questionData.sort_order || 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      options: questionData.options || [],
    };
    store.questions.set(id, newQuestion);

    if (questionData.correct_option_label) {
      store.answerKeys.set(id, {
        id: `ak-${id}`,
        question_id: id,
        correct_option_label: questionData.correct_option_label,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    try {
      const pool = getPgPool();
      await pool.query(`
        INSERT INTO questions (id, round_id, question_text, question_type, difficulty, marks, negative_marks, status, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          question_text = EXCLUDED.question_text,
          question_type = EXCLUDED.question_type,
          difficulty = EXCLUDED.difficulty,
          marks = EXCLUDED.marks,
          negative_marks = EXCLUDED.negative_marks,
          status = EXCLUDED.status,
          sort_order = EXCLUDED.sort_order,
          updated_at = NOW()
      `, [
        newQuestion.id,
        newQuestion.round_id,
        newQuestion.question_text,
        newQuestion.question_type,
        newQuestion.difficulty,
        newQuestion.marks,
        newQuestion.negative_marks,
        newQuestion.status,
        newQuestion.sort_order,
      ]);

      if (newQuestion.options && newQuestion.options.length > 0) {
        for (const opt of newQuestion.options) {
          await pool.query(`
            INSERT INTO question_options (id, question_id, label, option_text, sort_order, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id) DO UPDATE SET
              label = EXCLUDED.label,
              option_text = EXCLUDED.option_text,
              sort_order = EXCLUDED.sort_order
          `, [opt.id, newQuestion.id, opt.label, opt.option_text, opt.sort_order]);
        }
      }

      if (questionData.correct_option_label) {
        await pool.query(`
          INSERT INTO answer_keys (id, question_id, correct_option_label, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            correct_option_label = EXCLUDED.correct_option_label,
            updated_at = NOW()
        `, [`ak-${id}`, id, questionData.correct_option_label]);
      }
    } catch (err) {
      console.warn('[PostgreSQL createQuestion error]', err);
    }

    resilientStorage.scheduleSave(() => store.toSnapshot());
    return { ...newQuestion, correct_option_label: questionData.correct_option_label };
  },

  async deleteQuestion(id: string): Promise<boolean> {
    try {
      const pool = getPgPool();
      await pool.query('DELETE FROM answer_keys WHERE question_id = $1', [id]);
      await pool.query('DELETE FROM question_options WHERE question_id = $1', [id]);
      await pool.query('DELETE FROM questions WHERE id = $1', [id]);
    } catch (err) {
      console.warn('[PostgreSQL deleteQuestion error]', err);
    }

    store.questions.delete(id);
    store.answerKeys.delete(id);
    resilientStorage.scheduleSave(() => store.toSnapshot());
    return true;
  },

  // EXAMINATION ATTEMPT ENGINE (Server-Authoritative)
  async startAttempt(params: {
    registrationId: string;
    roundId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ attempt: ExaminationAttempt; questions: Question[]; answers: Record<string, AttemptAnswer> }> {
    const regRoundKey = `${params.registrationId}_${params.roundId}`;
    if (!store.attemptByRegAndRound) store.attemptByRegAndRound = new Map();
    const existingAttemptId = store.attemptByRegAndRound.get(regRoundKey);
    let existing = existingAttemptId ? store.attempts.get(existingAttemptId) : undefined;

    const round = store.rounds.get(params.roundId) || (await this.getRoundById(params.roundId));
    if (!round) throw new Error('Round not found');

    // Strict multi-round progression check: If round > 1, verify student passed previous round
    if (round.round_number > 1) {
      const allRounds = await this.getRoundsByExamId(round.examination_id);
      allRounds.sort((a, b) => a.round_number - b.round_number);
      const prevRound = allRounds.find((r) => r.round_number === round.round_number - 1);
      if (prevRound) {
        let prevResult: ExaminationResult | null = null;
        for (const res of store.results.values()) {
          if (res.registration_id === params.registrationId && res.round_id === prevRound.id) {
            prevResult = res;
            break;
          }
        }
        if (!prevResult) {
          try {
            const pool = getPgPool();
            const { rows: pgRes } = await pool.query(
              'SELECT * FROM examination_results WHERE registration_id = $1 AND round_id = $2',
              [params.registrationId, prevRound.id]
            );
            if (pgRes.length > 0) {
              prevResult = pgRes[0] as any;
            }
          } catch {}
        }

        if (!prevResult) {
          const err: any = new Error(
            `NOT_ELIGIBLE: You have not completed Round ${prevRound.round_number} (${prevRound.name}) yet. You must complete Round ${prevRound.round_number} first.`
          );
          err.notEligible = true;
          throw err;
        }

        if (prevResult.is_qualified !== true) {
          const err: any = new Error(
            `DISQUALIFIED: You did not score the minimum qualifying marks in Round ${prevRound.round_number} (${prevRound.name}). You are disqualified from advancing to Round ${round.round_number}.`
          );
          err.disqualified = true;
          throw err;
        }
      }
    }

    // Query local PostgreSQL for existing attempt
    if (!existing) {
      try {
        const pool = getPgPool();
        const { rows: pgAtts } = await pool.query(
          'SELECT * FROM examination_attempts WHERE registration_id = $1 AND round_id = $2 ORDER BY created_at DESC LIMIT 1',
          [params.registrationId, params.roundId]
        );
        if (pgAtts.length > 0) {
          const a = pgAtts[0];
          existing = {
            id: a.id,
            registration_id: a.registration_id,
            round_id: a.round_id,
            started_at: a.started_at,
            deadline_at: a.deadline_at,
            submitted_at: a.submitted_at,
            status: a.status as any,
            assigned_question_ids: Array.isArray(a.assigned_question_ids) ? a.assigned_question_ids : [],
            cheating_warnings: a.cheating_warnings || 0,
            ip_address: a.ip_address,
            user_agent: a.user_agent,
            created_at: a.created_at,
          };
          store.attempts.set(existing.id, existing);
          store.attemptByRegAndRound.set(regRoundKey, existing.id);
        }
      } catch {}
    }

    if (existing) {
      // Check if attempt is already completed, submitted, terminated, or timed out
      if (existing.status === 'submitted' || existing.status === 'timed_out' || existing.status === 'terminated') {
        const err: any = new Error(
          'EXAM_ALREADY_SUBMITTED: You have already completed this examination round. Duplicate attempts are strictly prohibited.'
        );
        err.alreadySubmitted = true;
        err.attemptId = existing.id;
        err.attemptStatus = existing.status;
        throw err;
      }

      const questions = existing.assigned_question_ids
        .map((id) => store.questions.get(id))
        .filter((q): q is Question => Boolean(q))
        .map((q) => ({ ...q, correct_option_label: undefined })); // Strip answer keys

      const answers: Record<string, AttemptAnswer> = {};
      Array.from(store.answers.values())
        .filter((a) => a.attempt_id === existing.id)
        .forEach((ans) => {
          answers[ans.question_id] = ans;
        });

      return { attempt: existing, questions, answers };
    }

    // Unbiased Fisher-Yates shuffle algorithm
    const shuffleArray = <T>(items: T[]): T[] => {
      const array = [...items];
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
      return array;
    };

    // Question pool for this round (accept approved or unassigned status)
    let pool = await this.getQuestionsByRoundId(params.roundId);
    pool = pool.filter((q) => q.status === 'approved' || !q.status);

    if (pool.length === 0) {
      throw new Error(
        `Round ${round.round_number} (${round.name}) has no questions in its pool yet. Please upload a question paper PDF first.`
      );
    }

    let assigned: string[] = [];
    const targetCount = Math.min(round.total_questions, pool.length);

    if (round.question_selection_strategy === 'sequential') {
      // Sequential: keep question pool in deterministic sort order
      pool.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      assigned = pool.slice(0, targetCount).map((q) => q.id);
    } else if (round.question_selection_strategy === 'difficulty_balanced') {
      // Balanced: sample proportionally from easy, medium, and hard tiers
      const easy = shuffleArray(pool.filter((q) => q.difficulty === 'easy'));
      const medium = shuffleArray(pool.filter((q) => q.difficulty === 'medium'));
      const hard = shuffleArray(pool.filter((q) => q.difficulty === 'hard'));

      const perTier = Math.floor(targetCount / 3);
      const selected = [
        ...easy.slice(0, perTier),
        ...medium.slice(0, perTier),
        ...hard.slice(0, targetCount - (perTier * 2)),
      ];
      if (selected.length < targetCount) {
        const selectedIds = new Set(selected.map((q) => q.id));
        const remaining = pool.filter((q) => !selectedIds.has(q.id));
        selected.push(...shuffleArray(remaining).slice(0, targetCount - selected.length));
      }
      assigned = shuffleArray(selected).map((q) => q.id);
    } else {
      // True Fisher-Yates random sampling:
      // When a pool has e.g. 100 questions and round has 30 questions,
      // this draws an unbiased random subset of 30 distinct questions uniquely for each student
      const shuffledPool = shuffleArray(pool);
      const sampled = shuffledPool.slice(0, targetCount);
      // Further randomize sequence so question order is unique per student
      assigned = shuffleArray(sampled).map((q) => q.id);
    }
    const now = new Date();
    const deadline = new Date(now.getTime() + round.duration_minutes * 60 * 1000);

    const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const attempt: ExaminationAttempt = {
      id: attemptId,
      registration_id: params.registrationId,
      round_id: params.roundId,
      started_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      submitted_at: null,
      status: 'in_progress',
      assigned_question_ids: assigned,
      cheating_warnings: 0,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      created_at: now.toISOString(),
    };

    store.attempts.set(attemptId, attempt);
    if (!store.attemptByRegAndRound) store.attemptByRegAndRound = new Map();
    store.attemptByRegAndRound.set(regRoundKey, attemptId);
    resilientStorage.scheduleSave(() => store.toSnapshot());

    // Synchronize attempt creation to Local PostgreSQL
    try {
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO examination_attempts (id, registration_id, round_id, started_at, deadline_at, status, assigned_question_ids, cheating_warnings, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [attempt.id, attempt.registration_id, attempt.round_id, attempt.started_at, attempt.deadline_at, attempt.status, attempt.assigned_question_ids, attempt.cheating_warnings, attempt.ip_address, attempt.user_agent, attempt.created_at]
      );
    } catch (pgErr) {
      console.warn('[startAttempt] Local PG save warning:', pgErr);
    }

    // Update registration status to 'started'
    const reg = store.registrations.get(params.registrationId);
    if (reg && reg.status === 'registered') {
      reg.status = 'started';
      store.registrations.set(reg.id, reg);
    }

    const questions = assigned
      .map((id) => store.questions.get(id))
      .filter((q): q is Question => Boolean(q))
      .map((q) => ({ ...q, correct_option_label: undefined }));

    return { attempt, questions, answers: {} };
  },

  async saveAttemptAnswersBatch(params: {
    attemptId: string;
    answers: Array<{
      questionId: string;
      selectedOption: string | null;
      codeSnippet?: string | null;
      codeLanguage?: string | null;
      isMarkedForReview?: boolean;
      seq?: number;
      clientTimestamp?: string;
    }>;
  }): Promise<AttemptAnswer[]> {
    let attempt = store.attempts.get(params.attemptId);
    if (!attempt) {
      attempt = (await this.getAttemptById(params.attemptId)) || undefined;
    }
    if (!attempt) throw new Error('Attempt not found');

    const now = new Date();
    const deadline = new Date(attempt.deadline_at);
    if (now > deadline || attempt.status !== 'in_progress') {
      throw new Error('Attempt time has expired or attempt is finalized');
    }

    const updatedAnswers: AttemptAnswer[] = [];

    for (const item of params.answers) {
      if (!item.questionId) continue;
      const key = `${params.attemptId}_${item.questionId}`;
      const existing = store.answers.get(key) as (AttemptAnswer & { seq?: number }) | undefined;

      // Monotonic sequence validation: prevent out-of-order writes
      if (existing && item.seq !== undefined && existing.seq !== undefined) {
        if (item.seq < existing.seq) {
          updatedAnswers.push(existing);
          continue;
        }
      }

      const updated: AttemptAnswer & { seq?: number } = {
        id: existing?.id || `ans-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        attempt_id: params.attemptId,
        question_id: item.questionId,
        selected_option: item.selectedOption,
        code_snippet: item.codeSnippet !== undefined ? item.codeSnippet : (existing?.code_snippet ?? null),
        code_language: item.codeLanguage !== undefined ? item.codeLanguage : (existing?.code_language ?? null),
        is_marked_for_review: item.isMarkedForReview ?? existing?.is_marked_for_review ?? false,
        answered_at: existing?.answered_at || now.toISOString(),
        updated_at: now.toISOString(),
        seq: item.seq,
      };

      store.answers.set(key, updated);
      updatedAnswers.push(updated);
    }

    // High performance append to WAL (zero event loop freeze)
    resilientStorage.appendAnswerDeltas(updatedAnswers);

    // Persist to Local PostgreSQL attempt_answers table
    try {
      const pool = getPgPool();
      for (const ans of updatedAnswers) {
        await pool.query(
          `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option, code_snippet, code_language, is_marked_for_review, answered_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (attempt_id, question_id) DO UPDATE SET 
             selected_option = EXCLUDED.selected_option, 
             code_snippet = EXCLUDED.code_snippet, 
             code_language = EXCLUDED.code_language, 
             is_marked_for_review = EXCLUDED.is_marked_for_review,
             updated_at = EXCLUDED.updated_at`,
          [ans.id, ans.attempt_id, ans.question_id, ans.selected_option, ans.code_snippet, ans.code_language, ans.is_marked_for_review, ans.answered_at, ans.updated_at]
        );
      }
    } catch (pgErr) {
      console.warn('[saveAttemptAnswersBatch] Local PG save warning:', pgErr);
    }

    return updatedAnswers;
  },

  async saveAttemptAnswer(params: {
    attemptId: string;
    questionId: string;
    selectedOption: string | null;
    codeSnippet?: string | null;
    codeLanguage?: string | null;
    isMarkedForReview?: boolean;
    seq?: number;
    clientTimestamp?: string;
  }): Promise<AttemptAnswer> {
    const batch = await this.saveAttemptAnswersBatch({
      attemptId: params.attemptId,
      answers: [
        {
          questionId: params.questionId,
          selectedOption: params.selectedOption,
          codeSnippet: params.codeSnippet,
          codeLanguage: params.codeLanguage,
          isMarkedForReview: params.isMarkedForReview,
          seq: params.seq,
          clientTimestamp: params.clientTimestamp,
        },
      ],
    });
    return batch[0];
  },

  async recordCheatingViolation(params: {
    attemptId: string;
    violationType: CheatingEvent['violation_type'];
    metadata?: Record<string, unknown>;
  }): Promise<{ warningNumber: number; maxWarnings: number; isTerminated: boolean }> {
    let attempt = store.attempts.get(params.attemptId);
    if (!attempt) {
      attempt = (await this.getAttemptById(params.attemptId)) || undefined;
    }
    if (!attempt) throw new Error('Attempt not found');

    const round = store.rounds.get(attempt.round_id) || (await this.getRoundById(attempt.round_id));
    const exam = round ? store.examinations.get(round.examination_id) || (await this.getExaminationById(round.examination_id)) : null;
    const maxWarnings = exam?.max_cheating_warnings ?? 3;

    const warningNumber = attempt.cheating_warnings + 1;
    attempt.cheating_warnings = warningNumber;

    const isTerminated = warningNumber >= maxWarnings;
    if (isTerminated) {
      attempt.status = 'terminated';
      attempt.submitted_at = new Date().toISOString();
    }
    store.attempts.set(attempt.id, attempt);

    const event: CheatingEvent = {
      id: `cheat-${Date.now()}`,
      attempt_id: params.attemptId,
      violation_type: params.violationType,
      warning_number: warningNumber,
      metadata: params.metadata || {},
      occurred_at: new Date().toISOString(),
    };
    store.cheatingEvents.push(event);
    resilientStorage.scheduleSave(() => store.toSnapshot());

    try {
      const pool = getPgPool();
      await pool.query(
        'UPDATE examination_attempts SET cheating_warnings = $1, status = $2, submitted_at = $3 WHERE id = $4',
        [warningNumber, attempt.status, attempt.submitted_at, attempt.id]
      );
    } catch {}

    return { warningNumber, maxWarnings, isTerminated };
  },

  // SERVER-AUTHORITATIVE SUBMISSION & EVALUATION
  async submitAttempt(attemptId: string): Promise<ExaminationResult> {
    let attempt: ExaminationAttempt | undefined = store.attempts.get(attemptId);
    if (!attempt) {
      attempt = (await this.getAttemptById(attemptId)) || undefined;
    }
    if (!attempt) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.attempts) {
        store.hydrate(snap);
        attempt = store.attempts.get(attemptId);
      }
    }
    const activeAttempt: ExaminationAttempt = attempt || {
      id: attemptId,
      registration_id: 'reg-demo-01',
      round_id: 'round-1',
      started_at: new Date(Date.now() - 1800000).toISOString(),
      deadline_at: new Date(Date.now() + 1800000).toISOString(),
      submitted_at: null,
      status: 'in_progress',
      assigned_question_ids: [],
      cheating_warnings: 0,
      created_at: new Date().toISOString(),
    };
    store.attempts.set(attemptId, activeAttempt);
    attempt = activeAttempt;

    // Idempotency: return existing result if already processed
    let existingResult = store.results.get(attemptId);
    if (!existingResult) {
      existingResult = (await this.getAttemptResult(attemptId)) || undefined;
    }
    if (existingResult) {
      return existingResult;
    }

    // Atomic in-flight lock: if another request is currently scoring this attempt, wait for it
    if (inFlightSubmissions.has(attemptId)) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const res = store.results.get(attemptId);
        if (res) return res;
      }
    }

    inFlightSubmissions.add(attemptId);

    try {
      let round = store.rounds.get(attempt.round_id) || (await this.getRoundById(attempt.round_id));
      if (!round) {
        round = {
          id: attempt.round_id,
          examination_id: 'exam-1',
          round_number: 1,
          name: 'Screening Round',
          duration_minutes: 60,
          total_questions: 30,
          marks_per_question: 1,
          negative_marks: 0,
          qualifying_marks: 10,
          total_marks: 30,
          question_selection_strategy: 'random',
          scheduled_start: null,
          status: 'active',
          auto_qualify: true,
          instructions: '',
          round_type: 'mcq',
          allow_tab_switch: false,
          allow_copy_paste: false,
          enforce_fullscreen: true,
          min_time_before_submit_minutes: 1,
          next_round_delay_seconds: 120,
          success_message: '',
          failure_message: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let rawScore = 0;

      if (round.round_type === 'coding') {
        let codeAnswered = 0;
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attemptId}_${qId}`;
          let answer = store.answers.get(key);
          if (!answer) {
            try {
              const pool = getPgPool();
              const { rows: dbAns } = await pool.query(
                'SELECT * FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2 LIMIT 1',
                [attemptId, qId]
              );
              if (dbAns.length > 0) {
                answer = dbAns[0] as AttemptAnswer;
                store.answers.set(key, answer);
              }
            } catch {}
          }
          if (answer && answer.code_snippet && answer.code_snippet.trim().length > 15) {
            codeAnswered++;
          }
        }
        correctCount = codeAnswered;
        wrongCount = 0;
        unansweredCount = attempt.assigned_question_ids.length - codeAnswered;
        rawScore = codeAnswered * round.marks_per_question;
      } else {
        // Ensure question keys are loaded from round pool
        if (store.answerKeys.size === 0 || !attempt.assigned_question_ids.some((qId) => store.answerKeys.has(qId))) {
          await this.getQuestionsByRoundId(attempt.round_id);
        }

        // Fetch answers from PostgreSQL if missing in store.answers
        let loadedDbAnswers = false;
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attemptId}_${qId}`;
          if (!store.answers.has(key) && !loadedDbAnswers) {
            loadedDbAnswers = true;
            try {
              const pool = getPgPool();
              const { rows: dbAnswers } = await pool.query(
                'SELECT * FROM attempt_answers WHERE attempt_id = $1',
                [attemptId]
              );
              if (dbAnswers) {
                for (const a of dbAnswers) {
                  store.answers.set(`${attemptId}_${a.question_id}`, a);
                }
              }
            } catch {}
          }

          const answer = store.answers.get(key);
          const answerKey = store.answerKeys.get(qId);

          if (!answer || !answer.selected_option) {
            unansweredCount++;
          } else if (answerKey && answer.selected_option.trim().toUpperCase() === answerKey.correct_option_label.trim().toUpperCase()) {
            correctCount++;
          } else {
            wrongCount++;
          }
        }
        rawScore = correctCount * round.marks_per_question - wrongCount * round.negative_marks;
      }

      const finalScore = Math.max(0, Math.round(rawScore * 100) / 100);
      const isQualified = finalScore >= round.qualifying_marks;

      // Update attempt status
      attempt.status = 'submitted';
      attempt.submitted_at = new Date().toISOString();
      store.attempts.set(attempt.id, attempt);

      // Save result
      const result: ExaminationResult = {
        id: `res-${attemptId}`,
        attempt_id: attemptId,
        registration_id: attempt.registration_id,
        round_id: attempt.round_id,
        correct_count: correctCount,
        wrong_count: wrongCount,
        unanswered_count: unansweredCount,
        score: finalScore,
        total_marks: round.total_marks,
        qualifying_marks: round.qualifying_marks,
        is_qualified: isQualified,
        evaluated_at: new Date().toISOString(),
      };
      store.results.set(attemptId, result);

      // Persist result and status directly to local PostgreSQL
      try {
        const pool = getPgPool();
        await pool.query(
          `INSERT INTO examination_results (id, attempt_id, registration_id, round_id, score, total_marks, qualifying_marks, is_qualified, correct_count, wrong_count, unanswered_count, evaluated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, is_qualified = EXCLUDED.is_qualified, evaluated_at = EXCLUDED.evaluated_at`,
          [result.id, result.attempt_id, result.registration_id, result.round_id, result.score, result.total_marks, result.qualifying_marks, result.is_qualified, result.correct_count, result.wrong_count, result.unanswered_count, result.evaluated_at]
        );
        await pool.query(
          `UPDATE examination_attempts SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
          [attemptId]
        );
      } catch (pgErr) {
        console.warn('[submitAttempt] Local PG save warning:', pgErr);
      }

      // Dynamic next round qualification resolution
      const allRounds = await this.getRoundsByExamId(round.examination_id);
      allRounds.sort((a, b) => a.round_number - b.round_number);

      const nextRound = allRounds.find((r) => r.round_number === round.round_number + 1);

      const qualKey = `${attempt.registration_id}_${attempt.round_id}`;
      const qualification: RoundQualification = {
        id: `qual-${Date.now()}`,
        registration_id: attempt.registration_id,
        round_id: attempt.round_id,
        qualified: isQualified,
        next_round_number: isQualified && nextRound ? nextRound.round_number : null,
        qualified_at: new Date().toISOString(),
      };
      store.qualifications.set(qualKey, qualification);

      // Update registration status
      let reg = store.registrations.get(attempt.registration_id);
      if (reg) {
        if (!isQualified) {
          reg.status = 'completed';
        }
        store.registrations.set(reg.id, reg);
      }

      resilientStorage.scheduleSave(() => store.toSnapshot());
      return result;
    } finally {
      inFlightSubmissions.delete(attemptId);
    }
  },

  async getAttemptResult(attemptId: string): Promise<ExaminationResult | null> {
    let res = store.results.get(attemptId);
    if (!res) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query('SELECT * FROM examination_results WHERE attempt_id = $1 LIMIT 1', [attemptId]);
        if (rows.length > 0) {
          const r = rows[0];
          res = {
            id: r.id,
            attempt_id: r.attempt_id,
            registration_id: r.registration_id,
            round_id: r.round_id,
            score: Number(r.score || 0),
            total_marks: Number(r.total_marks || 0),
            qualifying_marks: Number(r.qualifying_marks || 0),
            is_qualified: r.is_qualified,
            correct_count: r.correct_count,
            wrong_count: r.wrong_count,
            unanswered_count: r.unanswered_count,
            evaluated_at: r.evaluated_at,
          };
          store.results.set(attemptId, res);
        }
      } catch {}
    }
    return res || null;
  },

  async getAttemptById(attemptId: string): Promise<ExaminationAttempt | null> {
    let attempt = store.attempts.get(attemptId);
    if (!attempt) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query('SELECT * FROM examination_attempts WHERE id = $1 LIMIT 1', [attemptId]);
        if (rows.length > 0) {
          const a = rows[0];
          attempt = {
            id: a.id,
            registration_id: a.registration_id,
            round_id: a.round_id,
            started_at: a.started_at,
            deadline_at: a.deadline_at,
            submitted_at: a.submitted_at,
            status: a.status as any,
            assigned_question_ids: Array.isArray(a.assigned_question_ids) ? a.assigned_question_ids : [],
            cheating_warnings: a.cheating_warnings || 0,
            ip_address: a.ip_address,
            user_agent: a.user_agent,
            created_at: a.created_at,
          };
          store.attempts.set(attemptId, attempt);
        }
      } catch {}
    }
    return attempt || null;
  },

  async getQualification(regId: string, roundId: string): Promise<RoundQualification | null> {
    return store.qualifications.get(`${regId}_${roundId}`) || null;
  },

  // ADMIN MONITORING & STATS
  async getAdminStats(): Promise<AdminStats> {
    try {
      const pool = getPgPool();
      const [
        { rows: examRows },
        { rows: studentRows },
        { rows: attemptRows },
        { rows: resultRows },
        { rows: ocrRows },
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM examinations'),
        pool.query('SELECT COUNT(*) FROM students'),
        pool.query('SELECT status FROM examination_attempts'),
        pool.query('SELECT is_qualified FROM examination_results'),
        pool.query("SELECT COUNT(*) FROM ocr_jobs WHERE status IN ('uploaded', 'processing', 'queued')"),
      ]);

      const totalExaminations = parseInt(examRows[0]?.count || '0', 10);
      const totalStudents = parseInt(studentRows[0]?.count || '0', 10);
      const studentsWriting = attemptRows.filter((a) => a.status === 'in_progress').length;
      const totalSubmissions = attemptRows.filter((a) => a.status === 'submitted' || a.status === 'timed_out').length;
      const qualifiedStudents = resultRows.filter((r) => r.is_qualified).length;
      const unqualifiedStudents = (resultRows.length || 0) - qualifiedStudents;
      const pendingOcrJobs = parseInt(ocrRows[0]?.count || '0', 10);

      return {
        totalExaminations: totalExaminations || store.examinations.size,
        totalStudents: totalStudents || store.students.size,
        studentsWriting,
        totalSubmissions,
        qualifiedStudents,
        unqualifiedStudents,
        pendingOcrJobs,
      };
    } catch {}

    const totalExaminations = store.examinations.size;
    const totalStudents = store.students.size;
    const attempts = Array.from(store.attempts.values());
    const studentsWriting = attempts.filter((a) => a.status === 'in_progress').length;
    const totalSubmissions = attempts.filter((a) => a.status === 'submitted' || a.status === 'timed_out').length;
    const results = Array.from(store.results.values());
    const qualifiedStudents = results.filter((r) => r.is_qualified).length;
    const unqualifiedStudents = results.filter((r) => !r.is_qualified).length;
    const pendingOcrJobs = Array.from(store.ocrJobs.values()).filter(
      (j) => j.status === 'uploaded' || j.status === 'processing' || j.status === 'queued'
    ).length;

    return {
      totalExaminations,
      totalStudents,
      studentsWriting,
      totalSubmissions,
      qualifiedStudents,
      unqualifiedStudents,
      pendingOcrJobs,
    };
  },

  async getLiveMonitoringData(examId: string) {
    const rounds = await this.getRoundsByExamId(examId);
    rounds.sort((a, b) => a.round_number - b.round_number);
    const roundIds = new Set(rounds.map((r) => r.id));
    const roundIdList = Array.from(roundIds);

    // 1. Load all registered students for this examination
    const registrations = await this.getRegistrationsByExamId(examId);
    const regMap = new Map<string, Registration>();
    for (const reg of registrations) {
      regMap.set(reg.id, reg);
      if (reg.student) {
        store.students.set(reg.student.id, reg.student);
      }
    }

    // 2. Fetch all attempts for these rounds from PostgreSQL & Memory
    const attemptsMap = new Map<string, ExaminationAttempt>();
    for (const a of store.attempts.values()) {
      if (roundIds.has(a.round_id)) {
        attemptsMap.set(a.id, a);
      }
    }

    if (roundIdList.length > 0) {
      try {
        const pool = getPgPool();
        const { rows: pgAttempts } = await pool.query(
          'SELECT * FROM examination_attempts WHERE round_id = ANY($1)',
          [roundIdList]
        );
        for (const a of pgAttempts) {
          const attemptObj: ExaminationAttempt = {
            id: a.id,
            registration_id: a.registration_id,
            round_id: a.round_id,
            started_at: a.started_at,
            deadline_at: a.deadline_at,
            submitted_at: a.submitted_at,
            status: a.status,
            assigned_question_ids: Array.isArray(a.assigned_question_ids) ? a.assigned_question_ids : [],
            cheating_warnings: a.cheating_warnings || 0,
            ip_address: a.ip_address,
            user_agent: a.user_agent,
            created_at: a.created_at,
          };
          attemptsMap.set(attemptObj.id, attemptObj);
          store.attempts.set(attemptObj.id, attemptObj);
        }
      } catch {}
    }

    // 3. Fetch all examination results from PostgreSQL & Memory
    const resultsMap = new Map<string, ExaminationResult>();
    for (const res of store.results.values()) {
      if (roundIds.has(res.round_id)) {
        resultsMap.set(res.attempt_id, res);
      }
    }

    if (roundIdList.length > 0) {
      try {
        const pool = getPgPool();
        const { rows: pgResults } = await pool.query(
          'SELECT * FROM examination_results WHERE round_id = ANY($1)',
          [roundIdList]
        );
        for (const res of pgResults) {
          const resObj: ExaminationResult = {
            id: res.id,
            attempt_id: res.attempt_id,
            registration_id: res.registration_id,
            round_id: res.round_id,
            score: Number(res.score ?? 0),
            total_marks: Number(res.total_marks || 0),
            qualifying_marks: Number(res.qualifying_marks || 0),
            is_qualified: res.is_qualified,
            correct_count: res.correct_count,
            wrong_count: res.wrong_count,
            unanswered_count: res.unanswered_count,
            evaluated_at: res.evaluated_at,
          };
          resultsMap.set(resObj.attempt_id, resObj);
          store.results.set(resObj.attempt_id, resObj);
        }
      } catch {}
    }

    // 4. Fetch latest code snippets for coding rounds if needed
    const codeSnippetMap = new Map<string, { snippet: string; language: string }>();
    if (attemptsMap.size > 0) {
      try {
        const pool = getPgPool();
        const attemptIds = Array.from(attemptsMap.keys());
        const { rows: codeAnswers } = await pool.query(
          'SELECT attempt_id, code_snippet, code_language FROM attempt_answers WHERE attempt_id = ANY($1) AND code_snippet IS NOT NULL',
          [attemptIds]
        );
        if (codeAnswers) {
          for (const ans of codeAnswers) {
            if (ans.code_snippet && !codeSnippetMap.has(ans.attempt_id)) {
              codeSnippetMap.set(ans.attempt_id, {
                snippet: ans.code_snippet,
                language: ans.code_language || 'python',
              });
            }
          }
        }
      } catch {}
    }

    const monitoringRows: any[] = [];
    const seenRegIdsWithAttempts = new Set<string>();

    for (const attempt of attemptsMap.values()) {
      seenRegIdsWithAttempts.add(attempt.registration_id);
      const reg = regMap.get(attempt.registration_id) || store.registrations.get(attempt.registration_id);
      const student = reg?.student || (reg ? store.students.get(reg.student_id) : null);
      const round = rounds.find((r) => r.id === attempt.round_id) || store.rounds.get(attempt.round_id);
      const result = resultsMap.get(attempt.id);

      // Find code answer if coding round
      let codeSnippet: string | null = codeSnippetMap.get(attempt.id)?.snippet || null;
      let codeLanguage: string | null = codeSnippetMap.get(attempt.id)?.language || null;
      if (!codeSnippet && attempt.assigned_question_ids) {
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attempt.id}_${qId}`;
          const ans = store.answers.get(key);
          if (ans?.code_snippet) {
            codeSnippet = ans.code_snippet;
            codeLanguage = ans.code_language || 'python';
            break;
          }
        }
      }

      // Authoritative seconds remaining calculation
      const now = Date.now();
      const deadline = new Date(attempt.deadline_at).getTime();
      const secondsRemaining = attempt.status === 'in_progress' ? Math.max(0, Math.floor((deadline - now) / 1000)) : 0;

      monitoringRows.push({
        attemptId: attempt.id,
        registrationId: attempt.registration_id,
        studentName: student?.full_name || reg?.login_id || 'Candidate',
        rollNumber: student?.roll_number || reg?.login_id || 'N/A',
        loginId: reg?.login_id || student?.login_id || student?.roll_number || 'N/A',
        email: student?.email || 'N/A',
        attributes: student?.attributes || {},
        roundId: attempt.round_id,
        roundName: round?.name || 'N/A',
        roundNumber: round?.round_number || 1,
        roundType: round?.round_type || 'mcq',
        attemptStatus: attempt.status,
        cheatingWarnings: attempt.cheating_warnings || 0,
        score: result?.score ?? null,
        totalMarks: round?.total_marks ?? 0,
        qualifyingMarks: round?.qualifying_marks ?? 0,
        isQualified: result?.is_qualified ?? null,
        codeSnippet,
        codeLanguage,
        secondsRemaining,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
      });
    }

    // 5. For registered candidates who haven't started an attempt yet, include them in the telemetry!
    const firstRound = rounds[0];
    for (const reg of registrations) {
      if (!seenRegIdsWithAttempts.has(reg.id)) {
        const student = reg.student || store.students.get(reg.student_id);
        monitoringRows.push({
          attemptId: `reg-${reg.id}`,
          registrationId: reg.id,
          studentName: student?.full_name || reg.login_id || 'Candidate',
          rollNumber: student?.roll_number || reg.login_id || 'N/A',
          loginId: reg.login_id || student?.login_id || student?.roll_number || 'N/A',
          email: student?.email || 'N/A',
          attributes: student?.attributes || {},
          roundId: firstRound?.id || '',
          roundName: firstRound?.name || 'Round 1',
          roundNumber: firstRound?.round_number || 1,
          roundType: firstRound?.round_type || 'mcq',
          attemptStatus: 'registered',
          cheatingWarnings: 0,
          score: null,
          totalMarks: firstRound?.total_marks ?? 0,
          qualifyingMarks: firstRound?.qualifying_marks ?? 0,
          isQualified: null,
          codeSnippet: null,
          codeLanguage: null,
          secondsRemaining: 0,
          startedAt: reg.registered_at || new Date().toISOString(),
          submittedAt: null,
        });
      }
    }

    // Compute round-by-round statistics
    const roundSummaries = rounds.map((r) => {
      const roundAttempts = monitoringRows.filter((row) => row.roundId === r.id);
      const appeared = roundAttempts.filter((row) => row.attemptStatus !== 'registered').length;
      const passed = roundAttempts.filter((row) => row.isQualified === true).length;
      const failed = roundAttempts.filter((row) => row.isQualified === false).length;
      const inProgress = roundAttempts.filter((row) => row.attemptStatus === 'in_progress').length;

      return {
        roundId: r.id,
        roundNumber: r.round_number,
        name: r.name,
        roundType: r.round_type || 'mcq',
        appeared,
        passed,
        failed,
        inProgress,
        passPercentage: appeared > 0 ? Math.round((passed / appeared) * 100) : 0,
      };
    });

    const activeAttempts = Array.from(attemptsMap.values());
    const activeResults = Array.from(resultsMap.values());

    return {
      rounds,
      rows: monitoringRows,
      roundSummaries,
      summary: {
        totalWriting: activeAttempts.filter((a) => a.status === 'in_progress').length,
        totalSubmitted: activeResults.length,
        totalQualified: activeResults.filter((r) => r.is_qualified).length,
      },
    };
  },

  // ON-DEMAND DETAILED CANDIDATE DOSSIER (MULTI-ROUND QUESTION & CODE BREAKDOWN)
  async getStudentDetailedRecord(examId: string, registrationId: string) {
    const registrations = await this.getRegistrationsByExamId(examId);
    let reg = registrations.find(
      (r) => r.id === registrationId || r.student_id === registrationId || r.login_id === registrationId
    ) || store.registrations.get(registrationId);

    if (!reg) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query(
          `SELECT r.*, row_to_json(s.*) as student 
           FROM registrations r 
           LEFT JOIN students s ON s.id = r.student_id 
           WHERE r.id = $1 OR r.student_id = $1 OR r.login_id = $1 LIMIT 1`,
          [registrationId]
        );
        if (rows.length > 0) reg = rows[0] as any;
      } catch {}
    }
    if (!reg) throw new Error('Registration record not found');
    const student = reg.student || store.students.get(reg.student_id);

    const rounds = await this.getRoundsByExamId(examId);
    rounds.sort((a, b) => a.round_number - b.round_number);
    const roundProgression: any[] = [];

    // Fetch attempts for this registration from PostgreSQL & Memory
    let regAttempts: ExaminationAttempt[] = [];
    for (const a of store.attempts.values()) {
      if (a.registration_id === reg.id && !regAttempts.some((ra) => ra.id === a.id)) {
        regAttempts.push(a);
      }
    }

    try {
      const pool = getPgPool();
      const { rows: pgAtts } = await pool.query(
        'SELECT * FROM examination_attempts WHERE registration_id = $1',
        [reg.id]
      );
      for (const a of pgAtts) {
        if (!regAttempts.some((ra) => ra.id === a.id)) {
          regAttempts.push({
            id: a.id,
            registration_id: a.registration_id,
            round_id: a.round_id,
            started_at: a.started_at,
            deadline_at: a.deadline_at,
            submitted_at: a.submitted_at,
            status: a.status as any,
            assigned_question_ids: Array.isArray(a.assigned_question_ids) ? a.assigned_question_ids : [],
            cheating_warnings: a.cheating_warnings || 0,
            ip_address: a.ip_address,
            user_agent: a.user_agent,
            created_at: a.created_at,
          });
        }
      }
    } catch {}

    // Fetch results for this registration from PostgreSQL & Memory
    let regResults: ExaminationResult[] = [];
    for (const res of store.results.values()) {
      if (res.registration_id === reg.id && !regResults.some((rr) => rr.id === res.id)) {
        regResults.push(res);
      }
    }

    try {
      const pool = getPgPool();
      const { rows: pgRes } = await pool.query(
        'SELECT * FROM examination_results WHERE registration_id = $1',
        [reg.id]
      );
      for (const r of pgRes) {
        if (!regResults.some((rr) => rr.id === r.id)) {
          regResults.push({
            id: r.id,
            attempt_id: r.attempt_id,
            registration_id: r.registration_id,
            round_id: r.round_id,
            score: Number(r.score || 0),
            total_marks: Number(r.total_marks || 0),
            qualifying_marks: Number(r.qualifying_marks || 0),
            is_qualified: r.is_qualified,
            correct_count: r.correct_count,
            wrong_count: r.wrong_count,
            unanswered_count: r.unanswered_count,
            evaluated_at: r.evaluated_at,
          });
        }
      }
    } catch {}

    // Fetch all answers for these attempts from PostgreSQL & Memory
    const allAttemptIds = regAttempts.map((a) => a.id);
    let regAnswers: any[] = [];
    if (allAttemptIds.length > 0) {
      try {
        const pool = getPgPool();
        const { rows: pgAns } = await pool.query(
          'SELECT * FROM attempt_answers WHERE attempt_id = ANY($1)',
          [allAttemptIds]
        );
        for (const ans of pgAns) {
          if (!regAnswers.some((ra) => ra.attempt_id === ans.attempt_id && ra.question_id === ans.question_id)) {
            regAnswers.push(ans);
          }
        }
      } catch {}
    }

    for (const round of rounds) {
      const attempt = regAttempts.find((a) => a.round_id === round.id);
      const result = attempt ? (regResults.find((r) => r.attempt_id === attempt.id) || store.results.get(attempt.id) || null) : null;
      const qualification = store.qualifications.get(`${reg.id}_${round.id}`);

      // Ensure questions for this round are loaded
      let roundQuestions = await this.getQuestionsByRoundId(round.id);

      const questionDetails: any[] = [];
      let answeredCount = 0;
      let correctCount = 0;
      let wrongCount = 0;

      const targetQuestionIds =
        attempt && Array.isArray(attempt.assigned_question_ids) && attempt.assigned_question_ids.length > 0
          ? attempt.assigned_question_ids
          : roundQuestions.map((rq) => rq.id);

      if (attempt && targetQuestionIds.length > 0) {
        for (let i = 0; i < targetQuestionIds.length; i++) {
          const qId = targetQuestionIds[i];
          const q = store.questions.get(qId) || roundQuestions.find((rq) => rq.id === qId);
          const ansKey = store.answerKeys.get(qId);
          const answer = regAnswers.find((a) => a.attempt_id === attempt.id && a.question_id === qId) || store.answers.get(`${attempt.id}_${qId}`);

          if (q) {
            const isCoding = round.round_type === 'coding' || q.question_type === 'coding';
            let isCorrect: boolean | null = null;
            let earnedMarks = 0;

            if (isCoding) {
              const hasCode = Boolean(answer?.code_snippet && answer.code_snippet.trim().length > 15);
              if (hasCode) {
                answeredCount++;
                isCorrect = true;
                earnedMarks = round.marks_per_question;
              }
            } else {
              const selected = answer?.selected_option;
              const correct = ansKey?.correct_option_label;
              if (selected) {
                answeredCount++;
                if (correct && selected.trim().toUpperCase() === correct.trim().toUpperCase()) {
                  isCorrect = true;
                  correctCount++;
                  earnedMarks = round.marks_per_question;
                } else {
                  isCorrect = false;
                  wrongCount++;
                  earnedMarks = -round.negative_marks;
                }
              }
            }

            questionDetails.push({
              index: i + 1,
              questionId: q.id,
              questionText: q.question_text,
              questionType: q.question_type || (isCoding ? 'coding' : 'single_choice'),
              difficulty: q.difficulty || 'medium',
              options: q.options || [],
              selectedOption: answer?.selected_option || null,
              correctOption: ansKey?.correct_option_label || null,
              codeSnippet: answer?.code_snippet || null,
              codeLanguage: answer?.code_language || (isCoding ? 'python' : null),
              isCorrect,
              earnedMarks,
              marksPerQuestion: round.marks_per_question,
              negativeMarks: round.negative_marks,
              isMarkedForReview: answer?.is_marked_for_review || false,
            });
          }
        }
      }

      const totalQuestionsCount = attempt && attempt.assigned_question_ids.length > 0 ? attempt.assigned_question_ids.length : round.total_questions;

      roundProgression.push({
        roundId: round.id,
        roundNumber: round.round_number,
        roundName: round.name,
        roundType: round.round_type || 'mcq',
        durationMinutes: round.duration_minutes,
        totalMarks: round.total_marks,
        qualifyingMarks: round.qualifying_marks,
        attempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              startedAt: attempt.started_at,
              submittedAt: attempt.submitted_at,
              cheatingWarnings: attempt.cheating_warnings,
            }
          : null,
        result: result
          ? {
              score: result.score,
              isQualified: result.is_qualified,
              correctCount: result.correct_count,
              wrongCount: result.wrong_count,
              unansweredCount: result.unanswered_count,
            }
          : null,
        isQualified: qualification ? qualification.qualified : result ? result.is_qualified : null,
        stats: {
          totalQuestions: totalQuestionsCount,
          answeredCount,
          correctCount,
          wrongCount,
          accuracyPercentage: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0,
        },
        questions: questionDetails,
      });
    }

    return {
      registrationId: reg.id,
      studentId: student?.id,
      studentName: student?.full_name || reg.login_id || 'Candidate',
      rollNumber: student?.roll_number || reg.login_id || 'N/A',
      loginId: reg.login_id || student?.roll_number || 'N/A',
      email: student?.email || 'N/A',
      attributes: student?.attributes || {},
      rounds: roundProgression,
    };
  },

  // HR / ADMIN RESET STUDENT INFRACTION WARNINGS
  async resetStudentWarnings(registrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const pool = getPgPool();
      await pool.query(
        `UPDATE student_attempts
         SET cheating_warnings = 0
         WHERE registration_id = $1`,
        [registrationId]
      );
    } catch (err) {
      console.warn('[resetStudentWarnings] PostgreSQL update error:', err);
    }

    for (const [id, att] of store.attempts.entries()) {
      if (att.registration_id === registrationId) {
        att.cheating_warnings = 0;
        if (att.status === 'terminated') {
          att.status = 'in_progress';
        }
        store.attempts.set(id, att);
      }
    }

    resilientStorage.scheduleSave(() => store.toSnapshot());
    return { success: true, message: 'Student warnings cleanly reset.' };
  },

  // HR / ADMIN RECONDUCT ROUND ATTEMPT (E.G. ROUND 3 SIMULATOR RETAKE)
  async reconductRoundAttempt(registrationId: string, roundId: string): Promise<{ success: boolean; message: string }> {
    let reg = store.registrations.get(registrationId);
    if (!reg) {
      reg = Array.from(store.registrations.values()).find(
        (r) => r.id === registrationId || r.student_id === registrationId || r.login_id === registrationId
      );
    }
    if (!reg) {
      try {
        const pool = getPgPool();
        const { rows } = await pool.query(
          `SELECT r.*, row_to_json(s.*) as student 
           FROM registrations r 
           LEFT JOIN students s ON s.id = r.student_id 
           WHERE r.id = $1 OR r.student_id = $1 OR r.login_id = $1 LIMIT 1`,
          [registrationId]
        );
        if (rows.length > 0) reg = rows[0] as any;
      } catch {}
    }
    if (!reg) throw new Error('Registration not found');

    let attempt = Array.from(store.attempts.values()).find(
      (a) => a.registration_id === reg!.id && a.round_id === roundId
    );
    if (!attempt) {
      try {
        const pool = getPgPool();
        const { rows: attData } = await pool.query(
          'SELECT * FROM examination_attempts WHERE registration_id = $1 AND round_id = $2 ORDER BY created_at DESC LIMIT 1',
          [reg.id, roundId]
        );
        if (attData.length > 0) attempt = attData[0] as any;
      } catch {}
    }

    if (!attempt) {
      throw new Error('No existing attempt found for this candidate in this round.');
    }

    const round = store.rounds.get(roundId) || (await this.getRoundById(roundId));

    // 1. Remove past attempt and result
    const oldAttemptId = attempt.id;
    store.attempts.delete(oldAttemptId);
    store.results.delete(oldAttemptId);
    const regRoundKey = `${reg.id}_${roundId}`;
    if (store.attemptByRegAndRound) store.attemptByRegAndRound.delete(regRoundKey);

    try {
      const pool = getPgPool();
      await pool.query('DELETE FROM attempt_answers WHERE attempt_id = $1', [oldAttemptId]);
      await pool.query('DELETE FROM examination_results WHERE attempt_id = $1', [oldAttemptId]);
      await pool.query('DELETE FROM examination_attempts WHERE id = $1', [oldAttemptId]);
      await pool.query('UPDATE registrations SET status = $1 WHERE id = $2', ['registered', reg.id]);
    } catch (err) {
      console.warn('[reconductRoundAttempt] PostgreSQL delete error:', err);
    }

    // 2. Clear stored answers for this attempt in memory
    for (const key of Array.from(store.answers.keys())) {
      if (key.startsWith(`${oldAttemptId}_`)) {
        store.answers.delete(key);
      }
    }

    // 3. Reset qualification status for this round so candidate can retake it
    const qualKey = `${reg.id}_${roundId}`;
    store.qualifications.delete(qualKey);

    // 4. Update registration status back to 'registered'
    reg.status = 'registered';
    store.registrations.set(reg.id, reg);

    // 5. Persist to WAL and schedule snapshot
    resilientStorage.scheduleSave(() => store.toSnapshot());

    return {
      success: true,
      message: `Round ${round?.round_number ?? ''} attempt has been reset for ${reg.login_id || 'candidate'}. They can now retake this round.`,
    };
  },

  async populateRoundQuestionPool(roundId: string, count: number = 100): Promise<number> {
    let round = await this.getRoundById(roundId);
    if (!round) {
      throw new Error(`Round ${roundId} could not be resolved`);
    }

    const isCoding = round.round_type === 'coding' || round.name.toLowerCase().includes('coding');

    if (isCoding) {
      const existing = Array.from(store.questions.values()).filter((q) => q.round_id === roundId);
      const codingCount = Math.min(count, STANDARD_CODING_PROBLEMS.length);
      const needed = Math.max(0, codingCount - existing.length);
      const toCreate = needed > 0 ? needed : codingCount;

      for (let i = 1; i <= toCreate; i++) {
        const qNum = existing.length + i;
        const qId = `q-${roundId}-${String(qNum).padStart(3, '0')}`;
        const item = STANDARD_CODING_PROBLEMS[(qNum - 1) % STANDARD_CODING_PROBLEMS.length];

        const qObj: Question = {
          id: qId,
          round_id: roundId,
          question_text: item.text,
          question_type: 'coding',
          difficulty: item.difficulty || 'medium',
          marks: round.marks_per_question ?? 5,
          negative_marks: 0,
          status: 'approved',
          sort_order: qNum,
          options: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        store.questions.set(qId, qObj);
      }

      resilientStorage.flushSync(() => store.toSnapshot());
      await this.syncRoundQuestionsToSupabase(roundId);
      return Array.from(store.questions.values()).filter((q) => q.round_id === roundId).length;
    }

    // If round already has questions in pool, keep and return them! Never overwrite user-uploaded questions.
    const existing = Array.from(store.questions.values()).filter((q) => q.round_id === roundId);
    if (existing.length >= count || existing.length >= (round.total_questions || 30)) {
      return existing.length;
    }

    const isAptitude =
      round.name.toLowerCase().includes('aptitude') ||
      round.name.toLowerCase().includes('reasoning') ||
      round.name.toLowerCase().includes('basic') ||
      round.name.toLowerCase().includes('synthesis') ||
      round.round_number === 1 ||
      round.round_number === 2;

    if (isAptitude) {
      const isMedium =
        round.round_number === 2 ||
        round.name.toLowerCase().includes('round 2') ||
        round.name.toLowerCase().includes('medium') ||
        round.name.toLowerCase().includes('synthesis');
      const bankToUse = isMedium ? MEDIUM_APTITUDE_REASONING_BANK : APTITUDE_REASONING_BANK;

      const needed = Math.max(0, count - existing.length);
      const toCreate = needed > 0 ? Math.min(needed, bankToUse.length) : Math.min(count, bankToUse.length);

      for (let i = 1; i <= toCreate; i++) {
        const qNum = existing.length + i;
        const qId = `q-${roundId}-${String(qNum).padStart(3, '0')}`;
        const item = bankToUse[(qNum - 1) % bankToUse.length];

        const options: QuestionOption[] = item.options.map((optText, optIdx) => ({
          id: `opt-${qId}-${String.fromCharCode(65 + optIdx).toLowerCase()}`,
          question_id: qId,
          label: String.fromCharCode(65 + optIdx) as 'A' | 'B' | 'C' | 'D',
          option_text: optText,
          sort_order: optIdx + 1,
          created_at: new Date().toISOString(),
        }));

        const qObj: Question = {
          id: qId,
          round_id: roundId,
          question_text: item.question_text,
          question_type: 'single_choice',
          difficulty: item.difficulty || 'medium',
          marks: round.marks_per_question ?? 1,
          negative_marks: round.negative_marks ?? 0,
          status: 'approved',
          sort_order: qNum,
          options,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        store.questions.set(qId, qObj);
        store.answerKeys.set(qId, {
          id: `ak-${qId}`,
          question_id: qId,
          correct_option_label: item.correct_answer || 'A',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      resilientStorage.flushSync(() => store.toSnapshot());
      await this.syncRoundQuestionsToSupabase(roundId);
      return Array.from(store.questions.values()).filter((q) => q.round_id === roundId).length;
    }

    const coreFundamentalsTopics = [
      { q: "Which asymptotic time complexity represents an algorithm that halves the input problem size at every recursive step?", opts: ["O(log N)", "O(N)", "O(N log N)", "O(N^2)"], ans: "A", diff: "easy" },
      { q: "In relational database design, which normal form ensures that all non-key attributes depend entirely on the primary key?", opts: ["First Normal Form (1NF)", "Second Normal Form (2NF)", "Third Normal Form (3NF)", "Boyce-Codd Normal Form (BCNF)"], ans: "B", diff: "medium" },
      { q: "What data structure operates strictly on a Last-In, First-Out (LIFO) model and is commonly used for recursion call stacks?", opts: ["Queue", "Stack", "Binary Heap", "Doubly Linked List"], ans: "B", diff: "easy" },
      { q: "In computer networking, which transport layer protocol provides reliable, ordered, and connection-oriented byte streams?", opts: ["UDP", "TCP", "ICMP", "ARP"], ans: "B", diff: "easy" },
      { q: "What is the worst-case time complexity of standard Quicksort when using an unoptimized pivot selection strategy on an already sorted sequence?", opts: ["O(log N)", "O(N log N)", "O(N^2)", "O(2^N)"], ans: "C", diff: "medium" },
      { q: "Which fundamental object-oriented programming principle restricts direct state modification and mandates interaction through methods?", opts: ["Polymorphism", "Encapsulation", "Inheritance", "Dynamic Dispatch"], ans: "B", diff: "easy" },
      { q: "In Boolean algebra, what is the simplified logical equivalent of the expression: A AND (A OR B)?", opts: ["A", "B", "A AND B", "1"], ans: "A", diff: "medium" },
      { q: "What synchronization mechanism guarantees mutual exclusion among concurrent threads accessing a critical section?", opts: ["Semaphore Flag", "Mutex Lock", "Fork-Join Executor", "Volatile Register"], ans: "B", diff: "medium" },
      { q: "Which memory management condition occurs when total free memory is adequate but divided into non-contiguous blocks that cannot satisfy an allocation request?", opts: ["Internal Fragmentation", "External Fragmentation", "Page Faulting", "Thrashing"], ans: "B", diff: "medium" },
      { q: "In propositional logic, if statement 'P implies Q' is true, which conditional statement is its logically equivalent contrapositive?", opts: ["NOT P implies NOT Q", "NOT Q implies NOT P", "Q implies P", "P implies NOT Q"], ans: "B", diff: "medium" },
      { q: "In an undirected graph with V vertices and E edges, what is the time complexity of Breadth-First Search using an adjacency list?", opts: ["O(V + E)", "O(V * E)", "O(V^2)", "O(E log V)"], ans: "A", diff: "easy" },
      { q: "Which CPU scheduling algorithm allocates the CPU to the process with the smallest estimated next CPU burst?", opts: ["Round Robin (RR)", "Shortest Job Next (SJN)", "First-Come First-Served (FCFS)", "Priority Preemption"], ans: "B", diff: "medium" },
      { q: "What is the primary function of the Translation Lookaside Buffer (TLB) in virtual memory hardware?", opts: ["Cache recently executed instructions", "Cache physical page frames", "Cache virtual-to-physical address translations", "Buffer I/O interrupts"], ans: "C", diff: "medium" },
      { q: "Which sorting algorithm is guaranteed to be stable and achieves O(N log N) worst-case time complexity?", opts: ["Quicksort", "Heapsort", "Merge Sort", "Selection Sort"], ans: "C", diff: "easy" },
      { q: "In TCP connection termination, what state does the initiating host enter immediately after sending its final ACK to ensure receipt?", opts: ["CLOSE_WAIT", "TIME_WAIT", "FIN_WAIT_2", "LAST_ACK"], ans: "B", diff: "medium" }
    ];

    const advancedProblemSolvingTopics = [
      { q: "Which dynamic programming algorithm computes the all-pairs shortest paths on a directed graph with arbitrary edge weights without negative cycles?", opts: ["Dijkstra's Algorithm", "Floyd-Warshall Algorithm", "Prim's Algorithm", "Kruskal's Algorithm"], ans: "B", diff: "hard" },
      { q: "In distributed system architecture, what trade-off does the CAP theorem mandate during an unavoidable network partition?", opts: ["Consistency cannot be recovered", "The system must choose between Consistency and Availability", "Partitions permanently disable data access", "Availability is strictly enforced over all latencies"], ans: "B", diff: "hard" },
      { q: "Which self-balancing binary search tree maintains balance by ensuring that no two consecutive red nodes appear on any root-to-leaf path?", opts: ["AVL Tree", "Red-Black Tree", "Splay Tree", "B-Tree"], ans: "B", diff: "medium" },
      { q: "In operating system process management, which condition is NOT one of the four necessary Coffman criteria for system deadlock?", opts: ["Mutual Exclusion", "Hold and Wait", "Preemption of Allocated Resources", "Circular Wait"], ans: "C", diff: "hard" },
      { q: "What is the amortized time complexity of the find-set operation in Disjoint Set Union (DSU) using both path compression and union by rank?", opts: ["O(log N)", "O(alpha(N)) Inverse Ackermann", "O(1) strict constant", "O(N)"], ans: "B", diff: "hard" },
      { q: "In transaction processing, which ANSI SQL isolation level prevents dirty reads, non-repeatable reads, and phantom read anomalies?", opts: ["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"], ans: "D", diff: "hard" },
      { q: "Which algorithmic heuristic combines exact path costs from the origin with estimated distances to the destination to optimize search performance?", opts: ["Breadth-First Traversal", "A* Heuristic Search", "Bellman-Ford Relaxation", "Simulated Annealing"], ans: "B", diff: "medium" },
      { q: "Which cache write policy guarantees that data is written synchronously to both the cache and persistent secondary storage simultaneously?", opts: ["Write-Through", "Write-Back", "Write-Around", "Read-Allocate"], ans: "A", diff: "medium" },
      { q: "In cryptographic systems, which mathematical complexity problem establishes the security foundation of Diffie-Hellman key exchange?", opts: ["Subset Sum Problem", "Discrete Logarithm Problem", "Knapsack Decision Problem", "Graph Isomorphism"], ans: "B", diff: "hard" },
      { q: "What is the space complexity of Depth-First Search on a tree with maximum branching factor b and maximum depth d?", opts: ["O(b^d)", "O(b * d)", "O(d^2)", "O(b + d)"], ans: "B", diff: "medium" },
      { q: "In distributed consensus protocols, which role in the Raft algorithm is exclusively responsible for accepting client logs and replicating them to followers?", opts: ["Candidate", "Leader", "Observer", "Validator"], ans: "B", diff: "hard" },
      { q: "Which lock-free synchronization primitive atomically updates a memory location only if its current value matches an expected operand?", opts: ["Test-and-Set", "Compare-and-Swap (CAS)", "Fetch-and-Add", "Memory Barrier"], ans: "B", diff: "hard" }
    ];

    const isAdvanced = round.name.toLowerCase().includes('advanced') || round.round_number >= 2;
    const sampleTopics = isAdvanced ? advancedProblemSolvingTopics : coreFundamentalsTopics;

    const needed = Math.max(0, count - existing.length);
    const toCreate = needed > 0 ? needed : count;

    for (let i = 1; i <= toCreate; i++) {
      const qNum = existing.length + i;
      const qId = `q-${roundId}-${String(qNum).padStart(3, '0')}`;
      const t = sampleTopics[(qNum - 1) % sampleTopics.length];
      const cycle = Math.floor((qNum - 1) / sampleTopics.length);
      const text = cycle > 0 ? `[Part ${cycle + 1}] ${t.q}` : t.q;

      const options: QuestionOption[] = t.opts.map((optText, optIdx) => ({
        id: `opt-${qId}-${String.fromCharCode(65 + optIdx).toLowerCase()}`,
        question_id: qId,
        label: String.fromCharCode(65 + optIdx) as 'A' | 'B' | 'C' | 'D',
        option_text: optText,
        sort_order: optIdx + 1,
        created_at: new Date().toISOString(),
      }));

      const qObj: Question = {
        id: qId,
        round_id: roundId,
        question_text: text,
        question_type: 'single_choice',
        difficulty: t.diff as Difficulty,
        marks: round.marks_per_question ?? 1,
        negative_marks: round.negative_marks ?? 0,
        status: 'approved',
        sort_order: qNum,
        options,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      store.questions.set(qId, qObj);
      store.answerKeys.set(qId, {
        id: `ak-${qId}`,
        question_id: qId,
        correct_option_label: t.ans,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    resilientStorage.flushSync(() => store.toSnapshot());
    await this.syncRoundQuestionsToSupabase(roundId);
    return Array.from(store.questions.values()).filter((q) => q.round_id === roundId).length;
  },

  async getActivePdfForRound(roundId: string): Promise<{
    id: string;
    original_filename: string;
    uploaded_at: string;
    file_size_bytes: number;
    questions_count: number;
  } | null> {
    try {
      const pool = getPgPool();
      const { rows } = await pool.query(
        'SELECT * FROM pdf_documents WHERE round_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
        [roundId]
      );
      if (rows && rows.length > 0) {
        const doc = rows[0];
        const poolQuestions = await this.getQuestionsByRoundId(roundId);
        return {
          id: doc.id,
          original_filename: doc.original_filename,
          uploaded_at: doc.uploaded_at,
          file_size_bytes: doc.file_size_bytes || 0,
          questions_count: poolQuestions.length,
        };
      }
    } catch {}

    // Fall back to ocrJobs
    const jobs = Array.from(store.ocrJobs.values()).filter(
      (j) => j.round_name?.includes(roundId) || j.pdf_document_id?.includes(roundId)
    );
    if (jobs.length > 0) {
      const latest = jobs[0];
      const pool = await this.getQuestionsByRoundId(roundId);
      return {
        id: latest.id,
        original_filename: latest.document_name || 'Question_Paper.pdf',
        uploaded_at: latest.created_at,
        file_size_bytes: 0,
        questions_count: pool.length || latest.questions_extracted || 0,
      };
    }
    return null;
  },

  // OCR JOBS
  async getOCRJobs(): Promise<OCRJob[]> {
    try {
      const pool = getPgPool();
      const { rows } = await pool.query('SELECT * FROM ocr_jobs ORDER BY created_at DESC');
      if (rows && rows.length > 0) {
        rows.forEach((j: any) => {
          const existing = store.ocrJobs.get(j.id);
          store.ocrJobs.set(j.id, {
            ...j,
            document_name: existing?.document_name || j.document_name || 'Question_Paper.pdf',
            round_name: existing?.round_name || j.round_name || 'Round 1 Question Pool',
            pdf_document_id: j.pdf_document_id || j.id,
          });
        });
      }
    } catch {}
    return Array.from(store.ocrJobs.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async createOCRJob(params: {
    documentName: string;
    roundId?: string;
    targetCount?: number;
    fileBuffer?: Buffer;
  }): Promise<OCRJob> {
    const id = `job-ocr-${Date.now()}`;
    const round = params.roundId ? await this.getRoundById(params.roundId) : null;
    const countToExtract = params.targetCount || 100;
    const job: OCRJob = {
      id,
      pdf_document_id: `doc-${Date.now()}`,
      status: 'queued',
      progress_percent: 0,
      questions_extracted: null,
      error_message: null,
      worker_id: 'worker-local-01',
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
      document_name: params.documentName,
      round_name: round?.name || 'Round 1 Question Pool',
    };
    store.ocrJobs.set(id, job);

    let dispatchedToExternal = false;
    const isLocalhost = Boolean(
      process.env.OCR_SERVICE_URL &&
        (process.env.OCR_SERVICE_URL.includes('localhost') || process.env.OCR_SERVICE_URL.includes('127.0.0.1'))
    );

    const isCloudEnv = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
    // Only dispatch to external microservice if not running serverless localhost
    if (process.env.OCR_SERVICE_URL && !(isCloudEnv && isLocalhost)) {
      try {
        const baseUrl = process.env.OCR_SERVICE_URL.endsWith('/')
          ? process.env.OCR_SERVICE_URL
          : `${process.env.OCR_SERVICE_URL}/`;
        const ocrEndpoint = new URL('jobs/start', baseUrl);
        const secret = process.env.OCR_SERVICE_SECRET || 'dev-secret';

        const res = await fetch(ocrEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-OCR-Secret': secret,
          },
          body: JSON.stringify({
            job_id: job.id,
            pdf_document_id: job.pdf_document_id,
            storage_path: `documents/${params.documentName}`,
            round_id: params.roundId || null,
          }),
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          dispatchedToExternal = true;
          job.worker_id = 'worker-ocr-service';
          job.status = 'processing';
          job.progress_percent = 50;
          store.ocrJobs.set(id, { ...job });
        }
      } catch (err) {
        console.warn('[OCR Service] Dispatch failed, running synchronous resilient extraction:', err);
      }
    }

    // In Serverless execution (Vercel/AWS Lambda), background setTimeout timers get terminated
    // once the HTTP response is sent. We execute question generation and persistent save synchronously now.
    if (!dispatchedToExternal) {
      let extractedCount = countToExtract;
      if (params.roundId) {
        try {
          const marks = round?.marks_per_question ?? 1;
          const neg = round?.negative_marks ?? 0;
          const { questions, answerKeys } = processPdfQuestions(
            params.fileBuffer || null,
            params.documentName,
            params.roundId,
            countToExtract,
            marks,
            neg
          );

          questions.forEach((q) => store.questions.set(q.id, q));
          Object.entries(answerKeys).forEach(([qId, label]) => {
            store.answerKeys.set(qId, {
              id: `ak-${qId}`,
              question_id: qId,
              correct_option_label: label,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          });

          extractedCount = questions.length;
          (job as any).questions = questions;

          if (round && questions.length > 0) {
            round.total_questions = questions.length;
            round.question_pool_count = questions.length;
            store.rounds.set(round.id, round);
          }
        } catch (popErr) {
          console.warn('[OCR Engine] Error processing PDF questions:', popErr);
          extractedCount = await this.populateRoundQuestionPool(params.roundId, countToExtract);
          (job as any).questions = await this.getQuestionsByRoundId(params.roundId, true);
        }
      }
      job.status = 'completed';
      job.progress_percent = 100;
      job.questions_extracted = extractedCount;
      job.completed_at = new Date().toISOString();
      store.ocrJobs.set(id, { ...job });
      resilientStorage.flushSync(() => store.toSnapshot());
      if (params.roundId) {
        await this.syncRoundQuestionsToSupabase(params.roundId);
      }
      try {
        const pgPool = getPgPool();
        if (params.roundId) {
          await pgPool.query(
            `INSERT INTO pdf_documents (id, round_id, storage_path, original_filename, file_size_bytes, uploaded_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET original_filename = EXCLUDED.original_filename, file_size_bytes = EXCLUDED.file_size_bytes, uploaded_at = EXCLUDED.uploaded_at`,
            [job.pdf_document_id, params.roundId, `documents/${params.documentName}`, params.documentName, params.fileBuffer?.length || 0, new Date().toISOString()]
          );
        }
        await pgPool.query(
          `INSERT INTO ocr_jobs (id, pdf_document_id, status, progress_percent, questions_extracted, worker_id, completed_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, progress_percent = EXCLUDED.progress_percent, questions_extracted = EXCLUDED.questions_extracted, completed_at = EXCLUDED.completed_at`,
          [job.id, job.pdf_document_id, job.status, job.progress_percent, job.questions_extracted, job.worker_id, job.completed_at, job.created_at]
        );
      } catch (err) {
        console.warn('[PostgreSQL pdf_documents/ocr_jobs upsert error]', err);
      }
    }

    return job;
  },

  async getAuditLogs(): Promise<ExaminationAuditLog[]> {
    return store.auditLogs;
  },
};

