import random
import shutil
from pathlib import Path

import yaml

ROOT = Path(__file__).parent / "dataset"
random.seed(42)

train_img = ROOT / "train" / "images"
train_lbl = ROOT / "train" / "labels"
val_img = ROOT / "valid" / "images"
val_lbl = ROOT / "valid" / "labels"
val_img.mkdir(parents=True, exist_ok=True)
val_lbl.mkdir(parents=True, exist_ok=True)

# Agar pehle se valid mein files hain to dobara split mat karo
if any(val_img.iterdir()):
    print("Valid split already exists, skipping move.")
else:
    images = sorted(train_img.glob("*"))
    random.shuffle(images)
    val_files = images[:3]

    for img in val_files:
        lbl = train_lbl / (img.stem + ".txt")
        shutil.move(str(img), val_img / img.name)
        if lbl.exists():
            shutil.move(str(lbl), val_lbl / lbl.name)

# data.yaml ko absolute paths ke saath dobara likho
yaml_path = ROOT / "data.yaml"
with open(yaml_path, "r", encoding="utf-8") as f:
    cfg = yaml.safe_load(f)

new_cfg = {
    "path": str(ROOT.resolve()),
    "train": "train/images",
    "val": "valid/images",
    "nc": cfg["nc"],
    "names": cfg["names"],
}

with open(yaml_path, "w", encoding="utf-8") as f:
    yaml.safe_dump(new_cfg, f, sort_keys=False)

print("Train images:", len(list(train_img.glob("*"))))
print("Valid images:", len(list(val_img.glob("*"))))
print("Classes:", new_cfg["names"])