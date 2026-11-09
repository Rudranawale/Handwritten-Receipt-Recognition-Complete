
# """
# Rule-based receipt structuring.
# Input : EasyOCR detections (text + 4-point box) and optional YOLO 'items' box.
# Output: shop, date, items[], total, tax.
# """
# import re
# from statistics import median
 
# SKIP_WORDS = ("particular", "amount", "rate", "qty", "sl.", "sl no", "s.no")
# DATE_RE = re.compile(r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b")
# DATE_TXT_RE = re.compile(r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4})\b", re.I)
 
 
# def to_number(text):
#     """'5,500' -> 5500.0 ; 'l20' -> 120.0 ; 'Stand' -> None"""
#     t = text.strip().replace(" ", "")
#     if t in ("l", "I", "|", "/"):      # lone stroke = handwritten 1
#         return 1.0
#     if not t or not any(c.isdigit() for c in t):
#         return None
#     fixed = t.translate(str.maketrans({"O": "0", "o": "0", "l": "1", "I": "1", "|": "1", "S": "5"}))
#     cleaned = re.sub(r"[^0-9.]", "", fixed.replace(",", ""))
#     digitish = sum(c.isdigit() or c in ",.Oo lI|S" for c in t)
#     if len(cleaned.replace(".", "")) == 0 or digitish / len(t) < 0.7:
#         return None
#     try:
#         return float(cleaned.strip("."))
#     except ValueError:
#         return None
 
 
# def _prep(detected):
#     toks = []
#     for d in detected:
#         xs = [p[0] for p in d["bounding_box"]]
#         ys = [p[1] for p in d["bounding_box"]]
#         toks.append({
#             "text": d["text"].strip(), "conf": d.get("confidence", 0),
#             "x1": min(xs), "x2": max(xs), "y1": min(ys), "y2": max(ys),
#             "cx": (min(xs) + max(xs)) / 2, "cy": (min(ys) + max(ys)) / 2,
#             "h": max(ys) - min(ys),
#         })
#     return [t for t in toks if t["text"]]
 
 
# def _rows(tokens):
#     if not tokens:
#         return []
#     mh = median(t["h"] for t in tokens) or 20
#     rows = []
#     for t in sorted(tokens, key=lambda t: t["cy"]):
#         if rows and abs(t["cy"] - rows[-1]["cy"]) < 0.6 * mh:
#             rows[-1]["tokens"].append(t)
#             rows[-1]["cy"] = sum(x["cy"] for x in rows[-1]["tokens"]) / len(rows[-1]["tokens"])
#         else:
#             rows.append({"cy": t["cy"], "tokens": [t]})
#     for r in rows:
#         r["tokens"].sort(key=lambda t: t["cx"])
#     return rows
 
 
# def _find_labeled_amount(tokens, keywords, exclude=()):
#     """Find number on the same row, to the right of a label such as TOTAL / TAX."""
#     for lab in tokens:
#         low = lab["text"].lower()
#         if any(k in low for k in keywords) and not any(e in low for e in exclude):
#             # number inside the same token (e.g. 'TOTAL 2500')
#             for part in low.replace(":", " ").split():
#                 n = to_number(part)
#                 if n is not None and part not in keywords:
#                     return n
#             same = [t for t in tokens if t is not lab and t["cx"] > lab["cx"]
#                     and abs(t["cy"] - lab["cy"]) < 0.8 * max(lab["h"], 20)]
#             nums = [(t["cx"], to_number(t["text"])) for t in same if to_number(t["text"]) is not None]
#             if nums:
#                 return max(nums)[1]
#     return None
 
 
# def structure_receipt(detected, items_box, img_w, img_h):
#     tokens = _prep(detected)
#     full_text = " ".join(t["text"] for t in tokens)
 
#     # ---- date
#     norm = re.sub(r"\s*([/\-.])\s*", r"\1", full_text)
#     m = DATE_RE.search(norm) or DATE_TXT_RE.search(full_text)
#     date = m.group(1) if m else None
 
