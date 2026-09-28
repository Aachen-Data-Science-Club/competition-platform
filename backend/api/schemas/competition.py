import re
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, field_validator, model_validator


_TIME_RE = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


def _check_time(v: str) -> str:
    if not _TIME_RE.fullmatch(v):
        raise ValueError("evaluation_time must be HH:MM")
    return v


class ClassificationField(BaseModel):
    field: str
    type: Literal["boolean", "range"]
    min: int | None = None
    max: int | None = None

    @model_validator(mode="after")
    def check_field(self):
        if not self.field.strip():
            raise ValueError("Field name must not be empty")
        if self.type == "range":
            if self.min is None or self.max is None:
                raise ValueError(f"Range field '{self.field}' needs both min and max")
            if self.min >= self.max:
                raise ValueError(f"Range field '{self.field}': min must be < max")
        else:
            # boolean fields carry no bounds; drop leftovers from a type switch
            self.min = self.max = None
        return self


def _validate_schema(fields: list[ClassificationField]) -> list[ClassificationField]:
    if not fields:
        raise ValueError("At least one output field is required")
    names = [f.field.strip() for f in fields]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate field names in the output format")
    return fields


class CompetitionOut(BaseModel):
    id: int
    name: str
    description: str
    start_date: date
    end_date: date
    evaluation_time: str
    is_active: bool
    evaluation_days: str = ""
    evaluation_datasets: dict = {}
    required_predictions: list[dict[str, Any]]
    test_data_count: int = 0

    class Config:
        from_attributes = True


class CompetitionCreate(BaseModel):
    name: str
    description: str = ""
    start_date: date
    end_date: date
    evaluation_time: str = "20:00"
    evaluation_days: str = ""
    required_predictions: list[ClassificationField]

    @field_validator("evaluation_time")
    @classmethod
    def check_time(cls, v):
        return _check_time(v)

    @model_validator(mode="after")
    def check(self):
        if not self.name.strip():
            raise ValueError("Name must not be empty")
        if self.end_date < self.start_date:
            raise ValueError("End date must not be before start date")
        _validate_schema(self.required_predictions)
        return self


class CompetitionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    evaluation_time: str | None = None
    evaluation_days: str | None = None
    required_predictions: list[ClassificationField] | None = None

    @field_validator("name")
    @classmethod
    def check_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Name must not be empty")
        return v

    @field_validator("evaluation_time")
    @classmethod
    def check_time(cls, v):
        return v if v is None else _check_time(v)

    @field_validator("required_predictions")
    @classmethod
    def check_schema(cls, v):
        return v if v is None else _validate_schema(v)
