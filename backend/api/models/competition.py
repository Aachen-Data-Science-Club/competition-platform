from sqlalchemy import Column, Integer, String, Text, Date, DateTime, JSON, func
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import date
from sqlalchemy import and_

from api.models.database import Base


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, default="")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    evaluation_time = Column(String(5), default="20:00")
    required_predictions = Column(JSON, nullable=False)
    evaluation_days = Column(String(512), default="")
    evaluation_datasets = Column(JSON, default={})
    training_data_path = Column(String(512), default="")
    test_data_path = Column(String(512), default="")
    test_data_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    @property
    def classification_schema(self):
        return self.required_predictions

    @hybrid_property
    def is_active(self):
        today = date.today()
        return self.start_date <= today <= self.end_date

    @is_active.expression
    def is_active(cls):
        today = date.today()
        return and_(cls.start_date <= today, cls.end_date >= today)
