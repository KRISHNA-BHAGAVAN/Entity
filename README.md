# Smart Documentation System - AI-Powered Document Automation Pipeline

A full-stack application for intelligent document template management with AI-powered variable extraction and automated text replacement in DOCX files while preserving formatting.

## 🚀 Features

- **Event-Based Organization**: Create and manage document templates organized by events
- **AI Variable Discovery**: Automatically identify and suggest replaceable variables using Groq Llama 3.3 LLM
- **Smart Document Processing**: Replace variables in DOCX files while preserving formatting across runs, tables, and text boxes
- **Advanced Schema Discovery**: Multi-phase AI workflow for analyzing document patterns and extracting structured data with entity consolidation
- **Interactive Table Editing**: Extract, view, and edit tables from DOCX files with real-time preview
- **User Authentication**: Secure multi-user access with Supabase Auth and JWT tokens
- **Cloud Storage**: Isolated user document storage with Supabase Storage
- **Real-time Preview**: Markdown preview of document content with MarkItDown and precise text highlighting
- **Batch Processing**: Generate multiple documents simultaneously with ZIP download
- **Background Processing**: Asynchronous markdown extraction and document processing
- **Intelligent Caching**: Redis-based caching for schema discovery with fallback to in-memory cache
- **Undo/Redo System**: Complete history tracking for fields and table edits

## 🏗️ Architecture

### Frontend (React 19 + Vite)

- **Framework**: React 19 with Vite and Rolldown bundler (rolldown-vite@7.2.5)
- **Styling**: Tailwind CSS 4.x with @tailwindcss/vite plugin
- **Authentication**: Supabase Auth with session management
- **State Management**: React hooks and context with ToastContext
- **UI Components**: Lucide React icons, custom components with responsive design
- **File Handling**: JSZip for batch downloads, react-markdown for previews
- **PDF Support**: @react-pdf-viewer for document previews
- **Routing**: React Router DOM v7 with search params
- **Data Management**: Dexie for local storage with React hooks

### Backend (FastAPI + Python)

- **Framework**: FastAPI with async support and LangServe integration
- **AI Integration**: LangChain with Groq LLM (Llama 3.3-70B-Versatile)
- **Document Processing**: python-docx, MarkItDown for DOCX to Markdown conversion
- **Table Extraction**: Advanced table extraction with paragraph-level data preservation
- **Advanced Features**: Multi-phase schema discovery workflow with entity consolidation
- **Caching**: Redis caching with fallback to in-memory cache
- **Token Management**: tiktoken for precise token counting and cost estimation
- **Database**: Supabase PostgreSQL with RLS (Row Level Security)
- **Storage**: Supabase Storage with signed URLs and user isolation
- **Background Tasks**: Threading for async markdown extraction and table processing
- **Text Processing**: Advanced text normalization and fuzzy deduplication

## 📋 Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase account with database and storage bucket
- Groq API key for LLM access
- Redis server (optional, for caching - falls back to in-memory cache)

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
# Optional Redis configuration (falls back to in-memory cache)
REDIS_HOST=localhost
REDIS_PORT=6379
```

4. Start Redis server (optional, for caching):

```bash
redis-server
```

5. Start the FastAPI server:

```bash
python server.py
```

The server will start at `http://127.0.0.1:8000` with Swagger docs at `/swagger`

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

The frontend will be available at `http://localhost:5173`

## 🗄️ Database Schema

The application uses Supabase PostgreSQL with Row Level Security (RLS) enabled:

### Tables

- **events**: Event management with user isolation
  - `id`, `name`, `description`, `created_at`, `user_id`, `event_schema`
- **templates**: Document templates with metadata
  - `id`, `event_id`, `name`, `original_file_path`, `template_file_path`
  - `variables`, `upload_date`, `markdown_content`, `table_data`, `user_id`

### Storage

- **Bucket**: User-isolated file storage with path structure: `{user_id}/{event_id}/{doc_id}/{filename}`
- **Security**: Signed URLs for secure uploads and downloads

## 🔄 Workflow

