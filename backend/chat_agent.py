import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from byok_service import key_broker
from storage_service import get_user_supabase_client

MEMORY_SAVER = InMemorySaver()

DEFAULT_MODEL_BY_PROVIDER: Dict[str, str] = {
    "openai": "gpt-4.1-mini",
    "gemini": "gemini-2.0-flash",
    "groq": "llama-3.3-70b-versatile",
}


def _keyword_tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-zA-Z0-9_]+", (text or "").lower()) if len(token) > 2}


def _chunk_text(text: str, chunk_size: int = 1800, overlap: int = 250) -> List[str]:
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: List[str] = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        if end >= text_len:
            break
        start = max(end - overlap, start + 1)
    return chunks


def _compress_markdown(markdown: str, question: str, max_chars: int = 8000) -> str:
    if not markdown:
        return ""

    if len(markdown) <= max_chars:
        return markdown

    query_tokens = _keyword_tokens(question)
    chunks = _chunk_text(markdown)

    if not query_tokens:
        head = markdown[: max_chars // 2]
        tail = markdown[-(max_chars // 2) :]
        return f"{head}\n\n[...truncated for context window...]\n\n{tail}"

    scored: List[Tuple[int, int, str]] = []
    for idx, chunk in enumerate(chunks):
        score = len(_keyword_tokens(chunk) & query_tokens)
        scored.append((score, idx, chunk))

    scored.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    selected = sorted(scored[:4], key=lambda item: item[1])

    merged: List[str] = []
    total = 0
    for _, _, chunk in selected:
        if total + len(chunk) > max_chars:
            remaining = max_chars - total
            if remaining > 200:
                merged.append(chunk[:remaining])
                total += remaining
            break
        merged.append(chunk)
        total += len(chunk)

    if not merged:
        return markdown[:max_chars]

    return "\n\n[...relevant extracted context...]\n\n".join(merged)


def _safe_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _resolve_user_model_preferences(jwt_token: str, user_id: str) -> tuple[str, str]:
    supabase = get_user_supabase_client(jwt_token)
    result = (
        supabase.table("llm_api_keys")
        .select("provider, model, last_used_at, created_at")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("last_used_at", desc=True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise ValueError("BYOK_REQUIRED: No active API key found. Please configure BYOK first.")

    provider = result.data[0].get("provider")
    model = result.data[0].get("model") or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4.1-mini")
    return provider, model


def _build_readonly_tools(jwt_token: str, allowed_event_ids: Optional[Sequence[str]]) -> list:
    supabase = get_user_supabase_client(jwt_token)
    allowed_ids = [event_id for event_id in (allowed_event_ids or []) if event_id]

    def _apply_event_filter(query, event_ids: Optional[List[str]] = None):
        effective_ids = [event_id for event_id in (event_ids or []) if event_id]
        if allowed_ids:
            if effective_ids:
                effective_ids = [event_id for event_id in effective_ids if event_id in allowed_ids]
            else:
                effective_ids = allowed_ids

        if effective_ids:
            query = query.in_("id", effective_ids)
        return query

    @tool
    def list_events(limit: int = 20) -> str:
        """List user's events. Use this when user asks about available events, names, dates, or descriptions."""
        query = supabase.table("events").select("id, name, description, event_date, created_at").order("created_at", desc=True)
        query = _apply_event_filter(query)
        result = query.limit(min(max(limit, 1), 100)).execute()
        return _safe_json(result.data or [])

    @tool
    def get_event_documents_context(
        event_ids: Optional[List[str]] = None,
        question: str = "",
        max_docs: int = 6,
    ) -> str:
        """
        Retrieve markdown context for documents under specific events.
        Uses token-efficient compression and relevance scoring for long markdown.
        """
        events_query = supabase.table("events").select("id, name, description, event_date")
        events_query = _apply_event_filter(events_query, event_ids)
        events_result = events_query.execute()

        events = events_result.data or []
        if not events:
            return _safe_json({"events": [], "documents": [], "note": "No accessible events found."})

        target_event_ids = [event["id"] for event in events]
        docs_query = (
            supabase.table("templates")
            .select("id, event_id, name, upload_date, markdown_content")
            .in_("event_id", target_event_ids)
            .order("upload_date", desc=True)
            .limit(min(max_docs, 20))
        )
        docs_result = docs_query.execute()

        docs = docs_result.data or []
        compact_docs: List[Dict[str, Any]] = []
        for doc in docs:
            markdown = doc.get("markdown_content") or ""
            compact_docs.append(
                {
                    "id": doc.get("id"),
                    "event_id": doc.get("event_id"),
                    "name": doc.get("name"),
                    "upload_date": doc.get("upload_date"),
                    "markdown_excerpt": _compress_markdown(markdown, question=question),
                    "markdown_length": len(markdown),
                }
            )

        return _safe_json(
            {
                "events": events,
                "documents": compact_docs,
                "context_strategy": "keyword-aware chunk compression + truncation",
            }
        )

    @tool
    def get_event_tables(event_ids: Optional[List[str]] = None, max_docs: int = 6) -> str:
        """Retrieve extracted table_data for documents in selected events."""
        events_query = supabase.table("events").select("id")
        events_query = _apply_event_filter(events_query, event_ids)
        events_result = events_query.execute()
        target_event_ids = [event["id"] for event in (events_result.data or [])]

        if not target_event_ids:
            return _safe_json([])

        docs = (
            supabase.table("templates")
            .select("id, event_id, name, table_data")
            .in_("event_id", target_event_ids)
            .order("upload_date", desc=True)
            .limit(min(max_docs, 20))
            .execute()
        )

        return _safe_json(docs.data or [])

    return [list_events, get_event_documents_context, get_event_tables]


def _chunk_to_text(chunk: Any) -> str:
    if chunk is None:
        return ""

    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if "text" in item and isinstance(item["text"], str):
                    parts.append(item["text"])
                elif "content" in item and isinstance(item["content"], str):
                    parts.append(item["content"])
        return "".join(parts)

    if hasattr(chunk, "text") and isinstance(chunk.text, str):
        return chunk.text

    return ""


def _extract_reasoning_text(chunk: Any) -> str:
    additional = getattr(chunk, "additional_kwargs", {}) or {}

    candidates: List[str] = []
    for key in ("reasoning", "reasoning_content", "thinking", "thought"):
        value = additional.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append(value.strip())

    if not candidates:
        return ""

    text = candidates[0]
    if len(text) > 220:
        text = f"{text[:220]}..."
    return text


def build_agent_for_user(
    user_id: str,
    jwt_token: str,
    event_ids: Optional[Sequence[str]] = None,
) -> tuple[Any, dict]:
    provider, model = _resolve_user_model_preferences(jwt_token=jwt_token, user_id=user_id)
    llm, key_metadata = key_broker.get_llm_for_user(
        user_id=user_id,
        provider=provider,
        model=model,
        jwt_token=jwt_token,
        strict_byok=True,
        temperature=0,
    )

    tools = _build_readonly_tools(jwt_token=jwt_token, allowed_event_ids=event_ids)

    middleware = [
        SummarizationMiddleware(
            model=llm,
            trigger=("tokens", 4500),
            keep=("messages", 16),
        )
    ]

    system_prompt = (
        "You are an event-document analysis assistant. "
        "Answer only using data fetched via tools from events/templates for the current authenticated user. "
        "If you cannot find data, clearly say so. "
        "If the user asks to list events or available events, call list_events. "
        "If the user asks about a specific table, document, or value but no event scope is provided, "
        "ask a clarifying question (for example, which event or document) instead of saying it is not available. "
        "Once the user provides an event, proceed to fetch data. "
        "Always prioritize factual extraction from available markdown/table context and mention event/document names when possible."
        f"Current date is {datetime.now(timezone.utc)}."
    )

    agent = create_agent(
        model=llm,
        tools=tools,
        middleware=middleware,
        checkpointer=MEMORY_SAVER,
        system_prompt=system_prompt,
    )

    metadata = {
        **key_metadata,
        "provider": provider,
        "model": model,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return agent, metadata


async def stream_agent_response(
    agent: Any,
    user_message: str,
    thread_id: str,
):
    config = {"configurable": {"thread_id": thread_id}}
    payload = {"messages": [{"role": "user", "content": user_message}]}
    last_reasoning_text = ""

    async for event in agent.astream_events(payload, config=config, version="v2"):
        event_name = event.get("event")
        event_data = event.get("data", {})
        metadata = event.get("metadata", {}) or {}

        if event_name == "on_chat_model_stream":
            # Filter out middleware/internal model calls (for example, summarization middleware)
            # and only stream tokens from the main graph model node.
            if metadata.get("langgraph_node") != "model":
                continue
            chunk = event_data.get("chunk")
            reasoning_text = _extract_reasoning_text(chunk)
            if reasoning_text and reasoning_text != last_reasoning_text:
                last_reasoning_text = reasoning_text
                yield {"type": "thinking", "content": reasoning_text}

            token_text = _chunk_to_text(chunk)
            if token_text:
                yield {"type": "token", "content": token_text}
        elif event_name == "on_tool_start":
            tool_name = event.get("name") or "tool"
            yield {"type": "tool_start", "content": tool_name}
        elif event_name == "on_tool_end":
            tool_name = event.get("name") or "tool"
            yield {"type": "tool_end", "content": tool_name}
