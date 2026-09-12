import secrets
import os
import zipfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from api.dependencies import get_db
from api.auth import require_admin
from api.email import send_access_codes
from api.models.team import Team
from api.models.member import Member
from api.models.competition import Competition
from api.models.score import DailyScore
from api.models.submission import Submission
from api.schemas.team import TeamCreate, TeamOut, MemberOut, MemberCreate
from api.schemas.team import TeamCreateResult, MemberCreateResult
from api.schemas.competition import CompetitionCreate, CompetitionUpdate, CompetitionOut
from api.config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


def generate_access_code(team_name: str) -> str:
    return f"{team_name}-{secrets.token_hex(4)}"


def _recipients(members: list[Member]):
    return [
        {"name": m.name, "email": m.email, "access_code": m.access_code}
        for m in members
    ]


@router.get("/teams", response_model=list[TeamOut])
def list_all_teams(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    teams = db.query(Team).order_by(Team.name).all()
    result = []
    for team in teams:
        members = db.query(Member).filter(Member.team_id == team.id).all()
        result.append(TeamOut(
            id=team.id,
            name=team.name,
            total_points=team.total_points,
            members=[MemberOut.model_validate(m) for m in members],
        ))
    return result


@router.post("/teams", response_model=TeamCreateResult)
def create_team(body: TeamCreate, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(Team).filter(Team.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")

    team = Team(name=body.name)
    db.add(team)
    db.flush()

    members = []
    for m in body.members:
        member = Member(
            team_id=team.id,
            name=m.name,
            email=m.email,
            access_code=generate_access_code(body.name),
        )
        db.add(member)
        members.append(member)

    db.commit()
    db.refresh(team)
    for m in members:
        db.refresh(m)

    recipients = _recipients(members)
    failed = send_access_codes(team.name, recipients)

    return TeamCreateResult(
        id=team.id,
        name=team.name,
        total_points=team.total_points,
        members=[MemberOut.model_validate(m) for m in members],
        emails_sent=len(recipients) - len(failed),
        email_failures=failed,
        codes=recipients,
    )


@router.delete("/teams/{team_id}")
def delete_team(team_id: int, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    db.query(Member).filter(Member.team_id == team_id).delete()
    db.query(DailyScore).filter(DailyScore.team_id == team_id).delete()
    db.query(Submission).filter(Submission.team_id == team_id).delete()
    db.delete(team)
    db.commit()
    return {"detail": "Team and all related data deleted"}


@router.delete("/teams/{team_id}/submissions/today")
def reset_team_submissions_today(
    team_id: int, admin: dict = Depends(require_admin), db: Session = Depends(get_db)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    today = date.today()
    submissions = db.query(Submission).filter(Submission.team_id == team_id).all()
    for sub in submissions:
        if sub.submitted_at.date() == today:
            db.delete(sub)
            
    db.commit()
    return {"detail": "Team upload limit for today has been reset."}


@router.post("/teams/{team_id}/members", response_model=MemberCreateResult)
def add_member(
    team_id: int,
    body: MemberCreate,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    member = Member(
        team_id=team_id,
        name=body.name,
        email=body.email,
        access_code=generate_access_code(team.name),
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    recipients = _recipients([member])
    failed = send_access_codes(team.name, recipients)

    return MemberCreateResult(
        **MemberOut.model_validate(member).model_dump(),
        email_sent=not failed,
        codes=recipients,
    )


@router.put("/members/{member_id}/name")
def update_member_name(
    member_id: int,
    body: dict,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.name = body["name"]
    db.commit()
    return {"detail": "Member name updated"}


@router.post("/teams/{team_id}/send-codes")
def send_codes(team_id: int, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members = db.query(Member).filter(Member.team_id == team_id, Member.is_active == True).all()
    recipients = _recipients(members)
    failed = send_access_codes(team.name, recipients)
    return {
        "detail": "Access codes sent",
        "codes": recipients,
        "emails_sent": len(recipients) - len(failed),
        "email_failures": failed,
    }


@router.delete("/members/{member_id}")
def kick_member(member_id: int, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.is_active = False
    db.commit()
    return {"detail": "Member deactivated"}


@router.post("/teams/{team_id}/generate-codes")
def generate_and_send_codes(
    team_id: int,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members = db.query(Member).filter(Member.team_id == team_id, Member.is_active == True).all()
    for member in members:
        member.access_code = generate_access_code(team.name)
    db.commit()

    codes = _recipients(members)
    failed = send_access_codes(team.name, codes)
    return {
        "detail": "Access codes regenerated",
        "codes": codes,
        "emails_sent": len(codes) - len(failed),
        "email_failures": failed,
    }


from datetime import date
from sqlalchemy import and_

@router.post("/competitions", response_model=CompetitionOut)
def create_competition(
    body: CompetitionCreate,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    overlap = db.query(Competition).filter(
        and_(Competition.start_date <= body.end_date, Competition.end_date >= body.start_date)
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail=f"Challenge overlaps with '{overlap.name}'")

    comp = Competition(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        end_date=body.end_date,
        evaluation_time=body.evaluation_time,
        classification_schema=[f.model_dump() for f in body.classification_schema],
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/competitions/{competition_id}", response_model=CompetitionOut)
def update_competition(
    competition_id: int,
    body: CompetitionUpdate,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    new_start = body.start_date if body.start_date is not None else comp.start_date
    new_end = body.end_date if body.end_date is not None else comp.end_date

    if body.start_date is not None and body.start_date != comp.start_date:
        if comp.start_date <= date.today():
            raise HTTPException(status_code=400, detail="Cannot change start date of a challenge that has already started.")

    overlap = db.query(Competition).filter(
        and_(Competition.id != competition_id, Competition.start_date <= new_end, Competition.end_date >= new_start)
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail=f"Challenge dates overlap with '{overlap.name}'")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "classification_schema" and value is not None:
            value = [f.model_dump() if hasattr(f, "model_dump") else f for f in value]
        setattr(comp, field, value)

    db.commit()
    db.refresh(comp)
    return comp


@router.post("/competitions/{competition_id}/upload-training")
async def upload_training_data(
    competition_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    training_dir = os.path.join(settings.DATA_DIR, "training")
    os.makedirs(training_dir, exist_ok=True)
    file_path = os.path.join(training_dir, f"comp_{competition_id}_{file.filename}")

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    comp.training_data_path = file_path
    db.commit()
    return {"detail": "Training data uploaded", "path": file_path}


@router.post("/competitions/{competition_id}/upload-test")
async def upload_test_data(
    competition_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    test_dir = os.path.join(settings.DATA_DIR, "test")
    os.makedirs(test_dir, exist_ok=True)
    file_path = os.path.join(test_dir, f"comp_{competition_id}_{file.filename}")

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            count = 0
            for item in z.infolist():
                if item.is_dir(): continue
                if item.filename.endswith('.csv'): continue
                if '__MACOSX' in item.filename or '.DS_Store' in item.filename: continue
                count += 1
        comp.test_data_count = count
    except Exception:
        pass

    comp.test_data_path = file_path
    db.commit()
    return {"detail": "Test data uploaded", "path": file_path, "count": comp.test_data_count}


@router.post("/reset-semester")
def reset_semester(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    db.query(Team).update({"total_points": 0})
    db.query(DailyScore).delete()
    db.query(Submission).delete()
    yesterday = date.today() - timedelta(days=1)
    # End all currently active or upcoming challenges
    db.query(Competition).filter(Competition.end_date >= date.today()).update({"end_date": yesterday})
    db.commit()
    return {"detail": "Semester reset complete"}

@router.delete("/competitions/{competition_id}")
def delete_competition(
    competition_id: int,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    db.query(DailyScore).filter(DailyScore.competition_id == competition_id).delete()
    db.query(Submission).filter(Submission.competition_id == competition_id).delete()
    db.delete(comp)
    db.commit()
    return {"detail": "Competition deleted"}
