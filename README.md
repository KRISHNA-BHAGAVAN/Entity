# 🚀 Smart Documentation System (Entity)

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![LangChain](https://img.shields.io/badge/🦜_LangChain-FF4B4B?style=flat)](https://langchain.com/)

An **AI-powered document automation platform** that transforms repetitive document workflows into intelligent, format-preserving operations. Built for organizations and teams that work with recurring document templates like certificates, request letters, reports, and approvals.

---

## ✨ What Makes This Special?

Unlike traditional mail-merge tools that require manual placeholder setup, **Entity** uses **Large Language Models (LLMs)** to:

- 🔍 **Automatically discover** variable fields in your `.docx` documents
- 🎯 **Intelligently extract** data from complex document structures (tables, headers, footers)
- 💎 **Preserve formatting** perfectly while replacing content
- 📊 **Generate consolidated reports** across multiple events and documents
- 🔐 **Secure BYOK architecture** - your API keys, your control

---

## 🎯 Core Features

### 1. **AI Schema Discovery**
Upload any `.docx` file and let the AI scan it to identify:
- Names, dates, and entities
- Table data and structured information  
- Repeating patterns across multiple documents
- Custom fields you specify via natural language instructions

### 2. **Event-Based Organization**
- Group templates by events (conferences, workshops, projects)
- Manage multiple document versions per event
- Track event metadata (dates, descriptions)

### 3. **Smart Document Replacement**
- Replace identified variables across documents while preserving:
  - Font styles, colors, sizes
  - Paragraph formatting
  - Table structures
  - Headers and footers
- Handles complex scenarios like:
  - Merged text runs in Word
  - Multi-line replacements
  - Table cell content

### 4. **Automated Report Generation**
- Define custom report columns via drag-and-drop interface
- Generate Excel reports across date ranges
- AI-powered data extraction from documents
- Handle missing data with fallback mechanisms
- Skip empty events automatically

### 5. **Bring Your Own Key (BYOK)**
- Securely store your own API keys for:
  - OpenAI (GPT-4o, GPT-4o-mini, o3-mini)
  - Google Gemini (Gemini 1.5 Pro/Flash, Gemini 2.0 Flash)
  - Groq (Llama 3.3 70B, DeepSeek R1, Llama 3.1)
- Keys encrypted with AES-256-GCM
- Model validation before storage
- Complete audit trail

---

## 🛠️ Tech Stack

### **Frontend**
| Technology | Purpose |
|------------|---------|
| React 19 | Modern UI framework |
| Tailwind CSS 4 | Styling system |
| React Router 7 | Navigation |
| Lucide React | Icon system |
| React Markdown | Document preview |
| Vite (Rolldown) | Ultra-fast build tool |

### **Backend**
| Technology | Purpose |
|------------|---------|
| FastAPI | High-performance API framework |
| LangChain + LangGraph | AI orchestration |
| Python-DOCX | Document manipulation |
| Supabase | Auth, DB, Storage |
| Redis (optional) | Schema caching |
| Cryptography | API key encryption |

### **AI/LLM Integration**
- `langchain-openai` - OpenAI models
- `langchain-google-genai` - Google Gemini
- `langchain-groq` - Groq (ultra-fast inference)
- MarkItDown - Document to Markdown conversion

---

## 📋 Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10 or higher
- **Supabase Account** (free tier works)
- **API Keys** from at least one provider:
  - OpenAI, Google AI Studio, or Groq

---

## ⚡ Quick Start

### 1️⃣ Clone the Repository

```bash
git clone <repository-url>
cd "Smart Documentation System"
```

### 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

**Create `.env` file:**
```env
# Required
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
BUCKET_NAME=your_storage_bucket_name

# Master encryption key (generate once)
MASTER_KEY=generate_using_generate_master_key.py

# Optional fallback keys (system-level)
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key  
GOOGLE_API_KEY=your_gemini_key
```

**Generate master encryption key:**
```bash
python generate_master_key.py
```

**Run database migrations:**
```bash
# Check backend/migrations/*.sql and run them in Supabase SQL editor
```

**Start the server:**
```bash
uvicorn server:app --reload --port 8000
```

API docs available at: `http://localhost:8000/swagger`

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
```

**Create `.env` file:**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:8000
```

**Start development server:**
```bash
npm run dev
```

App will open at: `http://localhost:5173`

---

## 🎓 Usage Guide

### Step 1: Configure Your API Keys
1. Navigate to **Settings** → **Bring Your Own Keys**
2. Select a provider (OpenAI, Gemini, or Groq)
3. Choose a recommended model or enter a custom one
4. Paste your API key
5. Click **Test & Add Key** (validates before saving)

### Step 2: Create an Event
1. Go to **Dashboard**
2. Click **New Event**
3. Enter event name, description, and date
4. Upload your `.docx` template files

### Step 3: Discover Variables
1. Select documents from the list
2. Optionally add instructions (e.g., "Extract speaker names and session times")
3. Click **Discover Schema**
4. AI will analyze documents and suggest editable fields

### Step 4: Review & Edit Fields
1. Review discovered fields in the **Fields** tab
2. Edit field names or add/remove fields
3. Verify extracted values
4. Edit table data if needed

### Step 5: Generate Documents
1. Modify field values as needed
2. Click **Generate Documents**  
3. System creates updated `.docx` files with your changes
4. Download processed documents

### Step 6: Generate Reports (Optional)
1. Go to **Reports** page
2. Configure report columns (drag to reorder)
3. Set date range
4. Click **Generate Report**
5. Download consolidated Excel file

---

## 🔐 Security & Privacy

### Data Isolation
- User data is completely isolated (per-user Supabase storage)
- Documents never shared between users
- JWT-based authentication

### API Key Security
- All user API keys encrypted with **AES-256-GCM**
- Keys decrypted only in backend memory during execution
- Never logged or exposed in responses
- Complete audit trail of key operations

### Storage
- Documents stored in Supabase Cloud Storage
- Row-level security policies enforced
- Signed URLs for temporary access

---

## 📊 Project Structure

```
Smart Documentation System/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── schemaAgent.py         # LangGraph AI workflow
│   ├── byok_service.py        # API key management
│   ├── byok_encryption.py     # Encryption utilities
│   ├── byok_providers.py      # LLM provider adapters
│   ├── byok_endpoints.py      # BYOK API routes
│   ├── report_service.py      # Report generation logic
│   ├── report_agent.py        # Report AI agent
│   ├── storage_service.py     # Supabase client
│   ├── replace.py             # DOCX replacement engine
│   ├── extract.py             # Markdown extraction
│   ├── excel_generator.py     # Excel report builder
│   ├── migrations/            # SQL migrations
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Uploads.jsx
│   │   │   ├── SchemaDiscovery.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── BYOKSettings.jsx
│   │   │   └── PreviewPage.jsx
│   │   ├── components/
│   │   │   ├── Auth.jsx
│   │   │   ├── EventList.jsx
│   │   │   ├── FieldCard.jsx
│   │   │   ├── MarkdownPreview.jsx
│   │   │   ├── EditableTable.jsx
│   │   │   └── Report/
│   │   │       ├── ColumnConfig.jsx
│   │   │       └── UnresolvedFallback.jsx
│   │   ├── services/          # API client modules
│   │   └── config/            # Supabase config
│   └── package.json
│
├── example-docs/              # Sample templates
├── BYOK_ENFORCEMENT.md        # BYOK documentation
├── PRESENTATION.md            # Project presentation guide
└── README.md                  # This file
```

---

## 🚦 API Endpoints

### Authentication
All endpoints require JWT token in `Authorization: Bearer <token>` header

### Events
- `GET /events` - List user events
- `POST /events` - Create event
- `PUT /events/{id}` - Update event
- `DELETE /events/{id}` - Delete event

### Documents
- `GET /docs?event_id={id}` - List documents
- `POST /upload/url` - Get signed upload URL
- `POST /upload/confirm` - Confirm upload
- `GET /download/{doc_id}` - Download document
- `DELETE /docs/{doc_id}` - Delete document

### AI Operations
- `POST /discover-schema` - Run schema discovery
- `POST /extract-markdown` - Extract markdown from DOCX

### Reports
- `GET /report/columns` - Get report column config
- `POST /report/columns` - Update column config
- `POST /report/generate` - Generate report preview
- `POST /report/download` - Download Excel file

### BYOK
- `GET /api/byok` - List user API keys
- `POST /api/byok` - Add/update API key
- `POST /api/byok/validate` - Validate key
- `DELETE /api/byok/{provider}` - Revoke key

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
python test_byok_enforcement.py
```

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Event creation and management
- [ ] Document upload (check duplicates)
- [ ] Schema discovery with different models
- [ ] Document replacement and download
- [ ] Report generation across events
- [ ] BYOK key addition and validation

---

## 🐛 Common Issues

### Issue: "API Key Required" error
**Solution:** Navigate to Settings → BYOK and add your API key

### Issue: Schema discovery fails
**Solution:** 
1. Verify API key is valid
2. Check selected documents are `.docx` format
3. Review server logs for LLM errors

### Issue: Formatting lost after replacement
**Solution:** This is rare. Report as bug with sample document

### Issue: Upload fails
**Solution:** Check Supabase storage bucket permissions and RLS policies

---

## 🛣️ Roadmap

- [ ] Support for `.pdf` input documents
- [ ] Batch operations for multiple events
- [ ] Real-time collaboration on schemas
- [ ] Template marketplace
- [ ] API usage analytics dashboard
- [ ] Integration with Google Drive/OneDrive

---

## 📄 License

This project is provided as-is for educational and internal use.

---

## 👥 Contributors

**Development Team:**
- 22A91A61F9
- 22A91A6188  
- 22A91A61A4
- 22A91A61F2

**Based on Research:**  
*"LLM-Based Multi-Agent Generation of Semi-Structured Documents in the Public Administration Domain"* (Musumeci et al., 2024)

---

## 📞 Support

For issues and questions:
1. Check existing documentation (`BYOK_ENFORCEMENT.md`, `PRESENTATION.md`)
2. Review API docs at `/swagger`
3. Contact development team

---

**Built with ❤️ using AI and modern web technologies**