#     # ---- shop: biggest text in top 22% of image (fallback: text after 'For,')
#     shop = None
#     top = [t for t in tokens if t["cy"] < 0.22 * img_h and len(t["text"]) >= 3
#            and to_number(t["text"]) is None]
#     if top:
#         shop = max(top, key=lambda t: t["h"])["text"]
#     else:
#         m2 = re.search(r"\bfor[,.]?\s+([A-Za-z&][A-Za-z&\s]{2,30})", full_text, re.I)
#         shop = m2.group(1).strip() if m2 else None
 
#     # ---- items region
#     if items_box:
#         x1, y1, x2, y2 = items_box
#     else:
#         x1, y1, x2, y2 = 0, 0.25 * img_h, img_w, 0.85 * img_h
#     in_box = [t for t in tokens if x1 - 10 <= t["cx"] <= x2 + 10 and y1 - 10 <= t["cy"] <= y2 + 10]
 
#     # ---- parse each visual row -> name + numbers
#     parsed = []
#     for row in _rows(in_box):
#         toks = row["tokens"]
#         joined = " ".join(t["text"] for t in toks).lower()
#         if any(w in joined for w in SKIP_WORDS):
#             continue
#         # drop serial number at far left (1. 2. 3.)
#         if toks and to_number(toks[0]["text"]) is not None and toks[0]["cx"] < x1 + 0.12 * (x2 - x1) \
#                 and len(toks) > 1:
#             toks = toks[1:]
#         nums = [to_number(t["text"]) for t in toks if to_number(t["text"]) is not None]
#         name = " ".join(t["text"] for t in toks if to_number(t["text"]) is None).strip(" .:-|")
#         if not name and not nums:
#             continue
#         parsed.append({"name": name, "nums": nums})
 
#     # ---- handwriting wobble can split one item into 2 rows:
#     #      [name only] followed by [numbers only] -> merge them
#     merged = []
#     for r in parsed:
#         prev = merged[-1] if merged else None
#         if prev and prev["name"] and not prev["nums"] and r["nums"] and not r["name"]:
#             prev["nums"] = r["nums"]
#         else:
#             merged.append(r)
 
#     items = []
#     for r in merged:
#         nums = r["nums"]
#         amount = nums[-1] if nums else None
#         rate = nums[-2] if len(nums) >= 2 else amount
#         qty = nums[-3] if len(nums) >= 3 else 1
#         items.append({"name": r["name"], "quantity": qty, "rate": rate, "amount": amount})
 
#     items_sum = sum(i["amount"] for i in items if i["amount"])
#     total = _find_labeled_amount(tokens, ("total",), exclude=("sub",))
#     tax = _find_labeled_amount(tokens, ("tax", "gst"))
 
#     return {
#         "shop": shop,
#         "date": date,
#         "items": items,
#         "items_sum": items_sum,
#         "total": total if total is not None else (items_sum or None),
#         "total_source": "ocr" if total is not None else "sum_of_items",
#         "tax": tax,
#     }
 







"""
Rule-based receipt structuring.
Input : EasyOCR detections (text + 4-point box) and optional YOLO 'items' box.
Output: shop, date, items[], total, tax.
"""
import re
from statistics import median
 
SKIP_WORDS = ("particular", "amount", "rate", "qty", "sl.", "sl no", "s.no")
DATE_RE = re.compile(r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b")
DATE_TXT_RE = re.compile(r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4})\b", re.I)
 
 
def to_number(text):
    """'5,500' -> 5500.0 ; 'l20' -> 120.0 ; 'Stand' -> None"""
    t = text.strip().replace(" ", "")
    if t in ("l", "I", "|", "/"):      # lone stroke = handwritten 1
        return 1.0
    if not t or not any(c.isdigit() for c in t):
        return None
    fixed = t.translate(str.maketrans({"O": "0", "o": "0", "l": "1", "I": "1", "|": "1", "S": "5"}))
    cleaned = re.sub(r"[^0-9.]", "", fixed.replace(",", ""))
    digitish = sum(c.isdigit() or c in ",.Oo lI|S" for c in t)
    if len(cleaned.replace(".", "")) == 0 or digitish / len(t) < 0.7:
        return None
    try:
        return float(cleaned.strip("."))
    except ValueError:
        return None
 
 
