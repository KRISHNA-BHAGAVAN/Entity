# Load environment variables BEFORE importing LangChain (required for LangSmith tracing)
from dotenv import load_dotenv
load_dotenv(override=True)

import asyncio
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

# Import langsmith first to enable tracing (must be before langchain imports)
import langsmith
from langsmith import traceable

from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain.tools import tool
from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownTextSplitter
from langgraph.checkpoint.memory import InMemorySaver
import tiktoken

from byok_service import key_broker
from storage_service import get_user_supabase_client

# LangSmith tracing configuration:
# Set LANGSMITH_TRACING=true, LANGSMITH_API_KEY=lsv2_..., LANGSMITH_PROJECT=...
# Traces: https://smith.langchain.com

MEMORY_SAVER = InMemorySaver()

# Agent cache: {(user_id, frozenset(event_ids)): (agent, metadata, timestamp)}
# TTL: 5 minutes (300 seconds) - agents are expensive to build
AGENT_CACHE: Dict[tuple[str, frozenset], tuple[Any, dict, float]] = {}
AGENT_CACHE_TTL_SECONDS = 300
AGENT_CACHE_LOCK = asyncio.Lock()

# Model context windows (in tokens) for token-aware chunking
MODEL_CONTEXT_WINDOWS: Dict[str, int] = {
    "gpt-5.4": 400000,
    "gpt-5.4-mini": 400000,
    "gpt-5.4-nano": 400000,
    "gpt-5.2": 400000,
    "gpt-4.1-mini": 200000,
    "gpt-4.1": 200000,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gemini-2.5-pro": 1000000,
    "gemini-2.5-flash": 1000000,
    "gemini-2.5-flash-lite": 1000000,
    "llama-3.3-70b-versatile": 128000,
    "llama-3.1-8b-instant": 128000,
    "claude-opus-4-1-20250805": 200000,
    "claude-sonnet-4-20250514": 200000,
    "claude-3-5-haiku-20241022": 200000,
    "llama3.1": 128000,
    "qwen3": 128000,
    "mistral-small3.1": 128000,
}

# Default chunk sizes (in tokens) - conservative to leave room for conversation
DEFAULT_CHUNK_SIZE_TOKENS = 1500
DEFAULT_CHUNK_OVERLAP_TOKENS = 150  # 10% overlap for context continuity

# Tiktoken encoding for token counting
TIKTOKEN_ENCODING = "cl100k_base"


def _keyword_tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-zA-Z0-9_]+", (text or "").lower()) if len(token) > 2}


def _count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    try:
        encoding = tiktoken.get_encoding(TIKTOKEN_ENCODING)
        return len(encoding.encode(text))
    except Exception:
        # Fallback to approximate character count
        return len(text) // 4


def _chunk_text(
    text: str,
    chunk_size_tokens: int = DEFAULT_CHUNK_SIZE_TOKENS,
    overlap_tokens: int = DEFAULT_CHUNK_OVERLAP_TOKENS,
    use_markdown_splitter: bool = True,
) -> List[Dict[str, Any]]:
    """
    Split text into semantically meaningful chunks using LangChain text splitters.
    
    Returns list of dicts with:
        - content: the chunk text
        - metadata: chunk metadata (position, headers, token_count)
    """
    if not text:
        return []
    
    # Use markdown splitter for markdown content, recursive for plain text
    if use_markdown_splitter and ("#" in text or "**" in text or "```" in text):
        # Markdown-aware splitting preserves headers and structure
        splitter = MarkdownTextSplitter(
            chunk_size=chunk_size_tokens * 4,  # Approximate char to token ratio
            chunk_overlap=overlap_tokens * 4,
        )
        docs = splitter.create_documents([text])
        
        # Extract chunks with metadata
        chunks = []
        for i, doc in enumerate(docs):
            header = doc.metadata.get("Header", "")
            chunks.append({
                "content": doc.page_content,
                "metadata": {
                    "position": i,
                    "header": header,
                    "is_header": bool(header) and doc.page_content.strip().startswith(header),
                    "token_count": _count_tokens(doc.page_content),
                }
            })
    else:
        # Recursive character splitting for generic text
        # Uses separator hierarchy: paragraphs -> sentences -> words -> chars
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size_tokens * 4,  # Approximate char to token ratio
            chunk_overlap=overlap_tokens * 4,
            separators=["\n\n", "\n", ". ", "! ", "? ", ", ", " ", ""],
            length_function=len,
        )
        docs = splitter.create_documents([text])
        
        chunks = []
        for i, doc in enumerate(docs):
            chunks.append({
                "content": doc.page_content,
                "metadata": {
                    "position": i,
                    "token_count": _count_tokens(doc.page_content),
                }
            })
    
    return chunks


