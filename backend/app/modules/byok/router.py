from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_jwt_token
from app.integrations.supabase.storage import get_user_supabase_client
from app.modules.byok.schemas import BYOKAddRequest, BYOKKeyInfo, BYOKValidateRequest, ProviderCatalogResponse
from app.modules.byok.service import key_broker, list_provider_catalog, normalize_credentials

byok_router = APIRouter(prefix="/api/byok", tags=["BYOK"])


@byok_router.get("/catalog", response_model=ProviderCatalogResponse)
async def get_catalog():
    return list_provider_catalog()


@byok_router.post("")
async def add_or_update_key(request: BYOKAddRequest, token: str = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    credentials = normalize_credentials(request.credentials)
    if not credentials:
        raise HTTPException(status_code=400, detail="Provider credentials are required")

    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        action, metadata = key_broker.save_key(
            jwt_token=token,
            user_id=user_id,
            provider=request.provider,
            model=request.model,
            credentials=credentials,
        )
        return {"success": True, "action": action, **metadata}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save key: {exc}") from exc


@byok_router.post("/validate")
async def validate_key(request: BYOKValidateRequest, token: str = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        user_id = user.user.id
        valid, message = key_broker.validate_stored_key(
            jwt_token=token,
            user_id=user_id,
            provider=request.provider,
            model=request.model,
        )
        return {"valid": valid, "message": message}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Validation failed: {exc}") from exc


@byok_router.delete("/{provider}")
async def revoke_key(provider: str, token: str = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        key_broker.revoke_key(jwt_token=token, user_id=user.user.id, provider=provider)
        return {"success": True}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to revoke key: {exc}") from exc


@byok_router.get("", response_model=List[BYOKKeyInfo])
async def list_keys(token: str = Depends(get_jwt_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        supabase = get_user_supabase_client(token)
        user = supabase.auth.get_user()
        rows = key_broker.list_user_keys(jwt_token=token, user_id=user.user.id)
        return [BYOKKeyInfo(**row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list providers: {exc}") from exc
