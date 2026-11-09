# from pathlib import Path
# from ultralytics import YOLO

# if __name__ == "__main__":
#     # data_yaml = Path(__file__).parent / "dataset" / "data.yaml"
#     data_yaml = Path(__file__).parent / "data_mixed.yaml"

#     model = YOLO("yolo11n.pt")  # chhota model, CPU par bhi chalega

#     model.train(
#         data=str(data_yaml),
#         # epochs=100,
#         epochs=40,
#         # imgsz=640,
#         imgsz=512,
#         batch=8,
#         patience=15,
#         workers=0,       # Windows par errors se bachne ke liye
#         device="cpu",    # GPU hai to 0 kar do
#         project=str(Path(__file__).parent / "runs"),
#         # name="receipt_model",
#         name="receipt_model_v2"
#     )



from pathlib import Path
from ultralytics import YOLO

if __name__ == "__main__":
    base = Path(__file__).parent
    data_yaml = base / "data_mixed.yaml"

    model = YOLO("yolo11n.pt")

    model.train(
        data=str(data_yaml),
        epochs=40,
        imgsz=512,
        batch=8,
        patience=15,
        workers=0,
        device="cpu",
        project=str(base / "runs"),
        name="receipt_model_v2",
    )