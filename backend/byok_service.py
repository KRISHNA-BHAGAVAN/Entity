"""
BYOK Key Broker Service
Handles secure key retrieval and LLM instantiation
"""
from typing import Optional, Any
from datetime import datetime
from storage_service import get_user_supabase_client
from byok_encryption import byok_crypto
from byok_providers import get_provider_adapter
import os

class BYOKKeyBroker:
    def __init__(self):
        pass
    
    def get_llm_for_user(
        self, 
        user_id: str, 
        provider: str, 
        model: str, 
        jwt_token: Optional[str] = None,
        strict_byok: bool = True,
        **options
    ) -> tuple[Any, dict]:
        """
        Get LLM instance for user with their encrypted key
        Returns (llm_instance, metadata) where metadata contains key source info
        """
        user_key_found = False
        fallback_used = False
        
        try:
            # Try to get user's key first
            supabase = get_user_supabase_client(jwt_token)
            
            result = supabase.table('llm_api_keys').select('encrypted_key').eq(
                'user_id', user_id
            ).eq('provider', provider).eq('status', 'active').single().execute()
            
            if result.data:
                user_key_found = True
                # Decrypt user's key
                encrypted_key = result.data['encrypted_key']
                decrypted_key = byok_crypto.decrypt_api_key(encrypted_key)
                
                # Update last_used_at
                supabase.table('llm_api_keys').update({
                    'last_used_at': datetime.utcnow().isoformat()
                }).eq('user_id', user_id).eq('provider', provider).execute()
                
                # Log usage
                self._log_audit(supabase, user_id, provider, 'used', {'model': model})
                
                # Create LLM with user's key
                adapter = get_provider_adapter(provider)
                llm = adapter.create_llm(decrypted_key, model, **options)
                
                # Clear decrypted key from memory
                decrypted_key = None
                
                return llm, {
                    'key_source': 'user',
                    'user_key_found': True,
                    'fallback_used': False
                }
            
        except Exception as e:
            print(f"Failed to get user key for {provider}: {e}")
        
        # If strict BYOK mode and no user key found, raise error
        if strict_byok and not user_key_found:
            raise ValueError(f"BYOK_REQUIRED: No API key found for provider '{provider}'. Please add your API key in Settings.")
        
        # Fallback to .env keys (admin/system mode)
        try:
            llm = self._get_fallback_llm(provider, model, **options)
            fallback_used = True
            return llm, {
                'key_source': 'fallback',
                'user_key_found': False,
                'fallback_used': True
            }
        except Exception as e:
            # Both user key and fallback failed
            raise ValueError(f"BYOK_SETUP_REQUIRED: No API keys available for provider '{provider}'. Please add your API key in Settings to continue.")
    
    def _get_fallback_llm(self, provider: str, model: str, **options) -> Any:
        """Fallback to .env keys"""
        env_key_map = {
            'openai': 'OPENAI_API_KEY',
            'gemini': 'GOOGLE_API_KEY', 
            'groq': 'GROQ_API_KEY'
        }
        
        env_key = env_key_map.get(provider)
        if not env_key:
            raise ValueError(f"No fallback key configured for provider: {provider}")
        
        api_key = os.getenv(env_key)
        if not api_key:
            raise ValueError(f"No fallback API key available for provider: {provider}")
        
        adapter = get_provider_adapter(provider)
        return adapter.create_llm(api_key, model, **options)
    
    def _log_audit(self, supabase, user_id: str, provider: str, action: str, metadata: dict = None):
        """Log audit event"""
        try:
            supabase.table('llm_key_audit_logs').insert({
                'user_id': user_id,
                'provider': provider,
                'action': action,
                'metadata': metadata or {}
            }).execute()
        except Exception as e:
            print(f"Failed to log audit: {e}")

# Global instance
key_broker = BYOKKeyBroker()