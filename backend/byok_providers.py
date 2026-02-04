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
    def validate_key(self, api_key: str, model: Optional[str] = None) -> bool:
        """Validate API key and optional model access"""
        pass
    
    @abstractmethod
    def create_llm(self, api_key: str, model: str, **options) -> Any:
        """Create LLM instance with decrypted key"""
        pass

class OpenAIAdapter(LLMProviderAdapter):
    def validate_key(self, api_key: str, model: Optional[str] = None) -> bool:
        """Validate OpenAI API key and optional model"""
        try:
            # 1. Basic Key Validation (Fast)
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            response = requests.get(
                'https://api.openai.com/v1/models',
                headers=headers,
                timeout=10
            )
            if response.status_code != 200:
                raise ValueError("Invalid API Key")
            
            # 2. Model Access Validation (If model specified)
            if model:
                llm = self.create_llm(api_key, model, max_tokens=5)
                llm.invoke("Hi")
            
            return True
        except Exception as e:
            # Propagate specific error messages if possible, or handle in endpoint
            # For now, we return specific error string if possible, but the signature says bool
            # The user wants specific error messages.
            # I should probably change the signature to return (bool, str) or raise exceptions.
            # But adhering to the interface... The endpoint catches exceptions?
            # The current interface is bool. I'll stick to bool for now and raise Exception if I can, 
            # but the abstract method returns bool. 
            # Let's check the abstract method again. It returns bool.
            # However, the user wants "appropriate error message to the user like Invalid api key or invalid model".
            # Raising exception is better.
            raise e 

    
    def create_llm(self, api_key: str, model: str = "gpt-4o-mini", **options) -> ChatOpenAI:
        """Create ChatOpenAI instance"""
        return ChatOpenAI(
            api_key=api_key,
            model=model,
            **options
        )

class GeminiAdapter(LLMProviderAdapter):
    def validate_key(self, api_key: str, model: Optional[str] = None) -> bool:
        """Validate Gemini API key and optional model"""
        try:
            # 1. Basic Key Validation
            response = requests.get(
                f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}',
                timeout=10
            )
            if response.status_code != 200:
                raise ValueError("Invalid API Key")

            # 2. Model Validation
            if model:
                llm = self.create_llm(api_key, model, max_output_tokens=5)
                llm.invoke("Hi")
                
            return True
        except Exception as e:
            raise e

    
    def create_llm(self, api_key: str, model: str = "gemini-1.5-flash", **options) -> ChatGoogleGenerativeAI:
        """Create ChatGoogleGenerativeAI instance"""
        return ChatGoogleGenerativeAI(
            api_key=api_key,
            model=model,
            **options
        )

class GroqAdapter(LLMProviderAdapter):
    def validate_key(self, api_key: str, model: Optional[str] = None) -> bool:
        """Validate Groq API key and optional model"""
        try:
            # 1. Basic Key Validation
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            response = requests.get(
                'https://api.groq.com/openai/v1/models',
                headers=headers,
                timeout=10
            )
            if response.status_code != 200:
                raise ValueError("Invalid API Key")

            # 2. Model Validation
            if model:
                llm = self.create_llm(api_key, model, max_tokens=5)
                llm.invoke("Hi")

            return True
        except Exception as e:
            raise e

    
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