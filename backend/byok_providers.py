"""
BYOK Provider Adapters
Handles validation and LLM creation for different providers
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import requests
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

class LLMProviderAdapter(ABC):
    @abstractmethod
    def validate_key(self, api_key: str) -> bool:
        """Validate API key with minimal token usage"""
        pass
    
    @abstractmethod
    def create_llm(self, api_key: str, model: str, **options) -> Any:
        """Create LLM instance with decrypted key"""
        pass

class OpenAIAdapter(LLMProviderAdapter):
    def validate_key(self, api_key: str) -> bool:
        """Validate OpenAI API key"""
        try:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            # Use minimal request to validate key
            response = requests.get(
                'https://api.openai.com/v1/models',
                headers=headers,
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def create_llm(self, api_key: str, model: str = "gpt-4o-mini", **options) -> ChatOpenAI:
        """Create ChatOpenAI instance"""
        return ChatOpenAI(
            api_key=api_key,
            model=model,
            **options
        )

class GeminiAdapter(LLMProviderAdapter):
    def validate_key(self, api_key: str) -> bool:
        """Validate Gemini API key"""
        try:
            # Use Google AI Studio API for validation
            response = requests.get(
                f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}',
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def create_llm(self, api_key: str, model: str = "gemini-1.5-flash", **options) -> ChatGoogleGenerativeAI:
        """Create ChatGoogleGenerativeAI instance"""
        return ChatGoogleGenerativeAI(
            api_key=api_key,
            model=model,
            **options
        )

class GroqAdapter(LLMProviderAdapter):
    def validate_key(self, api_key: str) -> bool:
        """Validate Groq API key"""
        try:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            # Use models endpoint for validation
            response = requests.get(
                'https://api.groq.com/openai/v1/models',
                headers=headers,
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def create_llm(self, api_key: str, model: str = "llama-3.3-70b-versatile", **options) -> ChatGroq:
        """Create ChatGroq instance"""
        return ChatGroq(
            api_key=api_key,
            model=model,
            **options
        )

# Provider registry
PROVIDERS: Dict[str, LLMProviderAdapter] = {
    'openai': OpenAIAdapter(),
    'gemini': GeminiAdapter(),
    'groq': GroqAdapter()
}

def get_provider_adapter(provider: str) -> LLMProviderAdapter:
    """Get provider adapter by name"""
    if provider not in PROVIDERS:
        raise ValueError(f"Unsupported provider: {provider}")
    return PROVIDERS[provider]