from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(override=True)

class VariableSuggestion(BaseModel):
    """
    Represents a suggested variable mapping from document text.
    """
    originalText: str = Field(description="The original text found in the document that looks like a placeholder.")
    variableName: str = Field(description="A suggested snake_case variable name for the original text based on the surrounding context")

class VariableSuggestions(BaseModel):
    """
    An array of variable suggestions.
    """
    suggestions: list[VariableSuggestion]


# Initialize the Gemini Model
# llm = ChatGroq(model="llama-3.1-8b-instant")
llm = ChatGroq(model="llama-3.3-70b-versatile")

# Define the Prompt Template
prompt = ChatPromptTemplate.from_messages([
    ("system", """
    You are a document automation assistant. Analyze the provided document content.
    Identify text segments that look like placeholders, variables, or entities.
    Return a JSON array of objects following the provided schema.
    """),
    ("human", "Document content:\n\"\"\"\n{text}\n\"\"\"")
])

# Create the Chain (Runnable)
structured_llm = llm.with_structured_output(VariableSuggestions)
variable_suggestion_chain = prompt | structured_llm