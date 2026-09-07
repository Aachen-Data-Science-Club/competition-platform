from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.config import settings

from api.models import Base
from api.models.database import engine
from api.routes import (
    auth_router,
    teams_router,
    competitions_router,
    submissions_router,
    leaderboard_router,
    admin_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="ADSC Competition Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(teams_router)
app.include_router(competitions_router)
app.include_router(submissions_router)
app.include_router(leaderboard_router)
app.include_router(admin_router)