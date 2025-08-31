from langchain_pymupdf4llm import PyMuPDF4LLMLoader
from langchain_core.tools import tool
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Browser, Playwright, Page
import aiohttp
import json
import traceback
import asyncio
from typing import Dict, Any
import re

# Persistent globals
_playwright_instance: Playwright | None = None
_browser_instance: Browser | None = None
_page_instance: Page | None = None


async def get_browser() -> Browser:
    """Ensures one persistent browser instance is reused."""
    global _playwright_instance, _browser_instance
    if _browser_instance is None or not _browser_instance.is_connected():
        print("🚀 Initializing new persistent browser instance...")
        _playwright_instance = await async_playwright().start()
        _browser_instance = await _playwright_instance.chromium.launch(headless=True)
    return _browser_instance


async def get_persistent_page(url: str) -> Page:
    """Returns a persistent Page object bound to the persistent browser."""
    global _page_instance
    browser = await get_browser()
    if _page_instance is None or _page_instance.is_closed():
        _page_instance = await browser.new_page()
    await _page_instance.goto(url, wait_until="networkidle", timeout=20000)
    return _page_instance


async def shutdown_browser():
    """Gracefully closes the browser and Playwright."""
    global _playwright_instance, _browser_instance, _page_instance
    if _page_instance and not _page_instance.is_closed():
        await _page_instance.close()
    if _browser_instance and _browser_instance.is_connected():
        await _browser_instance.close()
    if _playwright_instance:
        await _playwright_instance.stop()
    _page_instance = None
    _browser_instance = None
    _playwright_instance = None


@tool
async def web_scraper_tool(url: str) -> str:
    """
    Initial, static examination of a webpage or PDF.
    Retrieves visible text + interactive elements. No clicks.
    """
    print(f"\n--- TOOL: Async Web Scraper ---")
    print(f"Fetching content from: {url}")

    # Handle PDF
    if url.split("?")[0].lower().endswith(".pdf"):
        print("Detected PDF content.")
        try:
            loader = PyMuPDF4LLMLoader(url)
            docs = await loader.aload()
            return "\n\n".join(doc.page_content for doc in docs) or "No text found in PDF."
        except Exception as e:
            traceback.print_exc()
            return f"Error parsing PDF: {e}"

    try:
        # Use existing page if available, otherwise navigate
        global _page_instance
        if _page_instance and not _page_instance.is_closed():
            page = _page_instance
            print("Using existing page state")
        else:
            page = await get_persistent_page(url)

        # Visible body text

        # Collect interactive elements robustly
        selectors = [
            "button", "input", "select", "textarea",
            "a", "form", "label", "details", "summary",
            "dialog", "[role=button]"
        ]
        elements = []
        for sel in selectors:
            loc = page.locator(sel)
            count = await loc.count()
            for i in range(count):
                el = loc.nth(i)
                attrs = await el.evaluate(
                    "e => Object.fromEntries([...e.attributes].map(a => [a.name, a.value]))"
                )
                text = (await el.inner_text()) or (await el.get_attribute("value")) or ""
                elements.append({"selector": sel, "index": i, "attrs": attrs, "text": text.strip()})

        output = {
            "interactive_elements": elements or "[No interactive elements found]"
        }
        print(output)
        return json.dumps(output, indent=2)

    except Exception as e:
        traceback.print_exc()
        return f"Unexpected error in web_scraper_tool: {e}"


