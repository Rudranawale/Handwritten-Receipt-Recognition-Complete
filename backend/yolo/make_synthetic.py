"""
Synthetic handwritten receipt generator (auto YOLO labels).

Usage (from backend/yolo):
    python make_synthetic.py 200          # 200 images
    python make_synthetic.py 200 --preview  # also writes preview.jpg (boxes drawn)

Output: synthetic_dataset/{train,valid}/{images,labels}, data_synthetic.yaml, data_mixed.yaml
"""
import random
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).parent
FONT_DIR = BASE / "fonts"
OUT = BASE / "synthetic_dataset"

# SAME ORDER as your real data.yaml
CLASSES = ["address", "date", "deals in babu sales and services", "items", "shop", "tax", "tot"]
CID = {c: i for i, c in enumerate(CLASSES)}

G = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
FONT_URLS = {
    "Caveat.ttf": G + "caveat/Caveat%5Bwght%5D.ttf",
    "Kalam.ttf": G + "kalam/Kalam-Regular.ttf",
    "PatrickHand.ttf": G + "patrickhand/PatrickHand-Regular.ttf",
    "IndieFlower.ttf": G + "indieflower/IndieFlower-Regular.ttf",
    "ReenieBeanie.ttf": G + "reeniebeanie/ReenieBeanie.ttf",
    "ShadowsIntoLight.ttf": G + "shadowsintolight/ShadowsIntoLight.ttf",
}
# (file, size multiplier so all fonts look similar in size)
HANDS = [("Caveat.ttf", 1.15), ("Kalam.ttf", 0.85), ("PatrickHand.ttf", 1.0),
         ("IndieFlower.ttf", 0.95), ("ReenieBeanie.ttf", 1.5), ("ShadowsIntoLight.ttf", 1.0)]

PAPERS = [(250, 200, 210), (255, 255, 250), (255, 245, 200), (212, 230, 250), (215, 240, 215), (245, 225, 235)]
LINES = [(190, 60, 75), (60, 80, 160), (90, 90, 90), (150, 40, 40), (30, 110, 70)]
INKS = [(20, 30, 120), (10, 10, 10), (30, 50, 160), (15, 15, 60), (40, 40, 40)]

SHOPS = ["B&K MOTORSPORTS", "SHARMA GENERAL STORE", "NEW LAXMI HARDWARE", "RAHUL AUTO WORKS",
         "SRI BALAJI TRADERS", "ANAND ELECTRICALS", "MAHALAXMI STATIONERS", "SINGH CYCLE STORE",
         "GANESH MOBILE POINT", "HOTEL ANNAPURNA", "BABU SALES & SERVICES", "PATIL AGENCIES",
         "TASHI ENTERPRISES", "KRISHNA TYRE HOUSE", "OM SAI MEDICAL STORE", "DAS BROTHERS"]
TAGS = ["Deals in Babu Sales and Services", "Deals in: Auto Parts & Accessories",
        "Dealers in Electronics & Mobile Accessories", "Deals in All Kinds of Hardware & Sanitary",
        "Deals in Stationery, Gift & General Items", "Deals in Two Wheeler Spares & Service",
        "Deals in Cycle, Tyre & Tube", "Wholesale & Retail Dealers"]
ADDR_PRINT = ["Near Bus Stand, Itanagar, Arunachal Pradesh", "2 Mile, Pasighat, East Siang - 791102",
              "Main Road, Camp, Pune - 411001", "Station Road, Ziro, Lower Subansiri",
              "Market Complex, Nashik, Maharashtra", "G.S. Road, Guwahati - 781005"]
ITEMS = ["Headlight", "Fibre", "Acceleration Cable", "Stand", "Clutch Plate", "Engine Oil", "Brake Pad",
         "Air Filter", "Chain Set", "Tyre Tube", "Battery", "Side Mirror", "Spark Plug", "Service Charges",
         "Labour", "Wire 2.5mm", "Switch", "Bulb 9W", "Notebook", "Pen Box", "Rice 5kg", "Sugar 2kg",
         "Mobile Cover", "Charger", "Ear Phone", "Tyre", "Horn", "Indicator", "Seat Cover", "Handle Grip",
         "Petrol Tank Cap", "Kick Rod", "Foot Rest", "Cement Bag", "PVC Pipe", "Paint 1L"]
NAMES = ["Rahul Sharma", "Tashi Dorjee", "Amit Patil", "Ritu Das", "Nabam Tuki", "Mohan Lal", "Sunita Devi",
         "Karan Singh", "Pema Khandu", "Vijay Kumar", "Anita Rao", "Joy Taba", "Rohit Joshi", "Neha Gupta"]
