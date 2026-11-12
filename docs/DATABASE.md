# ExamS Database Documentation

> **Platform:** Supabase (PostgreSQL 15) with Row Level Security  
> **Migration runner:** Supabase CLI (`supabase db push` / `supabase migration up`)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tables](#tables)
3. [Row Level Security Policies](#row-level-security-policies)
4. [Functions & Triggers](#functions--triggers)
5. [Indexes](#indexes)
6. [Exam Submission Flow](#exam-submission-flow)
7. [Security Notes](#security-notes)
8. [Running Migrations](#running-migrations)
9. [Seed Data](#seed-data)

---

## Architecture Overview

```
auth.users (Supabase Auth)
     │
     └──► profiles            ← admin/super_admin identity
     
examinations
     │
     ├──► examination_rounds  ← each round has its own timer, marks, strategy
     │         │
     │         ├──► question_banks
     │         │         └──► questions ──► question_options
     │         │                       └──► answer_keys  (admin-only)
     │         │
     │         └──► pdf_documents ──► ocr_jobs
     │
     └──► registrations (students ──►)
               │
               └──► examination_attempts
                         │
                         ├──► attempt_answers
                         ├──► examination_results
                         ├──► round_qualifications
                         └──► cheating_events
```

---

## Tables

### `profiles`
Extends `auth.users` with application-level roles.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | References `auth.users(id)` |
| `full_name` | TEXT | Display name |
| `role` | TEXT | `admin` or `super_admin` |
| `created_at` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last update (auto-managed by trigger) |

> **Auto-created** by the `handle_new_user()` trigger whenever a new user signs up via Supabase Auth.

---

### `examinations`
Top-level exam entity. Contains metadata, scheduling, and global configuration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `name` | TEXT | Full exam name |
| `slug` | TEXT UNIQUE | URL-safe identifier (`/exam/[slug]`) |
| `description` | TEXT | Public-facing description |
| `status` | TEXT | `draft` → `published` → `scheduled` → `live` → `completed` → `archived` |
| `exam_date` | TIMESTAMPTZ | Date/time the exam is administered |
| `start_time` | TIMESTAMPTZ | Scheduled live start time |
| `registration_deadline` | TIMESTAMPTZ | Last moment to register |
| `student_limit` | INTEGER | Cap on registrations (NULL = unlimited) |
| `instructions` | TEXT | Shown to students on instructions page |
| `qualification_config` | JSONB | Reserved for custom qualification logic |
| `show_marks_to_students` | BOOLEAN | Whether students see their score after submission |
| `max_cheating_warnings` | INTEGER | Warnings before auto-termination (default 3) |
| `created_by` | UUID FK | Admin who created the exam |

**Status lifecycle:**

```
draft → published → scheduled → live → completed → archived
         ↑ set by admin    ↑ at exam_date   ↑ after all rounds done
```

---

### `examination_rounds`
Each exam consists of one or more sequential rounds. Students must qualify each round to advance.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `examination_id` | UUID FK | Parent exam |
| `round_number` | INTEGER | 1-based, unique per exam |
| `name` | TEXT | Display name (e.g., "Round 1 — Screening") |
| `duration_minutes` | INTEGER | Attempt time limit |
| `total_questions` | INTEGER | Questions assigned per attempt |
| `marks_per_question` | NUMERIC(5,2) | Marks awarded per correct answer |
| `negative_marks` | NUMERIC(5,2) | Marks deducted per wrong answer |
| `qualifying_marks` | NUMERIC(8,2) | Minimum score to advance |
| `total_marks` | NUMERIC(8,2) | Maximum achievable score |
| `question_selection_strategy` | TEXT | `sequential` or `random` |
| `scheduled_start` | TIMESTAMPTZ | When this specific round goes live |
| `status` | TEXT | `draft` / `active` / `completed` / `cancelled` |
| `auto_qualify` | BOOLEAN | Automatically mark students as qualified when score ≥ qualifying_marks |

---

### `students`
Student identity record. Not linked to `auth.users` — students authenticate using email + roll number only.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `full_name` | TEXT | |
| `email` | TEXT | |
| `roll_number` | TEXT | Assigned identifier |
| `created_at` | TIMESTAMPTZ | |

**Unique constraint:** `(email, roll_number)` — same student cannot appear twice globally.  
**Per-exam uniqueness** of roll_number is enforced at the application/API layer.

---

### `registrations`
Links a student to an exam. Status tracks overall exam progress.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `examination_id` | UUID FK | |
| `student_id` | UUID FK | |
| `registered_at` | TIMESTAMPTZ | |
| `status` | TEXT | `registered` / `started` / `completed` / `disqualified` |

**Unique constraint:** `(examination_id, student_id)` — one registration per student per exam.

---

### `question_banks`
Logical grouping of questions, optionally scoped to a round.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `examination_id` | UUID FK | Owning exam |
| `round_id` | UUID FK | Owning round (nullable) |
| `name` | TEXT | Bank name |

---

### `questions`
Individual exam questions. The `answer_keys` table is separate (admin-only).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `bank_id` | UUID FK | Optional bank grouping |
| `round_id` | UUID FK | The round this question belongs to |
| `question_text` | TEXT | Question body |
| `question_type` | TEXT | `single_choice` / `multiple_choice` / `true_false` |
| `difficulty` | TEXT | `easy` / `medium` / `hard` |
| `marks` | NUMERIC(5,2) | Per-question marks (may differ from round default) |
| `negative_marks` | NUMERIC(5,2) | Per-question deduction |
| `status` | TEXT | `draft` → `pending_review` → `approved` / `rejected` |
| `ocr_confidence` | INTEGER | 0–100, from OCR extraction |
| `image_url` | TEXT | Optional image for the question |
| `explanation` | TEXT | Post-exam explanation (admin-visible) |
| `sort_order` | INTEGER | Used in `sequential` strategy |

---

### `question_options`
Answer choices for a question (A–E, True, False).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `question_id` | UUID FK | |
| `label` | TEXT | `A` / `B` / `C` / `D` / `E` / `True` / `False` |
| `option_text` | TEXT | The option body |
| `sort_order` | INTEGER | Display order |

**Unique constraint:** `(question_id, label)`

---

### `answer_keys`
Correct answers — **admins only**. Never exposed to students via RLS.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `question_id` | UUID FK UNIQUE | One key per question |
| `correct_option_label` | TEXT | The correct label (e.g., `A`) |

Scoring is performed exclusively by the `submit_examination_attempt()` stored function (SECURITY DEFINER).

---

### `pdf_documents`
Uploaded question paper PDFs, stored in Supabase Storage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `round_id` | UUID FK | Associated round |
| `storage_path` | TEXT | Supabase Storage object path |
| `original_filename` | TEXT | |
| `file_size_bytes` | BIGINT | |
| `uploaded_by` | UUID FK | Admin who uploaded |

---

### `ocr_jobs`
Tracks OCR processing of a PDF to extract questions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `pdf_document_id` | UUID FK | |
| `status` | TEXT | `uploaded` → `queued` → `processing` → `completed` / `failed` |
| `progress_percent` | INTEGER | 0–100 |
| `questions_extracted` | INTEGER | Count of questions extracted |
| `error_message` | TEXT | Failure detail |
| `worker_id` | TEXT | Worker/process that handled the job |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |

---

### `examination_attempts`
One row per student per round. Created when the student begins the round.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `registration_id` | UUID FK | |
| `round_id` | UUID FK | |
| `started_at` | TIMESTAMPTZ | When the attempt began |
| `deadline_at` | TIMESTAMPTZ | `started_at + round.duration_minutes` |
| `submitted_at` | TIMESTAMPTZ | When submitted (or timed out) |
| `status` | TEXT | `in_progress` / `submitted` / `timed_out` / `terminated` |
| `assigned_question_ids` | UUID[] | Ordered array of questions for this attempt |
| `cheating_warnings` | INTEGER | Running count |
| `ip_address` | INET | For forensics |
| `user_agent` | TEXT | For forensics |

**Unique constraint:** `(registration_id, round_id)` — one attempt per student per round.

---

### `attempt_answers`
Incrementally saved answers. Upserted on every answer change.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `attempt_id` | UUID FK | |
| `question_id` | UUID FK | |
| `selected_option` | TEXT | Label (e.g., `B`), NULL if unanswered |
| `is_marked_for_review` | BOOLEAN | Student flag |
| `answered_at` | TIMESTAMPTZ | First answered |
| `updated_at` | TIMESTAMPTZ | Last changed |

**Unique constraint:** `(attempt_id, question_id)`

---

### `examination_results`
Computed result after submission. One row per attempt.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `attempt_id` | UUID FK UNIQUE | |
| `registration_id` | UUID FK | |
| `round_id` | UUID FK | |
| `correct_count` | INTEGER | |
| `wrong_count` | INTEGER | |
| `unanswered_count` | INTEGER | |
| `score` | NUMERIC(8,2) | Floored at 0 |
| `total_marks` | NUMERIC(8,2) | From round config |
| `qualifying_marks` | NUMERIC(8,2) | From round config |
| `is_qualified` | BOOLEAN | `score >= qualifying_marks` |
| `evaluated_at` | TIMESTAMPTZ | |

---

### `round_qualifications`
Records whether a student qualified a round and what round comes next.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `registration_id` | UUID FK | |
| `round_id` | UUID FK | |
| `qualified` | BOOLEAN | |
| `next_round_number` | INTEGER | NULL if no next round / not qualified |

**Unique constraint:** `(registration_id, round_id)`

---

### `cheating_events`
Proctoring violation log per attempt.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `attempt_id` | UUID FK | |
| `violation_type` | TEXT | `tab_switch` / `window_blur` / `fullscreen_exit` / `copy_attempt` / `paste_attempt` / `keyboard_shortcut` |
| `warning_number` | INTEGER | Sequential warning number for this attempt |
| `metadata` | JSONB | Additional context (key pressed, timestamp, etc.) |
| `occurred_at` | TIMESTAMPTZ | |

---

### `examination_audit_logs`
Immutable log of admin actions on examinations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `examination_id` | UUID FK | |
| `actor_id` | UUID FK | Admin profile |
| `action` | TEXT | e.g., `exam_published`, `round_started`, `student_disqualified` |
| `metadata` | JSONB | Action-specific context |
| `created_at` | TIMESTAMPTZ | |

---

## Row Level Security Policies

All tables have RLS enabled. The helper function `is_admin()` is a `SECURITY DEFINER` function that returns `true` if the current `auth.uid()` has role `admin` or `super_admin` in `profiles`.

| Table | Admin | Student/Public |
|-------|-------|----------------|
| `profiles` | Full access | Read/update own row |
| `examinations` | Full access | Read `published`, `scheduled`, `live`, `completed` |
| `examination_rounds` | Full access | Read when parent exam is public |
| `students` | Full access | Insert + read (all) |
| `registrations` | Full access | Insert + read own |
| `question_banks` | Full access | None |
| `questions` | Full access | Read `approved` only |
| `question_options` | Full access | Read when question is `approved` |
| **`answer_keys`** | **Full access** | **NO ACCESS** |
| `pdf_documents` | Full access | None |
| `ocr_jobs` | Full access | None |
| `examination_attempts` | Full access | Insert + read + update own |
| `attempt_answers` | Full access | Insert + read + update own |
| `examination_results` | Full access | Read own (after submission) |
| `round_qualifications` | Full access | Read all |
| `cheating_events` | Full access | Insert only |
| `examination_audit_logs` | Full access | None |

> **Critical:** `answer_keys` has zero student access. Scoring is entirely server-side via `submit_examination_attempt()`.

---

## Functions & Triggers

### Triggers

| Trigger | Table | Function | Purpose |
|---------|-------|----------|---------|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` | Auto-create profile on signup |
| `trg_examinations_updated_at` | `examinations` | `update_updated_at()` | Maintain `updated_at` |
| `trg_rounds_updated_at` | `examination_rounds` | `update_updated_at()` | Maintain `updated_at` |
| `trg_questions_updated_at` | `questions` | `update_updated_at()` | Maintain `updated_at` |
| `trg_answer_keys_updated_at` | `answer_keys` | `update_updated_at()` | Maintain `updated_at` |
| `trg_attempt_answers_updated_at` | `attempt_answers` | `update_updated_at()` | Maintain `updated_at` |
| `trg_profiles_updated_at` | `profiles` | `update_updated_at()` | Maintain `updated_at` |

### Stored Functions

#### `submit_examination_attempt(p_attempt_id, p_registration_id, p_round_id) → JSONB`
The core scoring and submission function. **Call only from server-side API with service role key.**

- Locks the attempt row (`FOR UPDATE`) — prevents race conditions / double submission
- Idempotent: re-calling returns existing result without re-scoring
- Evaluates every assigned question against `answer_keys`
- Floors score at 0 (negative scores become 0)
- Writes to `examination_results` and `round_qualifications` with `ON CONFLICT DO NOTHING`
- Returns full result JSON

#### `finalize_expired_attempts() → INTEGER`
Marks all `in_progress` attempts past their `deadline_at` as `timed_out`.  
Called by an external cron job (pg_cron, Supabase Edge Function cron, or external scheduler) every minute.

#### `assign_questions_to_attempt(p_attempt_id, p_round_id) → UUID[]`
Selects questions for an attempt using the round's `question_selection_strategy`:
- `sequential`: ordered by `sort_order ASC, created_at ASC`, limited to `total_questions`
- `random`: shuffled with `ORDER BY random()`, limited to `total_questions`

Writes the array to `examination_attempts.assigned_question_ids`.

#### `record_cheating_event(p_attempt_id, p_violation, p_metadata) → JSONB`
Logs a proctoring violation, increments `cheating_warnings`, and auto-terminates the attempt if the warning count reaches `examinations.max_cheating_warnings`.

#### `log_exam_action(p_examination_id, p_actor_id, p_action, p_metadata)`
Convenience function for writing audit log entries from server-side code.

#### `is_admin() → BOOLEAN`
RLS helper. Returns true if `auth.uid()` has role `admin` or `super_admin`. `SECURITY DEFINER` to avoid RLS recursion.

---

## Indexes

Indexes are grouped by use-case:

| Index | Table | Columns | Rationale |
|-------|-------|---------|-----------|
| `idx_examinations_slug` | `examinations` | `slug` | O(log n) slug lookups for public URLs |
| `idx_examinations_status` | `examinations` | `status` | Dashboard listing by status |
| `idx_examinations_live` | `examinations` | `id` WHERE `status IN ('live','scheduled')` | Partial: only active exams polled |
| `idx_rounds_exam_number` | `examination_rounds` | `(examination_id, round_number)` | Fetching ordered rounds for an exam |
| `idx_students_email` | `students` | `email` | Login validation |
| `idx_registrations_exam_student` | `registrations` | `(examination_id, student_id)` | Duplicate-registration check |
| `idx_questions_round_approved` | `questions` | `(round_id, sort_order)` WHERE `status='approved'` | Pulling questions for an attempt |
| `idx_attempts_deadline` | `examination_attempts` | `deadline_at` WHERE `status='in_progress'` | `finalize_expired_attempts()` scan |
| `idx_attempts_reg_round` | `examination_attempts` | `(registration_id, round_id)` | Student fetching their own attempt |
| `idx_results_round_score` | `examination_results` | `(round_id, score DESC)` | Leaderboard queries |
| `idx_ocr_jobs_active` | `ocr_jobs` | `created_at` WHERE `status IN (...)` | Worker polling for pending jobs |

---

## Exam Submission Flow

```
Student clicks "Submit"
        │
        ▼
POST /api/attempts/[attemptId]/submit
        │
        ├─ Validates session (Supabase Auth cookie)
        ├─ Validates student owns this attempt
        │
        ▼
SELECT submit_examination_attempt(attemptId, registrationId, roundId)
   [Runs as SECURITY DEFINER — has access to answer_keys]
        │
        ├─ 1. FOR UPDATE lock on examination_attempts row
        ├─ 2. Check idempotency (already submitted?)
        ├─ 3. Load round config (marks, negative_marks, qualifying_marks)
        ├─ 4. For each assigned question:
        │       LEFT JOIN attempt_answers → selected_option
        │       LEFT JOIN answer_keys    → correct_option_label
        │       → tally correct / wrong / unanswered
        │       → compute score (floored at 0)
        ├─ 5. is_qualified = score >= qualifying_marks
        ├─ 6. Find next_round_number (if qualified)
        ├─ 7. UPDATE examination_attempts SET status='submitted'
        ├─ 8. INSERT examination_results (ON CONFLICT DO NOTHING)
        ├─ 9. INSERT round_qualifications (ON CONFLICT DO NOTHING)
        └─ 10. RETURN result JSON
        │
        ▼
API route returns result to student
        │
        ▼
Student sees score + qualification status
(if show_marks_to_students = true on the exam)
```

---

## Security Notes

1. **Answer keys are never sent to the browser.** The `answer_keys` table has an RLS policy that blocks all non-admin access. The scoring function runs `SECURITY DEFINER` and is only callable from server-side code with the service role key.

2. **Submit must be server-side.** The `/api/attempts/[attemptId]/submit` route must run with the Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) so it can call `submit_examination_attempt`. This key must **never** be exposed to the browser.

3. **Double-submission prevention.** The `submit_examination_attempt` function uses `SELECT ... FOR UPDATE` to serialize concurrent submissions. `ON CONFLICT DO NOTHING` on result/qualification inserts ensures idempotency.

4. **Cheating detection is advisory.** The client-side proctoring events (tab switch, etc.) are logged but can be spoofed. For high-stakes exams, additional server-side session validation and camera-based proctoring should be added.

5. **Roll number uniqueness per exam** is enforced at the application layer (API validates before inserting a registration) since SQL cannot create a unique constraint spanning two tables.

6. **OCR workers** should use a dedicated service-role key with minimal permissions scoped to `ocr_jobs` and `questions` tables only.

7. **Audit logs are append-only** by design. The RLS policy allows admin full access, but application code should only ever `INSERT` — never `UPDATE` or `DELETE` audit rows.

---

## Running Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase stack
supabase start

# Apply migrations in order
supabase db push

# Or apply individually
supabase migration up

# Reset local DB and re-apply all migrations
supabase db reset
```

Migrations are applied in filename order:
1. `001_initial_schema.sql` — tables and extensions
2. `002_rls_policies.sql` — RLS enable + policies
3. `003_functions_and_triggers.sql` — stored functions and triggers
4. `004_indexes.sql` — performance indexes

---

## Seed Data

The `supabase/seed.sql` file is for **local development only** and inserts:

- 1 sample examination (`sample-engineering-2026`, `draft` status)
- 2 rounds (60-min screening, 90-min advanced)
- 1 question bank
- 5 approved questions with options and answer keys
- 3 sample students with registrations

```bash
# Apply seed data to local DB
supabase db seed

# Or reset + seed in one step
supabase db reset
```

> ⚠️ Never run `seed.sql` against a production database.