@tool
async def browser_interaction_tool(
    url: str = None,
    action_selector: str = None,
    input_selector: str = None,
    input_text: str = None,
    wait_timeout: int = 5000
) -> Dict[str, Any]:
    """
    Interacts with a web page using a persistent browser that preserves state across calls.
    Extracts interactive elements and handles UI updates after interactions.
    """
    print(f"\n--- ⚡ TOOL: Browser Interaction ---")
    
    output = {"visible_text": "", "structured_data": {}, "interactive_elements": []}
    
    try:
        # Use persistent page - navigate only if URL provided
        if url:
            print(f"Navigating to: {url}")
            page = await get_persistent_page(url)
        else:
            # Use existing page state
            global _page_instance
            if _page_instance is None or _page_instance.is_closed():
                return {"error": "No active page. Provide a URL first."}
            page = _page_instance
            print("Using existing page state")

        # Handle input
        if input_selector and input_text:
            print(f"Typing '{input_text[:20]}...' into '{input_selector}'")
            await page.locator(input_selector).fill(input_text, timeout=wait_timeout)

        # Handle click and wait for UI updates
        if action_selector:
            print(f"Clicking '{action_selector}'")
            await page.locator(action_selector).click(timeout=wait_timeout)
            
            # Wait for potential UI updates
            try:
                await page.wait_for_load_state('networkidle', timeout=2000)  # Shorter wait
                print("✅ UI updated after interaction")
            except Exception:
                await asyncio.sleep(0.5)  # Shorter fallback wait
                print("⚠️ Using fallback wait after interaction")
            
            # If this was a submit button, immediately check for completion
            if 'success' in action_selector.lower() or 'submit' in action_selector.lower():
                await asyncio.sleep(0.5)  # Brief wait for result
                current_text = await page.inner_text("body")
                if any(word in current_text.lower() for word in ['completion', 'success', 'correct', 'completed', 'code']):
                    print("🎉 Completion detected after submit!")

        # Extract visible text
        visible_text = await page.inner_text("body")
        
        # Look for hidden elements with data-secret attribute
        hidden_elements = []
        try:
            secret_elements = await page.locator('[data-secret]').all()
            for el in secret_elements:
                secret_attr = await el.get_attribute('data-secret')
                inner_text = await el.inner_text()
                text_content = await el.text_content()
                hidden_elements.append({
                    "type": "hidden", 
                    "data-secret": secret_attr,
                    "inner_text": inner_text,
                    "text_content": text_content
                })
        except Exception:
            pass
        
        # Collect interactive elements robustly
        selectors = [
            "button", "input", "select", "textarea",
            "a", "form", "label", "details", "summary",
            "dialog", "[role=button]"
        ]
        elements = []
        for sel in selectors:
            loc = page.locator(sel)
            count = await loc.count()
            for i in range(count):
                el = loc.nth(i)
                attrs = await el.evaluate(
                    "e => Object.fromEntries([...e.attributes].map(a => [a.name, a.value]))"
                )
                text = (await el.inner_text()) or (await el.get_attribute("value")) or ""
                elements.append({"selector": sel, "index": i, "attrs": attrs, "text": text.strip()})

        output = {
            "visible_text": visible_text[:5000],
            "interactive_elements": elements or "[No interactive elements found]",
            "hidden_elements": hidden_elements or "[No hidden elements found]"
        }
        print(output)

        # Extract structured data and look for completion indicators
        html_content = await page.content()
        soup = BeautifulSoup(html_content, "html.parser")
        structured_data = {}
        
        # Look for completion codes or success messages
        completion_indicators = []
        for el in soup.find_all(["div", "p", "span", "pre", "code", "h1", "h2", "h3"]):
            text = el.get_text(strip=True)
            if any(word in text.lower() for word in ["completion", "code", "success", "correct", "completed", "challenge completed", "well done"]):
                completion_indicators.append(text)
        
        # Also check for any text that looks like a completion code (alphanumeric strings)
        import re as regex
        code_pattern = regex.compile(r'\b[A-Z0-9]{6,}\b')
        for match in code_pattern.findall(visible_text):
            completion_indicators.append(f"Possible completion code: {match}")
        
        kv_pattern = re.compile(r"^\s*([\w\s.-]+?)\s*:\s*(.*)$")
        for el in soup.find_all(["div", "p", "span", "pre"]):
            for line in el.get_text("\n", strip=True).split("\n"):
                match = kv_pattern.match(line)
                if match:
                    key, value = match.groups()
                    structured_data[key.strip()] = value.strip()
        
        output["structured_data"] = structured_data
        output["completion_indicators"] = completion_indicators
        
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Browser interaction failed: {e}", **output}

    return output


@tool
async def html_tag_extractor_tool(url: str, tags: list) -> str:
    """
    Extracts specific HTML tags from a webpage.
    
    Args:
        url (str): The webpage URL to scrape
        tags (list): List of HTML tag names to extract (e.g., ['h1', 'p', 'div'])
    
    Returns:
        str: The extracted HTML tags as a string
    """
    print(f"\n--- TOOL: HTML Tag Extractor ---")
    print(f"Fetching tags {tags} from: {url}")
    
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers={'User-Agent': 'Mozilla/5.0'}) as response:
                response.raise_for_status()
                html_text = await response.text()
                
                soup = BeautifulSoup(html_text, 'html.parser')
                
                # Find all specified tags
                found_tags = []
                for tag_name in tags:
                    elements = soup.find_all(tag_name)
                    found_tags.extend(elements)
                
                if not found_tags:
                    return f"No tags found for: {tags}"
                
                return '\n'.join(str(tag) for tag in found_tags)
                
    except Exception as e:
        traceback.print_exc()
        return f"Error extracting tags: {e}"