# llm_services.py
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser
from openai import RateLimitError, APIError

from config import RAG_LLM, LLM_STREAMING_ENABLED
from prompt_template import TEMPLATE

# --- Prompt Template ---
prompt = ChatPromptTemplate.from_template(TEMPLATE)

# --- Main RAG Chain ---
# This is the primary chain that uses the configured RAG_LLM (OpenAI).
rag_chain = prompt | RAG_LLM | StrOutputParser()


# --- Streaming Wrapper ---
async def stream_rag_chain(inputs: dict):
    """
    A wrapper to handle streaming output from the primary LLM.
    """
    try:
        if LLM_STREAMING_ENABLED:
            # Stream the response chunk by chunk
            formatted_messages = await prompt.ainvoke(inputs)
            async for chunk in RAG_LLM.astream(formatted_messages):
                yield chunk.content
        else:
            # Get the full response at once
            yield await rag_chain.ainvoke(inputs)

    except (RateLimitError, APIError) as e:
        # Handle potential API errors from OpenAI
        error_message = f"⚠️ An OpenAI API error occurred: {e}"
        print(error_message)
        yield error_message
    except Exception as e:
        # Handle other unexpected errors
        error_message = f"⚠️ An unexpected streaming error occurred: {e}"
        print(error_message)
        yield error_message