from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.observability import configure_langsmith, install_langsmith_middleware
from app.modules.byod.router import byod_router
from app.modules.byok.router import byok_router
from app.modules.chat.router import chat_router
from app.modules.documents.router import documents_router
from app.modules.reports.router import reports_router
from app.modules.schema_discovery.router import schema_router

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
    app.include_router(byok_router)
    app.include_router(byod_router)
    app.include_router(documents_router)
    app.include_router(schema_router)
    app.include_router(chat_router)
    app.include_router(reports_router)
    return app


app = create_app()