def _calculate_relevance_score(
    chunk: Dict[str, Any],
    query_tokens: set[str],
    all_chunks: List[Dict[str, Any]]
) -> float:
    """
    Calculate semantic relevance score for a chunk.
    
    Combines:
    - Keyword overlap with query
    - Structural importance (headers, tables get bonus)
    - Position in document (earlier chunks often more important)
    """
    content = chunk.get("content", "")
    metadata = chunk.get("metadata", {})
    
    # Base keyword score
    chunk_tokens = _keyword_tokens(content)
    keyword_score = len(chunk_tokens & query_tokens)
    
    # Structural bonus - headers and structured content are more important
    structural_bonus = 0.0
    if metadata.get("is_header"):
        structural_bonus += 3.0
    if metadata.get("header"):
        structural_bonus += 1.5
    if "table" in content.lower() or "|" in content:
        structural_bonus += 2.0
    if "**" in content or "##" in content:
        structural_bonus += 1.0
    
    # Position decay - earlier chunks slightly preferred
    position = metadata.get("position", 0)
    position_penalty = position * 0.1
    
    return keyword_score + structural_bonus - position_penalty


def _compress_markdown(
    markdown: str,
    question: str,
    max_chars: int = 8000,
    max_tokens: int = 2000,
) -> str:
    """
    Compress markdown to fit within context window using semantic chunking.
    
    Strategy:
    1. Split into semantic chunks preserving structure
    2. Score chunks by relevance to query
    3. Select top chunks within token/char limits
    4. Reassemble in document order
    """
    if not markdown:
        return ""

    # Quick check if we can return full content
    token_count = _count_tokens(markdown)
    if len(markdown) <= max_chars and token_count <= max_tokens:
        return markdown

    query_tokens = _keyword_tokens(question)
    
    # If no query tokens, use head+tail strategy
    if not query_tokens:
        head_chars = max_chars // 3
        tail_chars = max_chars // 3
        head = markdown[:head_chars]
        tail = markdown[-tail_chars:]
        return (
            f"{head}\n\n"
            f"[...truncated {len(markdown) - head_chars - tail_chars} characters...]\n\n"
            f"{tail}"
        )

    # Split into semantic chunks with metadata
    chunks = _chunk_text(markdown, use_markdown_splitter=True)
    
    if not chunks:
        return markdown[:max_chars]

    # Score all chunks
    scored_chunks: List[Tuple[float, int, Dict[str, Any]]] = []
    for idx, chunk in enumerate(chunks):
        score = _calculate_relevance_score(chunk, query_tokens, chunks)
        scored_chunks.append((score, idx, chunk))

    # Sort by score (descending), then by position (ascending for same score)
    scored_chunks.sort(key=lambda item: (-item[0], item[1]))
    
    # Select top chunks within limits
    selected: List[Tuple[int, Dict[str, Any]]] = []
    total_chars = 0
    total_tokens = 0
    
    for score, idx, chunk in scored_chunks:
        content = chunk.get("content", "")
        chunk_tokens = chunk.get("metadata", {}).get("token_count", _count_tokens(content))
        chunk_chars = len(content)
        
        # Check if adding this chunk would exceed limits
        if total_chars + chunk_chars > max_chars or total_tokens + chunk_tokens > max_tokens:
            # Try to fit a partial chunk if it's the first one and we have room
            if not selected and chunk_chars > 200:
                remaining_chars = max_chars - total_chars
                remaining_tokens = max_tokens - total_tokens
                if remaining_chars > 200:
                    partial_content = content[:remaining_chars]
                    selected.append((idx, {"content": partial_content, "metadata": chunk.get("metadata", {})}))
            break
        
        selected.append((idx, chunk))
        total_chars += chunk_chars
        total_tokens += chunk_tokens
        
        # Stop after reasonable number of chunks
        if len(selected) >= 8:
            break

    if not selected:
        return markdown[:max_chars]

    # Reassemble in original document order for coherence
    selected.sort(key=lambda item: item[0])
    
    # Build result with section markers
    merged: List[str] = []
    for idx, chunk in selected:
        content = chunk.get("content", "")
        metadata = chunk.get("metadata", {})
        header = metadata.get("header", "")
        
        # Add header marker if present
        if header and not content.strip().startswith(header):
            content = f"## {header}\n\n{content}"
        
        merged.append(content)

    result = "\n\n[...section...]\n\n".join(merged)
    
    # Add summary header
    total_original = len(markdown)
    compression_ratio = (1 - total_chars / total_original) * 100
    
    return (
        f"[Document excerpt: {compression_ratio:.0f}% compressed | "
        f"{len(selected)}/{len(chunks)} sections selected]\n\n"
        f"{result}"
    )


