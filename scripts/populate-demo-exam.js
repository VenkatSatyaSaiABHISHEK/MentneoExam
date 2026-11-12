const fs = require('fs');
const path = './data/exams_resilient_store.json';

const raw = fs.readFileSync(path, 'utf8');
const data = JSON.parse(raw);

const demoExamId = 'exam-1794411937843';
const round1Id = 'round-exam-1794411937843-1';
const round2Id = 'round-exam-1794411937843-2';

// Ensure the DEMO exam exists
if (!data.examinations[demoExamId]) {
  data.examinations[demoExamId] = {
    id: demoExamId,
    name: 'DEMO',
    slug: 'demo',
    description: 'DEMO Examination',
    status: 'live',
    exam_date: new Date().toISOString(),
    start_time: new Date().toISOString(),
    registration_deadline: null,
    student_limit: 500,
    instructions: 'Welcome to the examination. Complete Round 1 within the allocated time to qualify for Round 2.',
    qualification_config: {},
    show_marks_to_students: true,
    max_cheating_warnings: 3,
    auth_mode: 'roster',
    login_identifier_field: 'Roll Number',
    login_identifier_label: 'Student Roll Number',
    roster_count: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Update Round 1
data.rounds[round1Id] = {
  id: round1Id,
  examination_id: demoExamId,
  round_number: 1,
  name: 'Round 1: Screening & Core Fundamentals',
  duration_minutes: 45,
  total_questions: 20,
  marks_per_question: 1,
  negative_marks: 0.25,
  qualifying_marks: 8,
  total_marks: 20,
  question_selection_strategy: 'random',
  scheduled_start: null,
  status: 'active',
  auto_qualify: true,
  instructions: 'Answer all 20 questions randomly drawn from the core fundamentals bank. Qualifying marks: 8.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Update Round 2
data.rounds[round2Id] = {
  id: round2Id,
  examination_id: demoExamId,
  round_number: 2,
  name: 'Round 2: Advanced Problem Solving & Synthesis',
  duration_minutes: 60,
  total_questions: 25,
  marks_per_question: 2,
  negative_marks: 0.5,
  qualifying_marks: 20,
  total_marks: 50,
  question_selection_strategy: 'random',
  scheduled_start: null,
  status: 'active',
  auto_qualify: true,
  instructions: 'Answer all 25 questions randomly drawn from the advanced problem solving bank. Qualifying marks: 20.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Clean Professional Academic Question Templates for Round 1 (Screening & Core Fundamentals)
const coreTopics = [
  { q: "Which asymptotic time complexity represents an algorithm that halves the input problem size at every recursive step?", opts: ["O(log N)", "O(N)", "O(N log N)", "O(N^2)"], ans: "A", diff: "easy" },
  { q: "In relational database design, which normal form ensures that all non-key attributes depend entirely on the primary key?", opts: ["First Normal Form (1NF)", "Second Normal Form (2NF)", "Third Normal Form (3NF)", "Boyce-Codd Normal Form (BCNF)"], ans: "B", diff: "medium" },
  { q: "What data structure operates strictly on a Last-In, First-Out (LIFO) model and is commonly used for recursion call stacks?", opts: ["Queue", "Stack", "Binary Heap", "Doubly Linked List"], ans: "B", diff: "easy" },
  { q: "In computer networking, which transport layer protocol provides reliable, ordered, and connection-oriented byte streams?", opts: ["UDP", "TCP", "ICMP", "ARP"], ans: "B", diff: "easy" },
  { q: "What is the worst-case time complexity of standard Quicksort when using an unoptimized pivot selection strategy on an already sorted sequence?", opts: ["O(log N)", "O(N log N)", "O(N^2)", "O(2^N)"], ans: "C", diff: "medium" },
  { q: "Which fundamental object-oriented programming principle restricts direct state modification and mandates interaction through methods?", opts: ["Polymorphism", "Encapsulation", "Inheritance", "Dynamic Dispatch"], ans: "B", diff: "easy" },
  { q: "In Boolean algebra, what is the simplified logical equivalent of the expression: A AND (A OR B)?", opts: ["A", "B", "A AND B", "1"], ans: "A", diff: "medium" },
  { q: "What synchronization mechanism guarantees mutual exclusion among concurrent threads accessing a critical section?", opts: ["Semaphore Flag", "Mutex Lock", "Fork-Join Executor", "Volatile Register"], ans: "B", diff: "medium" },
  { q: "Which memory management condition occurs when total free memory is adequate but divided into non-contiguous blocks that cannot satisfy an allocation request?", opts: ["Internal Fragmentation", "External Fragmentation", "Page Faulting", "Thrashing"], ans: "B", diff: "medium" },
  { q: "In propositional logic, if statement 'P implies Q' is true, which conditional statement is its logically equivalent contrapositive?", opts: ["NOT P implies NOT Q", "NOT Q implies NOT P", "Q implies P", "P implies NOT Q"], ans: "B", diff: "medium" }
];

// Clean Professional Academic Question Templates for Round 2 (Advanced Problem Solving & Synthesis)
const advancedTopics = [
  { q: "Which dynamic programming algorithm computes the all-pairs shortest paths on a directed graph with arbitrary edge weights without negative cycles?", opts: ["Dijkstra's Algorithm", "Floyd-Warshall Algorithm", "Prim's Algorithm", "Kruskal's Algorithm"], ans: "B", diff: "hard" },
  { q: "In distributed system architecture, what trade-off does the CAP theorem mandate during an unavoidable network partition?", opts: ["Consistency cannot be recovered", "The system must choose between Consistency and Availability", "Partitions permanently disable data access", "Availability is strictly enforced over all latencies"], ans: "B", diff: "hard" },
  { q: "Which self-balancing binary search tree maintains balance by ensuring that no two consecutive red nodes appear on any root-to-leaf path?", opts: ["AVL Tree", "Red-Black Tree", "Splay Tree", "B-Tree"], ans: "B", diff: "medium" },
  { q: "In operating system process management, which condition is NOT one of the four necessary Coffman criteria for system deadlock?", opts: ["Mutual Exclusion", "Hold and Wait", "Preemption of Allocated Resources", "Circular Wait"], ans: "C", diff: "hard" },
  { q: "What is the amortized time complexity of the find-set operation in Disjoint Set Union (DSU) using both path compression and union by rank?", opts: ["O(log N)", "O(alpha(N)) Inverse Ackermann", "O(1) strict constant", "O(N)"], ans: "B", diff: "hard" },
  { q: "In transaction processing, which ANSI SQL isolation level prevents dirty reads, non-repeatable reads, and phantom read anomalies?", opts: ["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"], ans: "D", diff: "hard" },
  { q: "Which algorithmic heuristic combines exact path costs from the origin with estimated distances to the destination to optimize search performance?", opts: ["Breadth-First Traversal", "A* Heuristic Search", "Bellman-Ford Relaxation", "Simulated Annealing"], ans: "B", diff: "medium" },
  { q: "Which cache write policy guarantees that data is written synchronously to both the cache and persistent secondary storage simultaneously?", opts: ["Write-Through", "Write-Back", "Write-Around", "Read-Allocate"], ans: "A", diff: "medium" },
  { q: "In cryptographic systems, which mathematical complexity problem establishes the security foundation of Diffie-Hellman key exchange?", opts: ["Subset Sum Problem", "Discrete Logarithm Problem", "Knapsack Decision Problem", "Graph Isomorphism"], ans: "B", diff: "hard" },
  { q: "What is the space complexity of Depth-First Search on a tree with maximum branching factor b and maximum depth d?", opts: ["O(b^d)", "O(b * d)", "O(d^2)", "O(b + d)"], ans: "B", diff: "medium" }
];

// Populate 60 questions for Round 1
for (let i = 1; i <= 60; i++) {
  const qId = `q-demo-r1-${String(i).padStart(3, '0')}`;
  const t = coreTopics[(i - 1) % coreTopics.length];
  const cycle = Math.floor((i - 1) / coreTopics.length);
  const text = cycle > 0 ? `[Set ${cycle + 1}] ${t.q}` : t.q;

  const options = t.opts.map((optText, optIdx) => ({
    id: `opt-${qId}-${String.fromCharCode(65 + optIdx).toLowerCase()}`,
    question_id: qId,
    label: String.fromCharCode(65 + optIdx),
    option_text: optText,
    sort_order: optIdx + 1,
    created_at: new Date().toISOString()
  }));

  data.questions[qId] = {
    id: qId,
    round_id: round1Id,
    question_text: text,
    question_type: 'single_choice',
    difficulty: t.diff,
    marks: 1,
    negative_marks: 0.25,
    status: 'approved',
    sort_order: i,
    options: options,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  data.answerKeys[qId] = {
    id: `ak-${qId}`,
    question_id: qId,
    correct_option_label: t.ans,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Populate 60 questions for Round 2
for (let i = 1; i <= 60; i++) {
  const qId = `q-demo-r2-${String(i).padStart(3, '0')}`;
  const t = advancedTopics[(i - 1) % advancedTopics.length];
  const cycle = Math.floor((i - 1) / advancedTopics.length);
  const text = cycle > 0 ? `[Set ${cycle + 1}] ${t.q}` : t.q;

  const options = t.opts.map((optText, optIdx) => ({
    id: `opt-${qId}-${String.fromCharCode(65 + optIdx).toLowerCase()}`,
    question_id: qId,
    label: String.fromCharCode(65 + optIdx),
    option_text: optText,
    sort_order: optIdx + 1,
    created_at: new Date().toISOString()
  }));

  data.questions[qId] = {
    id: qId,
    round_id: round2Id,
    question_text: text,
    question_type: 'single_choice',
    difficulty: t.diff,
    marks: 2,
    negative_marks: 0.5,
    status: 'approved',
    sort_order: i,
    options: options,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  data.answerKeys[qId] = {
    id: `ak-${qId}`,
    question_id: qId,
    correct_option_label: t.ans,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Add sample OCR job for Round 1 and Round 2
data.ocrJobs['job-ocr-demo-r1'] = {
  id: 'job-ocr-demo-r1',
  pdf_document_id: 'doc-screening-paper',
  status: 'completed',
  progress_percent: 100,
  questions_extracted: 60,
  error_message: null,
  worker_id: 'worker-local-01',
  started_at: new Date(Date.now() - 3600000).toISOString(),
  completed_at: new Date(Date.now() - 3500000).toISOString(),
  created_at: new Date(Date.now() - 3600000).toISOString(),
  document_name: 'Core_Fundamentals_Paper_2026.pdf',
  round_name: 'Round 1: Screening & Core Fundamentals'
};

data.ocrJobs['job-ocr-demo-r2'] = {
  id: 'job-ocr-demo-r2',
  pdf_document_id: 'doc-advanced-paper',
  status: 'completed',
  progress_percent: 100,
  questions_extracted: 60,
  error_message: null,
  worker_id: 'worker-local-01',
  started_at: new Date(Date.now() - 1800000).toISOString(),
  completed_at: new Date(Date.now() - 1700000).toISOString(),
  created_at: new Date(Date.now() - 1800000).toISOString(),
  document_name: 'Advanced_Problem_Solving_Paper_2026.pdf',
  round_name: 'Round 2: Advanced Problem Solving & Synthesis'
};

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully populated DEMO exam Round 1 and Round 2 with 60 questions each and zero quantum labels.');