1. **Authentication**: Users sign in via Supabase Auth with JWT token management
2. **Event Management**: Create and organize events for different document workflows
3. **Document Upload**:
   - Upload DOCX files with duplicate detection
   - Signed URL generation for secure uploads
   - Background markdown and table extraction using MarkItDown
4. **AI Schema Discovery**:
   - Multi-phase workflow: Raw Discovery → Structural Merge → Entity Consolidation → Location Mapping
   - Convert DOCX to Markdown for AI analysis
   - Use Groq Llama 3.3 for intelligent field extraction with custom instructions
   - Entity consolidation to merge related fields across documents
   - Precise markdown location tracking for frontend highlighting
5. **Interactive Editing**:
   - Field management with undo/redo support
   - Table extraction and editing with real-time preview
   - Reference mapping and replacement value assignment
6. **Document Generation**:
   - Advanced text replacement preserving DOCX formatting
   - Support for runs, tables, and text boxes with multi-line cell handling
   - Batch processing with ZIP downloads
7. **Performance Optimization**: Redis caching, token counting, and processing statistics

## 📁 Project Structure

```
entity-v3/
├── backend/
│   ├── migrations/           # Database migration scripts
│   │   ├── add_event_schema_column.sql
│   │   └── add_table_data_column.sql
│   ├── server.py             # FastAPI application with LangServe
│   ├── extract.py            # DOCX to Markdown conversion
│   ├── extract_tables.py     # Advanced table extraction from DOCX
│   ├── replace.py            # Advanced text replacement in DOCX
│   ├── schemaAgent.py        # Multi-phase schema discovery workflow
│   ├── schemaModels.py       # Pydantic models for schema discovery
│   ├── docx_tools.py         # DOCX manipulation utilities
│   ├── storage_service.py    # Supabase integration with JWT auth
│   ├── requirements.txt      # Python dependencies
│   └── convert_to_pdf.py     # PDF conversion utilities
├── frontend/
│   ├── public/
│   │   ├── pdfjs/           # PDF.js worker files
│   │   └── entity-*.svg     # Logo assets
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Auth.jsx     # Authentication component
│   │   │   ├── SideMenu.jsx # Navigation sidebar
│   │   │   ├── FieldsTab.jsx # Field management interface
│   │   │   ├── TablesTab.jsx # Table editing interface
│   │   │   ├── StatsTab.jsx  # Processing statistics
│   │   │   ├── FieldCard.jsx # Individual field editor
│   │   │   ├── EditableTable.jsx # Interactive table editor
│   │   │   └── MarkdownPreview.jsx # Document preview with highlighting
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.jsx # Main dashboard
│   │   │   ├── Uploads.jsx   # Document upload management
│   │   │   ├── SchemaDiscovery.jsx # Schema discovery interface
│   │   │   └── PreviewPage.jsx # Document preview page
│   │   ├── contexts/        # React contexts
│   │   │   └── ToastContext.jsx # Toast notification system
│   │   ├── services/        # API and service clients
│   │   │   ├── supabaseClient.js # Supabase configuration
│   │   │   ├── storage.js    # Storage operations
│   │   │   ├── docService.js # Document processing
│   │   │   └── aiService.js  # AI service integration
│   │   ├── config/          # Configuration files
│   │   └── utils/           # Utility functions
│   ├── package.json
│   └── vite.config.js       # Vite configuration with Rolldown
├── example-docs/            # Sample documents for testing
└── .amazonq/                # Amazon Q configuration
    └── rules/
        └── clarity.md       # Development guidelines
```

## 🔧 API Endpoints

### Document Processing

- `POST /extract-markdown` - Convert DOCX to Markdown using MarkItDown
- `POST /replace-text/{doc_id}` - Advanced text replacement in DOCX with formatting preservation
- `POST /docs/{doc_id}/extract` - Manual trigger for markdown and table extraction
- `POST /discover-schema` - Multi-phase schema discovery workflow with entity consolidation

### Storage Management

