# Dataset Research: Handwritten Receipt & Document Datasets

---

## 1. Overview & Dataset Selection Strategy

To build a **Handwritten Receipt Recognition and Information Extraction System**, we need datasets for two distinct sub-tasks:
1. **Handwritten Text Recognition (HTR)**: Datasets containing annotated handwritten words and lines to train the AI to read human handwriting.
2. **Key Information Extraction (KIE) & Receipt Layout Analysis**: Datasets containing receipt images with bounding boxes and structured key-value labels (e.g., Store Name, Date, Total).

Because public datasets containing *only* handwritten receipts are rare, the project strategy involves combining **standard HTR datasets** (for reading handwriting) with **receipt structure datasets** (for learning field extraction), complemented by a **custom annotated dataset of handwritten receipts**.

---

## 2. Comprehensive Dataset Comparison Table

> [!NOTE]
> All links and licenses listed below represent official sources. Data marked with `[Requires Verification]` indicates internal project tasks or custom dataset steps that will be completed in Phase 1.

| Dataset Name | Source Link | Document Type | Text Type | Annotations Available | License | Project Suitability | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SROIE** *(ICDAR 2019 Scanned Receipts)* | [Official RRC Page](https://rrc.cvc.uab.es/?ch=13&com=downloads) | Scanned retail receipts (1,000 images) | Primarily Printed (some stamps/notes) | Bounding boxes, text OCR, KIE fields (Company, Date, Address, Total) | Academic / Research Use | **High** for receipt layout & KIE pipeline; **Low** for handwriting recognition. | Verified (ICDAR 2019 Official) |
| **IAM Handwriting Database** | [FKI Bern Database](https://fki.tic.heia-fr.ch/databases/iam-handwriting-database) | Scanned handwritten English forms (1,539 pages) | Fully Handwritten | Word/line bounding boxes, full ASCII text transcriptions | Non-Commercial / Academic | **High** for fine-tuning HTR models (TrOCR/CRNN); lacks receipt structure. | Verified (Standard HTR Benchmark) |
| **CORD** *(Consolidated Receipt Dataset)* | [Hugging Face Dataset](https://huggingface.co/datasets/naver-clova-ix/cord-v2) | Shopping receipts (1,000+ receipts) | Printed Text | Hierarchical JSON, bounding boxes, field labels (menu items, prices, total) | CC BY-NC-SA 4.0 | **High** for learning receipt schema & parsing; lacks handwriting samples. | Verified (NAVER Clova Official) |
| **FUNSD** *(Form Understanding in Noisy Scanned Docs)* | [FUNSD Website](https://guillaumejaume.github.io/FUNSD/) | Real-world noisy forms (199 forms) | Mixed (Printed + Handwritten entries) | Word bounding boxes, transcriptions, Key-Value pairs, Entity types | Non-Commercial / Research | **Medium** for spatial Key-Value linking in noisy/handwritten documents. | Verified (Document AI Benchmark) |
| **Custom Handwritten Receipt Dataset** | *Local Workspace / Project Collection* | Scanned/photographed handwritten receipts | Fully Handwritten / Hybrid | Line bounding boxes, text transcriptions, structured field JSON (`total`, `date`, etc.) | Project License | **Essential** for domain-specific testing and final evaluation. | `[Requires Creation & Annotation]` |

---

## 3. Analysis & Key Takeaways for Beginners

### A. Why Can't We Use Just One Public Dataset?
- **SROIE** and **CORD** provide excellent receipt structure labels (Total, Date, Store), but their text is printed by cash registers. If we train an OCR model only on them, it will fail on handwritten text.
- **IAM** provides thousands of handwritten words, but they are written in paragraph/essay formats, not receipts.
- **Solution**: We pretrain/fine-tune our HTR model on **IAM**, use **SROIE/CORD** to understand receipt bounding box structures, and evaluate on our **Custom Handwritten Receipt Dataset**.

### B. Annotation Formats Explained in Simple Terms
- **Bounding Boxes (BBox)**: Coordinates `[x_min, y_min, x_max, y_max]` defining where text is located on the image.
- **Transcriptions**: Plain text strings representing what the image text actually says.
- **Key-Value Pairs**: Relationships mapping labels to values, e.g., `"Total"` $\rightarrow$ `"$45.00"`.

---

## 4. Phase 1 Action Plan for Datasets

1. Download sample subsets of **SROIE** and **IAM** for initial pipeline validation.
2. Collect 20-50 real handwritten receipt samples for initial testing.
3. Label custom receipt samples using open-source tools (e.g., LabelImg or CVAT) to create bounding box and transcription annotations. `[Requires Verification / Setup]`
