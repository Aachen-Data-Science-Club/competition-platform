from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, JSON, func

from api.models.database import Base


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, default="")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    evaluation_time = Column(String(5), default="20:00")
    is_active = Column(Boolean, default=False)
    classification_schema = Column(JSON, nullable=False)
    training_data_path = Column(String(512), default="")
    test_data_path = Column(String(512), default="")
    test_data_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
