# graph_builder_profiled.py
import os
import faiss
import asyncio
import time
from uuid import uuid4
from typing import List, TypedDict, Annotated, Literal

# LangGraph and LangChain imports
from langgraph.graph import StateGraph, END
from langgraph.graph.message import AnyMessage, add_messages
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_community.vectorstores import FAISS

# Local module imports
from data_processing import (
    get_docs_from_url, get_chunks, url_to_cache_path, embed_batches_concurrently
)

from llm_services import stream_rag_chain
from react_agent import reasoning_agent
from utils import contains_api_or_url
from config import (
    embeddings, QA_CONCURRENCY, EMBED_BATCH_SIZE, EMBED_BATCH_API_AVAILABLE
)
from transformers import AutoModel

# Performance tracking
performance_log = {}

def log_time(func_name: str, duration: float):
    """Log execution time for performance analysis"""
    if func_name not in performance_log:
        performance_log[func_name] = []
    performance_log[func_name].append(duration)
    print(f"⏱️  {func_name}: {duration:.2f}s")

def print_performance_summary():
    """Print performance summary"""
    print("\n" + "="*50)
    print("PERFORMANCE SUMMARY")
    print("="*50)
    for func_name, times in performance_log.items():
        avg_time = sum(times) / len(times)
        total_time = sum(times)
        print(f"{func_name:25} | Avg: {avg_time:6.2f}s | Total: {total_time:6.2f}s | Calls: {len(times)}")
    print("="*50)

# Load model with timing
start_time = time.time()
provence = AutoModel.from_pretrained("naver/provence-reranker-debertav3-v1", trust_remote_code=True)
log_time("model_loading", time.time() - start_time)

# --- Agent State Definition ---
class AgentState(TypedDict):
    doc_url: str
    questions: List[str]
    cache_path: str
    retriever: FAISS
    answers: List[str]
    current_question_index: int
    error_message: str
    messages: Annotated[list[AnyMessage], add_messages]
    web_content: str
    initial_context: str | None
    is_url_request: bool

# --- Graph Node Implementations ---
def initialize_processing(state: AgentState) -> AgentState:
    """Initializes state variables for a new run."""
    start_time = time.time()
    result = {
        "cache_path": url_to_cache_path(state['doc_url']),
        "answers": [],
        "current_question_index": 0,
        "error_message": None,
        "messages": [],
        "web_content": ""
    }
    log_time("initialize_processing", time.time() - start_time)
    return result

def validate_url(state: AgentState) -> AgentState:
    """Node to validate the document URL for supported file types."""
    start_time = time.time()
    doc_url = state['doc_url']
    url_path = doc_url.split('?')[0]
    ext = os.path.splitext(url_path)[1].lower()
    result = {}
    if ext in ['.zip', '.bin']:
        num_questions = len(state.get('questions', [1]))
        answer = f"Unsupported document type: '{ext}'. This service does not process ZIP or BIN files."
        print(f"🚫 Unsupported file type detected: {ext}")
        result = {"answers": [answer] * num_questions}
    log_time("validate_url", time.time() - start_time)
    return result

async def perform_reasoning(state: AgentState) -> AgentState:
    """Node that executes the ReAct reasoning agent for each question sequentially."""
    start_time = time.time()
    doc_url = state["doc_url"]
    questions = state["questions"]
    final_answers = []

    for idx, q in enumerate(questions):
        question_start = time.time()
        print(f"🤖 Starting ReAct agent for question {idx+1}/{len(questions)}...")
        
        result_list = await reasoning_agent(doc_url, [q])
        final_answer = result_list[0] if result_list else "⚠️ Agent failed to produce an answer."
        final_answers.append(final_answer)
        
        log_time(f"reasoning_question_{idx+1}", time.time() - question_start)
        print(f"🤖 ReAct agent finished for question {idx+1}.")

    log_time("perform_reasoning_total", time.time() - start_time)
    return {"answers": final_answers}

