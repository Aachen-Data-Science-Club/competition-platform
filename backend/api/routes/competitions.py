import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.auth import get_current_user
from api.models.competition import Competition
from api.models.score import DailyScore
from api.schemas.competition import CompetitionOut
from api.schemas.leaderboard import DailyScoreOut
from api.config import settings

router = APIRouter(prefix="/api/competitions", tags=["competitions"])


@router.get("/", response_model=list[CompetitionOut])
def list_competitions(db: Session = Depends(get_db)):
    return db.query(Competition).order_by(Competition.start_date.desc()).all()


from datetime import date
from sqlalchemy import and_

@router.get("/active", response_model=CompetitionOut | None)
def get_active_competition(db: Session = Depends(get_db)):
    comp = db.query(Competition).filter(
        and_(Competition.start_date <= date.today(), Competition.end_date >= date.today())
    ).first()
    if not comp:
        return None
    return comp


@router.get("/{competition_id}", response_model=CompetitionOut)
def get_competition(competition_id: int, db: Session = Depends(get_db)):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    return comp


@router.get("/{competition_id}/training-data")
def download_training_data(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if not comp.training_data_path or not os.path.exists(comp.training_data_path):
        raise HTTPException(status_code=404, detail="Training data not available")
    return FileResponse(comp.training_data_path, filename=f"{comp.name}_training_data.zip")


@router.get("/{competition_id}/my-scores", response_model=list[DailyScoreOut])
def get_my_scores(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scores = db.query(DailyScore).filter(
        DailyScore.team_id == current_user["team_id"],
        DailyScore.competition_id == competition_id,
    ).order_by(DailyScore.date).all()
    return scores
