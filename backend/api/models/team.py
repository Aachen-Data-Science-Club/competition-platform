from sqlalchemy import Column, Integer, String, DateTime, func

from api.models.database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    total_points = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
