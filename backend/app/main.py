from fastapi import FastAPI
from app.db.session import Base, engine
from app import models  # make sure models are registered before create_all
from app.api.entries import router as entries_router


Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(entries_router)