def _safe_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _resolve_user_model_preferences(jwt_token: str, user_id: str) -> tuple[str, str]:
    selection = key_broker.resolve_user_selection(jwt_token=jwt_token, user_id=user_id)
    return selection["provider"], selection["model"]


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
                "context_strategy": "semantic chunking with MarkdownTextSplitter/RecursiveCharacterTextSplitter + relevance scoring",
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


def _serialize_tool_payload(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _serialize_tool_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_tool_payload(item) for item in value]
    if isinstance(value, tuple):
        return [_serialize_tool_payload(item) for item in value]
    return str(value)


async def _get_cached_agent(
    user_id: str,
    event_ids: Optional[Sequence[str]] = None,
) -> Optional[tuple[Any, dict]]:
    """Get cached agent if available and not expired."""
    cache_key = (user_id, frozenset(event_ids or []))
    async with AGENT_CACHE_LOCK:
        if cache_key in AGENT_CACHE:
            agent, metadata, timestamp = AGENT_CACHE[cache_key]
            if time.time() - timestamp < AGENT_CACHE_TTL_SECONDS:
                # Mark as cached in metadata so frontend knows agent was reused
                metadata["cached"] = True
                metadata["cache_age_seconds"] = int(time.time() - timestamp)
                return agent, metadata
            else:
                # Expired, remove from cache
                del AGENT_CACHE[cache_key]
    return None


async def _cache_agent(
    user_id: str,
    event_ids: Optional[Sequence[str]] = None,
    agent: Any = None,
    metadata: dict = None,
) -> None:
    """Cache agent for reuse."""
    cache_key = (user_id, frozenset(event_ids or []))
    async with AGENT_CACHE_LOCK:
        AGENT_CACHE[cache_key] = (agent, metadata, time.time())


def _cleanup_expired_cache() -> None:
    """Remove expired entries from agent cache."""
    current_time = time.time()
    expired_keys = [
        key for key, (_, _, timestamp) in AGENT_CACHE.items()
        if current_time - timestamp >= AGENT_CACHE_TTL_SECONDS
    ]
    for key in expired_keys:
        del AGENT_CACHE[key]


