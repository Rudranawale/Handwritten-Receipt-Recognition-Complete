from db_config import get_db_connection
from gemini_extractor import structure_receipt_from_image
from ask_api import router as ask_router
from receipts_api import router as receipts_router

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from pathlib import Path
from datetime import datetime
import os
import uuid
import traceback
import re


# --------------------------------------------------
# App configuration
# --------------------------------------------------

app = FastAPI(
    title="Handwritten Receipt Recognition API",
    description="AI-powered handwritten receipt extraction and querying"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ask_router)
app.include_router(receipts_router)

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def parse_receipt_date(value):
    if not value:
        return None

    value = str(value).strip()

    formats = (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d %b %Y",
        "%d %B %Y",
        "%d %b %y",
    )

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue

    return None


def safe_amount(value):
    if value is None or isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if abs(number) >= 1e9:
        return None

    return number


def safe_quantity(value):
    number = safe_amount(value)

    if number is not None:
        return number

    if value is not None:
        match = re.match(r"^\s*(\d+(?:\.\d+)?)", str(value))
        if match:
            return safe_amount(match.group(1))

    return 1.0


def normalize_receipt(gemini_data):
    normalized_items = []

    for item in gemini_data.get("items", []):
        if not isinstance(item, dict):
            continue

        normalized_items.append({
            "name": item.get("item_name"),
            "quantity": safe_quantity(item.get("quantity")),
            "rate": safe_amount(item.get("unit_price")),
            "amount": safe_amount(item.get("amount")),
        })

    return {
        "shop": gemini_data.get("shop_name"),
        "date": gemini_data.get("date"),
        "items": normalized_items,
        "total": safe_amount(gemini_data.get("total_amount")),
        "tax": safe_amount(gemini_data.get("gst_amount")),
        "warnings": gemini_data.get("warnings", []),
    }


# --------------------------------------------------
# Basic routes
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Handwritten Receipt Recognition API is running!"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "backend": "FastAPI",
        "extraction_engine": "Gemini Vision"
    }


# --------------------------------------------------
# Upload and process receipt
# --------------------------------------------------

@app.post("/upload")
async def upload_receipt(file: UploadFile = File(...)):

    allowed_extensions = (".png", ".jpg", ".jpeg")

    if (
        not file.filename
        or not file.filename.lower().endswith(allowed_extensions)
    ):
        raise HTTPException(
            status_code=400,
            detail="Only PNG and JPG images are supported"
        )

    file_content = await file.read()

    if not file_content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty"
        )

    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image must be smaller than 10 MB"
        )

    extension = Path(file.filename).suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / unique_filename

    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    # 1. Extract receipt information using Gemini
    try:
        gemini_data = await run_in_threadpool(
            structure_receipt_from_image,
            str(file_path)
        )

        if not isinstance(gemini_data, dict):
            raise ValueError("Invalid extraction response")

        structured = normalize_receipt(gemini_data)
        raw_text = gemini_data.get("raw_text") or ""

    except Exception as error:
        print("GEMINI EXTRACTION ERROR:", repr(error))
        traceback.print_exc()

        raise HTTPException(
            status_code=502,
            detail="Receipt extraction failed. Please try again."
        )

    # 2. Connect to MySQL
    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to the database."
        )

    cursor = None
    receipt_id = None
    item_count = 0

    # 3. Save receipt and items
    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO receipts (
                original_filename,
                stored_filename,
                image_path,
                store_name,
                receipt_date,
                raw_ocr_text,
                total_amount,
                gst_amount,
                processing_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                file.filename,
                unique_filename,
                str(file_path),
                (structured.get("shop") or None) and structured["shop"][:255],
                parse_receipt_date(structured.get("date")),
                raw_text,
                structured.get("total"),
                structured.get("tax") if structured.get("tax") is not None else 0,
                "processed",
            ),
        )

        receipt_id = cursor.lastrowid

        item_rows = []

        for item in structured.get("items", []):
            name = (item.get("name") or "").strip()

            if (
                not name
                and item.get("amount") is None
                and item.get("rate") is None
            ):
                continue

            item_rows.append((
                receipt_id,
                (name or "Unreadable item")[:255],
                item.get("quantity") or 1,
                item.get("rate"),
                item.get("amount"),
            ))

        if item_rows:
            cursor.executemany(
                """
                INSERT INTO receipt_items (
                    receipt_id,
                    item_name,
                    quantity,
                    unit_price,
                    amount
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                item_rows,
            )

        connection.commit()
        item_count = len(item_rows)

        print(">>> RECEIPT SAVED:", receipt_id)
        print(">>> ITEMS SAVED:", item_count)

    except Exception as error:
        connection.rollback()

        print("DATABASE SAVE ERROR:", repr(error))
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail="Receipt extraction completed, but database saving failed."
        )

    finally:
        if cursor:
            cursor.close()

        connection.close()

    # 4. Return result
    return {
        "message": "Receipt uploaded, processed, and saved successfully",
        "receipt_id": receipt_id,
        "filename": unique_filename,
        "size_bytes": len(file_content),
        "status": "processed",
        "extraction_engine": "Gemini Vision",
        "items_saved": item_count,
        "structured": structured,
        "ocr": {
            "full_text": raw_text,
            "detected_text": []
        },
    }


# Run locally:
# uvicorn main:app --host 0.0.0.0 --port 8000
