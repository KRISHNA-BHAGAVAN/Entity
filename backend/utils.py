# utils.py
import re

def contains_api_or_url(text: str, url: str) -> bool:
    """
    Returns True if the text contains interactive API documentation patterns
    or placeholder-style variables in URLs (like ${id}, ${token}, etc.).
    """

    # Instructional API patterns
    instructional_patterns = [
        r'\bcall\s+this\s+endpoint',
        r'\bcall\s+the\s+api',
        r'\bmake\s+a\s+request\s+to',
        r'\bendpoint\s+to\s+get',
        r'\bapi\s+response',
        r'\b(GET|POST|PUT|DELETE|PATCH)\s+https?://',
        r'\bcurl\s+-[XH]',
        r'\b(request|response)\s*(body|payload|headers?)',
        r'\b(authorization|auth)\s*:\s*(bearer|basic|api[_-]?key)',
        r'\bapi[_-]?key\s*[:=]',
        r'\b(query\s*param|path\s*param|header\s*param)',
        r'\b(endpoint|api)\s*:\s*https?://',
        r'\b(base\s*url|baseurl)\s*:\s*https?://',
        r'\b(content-type|accept)\s*:\s*application/',
        r'\b(status\s*code|http\s*status)\s*:\s*\d{3}',
    ]

    # Detect placeholder variables like ${var} inside URLs or text
    placeholder_pattern = r'https?://[^\s]*\$\{[^}]+\}[^\s]*'

    # Check for any instructional API pattern
    for pattern in instructional_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True

    # Check for placeholder URL variables
    if re.search(placeholder_pattern, url):
        return True

    return False