def _prep(detected):
    toks = []
    for d in detected:
        xs = [p[0] for p in d["bounding_box"]]
        ys = [p[1] for p in d["bounding_box"]]
        toks.append({
            "text": d["text"].strip(), "conf": d.get("confidence", 0),
            "x1": min(xs), "x2": max(xs), "y1": min(ys), "y2": max(ys),
            "cx": (min(xs) + max(xs)) / 2, "cy": (min(ys) + max(ys)) / 2,
            "h": max(ys) - min(ys),
        })
    return [t for t in toks if t["text"]]
 
 
def _rows(tokens):
    if not tokens:
        return []
    mh = median(t["h"] for t in tokens) or 20
    rows = []
    for t in sorted(tokens, key=lambda t: t["cy"]):
        if rows and abs(t["cy"] - rows[-1]["cy"]) < 0.6 * mh:
            rows[-1]["tokens"].append(t)
            rows[-1]["cy"] = sum(x["cy"] for x in rows[-1]["tokens"]) / len(rows[-1]["tokens"])
        else:
            rows.append({"cy": t["cy"], "tokens": [t]})
    for r in rows:
        r["tokens"].sort(key=lambda t: t["cx"])
    return rows
 
 
def _find_labeled_amount(tokens, keywords, exclude=()):
    """Find number on the same row, to the right of a label such as TOTAL / TAX."""
    for lab in tokens:
        low = lab["text"].lower()
        if any(k in low for k in keywords) and not any(e in low for e in exclude):
            # number inside the same token (e.g. 'TOTAL 2500')
            for part in low.replace(":", " ").split():
                n = to_number(part)
                if n is not None and part not in keywords:
                    return n
            same = [t for t in tokens if t is not lab and t["cx"] > lab["cx"]
                    and abs(t["cy"] - lab["cy"]) < 0.8 * max(lab["h"], 20)]
            nums = [(t["cx"], to_number(t["text"])) for t in same if to_number(t["text"]) is not None]
            if nums:
                return max(nums)[1]
    return None
 
 
