from pydantic import BaseModel
from datetime import date
from typing import Any


class DailyScoreOut(BaseModel):
    date: date
    points: int
    details: dict[str, Any] = {}

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    team_id: int
    team_name: str
    total_points: int
    is_current_team: bool = False


class CompetitionLeaderboardEntry(BaseModel):
    rank: int
    team_id: int
    team_name: str
    competition_points: int
    is_current_team: bool = False
