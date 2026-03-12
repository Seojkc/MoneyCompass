


from fastapi import FastAPI
from app.db.session import Base, engine
from app import models  # make sure models are registered before create_all
from app.api.entries import router as entries_router
from fastapi.middleware.cors import CORSMiddleware
import os
from app.api.roadmap_steps import router as roadmap_steps_router
from app.api.user_steps_progress import router as user_steps_progress_router
from app.api.user_step_metrics import router as user_step_metrics_router
from app.api.analytics import router as analytics_router
from app.api.user_roadmap import router as  user_roadmap_router
from app.api.user_debts import router as user_debts_router
from app.api.user_saving_goals import router as user_saving_goals
from app.api.user_investments import router as user_investments_router


print("✅ RUNNING FASTAPI MAIN.PY FROM:", os.path.abspath(__file__))





app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.50.48:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(entries_router)
app.include_router(roadmap_steps_router)
app.include_router(user_steps_progress_router)
app.include_router(user_step_metrics_router)
app.include_router(analytics_router)
app.include_router(user_roadmap_router)
app.include_router(user_debts_router)
app.include_router(user_saving_goals)
app.include_router(user_investments_router)
