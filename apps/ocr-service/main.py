import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

from config import settings
from models import StartJobRequest, JobStatusResponse, OCRJobStatus
from ocr_worker import enqueue_job, worker_loop, job_queue, active_jobs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background worker
    worker_task = asyncio.create_task(worker_loop())
    logger.info("OCR worker started")
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="ExamS OCR Service",
    description="PDF question extraction service for the ExamS platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_secret(x_ocr_secret: Optional[str] = Header(None)):
    if x_ocr_secret != settings.ocr_service_secret:
        raise HTTPException(status_code=401, detail="Invalid OCR service secret")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "queue_size": job_queue.qsize(),
        "active_jobs": len(active_jobs),
    }


@app.post("/jobs/start")
async def start_job(
    request: StartJobRequest,
    background_tasks: BackgroundTasks,
    x_ocr_secret: Optional[str] = Header(None),
):
    """Enqueue a new OCR job for processing."""
    verify_secret(x_ocr_secret)

    await enqueue_job(
        job_id=request.job_id,
        pdf_document_id=request.pdf_document_id,
        storage_path=request.storage_path,
        round_id=request.round_id,
    )

    return {"status": "queued", "job_id": request.job_id}


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    x_ocr_secret: Optional[str] = Header(None),
):
    """Get current status of an OCR job."""
    verify_secret(x_ocr_secret)

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    result = supabase.table('ocr_jobs').select('*').eq('id', job_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data
    return JobStatusResponse(
        job_id=job_id,
        status=job['status'],
        progress_percent=job['progress_percent'],
        questions_extracted=job.get('questions_extracted'),
        error_message=job.get('error_message'),
    )


@app.get("/")
async def root():
    return {"service": "ExamS OCR Service", "version": "1.0.0"}
