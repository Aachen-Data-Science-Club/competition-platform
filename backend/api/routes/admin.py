import os
import re
import secrets
import shutil
import zipfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
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
from ml.evaluator import run_single_evaluation


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


@router.post("/competitions", response_model=CompetitionOut)
def create_competition(
    body: CompetitionCreate,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.start_date < date.today():
        raise HTTPException(status_code=400, detail="Start date must not be in the past")

    overlap = db.query(Competition).filter(
        and_(Competition.start_date <= body.end_date, Competition.end_date >= body.start_date)
    ).first()
    if overlap:
        raise HTTPException(
            status_code=400,
            detail=(f"Challenge overlaps with '{overlap.name}' "
                    f"({overlap.start_date} – {overlap.end_date}). "
                    f"Earliest possible start: {overlap.end_date + timedelta(days=1)}."),
        )

    comp = Competition(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        end_date=body.end_date,
        evaluation_time=body.evaluation_time,
        evaluation_days=body.evaluation_days,
        required_predictions=[f.model_dump() for f in body.required_predictions],
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

    if new_end < new_start:
        raise HTTPException(status_code=400, detail="End date must not be before start date")

    if body.start_date is not None and body.start_date != comp.start_date:
        if comp.start_date <= date.today():
            raise HTTPException(status_code=400, detail="Cannot change start date of a challenge that has already started.")

    if body.end_date is not None and body.end_date != comp.end_date:
        if comp.start_date <= date.today() and body.end_date < date.today():
            raise HTTPException(
                status_code=400,
                detail="Cannot set the end date of a running challenge into the past. "
                       "Set it to today to end it, or delete the challenge.",
            )

    # only check overlaps when the dates actually change; after a reset, ended
    # challenges share the same dates and could otherwise never be edited again
    if new_start != comp.start_date or new_end != comp.end_date:
        overlap = db.query(Competition).filter(
            and_(Competition.id != competition_id, Competition.start_date <= new_end, Competition.end_date >= new_start)
        ).first()
        if overlap:
            raise HTTPException(
                status_code=400,
                detail=f"Challenge dates overlap with '{overlap.name}' ({overlap.start_date} – {overlap.end_date})",
            )

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "required_predictions" and value is not None:
            value = [f.model_dump() if hasattr(f, "model_dump") else f for f in value]
        setattr(comp, field, value)

    db.commit()
    db.refresh(comp)
    return comp


def _save_zip(upload: UploadFile, subdir: str, competition_id: int) -> str:
    name = os.path.basename(upload.filename or "")
    if not name.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)

    target_dir = os.path.join(settings.DATA_DIR, subdir)
    os.makedirs(target_dir, exist_ok=True)
    path = os.path.join(target_dir, f"comp_{competition_id}_{name}")
    with open(path, "wb") as f:
        shutil.copyfileobj(upload.file, f)

    if not zipfile.is_zipfile(path):
        os.remove(path)
        raise HTTPException(status_code=400, detail="File is not a valid .zip archive")
    return path


def _replace_file(old_path: str | None, new_path: str | None):
    if old_path and old_path != new_path and os.path.exists(old_path):
        os.remove(old_path)


@router.post("/competitions/{competition_id}/upload-training")
def upload_training_data(
    competition_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    file_path = _save_zip(file, "training", competition_id)
    old_path = comp.training_data_path
    comp.training_data_path = file_path
    db.commit()
    _replace_file(old_path, file_path)
    return {"detail": "Training data uploaded", "path": file_path}


@router.post("/competitions/{competition_id}/upload-test")
def upload_test_data(
    competition_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    file_path = _save_zip(file, "test", competition_id)

    count = 0
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            for item in z.infolist():
                if item.is_dir(): continue
                if item.filename.endswith('.csv'): continue
                if '__MACOSX' in item.filename or '.DS_Store' in item.filename: continue
                count += 1
        comp.test_data_count = count
    except Exception:
        pass

    old_path = comp.test_data_path
    comp.test_data_path = file_path
    db.commit()
    _replace_file(old_path, file_path)
    return {"detail": "Test data uploaded", "path": file_path, "count": count}

@router.post("/competitions/{competition_id}/upload-day-data/{eval_date}/{data_type}")
def upload_day_data(
    competition_id: int,
    eval_date: str,
    data_type: str,
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
        
    if data_type not in ["labeled", "unlabeled"]:
        raise HTTPException(status_code=400, detail="data_type must be labeled or unlabeled")

    file_path = _save_zip(file, f"day_{data_type}_{eval_date}", competition_id)

    datasets = dict(comp.evaluation_datasets or {})
    if eval_date not in datasets:
        datasets[eval_date] = {}
    
    old_path = datasets[eval_date].get(data_type)
    datasets[eval_date][data_type] = file_path
    
    comp.evaluation_datasets = datasets
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(comp, "evaluation_datasets")
    
    db.commit()
    _replace_file(old_path, file_path)
    return {"detail": "Data uploaded", "path": file_path}


@router.post("/reset-semester")
def reset_semester(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    db.query(Team).update({"total_points": 0})
    db.query(DailyScore).delete()
    db.query(Submission).delete()
    today = date.today()
    yesterday = today - timedelta(days=1)

    # End all challenges instead of deleting them: running ones end yesterday,
    # upcoming ones get start = end = yesterday (otherwise end_date < start_date).
    db.query(Competition).filter(
        Competition.start_date < today, Competition.end_date >= today
    ).update({"end_date": yesterday}, synchronize_session=False)
    db.query(Competition).filter(
        Competition.start_date >= today
    ).update({"start_date": yesterday, "end_date": yesterday}, synchronize_session=False)

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
    old_files = [comp.training_data_path, comp.test_data_path]
    db.delete(comp)
    db.flush()

    # rebuild total_points from the remaining daily scores
    totals = dict(
        db.query(DailyScore.team_id, func.sum(DailyScore.points))
          .group_by(DailyScore.team_id).all()
    )
    for team in db.query(Team).all():
        team.total_points = int(totals.get(team.id) or 0)

    db.commit()
    for path in old_files:
        _replace_file(path, None)
    return {"detail": "Competition deleted"}

@router.get("/evaluate")
def evaluate(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    active_comp = db.query(Competition).filter(Competition.is_active).first()
    if not active_comp:
        raise HTTPException(status_code=400, detail="No active competition found")
    run_single_evaluation(db, active_comp)
    return {"detail": "Evaluation triggered successfully"}

from api.models.submission import Submission
from fastapi.responses import FileResponse
import os

@router.get("/teams/{team_id}/submissions")
def get_team_submissions(
    team_id: int, admin: dict = Depends(require_admin), db: Session = Depends(get_db)
):
    submissions = db.query(Submission).filter(Submission.team_id == team_id).order_by(Submission.submitted_at.desc()).all()
    return [{"id": s.id, "submitted_at": s.submitted_at, "competition_id": s.competition_id, "has_code": bool(s.code_path and os.path.exists(s.code_path))} for s in submissions]

@router.get("/submissions/{submission_id}/code")
def download_submission_code(
    submission_id: int, admin: dict = Depends(require_admin), db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not sub.code_path or not os.path.exists(sub.code_path):
        raise HTTPException(status_code=404, detail="Code file not found")
    return FileResponse(sub.code_path, media_type="application/zip", filename=os.path.basename(sub.code_path))
