import re
import logging
from typing import List, Optional, Tuple
from models import ExtractedQuestion, ExtractedOption

logger = logging.getLogger(__name__)

# Regex patterns for MCQ parsing
QUESTION_PATTERNS = [
    r'(?:^|\n)\s*(?:Q\.?\s*)?(\d+)[.)]\s*(.+?)(?=\n\s*(?:A[.):]|Option\s*A))',
    r'(?:^|\n)\s*(\d+)\s*[.)]\s*(.+?)(?=\n\s*[A-D][.):])',
]

OPTION_PATTERNS = [
    r'([A-D])[.):\s]+(.+?)(?=\n[A-D][.):]|\nCorrect|\nAnswer:|$)',
    r'(?:Option\s+)?([A-D])[.):]\s*(.+?)(?=\n(?:Option\s+)?[A-D][.):.]|\nAnswer:|$)',
]

ANSWER_PATTERNS = [
    r'(?:Correct\s+Answer|Answer\s*Key|Ans)[.:\s]+([A-D])',
    r'(?:^|\n)\s*(?:Correct|Answer)[.:\s]*([A-D])\b',
]


def parse_options(text: str) -> List[ExtractedOption]:
    """Extract answer options from text block."""
    options = []
    seen_labels = set()

    for pattern in OPTION_PATTERNS:
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        for label, option_text in matches:
            label = label.upper()
            if label not in seen_labels and label in ('A', 'B', 'C', 'D'):
                seen_labels.add(label)
                options.append(ExtractedOption(
                    label=label,
                    text=option_text.strip()
                ))
        if len(options) >= 2:
            break

    return sorted(options, key=lambda x: x.label)


def parse_answer(text: str) -> Optional[str]:
    """Extract correct answer key from text."""
    for pattern in ANSWER_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).upper()
    return None


def split_into_questions(full_text: str) -> List[str]:
    """Split full page text into individual question blocks."""
    # Try to split by question numbers
    parts = re.split(r'\n(?=\s*(?:Q\.?\s*)?\d+[.)]\s)', full_text)
    if len(parts) > 1:
        return [p.strip() for p in parts if p.strip()]

    # Fallback: split by double newlines
    return [p.strip() for p in full_text.split('\n\n') if p.strip()]


def parse_questions_from_text(
    text: str,
    page_num: int,
    is_scanned: bool,
    start_q_num: int = 1,
    ocr_confidence: int = 90
) -> List[ExtractedQuestion]:
    """Parse MCQ questions from extracted text."""
    questions = []
    blocks = split_into_questions(text)

    q_num = start_q_num
    for block in blocks:
        if len(block) < 10:
            continue

        # Try to find question text (before options)
        q_text_match = re.match(
            r'^\s*(?:Q\.?\s*)?(?:\d+[.)]?\s*)?(.*?)(?=\n\s*[A-D][.):]|\n\s*Option)',
            block, re.DOTALL
        )

        q_text = q_text_match.group(1).strip() if q_text_match else block.split('\n')[0].strip()

        if len(q_text) < 5:
            continue

        options = parse_options(block)
        answer = parse_answer(block)

        if len(options) >= 2:  # Only include questions with at least 2 options
            questions.append(ExtractedQuestion(
                question_number=q_num,
                question_text=q_text,
                options=options,
                correct_answer=answer,
                ocr_confidence=ocr_confidence,
                page_number=page_num,
                is_scanned=is_scanned,
            ))
            q_num += 1

    return questions
