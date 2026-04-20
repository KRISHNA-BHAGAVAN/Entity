from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.observability import configure_langsmith, install_langsmith_middleware
from app.core.supabase_runtime import clear_runtime_supabase_config, set_runtime_supabase_config
from app.modules.byod.router import byod_router
from app.modules.byok.router import byok_router
from app.modules.chat.router import chat_router
from app.modules.documents.router import documents_router
from app.modules.reports.router import reports_router
from app.modules.schema_discovery.router import schema_router
from app.modules.setup.router import setup_router

LANGSMITH_SETTINGS = configure_langsmith()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Document Processing API",
        version="1.0",
        description="API server for document processing and variable suggestions.",
        docs_url="/swagger",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_langsmith_middleware(app, LANGSMITH_SETTINGS)

    @app.middleware("http")
    async def bind_runtime_supabase_config(request, call_next):
        token = None
        header_url = request.headers.get("x-supabase-url")
        header_anon_key = request.headers.get("x-supabase-anon-key")

        if header_url or header_anon_key:
            if not (header_url and header_anon_key):
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Both X-Supabase-Url and X-Supabase-Anon-Key are required."},
                )
            try:
                token = set_runtime_supabase_config(header_url, header_anon_key)
            except ValueError as exc:
                return JSONResponse(status_code=400, content={"detail": str(exc)})

        try:
            return await call_next(request)
        finally:
            clear_runtime_supabase_config(token)

    app.include_router(byok_router)
    app.include_router(byod_router)
    app.include_router(documents_router)
    app.include_router(schema_router)
    app.include_router(chat_router)
    app.include_router(reports_router)
    app.include_router(setup_router)
    return app


app = create_app()
