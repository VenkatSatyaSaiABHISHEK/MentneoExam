import fitz  # PyMuPDF
import io
import logging
from pathlib import Path
from typing import List, Tuple
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)


def is_page_scanned(page: fitz.Page, text_threshold: int = 50) -> bool:
    """Detect if a page is scanned (image-based) vs digital text."""
    text = page.get_text().strip()
    return len(text) < text_threshold


def extract_digital_text(page: fitz.Page) -> str:
    """Extract text from a digital PDF page using PyMuPDF."""
    return page.get_text("text")


def page_to_image(page: fitz.Page, dpi: int = 300) -> Image.Image:
    """Convert a PDF page to a PIL Image for OCR."""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img_bytes = pix.tobytes("png")
    return Image.open(io.BytesIO(img_bytes))


def process_pdf(pdf_path: str) -> List[Tuple[int, str, bool]]:
    """
    Process a PDF file and return list of (page_num, text, is_scanned) tuples.
    Uses PyMuPDF for digital pages, marks scanned pages for PaddleOCR.
    """
    results = []
    doc = fitz.open(pdf_path)

    for page_num in range(len(doc)):
        page = doc[page_num]
        scanned = is_page_scanned(page)

        if scanned:
            # Return empty text; OCR worker will handle this page
            results.append((page_num + 1, "", True))
        else:
            text = extract_digital_text(page)
            results.append((page_num + 1, text, False))

    doc.close()
    return results


def get_page_images(pdf_path: str, page_numbers: List[int], dpi: int = 300) -> dict:
    """Extract specific pages as images for OCR processing."""
    images = {}
    doc = fitz.open(pdf_path)

    for page_num in page_numbers:
        if 1 <= page_num <= len(doc):
            page = doc[page_num - 1]
            images[page_num] = page_to_image(page, dpi)

    doc.close()
    return images
