from db_config import get_db_connection
from extractor import structure_receipt
from ask_api import router as ask_router
from fastapi.staticfiles import StaticFiles
from receipts_api import router as receipts_router

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from threading import Lock
from pathlib import Path
from datetime import datetime

import easyocr
import cv2
import os
import uuid
import traceback

from ultralytics import YOLO


# --------------------------------------------------
# App configuration
# --------------------------------------------------

app = FastAPI(
    title="Handwritten Receipt Recognition API",
    description="Backend for receipt scanning and information extraction"
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

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# --------------------------------------------------
# EasyOCR initialization (load only once)
# --------------------------------------------------

reader = None
reader_lock = Lock()


def get_reader():
    global reader

    with reader_lock:
        if reader is None:
            print("Loading EasyOCR model...")
            reader = easyocr.Reader(["en"], gpu=False)

    return reader


# --------------------------------------------------
# YOLO initialization (load only once)
# --------------------------------------------------

YOLO_MODEL_PATH = (
    Path(__file__).parent / "yolo" / "runs" / "receipt_model_v2" / "weights" / "best.pt"
)

yolo_model = None
yolo_lock = Lock()


def get_yolo():
    global yolo_model

    with yolo_lock:
        if yolo_model is None and YOLO_MODEL_PATH.exists():
            print("Loading YOLO model...")
            yolo_model = YOLO(str(YOLO_MODEL_PATH))

    return yolo_model


def detect_items_box(file_path, conf=0.25):
    """Returns the most confident 'items' (table) box, or None."""
    model = get_yolo()
    if model is None:
        return None

    result = model.predict(source=file_path, conf=conf, imgsz=512, verbose=False)[0]

    best = None
    for box in result.boxes:
        if model.names[int(box.cls)] != "items":
            continue
        score = float(box.conf)
        if best is None or score > best[0]:
            best = (score, [int(v) for v in box.xyxy[0]])

    if best is None:
        return None

    return {"confidence": round(best[0], 3), "box": best[1]}


# --------------------------------------------------
# OCR text extraction
# --------------------------------------------------

def extract_text(file_path):
    ocr_reader = get_reader()

    results = ocr_reader.readtext(file_path)

    detected_text = []

    for bounding_box, text, confidence in results:
        # Convert NumPy coordinates to standard Python integers
        clean_bounding_box = [
            [int(point[0]), int(point[1])]
            for point in bounding_box
        ]
        detected_text.append({
            "text": text,
            "confidence": float(round(float(confidence), 4)),
            "bounding_box": clean_bounding_box
        })

    full_text = " ".join(
        item["text"] for item in detected_text
    )

    return {
        "full_text": full_text,
        "detected_text": detected_text
    }


# --------------------------------------------------
# Helpers for saving to MySQL
# --------------------------------------------------

def parse_receipt_date(text):
    """'03/11/2026', '3-11-26', '3 Nov 2026' -> date object (day first)."""
    if not text:
        return None

    cleaned = text.strip()

    for fmt in ("%d %b %Y", "%d %B %Y", "%d %b %y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            pass

    cleaned = cleaned.replace("/", "-").replace(".", "-").replace(" ", "")

    for fmt in ("%d-%m-%Y", "%d-%m-%y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            pass

    return None


def safe_amount(value):
    """Keeps only numbers that fit DECIMAL(12,2); OCR garbage becomes None."""
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if abs(value) < 1e9 else None

# --------------------------------------------------
# API routes
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
        "backend": "FastAPI"
    }


# --------------------------------------------------
# Upload and process receipt
# --------------------------------------------------

@app.post("/upload")
async def upload_receipt(file: UploadFile = File(...)):

    # 1. Validate file extension
    allowed_extensions = (".png", ".jpg", ".jpeg")

    if (
        not file.filename
        or not file.filename.lower().endswith(allowed_extensions)
    ):
        raise HTTPException(
            status_code=400,
            detail="Only PNG and JPG images are supported"
        )

    # 2. Read uploaded image
    file_content = await file.read()

    if not file_content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty"
        )

    # 3. Validate file size (10 MB maximum)
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image must be smaller than 10 MB"
        )

    # 4. Generate a unique filename
    extension = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # 5. Save uploaded image
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    # 6. Perform OCR
    try:
        ocr_result = await run_in_threadpool(
            extract_text,
            file_path
        )

    except Exception as error:
        print("OCR PROCESSING ERROR:", repr(error))
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(error)}"
        )

    # 6b. YOLO items-table detection + structured extraction (fails safely)
    items_region = None
    structured = None
    try:
        items_region = await run_in_threadpool(detect_items_box, file_path)

        image = cv2.imread(file_path)
        img_h, img_w = image.shape[:2]

        structured = structure_receipt(
            ocr_result["detected_text"],
            items_region["box"] if items_region else None,
            img_w,
            img_h,
        )
    except Exception as error:
        print("STRUCTURING ERROR:", repr(error))
        traceback.print_exc()

    # 7. Connect to MySQL
    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to the database."
        )

    cursor = None

    # 8. Save receipt details to MySQL (unchanged for now)
    # try:
    #     cursor = connection.cursor()

    #     print(">>> DATABASE INSERT STARTED")
    #     print(">>> DATABASE:", connection.database)

    #     cursor.execute(
    #         """
    #         INSERT INTO receipts (
    #             original_filename,
    #             stored_filename,
    #             image_path,
    #             raw_ocr_text,
    #             processing_status
    #         )
    #         VALUES (%s, %s, %s, %s, %s)
    #         """,
    #         (
    #             file.filename,
    #             unique_filename,
    #             file_path,
    #             ocr_result["full_text"],
    #             "processed",
    #         ),
    #     )

    #     connection.commit()

    #     receipt_id = cursor.lastrowid

    #     print(">>> DATABASE INSERT COMMITTED")
    #     print(">>> RECEIPT ID:", receipt_id)

    # except Exception as error:
    #     connection.rollback()

    #     print("DATABASE SAVE ERROR:", repr(error))
    #     traceback.print_exc()

    #     raise HTTPException(
    #         status_code=500,
    #         detail="OCR completed, but saving the receipt failed."
    #     )

    # finally:
    #     if cursor:
    #         cursor.close()

    #     connection.close()

    # 8. Save receipt + items to MySQL
    try:
        cursor = connection.cursor()

        print(">>> DATABASE INSERT STARTED")
        print(">>> DATABASE:", connection.database)

        data = structured or {}

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
                file_path,
                (data.get("shop") or None) and data["shop"][:255],
                parse_receipt_date(data.get("date")),
                ocr_result["full_text"],
                safe_amount(data.get("total")),
                safe_amount(data.get("tax")) or 0,
                "processed",
            ),
        )
        # cursor.execute(
        #     """
        #     INSERT INTO receipts (
        #         original_filename,
        #         stored_filename,
        #         image_path,
        #         store_name,
        #         receipt_date,
        #         raw_ocr_text,
        #         total_amount,
        #         processing_status
        #     )
        #     VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        #     """,
        #     (
        #         file.filename,
        #         unique_filename,
        #         file_path,
        #         (data.get("shop") or None) and data["shop"][:255],
        #         parse_receipt_date(data.get("date")),
        #         ocr_result["full_text"],
        #         safe_amount(data.get("total")),
        #         "processed",
        #     ),
        # )

        receipt_id = cursor.lastrowid

        item_rows = []
        for item in data.get("items", []):
            name = (item.get("name") or "").strip()

            if not name and item.get("amount") is None and item.get("rate") is None:
                continue

            item_rows.append((
                receipt_id,
                (name or "Unreadable item")[:255],
                safe_amount(item.get("quantity")) or 1,
                safe_amount(item.get("rate")),
                safe_amount(item.get("amount")),
            ))

        if item_rows:
            cursor.executemany(
                """
                INSERT INTO receipt_items
                    (receipt_id, item_name, quantity, unit_price, amount)
                VALUES (%s, %s, %s, %s, %s)
                """,
                item_rows,
            )

        connection.commit()

        print(">>> DATABASE INSERT COMMITTED")
        print(">>> RECEIPT ID:", receipt_id, "| ITEMS SAVED:", len(item_rows))

    except Exception as error:
        connection.rollback()

        print("DATABASE SAVE ERROR:", repr(error))
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail="OCR completed, but saving the receipt failed."
        )

    finally:
        if cursor:
            cursor.close()

        connection.close()
    # 9. Return response
    return {
        "message": "Receipt uploaded, processed, and saved successfully",
        "receipt_id": receipt_id,
        "filename": unique_filename,
        "size_bytes": len(file_content),
        "status": "processed",
        "items_region": items_region,
        "structured": structured,
        "ocr": ocr_result,
    }



# .\venv\Scripts\Activate
# uvicorn main:app --host 0.0.0.0 --port 8000

# bun run .\node_modules\vite\bin\vite.js dev --host 0.0.0.0