from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.auth import get_current_user
from api.models.team import Team
from api.models.member import Member
from api.schemas.team import TeamOut, TeamNameUpdate, MemberOut

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/me", response_model=TeamOut)
def get_my_team(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == current_user["team_id"]).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members = db.query(Member).filter(
        Member.team_id == team.id,
        Member.is_active == True,
    ).all()

    return TeamOut(
        id=team.id,
        name=team.name,
        total_points=team.total_points,
        members=[MemberOut.model_validate(m) for m in members],
    )


@router.put("/me/name", response_model=TeamOut)
def update_team_name(
    body: TeamNameUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Team).filter(Team.name == body.name).first()
    if existing and existing.id != current_user["team_id"]:
        raise HTTPException(status_code=400, detail="Team name already taken")

    team = db.query(Team).filter(Team.id == current_user["team_id"]).first()
    team.name = body.name
    db.commit()
    db.refresh(team)

    members = db.query(Member).filter(Member.team_id == team.id, Member.is_active == True).all()
    return TeamOut(
        id=team.id,
        name=team.name,
        total_points=team.total_points,
        members=[MemberOut.model_validate(m) for m in members],
    )


@router.delete("/me/members/{member_id}")
def kick_member(
    member_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.team_id == current_user["team_id"],
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.id == current_user["member_id"]:
        raise HTTPException(status_code=400, detail="Cannot kick yourself")

    member.is_active = False
    db.commit()
    return {"detail": "Member kicked"}
