"""
BYOK FastAPI Endpoints
Secure API key management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from storage_service import get_user_supabase_client
from byok_encryption import byok_crypto
from byok_providers import get_provider_adapter

# JWT Token extraction (reuse from main server)
def get_jwt_token(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None

# Pydantic models
class BYOKAddRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None

class BYOKValidateRequest(BaseModel):
    provider: str
    model: Optional[str] = None

class BYOKKeyInfo(BaseModel):
    provider: str
    model: Optional[str]
    status: str
    last_used_at: Optional[str]
    last_validated_at: Optional[str]
    created_at: str


# Router
byok_router = APIRouter(prefix="/api/byok", tags=["BYOK"])

@byok_router.post("")
async def add_or_update_key(
    request: BYOKAddRequest,
    token: Optional[str] = Depends(get_jwt_token)
):
    """Add or update API key for provider"""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        # Validate provider
        if request.provider not in ['openai', 'gemini', 'groq']:
            raise HTTPException(status_code=400, detail="Invalid provider")
        
        # Validate API key with provider (and model if provided)
        adapter = get_provider_adapter(request.provider)
        try:
             # This will raise exception if invalid
            adapter.validate_key(request.api_key, request.model)
        except ValueError as ve:
             raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
             # Capture specific errors like "model not found" or "invalid api key"
             error_msg = str(e)
             if "401" in error_msg:
                 detail = "Invalid API Key"
             elif "404" in error_msg and request.model:
                 detail = f"Model '{request.model}' not found or not supported"
             else:
                 detail = f"Validation failed: {error_msg}"
             raise HTTPException(status_code=400, detail=detail)
        
        # Encrypt the key
        encrypted_key = byok_crypto.encrypt_api_key(request.api_key)
        fingerprint = byok_crypto.fingerprint_api_key(request.api_key)
        
        # Check if key already exists
        existing = supabase.table('llm_api_keys').select('id').eq(
            'user_id', user_id
        ).eq('provider', request.provider).execute()
        
        now = datetime.utcnow().isoformat()
        
        key_data = {
            'encrypted_key': encrypted_key,
            'key_fingerprint': fingerprint,
            'model': request.model,
            'status': 'active',
            'last_validated_at': now
        }
        
        if existing.data:
            # Update existing key
            key_data['updated_at'] = now
            supabase.table('llm_api_keys').update(key_data).eq('user_id', user_id).eq('provider', request.provider).execute()
            
            action = 'rotated'
        else:
            # Insert new key
            key_data['user_id'] = user_id
            key_data['provider'] = request.provider
            supabase.table('llm_api_keys').insert(key_data).execute()
            
            action = 'created'
        
        # Log audit
        supabase.table('llm_key_audit_logs').insert({
            'user_id': user_id,
            'provider': request.provider,
            'model': request.model,
            'action': action
        }).execute()
        
        return {"success": True, "action": action}

        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save key: {str(e)}")

@byok_router.post("/validate")
async def validate_key(
    request: BYOKValidateRequest,
    token: Optional[str] = Depends(get_jwt_token)
):
    """Validate existing API key"""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        # Get encrypted key and stored model
        result = supabase.table('llm_api_keys').select('encrypted_key, model').eq(
            'user_id', user_id
        ).eq('provider', request.provider).eq('status', 'active').single().execute()

        
        if not result.data:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Decrypt and validate
        encrypted_key = result.data['encrypted_key']
        # If request doesn't specify model, try to use stored model
        model_to_test = request.model if request.model else result.data.get('model')
        
        decrypted_key = byok_crypto.decrypt_api_key(encrypted_key)
        
        adapter = get_provider_adapter(request.provider)
        try:
             adapter.validate_key(decrypted_key, model_to_test)
             is_valid = True
        except Exception:
             is_valid = False
        
        # Clear from memory
        decrypted_key = None
        
        if is_valid:
            # Update last_validated_at
            supabase.table('llm_api_keys').update({
                'last_validated_at': datetime.utcnow().isoformat()
            }).eq('user_id', user_id).eq('provider', request.provider).execute()
            
            # Log audit
            supabase.table('llm_key_audit_logs').insert({
                'user_id': user_id,
                'provider': request.provider,
                'model': model_to_test,
                'action': 'validated'
            }).execute()
        
        return {"valid": is_valid}

        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@byok_router.delete("/{provider}")
async def revoke_key(
    provider: str,
    token: Optional[str] = Depends(get_jwt_token)
):
    """Revoke API key for provider"""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        # Update status to revoked
        result = supabase.table('llm_api_keys').update({
            'status': 'revoked',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('user_id', user_id).eq('provider', provider).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Log audit
        supabase.table('llm_key_audit_logs').insert({
            'user_id': user_id,
            'provider': provider,
            'action': 'revoked'
        }).execute()
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revoke key: {str(e)}")

@byok_router.get("", response_model=List[BYOKKeyInfo])
async def list_providers(
    token: Optional[str] = Depends(get_jwt_token)
):
    """List user's API key providers (no secrets)"""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        
        result = supabase.table('llm_api_keys').select(
            'provider, model, status, last_used_at, last_validated_at, created_at'
        ).eq('user_id', user_id).execute()

        
        return [
            BYOKKeyInfo(
                provider=row['provider'],
                model=row.get('model'),
                status=row['status'],
                last_used_at=row.get('last_used_at'),
                last_validated_at=row.get('last_validated_at'),
                created_at=row['created_at']
            )

            for row in result.data
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list providers: {str(e)}")