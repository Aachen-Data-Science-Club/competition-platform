from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func

from api.models.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    competition_id = Column(Integer, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(512), nullable=False)
    code_path = Column(String(512), nullable=True)
    submitted_at = Column(DateTime, server_default=func.now())
