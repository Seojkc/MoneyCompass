from fastapi import FastAPI
from app.db.session import Base, engine, SessionLocal
from app import models  # make sure models are registered before create_all
from app.models import RoadmapStep
from app.api.entries import router as entries_router
from fastapi.middleware.cors import CORSMiddleware
import os
from app.api.roadmap_steps import router as roadmap_steps_router
from app.api.user_steps_progress import router as user_steps_progress_router
from app.api.user_step_metrics import router as user_step_metrics_router
from app.api.analytics import router as analytics_router
from app.api.user_roadmap import router as user_roadmap_router
from app.api.user_debts import router as user_debts_router
from app.api.user_saving_goals import router as user_saving_goals
from app.api.user_investments import router as user_investments_router
from app.api.users import router as users_router
from sqlalchemy.orm import Session

print("✅ RUNNING FASTAPI MAIN.PY FROM:", os.path.abspath(__file__))

app = FastAPI()


def seed_roadmap_steps():
    db: Session = SessionLocal()
    try:
        existing = db.query(RoadmapStep).first()
        if existing:
            return

        steps = [
            {
                "key": "starter-fund",
                "title": "Starter Emergency Fund",
                "subtitle": "Build your first safety cushion",
                "step_order": 1,
            },
            {
                "key": "debt",
                "title": "Eliminate High-Interest Debt",
                "subtitle": "Reduce costly debt faster",
                "step_order": 2,
            },
            {
                "key": "insurance",
                "title": "Insurance",
                "subtitle": "Protect against major financial risks",
                "step_order": 3,
            },
            {
                "key": "full-fund",
                "title": "Full Emergency Fund",
                "subtitle": "Save 3 to 6 months of essential expenses",
                "step_order": 4,
            },
            {
                "key": "automate",
                "title": "Automate Saving",
                "subtitle": "Make saving consistent and effortless",
                "step_order": 5,
            },
            {
                "key": "invest",
                "title": "Invest",
                "subtitle": "Grow your money for the long term",
                "step_order": 6,
            },
            {
                "key": "income",
                "title": "Increase Income",
                "subtitle": "Create more room to build wealth",
                "step_order": 7,
            },
        ]

        for step in steps:
            db.add(RoadmapStep(**step))

        db.commit()
        print("✅ Seeded roadmap_steps")
    except Exception as e:
        db.rollback()
        print("❌ Error seeding roadmap_steps:", e)
        raise
    finally:
        db.close()


Base.metadata.create_all(bind=engine)
seed_roadmap_steps()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.50.48:3000",
        "http://127.0.0.1:3000",
        "https://money-compass-bgx7ic46s-seojkcs-projects.vercel.app/",
        "https://money-compass-navy.vercel.app/"
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
app.include_router(users_router)