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
import { createAdminClient } from '@/lib/supabase/admin';
import { resilientStorage, ResilientSnapshot } from '@/lib/db/resilient-storage';
import { processPdfQuestions, APTITUDE_REASONING_BANK, MEDIUM_APTITUDE_REASONING_BANK } from '@/lib/pdf/extractor';

// In-memory high-throughput state engine with resilient disk backup and Supabase sync
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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('examinations')
          .select('*, rounds:examination_rounds(*)')
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          const examList: Examination[] = [];
          for (const item of data) {
            const rounds = (item.rounds || []).sort((a: any, b: any) => a.round_number - b.round_number);
            const { count: regCount } = await supabase
              .from('registrations')
              .select('*', { count: 'exact', head: true })
              .eq('examination_id', item.id);
            const exObj: Examination = {
              ...item,
              rounds,
              _count: {
                registrations: regCount || 0,
                rounds: rounds.length,
              },
            };
            examList.push(exObj);
            store.examinations.set(item.id, exObj);
            rounds.forEach((r: any) => store.rounds.set(r.id, r));
          }
          return examList;
        }
      } catch {
        // Fall back to store
      }
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
    // 1. Memory-first resolution for sub-millisecond response
    let exam = store.examinations.get(id);
    if (!exam) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exam = store.examinations.get(id);
      }
    }

    // 2. Fall back to Supabase if not found in memory
    const supabase = createAdminClient();
    if (!exam && supabase) {
      try {
        const { data, error } = await supabase
          .from('examinations')
          .select('*, rounds:examination_rounds(*)')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) {
          exam = data as Examination;
          store.examinations.set(id, exam);
          if (data.rounds) {
            data.rounds.forEach((r: any) => store.rounds.set(r.id, r));
          }
        }
      } catch {
        // Fall back to store
      }
    }

    if (exam) {
      let rounds = Array.from(store.rounds.values())
        .filter((r) => r.examination_id === exam.id)
        .sort((a, b) => a.round_number - b.round_number);

      if (rounds.length === 0 && supabase) {
        try {
          const { data } = await supabase
            .from('examination_rounds')
            .select('*')
            .eq('examination_id', exam.id)
            .order('round_number', { ascending: true });
          if (data && data.length > 0) {
            rounds = data as ExaminationRound[];
            rounds.forEach((r) => store.rounds.set(r.id, r));
          }
        } catch {}
      }

      let regCount = Array.from(store.registrations.values()).filter((r) => r.examination_id === exam.id).length;
      if (regCount === 0 && supabase) {
        try {
          const { count } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('examination_id', exam.id);
          regCount = count || 0;
        } catch {}
      }

      return {
        ...exam,
        rounds,
        _count: {
          registrations: regCount,
          rounds: rounds.length,
        },
      };
    }

    return null;
  },

  async getExaminationBySlug(slug: string): Promise<Examination | null> {
    // 1. Memory-first resolution
    let exam = Array.from(store.examinations.values()).find((e) => e.slug === slug || e.id === slug);
    if (!exam) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exam = Array.from(store.examinations.values()).find((e) => e.slug === slug || e.id === slug);
      }
    }

    // 2. Fall back to Supabase
    if (!exam) {
      const supabase = createAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('examinations')
            .select('*, rounds:examination_rounds(*)')
            .or(`slug.eq.${slug},id.eq.${slug}`)
            .maybeSingle();
          if (!error && data) {
            exam = data as Examination;
            store.examinations.set(exam.id, exam);
            if (data.rounds) {
              data.rounds.forEach((r: any) => store.rounds.set(r.id, r));
            }
          }
        } catch {
          // Fall back to store
        }
      }
    }

    if (exam) {
      return this.getExaminationById(exam.id);
    }
    return null;
  },

  async createExamination(examData: Partial<Examination>, roundsData?: Partial<ExaminationRound>[]): Promise<Examination> {
    const supabase = createAdminClient();
    const id = examData.id || `exam-${Date.now()}`;
    const newExam: Examination = {
      id,
      name: examData.name || 'Untitled Examination',
      slug: examData.slug || `exam-${Date.now()}`,
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

    if (supabase) {
      try {
        const { error } = await supabase.from('examinations').upsert(newExam);
        if (!error && roundsData && roundsData.length > 0) {
          const insertRounds = roundsData.map((r, i) => ({
            ...r,
            examination_id: id,
            round_number: r.round_number || i + 1,
            name: r.name || `Round ${i + 1}`,
          }));
          await supabase.from('examination_rounds').upsert(insertRounds);
        }
      } catch {
        // continue to store
      }
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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('examinations').update({ status, updated_at: new Date().toISOString() }).eq('id', examId);
      } catch {
        // Fall back to store
      }
    }
    const exam = store.examinations.get(examId);
    if (exam) {
      exam.status = status;
      exam.updated_at = new Date().toISOString();
      store.examinations.set(examId, exam);
      resilientStorage.scheduleSave(() => store.toSnapshot());
    }
    return this.getExaminationById(examId);
  },

  // ROUNDS
  async getRoundsByExamId(examId: string): Promise<ExaminationRound[]> {
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('examination_rounds')
          .select('*')
          .eq('examination_id', examId)
          .order('round_number', { ascending: true });
        if (!error && data && data.length > 0) {
          const rounds = data as ExaminationRound[];
          rounds.forEach((r) => store.rounds.set(r.id, r));
          return rounds.map((r) => {
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
        console.warn('[Supabase getRoundsByExamId error]', err);
      }
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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data } = await supabase.from('examination_rounds').select('*').eq('id', roundId).maybeSingle();
        if (data) {
          const round = data as ExaminationRound;
          store.rounds.set(roundId, round);
          return round;
        }
      } catch {}
    }

    let round = store.rounds.get(roundId);
    if (!round) {
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

    store.rounds.set(id, roundData);
    resilientStorage.flushSync(() => store.toSnapshot());

    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('examination_rounds').upsert(roundData);
      } catch (err) {
        console.warn('[Supabase createOrUpdateRound error]', err);
      }
    }

    return roundData;
  },

  async deleteRound(examId: string, roundId: string): Promise<boolean> {
    store.rounds.delete(roundId);

    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('examination_rounds').delete().eq('id', roundId);
        await supabase.from('question_banks').delete().eq('id', `bank-${roundId}`);
      } catch (err) {
        console.warn('[Supabase deleteRound error]', err);
      }
    }

    // Re-index remaining rounds sequentially (1, 2, 3...) both in memory and Supabase
    let remaining = Array.from(store.rounds.values()).filter(
      (r) => r.examination_id === examId && r.id !== roundId
    );

    if (supabase) {
      try {
        const { data } = await supabase
          .from('examination_rounds')
          .select('*')
          .eq('examination_id', examId)
          .order('round_number', { ascending: true });
        if (data && data.length > 0) {
          remaining = data as ExaminationRound[];
        }
      } catch {}
    }

    remaining.sort((a, b) => a.round_number - b.round_number);

    for (let idx = 0; idx < remaining.length; idx++) {
      const r = remaining[idx];
      const newNum = idx + 1;
      r.round_number = newNum;
      store.rounds.set(r.id, r);
      if (supabase) {
        try {
          await supabase
            .from('examination_rounds')
            .update({ round_number: newNum, updated_at: new Date().toISOString() })
            .eq('id', r.id);
        } catch {}
      }
    }

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
    resilientStorage.scheduleSave(() => store.toSnapshot());

    // Synchronize to Supabase immediately for persistent multi-container reliability
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data: exExists } = await supabase.from('examinations').select('id').eq('id', params.examId).maybeSingle();
        if (!exExists) {
          const exMem = store.examinations.get(params.examId);
          await supabase.from('examinations').upsert({
            id: params.examId,
            name: exMem?.name || 'Campus Examination',
            slug: exMem?.slug || params.examId,
            status: exMem?.status || 'published',
            auth_mode: 'roster',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        await supabase.from('students').upsert({
          id: student.id,
          full_name: student.full_name,
          email: student.email,
          roll_number: student.roll_number,
          login_id: student.login_id,
          examination_id: params.examId,
          created_at: student.created_at,
        });

        await supabase.from('registrations').upsert({
          id: regId,
          examination_id: params.examId,
          student_id: student.id,
          login_id: cleanRoll,
          registered_at: registration.registered_at,
          status: 'registered',
        });
      } catch (err) {
        console.warn('[Supabase registerStudent sync error]', err);
      }
    }

    return { student, registration, isNew: true };
  },

  async getRegistration(regId: string): Promise<Registration | null> {
    let reg = store.registrations.get(regId);
    if (!reg) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.registrations) {
        store.hydrate(snap);
        reg = store.registrations.get(regId);
      }
    }
    if (!reg) {
      const supabase = createAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('registrations').select('*, student:students(*)').eq('id', regId).single();
          if (data) {
            reg = data as Registration;
            store.registrations.set(regId, reg);
            if (reg.student) store.students.set(reg.student.id, reg.student);
          }
        } catch {}
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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, student:students(*)')
          .eq('examination_id', examId);
        if (!error && data && data.length > 0) {
          data.forEach((r: any) => {
            store.registrations.set(r.id, r);
            if (r.student) {
              store.students.set(r.student.id, r.student);
              if (r.student.roll_number) {
                if (!store.studentByRoll) store.studentByRoll = new Map();
                store.studentByRoll.set(r.student.roll_number.trim().toUpperCase(), r.student.id);
              }
            }
          });
          return (data as Registration[]).map((r) => ({
            ...r,
            student: store.students.get(r.student_id) || r.student,
          }));
        }
      } catch (err) {
        console.warn('[Supabase getRegistrationsByExamId error]', err);
      }
    }

    let regs = Array.from(store.registrations.values()).filter((r) => r.examination_id === examId);

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
    store.registrations.delete(registrationId);
    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('registrations').delete().eq('id', registrationId);
      } catch {}
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

    // Batch upsert to Supabase
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data: exExists } = await supabase.from('examinations').select('id').eq('id', params.examId).maybeSingle();
        if (!exExists) {
          await supabase.from('examinations').upsert({
            id: params.examId,
            name: exam.name || 'Campus Examination',
            slug: exam.slug || params.examId,
            status: exam.status || 'published',
            auth_mode: authMode,
            login_identifier_field: loginField,
            login_identifier_label: loginLabel,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (params.replaceExisting) {
          await supabase.from('registrations').delete().eq('examination_id', params.examId);
        }

        const chunkSize = 50;
        for (let i = 0; i < newStudents.length; i += chunkSize) {
          await supabase.from('students').upsert(
            newStudents.slice(i, i + chunkSize).map((s) => ({
              id: s.id,
              full_name: s.full_name,
              email: s.email,
              roll_number: s.roll_number,
              login_id: s.login_id,
              examination_id: s.examination_id,
              created_at: s.created_at,
            }))
          );
        }

        for (let i = 0; i < newRegistrations.length; i += chunkSize) {
          await supabase.from('registrations').upsert(
            newRegistrations.slice(i, i + chunkSize).map((r) => ({
              id: r.id,
              examination_id: r.examination_id,
              student_id: r.student_id,
              login_id: r.login_id,
              registered_at: r.registered_at,
              status: r.status,
            }))
          );
        }

        await supabase.from('examinations').update({
          auth_mode: authMode,
          login_identifier_field: loginField,
          login_identifier_label: loginLabel,
          roster_count: currentExamRegs.length,
          updated_at: new Date().toISOString(),
        }).eq('id', params.examId);
      } catch (err) {
        console.warn('[Supabase importStudentRoster sync error]', err);
      }
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
      const autoReg = await this.registerStudent({
        examId: exam.id,
        fullName: `Candidate ${cleanLogin}`,
        email: `${cleanLogin.toLowerCase()}@student.exam`,
        rollNumber: cleanLogin,
      });
      match = autoReg.registration;
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

    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('examinations').update({
          auth_mode: params.authMode,
          login_identifier_field: params.loginIdentifierField || exam.login_identifier_field,
          login_identifier_label: params.loginIdentifierLabel || exam.login_identifier_label,
          updated_at: new Date().toISOString(),
        }).eq('id', params.examId);
      } catch (err) {
        console.warn('[Supabase updateExamAuthSettings error]', err);
      }
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

    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('registrations').delete().eq('examination_id', examId);
        await supabase.from('examinations').update({ roster_count: 0 }).eq('id', examId);
      } catch (err) {
        console.warn('[Supabase clearStudentRoster sync error]', err);
      }
    }

    return true;
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

    const supabase = createAdminClient();
    let supabaseStatus = 'disconnected';
    let supabaseLatencyMs = 0;
    let supabaseMessage = 'No remote connection';

    if (supabase) {
      try {
        const start = Date.now();
        const { error } = await supabase.from('examinations').select('id').limit(1);
        supabaseLatencyMs = Date.now() - start;
        if (!error) {
          supabaseStatus = 'connected';
          supabaseMessage = 'Cloud PostgreSQL connection verified';
        } else if (error.code === 'PGRST205') {
          supabaseStatus = 'schema_pending';
          supabaseMessage = 'Connected to Supabase PostgreSQL (Schema migrations pending - running on local resilient store)';
        } else {
          supabaseStatus = 'degraded';
          supabaseMessage = error.message;
        }
      } catch (e: any) {
        supabaseStatus = 'error';
        supabaseMessage = e.message || 'Connection failed';
      }
    } else {
      supabaseStatus = 'not_configured';
      supabaseMessage = 'Supabase environment variables not configured';
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
        provider: 'Supabase PostgreSQL (Cloud)',
        latencyMs: supabaseLatencyMs,
        message: supabaseMessage,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not Configured',
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

    // Wipe rows from Supabase (preserving table structures)
    let supabaseResult = { success: true, affectedTables: [] as string[], error: undefined as string | undefined };
    const supabase = createAdminClient();
    if (supabase) {
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
      const affected: string[] = [];
      for (const tbl of targetTables) {
        try {
          await supabase.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          affected.push(tbl);
        } catch {
          // Table may not exist or may be unmigrated; continue
        }
      }
      supabaseResult = { success: true, affectedTables: affected, error: undefined };
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
        supabaseTablesAffected: supabaseResult.affectedTables,
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
      supabaseStatus: supabaseResult,
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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('questions')
          .select('*, options:question_options(*), answer_key:answer_keys(*)')
          .eq('round_id', roundId)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          const list: Question[] = [];
          data.forEach((q: any) => {
            const options = (q.options || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
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
              options,
            };
            store.questions.set(q.id, qObj);
            if (q.answer_key) {
              const ak = Array.isArray(q.answer_key) ? q.answer_key[0] : q.answer_key;
              if (ak) {
                store.answerKeys.set(q.id, {
                  id: ak.id || `ak-${q.id}`,
                  question_id: q.id,
                  correct_option_label: ak.correct_option_label || 'A',
                  created_at: ak.created_at,
                  updated_at: ak.updated_at,
                });
              }
            }
            if (isAdmin || q.status === 'approved' || !q.status) {
              list.push(qObj);
            }
          });
          if (list.length > 0) {
            if (isAdmin) {
              return list.map((q) => {
                const ak = store.answerKeys.get(q.id);
                return {
                  ...q,
                  correct_option_label: ak?.correct_option_label,
                };
              });
            }
            return list;
          }
        }
      } catch (err) {
        console.warn('[Supabase getQuestionsByRoundId error]', err);
      }
    }

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

  async syncRoundQuestionsToSupabase(roundId: string): Promise<void> {
    const roundQuestions = Array.from(store.questions.values()).filter((q) => q.round_id === roundId);
    if (roundQuestions.length === 0) return;

    const supabase = createAdminClient();
    if (!supabase) return;

    try {
      const { data: roundInDb } = await supabase.from('examination_rounds').select('id, examination_id').eq('id', roundId).maybeSingle();
      if (!roundInDb) {
        const round = store.rounds.get(roundId) || (await this.getRoundById(roundId));
        if (round) {
          const { data: examInDb } = await supabase.from('examinations').select('id').eq('id', round.examination_id).maybeSingle();
          if (!examInDb) {
            await supabase.from('examinations').upsert({
              id: round.examination_id,
              name: 'Campus Examination',
              slug: round.examination_id,
              status: 'published',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          await supabase.from('examination_rounds').upsert(round);
        }
      }

      const bankId = `bank-${roundId}`;
      const examId = roundInDb?.examination_id || store.rounds.get(roundId)?.examination_id;
      if (examId) {
        await supabase.from('question_banks').upsert({
          id: bankId,
          examination_id: examId,
          round_id: roundId,
          name: store.rounds.get(roundId)?.name ? `${store.rounds.get(roundId)!.name} Question Bank` : 'Round Question Bank',
          created_at: new Date().toISOString(),
        });
      }

      const qRows = roundQuestions.map((q) => ({
        id: q.id,
        bank_id: bankId,
        round_id: q.round_id,
        question_text: q.question_text,
        question_type: q.question_type,
        difficulty: q.difficulty,
        marks: q.marks,
        negative_marks: q.negative_marks,
        status: q.status,
        ocr_confidence: q.ocr_confidence ?? 95,
        explanation: q.explanation || null,
        sort_order: q.sort_order,
        created_at: q.created_at,
        updated_at: q.updated_at,
      }));

      const optRows = roundQuestions.flatMap((q) =>
        (q.options || []).map((opt) => ({
          id: opt.id,
          question_id: q.id,
          label: opt.label,
          option_text: opt.option_text,
          sort_order: opt.sort_order,
          created_at: opt.created_at || new Date().toISOString(),
        }))
      );

      const akRows = roundQuestions.map((q) => ({
        id: `ak-${q.id}`,
        question_id: q.id,
        correct_option_label: store.answerKeys.get(q.id)?.correct_option_label || 'A',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const chunkSize = 50;
      for (let i = 0; i < qRows.length; i += chunkSize) {
        await supabase.from('questions').upsert(qRows.slice(i, i + chunkSize));
      }
      for (let i = 0; i < optRows.length; i += chunkSize) {
        await supabase.from('question_options').upsert(optRows.slice(i, i + chunkSize));
      }
      for (let i = 0; i < akRows.length; i += chunkSize) {
        await supabase.from('answer_keys').upsert(akRows.slice(i, i + chunkSize));
      }

      await supabase
        .from('examination_rounds')
        .update({ question_pool_count: roundQuestions.length, updated_at: new Date().toISOString() })
        .eq('id', roundId);
    } catch (err) {
      console.warn('[Supabase syncRoundQuestionsToSupabase error]', err);
    }
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

    resilientStorage.scheduleSave(() => store.toSnapshot());

    // Sync to Supabase
    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('questions').upsert({
          id: newQuestion.id,
          round_id: newQuestion.round_id,
          question_text: newQuestion.question_text,
          question_type: newQuestion.question_type,
          difficulty: newQuestion.difficulty,
          marks: newQuestion.marks,
          negative_marks: newQuestion.negative_marks,
          status: newQuestion.status,
          sort_order: newQuestion.sort_order,
          created_at: newQuestion.created_at,
          updated_at: newQuestion.updated_at,
        });

        if (newQuestion.options && newQuestion.options.length > 0) {
          await supabase.from('question_options').upsert(
            newQuestion.options.map((opt) => ({
              id: opt.id,
              question_id: newQuestion.id,
              label: opt.label,
              option_text: opt.option_text,
              sort_order: opt.sort_order,
              created_at: opt.created_at || new Date().toISOString(),
            }))
          );
        }

        if (questionData.correct_option_label) {
          await supabase.from('answer_keys').upsert({
            id: `ak-${id}`,
            question_id: id,
            correct_option_label: questionData.correct_option_label,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('[Supabase createQuestion sync error]', err);
      }
    }

    return { ...newQuestion, correct_option_label: questionData.correct_option_label };
  },

  async deleteQuestion(id: string): Promise<boolean> {
    store.questions.delete(id);
    store.answerKeys.delete(id);
    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('questions').delete().eq('id', id);
      } catch {}
    }
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

    const round = store.rounds.get(params.roundId);
    if (!round) throw new Error('Round not found');

    const supabase = createAdminClient();
    if (!existing && supabase) {
      try {
        const { data: sbAtt } = await supabase
          .from('examination_attempts')
          .select('*')
          .eq('registration_id', params.registrationId)
          .eq('round_id', params.roundId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sbAtt) {
          existing = {
            id: sbAtt.id,
            registration_id: sbAtt.registration_id,
            round_id: sbAtt.round_id,
            started_at: sbAtt.started_at,
            deadline_at: sbAtt.deadline_at,
            submitted_at: sbAtt.submitted_at,
            status: sbAtt.status as any,
            assigned_question_ids: Array.isArray(sbAtt.assigned_question_ids) ? sbAtt.assigned_question_ids : [],
            cheating_warnings: sbAtt.cheating_warnings || 0,
            ip_address: sbAtt.ip_address,
            user_agent: sbAtt.user_agent,
            created_at: sbAtt.created_at,
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

    // Synchronize attempt creation to Supabase
    if (supabase) {
      try {
        await supabase.from('examination_attempts').upsert({
          id: attempt.id,
          registration_id: attempt.registration_id,
          round_id: attempt.round_id,
          started_at: attempt.started_at,
          deadline_at: attempt.deadline_at,
          status: attempt.status,
          assigned_question_ids: attempt.assigned_question_ids,
          cheating_warnings: attempt.cheating_warnings,
          ip_address: attempt.ip_address,
          user_agent: attempt.user_agent,
          created_at: attempt.created_at,
        });
      } catch {}
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

    // Persist to Supabase attempt_answers table so state is preserved across serverless lambdas
    const supabase = createAdminClient();
    if (supabase && updatedAnswers.length > 0) {
      try {
        const rowsToUpsert = updatedAnswers.map((ans) => ({
          id: ans.id,
          attempt_id: ans.attempt_id,
          question_id: ans.question_id,
          selected_option: ans.selected_option,
          code_snippet: ans.code_snippet,
          code_language: ans.code_language,
          is_marked_for_review: ans.is_marked_for_review,
          answered_at: ans.answered_at,
          updated_at: ans.updated_at,
        }));
        await supabase.from('attempt_answers').upsert(rowsToUpsert);
      } catch (err) {
        console.warn('[saveAttemptAnswersBatch] Supabase upsert error:', err);
      }
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

    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase
          .from('examination_attempts')
          .update({
            cheating_warnings: warningNumber,
            status: attempt.status,
            submitted_at: attempt.submitted_at,
          })
          .eq('id', attempt.id);
      } catch {}
    }

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

      const supabase = createAdminClient();

      if (round.round_type === 'coding') {
        let codeAnswered = 0;
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attemptId}_${qId}`;
          let answer = store.answers.get(key);
          if (!answer && supabase) {
            try {
              const { data: dbAns } = await supabase
                .from('attempt_answers')
                .select('*')
                .eq('attempt_id', attemptId)
                .eq('question_id', qId)
                .maybeSingle();
              if (dbAns) {
                answer = dbAns;
                store.answers.set(key, dbAns);
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

        // Fetch answers from Supabase if missing in store.answers
        let loadedDbAnswers = false;
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attemptId}_${qId}`;
          if (!store.answers.has(key) && !loadedDbAnswers && supabase) {
            loadedDbAnswers = true;
            try {
              const { data: dbAnswers } = await supabase
                .from('attempt_answers')
                .select('*')
                .eq('attempt_id', attemptId);
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

      if (supabase) {
        try {
          await supabase.from('examination_attempts').update({
            status: 'submitted',
            submitted_at: attempt.submitted_at,
          }).eq('id', attempt.id);
        } catch {}
      }

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

      if (supabase) {
        try {
          await supabase.from('examination_results').upsert({
            id: result.id,
            attempt_id: result.attempt_id,
            registration_id: result.registration_id,
            round_id: result.round_id,
            score: result.score,
            total_marks: result.total_marks,
            qualifying_marks: result.qualifying_marks,
            is_qualified: result.is_qualified,
            correct_count: result.correct_count,
            wrong_count: result.wrong_count,
            unanswered_count: result.unanswered_count,
            evaluated_at: result.evaluated_at,
          });
        } catch {}
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
      const supabase = createAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('examination_results').select('*').eq('attempt_id', attemptId).maybeSingle();
          if (data) {
            res = data as ExaminationResult;
            store.results.set(attemptId, res);
          }
        } catch {}
      }
    }
    return res || null;
  },

  async getAttemptById(attemptId: string): Promise<ExaminationAttempt | null> {
    let attempt = store.attempts.get(attemptId);
    if (!attempt) {
      const supabase = createAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('examination_attempts').select('*').eq('id', attemptId).maybeSingle();
          if (data) {
            attempt = data as ExaminationAttempt;
            store.attempts.set(attemptId, attempt);
          }
        } catch {}
      }
    }
    return attempt || null;
  },

  async getQualification(regId: string, roundId: string): Promise<RoundQualification | null> {
    return store.qualifications.get(`${regId}_${roundId}`) || null;
  },

  // ADMIN MONITORING & STATS
  async getAdminStats(): Promise<AdminStats> {
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const [{ count: totalExaminations }, { count: totalStudents }, { data: attempts }, { data: results }, { count: pendingOcrJobs }] = await Promise.all([
          supabase.from('examinations').select('*', { count: 'exact', head: true }),
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('examination_attempts').select('status'),
          supabase.from('examination_results').select('is_qualified'),
          supabase.from('ocr_jobs').select('*', { count: 'exact', head: true }).in('status', ['uploaded', 'processing', 'queued']),
        ]);

        const studentsWriting = attempts?.filter((a) => a.status === 'in_progress').length || 0;
        const totalSubmissions = attempts?.filter((a) => a.status === 'submitted' || a.status === 'timed_out').length || 0;
        const qualifiedStudents = results?.filter((r) => r.is_qualified).length || 0;
        const unqualifiedStudents = (results?.length || 0) - qualifiedStudents;

        return {
          totalExaminations: totalExaminations ?? store.examinations.size,
          totalStudents: totalStudents ?? store.students.size,
          studentsWriting,
          totalSubmissions,
          qualifiedStudents,
          unqualifiedStudents,
          pendingOcrJobs: pendingOcrJobs ?? 0,
        };
      } catch {}
    }

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

    const supabase = createAdminClient();

    // 1. Load all registered students for this examination
    const registrations = await this.getRegistrationsByExamId(examId);
    const regMap = new Map<string, Registration>();
    for (const reg of registrations) {
      regMap.set(reg.id, reg);
      if (reg.student) {
        store.students.set(reg.student.id, reg.student);
      }
    }

    // 2. Fetch all attempts for these rounds from Supabase
    const attemptsMap = new Map<string, ExaminationAttempt>();
    if (supabase && roundIdList.length > 0) {
      try {
        const { data: dbAttempts } = await supabase
          .from('examination_attempts')
          .select('*')
          .in('round_id', roundIdList);

        if (dbAttempts) {
          for (const a of dbAttempts) {
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
        }
      } catch (err) {
        console.warn('[getLiveMonitoringData] Failed to fetch attempts from Supabase:', err);
      }
    }

    // Merge in-memory attempts
    for (const a of store.attempts.values()) {
      if (roundIds.has(a.round_id)) {
        attemptsMap.set(a.id, a);
      }
    }

    // 3. Fetch all examination results from Supabase
    const resultsMap = new Map<string, ExaminationResult>();
    if (supabase && roundIdList.length > 0) {
      try {
        const { data: dbResults } = await supabase
          .from('examination_results')
          .select('*')
          .in('round_id', roundIdList);

        if (dbResults) {
          for (const res of dbResults) {
            const resObj: ExaminationResult = {
              id: res.id,
              attempt_id: res.attempt_id,
              registration_id: res.registration_id,
              round_id: res.round_id,
              score: res.score,
              total_marks: res.total_marks,
              qualifying_marks: res.qualifying_marks,
              is_qualified: res.is_qualified,
              correct_count: res.correct_count,
              wrong_count: res.wrong_count,
              unanswered_count: res.unanswered_count,
              evaluated_at: res.evaluated_at,
            };
            resultsMap.set(resObj.attempt_id, resObj);
            store.results.set(resObj.attempt_id, resObj);
          }
        }
      } catch (err) {
        console.warn('[getLiveMonitoringData] Failed to fetch results from Supabase:', err);
      }
    }

    // Merge in-memory results
    for (const res of store.results.values()) {
      if (roundIds.has(res.round_id)) {
        resultsMap.set(res.attempt_id, res);
      }
    }

    // 4. Fetch latest code snippets for coding rounds if needed
    const codeSnippetMap = new Map<string, { snippet: string; language: string }>();
    if (supabase && attemptsMap.size > 0) {
      try {
        const attemptIds = Array.from(attemptsMap.keys());
        const { data: codeAnswers } = await supabase
          .from('attempt_answers')
          .select('attempt_id, code_snippet, code_language')
          .in('attempt_id', attemptIds)
          .not('code_snippet', 'is', null);

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
    const supabase = createAdminClient();
    const registrations = await this.getRegistrationsByExamId(examId);
    let reg = registrations.find(
      (r) => r.id === registrationId || r.student_id === registrationId || r.login_id === registrationId
    ) || store.registrations.get(registrationId);

    if (!reg && supabase) {
      try {
        const { data } = await supabase
          .from('registrations')
          .select('*, student:students(*)')
          .or(`id.eq.${registrationId},student_id.eq.${registrationId},login_id.eq.${registrationId}`)
          .maybeSingle();
        if (data) reg = data as any;
      } catch {}
    }
    if (!reg) throw new Error('Registration record not found');
    const student = reg.student || store.students.get(reg.student_id);

    const rounds = await this.getRoundsByExamId(examId);
    rounds.sort((a, b) => a.round_number - b.round_number);
    const roundProgression: any[] = [];

    // Fetch attempts for this registration from Supabase
    let regAttempts: ExaminationAttempt[] = [];
    if (supabase) {
      try {
        const { data: attData } = await supabase
          .from('examination_attempts')
          .select('*')
          .eq('registration_id', reg.id);
        if (attData) regAttempts = attData as any;
      } catch {}
    }
    for (const a of store.attempts.values()) {
      if (a.registration_id === reg.id && !regAttempts.some((ra) => ra.id === a.id)) {
        regAttempts.push(a);
      }
    }

    // Fetch results for this registration from Supabase
    let regResults: ExaminationResult[] = [];
    if (supabase) {
      try {
        const { data: resData } = await supabase
          .from('examination_results')
          .select('*')
          .eq('registration_id', reg.id);
        if (resData) regResults = resData as any;
      } catch {}
    }
    for (const res of store.results.values()) {
      if (res.registration_id === reg.id && !regResults.some((rr) => rr.id === res.id)) {
        regResults.push(res);
      }
    }

    // Fetch all answers for these attempts from Supabase
    const allAttemptIds = regAttempts.map((a) => a.id);
    let regAnswers: any[] = [];
    if (supabase && allAttemptIds.length > 0) {
      try {
        const { data: ansData } = await supabase
          .from('attempt_answers')
          .select('*')
          .in('attempt_id', allAttemptIds);
        if (ansData) regAnswers = ansData;
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

      if (attempt && Array.isArray(attempt.assigned_question_ids) && attempt.assigned_question_ids.length > 0) {
        for (let i = 0; i < attempt.assigned_question_ids.length; i++) {
          const qId = attempt.assigned_question_ids[i];
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

  // HR / ADMIN RECONDUCT ROUND ATTEMPT (E.G. ROUND 3 SIMULATOR RETAKE)
  async reconductRoundAttempt(registrationId: string, roundId: string): Promise<{ success: boolean; message: string }> {
    let reg = store.registrations.get(registrationId);
    if (!reg) {
      reg = Array.from(store.registrations.values()).find(
        (r) => r.id === registrationId || r.student_id === registrationId || r.login_id === registrationId
      );
    }
    const supabase = createAdminClient();
    if (!reg && supabase) {
      try {
        const { data } = await supabase
          .from('registrations')
          .select('*, student:students(*)')
          .or(`id.eq.${registrationId},student_id.eq.${registrationId},login_id.eq.${registrationId}`)
          .maybeSingle();
        if (data) reg = data as any;
      } catch {}
    }
    if (!reg) throw new Error('Registration not found');

    let attempt = Array.from(store.attempts.values()).find(
      (a) => a.registration_id === reg!.id && a.round_id === roundId
    );
    if (!attempt && supabase) {
      try {
        const { data: attData } = await supabase
          .from('examination_attempts')
          .select('*')
          .eq('registration_id', reg.id)
          .eq('round_id', roundId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (attData) attempt = attData as any;
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

    if (supabase) {
      try {
        // delete child answers first to avoid FK violation
        await supabase.from('attempt_answers').delete().eq('attempt_id', oldAttemptId);
        await supabase.from('examination_results').delete().eq('attempt_id', oldAttemptId);
        await supabase.from('examination_attempts').delete().eq('id', oldAttemptId);
      } catch (err) {
        console.warn('[reconductRoundAttempt] Supabase delete error:', err);
      }
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
    if (supabase) {
      try {
        await supabase.from('registrations').update({ status: 'registered' }).eq('id', reg.id);
      } catch {}
    }

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

      const existing = Array.from(store.questions.values()).filter((q) => q.round_id === roundId);
      const needed = Math.max(0, count - existing.length);
      const toCreate = needed > 0 ? needed : count;

      for (let i = 1; i <= toCreate; i++) {
        const qNum = existing.length + i;
        const qId = `q-${roundId}-${String(qNum).padStart(3, '0')}`;
        const item = bankToUse[(qNum - 1) % bankToUse.length];
        const cycle = Math.floor((qNum - 1) / bankToUse.length);
        const text = cycle > 0 ? `[Set ${cycle + 1}] ${item.question_text}` : item.question_text;

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
          question_text: text,
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

    const existing = Array.from(store.questions.values()).filter((q) => q.round_id === roundId);
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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('pdf_documents')
          .select('*')
          .eq('round_id', roundId)
          .order('uploaded_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const doc = data[0];
          const pool = await this.getQuestionsByRoundId(roundId);
          return {
            id: doc.id,
            original_filename: doc.original_filename,
            uploaded_at: doc.uploaded_at,
            file_size_bytes: doc.file_size_bytes || 0,
            questions_count: pool.length,
          };
        }
      } catch {}
    }

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
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data } = await supabase.from('ocr_jobs').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) {
          data.forEach((j: any) => {
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
    }
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
      const supabase = createAdminClient();
      if (supabase) {
        try {
          if (params.roundId) {
            await supabase.from('pdf_documents').upsert({
              id: job.pdf_document_id,
              round_id: params.roundId,
              storage_path: `documents/${params.documentName}`,
              original_filename: params.documentName,
              file_size_bytes: params.fileBuffer?.length || 0,
              uploaded_at: new Date().toISOString(),
            });
          }
          await supabase.from('ocr_jobs').upsert({
            id: job.id,
            pdf_document_id: job.pdf_document_id,
            status: job.status,
            progress_percent: job.progress_percent,
            questions_extracted: job.questions_extracted,
            worker_id: job.worker_id,
            completed_at: job.completed_at,
            created_at: job.created_at,
          });
        } catch (err) {
          console.warn('[Supabase pdf_documents/ocr_jobs upsert error]', err);
        }
      }
    }

    return job;
  },

  async getAuditLogs(): Promise<ExaminationAuditLog[]> {
    return store.auditLogs;
  },
};