ADDR_HAND = ["2 Mile Pasighat", "Itanagar", "Main Road, Pune", "Camp Area, Nashik", "Station Rd, Ziro",
             "Ward No 4, Tezu", "Hill Colony", "Near Temple, Aalo", "Rly Colony, Pune", "Bazar Line, Along"]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def download_fonts():
    FONT_DIR.mkdir(exist_ok=True)
    for name, url in FONT_URLS.items():
        p = FONT_DIR / name
        if not p.exists():
            print("Downloading font", name)
            urllib.request.urlretrieve(url, p)


def print_font(size):
    for c in ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.truetype(str(FONT_DIR / "Kalam.ttf"), size)


def hand_font(spec, size):
    return ImageFont.truetype(str(FONT_DIR / spec[0]), max(10, int(size * spec[1])))


def hw(d, x, base, text, spec, size, ink, maxw=None):
    """Handwritten text, char by char with wobble. Returns bbox."""
    f = hand_font(spec, size)
    while maxw and f.getlength(text) > maxw and size > 12:
        size -= 2
        f = hand_font(spec, size)
    cx, boxes = x, []
    for ch in text:
        dy = random.randint(-2, 2)
        d.text((cx, base + dy), ch, font=f, fill=ink, anchor="ls")
        if ch != " ":
            boxes.append(d.textbbox((cx, base + dy), ch, font=f, anchor="ls"))
        cx += f.getlength(ch)
    if not boxes:
        return [x, base - 10, x + 5, base]
    return [min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes)]


def dots(d, x0, x1, y, color):
    for x in range(int(x0), int(x1), 6):
        d.point((x, y), fill=color)
        d.point((x + 1, y), fill=color)


def pad(b, p=5):
    return [b[0] - p, b[1] - p, b[2] + p, b[3] + p]


def rand_date():
    dd, mm, yy = random.randint(1, 28), random.randint(1, 12), random.choice([24, 25, 26])
    return random.choice([f"{dd:02d}/{mm:02d}/20{yy}", f"{dd}-{mm}-{yy}", f"{dd:02d}.{mm:02d}.20{yy}",
                          f"{dd} {MONTHS[mm-1]} 20{yy}"])