def check_for_api_context(state: AgentState) -> AgentState:
    """Node that checks the initial document for API-related keywords."""
    start_time = time.time()
    docs = state["retriever"].invoke("Api endpoints and urls. search for http")
    result = {"initial_context": "\n\n".join(d.page_content for d in docs)}
    log_time("check_for_api_context", time.time() - start_time)
    return result

def route_after_validation(state: AgentState) -> Literal["continue_processing", "end_processing"]:
    """Conditional edge to terminate or continue after URL validation."""
    start_time = time.time()
    result = "end_processing" if "answers" in state and state["answers"] else "continue_processing"
    log_time("route_after_validation", time.time() - start_time)
    return result

def route_after_context_check(state: AgentState) -> Literal["perform_reasoning", "generate_answers"]:
    """Conditional edge to decide between the ReAct agent and standard RAG."""
    start_time = time.time()
    is_reasoning_needed = state.get("is_url_request", False) or \
                          contains_api_or_url(state.get("initial_context", ""), state.get('doc_url'))
    result = "perform_reasoning" if is_reasoning_needed else "generate_answers"
    log_time("route_after_context_check", time.time() - start_time)
    return result

def check_cache(state: AgentState) -> str:
    """Conditional edge to check if a cached FAISS index exists."""
    start_time = time.time()
    if "retriever" in state and state["retriever"] is not None:
        print("⚡ Using in-memory retriever (no FAISS reload).")
        result = "process_document"
    else:
        result = "load_from_cache" if os.path.exists(state['cache_path']) else "process_document"
    log_time("check_cache", time.time() - start_time)
    return result

def load_from_cache(state: AgentState) -> AgentState:
    """Node to load a FAISS index from the local cache."""
    start_time = time.time()
    vs = FAISS.load_local(state['cache_path'], embeddings, allow_dangerous_deserialization=True)
    retriever = vs.as_retriever(search_type="similarity", search_kwargs={'k': 15})
    log_time("load_from_cache", time.time() - start_time)
    return {"retriever": retriever}

async def process_document(state: AgentState) -> AgentState:
    """Node to process, chunk, and embed a document into a FAISS index."""
    start_time = time.time()
    
    # Document download timing
    doc_start = time.time()
    docs = await get_docs_from_url(state['doc_url'])
    log_time("document_download", time.time() - doc_start)
    
    if not docs:
        log_time("process_document_total", time.time() - start_time)
        return {"error_message": "Failed to download or parse the document."}

    # Chunking timing
    chunk_start = time.time()
    chunks = await get_chunks(docs, state['doc_url'])
    log_time("document_chunking", time.time() - chunk_start)
    
    if not chunks:
        log_time("process_document_total", time.time() - start_time)
        return {"error_message": "Document chunks are empty."}

    # FAISS setup timing
    faiss_start = time.time()
    sample_vec = embeddings.embed_query("hello world")
    index = faiss.IndexFlatL2(len(sample_vec))
    vs = FAISS(
        embedding_function=embeddings,
        index=index,
        docstore=InMemoryDocstore(),
        index_to_docstore_id={}
    )
    log_time("faiss_setup", time.time() - faiss_start)

    # Embedding timing
    embed_start = time.time()
    if EMBED_BATCH_API_AVAILABLE:
        try:
            await embed_batches_concurrently(vs, chunks, EMBED_BATCH_SIZE)  
        except Exception as e:
            print(f"⚠️ Concurrent embedding failed: {e}. Falling back to sequential embedding.")
            vs.add_documents(documents=chunks, ids=[str(uuid4()) for _ in chunks])
    else:
        vs.add_documents(documents=chunks, ids=[str(uuid4()) for _ in chunks])
    log_time("document_embedding", time.time() - embed_start)

    # Cache save timing
    save_start = time.time()
    vs.save_local(state['cache_path'])
    log_time("cache_save", time.time() - save_start)

    retriever = vs.as_retriever(search_type="similarity", search_kwargs={'k': 15})
    log_time("process_document_total", time.time() - start_time)
    return {"retriever": retriever}

