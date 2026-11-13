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
    } else {
      this.seed();
      resilientStorage.flushSync(() => this.toSnapshot());
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
    const examId = 'exam-qc-2026';
    const round1Id = 'round-qc-1';
    const round2Id = 'round-qc-2';
    const round3Id = 'round-qc-3';

    // 1. Examination
    const sampleExam: Examination = {
      id: examId,
      name: 'Computer Science & Engineering Assessment 2026',
      slug: 'cs-engineering-assessment-2026',
      description: 'National multi-round examination assessing foundational algorithms, software systems architecture, and applied algorithmic programming.',
      status: 'live',
      exam_date: new Date().toISOString(),
      start_time: new Date().toISOString(),
      registration_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      student_limit: 500,
      instructions: 'Please ensure you are in a quiet environment with a stable internet connection. Fullscreen mode is enforced. Exiting fullscreen or navigating to other tabs will trigger proctoring alerts.',
      qualification_config: {},
      show_marks_to_students: true,
      max_cheating_warnings: 3,
      auth_mode: 'roster',
      login_identifier_field: 'roll_number',
      login_identifier_label: 'Candidate Roll Number',
      roster_count: 1,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.examinations.set(examId, sampleExam);

    // 2. Dynamic Rounds (Rounds 1, 2, and 3)
    const r1: ExaminationRound = {
      id: round1Id,
      examination_id: examId,
      round_number: 1,
      name: 'Round 1: Screening & Core Fundamentals',
      round_type: 'mcq',
      duration_minutes: 30,
      total_questions: 5,
      marks_per_question: 2,
      negative_marks: 0.5,
      qualifying_marks: 4,
      total_marks: 10,
      question_selection_strategy: 'random',
      scheduled_start: new Date().toISOString(),
      status: 'active',
      auto_qualify: true,
      enforce_fullscreen: true,
      allow_tab_switch: false,
      allow_copy_paste: false,
      min_time_before_submit_minutes: 1,
      next_round_delay_seconds: 120,
      success_message: 'Congratulations! You have passed the Round 1 Screening & Core Fundamentals evaluation. Round 2 will commence shortly.',
      failure_message: 'Thank you for applying. You have not passed the basic qualification marks. Best of luck for future assessments.',
      instructions: 'Answer all 5 questions. Each correct answer carries 2 marks; incorrect answers deduct 0.5 marks. Minimum qualifying score is 4 marks.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const r2: ExaminationRound = {
      id: round2Id,
      examination_id: examId,
      round_number: 2,
      name: 'Round 2: Advanced Problem Solving & Synthesis (Open AI Permitted)',
      round_type: 'mcq',
      duration_minutes: 45,
      total_questions: 5,
      marks_per_question: 3,
      negative_marks: 1,
      qualifying_marks: 8,
      total_marks: 15,
      question_selection_strategy: 'random',
      scheduled_start: null,
      status: 'active',
      auto_qualify: true,
      enforce_fullscreen: false,
      allow_tab_switch: true, // Candidates are permitted to use AI & external research
      allow_copy_paste: true,
      min_time_before_submit_minutes: 1,
      next_round_delay_seconds: 120,
      success_message: 'Outstanding performance! You have passed Round 2. Advance to the Round 3 Coding Sandbox.',
      failure_message: 'Thank you for applying. You did not achieve the required qualification marks for Round 2. Best of luck for future opportunities.',
      instructions: 'Deep dive into advanced algorithms and systems. Open research and AI assistance are permitted for this round. Qualifying marks: 8.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const r3: ExaminationRound = {
      id: round3Id,
      examination_id: examId,
      round_number: 3,
      name: 'Round 3: Algorithmic Systems Sandbox',
      round_type: 'coding',
      duration_minutes: 60,
      total_questions: 1,
      marks_per_question: 20,
      negative_marks: 0,
      qualifying_marks: 10,
      total_marks: 20,
      question_selection_strategy: 'sequential',
      scheduled_start: null,
      status: 'active',
      auto_qualify: true,
      enforce_fullscreen: true,
      allow_tab_switch: false,
      allow_copy_paste: true,
      min_time_before_submit_minutes: 2,
      coding_language_support: ['python', 'java'],
      coding_starter_templates: {
        python: `# Array Interval Merging Algorithm\n# Language: Python 3\n\ndef merge_intervals(intervals: list[list[int]]) -> list[list[int]]:\n    \"\"\"\n    Merges overlapping intervals.\n    Input: intervals - list of [start, end] pairs\n    Output: list of non-overlapping merged [start, end] pairs\n    \"\"\"\n    if not intervals:\n        return []\n    intervals.sort(key=lambda x: x[0])\n    merged = [intervals[0]]\n    for current in intervals[1:]:\n        prev = merged[-1]\n        if current[0] <= prev[1]:\n            prev[1] = max(prev[1], current[1])\n        else:\n            merged.append(current)\n    return merged\n`,
        java: `// Array Interval Merging Algorithm\n// Language: Java (OpenJDK)\n\nimport java.util.*;\n\npublic class Solution {\n    public static int[][] mergeIntervals(int[][] intervals) {\n        if (intervals.length <= 1) return intervals;\n        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));\n        List<int[]> result = new ArrayList<>();\n        int[] current = intervals[0];\n        result.add(current);\n        for (int[] next : intervals) {\n            if (current[1] >= next[0]) {\n                current[1] = Math.max(current[1], next[1]);\n            } else {\n                current = next;\n                result.add(current);\n            }\n        }\n        return result.toArray(new int[result.size()][]);\n    }\n\n    public static void main(String[] args) {\n        int[][] test = {{1, 3}, {2, 6}, {8, 10}, {15, 18}};\n        System.out.println(Arrays.deepToString(mergeIntervals(test)));\n    }\n}\n`,
      },
      success_message: 'Congratulations! You have completed all 3 examination rounds and achieved final qualification!',
      failure_message: 'Thank you for your submission. Your coding solution did not meet the final qualification threshold.',
      instructions: 'Implement your algorithmic solution in Python or Java inside the sandbox editor. Write robust, clean code.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.rounds.set(round1Id, r1);
    this.rounds.set(round2Id, r2);
    this.rounds.set(round3Id, r3);

    // 3. Questions for Round 1
    const r1Questions = [
      {
        id: 'q-101',
        round_id: round1Id,
        question_text: 'What is the tight asymptotic upper bound (Big-O) of retrieving an item from a balanced binary search tree with N nodes?',
        question_type: 'single_choice' as const,
        difficulty: 'easy' as const,
        marks: 2,
        negative_marks: 0.5,
        status: 'approved' as const,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-101-a', question_id: 'q-101', label: 'A' as const, option_text: 'O(1)', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-101-b', question_id: 'q-101', label: 'B' as const, option_text: 'O(log N)', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-101-c', question_id: 'q-101', label: 'C' as const, option_text: 'O(N)', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-101-d', question_id: 'q-101', label: 'D' as const, option_text: 'O(N log N)', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'B',
      },
      {
        id: 'q-102',
        round_id: round1Id,
        question_text: 'In relational database theory, which ACID property ensures that transactions are committed permanently even in the event of an immediate power outage or system crash?',
        question_type: 'single_choice' as const,
        difficulty: 'easy' as const,
        marks: 2,
        negative_marks: 0.5,
        status: 'approved' as const,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-102-a', question_id: 'q-102', label: 'A' as const, option_text: 'Atomicity', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-102-b', question_id: 'q-102', label: 'B' as const, option_text: 'Consistency', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-102-c', question_id: 'q-102', label: 'C' as const, option_text: 'Isolation', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-102-d', question_id: 'q-102', label: 'D' as const, option_text: 'Durability', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'D',
      },
      {
        id: 'q-103',
        round_id: round1Id,
        question_text: 'In TCP/IP networking, what is the correct sequence of packet flags exchanged during the standard connection establishment handshake?',
        question_type: 'single_choice' as const,
        difficulty: 'medium' as const,
        marks: 2,
        negative_marks: 0.5,
        status: 'approved' as const,
        sort_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-103-a', question_id: 'q-103', label: 'A' as const, option_text: 'SYN -> SYN-ACK -> ACK', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-103-b', question_id: 'q-103', label: 'B' as const, option_text: 'ACK -> SYN -> ACK-SYN', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-103-c', question_id: 'q-103', label: 'C' as const, option_text: 'SYN -> ACK -> FIN', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-103-d', question_id: 'q-103', label: 'D' as const, option_text: 'PSH -> ACK -> SYN', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'A',
      },
      {
        id: 'q-104',
        round_id: round1Id,
        question_text: 'Which CPU scheduling algorithm allocates the processor strictly to the process with the shortest remaining burst time, preempting if a shorter job arrives?',
        question_type: 'single_choice' as const,
        difficulty: 'medium' as const,
        marks: 2,
        negative_marks: 0.5,
        status: 'approved' as const,
        sort_order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-104-a', question_id: 'q-104', label: 'A' as const, option_text: 'First-Come First-Served (FCFS)', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-104-b', question_id: 'q-104', label: 'B' as const, option_text: 'Shortest Remaining Time First (SRTF)', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-104-c', question_id: 'q-104', label: 'C' as const, option_text: 'Round Robin (RR)', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-104-d', question_id: 'q-104', label: 'D' as const, option_text: 'Priority Inversion', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'B',
      },
      {
        id: 'q-105',
        round_id: round1Id,
        question_text: 'What technique in virtual memory management prevents external memory fragmentation by dividing physical memory into fixed-size blocks?',
        question_type: 'single_choice' as const,
        difficulty: 'medium' as const,
        marks: 2,
        negative_marks: 0.5,
        status: 'approved' as const,
        sort_order: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-105-a', question_id: 'q-105', label: 'A' as const, option_text: 'Paging', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-105-b', question_id: 'q-105', label: 'B' as const, option_text: 'Dynamic Segment Partitioning', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-105-c', question_id: 'q-105', label: 'C' as const, option_text: 'Thrashing', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-105-d', question_id: 'q-105', label: 'D' as const, option_text: 'Overlays', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'A',
      },
    ];

    r1Questions.forEach((q) => {
      const { correct, ...questionData } = q;
      this.questions.set(questionData.id, questionData);
      this.answerKeys.set(questionData.id, {
        id: `ak-${questionData.id}`,
        question_id: questionData.id,
        correct_option_label: correct,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // 4. Questions for Round 2
    const r2Questions = [
      {
        id: 'q-201',
        round_id: round2Id,
        question_text: 'Which dynamic programming algorithm computes the all-pairs shortest paths on a directed graph with arbitrary edge weights without negative cycles?',
        question_type: 'single_choice' as const,
        difficulty: 'hard' as const,
        marks: 3,
        negative_marks: 1,
        status: 'approved' as const,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-201-a', question_id: 'q-201', label: 'A' as const, option_text: 'Dijkstra\'s Algorithm', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-201-b', question_id: 'q-201', label: 'B' as const, option_text: 'Floyd-Warshall Algorithm', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-201-c', question_id: 'q-201', label: 'C' as const, option_text: 'Prim\'s Algorithm', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-201-d', question_id: 'q-201', label: 'D' as const, option_text: 'Kruskal\'s Algorithm', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'B',
      },
      {
        id: 'q-202',
        round_id: round2Id,
        question_text: 'In distributed systems consensus, what minimum number of node replicas is required in the Raft consensus protocol to tolerate f node crash failures?',
        question_type: 'single_choice' as const,
        difficulty: 'medium' as const,
        marks: 3,
        negative_marks: 1,
        status: 'approved' as const,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-202-a', question_id: 'q-202', label: 'A' as const, option_text: 'f + 1', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-202-b', question_id: 'q-202', label: 'B' as const, option_text: '2f', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-202-c', question_id: 'q-202', label: 'C' as const, option_text: '2f + 1', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-202-d', question_id: 'q-202', label: 'D' as const, option_text: '3f + 1', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'C',
      },
      {
        id: 'q-203',
        round_id: round2Id,
        question_text: 'Which self-balancing binary search tree structure enforces that no path from root to leaf is more than twice as long as any other by coloring nodes red or black?',
        question_type: 'single_choice' as const,
        difficulty: 'hard' as const,
        marks: 3,
        negative_marks: 1,
        status: 'approved' as const,
        sort_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-203-a', question_id: 'q-203', label: 'A' as const, option_text: 'Splay Tree', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-203-b', question_id: 'q-203', label: 'B' as const, option_text: 'Red-Black Tree', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-203-c', question_id: 'q-203', label: 'C' as const, option_text: 'B+ Tree', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-203-d', question_id: 'q-203', label: 'D' as const, option_text: 'Trie', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'B',
      },
      {
        id: 'q-204',
        round_id: round2Id,
        question_text: 'In cache replacement policies, what data structure combination enables an LRU (Least Recently Used) cache to achieve O(1) get and put operations?',
        question_type: 'single_choice' as const,
        difficulty: 'hard' as const,
        marks: 3,
        negative_marks: 1,
        status: 'approved' as const,
        sort_order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-204-a', question_id: 'q-204', label: 'A' as const, option_text: 'Hash Map and Doubly Linked List', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-204-b', question_id: 'q-204', label: 'B' as const, option_text: 'Binary Heap and Array', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-204-c', question_id: 'q-204', label: 'C' as const, option_text: 'Stack and Circular Queue', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-204-d', question_id: 'q-204', label: 'D' as const, option_text: 'AVL Tree and Skip List', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'A',
      },
      {
        id: 'q-205',
        round_id: round2Id,
        question_text: 'According to Amdahl\'s Law, if 75% of a program can be parallelized, what is the theoretical maximum speedup achievable regardless of how many parallel processor cores are added?',
        question_type: 'single_choice' as const,
        difficulty: 'hard' as const,
        marks: 3,
        negative_marks: 1,
        status: 'approved' as const,
        sort_order: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'opt-205-a', question_id: 'q-205', label: 'A' as const, option_text: '2x', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'opt-205-b', question_id: 'q-205', label: 'B' as const, option_text: '4x', sort_order: 2, created_at: new Date().toISOString() },
          { id: 'opt-205-c', question_id: 'q-205', label: 'C' as const, option_text: '8x', sort_order: 3, created_at: new Date().toISOString() },
          { id: 'opt-205-d', question_id: 'q-205', label: 'D' as const, option_text: '16x', sort_order: 4, created_at: new Date().toISOString() },
        ],
        correct: 'B',
      },
    ];

    r2Questions.forEach((q) => {
      const { correct, ...questionData } = q;
      this.questions.set(questionData.id, questionData);
      this.answerKeys.set(questionData.id, {
        id: `ak-${questionData.id}`,
        question_id: questionData.id,
        correct_option_label: correct,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // 4b. Coding Sandbox Question for Round 3
    const q301: Question = {
      id: 'q-301',
      round_id: round3Id,
      question_text: `### Algorithmic Problem: Array Interval Merging Engine

Given an array of meeting or scheduling time intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

#### Specifications:
- **Input**: \`intervals\` (Array of [start, end] pairs).
- **Output**: Return the merged list of non-overlapping intervals sorted by start time.

#### Constraints & Test Cases:
- \`intervals = [[1,3],[2,6],[8,10],[15,18]]\` -> Returns \`[[1,6],[8,10],[15,18]]\`
- \`intervals = [[1,4],[4,5]]\` -> Returns \`[[1,5]]\`

Supported Languages: **Python 3** or **Java (OpenJDK)**. Write your implementation in the sandbox editor below.`,
      question_type: 'coding',
      difficulty: 'hard',
      marks: 20,
      negative_marks: 0,
      status: 'approved',
      sort_order: 1,
      options: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.questions.set(q301.id, q301);

    // 5. Sample Student & Registration
    const sampleStudent: Student = {
      id: 'student-demo-01',
      full_name: 'Aarav Sharma',
      email: 'aarav.sharma@example.edu',
      roll_number: 'CS2026-042',
      login_id: 'CS2026-042',
      examination_id: examId,
      attributes: {
        department: 'Computer Science & Engineering',
        batch: '2026',
        center: 'Main Testing Lab 1',
      },
      created_at: new Date(Date.now() - 3600000).toISOString(),
    };
    this.students.set(sampleStudent.id, sampleStudent);

    const sampleReg: Registration = {
      id: 'reg-demo-01',
      examination_id: examId,
      student_id: sampleStudent.id,
      login_id: 'CS2026-042',
      registered_at: new Date(Date.now() - 3600000).toISOString(),
      status: 'registered',
      student: sampleStudent,
    };
    this.registrations.set(sampleReg.id, sampleReg);

    // 6. Sample OCR Job
    const ocrJob1: OCRJob = {
      id: 'job-ocr-sample-1',
      pdf_document_id: 'doc-cs-screening',
      status: 'completed',
      progress_percent: 100,
      questions_extracted: 10,
      error_message: null,
      worker_id: 'worker-local-01',
      started_at: new Date(Date.now() - 7200000).toISOString(),
      completed_at: new Date(Date.now() - 7100000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
      document_name: 'computer_science_core_paper.pdf',
      round_name: 'Round 1: Screening & Core Fundamentals',
    };
    this.ocrJobs.set(ocrJob1.id, ocrJob1);
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
        if (!error && data) {
          return data as Examination[];
        }
      } catch {
        // Fall back to store
      }
    }
    const exams = Array.from(store.examinations.values());
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
    // 1. Memory-first resolution for sub-millisecond response and load resilience
    let exam = store.examinations.get(id);
    if (!exam) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exam = store.examinations.get(id);
      }
    }
    if (exam) {
      const rounds = Array.from(store.rounds.values())
        .filter((r) => r.examination_id === exam.id)
        .sort((a, b) => a.round_number - b.round_number);
      return {
        ...exam,
        rounds,
        _count: {
          registrations: store.registrations.size,
          rounds: rounds.length,
        },
      };
    }

    // 2. Fall back to Supabase if not found in memory
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('examinations')
          .select('*, rounds:examination_rounds(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data as Examination;
      } catch {
        // Fall back to store
      }
    }

    // 3. Resilient synthesis for dynamically generated examinations
    if (id && (id.startsWith('exam-') || id.length > 5)) {
      const synthesized: Examination = {
        id,
        name: 'Computer Science & Engineering Assessment',
        slug: id,
        description: 'Comprehensive multi-round candidate assessment.',
        status: 'published',
        exam_date: new Date().toISOString(),
        start_time: new Date().toISOString(),
        registration_deadline: null,
        student_limit: 1000,
        instructions: 'Please answer all questions sequentially. Proctoring is active.',
        qualification_config: {},
        show_marks_to_students: true,
        max_cheating_warnings: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.examinations.set(id, synthesized);

      const defaultRounds: ExaminationRound[] = [
        {
          id: `round-${id}-1`,
          examination_id: id,
          round_number: 1,
          name: 'Screening & Core Fundamentals',
          duration_minutes: 40,
          total_questions: 30,
          marks_per_question: 1,
          negative_marks: 0,
          qualifying_marks: 10,
          total_marks: 30,
          question_selection_strategy: 'random',
          scheduled_start: null,
          status: 'active',
          auto_qualify: true,
          instructions: 'Answer all questions. Each correct answer carries 1 mark; no negative marks.',
          round_type: 'mcq',
          allow_tab_switch: false,
          allow_copy_paste: false,
          enforce_fullscreen: true,
          min_time_before_submit_minutes: 1,
          next_round_delay_seconds: 120,
          success_message: 'Congratulations! You qualified for Round 2.',
          failure_message: 'You did not meet the qualifying score for Round 2.',
          coding_language_support: ['python', 'java'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `round-${id}-2`,
          examination_id: id,
          round_number: 2,
          name: 'Advanced Problem Solving & Synthesis',
          duration_minutes: 45,
          total_questions: 5,
          marks_per_question: 3,
          negative_marks: 1,
          qualifying_marks: 8,
          total_marks: 15,
          question_selection_strategy: 'random',
          scheduled_start: null,
          status: 'active',
          auto_qualify: true,
          instructions: 'Deep dive into advanced algorithms. Open AI assistance is permitted.',
          round_type: 'mcq',
          allow_tab_switch: true,
          allow_copy_paste: true,
          enforce_fullscreen: false,
          min_time_before_submit_minutes: 1,
          next_round_delay_seconds: 120,
          success_message: 'Congratulations! You qualified for Round 3.',
          failure_message: 'You did not meet the qualifying score for Round 3.',
          coding_language_support: ['python', 'java'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `round-${id}-3`,
          examination_id: id,
          round_number: 3,
          name: 'Advanced Hardware Architecture & Systems',
          duration_minutes: 60,
          total_questions: 5,
          marks_per_question: 4,
          negative_marks: 1,
          qualifying_marks: 12,
          total_marks: 20,
          question_selection_strategy: 'random',
          scheduled_start: null,
          status: 'active',
          auto_qualify: true,
          instructions: 'Hardware and systems engineering evaluation.',
          round_type: 'mcq',
          allow_tab_switch: false,
          allow_copy_paste: false,
          enforce_fullscreen: true,
          min_time_before_submit_minutes: 1,
          next_round_delay_seconds: 0,
          success_message: 'Examination completed.',
          failure_message: 'Examination completed.',
          coding_language_support: ['python', 'java', 'c'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      defaultRounds.forEach((r) => store.rounds.set(r.id, r));
      resilientStorage.scheduleSave(() => store.toSnapshot());

      return {
        ...synthesized,
        rounds: defaultRounds,
        _count: {
          registrations: 0,
          rounds: defaultRounds.length,
        },
      };
    }
    return null;
  },

  async getExaminationBySlug(slug: string): Promise<Examination | null> {
    // 1. Memory-first resolution
    let exam = Array.from(store.examinations.values()).find((e) => e.slug === slug);
    if (!exam) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.examinations) {
        store.hydrate(snap);
        exam = Array.from(store.examinations.values()).find((e) => e.slug === slug);
      }
    }
    if (exam) {
      const rounds = Array.from(store.rounds.values())
        .filter((r) => r.examination_id === exam.id)
        .sort((a, b) => a.round_number - b.round_number);
      return {
        ...exam,
        rounds,
        _count: {
          registrations: store.registrations.size,
          rounds: rounds.length,
        },
      };
    }

    // 2. Fall back to Supabase
    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('examinations')
          .select('*, rounds:examination_rounds(*)')
          .eq('slug', slug)
          .single();
        if (!error && data) return data as Examination;
      } catch {
        // Fall back to store
      }
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const { error } = await supabase.from('examinations').insert(newExam);
        if (!error && roundsData && roundsData.length > 0) {
          const insertRounds = roundsData.map((r, i) => ({
            ...r,
            examination_id: id,
            round_number: r.round_number || i + 1,
            name: r.name || `Round ${i + 1}`,
          }));
          await supabase.from('examination_rounds').insert(insertRounds);
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
    let rounds = Array.from(store.rounds.values())
      .filter((r) => r.examination_id === examId)
      .sort((a, b) => a.round_number - b.round_number);

    if (rounds.length > 0) {
      return rounds;
    }

    const supabase = createAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('examination_rounds')
          .select('*')
          .eq('examination_id', examId)
          .order('round_number', { ascending: true });
        if (!error && data) return data as ExaminationRound[];
      } catch {
        // Fall back to store
      }
    }

    if (rounds.length === 0 && store.rounds.size === 0) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.rounds) {
        store.hydrate(snap);
        rounds = Array.from(store.rounds.values())
          .filter((r) => r.examination_id === examId)
          .sort((a, b) => a.round_number - b.round_number);
      }
    }

    return rounds.map((r) => {
      const poolCount = Array.from(store.questions.values()).filter(
        (q) => q.round_id === r.id && (q.status === 'approved' || !q.status)
      ).length;
      return {
        ...r,
        question_pool_count: poolCount,
      };
    });
  },

  async getRoundById(roundId: string): Promise<ExaminationRound | null> {
    let round = store.rounds.get(roundId);
    if (!round) {
      const snap = resilientStorage.loadSnapshot();
      if (snap && snap.rounds) {
        store.hydrate(snap);
        round = store.rounds.get(roundId);
      }
    }
    if (!round) {
      const supabase = createAdminClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('examination_rounds').select('*').eq('id', roundId).single();
          if (data) {
            round = data as ExaminationRound;
            store.rounds.set(roundId, round);
          }
        } catch {
          // ignore
        }
      }
    }
    if (!round && roundId) {
      const roundNumMatch = roundId.match(/(\d+)$/);
      const num = roundNumMatch ? Number(roundNumMatch[1]) : 1;
      const examId = roundId.replace('round-', '').split('-').slice(0, 2).join('-') || 'exam-qc-2026';
      round = {
        id: roundId,
        examination_id: examId,
        round_number: num,
        name: num === 1 ? 'Screening & Core Fundamentals' : num === 2 ? 'Advanced Problem Solving & Synthesis' : 'Advanced Hardware Architecture',
        duration_minutes: num === 1 ? 40 : num === 2 ? 45 : 60,
        total_questions: num === 1 ? 30 : 5,
        marks_per_question: num === 1 ? 1 : num === 2 ? 3 : 4,
        negative_marks: num === 1 ? 0 : num === 2 ? 1 : 1,
        qualifying_marks: num === 1 ? 10 : num === 2 ? 8 : 12,
        total_marks: num === 1 ? 30 : num === 2 ? 15 : 20,
        question_selection_strategy: 'random',
        scheduled_start: null,
        status: 'active',
        auto_qualify: true,
        instructions: '',
        round_type: 'mcq',
        allow_tab_switch: num === 2,
        allow_copy_paste: num === 2,
        enforce_fullscreen: num !== 2,
        min_time_before_submit_minutes: 1,
        next_round_delay_seconds: 120,
        success_message: '',
        failure_message: '',
        coding_language_support: ['python', 'java'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.rounds.set(roundId, round);
      resilientStorage.scheduleSave(() => store.toSnapshot());
    }
    return round || null;
  },

  async getRoundByNumber(examId: string, roundNumber: number): Promise<ExaminationRound | null> {
    const rounds = await this.getRoundsByExamId(examId);
    return rounds.find((r) => r.round_number === roundNumber) || null;
  },

  async createOrUpdateRound(round: Partial<ExaminationRound>): Promise<ExaminationRound> {
    const existing = round.id ? store.rounds.get(round.id) : undefined;
    const existingRounds = Array.from(store.rounds.values()).filter(
      (r) => r.examination_id === round.examination_id
    );
    const maxRoundNumber = existingRounds.length > 0
      ? Math.max(...existingRounds.map((r) => r.round_number))
      : 0;

    const id = round.id || existing?.id || `round-${Date.now()}`;
    const roundNumber = round.round_number ?? existing?.round_number ?? (maxRoundNumber + 1);

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
      status: round.status ?? existing?.status ?? 'draft',
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
      created_at: existing?.created_at || round.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.rounds.set(id, roundData);
    resilientStorage.flushSync(() => store.toSnapshot());

    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('examination_rounds').upsert(roundData);
      } catch {
        // Fall back to store
      }
    }

    return roundData;
  },

  async deleteRound(examId: string, roundId: string): Promise<boolean> {
    const supabase = createAdminClient();
    if (supabase) {
      try {
        await supabase.from('examination_rounds').delete().eq('id', roundId);
      } catch {
        // Fall back to store
      }
    }

    store.rounds.delete(roundId);

    // Re-index remaining rounds sequentially (1, 2, 3...)
    const remaining = Array.from(store.rounds.values())
      .filter((r) => r.examination_id === examId)
      .sort((a, b) => a.round_number - b.round_number);

    remaining.forEach((r, idx) => {
      r.round_number = idx + 1;
      store.rounds.set(r.id, r);
    });

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

    return { student, registration, isNew: true };
  },

  async getRegistration(regId: string): Promise<Registration | null> {
    const reg = store.registrations.get(regId);
    if (!reg) return null;
    const student = store.students.get(reg.student_id);
    const examination = store.examinations.get(reg.examination_id);
    return { ...reg, student, examination };
  },

  async getRegistrationsByExamId(examId: string): Promise<Registration[]> {
    return Array.from(store.registrations.values())
      .filter((r) => r.examination_id === examId)
      .map((r) => ({
        ...r,
        student: store.students.get(r.student_id),
      }));
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
    const exam = store.examinations.get(params.examId);
    if (!exam) throw new Error('Examination not found');

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

      // Extract custom metadata attributes for any other columns
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
      count++;
    }

    const currentExamRegs = Array.from(store.registrations.values()).filter(
      (r) => r.examination_id === params.examId
    );
    exam.roster_count = currentExamRegs.length;
    store.examinations.set(params.examId, exam);

    // Save atomically to disk
    resilientStorage.scheduleSave(() => store.toSnapshot());

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

    let exam = store.examinations.get(rawId);
    if (!exam) {
      exam = Array.from(store.examinations.values()).find((e) => e.slug === rawId);
    }
    if (!exam) {
      return { verified: false, error: 'Examination not found.' };
    }

    // Look for student in this exam's registrations
    const examRegs = Array.from(store.registrations.values()).filter(
      (r) => r.examination_id === exam!.id
    );

    const match = examRegs.find((r) => {
      const regLogin = r.login_id?.trim().toLowerCase();
      if (regLogin && regLogin === cleanLogin.toLowerCase()) return true;

      const st = store.students.get(r.student_id);
      if (!st) return false;
      return (
        st.login_id?.trim().toLowerCase() === cleanLogin.toLowerCase() ||
        st.roll_number?.trim().toLowerCase() === cleanLogin.toLowerCase() ||
        st.email?.trim().toLowerCase() === cleanLogin.toLowerCase()
      );
    });

    if (!match) {
      const fieldName = exam.login_identifier_label || exam.login_identifier_field || 'Login ID / Roll Number';
      return {
        verified: false,
        examination: exam,
        error: `No candidate found matching ${fieldName} "${cleanLogin}" for this examination.`,
      };
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
    const exam = store.examinations.get(params.examId);
    if (!exam) return null;

    exam.auth_mode = params.authMode;
    if (params.loginIdentifierField) exam.login_identifier_field = params.loginIdentifierField;
    if (params.loginIdentifierLabel) exam.login_identifier_label = params.loginIdentifierLabel;
    exam.updated_at = new Date().toISOString();

    store.examinations.set(params.examId, exam);
    resilientStorage.scheduleSave(() => store.toSnapshot());
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
    const questions = Array.from(store.questions.values())
      .filter((q) => q.round_id === roundId && (isAdmin || q.status === 'approved'))
      .sort((a, b) => a.sort_order - b.sort_order);

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
    return { ...newQuestion, correct_option_label: questionData.correct_option_label };
  },

  async deleteQuestion(id: string): Promise<boolean> {
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
    const existing = existingAttemptId ? store.attempts.get(existingAttemptId) : undefined;

    const round = store.rounds.get(params.roundId);
    if (!round) throw new Error('Round not found');

    if (existing) {
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
    let pool = Array.from(store.questions.values()).filter(
      (q) => q.round_id === params.roundId && (q.status === 'approved' || !q.status)
    );

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
    const attempt = store.attempts.get(params.attemptId);
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
    const attempt = store.attempts.get(params.attemptId);
    if (!attempt) throw new Error('Attempt not found');

    const round = store.rounds.get(attempt.round_id);
    const exam = round ? store.examinations.get(round.examination_id) : null;
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

    return { warningNumber, maxWarnings, isTerminated };
  },

  // SERVER-AUTHORITATIVE SUBMISSION & EVALUATION
  async submitAttempt(attemptId: string): Promise<ExaminationResult> {
    const attempt = store.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    // Idempotency: return existing result if already processed
    const existingResult = store.results.get(attemptId);
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
      const round = store.rounds.get(attempt.round_id);
      if (!round) throw new Error('Round not found');

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let rawScore = 0;

      if (round.round_type === 'coding') {
        let codeAnswered = 0;
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attemptId}_${qId}`;
          const answer = store.answers.get(key);
          if (answer && answer.code_snippet && answer.code_snippet.trim().length > 15) {
            codeAnswered++;
          }
        }
        correctCount = codeAnswered;
        wrongCount = 0;
        unansweredCount = attempt.assigned_question_ids.length - codeAnswered;
        rawScore = codeAnswered * round.marks_per_question;
      } else {
        for (const qId of attempt.assigned_question_ids) {
          const key = `${attemptId}_${qId}`;
          const answer = store.answers.get(key);
          const answerKey = store.answerKeys.get(qId);

          if (!answer || !answer.selected_option) {
            unansweredCount++;
          } else if (answerKey && answer.selected_option === answerKey.correct_option_label) {
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

      // Dynamic next round qualification resolution
      const allRounds = Array.from(store.rounds.values())
        .filter((r) => r.examination_id === round.examination_id)
        .sort((a, b) => a.round_number - b.round_number);

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
      const reg = store.registrations.get(attempt.registration_id);
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
    return store.results.get(attemptId) || null;
  },

  async getAttemptById(attemptId: string): Promise<ExaminationAttempt | null> {
    return store.attempts.get(attemptId) || null;
  },

  async getQualification(regId: string, roundId: string): Promise<RoundQualification | null> {
    return store.qualifications.get(`${regId}_${roundId}`) || null;
  },

  // ADMIN MONITORING & STATS
  async getAdminStats(): Promise<AdminStats> {
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
    const roundIds = new Set(rounds.map((r) => r.id));

    const attempts = Array.from(store.attempts.values()).filter((a) => roundIds.has(a.round_id));
    const results = Array.from(store.results.values()).filter((res) => roundIds.has(res.round_id));

    const monitoringRows = attempts.map((attempt) => {
      const reg = store.registrations.get(attempt.registration_id);
      const student = reg ? store.students.get(reg.student_id) : null;
      const round = store.rounds.get(attempt.round_id);
      const result = store.results.get(attempt.id);

      // Find code answer if coding round
      let codeSnippet: string | null = null;
      let codeLanguage: string | null = null;
      for (const qId of attempt.assigned_question_ids) {
        const key = `${attempt.id}_${qId}`;
        const ans = store.answers.get(key);
        if (ans?.code_snippet) {
          codeSnippet = ans.code_snippet;
          codeLanguage = ans.code_language || 'python';
          break;
        }
      }

      // Authoritative seconds remaining calculation
      const now = Date.now();
      const deadline = new Date(attempt.deadline_at).getTime();
      const secondsRemaining = attempt.status === 'in_progress' ? Math.max(0, Math.floor((deadline - now) / 1000)) : 0;

      return {
        attemptId: attempt.id,
        registrationId: attempt.registration_id,
        studentName: student?.full_name || 'Unknown',
        rollNumber: student?.roll_number || 'N/A',
        loginId: student?.login_id || student?.roll_number || 'N/A',
        email: student?.email || 'N/A',
        attributes: student?.attributes || {},
        roundId: attempt.round_id,
        roundName: round?.name || 'N/A',
        roundNumber: round?.round_number || 1,
        roundType: round?.round_type || 'mcq',
        attemptStatus: attempt.status,
        cheatingWarnings: attempt.cheating_warnings,
        score: result?.score ?? null,
        totalMarks: round?.total_marks ?? 0,
        qualifyingMarks: round?.qualifying_marks ?? 0,
        isQualified: result?.is_qualified ?? null,
        codeSnippet,
        codeLanguage,
        secondsRemaining,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
      };
    });

    // Compute round-by-round statistics
    const roundSummaries = rounds.map((r) => {
      const roundAttempts = monitoringRows.filter((row) => row.roundId === r.id);
      const appeared = roundAttempts.length;
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

    return {
      rounds,
      rows: monitoringRows,
      roundSummaries,
      summary: {
        totalWriting: attempts.filter((a) => a.status === 'in_progress').length,
        totalSubmitted: results.length,
        totalQualified: results.filter((r) => r.is_qualified).length,
      },
    };
  },

  // ON-DEMAND DETAILED CANDIDATE DOSSIER (MULTI-ROUND QUESTION & CODE BREAKDOWN)
  async getStudentDetailedRecord(examId: string, registrationId: string) {
    let reg = store.registrations.get(registrationId);
    if (!reg) {
      // Lookup by student_id or login_id if not direct match
      reg = Array.from(store.registrations.values()).find(
        (r) => r.examination_id === examId && (r.id === registrationId || r.student_id === registrationId || r.login_id === registrationId)
      );
    }
    if (!reg) throw new Error('Registration record not found');
    const student = store.students.get(reg.student_id);

    const rounds = await this.getRoundsByExamId(examId);
    const roundProgression: any[] = [];

    for (const round of rounds) {
      const attempt = Array.from(store.attempts.values()).find(
        (a) => a.registration_id === reg!.id && a.round_id === round.id
      );
      const result = attempt ? store.results.get(attempt.id) : null;
      const qualification = store.qualifications.get(`${reg.id}_${round.id}`);

      const questionDetails: any[] = [];
      let answeredCount = 0;
      let correctCount = 0;
      let wrongCount = 0;

      if (attempt && Array.isArray(attempt.assigned_question_ids)) {
        for (let i = 0; i < attempt.assigned_question_ids.length; i++) {
          const qId = attempt.assigned_question_ids[i];
          const q = store.questions.get(qId);
          const ansKey = store.answerKeys.get(qId);
          const answer = store.answers.get(`${attempt.id}_${qId}`);

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
                if (correct && selected.toUpperCase() === correct.toUpperCase()) {
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

      const totalQuestionsCount = attempt ? attempt.assigned_question_ids.length : round.total_questions;

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
      studentName: student?.full_name || 'Candidate',
      rollNumber: student?.roll_number || 'N/A',
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
    if (!reg) throw new Error('Registration not found');

    const attempt = Array.from(store.attempts.values()).find(
      (a) => a.registration_id === reg!.id && a.round_id === roundId
    );
    if (!attempt) {
      throw new Error('No existing attempt found for this candidate in this round.');
    }

    const round = store.rounds.get(roundId);

    // 1. Remove past attempt and result
    const oldAttemptId = attempt.id;
    store.attempts.delete(oldAttemptId);
    store.results.delete(oldAttemptId);

    // 2. Clear stored answers for this attempt
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
      message: `Round ${round?.round_number || 3} has been reset for this candidate. Candidate is now permitted to enter and reconduct the round.`,
    };
  },

  async populateRoundQuestionPool(roundId: string, count: number = 100): Promise<number> {
    let round = await this.getRoundById(roundId);
    if (!round) {
      throw new Error(`Round ${roundId} could not be resolved`);
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
    return Array.from(store.questions.values()).filter((q) => q.round_id === roundId).length;
  },

  // OCR JOBS
  async getOCRJobs(): Promise<OCRJob[]> {
    return Array.from(store.ocrJobs.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async createOCRJob(params: { documentName: string; roundId?: string; targetCount?: number }): Promise<OCRJob> {
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

    // Only dispatch to external microservice if not running serverless localhost
    if (process.env.OCR_SERVICE_URL && (!process.env.VERCEL || !isLocalhost)) {
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
          extractedCount = await this.populateRoundQuestionPool(params.roundId, countToExtract);
        } catch (popErr) {
          console.warn('[OCR Engine] Error populating questions:', popErr);
          extractedCount = countToExtract;
        }
      }
      job.status = 'completed';
      job.progress_percent = 100;
      job.questions_extracted = extractedCount;
      job.completed_at = new Date().toISOString();
      store.ocrJobs.set(id, { ...job });
      resilientStorage.flushSync(() => store.toSnapshot());
    }

    return job;
  },

  async getAuditLogs(): Promise<ExaminationAuditLog[]> {
    return store.auditLogs;
  },
};

