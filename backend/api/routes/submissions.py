from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import date

from api.dependencies import get_db
from api.auth import get_current_user
from api.models.submission import Submission
from api.models.competition import Competition
from api.schemas.submission import SubmissionOut

router = APIRouter(prefix="/api/competitions", tags=["submissions"])


@router.post("/{competition_id}/submit", response_model=SubmissionOut)
def submit_model(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if not comp.is_active:
        raise HTTPException(status_code=400, detail="Competition is not active")

    today = date.today()
    existing_today = db.query(Submission).filter(
        Submission.team_id == current_user["team_id"],
        Submission.competition_id == competition_id,
    ).all()

    todays_submissions = [s for s in existing_today if s.submitted_at.date() == today]
    if len(todays_submissions) >= 1:
        raise HTTPException(status_code=400, detail="Daily upload limit reached (1 per day)")

    submission = Submission(
        team_id=current_user["team_id"],
        competition_id=competition_id,
        file_path="placeholder_onnx_path.onnx",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{competition_id}/my-submissions", response_model=list[SubmissionOut])
def get_my_submissions(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Submission).filter(
        Submission.team_id == current_user["team_id"],
        Submission.competition_id == competition_id,
    ).order_by(Submission.submitted_at.desc()).all()
