from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import UserStepProgress
from app.schemas.user_step_progress import UserStepProgressOut, UserStepProgressUpsert

router = APIRouter(prefix="/user-steps-progress", tags=["user_steps_progress"])

@router.get("", response_model=list[UserStepProgressOut])
def list_user_progress(
    db: Session = Depends(get_db),
    user_id: str = Query(...),
):
    return (
        db.query(UserStepProgress)
        .filter(UserStepProgress.user_id == user_id)
        .order_by(UserStepProgress.updated_at.desc())
        .all()
    )

@router.get("/{step_key}", response_model=UserStepProgressOut)
def get_step_progress(
    step_key: str,
    db: Session = Depends(get_db),
    user_id: str = Query(...),
):
    row = (
        db.query(UserStepProgress)
        .filter(UserStepProgress.user_id == user_id, UserStepProgress.step_key == step_key)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Progress not found")
    return row

@router.put("", response_model=UserStepProgressOut)
def upsert_step_progress(payload: UserStepProgressUpsert, db: Session = Depends(get_db)):
    row = (
        db.query(UserStepProgress)
        .filter(UserStepProgress.user_id == payload.user_id, UserStepProgress.step_key == payload.step_key)
        .first()
    )

    if row:
        row.progress = payload.progress
    else:
        row = UserStepProgress(**payload.model_dump())
        db.add(row)

    db.commit()
    db.refresh(row)
    return row

@router.delete("/{step_key}")
def delete_step_progress(
    step_key: str,
    db: Session = Depends(get_db),
    user_id: str = Query(...),
):
    row = (
        db.query(UserStepProgress)
        .filter(UserStepProgress.user_id == user_id, UserStepProgress.step_key == step_key)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Progress not found")

    db.delete(row)
    db.commit()
    return {"deleted": True, "user_id": user_id, "step_key": step_key}