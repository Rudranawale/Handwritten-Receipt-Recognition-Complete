# from pathlib import Path
# from ultralytics import YOLO

# base = Path(__file__).parent
# model = YOLO(str(base / "runs" / "receipt_model" / "weights" / "best.pt"))

# # valid folder ki koi bhi image
# img = next((base / "dataset" / "valid" / "images").glob("*"))

# results = model.predict(source=str(img), conf=0.15, save=True, project=str(base / "runs"), name="test_pred", exist_ok=True)

# for box in results[0].boxes:
#     cls = model.names[int(box.cls)]
#     print(cls, round(float(box.conf), 2), [int(x) for x in box.xyxy[0]])


from pathlib import Path
from ultralytics import YOLO

base = Path(__file__).parent
model = YOLO(str(base / "runs" / "receipt_model_v2" / "weights" / "best.pt"))

imgs = list((base / "dataset" / "valid" / "images").glob("*"))
imgs += list((base / "dataset" / "train" / "images").glob("*"))[:5]

results = model.predict(source=[str(i) for i in imgs], conf=0.05, save=True,
                        project=str(base / "runs"), name="test_pred_v2", exist_ok=True)

for img, r in zip(imgs, results):
    print("\n", img.name[:30])
    for box in r.boxes:
        print("  ", model.names[int(box.cls)], round(float(box.conf), 2))