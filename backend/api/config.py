import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./adsc.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ADMIN_ACCESS_CODE: str = "admin-secret-code"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    ENVIRONMENT: str = "development"
    DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
    CORS_ORIGINS: str = "http://localhost:5173"

    # Overwrite entries if exists
    class Config:
        env_file = ".env"


settings = Settings()