@traceable(run_type="chain", name="Build Agent")
async def build_agent_for_user(
    user_id: str,
    jwt_token: str,
    event_ids: Optional[Sequence[str]] = None,
) -> tuple[Any, dict]:
    # Try to get cached agent first
    cached = await _get_cached_agent(user_id, event_ids)
    if cached:
        return cached

    provider, model = _resolve_user_model_preferences(jwt_token=jwt_token, user_id=user_id)
    llm, key_metadata = key_broker.get_llm_for_user(
        user_id=user_id,
        provider=provider,
        model=model,
        jwt_token=jwt_token,
        strict_byok=True,
        temperature=0,
    )

    supabase = get_user_supabase_client(jwt_token)
    
    # Parallelize independent operations: profile fetch and tools building
    async def _fetch_profile():
        result = supabase.table("profiles").select("full_name").eq("id", user_id).execute()
        return result.data[0].get("full_name") if (result.data and len(result.data) > 0) else "User"
    
    def _build_tools():
        return _build_readonly_tools(jwt_token=jwt_token, allowed_event_ids=event_ids)
    
    # Run profile fetch and tools building in parallel
    user_name, tools = await asyncio.gather(
        _fetch_profile(),
        asyncio.get_event_loop().run_in_executor(None, _build_tools)
    )

    # Get model's context window for optimized middleware configuration
    model_context_window = MODEL_CONTEXT_WINDOWS.get(model, 128000)
    
    # Calculate optimal trigger threshold (75% of context window for safety margin)
    # Cap at reasonable limits to avoid excessive memory usage
    trigger_tokens = min(int(model_context_window * 0.75), 32000)
    keep_messages = min(16, max(6, int(model_context_window / 8000)))  # Scale with context size
    
    middleware = [
        SummarizationMiddleware(
            model=llm,
            trigger=("tokens", trigger_tokens),
            keep=("messages", keep_messages),
        )
    ]

    # Build event context section for system prompt
    event_ids_list = [eid for eid in (event_ids or []) if eid]
    if event_ids_list:
        event_context = f"The user has pre-selected these specific events (IDs: {', '.join(event_ids_list)}). Use these events when answering questions about documents, tables, or event details. You do NOT need to ask which event - proceed directly to fetching data for these events."
    else:
        event_context = "No specific events are pre-selected. If the user asks about documents/tables without specifying an event, ask which event they mean."

    system_prompt = (
        f"You are an event-document analysis assistant. You are chatting with {user_name}. "
        f"Your goal is to help the user with their events and documents. Feel free to address the user as {user_name} everytime in you response. "
        f"{event_context} "
        "For event or document related queries, answer only using data fetched via tools for the current authenticated user (events/templates). "
        "If the user asks for their own name or who you are chatting with, you can answer using the name provided in this prompt. "
        "If you cannot find specific event data, clearly say so. "
        "Never showcase the event_ids to the user. "
        "If the user asks to list events or available events, call list_events. "
        "Always prioritize factual extraction from available markdown/table context and mention event/document names when possible. "
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
        # LangSmith tracing metadata for observability
        "langsmith_project": os.getenv("LANGSMITH_PROJECT", "default"),
        "langsmith_tracing_enabled": os.getenv("LANGSMITH_TRACING", "false").lower() == "true",
        "cached": False,  # Mark as freshly built (not from cache)
    }
    
    # Cache agent for reuse
    await _cache_agent(user_id, event_ids, agent, metadata)
    _cleanup_expired_cache()  # Clean up old entries
    
    return agent, metadata


@traceable(run_type="chain", name="Agent Chat Stream")
async def stream_agent_response(
    agent: Any,
    user_message: str,
    thread_id: str,
    history: Optional[Sequence[Dict[str, str]]] = None,
):
    config = {"configurable": {"thread_id": thread_id}}
    prior_messages = [
        {"role": item["role"], "content": item["content"]}
        for item in (history or [])
        if item.get("role") in {"user", "assistant"} and (item.get("content") or "").strip()
    ]
    payload = {"messages": [*prior_messages, {"role": "user", "content": user_message}]}
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
            yield {
                "type": "tool_start",
                "content": tool_name,
                "tool_call": {
                    "id": event.get("run_id") or tool_name,
                    "name": tool_name,
                    "input": _serialize_tool_payload(event_data.get("input")),
                },
            }
        elif event_name == "on_tool_end":
            tool_name = event.get("name") or "tool"
            yield {
                "type": "tool_end",
                "content": tool_name,
                "tool_call": {
                    "id": event.get("run_id") or tool_name,
                    "name": tool_name,
                    "output": _serialize_tool_payload(event_data.get("output")),
                },
            }
        elif event_name == "on_tool_error":
            tool_name = event.get("name") or "tool"
            error = event_data.get("error")
            yield {
                "type": "tool_error",
                "content": tool_name,
                "tool_call": {
                    "id": event.get("run_id") or tool_name,
                    "name": tool_name,
                    "error": _serialize_tool_payload(error),
                },
            }