def structure_receipt(detected, items_box, img_w, img_h):
    tokens = _prep(detected)
    full_text = " ".join(t["text"] for t in tokens)
 
    # ---- date
    norm = re.sub(r"\s*([/\-.])\s*", r"\1", full_text)
    m = DATE_RE.search(norm) or DATE_TXT_RE.search(full_text)
    date = m.group(1) if m else None
 
    # ---- shop: biggest text in top 22% of image (fallback: text after 'For,')
    shop = None
    top = [t for t in tokens if t["cy"] < 0.22 * img_h and len(t["text"]) >= 3
           and to_number(t["text"]) is None]
    if top:
        shop = max(top, key=lambda t: t["h"])["text"]
    else:
        m2 = re.search(r"\bfor[,.]?\s+([A-Za-z&][A-Za-z&\s]{2,30})", full_text, re.I)
        shop = m2.group(1).strip() if m2 else None
 
    # ---- items region
    if items_box:
        x1, y1, x2, y2 = items_box
    else:
        x1, y1, x2, y2 = 0, 0.25 * img_h, img_w, 0.85 * img_h
    in_box = [t for t in tokens if x1 - 10 <= t["cx"] <= x2 + 10 and y1 - 10 <= t["cy"] <= y2 + 10]
 
    # ---- parse each visual row -> name + numbers
    parsed = []
    for row in _rows(in_box):
        toks = row["tokens"]
        joined = " ".join(t["text"] for t in toks).lower()
        if any(w in joined for w in SKIP_WORDS):
            continue
        # drop serial number at far left (1. 2. 3.)
        if toks and to_number(toks[0]["text"]) is not None and toks[0]["cx"] < x1 + 0.12 * (x2 - x1) \
                and len(toks) > 1:
            toks = toks[1:]
        nums = [to_number(t["text"]) for t in toks if to_number(t["text"]) is not None]
        name = " ".join(t["text"] for t in toks if to_number(t["text"]) is None).strip(" .:-|")
        if not name and not nums:
            continue
        parsed.append({"name": name, "nums": nums})
 
    # ---- handwriting wobble can split one item into 2 rows:
    #      [name only] followed by [numbers only] -> merge them
    merged = []
    for r in parsed:
        prev = merged[-1] if merged else None
        if prev and prev["name"] and not prev["nums"] and r["nums"] and not r["name"]:
            prev["nums"] = r["nums"]
        else:
            merged.append(r)
 
    items = []
    for r in merged:
        nums = r["nums"]
        amount = nums[-1] if nums else None
        rate = nums[-2] if len(nums) >= 2 else amount
        qty = nums[-3] if len(nums) >= 3 else 1
        # qty missing / misread: amount / rate gives a whole number -> trust it
        if rate and amount and rate > 0:
            ratio = amount / rate
            if 1 <= ratio <= 1000 and abs(ratio - round(ratio)) < 0.01 \
                    and (len(nums) < 3 or abs(qty * rate - amount) > 0.5):
                qty = float(round(ratio))
        items.append({"name": r["name"], "quantity": qty, "rate": rate, "amount": amount})
 
    items_sum = sum(i["amount"] for i in items if i["amount"])
    total = _find_labeled_amount(tokens, ("total",), exclude=("sub",))
    tax = _find_labeled_amount(tokens, ("tax", "gst"))
 
    return {
        "shop": shop,
        "date": date,
        "items": items,
        "items_sum": items_sum,
        "total": total if total is not None else (items_sum or None),
        "total_source": "ocr" if total is not None else "sum_of_items",
        "tax": tax,
    }
 







# """
# Rule-based receipt structuring.
# Input : EasyOCR detections (text + 4-point box) and optional YOLO 'items' box.
# Output: shop, date, items[], total, tax.
# """
# import re
# from statistics import median

# SKIP_WORDS = ("particular", "amount", "rate", "qty", "sl.", "sl no", "s.no")
# DATE_RE = re.compile(r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b")
# DATE_TXT_RE = re.compile(r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4})\b", re.I)


# def to_number(text):
#     """'5,500' -> 5500.0 ; 'l20' -> 120.0 ; 'Stand' -> None"""
#     t = text.strip().replace(" ", "")
#     if t in ("l", "I", "|", "/"):      # lone stroke = handwritten 1
#         return 1.0
#     if not t or not any(c.isdigit() for c in t):
#         return None
#     fixed = t.translate(str.maketrans({"O": "0", "o": "0", "l": "1", "I": "1", "|": "1", "S": "5"}))
#     cleaned = re.sub(r"[^0-9.]", "", fixed.replace(",", ""))
#     digitish = sum(c.isdigit() or c in ",.Oo lI|S" for c in t)
#     if len(cleaned.replace(".", "")) == 0 or digitish / len(t) < 0.7:
#         return None
#     try:
#         return float(cleaned.strip("."))
#     except ValueError:
#         return None


# def _prep(detected):
#     toks = []
#     for d in detected:
#         xs = [p[0] for p in d["bounding_box"]]
#         ys = [p[1] for p in d["bounding_box"]]
#         toks.append({
#             "text": d["text"].strip(), "conf": d.get("confidence", 0),
#             "x1": min(xs), "x2": max(xs), "y1": min(ys), "y2": max(ys),
#             "cx": (min(xs) + max(xs)) / 2, "cy": (min(ys) + max(ys)) / 2,
#             "h": max(ys) - min(ys),
#         })
#     return [t for t in toks if t["text"]]


