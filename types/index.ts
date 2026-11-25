export type ExamStatus = 'draft' | 'published' | 'scheduled' | 'live' | 'completed' | 'archived' | 'paused';
export type RoundStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type SelectionStrategy = 'sequential' | 'random' | 'difficulty_balanced';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'coding';
export type RoundType = 'mcq' | 'coding' | 'hybrid';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
export type AttemptStatus = 'in_progress' | 'submitted' | 'timed_out' | 'terminated';
export type RegistrationStatus = 'registered' | 'started' | 'completed' | 'disqualified';
export type CheatingViolationType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'keyboard_shortcut';
export type OCRJobStatus = 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed';

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'super_admin';
  created_at: string;
  updated_at: string;
}

export interface RegistrationFieldConfig {
  key: string;            // 'phone' | 'branch' | 'specialization' | 'college' | 'year_of_study'
  label: string;          // e.g. "Phone Number", "Branch / Department", "Specialization"
  required: boolean;      // mandatory for student to submit
  enabled: boolean;       // visible on registration form
}

export interface Examination {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ExamStatus;
  exam_date: string | null;
  start_time: string | null;
  registration_deadline: string | null;
  student_limit: number | null;
  instructions: string | null;
  qualification_config: Record<string, unknown>;
  show_marks_to_students: boolean;
  max_cheating_warnings: number;
  auth_mode?: 'roster' | 'open';
  login_identifier_field?: string;
  login_identifier_label?: string;
  registration_fields?: RegistrationFieldConfig[];
  roster_count?: number;
  remote_pin?: string;
  admission_locked?: boolean;
  emergency_announcement?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  rounds?: ExaminationRound[];
  _count?: {
    registrations?: number;
    rounds?: number;
  };
}

export interface ExaminationRound {
  id: string;
  examination_id: string;
  round_number: number;
  name: string;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marks: number;
  qualifying_marks: number;
  total_marks: number;
  question_selection_strategy: SelectionStrategy;
  scheduled_start: string | null;
  status: RoundStatus;
  auto_qualify: boolean;
  instructions: string | null;
  round_type?: RoundType;
  allow_tab_switch?: boolean;
  allow_copy_paste?: boolean;
  enforce_fullscreen?: boolean;
  coding_language_support?: string[];
  coding_starter_templates?: Record<string, string>;
  min_time_before_submit_minutes?: number;
  success_message?: string;
  failure_message?: string;
  next_round_delay_seconds?: number;
  question_pool_count?: number;
  created_at: string;
  updated_at: string;
  questions_count?: number;
}

export interface Student {
  id: string;
  full_name: string;
  email: string;
  roll_number: string;
  login_id?: string;
  phone?: string;
  branch?: string;
  specialization?: string;
  college?: string;
  year_of_study?: string;
  examination_id?: string;
  attributes?: Record<string, string | number | boolean>;
  created_at: string;
}

export interface Registration {
  id: string;
  examination_id: string;
  student_id: string;
  registered_at: string;
  status: RegistrationStatus;
  login_id?: string;
  student?: Student;
  examination?: Examination;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: 'A' | 'B' | 'C' | 'D' | 'E' | 'True' | 'False';
  option_text: string;
  sort_order: number;
  created_at: string;
}

export interface Question {
  id: string;
  bank_id?: string | null;
  round_id?: string | null;
  question_text: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  marks: number;
  negative_marks: number;
  status: QuestionStatus;
  ocr_confidence?: number | null;
  image_url?: string | null;
  explanation?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  options: QuestionOption[];
  correct_option_label?: string; // only present in admin contexts
}

export interface AnswerKey {
  id: string;
  question_id: string;
  correct_option_label: string;
  created_at: string;
  updated_at: string;
}

export interface ExaminationAttempt {
  id: string;
  registration_id: string;
  round_id: string;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  assigned_question_ids: string[];
  shuffled_option_orders?: Record<string, string[]>;
  cheating_warnings: number;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: string | null;
  code_snippet?: string | null;
  code_language?: 'python' | 'java' | string | null;
  is_marked_for_review: boolean;
  answered_at: string;
  updated_at: string;
}

export interface ExaminationResult {
  id: string;
  attempt_id: string;
  registration_id: string;
  round_id: string;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  score: number;
  total_marks: number;
  qualifying_marks: number;
  is_qualified: boolean;
  evaluated_at: string;
}

export interface RoundQualification {
  id: string;
  registration_id: string;
  round_id: string;
  qualified: boolean;
  next_round_number: number | null;
  scheduled_round_start?: string | null;
  scheduled_round_deadline?: string | null;
  qualified_at: string;
}

export interface CheatingEvent {
  id: string;
  attempt_id: string;
  violation_type: CheatingViolationType;
  warning_number: number;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface ExaminationAuditLog {
  id: string;
  examination_id: string | null;
  actor_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OCRJob {
  id: string;
  pdf_document_id: string;
  status: OCRJobStatus;
  progress_percent: number;
  questions_extracted: number | null;
  error_message: string | null;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  document_name?: string;
  round_name?: string;
}

export interface AdminStats {
  totalExaminations: number;
  totalStudents: number;
  studentsWriting: number;
  totalSubmissions: number;
  qualifiedStudents: number;
  unqualifiedStudents: number;
  pendingOcrJobs: number;
}

