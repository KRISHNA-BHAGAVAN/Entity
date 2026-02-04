# Smart Documentation System

An AI-powered document processing platform that intelligently identifies, manages, and replaces variable fields in `.docx` templates. Built with a modern React frontend and a robust FastAPI backend, it leverages LLMs (Large Language Models) to discover schema structures from your documents, enabling automated customization at scale.

## 🚀 Key Features

*   **AI-Driven Schema Discovery**: Automatically scans uploaded DOCX files to identify editable fields (names, dates, entities) using LangGraph and Groq/OpenAI.
*   **Smart Text Replacement**: Replace identified variables across multiple documents while preserving original formatting.
*   **Bring Your Own Key (BYOK)**: Securely manage and use your own API keys for LLM providers (Groq, OpenAI, Gemini).
*   **Event-Based Organization**: Group templates and documents by specific events or projects.
*   **Real-time Previews**: Instant markdown previews of your documents.
*   **Secure Infrastructure**: Powered by Supabase for authentication, database, and object storage.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React 19 (Vite)
*   **Styling**: Tailwind CSS 4
*   **State/Routing**: React Router Dom 7
*   **Markdown**: React Markdown + Remark GFM
*   **PDF/DOCX**: `@react-pdf-viewer`, `mammoth` (for conversion)

### Backend
*   **Framework**: FastAPI (Python 3.10+)
*   **AI Orchestration**: LangChain, LangGraph
*   **LLM Integration**: `langchain-groq`, `langchain-openai`, `langchain-google-genai`
*   **Document Processing**: `python-docx`
*   **Database & Auth**: Supabase (via `supabase-py`)
*   **Caching**: Redis (optional, with in-memory fallback)

## 📂 Project Structure

```bash
├── backend/            # FastAPI server and AI logic
│   ├── migrations/     # Database migration scripts
│   ├── server.py       # Main API entry point
│   ├── schemaAgent.py  # LangGraph workflow for AI field discovery
│   ├── byok_service.py # Logic for secure API key management
│   └── ...
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Feature pages (Events, Editor, etc.)
│   │   ├── services/   # API client handling
│   │   └── ...
├── example-docs/       # Sample DOCX templates for testing
└── README.md           # This file
```

## ⚡ Getting Started

### Prerequisites
*   Node.js 18+
*   Python 3.10+
*   Supabase Project (for DB and Auth)

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd backend
```

Create a virtual environment and activate it:
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key

# Optional (for system-wide fallback keys)
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_gemini_key
```

Run the server:
```bash
uvicorn server:app --reload --port 8000
```
The API will be available at `http://localhost:8000`. Swagger docs at `/swagger`.

### 2. Frontend Setup

Navigate to the frontend directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Create a `.env.development` (or `.env`) file in the `frontend/` directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:8000
```

Run the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

## 📖 Usage Guide

1.  **Create an Event**: Start by creating a new Event (e.g., "Conference 2025") on the dashboard.
2.  **Upload Templates**: Upload your `.docx` files to the event. You can use the files in `example-docs/` to test.
3.  **Discover Schema**: Click "Discover Variables" to let the AI scan your documents and find dynamic fields.
4.  **Edit Values**: Review the discovered fields and input your desired values.
5.  **Generate**: Click "Generate/Replace" to create new versions of your documents with the filled data.

## 🔐 Security Note

This project uses a **BYOK (Bring Your Own Key)** architecture. User API keys are:
*   Encrypted before storage in the database.
*   Decrypted only strictly within the secure backend execution context.
*   Never exposed to the frontend or logs.