# def _rows(tokens):
#     if not tokens:
#         return []
#     mh = median(t["h"] for t in tokens) or 20
#     rows = []
#     for t in sorted(tokens, key=lambda t: t["cy"]):
#         if rows and abs(t["cy"] - rows[-1]["cy"]) < 0.6 * mh:
#             rows[-1]["tokens"].append(t)
#             rows[-1]["cy"] = sum(x["cy"] for x in rows[-1]["tokens"]) / len(rows[-1]["tokens"])
#         else:
#             rows.append({"cy": t["cy"], "tokens": [t]})
#     for r in rows:
#         r["tokens"].sort(key=lambda t: t["cx"])
#     return rows


# def _find_labeled_amount(tokens, keywords, exclude=()):
#     """Find number on the same row, to the right of a label such as TOTAL / TAX."""
#     for lab in tokens:
#         low = lab["text"].lower()
#         if any(k in low for k in keywords) and not any(e in low for e in exclude):
#             # number inside the same token (e.g. 'TOTAL 2500')
#             for part in low.replace(":", " ").split():
#                 n = to_number(part)
#                 if n is not None and part not in keywords:
#                     return n
#             same = [t for t in tokens if t is not lab and t["cx"] > lab["cx"]
#                     and abs(t["cy"] - lab["cy"]) < 0.8 * max(lab["h"], 20)]
#             nums = [(t["cx"], to_number(t["text"])) for t in same if to_number(t["text"]) is not None]
#             if nums:
#                 return max(nums)[1]
#     return None


# def structure_receipt(detected, items_box, img_w, img_h):
#     tokens = _prep(detected)
#     full_text = " ".join(t["text"] for t in tokens)

#     # ---- date
#     norm = re.sub(r"\s*([/\-.])\s*", r"\1", full_text)
#     m = DATE_RE.search(norm) or DATE_TXT_RE.search(full_text)
#     date = m.group(1) if m else None

#     # ---- shop: biggest text in top 22% of image (fallback: text after 'For,')
#     shop = None
#     top = [t for t in tokens if t["cy"] < 0.22 * img_h and len(t["text"]) >= 3
#            and to_number(t["text"]) is None]
#     if top:
#         shop = max(top, key=lambda t: t["h"])["text"]
#     else:
#         m2 = re.search(r"\bfor[,.]?\s+([A-Za-z&][A-Za-z&\s]{2,30})", full_text, re.I)
#         shop = m2.group(1).strip() if m2 else None

#     # ---- items region
#     if items_box:
#         x1, y1, x2, y2 = items_box
#     else:
#         x1, y1, x2, y2 = 0, 0.25 * img_h, img_w, 0.85 * img_h
#     in_box = [t for t in tokens if x1 - 10 <= t["cx"] <= x2 + 10 and y1 - 10 <= t["cy"] <= y2 + 10]

#     items = []
#     for row in _rows(in_box):
#         toks = row["tokens"]
#         joined = " ".join(t["text"] for t in toks).lower()
#         if any(w in joined for w in SKIP_WORDS):
#             continue
#         # drop serial number at far left (1. 2. 3.)
#         if toks and to_number(toks[0]["text"]) is not None and toks[0]["cx"] < x1 + 0.12 * (x2 - x1) \
#                 and len(toks) > 1:
#             toks = toks[1:]
#         nums = [to_number(t["text"]) for t in toks if to_number(t["text"]) is not None]
#         name = " ".join(t["text"] for t in toks if to_number(t["text"]) is None).strip(" .:-|")
#         if not name and not nums:
#             continue
#         amount = nums[-1] if nums else None
#         rate = nums[-2] if len(nums) >= 2 else amount
#         qty = nums[-3] if len(nums) >= 3 else 1
#         items.append({"name": name, "quantity": qty, "rate": rate, "amount": amount})

#     items_sum = sum(i["amount"] for i in items if i["amount"])
#     total = _find_labeled_amount(tokens, ("total",), exclude=("sub",))
#     tax = _find_labeled_amount(tokens, ("tax", "gst"))

#     return {
#         "shop": shop,
#         "date": date,
#         "items": items,
#         "items_sum": items_sum,
#         "total": total if total is not None else (items_sum or None),
#         "total_source": "ocr" if total is not None else "sum_of_items",
#         "tax": tax,
#     }