def build():
    W = random.randint(760, 860)
    img = Image.new("RGB", (W, 1500), random.choice(PAPERS))
    d = ImageDraw.Draw(img)
    line = random.choice(LINES)
    spec, ink = random.choice(HANDS), random.choice(INKS)
    B = {c: [] for c in CLASSES}
    m = random.randint(34, 50)
    tw = W - 2 * m

    # ---- header (printed): shop + tagline
    shop = random.choice(SHOPS)
    size = random.randint(36, 50)
    pf = print_font(size)
    while pf.getlength(shop) > tw - 20:
        size -= 2
        pf = print_font(size)
    sy = m + 28
    d.text((W / 2, sy), shop, font=pf, fill=line, anchor="mm")
    B["shop"].append(pad(d.textbbox((W / 2, sy), shop, font=pf, anchor="mm"), 4))
    tag = random.choice(TAGS)
    tf = print_font(random.randint(19, 23))
    ty = sy + 44
    d.text((W / 2, ty), tag, font=tf, fill=line, anchor="mm")
    B["deals in babu sales and services"].append(pad(d.textbbox((W / 2, ty), tag, font=tf, anchor="mm"), 4))
    d.text((W / 2, ty + 28), random.choice(ADDR_PRINT), font=print_font(16), fill=line, anchor="mm")

    # ---- Sl.No / Date / Name / Address
    lf = print_font(20)
    y0 = ty + 80
    d.text((m, y0), "Sl. No.", font=lf, fill=line, anchor="ls")
    d.text((m + 95, y0 + 4), str(random.randint(100, 999)), font=print_font(32), fill=(190, 30, 40), anchor="ls")
    dx = int(W * random.uniform(0.58, 0.64))
    d.text((dx, y0), "Date", font=lf, fill=line, anchor="ls")
    dots(d, dx + 50, W - m, y0 + 2, line)
    B["date"].append(pad(hw(d, dx + 60, y0 - 2, rand_date(), spec, 32, ink, W - m - dx - 70), 5))
    y1 = y0 + 48
    d.text((m, y1), "Name", font=lf, fill=line, anchor="ls")
    dots(d, m + 60, W - m, y1 + 2, line)
    hw(d, m + 70, y1 - 2, random.choice(NAMES), spec, 32, ink, tw - 90)
    y2 = y1 + 48
    d.text((m, y2), "Address", font=lf, fill=line, anchor="ls")
    dots(d, m + 85, W - m, y2 + 2, line)
    B["address"].append(pad(hw(d, m + 95, y2 - 2, random.choice(ADDR_HAND), spec, 32, ink, tw - 110), 5))

    # ---- table
    t0, hh = y2 + 26, 34
    fr = [0, 0.09, 0.56, 0.68, 0.83, 1.0]
    for i in range(1, 5):
        fr[i] += random.uniform(-0.02, 0.02)
    X = [m + int(tw * f) for f in fr]
    R = random.choice([9, 10, 11])
    rh = random.randint(46, 60)
    tb = t0 + hh + R * rh
    d.rectangle([m, t0, m + tw, tb], outline=line, width=2)
    d.line([m, t0 + hh, m + tw, t0 + hh], fill=line, width=2)
    for x in X[1:5]:
        d.line([x, t0, x, tb], fill=line, width=2)
    for i in range(1, R):
        d.line([m, t0 + hh + i * rh, m + tw, t0 + hh + i * rh], fill=line, width=1)
    hf = print_font(14)
    for k, t in enumerate(["SL. NO.", "PARTICULARS", "QTY.", "RATE", "AMOUNT"]):
        d.text(((X[k] + X[k + 1]) / 2, t0 + hh / 2), t, font=hf, fill=line, anchor="mm")

    n = random.randint(3, min(R, 8))
    total = 0
    for i in range(n):
        ry = t0 + hh + i * rh
        base = ry + rh - int(rh * 0.25)
        fs = rh * 0.6
        hw(d, X[0] + 10, base, f"{i + 1}.", spec, fs, ink)
        hw(d, X[1] + 12, base, random.choice(ITEMS), spec, fs, ink, X[2] - X[1] - 24)
        q = random.choice([1, 1, 1, 2, 2, 3, 4, 5, 10])
        r = random.choice([20, 30, 50, 60, 80, 100, 120, 150, 200, 250, 300, 450, 500, 600, 800, 1200, 2500, 5500])
        hw(d, X[2] + 14, base, str(q), spec, fs, ink, X[3] - X[2] - 20)
        hw(d, X[3] + 10, base, f"{r:,}" if random.random() < .5 else str(r), spec, fs, ink, X[4] - X[3] - 16)
        hw(d, X[4] + 10, base, f"{q * r:,}" if random.random() < .5 else str(q * r), spec, fs, ink, X[5] - X[4] - 16)
        total += q * r
    B["items"].append([X[1] + random.randint(-4, 4), t0 + hh + random.randint(-4, 2),
                       X[5] + random.randint(-4, 2), t0 + hh + n * rh + random.randint(-2, 6)])

    # ---- footer: [TAX] TOTAL ADVANCE BALANCE
    has_tax = random.random() < 0.5
    tax = 0
    labels = []
    if has_tax:
        pct = random.choice([5, 12, 18])
        tax = int(total * pct / 100)
        labels.append(("GST %d%%" % pct if random.random() < .5 else "TAX", "tax", tax))
    grand = total + tax
    adv = random.choice([0, 0, grand // 2, (grand // 100) * 50])
    labels += [("TOTAL", "tot", grand), ("ADVANCE", None, adv), ("BALANCE", None, grand - adv)]
    fh = 38
    fy = tb
    d.rectangle([X[2], fy, m + tw, fy + fh * len(labels)], outline=line, width=2)
    d.line([X[4], fy, X[4], fy + fh * len(labels)], fill=line, width=2)
    for i, (lab, cls, val) in enumerate(labels):
        top = fy + i * fh
        if i:
            d.line([X[2], top, m + tw, top], fill=line, width=1)
        d.text((X[4] - 10, top + fh / 2), lab + " :", font=print_font(15), fill=line, anchor="rm")
        if val or cls:
            b = hw(d, X[4] + 12, top + fh - 9, str(val), spec, 30, ink, X[5] - X[4] - 20)
            if cls:
                B[cls].append(pad(b, 6))
    ey = fy + fh * len(labels) + 45
    d.text((m, ey), "(Rupees", font=print_font(16), fill=line, anchor="ls")
    dots(d, m + 70, X[3], ey + 2, line)
    d.text((X[3] + 6, ey), "only", font=print_font(16), fill=line, anchor="ls")
    d.text((m + tw, ey + 50), "For, " + shop, font=print_font(18), fill=line, anchor="rs")
    Hf = ey + 90
    return img.crop((0, 0, W, Hf)), B


def augment(pil, B):
    img = np.array(pil)[:, :, ::-1].copy()
    h, w = img.shape[:2]
    p = int(0.07 * max(w, h))
    bg = random.choice([(70, 100, 140), (90, 90, 95), (225, 225, 225), (60, 60, 65), (120, 150, 170)])
    canvas = np.full((h + 2 * p, w + 2 * p, 3), bg, np.uint8)
    canvas = np.clip(canvas + np.random.normal(0, 6, canvas.shape), 0, 255).astype(np.uint8)
    canvas[p:p + h, p:p + w] = img
    H2, W2 = canvas.shape[:2]
    src = np.float32([[0, 0], [W2, 0], [W2, H2], [0, H2]])
    ang = np.deg2rad(random.uniform(-4, 4))
    c = np.float32([W2 / 2, H2 / 2])
    rot = np.float32([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
    j = 0.03 * min(W2, H2)
    dst = ((src - c) @ rot.T + c) + np.random.uniform(-j, j, (4, 2)).astype(np.float32)
    M = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    out = cv2.warpPerspective(canvas, M, (W2, H2), borderValue=bg)

    # lighting gradient + noise + blur
    gx, gy = np.meshgrid(np.linspace(0, 1, W2), np.linspace(0, 1, H2))
    a = random.uniform(0, 6.28)
    grad = 1.0 + random.uniform(0.05, 0.3) * (np.cos(a) * (gx - .5) + np.sin(a) * (gy - .5))
    out = np.clip(out * grad[:, :, None] * random.uniform(0.85, 1.1) + random.uniform(-12, 12), 0, 255)
    out = np.clip(out + np.random.normal(0, random.uniform(2, 7), out.shape), 0, 255).astype(np.uint8)
    if random.random() < 0.3:
        out = cv2.GaussianBlur(out, (3, 3), 0)

    # boxes -> transformed bounding rects
    scale = 960 / max(W2, H2)
    out = cv2.resize(out, (int(W2 * scale), int(H2 * scale)), interpolation=cv2.INTER_AREA)
    W3, H3 = out.shape[1], out.shape[0]
    labels = []
    for cls, boxes in B.items():
        for x1, y1, x2, y2 in boxes:
            pts = np.float32([[[x1 + p, y1 + p], [x2 + p, y1 + p], [x2 + p, y2 + p], [x1 + p, y2 + p]]])
            t = cv2.perspectiveTransform(pts, M)[0] * scale
            bx1, by1 = np.clip(t.min(0), 0, [W3, H3])
            bx2, by2 = np.clip(t.max(0), 0, [W3, H3])
            if bx2 - bx1 < 4 or by2 - by1 < 4:
                continue
            labels.append((CID[cls], (bx1 + bx2) / 2 / W3, (by1 + by2) / 2 / H3, (bx2 - bx1) / W3, (by2 - by1) / H3))
    return out, labels


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 200
    download_fonts()
    random.seed(7)
    np.random.seed(7)
    nval = max(10, n // 10)
    prev = []
    for split, cnt in [("train", n - nval), ("valid", nval)]:
        (OUT / split / "images").mkdir(parents=True, exist_ok=True)
        (OUT / split / "labels").mkdir(parents=True, exist_ok=True)
        for i in range(cnt):
            pil, B = build()
            im, labels = augment(pil, B)
            print(f"{split}: {i + 1}/{cnt}", flush=True)
            name = f"syn_{split}_{i:04d}"
            cv2.imwrite(str(OUT / split / "images" / f"{name}.jpg"), im, [cv2.IMWRITE_JPEG_QUALITY, random.randint(60, 95)])
            with open(OUT / split / "labels" / f"{name}.txt", "w") as f:
                for c, cx, cy, bw, bh in labels:
                    f.write(f"{c} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")
            if "--preview" in sys.argv and len(prev) < 12 and split == "train":
                v = im.copy()
                for c, cx, cy, bw, bh in labels:
                    H, W = v.shape[:2]
                    p1 = (int((cx - bw / 2) * W), int((cy - bh / 2) * H))
                    p2 = (int((cx + bw / 2) * W), int((cy + bh / 2) * H))
                    cv2.rectangle(v, p1, p2, (0, 0, 255), 2)
                    cv2.putText(v, CLASSES[c][:6], (p1[0], max(p1[1] - 4, 12)), 0, 0.5, (0, 120, 0), 1)
                prev.append(cv2.resize(v, (360, 480)))
        print(split, "done:", cnt)
    if prev:
        rows = [np.hstack(prev[i:i + 4]) for i in range(0, 12, 4) if len(prev[i:i + 4]) == 4]
        cv2.imwrite(str(BASE / "preview.jpg"), np.vstack(rows))

    names = "\n".join(f"  {i}: {c}" for i, c in enumerate(CLASSES))
    (BASE / "data_synthetic.yaml").write_text(
        f"path: {BASE.resolve().as_posix()}\ntrain: synthetic_dataset/train/images\n"
        f"val: synthetic_dataset/valid/images\nnames:\n{names}\n", encoding="utf-8")
    # synthetic + real for training, REAL images for validation (honest score)
    (BASE / "data_mixed.yaml").write_text(
        f"path: {BASE.resolve().as_posix()}\ntrain:\n  - dataset/train/images\n  - synthetic_dataset/train/images\n"
        f"val: dataset/valid/images\nnames:\n{names}\n", encoding="utf-8")
    print("Done. YAMLs written: data_synthetic.yaml, data_mixed.yaml")


if __name__ == "__main__":
    main()
