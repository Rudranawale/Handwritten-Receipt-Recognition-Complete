# 🧾 ReceiptIQ — Handwritten Receipt Recognition & Expense Intelligence

<p align="center">
  <strong>Turn handwritten receipts into structured, searchable expense data.</strong>
</p>

<p align="center">
  <a href="https://receiptiq-frontend.onrender.com">🚀 Live Demo</a>
  •
  <a href="https://github.com/Rudranawale/Handwritten-Receipt-Recognition-Complete">📂 GitHub Repository</a>
</p>

---

## 📌 Overview

**ReceiptIQ** is an AI-powered web application designed to recognize handwritten receipts, extract meaningful information, and store it in a structured database.

The application helps users digitize receipt information and interact with their expense records through a natural-language AI assistant.

Instead of manually entering receipt details, users can upload a receipt image, extract its information, and query stored records.

## ✨ Key Features

- 📸 **Receipt Upload & Scanning** — Upload handwritten receipt images for processing.
- 🤖 **AI-Powered Data Extraction** — Extract shop name, date, items, quantities, prices, GST, and total amount using Gemini Vision.
- 💾 **Database Storage** — Store extracted receipt information in a MySQL-compatible database.
- 💬 **AI Assistant** — Ask natural-language questions about saved receipts.
- 🔍 **Receipt Dataset** — View and explore previously processed receipts.
- 📊 **Analytics Dashboard** — View expense insights and spending summaries.
- ⚙️ **Settings & Preferences** — Manage available application preferences.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Framework | TanStack Start |
| Styling | Tailwind CSS v4 |
| Backend | Python, FastAPI |
| Database | MySQL-compatible TiDB Cloud |
| AI / Extraction | Google Gemini Vision |
| Deployment | Render |

## 🔄 How It Works

1. Upload a handwritten receipt image.
2. The backend processes the image using AI-powered extraction.
3. Receipt information is organized into structured fields.
4. Extracted information is saved in the database.
5. Users can view saved receipts and ask questions through the AI assistant.

## 🧠 AI Assistant Examples

Users can ask questions such as:

- Show all receipts from RAHUL AUTO WORKS.
- How much did I spend in total?
- Which shop has the highest total expense?
- What is the most expensive item?
- Show my saved receipt records.

## 🏗️ Project Structure

```text
Handwritten-Receipt-Recognition-Complete/
│
├── backend/          # FastAPI backend and AI processing
├── frontend/         # React + TanStack Start application
├── dataset/          # Handwritten receipt dataset
├── research/         # Project research materials
│
└── README.md
```

## 🚀 Live Demo

**Try ReceiptIQ here:**

https://receiptiq-frontend.onrender.com

## 🔐 Environment Configuration

The application requires appropriate backend configuration, database credentials, and an AI API key.

Keep sensitive credentials in environment variables. Never commit your `.env` file or API keys to GitHub.

## ⚠️ Note

AI-generated receipt information may not always be completely accurate, particularly for unclear handwriting or low-quality images. Extracted values should be reviewed before relying on them.

## 👩‍💻 Developer

**Rudra Nawale**

Computer Engineering Student | Aspiring Software Developer

- GitHub: [@Rudranawale](https://github.com/Rudranawale)

---

<p align="center">
  Built with ❤️ to simplify handwritten receipt management.
</p>
