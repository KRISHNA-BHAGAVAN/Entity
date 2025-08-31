import subprocess
import tempfile
import os
from typing import List
from langchain_core.tools import tool
from config import AGENT_LLM

@tool
async def code_generator_tool(query: str, question: str) -> str:
    """
    Generates code based on a query and specific question.
    """
    print(f"\n--- TOOL: Code Generator ---")
    print(f"Query: {query}")
    print(f"Question: {question}")
    
    prompt = f"""
    Generate Python code to solve this problem:
    
    Problem: {query}
    Test case: {question}
    
    Requirements:
    - Write complete, executable Python code
    - Print the final answer only
    - Handle the specific test case provided
    - Code should be production-ready and handle edge cases
    
    Return only the Python code, no explanations.
    """
    
    try:
        response = await AGENT_LLM.ainvoke(prompt)
        code = response.content.strip()
        
        # Clean up code formatting
        if code.startswith("```python"):
            code = code[9:]
        if code.endswith("```"):
            code = code[:-3]
        
        return code.strip()
    except Exception as e:
        return f"Error generating code: {e}"

@tool
async def code_executor_tool(code: str) -> str:
    """
    Executes Python code in a controlled environment and returns the output.
    """
    print(f"\n--- TOOL: Code Executor ---")
    
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        # Execute code in controlled environment
        result = subprocess.run(
            ['python', temp_file],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=tempfile.gettempdir()
        )
        
        # Clean up
        os.unlink(temp_file)
        
        if result.returncode == 0:
            output = result.stdout.strip()
            print(f"Execution successful: {output}")
            return output
        else:
            error = result.stderr.strip()
            print(f"Execution error: {error}")
            return f"Error: {error}"
            
    except subprocess.TimeoutExpired:
        return "Error: Code execution timed out"
    except Exception as e:
        return f"Error executing code: {e}"

@tool 
async def github_push_tool(code: str, filename: str = "solution.py") -> str:
    """
    Pushes code to a GitHub repository.
    """
    print(f"\n--- TOOL: GitHub Push ---")
    
    try:
        # Create local file
        with open(filename, 'w') as f:
            f.write(code)
        
        # Git commands
        commands = [
            ['git', 'add', filename],
            ['git', 'commit', '-m', f'Add {filename} - AI generated solution'],
            ['git', 'push', 'origin', 'main']
        ]
        
        for cmd in commands:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return f"Git error: {result.stderr}"
        
        return f"Successfully pushed {filename} to GitHub"
        
    except Exception as e:
        return f"Error pushing to GitHub: {e}"

async def process_code_query(query: str, questions: List[str]) -> List[str]:
    """
    Main function to process code generation queries.
    """
    answers = []
    
    for question in questions:
        # Generate code
        code = await code_generator_tool.ainvoke({"query": query, "question": question})
        
        if code.startswith("Error"):
            answers.append(code)
            continue
        
        # Execute code
        result = await code_executor_tool.ainvoke({"code": code})
        
        # Push to GitHub
        await github_push_tool.ainvoke({"code": code, "filename": f"solution_{len(answers)}.py"})
        
        answers.append(result)
    
    return answers