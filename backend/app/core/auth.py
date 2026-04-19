from typing import Optional

from fastapi import Depends, Header, HTTPException


def get_jwt_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


def require_jwt_token(token: Optional[str] = Depends(get_jwt_token)) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return token

