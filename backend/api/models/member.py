from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func

from api.models.database import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    email = Column(String(256), nullable=False)
    access_code = Column(String(128), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