async def generate_answers(state: AgentState) -> AgentState:
    """Node to generate answers for all questions in parallel."""
    start_time = time.time()
    
    if error_msg := state.get('error_message'):
        num_questions = len(state.get('questions', [1]))
        log_time("generate_answers_total", time.time() - start_time)
        return {"answers": [error_msg] * num_questions}

    sem = asyncio.Semaphore(QA_CONCURRENCY)

    async def _fetch_context(idx: int, q: str):
        context_start = time.time()
        if idx == 0 and state.get('initial_context') and contains_api_or_url(q, state['doc_url']):
            result = idx, state['initial_context']
        else:
            docs = await asyncio.to_thread(state['retriever'].invoke, q)
            context = "\n\n".join(d.page_content for d in docs)
            
            # Reranking timing
            rerank_start = time.time()
            final_docs = provence.process(q, context)
            log_time(f"reranking_q{idx+1}", time.time() - rerank_start)
            
            print(f"{len(final_docs['pruned_context'])} size chunk for question {idx+1}")
            result = idx, final_docs['pruned_context']
        
        log_time(f"context_fetch_q{idx+1}", time.time() - context_start)
        return result
    
    # Context fetching timing
    context_total_start = time.time()
    contexts = sorted(await asyncio.gather(*[_fetch_context(i, q) for i, q in enumerate(state['questions'])]), key=lambda x: x[0])
    log_time("context_fetch_total", time.time() - context_total_start)

    async def _answer_one(idx: int, q: str, ctx: str):
        answer_start = time.time()
        async with sem:
            inputs = {"context": ctx, "question": q}
            parts = [chunk async for chunk in stream_rag_chain(inputs)]
            final = "".join(parts).strip() or "⚠️ Empty answer from LLM."
            print(f"🧠 Answered question {idx+1}")
            log_time(f"answer_generation_q{idx+1}", time.time() - answer_start)
            return idx, final

    # Answer generation timing
    answer_total_start = time.time()
    results = sorted(await asyncio.gather(*[_answer_one(i, q, c[1]) for i, (q, c) in enumerate(zip(state['questions'], contexts))]), key=lambda x: x[0])
    log_time("answer_generation_total", time.time() - answer_total_start)
    
    log_time("generate_answers_total", time.time() - start_time)
    return {"answers": [r[1] for r in results], "initial_context": None}

# --- Graph Construction ---
workflow = StateGraph(AgentState)

workflow.add_node("initialize", initialize_processing)
workflow.add_node("validate_url", validate_url) 
workflow.add_node("check_cache_node", lambda state: {})
workflow.add_node("load_from_cache", load_from_cache)
workflow.add_node("check_for_api_context", check_for_api_context)
workflow.add_node("perform_reasoning", perform_reasoning)
workflow.add_node("process_document", process_document)
workflow.add_node("generate_answers", generate_answers)

workflow.set_entry_point("initialize")

workflow.add_edge("initialize", "validate_url")

workflow.add_conditional_edges(
    "validate_url",
    route_after_validation,
    {
        "continue_processing": "check_cache_node",
        "end_processing": END,
    }
)

workflow.add_edge("load_from_cache", "check_for_api_context")
workflow.add_edge("process_document", "check_for_api_context")
workflow.add_conditional_edges("check_for_api_context", route_after_context_check, {
    "perform_reasoning": "perform_reasoning",
    "generate_answers": "generate_answers"
})
workflow.add_conditional_edges("check_cache_node", check_cache, {
    "load_from_cache": "load_from_cache",
    "process_document": "process_document"
})
workflow.add_edge("perform_reasoning", END)
workflow.add_edge("generate_answers", END)

# Compiled graph, ready for use
jarvis = workflow.compile()

# Export performance summary function
__all__ = ['jarvis', 'print_performance_summary']

from IPython.display import Image, display
png_data = jarvis.get_graph().draw_mermaid_png()

# Display the image in environments like Jupyter Notebooks
display(Image(png_data))

# Or, save the image to a file
with open("workflow.png", "wb") as f:
    f.write(png_data)
print("Workflow image saved as langgraph_workflow.png")