- `GET /events` - List user events with JWT authentication
- `POST /events` - Create event
- `PUT /events/{event_id}` - Update event with schema data
- `DELETE /events/{event_id}` - Delete event and associated documents
- `GET /docs` - List documents (optionally filtered by event)
- `POST /docs/upload-url` - Generate signed upload URL with duplicate detection
- `POST /docs/confirm` - Confirm upload and trigger background processing
- `GET /docs/{doc_id}` - Download document
- `PUT /docs/{doc_id}/template` - Update template with variables
- `DELETE /docs/{doc_id}` - Delete document from storage and database
- `DELETE /events/{event_id}/docs` - Batch delete all event documents

### API Documentation

- Swagger UI available at `/swagger`
- All endpoints support JWT authentication via Authorization header

## 🧪 Testing

### Backend Tests

```bash
cd backend
python test.py                    # General testing utilities
# Test document processing with example files
python replace.py                 # Test DOCX replacement functionality
```

### Frontend Tests

```bash
cd frontend
npm run lint                      # ESLint code quality checks
npm run build                     # Test build process
```

### Example Documents

The `example-docs/` folder contains sample DOCX files for testing:

- Request letters
- Mail templates
- Brochures
- Schedules and circulars

## 🚀 Deployment

### Backend Deployment

- Deploy to cloud platforms like Railway, Render, Heroku, or AWS
- Set environment variables (Supabase, Groq API, Redis)
- Configure CORS settings for frontend domain
- Ensure Redis is available (or disable caching)
- FastAPI serves at port 8000 by default

### Frontend Deployment

- Build: `npm run build`
- Deploy to Vercel, Netlify, or similar platforms
- Configure environment variables for production
- Update API base URL in production build
- Ensure Supabase RLS policies are properly configured

### Database Setup

- Create Supabase project with PostgreSQL database
- Set up storage bucket with appropriate policies
- Configure Row Level Security (RLS) for user isolation
- Create necessary tables: `events`, `templates`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Install dependencies for both frontend and backend
4. Follow the existing code style and patterns
5. Test your changes with example documents
6. Commit changes: `git commit -am 'Add new feature'`
7. Push to branch: `git push origin feature/new-feature`
8. Submit pull request with detailed description

### Development Guidelines

- Use TypeScript/JSX for frontend components
- Follow FastAPI patterns for backend endpoints
- Maintain JWT authentication throughout
- Test document processing with various DOCX formats
- Ensure user data isolation and security

## 📄 License

This project is licensed under the MIT License.

## 🏆 Key Innovations

- **Multi-Phase AI Schema Discovery**: Advanced workflow with raw discovery, structural merging, entity consolidation, and precise location mapping
- **Entity Consolidation**: LLM-powered consolidation of related fields across documents to reduce redundancy
- **Interactive Table Editing**: Extract and edit DOCX tables with paragraph-level precision and real-time preview
- **Intelligent Caching**: Redis-based caching with content hashing for schema discovery optimization
- **Precise Text Highlighting**: Markdown location tracking with character-level precision for frontend highlighting
- **Format Preservation**: Advanced DOCX processing that maintains formatting across runs, tables, and text boxes
- **Undo/Redo System**: Complete history tracking for both field management and table edits
- **User Isolation**: Complete data separation with JWT authentication and RLS policies
- **Background Processing**: Asynchronous document processing for better user experience
- **Batch Operations**: Efficient handling of multiple documents with ZIP packaging
- **Custom Instructions**: User-defined extraction instructions for targeted schema discovery

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React 19 Documentation](https://react.dev/)
- [LangChain Documentation](https://python.langchain.com/)
- [Groq API Documentation](https://console.groq.com/docs)
- [LangServe Documentation](https://python.langchain.com/docs/langserve)
- [Tailwind CSS 4.x Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/)

## 🎓 Academic Context

This project was developed as part of academic research in AI-powered document automation. It extends existing work in LLM-based document generation by introducing:

- Automatic variable discovery from unstructured DOCX documents
- Format-preserving text replacement across complex document structures
- End-to-end document automation workflows
- Multi-user secure document management

For detailed presentation materials, see `PRESENTATION.md`.
