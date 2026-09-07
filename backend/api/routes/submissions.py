from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import date

from api.dependencies import get_db
from api.auth import get_current_user
from api.models.submission import Submission
from api.models.competition import Competition
from api.schemas.submission import SubmissionOut

router = APIRouter(prefix="/api/competitions", tags=["submissions"])

import os
import shutil
import time
from api.config import settings


@router.post("/{competition_id}/submit", response_model=SubmissionOut)
def submit_model(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    if not file.filename.endswith(".onnx"):
        raise HTTPException(status_code=400, detail="Please upload an .onnx file")
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

    submissions_dir = os.path.join(settings.DATA_DIR, "submissions")
    os.makedirs(submissions_dir, exist_ok=True)
    timestamp = int(time.time())

    file_name = f"onnx_model_team_{current_user['team_id']}_{timestamp}.onnx"
    
    file_path = os.path.join(submissions_dir, file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    submission = Submission(
        team_id=current_user["team_id"],
        competition_id=competition_id,
        file_path=file_path,
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
