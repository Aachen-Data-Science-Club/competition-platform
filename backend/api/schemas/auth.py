from pydantic import BaseModel


class LoginRequest(BaseModel):
    access_code: str


class LoginResponse(BaseModel):
    token: str
    team_id: int
    team_name: str
    member_name: str
    is_admin: bool
