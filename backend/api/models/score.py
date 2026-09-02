from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, JSON, func

from api.models.database import Base


class DailyScore(Base):
    __tablename__ = "daily_scores"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    competition_id = Column(Integer, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    points = Column(Integer, default=0)
    details = Column(JSON, default=dict)
