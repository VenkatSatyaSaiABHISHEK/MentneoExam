# ExamS OCR Service

A FastAPI microservice that processes PDF question papers and extracts MCQ questions using PyMuPDF (for digital PDFs) and PaddleOCR (for scanned/image-based PDFs).

## What This Service Does

1. **Receives OCR job requests** from the main Next.js application via a secure HTTP API
2. **Downloads PDF files** from Supabase Storage
3. **Detects page type** — digital text vs. scanned image
4. **Extracts text** using PyMuPDF for digital pages and PaddleOCR for scanned pages
5. **Parses MCQ questions** including question text, answer options (A–D), and correct answer keys
6. **Stores extracted questions** into Supabase (questions, question_options, answer_keys tables)
7. **Tracks job progress** and status in the `ocr_jobs` table

---

## Prerequisites

- **Python 3.11+**
- **pip** (or a virtual environment manager like `venv` / `conda`)
- A **Supabase** project with the ExamS database schema applied
- (Optional) A CUDA-capable GPU for faster PaddleOCR inference

### PaddleOCR Notes

PaddleOCR requires `paddlepaddle` as its backend. On CPU-only machines:

```bash
pip install paddlepaddle==2.6.1
pip install paddleocr==2.7.3
```

On CUDA machines (e.g. CUDA 11.8):

```bash
pip install paddlepaddle-gpu==2.6.1.post118 -f https://www.paddlepaddle.org.cn/whl/linux/mkl/avx/stable.html
pip install paddleocr==2.7.3
```

---

## Local Development Setup

### 1. Clone / navigate to the service directory

```bash
cd apps/ocr-service
```

### 2. Create a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your actual values
```

### 5. Run the development server

```bash
uvicorn main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OCR_SERVICE_SECRET` | ✅ | `dev-secret` | Shared secret for authenticating requests from the Next.js app |
| `SUPABASE_URL` | ✅ | — | Your Supabase project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Supabase service-role key (bypasses RLS) |
| `MAX_CONCURRENT_JOBS` | ❌ | `2` | Maximum OCR jobs processed simultaneously |
| `UPLOAD_DIR` | ❌ | `/tmp/ocr_uploads` | Temporary directory for downloaded PDFs |

---

## API Endpoints

All endpoints (except `GET /` and `GET /health`) require the `X-OCR-Secret` header matching `OCR_SERVICE_SECRET`.

### `GET /`
Returns service info.

```json
{ "service": "ExamS OCR Service", "version": "1.0.0" }
```

---

### `GET /health`
Health check — returns queue depth and active job count.

```json
{
  "status": "healthy",
  "queue_size": 0,
  "active_jobs": 1
}
```

---

### `POST /jobs/start`
Enqueue a new OCR processing job.

**Headers:**
```
X-OCR-Secret: <your-secret>
Content-Type: application/json
```

**Request body:**
```json
{
  "job_id": "uuid-of-ocr-job-row",
  "pdf_document_id": "uuid-of-pdf-document",
  "storage_path": "pdfs/exam-123/paper.pdf",
  "round_id": "uuid-of-round"
}
```

**Response:**
```json
{ "status": "queued", "job_id": "uuid-of-ocr-job-row" }
```

---

### `GET /jobs/{job_id}`
Get the current status of an OCR job.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "processing",
  "progress_percent": 65,
  "questions_extracted": null,
  "error_message": null
}
```

**Status values:** `uploaded` → `queued` → `processing` → `completed` | `failed`

---

## Processing Pipeline

```
PDF Download (Supabase Storage)
        ↓
Page-by-page analysis (PyMuPDF)
  ├─ Digital page  → extract text directly
  └─ Scanned page  → render to image → PaddleOCR
        ↓
Question parsing (regex-based MCQ parser)
  ├─ Split text into question blocks
  ├─ Extract question text
  ├─ Extract options A/B/C/D
  └─ Extract correct answer key (if present)
        ↓
Database writes (Supabase)
  ├─ questions table
  ├─ question_options table
  └─ answer_keys table (if answer found)
        ↓
Job marked completed with question count
```

---

## Docker Deployment

### Build the image

```bash
docker build -t exams-ocr-service .
```

### Run the container

```bash
docker run -d \
  --name exams-ocr \
  -p 8000:8000 \
  -e OCR_SERVICE_SECRET=your-secret \
  -e SUPABASE_URL=https://xxxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e MAX_CONCURRENT_JOBS=2 \
  exams-ocr-service
```

### Docker Compose (recommended)

Add to your `docker-compose.yml`:

```yaml
services:
  ocr-service:
    build: ./apps/ocr-service
    ports:
      - "8000:8000"
    environment:
      - OCR_SERVICE_SECRET=${OCR_SERVICE_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - MAX_CONCURRENT_JOBS=2
    restart: unless-stopped
```

---

## Integration with the Next.js App

The Next.js application calls this service from its API routes (`app/api/ocr/`).

### Starting a job (from Next.js)

```typescript
// app/api/ocr/jobs/route.ts
const response = await fetch(`${process.env.OCR_SERVICE_URL}/jobs/start`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-OCR-Secret': process.env.OCR_SERVICE_SECRET!,
  },
  body: JSON.stringify({
    job_id: ocrJob.id,
    pdf_document_id: document.id,
    storage_path: document.storage_path,
    round_id: roundId,
  }),
})
```

### Polling job status (from Next.js)

```typescript
// app/api/ocr/[jobId]/route.ts
const response = await fetch(`${process.env.OCR_SERVICE_URL}/jobs/${jobId}`, {
  headers: { 'X-OCR-Secret': process.env.OCR_SERVICE_SECRET! },
})
const { status, progress_percent, questions_extracted } = await response.json()
```

### Required Next.js environment variables

```env
OCR_SERVICE_URL=http://localhost:8000   # or your deployed URL
OCR_SERVICE_SECRET=your-shared-secret
```

---

## Project Structure

```
apps/ocr-service/
├── main.py            # FastAPI app, routes, lifespan
├── ocr_worker.py      # Async job queue & end-to-end processing
├── pdf_processor.py   # PyMuPDF page analysis & image export
├── question_parser.py # Regex-based MCQ extraction
├── models.py          # Pydantic request/response models
├── config.py          # Settings from environment
├── requirements.txt   # Python dependencies
├── Dockerfile         # Container build definition
├── .env.example       # Environment variable template
└── README.md          # This file
```
