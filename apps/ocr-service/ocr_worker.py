import asyncio
import logging
import os
import time
import tempfile
import httpx
from pathlib import Path
from typing import Optional
from supabase import create_client, Client

from config import settings
from pdf_processor import process_pdf, get_page_images
from question_parser import parse_questions_from_text
from models import ExtractedQuestion, OCRJobStatus

logger = logging.getLogger(__name__)


def get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def download_pdf_from_storage(storage_path: str) -> str:
    """Download PDF from Supabase Storage to a temp file."""
    supabase = get_supabase()

    # Get signed URL for private bucket
    response = supabase.storage.from_('exam-pdfs').create_signed_url(storage_path, 3600)
    signed_url = response['signedURL']

    # Download file
    tmp_path = tempfile.mktemp(suffix='.pdf')
    async with httpx.AsyncClient() as client:
        resp = await client.get(signed_url)
        resp.raise_for_status()
        with open(tmp_path, 'wb') as f:
            f.write(resp.content)

    return tmp_path


async def process_ocr_job(
    job_id: str,
    pdf_document_id: str,
    storage_path: str,
    round_id: Optional[str] = None
):
    """Process a single OCR job end-to-end."""
    supabase = get_supabase()
    start_time = time.time()
    pdf_path = None

    try:
        # Update job status to processing
        supabase.table('ocr_jobs').update({
            'status': OCRJobStatus.processing,
            'started_at': 'NOW()',
            'worker_id': str(os.getpid()),
            'progress_percent': 5,
        }).eq('id', job_id).execute()

        # Download PDF
        logger.info(f"Downloading PDF for job {job_id}")
        pdf_path = await download_pdf_from_storage(storage_path)

        supabase.table('ocr_jobs').update({'progress_percent': 15}).eq('id', job_id).execute()

        # Process PDF pages
        pages = process_pdf(pdf_path)
        total_pages = len(pages)
        scanned_page_nums = [p[0] for p in pages if p[2]]

        # OCR scanned pages
        all_text_by_page = {}

        if scanned_page_nums:
            try:
                from paddleocr import PaddleOCR
                import numpy as np

                ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
                page_images = get_page_images(pdf_path, scanned_page_nums)

                for i, (page_num, image) in enumerate(page_images.items()):
                    img_array = np.array(image)
                    result = ocr.ocr(img_array, cls=True)

                    if result and result[0]:
                        page_text = '\n'.join([line[1][0] for line in result[0]])
                        all_text_by_page[page_num] = (page_text, True, 75)

                    progress = 15 + int(((i + 1) / len(scanned_page_nums)) * 50)
                    supabase.table('ocr_jobs').update({'progress_percent': progress}).eq('id', job_id).execute()

            except ImportError:
                logger.warning("PaddleOCR not available, skipping scanned pages")

        # Combine digital text pages
        for page_num, text, is_scanned in pages:
            if not is_scanned:
                all_text_by_page[page_num] = (text, False, 95)

        supabase.table('ocr_jobs').update({'progress_percent': 70}).eq('id', job_id).execute()

        # Parse questions from all pages
        all_questions: list[ExtractedQuestion] = []
        q_start = 1

        for page_num in sorted(all_text_by_page.keys()):
            text, is_scanned, confidence = all_text_by_page[page_num]
            if text.strip():
                questions = parse_questions_from_text(
                    text, page_num, is_scanned, q_start, confidence
                )
                all_questions.extend(questions)
                q_start += len(questions)

        supabase.table('ocr_jobs').update({'progress_percent': 85}).eq('id', job_id).execute()

        # Store extracted questions in database
        for q in all_questions:
            # Insert question
            q_data = {
                'round_id': round_id,
                'question_text': q.question_text,
                'question_type': 'single_choice',
                'status': 'pending_review',
                'ocr_confidence': q.ocr_confidence,
                'sort_order': q.question_number,
            }
            q_result = supabase.table('questions').insert(q_data).execute()
            q_id = q_result.data[0]['id']

            # Insert options
            for opt in q.options:
                supabase.table('question_options').insert({
                    'question_id': q_id,
                    'label': opt.label,
                    'option_text': opt.text,
                    'sort_order': ord(opt.label) - ord('A'),
                }).execute()

            # Insert answer key if found
            if q.correct_answer:
                supabase.table('answer_keys').insert({
                    'question_id': q_id,
                    'correct_option_label': q.correct_answer,
                }).execute()

        processing_time = time.time() - start_time

        # Mark job as completed
        supabase.table('ocr_jobs').update({
            'status': OCRJobStatus.completed,
            'progress_percent': 100,
            'questions_extracted': len(all_questions),
            'completed_at': 'NOW()',
        }).eq('id', job_id).execute()

        logger.info(f"Job {job_id} completed: {len(all_questions)} questions in {processing_time:.1f}s")

    except Exception as e:
        logger.error(f"OCR job {job_id} failed: {e}", exc_info=True)
        supabase.table('ocr_jobs').update({
            'status': OCRJobStatus.failed,
            'error_message': str(e)[:500],
        }).eq('id', job_id).execute()

    finally:
        if pdf_path and os.path.exists(pdf_path):
            os.unlink(pdf_path)


# Job queue using asyncio
job_queue: asyncio.Queue = asyncio.Queue()
active_jobs: set = set()


async def worker_loop():
    """Background worker that processes OCR jobs from the queue."""
    while True:
        job_data = await job_queue.get()
        job_id = job_data['job_id']

        if len(active_jobs) >= settings.max_concurrent_jobs:
            await asyncio.sleep(5)
            await job_queue.put(job_data)
            job_queue.task_done()
            continue

        active_jobs.add(job_id)
        try:
            await process_ocr_job(**job_data)
        finally:
            active_jobs.discard(job_id)
            job_queue.task_done()


async def enqueue_job(
    job_id: str,
    pdf_document_id: str,
    storage_path: str,
    round_id: Optional[str] = None
):
    """Add a job to the processing queue."""
    await job_queue.put({
        'job_id': job_id,
        'pdf_document_id': pdf_document_id,
        'storage_path': storage_path,
        'round_id': round_id,
    })
