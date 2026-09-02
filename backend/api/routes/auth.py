from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.config import settings
from api.models.member import Member
from api.models.team import Team
from api.schemas.auth import LoginRequest, LoginResponse
from api.auth import create_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.access_code == settings.ADMIN_ACCESS_CODE:
        token = create_token(team_id=0, member_id=0, is_admin=True)
        return LoginResponse(
            token=token,
            team_id=0,
            team_name="Admin",
            member_name="Admin",
            is_admin=True,
        )

    member = db.query(Member).filter(
        Member.access_code == body.access_code,
        Member.is_active == True,
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or deactivated access code",
        )

    team = db.query(Team).filter(Team.id == member.team_id).first()

    token = create_token(team_id=team.id, member_id=member.id)
    return LoginResponse(
        token=token,
        team_id=team.id,
        team_name=team.name,
        member_name=member.name,
        is_admin=False,
    )
