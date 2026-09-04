from pydantic import BaseModel, field_validator
import re


class MemberOut(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True


class TeamOut(BaseModel):
    id: int
    name: str
    total_points: int
    members: list[MemberOut] = []

    class Config:
        from_attributes = True


class TeamCreateResult(TeamOut):
    emails_sent: int = 0
    email_failures: list[str] = []
    codes: list[dict] = []


class MemberCreateResult(MemberOut):
    email_sent: bool = False
    codes: list[dict] = []


class TeamNameUpdate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not re.match(r"^[a-zA-Z0-9]+$", v):
            raise ValueError("Team name must only contain letters and numbers")
        if len(v) < 2 or len(v) > 64:
            raise ValueError("Team name must be between 2 and 64 characters")
        return v


class MemberCreate(BaseModel):
    name: str
    email: str


class TeamCreate(BaseModel):
    name: str
    members: list[MemberCreate]

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not re.match(r"^[a-zA-Z0-9]+$", v):
            raise ValueError("Team name must only contain letters and numbers")
        if len(v) < 2 or len(v) > 64:
            raise ValueError("Team name must be between 2 and 64 characters")
        return v
