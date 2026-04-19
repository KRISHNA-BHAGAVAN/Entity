import json
import re
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langsmith import traceable
from pydantic import BaseModel

from app.core.auth import get_jwt_token
from app.integrations.supabase.storage import get_user_supabase_client
from chat_agent import build_agent_for_user, stream_agent_response

chat_router = APIRouter(tags=["Chat"])


class ChatStreamRequest(BaseModel):
    message: str
    event_ids: Optional[List[str]] = None
    thread_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None


class ChatResetRequest(BaseModel):
    thread_id: Optional[str] = None


def _sse_data(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


def _normalize_event_text(text: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", " ", (text or "").lower())
    return " ".join(normalized.split())


def _resolve_event_ids_from_message(supabase: Any, user_id: str, message: str) -> Optional[List[str]]:
    normalized_message = _normalize_event_text(message)
    if not normalized_message:
        return None
    events_result = supabase.table("events").select("id, name").eq("user_id", user_id).execute()
    events = events_result.data or []
    best_score = 0
    best_ids: List[str] = []
    for event in events:
        normalized_event = _normalize_event_text(event.get("name") or "")
        if not normalized_event:
            continue
        if normalized_event in normalized_message:
            score = 100 + len(normalized_event)
        else:
            event_tokens = [token for token in normalized_event.split() if len(token) > 2]
            message_tokens = set(normalized_message.split())
            score = sum(1 for token in event_tokens if token in message_tokens)
        if score > best_score:
            best_score = score
            best_ids = [event.get("id")]
        elif score == best_score and score > 0:
            best_ids.append(event.get("id"))
    if best_score <= 0 or len(best_ids) != 1:
        return None
    return [best_ids[0]]


@chat_router.post("/chat/stream")
@traceable(run_type="chain", name="Chat Stream API")
async def chat_stream(req: ChatStreamRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    try:
        supabase = get_user_supabase_client(token)
        user_id = supabase.auth.get_user().user.id
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

    thread_id = req.thread_id or str(uuid.uuid4())
    resolved_event_ids = req.event_ids or _resolve_event_ids_from_message(supabase=supabase, user_id=user_id, message=message)

    try:
        agent, key_metadata = await build_agent_for_user(user_id=user_id, jwt_token=token, event_ids=resolved_event_ids)
    except Exception as exc:
        error_msg = str(exc)
        if "BYOK_REQUIRED" in error_msg or "BYOK_SETUP_REQUIRED" in error_msg:
            raise HTTPException(
                status_code=403,
                detail={"error": "BYOK_REQUIRED", "message": "Please add and validate your BYOK key in Settings before using Agent Chat.", "action": "setup_keys"},
            ) from exc
        raise HTTPException(status_code=500, detail=f"Failed to initialize chat agent: {error_msg}") from exc

    async def event_stream():
        yield _sse_data({"type": "status", "message": "initializing", "thread_id": thread_id})
        yield _sse_data({"type": "meta", "thread_id": thread_id, "key_info": key_metadata})
        yield _sse_data({"type": "status", "message": "thinking", "thread_id": thread_id})
        try:
            async for chunk in stream_agent_response(
                agent=agent,
                user_message=message,
                thread_id=thread_id,
                history=req.history,
            ):
                yield _sse_data(chunk)
            yield _sse_data({"type": "done", "thread_id": thread_id})
        except Exception as exc:
            yield _sse_data({"type": "error", "message": str(exc), "thread_id": thread_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@chat_router.post("/chat/reset")
async def chat_reset(req: ChatResetRequest, token: Optional[str] = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"reset": True, "thread_id": str(uuid.uuid4())}
