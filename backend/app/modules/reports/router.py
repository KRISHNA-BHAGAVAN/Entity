from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import get_jwt_token
from app.integrations.supabase.storage import get_user_supabase_client
from report_service import (
    finalize_report_excel,
    generate_report_preview,
    get_report_columns,
    resolve_event_with_docs,
    update_report_columns,
)

reports_router = APIRouter(tags=["Reports"])


class ColumnsUpdate(BaseModel):
    columns: List[Dict[str, Any]]


class ReportGenerateRequest(BaseModel):
    start_date: str
    end_date: str
    columns: List[Dict[str, Any]]


class ReportResolveRequest(BaseModel):
    event_id: str
    doc_ids: List[str]
    missing_columns: List[str]


class ReportDownloadRequest(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    start_date: str
    end_date: str


@reports_router.get("/report/columns")
async def get_columns(token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"columns": get_report_columns(token)}


@reports_router.post("/report/columns")
async def update_columns(data: ColumnsUpdate, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"columns": update_report_columns(data.columns, token)}


@reports_router.post("/report/generate")
async def generate_report(req: ReportGenerateRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    supabase = get_user_supabase_client(token)
    user_id = supabase.auth.get_user().user.id
    return generate_report_preview(
        req.start_date,
        req.end_date,
        req.columns,
        token,
        user_id=user_id,
        llm_provider=None,
        llm_model=None,
    )


@reports_router.post("/report/resolve")
async def resolve_report(req: ReportResolveRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"resolved_data": resolve_event_with_docs(req.event_id, req.doc_ids, req.missing_columns, token)}


@reports_router.post("/report/download")
async def download_report(req: ReportDownloadRequest):
    time_desc = f"{req.start_date}_to_{req.end_date}"
    excel_bytes = finalize_report_excel(req.columns, req.rows, time_desc)
    filename = f"Report_{time_desc}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

