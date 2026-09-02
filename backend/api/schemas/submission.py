from pydantic import BaseModel
from datetime import datetime


class SubmissionOut(BaseModel):
    id: int
    competition_id: int
    file_path: str
    submitted_at: datetime

    class Config:
        from_attributes = True
