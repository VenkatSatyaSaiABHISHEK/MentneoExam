from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class OCRJobStatus(str, Enum):
    uploaded = "uploaded"
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ExtractedOption(BaseModel):
    label: str  # A, B, C, D
    text: str


class ExtractedQuestion(BaseModel):
    question_number: int
    question_text: str
    options: List[ExtractedOption]
    correct_answer: Optional[str] = None  # A, B, C, D or None
    ocr_confidence: int  # 0-100
    page_number: int
    is_scanned: bool


class OCRResult(BaseModel):
    job_id: str
    pdf_document_id: str
    total_questions: int
    questions: List[ExtractedQuestion]
    processing_time_seconds: float
    error: Optional[str] = None


class StartJobRequest(BaseModel):
    job_id: str
    pdf_document_id: str
    storage_path: str  # Supabase storage path
    round_id: Optional[str] = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: OCRJobStatus
    progress_percent: int
    questions_extracted: Optional[int] = None
    error_message: Optional[str] = None
