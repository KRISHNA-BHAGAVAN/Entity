import asyncio
from typing import List

# LangChain and LangGraph imports - using the latest package structures
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage
from config import AGENT_LLM
from tools import web_scraper_tool, browser_interaction_tool
from code_executor import code_generator_tool, code_executor_tool, github_push_tool, process_code_query

llm = AGENT_LLM

# --- Agent Definition (Prompt Reliability Improvement) ---
AGENT_SYSTEM_PROMPT = """You are a highly specialized reasoning agent. 
Your mission is to follow instructions or interact with challenges. Your first step is to analyze the user's query and the provided URL to form a plan. The answer for the question may not be available directly; 
You have to use your tools one by one if you don't get the answer right away. 

**Your Tools:**
- `web_scraper_tool`: Use for an initial, simple look at a URL's static content or for reading PDF files.
- `browser_interaction_tool`: Use this for websites that require interaction, like clicking a button to start a challenge.
- `code_generator_tool`: Generate Python code based on programming queries and test cases.
- `code_executor_tool`: Execute generated Python code in a controlled environment.
- `github_push_tool`: Push generated code to GitHub repository.

**Your Workflow:**
1.  **Analyze the Mission:** Read the user's query and the URL.
2.  **Initial Assessment:**
    * Use `web_scraper_tool` ONCE to examine the page content
    * If PDF: follow the instructions provided
    * If interactive elements found: proceed with browser interactions
3.  **Interactive Challenge Execution:**
    * Identify the challenge type from visible_text and interactive_elements
    * Use `browser_interaction_tool` to interact with elements in logical order
    * For forms: fill inputs before clicking submit buttons
    * For hidden content: look for hidden_elements data and use appropriate values
    * Continue interactions until completion indicators appear
4.  **Code Generation Mode (Round 6):**
    * If query contains programming instructions, use code generation tools
    * Generate code with `code_generator_tool`
    * Execute code with `code_executor_tool` 
    * Push to GitHub with `github_push_tool`
    * Return execution results
5.  **Completion Detection:** Return any completion codes, success messages, or final results.

**Critical Instructions:**
- Use `web_scraper_tool` only once at the beginning
- Use `browser_interaction_tool` without URL parameter to maintain page state
- Complete logical interaction sequences (e.g., input → submit)
- Use data from tool outputs (hidden_elements, visible_text) to determine next actions
- Look for completion_indicators in outputs after interactions
- Return final result when completion is detected
- Provide direct single line concise answer

**CSS Selector Construction Rules:**
- Always build the selector from the scraped metadata.
- If element has {"selector": "button", "attrs": {"class": "btn primary"}}, 
  → use "button.btn.primary"
- If element has an `id`, prefer it: {"selector": "input", "attrs": {"id": "username"}}
  → "input#username"
- If element has a `name`, use: {"selector": "input", "attrs": {"name": "q"}}
  → "input[name='q']"
- Never invent selectors like "#hidden" or "[data-secret]" unless they were actually present in attrs.
- Prefer the **most specific** selector: `id > class > name > tag`.
- When multiple classes exist, join them with dots, e.g. `"btn primary large"` → `"button.btn.primary.large"`.
"""

async def reasoning_agent(url: str, query: List[str]) -> List[str]:
    """
    Initializes and runs the reasoning agent, allowing it to choose its own tools.
    """
    tools = [web_scraper_tool, browser_interaction_tool, code_generator_tool, code_executor_tool, github_push_tool]
    agent_executor = create_react_agent(llm, tools)

    print(f"{'='*20} Agent Initialized. Starting Task. {'='*20}\n")

    messages = [
        SystemMessage(content=AGENT_SYSTEM_PROMPT),
        HumanMessage(
            content=f"""
                Here is the URL for your mission: {url}
                Here is my query: {query}
                
                Please analyze the page, understand the challenge requirements, and complete the necessary interactions to answer my query.
                """
        )
    ]

    try:
        result = await asyncio.wait_for(
            agent_executor.ainvoke({"messages": messages}),
            timeout=60  # seconds, longer for code generation
        )
        answer = result["messages"][-1].content.strip()
        return [answer]
    except asyncio.TimeoutError:
        return ["Timeout: Unable to retrieve answer within time limit."]

# The main function can remain the same for your testing purposes.
# async def main():
#     url = "https://register.hackrx.in/showdown/startChallenge/ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiMjlzUjNWNUlqb2lRVVpNUVVnaUxDSmphR0ZzYkdWdVoyVkpSQ0k2SW1ocFpHUmxiaUlzSW5WelpYSkpaQ0k2SW5WelpYSmZZV1pzWVdnaUxDSmxiV0ZwYkNJNkltRm1iR0ZvUUdKaGFtRnFabWx1YzJWeWRtaGxZV3gwYUM1cGJpSXNJbkp2YkdVaU9pSmpiMjlzWDJkMWVTSXNJbWxoZENJNk1UYzFOVGcwT1RZME1Dd2laWGh3SWpveE56VTFPVE0yTURRd2ZRLi1IX1BfOHdYUE9uVmF2NVZoN0NhUjlKV1ZCbnM5ZV9KeHllWlppaVNZWTg="
#     query = "Go to the website and start the challenge. Complete the challenge and return the answers for the following question? What is the completion code?"

#     print(f"{'='*20} Initializing Reasoning Agent {'='*20}")
#     final_answer = await reasoning_agent(url, query)
#     print(f"\n{'='*20} Task Finished {'='*20}")
#     print(f"Final Answer: {final_answer[0]}")

# if __name__ == "__main__":
#     asyncio.run(main())