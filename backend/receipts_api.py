"""
Receipts endpoints for the frontend:
  GET /receipts        -> all receipts with their items
  PUT /receipts/{id}   -> save the user's corrected data (marks receipt Verified)
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db_config import get_db_connection

router = APIRouter()

MAX_DECIMAL = 9_999_999_999.0  # fits DECIMAL(12,2)


class ItemIn(BaseModel):
    name: str = ""
    qty: float = 1
    price: float = 0


class ReceiptUpdate(BaseModel):
    store: str = ""
    date: Optional[str] = None  # YYYY-MM-DD
    gst: float = 0
    total: float = 0
    items: List[ItemIn] = []


def num(v):
    return float(v) if v is not None else 0.0


def clamp(v):
    return round(min(max(float(v), 0.0), MAX_DECIMAL), 2)


def iso(v):
    if v is None:
        return None
    return v.isoformat()[:10] if hasattr(v, "isoformat") else str(v)[:10]


@router.get("/receipts")
def list_receipts():
    connection = get_db_connection()
    if connection is None:
        raise HTTPException(status_code=500, detail="Could not connect to the database.")

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, store_name, stored_filename, total_amount, gst_amount, processing_status,
                   COALESCE(receipt_date, DATE(created_at)) AS bill_date
            FROM receipts
            ORDER BY bill_date DESC, id DESC
            """
        )
        rows = cursor.fetchall()

        items_by = {}
        if rows:
            ids = [r["id"] for r in rows]
            marks = ",".join(["%s"] * len(ids))
            cursor.execute(
                f"SELECT receipt_id, item_name, quantity, unit_price, amount "
                f"FROM receipt_items WHERE receipt_id IN ({marks}) ORDER BY id",
                ids,
            )
            for it in cursor.fetchall():
                qty = num(it["quantity"]) or 1.0
                price = num(it["unit_price"]) if it["unit_price"] is not None else num(it["amount"]) / qty
                items_by.setdefault(it["receipt_id"], []).append(
                    {"name": it["item_name"], "qty": qty, "price": round(price, 2)}
                )

        out = []
        for r in rows:
            items = items_by.get(r["id"], [])
            gst = num(r["gst_amount"])
            total = (
                num(r["total_amount"])
                if r["total_amount"] is not None
                else round(sum(i["qty"] * i["price"] for i in items) + gst, 2)
            )
            out.append({
                "id": f"RC-{1000 + r['id']}",
                "dbId": r["id"],
                "store": r["store_name"] or "Unknown shop",
                "date": iso(r["bill_date"]),
                "items": items,
                "gst": gst,
                "total": total,
                "status": "Verified" if r["processing_status"] == "verified" else "Processed",
                "image": f"/uploads/{r['stored_filename']}",
            })
        return out

    except HTTPException:
        raise
    except Exception as error:
        print("LIST RECEIPTS ERROR:", repr(error))
        raise HTTPException(status_code=500, detail="Could not load receipts.")

    finally:
        if cursor:
            cursor.close()
        connection.close()


@router.put("/receipts/{receipt_id}")
def update_receipt(receipt_id: int, body: ReceiptUpdate):
    receipt_date = None
    if body.date:
        try:
            receipt_date = datetime.strptime(body.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    connection = get_db_connection()
    if connection is None:
        raise HTTPException(status_code=500, detail="Could not connect to the database.")

    cursor = None
    try:
        cursor = connection.cursor()

        cursor.execute("SELECT id FROM receipts WHERE id = %s", (receipt_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Receipt not found")

        cursor.execute(
            """
            UPDATE receipts
            SET store_name = %s, receipt_date = %s, gst_amount = %s,
                total_amount = %s, processing_status = 'verified'
            WHERE id = %s
            """,
            ((body.store.strip()[:255] or None), receipt_date, clamp(body.gst), clamp(body.total), receipt_id),
        )

        cursor.execute("DELETE FROM receipt_items WHERE receipt_id = %s", (receipt_id,))

        rows = [
            (
                receipt_id,
                (i.name.strip() or "Unnamed item")[:255],
                i.qty if i.qty > 0 else 1,
                clamp(i.price),
                clamp(i.qty * i.price),
            )
            for i in body.items
        ]
        if rows:
            cursor.executemany(
                "INSERT INTO receipt_items (receipt_id, item_name, quantity, unit_price, amount) "
                "VALUES (%s, %s, %s, %s, %s)",
                rows,
            )

        connection.commit()
        return {"ok": True, "id": receipt_id, "items_saved": len(rows)}

    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        print("UPDATE RECEIPT ERROR:", repr(error))
        raise HTTPException(status_code=500, detail="Could not save the receipt.")

    finally:
        if cursor:
            cursor.close()
        connection.close()
