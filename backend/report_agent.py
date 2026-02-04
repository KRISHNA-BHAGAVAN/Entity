
import json
import logging
from typing import Dict, Any, List, TypedDict, Optional, Literal
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from byok_providers import get_provider_adapter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# PROMPTS
# ------------------------------------------------------------------------------

REPORT_INFERENCE_PROMPT = """
You are an expert data analyst. Your task is to infer values for a specific set of report columns based on a distilled event schema.

Input:
1. Requested Columns: A list of column names for the report.
2. Event Schema Context: A distilled version of the event's data, containing field labels and sample context values.

Task:
- For each requested column, try to infer the most accurate value from the provided schema context.
- Use semantic reasoning. For example, "Speaker" might map to "Resources Person" or "Coordinator" in the schema.
- If a column value cannot be confidently inferred from the context, mark it as UNRESOLVED.
- Do NOT hallucinate.

Output:
- STRICT JSON format.
- A single object where keys are the requested column names.
- Values should be the inferred text value, or null if unresolved.
"""

# ------------------------------------------------------------------------------
# UTILS & DISTILLATION
# ------------------------------------------------------------------------------

def distill_schema_context(event_schema: Dict[str, Any]) -> str:
    """
    Extracts high-signal context from the event schema for LLM consumption.
    Ignores stats, token usage, and raw locations.
    """
    if not event_schema or "schema" not in event_schema:
        return "No schema available."

    distilled_lines = []
    
    # Access the "document_fields" section
    doc_fields = event_schema["schema"].get("document_fields", {}).get("fields", {})
    
    for field_key, field_val in doc_fields.items():
        label = field_val.get("label", field_key)
        references = field_val.get("references", [])
        
        # Get a few context lines from locations if available
        locations = field_val.get("locations", [])
        context_samples = []
        if locations:
            # Take up to 3 unique context lines
            seen_contexts = set()
            for loc in locations:
                ctx = loc.get("context_line", "").strip()
                if ctx and ctx not in seen_contexts:
                    seen_contexts.add(ctx)
                    context_samples.append(ctx)
                if len(context_samples) >= 3:
                    break
        
        field_info = f"Field: {label} (Key: {field_key})"
        if references:
            field_info += f"\n  Values: {', '.join(references[:5])}" # Limit to first 5 distinct values
        if context_samples:
            field_info += f"\n  Context: {'; '.join(context_samples)}"
            
        distilled_lines.append(field_info)
        
    return "\n\n".join(distilled_lines)

# ------------------------------------------------------------------------------
# GRAPH STATE (LangGraph v1.0)
# ------------------------------------------------------------------------------

class ReportState(TypedDict):
    columns: List[Dict[str, Any]] # Each dict: {name: str, description: Optional[str]}
    event_schema: Dict[str, Any]
    distilled_context: Optional[str]
    inferred_data: Optional[Dict[str, Any]]
    unresolved_columns: List[str]
    llm_provider: str
    api_key: str

# ------------------------------------------------------------------------------
# NODES
# ------------------------------------------------------------------------------

def distill_context_node(state: ReportState) -> Dict[str, Any]:
    """Node to distill the schema into a context string."""
    schema = state["event_schema"]
    distilled = distill_schema_context(schema)
    return {"distilled_context": distilled}

def inference_node(state: ReportState) -> Dict[str, Any]:
    """Node to run LLM inference for column values."""
    provider_name = state.get("llm_provider", "openai")
    api_key = state.get("api_key")
    
    if not api_key:
        raise ValueError("API Key is required for report generation.")

    try:
        adapter = get_provider_adapter(provider_name)
        llm = adapter.create_llm(api_key=api_key, temperature=0) # Low temp for deterministic extraction
        
        columns = state["columns"]
        context = state["distilled_context"]
        
        # Format columns for prompt with descriptions
        col_list_str = []
        for c in columns:
            line = f"- {c['name']}"
            if c.get('description'):
                line += f" (Hint: {c['description']})"
            col_list_str.append(line)
        requested_cols_text = "\n".join(col_list_str)
        
        prompt = REPORT_INFERENCE_PROMPT
        user_message = f"Requested Columns:\n{requested_cols_text}\n\nEvent Schema Context:\n{context}"
        
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=user_message)
        ]
        
        response = llm.invoke(messages)
        content = response.content.strip()
        
        # Parse JSON response
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end != -1:
            json_str = content[start:end]
            data = json.loads(json_str)
        else:
            logger.error(f"Failed to parse JSON from LLM response: {content}")
            data = {}

        # Identify unresolved columns (null values)
        unresolved = [k for k, v in data.items() if v is None]
        
        # Ensure all columns are present
        final_data = {col['name']: data.get(col['name'], None) for col in columns}
        
        return {
            "inferred_data": final_data, 
            "unresolved_columns": unresolved
        }

    except Exception as e:
        logger.error(f"Error in inference_node: {e}")
        # In case of error, mark all as unresolved
        return {
            "inferred_data": {c: None for c in state["columns"]},
            "unresolved_columns": state["columns"]
        }

# ------------------------------------------------------------------------------
# GRAPH DEFINITION
# ------------------------------------------------------------------------------

def create_report_agent():
    workflow = StateGraph(ReportState)
    
    workflow.add_node("distill", distill_context_node)
    workflow.add_node("infer", inference_node)
    
    workflow.add_edge(START, "distill")
    workflow.add_edge("distill", "infer")
    workflow.add_edge("infer", END)
    
    return workflow.compile()

report_agent = create_report_agent()
