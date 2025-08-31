# graph_builder.py
import os
import faiss
import asyncio
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

provence = AutoModel.from_pretrained("naver/provence-reranker-debertav3-v1", trust_remote_code=True)

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
    return {
        "cache_path": url_to_cache_path(state['doc_url']),
        "answers": [],
        "current_question_index": 0,
        "error_message": None,
        "messages": [],
        "web_content": ""
    }

def validate_url(state: AgentState) -> AgentState:
    """
    Node to validate the document URL for supported file types.
    If the file type is unsupported, it sets the final answer and prepares to end the graph.
    """
    doc_url = state['doc_url']
    url_path = doc_url.split('?')[0]
    ext = os.path.splitext(url_path)[1].lower()
    if ext in ['.zip', '.bin']:
        num_questions = len(state.get('questions', [1]))
        answer = f"Unsupported document type: '{ext}'. This service does not process ZIP or BIN files."
        print(f"🚫 Unsupported file type detected: {ext}")
        return {"answers": [answer] * num_questions}
    return {}

# +++ MODIFIED FUNCTION (Sequential Execution) +++
async def perform_reasoning(state: AgentState) -> AgentState:
    """
    Node that executes the ReAct reasoning agent for each question sequentially
    to avoid state interference issues on websites.
    """
    doc_url = state["doc_url"]
    questions = state["questions"]
    final_answers = []

    # Process each question one by one in a loop
    for idx, q in enumerate(questions):
        print(f"🤖 Starting ReAct agent for question {idx+1}/{len(questions)}...")
        
        # The reasoning_agent expects a list of questions, so we pass [q]
        result_list = await reasoning_agent(doc_url, [q])
        
        # Extract the answer, providing a fallback if the agent returns nothing
        final_answer = result_list[0] if result_list else "⚠️ Agent failed to produce an answer."
        final_answers.append(final_answer)
        
        print(f"🤖 ReAct agent finished for question {idx+1}.")

    return {"answers": final_answers}


def check_for_api_context(state: AgentState) -> AgentState:
    """Node that checks the initial document for API-related keywords."""
    docs = state["retriever"].invoke("Api endpoints and urls. search for http")
    return {"initial_context": "\n\n".join(d.page_content for d in docs)}

def route_after_validation(state: AgentState) -> Literal["continue_processing", "end_processing"]:
    """Conditional edge to terminate or continue after URL validation."""
    if "answers" in state and state["answers"]:
        return "end_processing"
    return "continue_processing"

def route_after_context_check(state: AgentState) -> Literal["perform_reasoning", "generate_answers"]:
    """
    Conditional edge to decide between the ReAct agent and standard RAG.
    """
    is_reasoning_needed = state.get("is_url_request", False) or \
                          contains_api_or_url(state.get("initial_context", ""), state.get('doc_url'))
    
    return "perform_reasoning" if is_reasoning_needed else "generate_answers"

def check_cache(state: AgentState) -> str:
    """Conditional edge to check if a cached FAISS index exists."""
    if "retriever" in state and state["retriever"] is not None:
        print("⚡ Using in-memory retriever (no FAISS reload).")
        return "process_document"
    return "load_from_cache" if os.path.exists(state['cache_path']) else "process_document"

def load_from_cache(state: AgentState) -> AgentState:
    """Node to load a FAISS index from the local cache."""
    vs = FAISS.load_local(state['cache_path'], embeddings, allow_dangerous_deserialization=True)
    retriever = vs.as_retriever(search_type="similarity", search_kwargs={'k': 15})
    return {"retriever": retriever}

async def process_document(state: AgentState) -> AgentState:
    """Node to process, chunk, and embed a document into a FAISS index."""
    docs = await get_docs_from_url(state['doc_url'])
    if not docs:
        return {"error_message": "Failed to download or parse the document."}

    chunks = await get_chunks(docs, state['doc_url'])
    if not chunks:
        return {"error_message": "Document chunks are empty."}

    sample_vec = embeddings.embed_query("hello world")
    index = faiss.IndexFlatL2(len(sample_vec))
    vs = FAISS(
        embedding_function=embeddings,
        index=index,
        docstore=InMemoryDocstore(),
        index_to_docstore_id={}
    )

    if EMBED_BATCH_API_AVAILABLE:
        try:
            await embed_batches_concurrently(vs, chunks, EMBED_BATCH_SIZE)  
        except Exception as e:
            print(f"⚠️ Concurrent embedding failed: {e}. Falling back to sequential embedding.")
            vs.add_documents(documents=chunks, ids=[str(uuid4()) for _ in chunks])
    else:
        vs.add_documents(documents=chunks, ids=[str(uuid4()) for _ in chunks])

    vs.save_local(state['cache_path'])

    retriever=vs.as_retriever(search_type="similarity", search_kwargs={'k': 15})
    return {"retriever": retriever}

async def generate_answers(state: AgentState) -> AgentState:
    """Node to generate answers for all questions in parallel."""
    if error_msg := state.get('error_message'):
        num_questions = len(state.get('questions', [1]))
        return {"answers": [error_msg] * num_questions}

    sem = asyncio.Semaphore(QA_CONCURRENCY)

    async def _fetch_context(idx: int, q: str):
        if idx == 0 and state.get('initial_context') and contains_api_or_url(q, state['doc_url']):
            return idx, state['initial_context']
        
        docs = await asyncio.to_thread(state['retriever'].invoke, q)
        context = "\n\n".join(d.page_content for d in docs)
        return idx, context
    
    contexts = sorted(await asyncio.gather(*[_fetch_context(i, q) for i, q in enumerate(state['questions'])]), key=lambda x: x[0])

    async def _answer_one(idx: int, q: str, ctx: str):
        async with sem:
            inputs = {"context": ctx, "question": q}
            parts = [chunk async for chunk in stream_rag_chain(inputs)]
            final = "".join(parts).strip() or "⚠️ Empty answer from LLM."
            print(f"🧠 Answered question {idx+1}")
            return idx, final

    results = sorted(await asyncio.gather(*[_answer_one(i, q, c[1]) for i, (q, c) in enumerate(zip(state['questions'], contexts))]), key=lambda x: x[0])
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