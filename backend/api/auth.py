from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session

from api.config import settings
from api.dependencies import get_db
from api.models.member import Member
from api.models.team import Team

security = HTTPBearer()
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def create_token(team_id: int, member_id: int, is_admin: bool = False) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {
        "team_id": team_id,
        "member_id": member_id,
        "is_admin": is_admin,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    payload = decode_token(credentials.credentials)

    if payload.get("is_admin"):
        return {"team_id": None, "member_id": None, "is_admin": True}

    member = db.query(Member).filter(
        Member.id == payload["member_id"],
        Member.is_active == True,
    ).first()

    if not member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account deactivated")

    team = db.query(Team).filter(Team.id == payload["team_id"]).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Team not found")

    return {
        "team_id": payload["team_id"],
        "member_id": payload["member_id"],
        "is_admin": False,
        "team_name": team.name,
        "member_name": member.name,
    }


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
