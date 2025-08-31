# config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(override=True)

# --- API Keys & Tokens ---
AUTH_TOKEN = os.getenv("AUTH_TOKEN")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# --- Application Constants ---
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "100"))
LLM_STREAMING_ENABLED = os.getenv("LLM_STREAMING_ENABLED", "true").lower() in ("true", "1", "yes")
EMBED_CONCURRENCY = int(os.getenv("EMBED_CONCURRENCY", "10"))
QA_CONCURRENCY = int(os.getenv("QA_CONCURRENCY", "4"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "20"))
CACHE_DIR = "../cache_dir/faiss_cache"
EMBED_CACHE_DIR = "../cache_dir/embed_cache"

# --- Embedding Model Configuration ---
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
embeddings = NVIDIAEmbeddings(
    model="nvidia/llama-3.2-nv-embedqa-1b-v2",
    api_key=NVIDIA_API_KEY,
    truncate="NONE",
)

#For local embedding, use the following model
# from langchain_huggingface import HuggingFaceEmbeddings
# import torch

# device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
# embeddings = HuggingFaceEmbeddings(
#     model_name="jinaai/jina-embeddings-v4",
#     model_kwargs={
#         'trust_remote_code': True,
#         'device': str(device)
#     },
#     encode_kwargs={
#         'normalize_embeddings': True
#     }
# )
# If you want to use any other embedding model make sure it supports the 
# recommended embedding size of 2048 for better retrieval recall

EMBED_BATCH_API_AVAILABLE = hasattr(embeddings, "embed_documents")

# RERANKER_URL = "https://lucky-poodle-next.ngrok-free.app/v1/ranking"
# from langchain_nvidia_ai_endpoints import NVIDIARerank
# reranker = NVIDIARerank(
#     model="nvidia/llama-3.2-nv-rerankqa-1b-v2",
#     api_key=NVIDIA_API_KEY
# )


# --- Define your own LLM ---
from langchain_openai import AzureChatOpenAI

RAG_LLM = AzureChatOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    deployment_name="gpt-4.1-mini"
)

AGENT_LLM = AzureChatOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    deployment_name="gpt-4.1-mini"
)




