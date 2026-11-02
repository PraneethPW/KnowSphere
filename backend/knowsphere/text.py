import io
import re
import unicodedata

from pypdf import PdfReader


def canonical(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(re.sub(r"[^\w\s]", " ", value).split())


def clean_text(value: str) -> str:
    return value.replace("\x00", "").replace("\r\n", "\n").strip()


def quote_present(quote: str, content: str) -> bool:
    return bool(quote.strip()) and " ".join(quote.split()).casefold() in " ".join(content.split()).casefold()


def chunk_text(content: str, size: int = 6000, overlap: int = 400) -> list[str]:
    if size <= overlap or overlap < 0:
        raise ValueError("Chunk size must exceed overlap")
    chunks, start = [], 0
    while start < len(content):
        end = min(start + size, len(content))
        if end < len(content):
            split = content.rfind("\n", start + size // 2, end)
            if split < 0:
                split = content.rfind(" ", start + size // 2, end)
            if split > start:
                end = split
        chunk = content[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(content):
            break
        start = end - overlap
    return chunks


def parse_upload(data: bytes, filename: str, max_chars: int) -> tuple[str, str]:
    extension = filename.rsplit(".", 1)[-1].lower()
    if extension == "pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("This file is not a valid PDF.")
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise ValueError("Encrypted PDFs are not supported. Upload an unlocked copy.")
        if len(reader.pages) > 200:
            raise ValueError("PDFs are limited to 200 pages.")
        pages, length = [], 0
        for page in reader.pages:
            text = page.extract_text() or ""
            length += len(text)
            if length > max_chars:
                raise ValueError(f"Document exceeds the {max_chars:,} character limit.")
            pages.append(text)
        value = "\n\n".join(pages)
    elif extension in {"txt", "md", "csv"}:
        try:
            value = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("Text files must use UTF-8 encoding.") from exc
    else:
        raise ValueError("Upload a PDF, TXT, Markdown, or CSV file.")
    value = clean_text(value)
    if len(value) < 40:
        raise ValueError(
            "At least 40 characters of extractable text are required. Scanned PDFs need OCR first."
        )
    if len(value) > max_chars:
        raise ValueError(f"Document exceeds the {max_chars:,} character limit.")
    return value, extension
