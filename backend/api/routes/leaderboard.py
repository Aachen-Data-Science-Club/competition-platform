from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.dependencies import get_db
from api.auth import get_current_user
from api.models.team import Team
from api.models.score import DailyScore
from api.schemas.leaderboard import LeaderboardEntry, CompetitionLeaderboardEntry

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("/global", response_model=list[LeaderboardEntry])
def get_global_leaderboard(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teams = db.query(Team).order_by(Team.total_points.desc()).all()
    result = []
    for i, team in enumerate(teams):
        result.append(LeaderboardEntry(
            rank=i + 1,
            team_id=team.id,
            team_name=team.name,
            total_points=team.total_points,
            is_current_team=(team.id == current_user.get("team_id")),
        ))
    return result


@router.get("/competition/{competition_id}", response_model=list[CompetitionLeaderboardEntry])
def get_competition_leaderboard(
    competition_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scores = (
        db.query(
            DailyScore.team_id,
            func.sum(DailyScore.points).label("total"),
        )
        .filter(DailyScore.competition_id == competition_id)
        .group_by(DailyScore.team_id)
        .order_by(func.sum(DailyScore.points).desc())
        .all()
    )

    result = []
    for i, row in enumerate(scores):
        team = db.query(Team).filter(Team.id == row.team_id).first()
        if team:
            result.append(CompetitionLeaderboardEntry(
                rank=i + 1,
                team_id=team.id,
                team_name=team.name,
                competition_points=row.total,
                is_current_team=(team.id == current_user.get("team_id")),
            ))
    return result
