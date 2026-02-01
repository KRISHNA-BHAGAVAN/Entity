from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from langchain.agents import create_agent

llm = init_chat_model("llama-3.3-70b-versatile", temperature=0)