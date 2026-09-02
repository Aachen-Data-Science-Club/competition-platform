from api.routes.auth import router as auth_router
from api.routes.teams import router as teams_router
from api.routes.competitions import router as competitions_router
from api.routes.submissions import router as submissions_router
from api.routes.leaderboard import router as leaderboard_router
from api.routes.admin import router as admin_router

__all__ = [
    "auth_router",
    "teams_router",
    "competitions_router",
    "submissions_router",
    "leaderboard_router",
    "admin_router",
]
