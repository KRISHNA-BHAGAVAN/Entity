from fastapi import FastAPI, HTTPException
from models import QueryRequest, QueryResponse
from react_agent import reasoning_agent
from code_executor import process_code_query
from graph_builder import jarvis
import logging
import warnings

app = FastAPI(title="Entity Challenge API", version="1.0.0")

warnings.filterwarnings("ignore", category=FutureWarning)

# --- Logging Setup ---
LOG_FILE = "query_logs.log"
logging.basicConfig(
    level=logging.INFO,
    filename=LOG_FILE,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


@app.post("/api/v1/hackrx/run", response_model=QueryResponse)
async def run_challenge(request: QueryRequest):
    """
    Main endpoint that routes requests based on input type:
    - documents + questions -> Jarvis (graph_builder)
    - url + questions -> reasoning_agent
    - query + questions -> reasoning_agent (code generation)
    """
    try:
        # Route 1: Documents mode - use Jarvis
        if not request.is_url_request and not request.is_code_request:
            print("📚 Documents mode - routing to Jarvis")
            final_state = await jarvis.ainvoke({"doc_url": request.documents, "questions": request.questions})
            answers = final_state.get("answers", ["No answer could be generated."])
            
            logging.info("Generated Answers:")
            for i, a in enumerate(answers, start=1):
                logging.info(f"  A{i}: {a}\n" + "-"*60)
                
            return QueryResponse(answers=answers)

        
        # Route 2: Code generation mode - use reasoning_agent
        elif request.is_code_request:
            print("🔧 Code generation mode - routing to reasoning_agent")
            answers = await process_code_query(request.query, request.questions)
            return QueryResponse(answers=answers)
        
        # Route 3: URL mode - use reasoning_agent
        elif request.is_url_request:
            print("🌐 Web challenge mode - routing to reasoning_agent")
            answers = []
            for question in request.questions:
                answer = await reasoning_agent(request.url, question)
                answers.extend(answer)
            return QueryResponse(answers=answers)
        
        else:
            raise HTTPException(status_code=400, detail="Invalid request configuration")
            
    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Entity Challenge API is running"}

# uvicorn main:app --host 0.0.0.0 --port 8000 --reload