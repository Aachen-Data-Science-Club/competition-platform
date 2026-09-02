from pydantic import BaseModel
from datetime import date
from typing import Any


class ClassificationField(BaseModel):
    field: str
    type: str
    min: int | None = None
    max: int | None = None


class CompetitionOut(BaseModel):
    id: int
    name: str
    description: str
    start_date: date
    end_date: date
    evaluation_time: str
    is_active: bool
    classification_schema: list[dict[str, Any]]
    test_data_count: int = 0

    class Config:
        from_attributes = True


class CompetitionCreate(BaseModel):
    name: str
    description: str = ""
    start_date: date
    end_date: date
    evaluation_time: str = "20:00"
    classification_schema: list[ClassificationField]


class CompetitionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    evaluation_time: str | None = None
    is_active: bool | None = None
    classification_schema: list[ClassificationField] | None = None
