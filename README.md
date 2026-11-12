# ExamS: Multi-Round Examination & Student Qualification Platform

ExamS is a production-oriented, responsive web application for conducting concurrent multi-round examinations (200+ students), automatically evaluating submissions with server-side authoritative scoring, qualifying candidates through database-driven thresholds, and monitoring active sessions with proctoring deterrence.

---

## 1. Architectural Highlights

- **Pure Google-Inspired Minimalist Design System**: Pure white backgrounds (`#FFFFFF`), subtle borders (`#E5E7EB`), Inter typography, minimal shadows, clean rounded containers, Lucide icons, and zero emojis.
- **Dynamic Multi-Round Architecture**: Configure unlimited sequential rounds (Round 1, Round 2, Round 3, ... N). Never hardcoded. Each round possesses independent timing, marks per question, negative marking, question selection strategy, and qualifying marks.
- **Server-Authoritative Clock & Deadlines**: Deadlines are computed and stored in UTC on the server (`deadline_at = started_at + duration`). Browser refresh, tab reopening, or client-side JavaScript tampering cannot extend examination duration.
- **Transactional Server Evaluation**: Scoring against answer keys occurs exclusively on the backend. Multiple submission clicks are idempotent; scores are floored at 0; qualification decisions unlock next stages automatically.
- **Browser-Level Anti-Cheating Telemetry**: Actively monitors `visibilitychange` (tab switches), `blur` (window focus loss), fullscreen exit, prohibited shortcuts (`F12`, `PrintScreen`, `Ctrl+U`), and copy/paste operations with configurable warning limits (default 3 warnings before auto-termination).
- **OCR PDF Question Pipeline**: PyMuPDF and PaddleOCR background service parses multiple-page question paper PDFs into structured MCQ questions, options, and answer keys with an administrative review interface.

---

## 2. Technology Stack

- **Frontend**: Next.js 16 (App Router, Turbopack, Partial Prerendering), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide Icons, Sonner.
- **Backend & Database**: PostgreSQL 15 via Supabase, Row-Level Security (RLS) policies, Stored Functions (`submit_examination_attempt`, `finalize_expired_attempts`, `record_cheating_event`).
- **OCR Worker**: Python 3, FastAPI, PyMuPDF (fitz), PaddleOCR, Uvicorn.
- **Deployment**: Next.js on Vercel / Cloudflare Pages; Supabase managed PostgreSQL; Dockerized OCR service.

---

## 3. Application Routes

### Student Examination Portal
- `/exam` — Public catalog of published and scheduled examinations with status indicators.
- `/exam/[examSlug]` — Examination landing & candidate registration (enforces per-examination roll number uniqueness).
- `/exam/[examSlug]/instructions` — Environment check, proctoring guidelines, and terms agreement.
- `/exam/[examSlug]/round/[roundNumber]` — High-stakes examination engine with authoritative countdown timer, question palette, autosave, and proctoring sensor.
- `/exam/[examSlug]/result` — Automated server-side qualification outcome, score breakdown, and next-round navigation.

### Administrator Console
- `/exam/admin` — Executive overview dashboard with real-time candidate metrics and round statuses.
- `/exam/admin/examinations` — Complete lifecycle management (draft, published, scheduled, live, completed, archived).
- `/exam/admin/examinations/create` — Examination creator with dynamic multi-round builder.
- `/exam/admin/examinations/[examId]` — Detailed examination profile and shareable candidate link generator.
- `/exam/admin/examinations/[examId]/rounds` — Dynamic round configuration, duration, marking rules, and qualification criteria.
- `/exam/admin/examinations/[examId]/students` — Candidate admission roster and CSV export.
- `/exam/admin/examinations/[examId]/results` — Live telemetry table with real-time attempt statuses, proctoring warnings, and scores.
- `/exam/admin/questions` — Central question bank and PDF OCR import/review interface.
- `/exam/admin/settings` — Proctoring warning thresholds, session timeouts, and immutable audit logs.

---

## 4. Getting Started

### Prerequisites
- Node.js 20+
- Python 3.10+ (for OCR service)
- Supabase account or local PostgreSQL instance

### Installation

```bash
# Install frontend dependencies
npm install

# Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` to launch the platform.

### Starting the OCR Worker Service (Optional for PDF Ingestion)

```bash
cd apps/ocr-service
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 5. Environment Configuration

Create `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OCR Service Integration
OCR_SERVICE_URL=http://localhost:8000
OCR_SERVICE_SECRET=change-this-to-a-secure-random-string
```

---

## 6. Database Migrations

Apply SQL migrations located in `supabase/migrations/`:
1. `001_initial_schema.sql` — Normalized database tables and constraints.
2. `002_rls_policies.sql` — Row Level Security policies (securing answer keys from students).
3. `003_functions_and_triggers.sql` — Stored procedures for authoritative scoring, cheating logging, and attempt timeout reconciliation.
4. `004_indexes.sql` — Performance indexes for high-concurrency examination access.
