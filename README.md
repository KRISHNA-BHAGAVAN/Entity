# Entity - Document Template Management System

A full-stack application for managing document templates with AI-powered variable extraction and automated text replacement in DOCX files.

## 🚀 Features

- **Event Management**: Create and organize document templates by events
- **AI Variable Extraction**: Automatically identify placeholders in documents using LLM
- **Template Processing**: Replace variables in DOCX files while preserving formatting
- **User Authentication**: Secure access with Supabase Auth
- **Cloud Storage**: Document storage with Supabase Storage
- **Real-time Preview**: Markdown preview of document content

## 🏗️ Architecture

### Frontend (React + Vite)
- **Framework**: React 19 with Vite
- **Styling**: Tailwind CSS 4.x
- **Authentication**: Supabase Auth
- **State Management**: React hooks
- **UI Components**: Lucide React icons

### Backend (FastAPI + Python)
- **Framework**: FastAPI with async support
- **AI Integration**: LangChain with Groq LLM (Llama 3.1)
- **Document Processing**: python-docx, MarkItDown
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage

## 📋 Prerequisites

- Node.js 18+
- Python 3.8+
- Supabase account
- Groq API key

## 🛠️ Installation

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
BUCKET_NAME=your_storage_bucket_name
GROQ_API_KEY=your_groq_api_key
```

4. Start the server:
```bash
python server.py
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.development` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start development server:
```bash
npm run dev
```

## 🗄️ Database Schema

### Events Table
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);
```

### Templates Table
```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  name TEXT NOT NULL,
  original_file_path TEXT,
  template_file_path TEXT,
  variables JSONB DEFAULT '[]',
  upload_date TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);
```

## 🔄 Workflow

1. **Authentication**: Users sign in via Supabase Auth
2. **Event Creation**: Create events to organize templates
3. **Document Upload**: Upload DOCX files to events
4. **AI Analysis**: System extracts potential variables using LLM
5. **Template Creation**: Map variables to document placeholders
6. **Document Generation**: Replace variables and download processed documents

## 📁 Project Structure

```
entity-v3/
├── backend/
│   ├── agent.py          # AI variable suggestion chain
│   ├── extract.py        # DOCX to Markdown conversion
│   ├── replace.py        # Text replacement in DOCX
│   ├── server.py         # FastAPI application
│   ├── storage_service.py # Supabase integration
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API and Supabase clients
│   │   ├── config/       # Configuration files
│   │   └── utils/        # Utility functions
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔧 API Endpoints

### Document Processing
- `POST /extract-markdown` - Convert DOCX to Markdown
- `POST /replace-text/{doc_id}` - Replace text in document
- `POST /suggest_variables/invoke` - AI variable suggestions

### Storage Management
- `GET /events` - List user events
- `POST /events` - Create event
- `DELETE /events/{event_id}` - Delete event
- `GET /docs` - List documents
- `POST /docs` - Upload document
- `PUT /docs/{doc_id}/template` - Update template
- `DELETE /docs/{doc_id}` - Delete document

## 🧪 Testing

### Backend Tests
```bash
cd backend
python test_docx_integrity.py
python test_supabase_docx.py
```

### Frontend Tests
```bash
cd frontend
npm run lint
```

## 🚀 Deployment

### Backend Deployment
- Deploy to cloud platforms like Railway, Render, or AWS
- Set environment variables
- Ensure CORS settings allow frontend domain

### Frontend Deployment
- Build: `npm run build`
- Deploy to Vercel, Netlify, or similar platforms
- Update API base URL for production

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [LangChain Documentation](https://python.langchain.com/)