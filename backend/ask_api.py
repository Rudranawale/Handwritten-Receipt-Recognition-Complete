"""
Rule-based natural-language questions -> SQL (no LLM needed).
Works with Hinglish + English keywords. Only SELECT queries are ever run.
"""
import re
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db_config import get_db_connection

router = APIRouter()


class AskRequest(BaseModel):
    question: str


def jsonable(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


def has(q, *words):
    return any(w in q for w in words)


def detect_date_range(q):
    today = date.today()
    if re.search(r"\b(today|aaj)\b", q):
        return today, today, "today"
    if "yesterday" in q:
        y = today - timedelta(days=1)
        return y, y, "yesterday"
    if has(q, "this week", "is hafte", "isi hafte", "is week"):
        return today - timedelta(days=today.weekday()), today, "this week"
    if has(q, "last week", "pichle hafte", "pichhle hafte", "past week", "last 7 days"):
        return today - timedelta(days=7), today, "last 7 days"
    if has(q, "this month", "is mahine", "isi mahine", "is month"):
        return today.replace(day=1), today, "this month"
    if has(q, "last month", "pichle mahine", "pichhle mahine"):
        end = today.replace(day=1) - timedelta(days=1)
        return end.replace(day=1), end, "last month"
    m = re.search(r"\b(20\d\d)\b", q)
    if m:
        y = int(m.group(1))
        return date(y, 1, 1), date(y, 12, 31), str(y)
    return None


def money(x):
    return f"₹{float(x or 0):,.2f}"


HELP = [
    "Total kitna kharch hua?",
    "Rahul Auto Works par total kitna kharch hua?",
    "Sabse mehnga item kaunsa hai?",
    "Kis shop par sabse zyada kharch hua?",
    "Kitni receipts hain?",
    "Last receipt dikhao",
    "Switch ka rate kitna tha?",
    "Items list dikhao",
    "Is mahine / pichle hafte / 2025 ka total",
]


@router.post("/ask")
def ask(req: AskRequest):
    q = req.question.strip().lower()
    if not q:
        raise HTTPException(status_code=400, detail="Question is empty")

    connection = get_db_connection()
    if connection is None:
        raise HTTPException(status_code=500, detail="Could not connect to the database.")

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)

        # known shops / item names from DB (to spot them inside the question)
        cursor.execute("SELECT DISTINCT store_name FROM receipts WHERE store_name IS NOT NULL")
        shops = [r["store_name"] for r in cursor.fetchall()]
        shop = next((s for s in shops if s.lower() in q), None)

        cursor.execute("SELECT DISTINCT item_name FROM receipt_items")
        names = sorted((r["item_name"] for r in cursor.fetchall()), key=len, reverse=True)
        item = next((n for n in names if len(n) >= 3 and n.lower() in q), None)

        rng = detect_date_range(q)

        conds, params = [], []
        if shop:
            conds.append("r.store_name = %s")
            params.append(shop)
        if rng:
            conds.append("COALESCE(r.receipt_date, DATE(r.created_at)) BETWEEN %s AND %s")
            params += [rng[0], rng[1]]

        def where(extra=(), extra_params=()):
            c = conds + list(extra)
            return ("WHERE " + " AND ".join(c)) if c else "", params + list(extra_params)

        scope = (f" at {shop}" if shop else "") + (f" ({rng[2]})" if rng else "")
        bill_date = "COALESCE(r.receipt_date, DATE(r.created_at))"

        # ---------- intent routing ----------
        if has(q, "sabse mehng", "most expensive", "costliest", "highest price", "sabse costly", "sabse jyada rate"):
            intent = "most_expensive_item"
            w, p = where(["i.unit_price IS NOT NULL"])
            sql = (f"SELECT i.item_name, i.unit_price, r.store_name, {bill_date} AS bill_date "
                   f"FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id {w} "
                   f"ORDER BY i.unit_price DESC LIMIT 1")
            cursor.execute(sql, p)
            rows = cursor.fetchall()
            answer = (f"Most expensive item{scope}: {rows[0]['item_name']} at {money(rows[0]['unit_price'])} "
                      f"({rows[0]['store_name'] or 'unknown shop'})") if rows else f"No items found{scope}."

        elif has(q, "which shop", "kis shop", "kaunsi shop", "kaunsi dukaan", "kis dukaan", "top shop"):
            intent = "top_shop"
            w, p = where(["r.store_name IS NOT NULL", "r.total_amount IS NOT NULL"])
            sql = (f"SELECT r.store_name, SUM(r.total_amount) AS total, COUNT(*) AS bills "
                   f"FROM receipts r {w} GROUP BY r.store_name ORDER BY total DESC LIMIT 5")
            cursor.execute(sql, p)
            rows = cursor.fetchall()
            answer = (f"Highest spend{' ' + rng[2] if rng else ''}: {rows[0]['store_name']} "
                      f"with {money(rows[0]['total'])} over {rows[0]['bills']} receipt(s).") if rows else "No data found."

        elif has(q, "how many", "kitni receipt", "kitne receipt", "kitne bill", "kitni bill", "number of receipts", "count"):
            intent = "count_receipts"
            w, p = where()
            sql = f"SELECT COUNT(*) AS receipts FROM receipts r {w}"
            cursor.execute(sql, p)
            rows = cursor.fetchall()
            answer = f"Receipts{scope}: {rows[0]['receipts']}"

        elif has(q, "last receipt", "latest", "recent", "aakhri", "akhri", "last bill"):
            intent = "latest_receipt"
            w, p = where()
            sql = (f"SELECT r.id, r.store_name, {bill_date} AS bill_date, r.total_amount "
                   f"FROM receipts r {w} ORDER BY r.id DESC LIMIT 1")
            cursor.execute(sql, p)
            head = cursor.fetchall()
            rows = head
            if head:
                cursor.execute("SELECT item_name, quantity, unit_price, amount FROM receipt_items "
                               "WHERE receipt_id = %s", (head[0]["id"],))
                items = cursor.fetchall()
                rows = [{**head[0], "items": items}]
                answer = (f"Latest receipt #{head[0]['id']} from {head[0]['store_name'] or 'unknown shop'}: "
                          f"total {money(head[0]['total_amount'])}, {len(items)} item(s).")
            else:
                answer = "No receipts found."

        elif item:
            intent = "item_lookup"
            w, p = where(["i.item_name = %s"], [item])
            sql = (f"SELECT i.item_name, i.quantity, i.unit_price, i.amount, r.store_name, {bill_date} AS bill_date "
                   f"FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id {w} "
                   f"ORDER BY r.id DESC LIMIT 20")
            cursor.execute(sql, p)
            rows = cursor.fetchall()
            spent = sum(float(r["amount"] or 0) for r in rows)
            answer = (f"'{item}'{scope}: {len(rows)} entry(ies), total spent {money(spent)}.") if rows \
                else f"'{item}' not found{scope}."

        elif has(q, "items", "item list", "saman", "samaan", "kya kya", "what did i buy", "list"):
            intent = "list_items"
            w, p = where()
            sql = (f"SELECT i.item_name, i.quantity, i.unit_price, i.amount, r.store_name, {bill_date} AS bill_date "
                   f"FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id {w} "
                   f"ORDER BY r.id DESC, i.id LIMIT 50")
            cursor.execute(sql, p)
            rows = cursor.fetchall()
            answer = f"{len(rows)} item(s){scope}."

        elif has(q, "total", "kitna", "kitne", "spent", "spend", "kharch", "kharcha", "expense", "sum", "amount"):
            intent = "total_spend"
            w, p = where()
            sql = f"SELECT SUM(r.total_amount) AS total, COUNT(*) AS bills FROM receipts r {w}"
            cursor.execute(sql, p)
            rows = cursor.fetchall()
            answer = f"Total spend{scope}: {money(rows[0]['total'])} across {rows[0]['bills']} receipt(s)."

        else:
            return {"question": req.question, "intent": "unknown",
                    "answer": "Sawal samajh nahi aaya. Aise sawal poochh sakte ho:",
                    "examples": HELP, "sql": None, "rows": []}

        return {
            "question": req.question,
            "intent": intent,
            "answer": answer,
            "sql": sql,
            "rows": [{k: jsonable(v) if not isinstance(v, list) else
                      [{a: jsonable(b) for a, b in it.items()} for it in v]
                      for k, v in r.items()} for r in rows],
        }

    except HTTPException:
        raise
    except Exception as error:
        print("ASK ERROR:", repr(error))
        raise HTTPException(status_code=500, detail="Could not answer the question.")

    finally:
        if cursor:
            cursor.close()
        connection.close()
