import os
from datetime import datetime
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


@router.get("/active", response_model=CompetitionOut | None)
def get_active_competition(db: Session = Depends(get_db)):
    comp = db.query(Competition).filter(Competition.is_active).order_by(Competition.start_date.desc()).first()
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


@router.get("/{competition_id}/test-data/next")
def download_next_test_data(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    now = datetime.now()
    try:
        evaluation_time = datetime.strptime(comp.evaluation_time, "%H:%M").time()
        evaluation_dates = sorted({
            datetime.strptime(day.strip(), "%Y-%m-%d").date()
            for day in (comp.evaluation_days or "").split(",")
            if day.strip()
        })
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid evaluation schedule")

    next_date = next((
        day for day in evaluation_dates
        if day > now.date() or (day == now.date() and evaluation_time > now.time())
    ), None)
    if next_date is None:
        raise HTTPException(status_code=404, detail="No upcoming evaluation day")

    date_key = next_date.isoformat()
    data_path = (comp.evaluation_datasets or {}).get(date_key, {}).get("unlabeled")
    if not data_path or not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail=f"Unlabeled test data not available for {date_key}")

    return FileResponse(
        data_path,
        filename=f"{comp.name}_test_data_{date_key}.zip",
    )


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
