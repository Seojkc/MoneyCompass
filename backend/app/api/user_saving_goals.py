from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import UserSavingGoal
from app.schemas.user_saving_goal import (
    UserSavingGoalCreate,
    UserSavingGoalOut,
    UserSavingGoalPatch,
)

router = APIRouter(prefix="/user-saving-goals", tags=["user_saving_goals"])


@router.get("", response_model=list[UserSavingGoalOut])
def list_user_saving_goals(
    db: Session = Depends(get_db),
    user_id: str = Query(...),
    step_key: str = Query(default="automate"),
):
    return (
        db.query(UserSavingGoal)
        .filter(
            UserSavingGoal.user_id == user_id,
            UserSavingGoal.step_key == step_key,
        )
        .order_by(UserSavingGoal.created_at.asc())
        .all()
    )


@router.post("", response_model=UserSavingGoalOut)
def create_user_saving_goal(
    payload: UserSavingGoalCreate,
    db: Session = Depends(get_db),
):
    row = UserSavingGoal(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{goal_id}", response_model=UserSavingGoalOut)
def patch_user_saving_goal(
    goal_id: UUID,
    payload: UserSavingGoalPatch,
    db: Session = Depends(get_db),
):
    row = db.query(UserSavingGoal).filter(UserSavingGoal.id == goal_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Goal not found")

    patch = payload.model_dump(exclude_unset=True)

    for key, value in patch.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{goal_id}")
def delete_user_saving_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
):
    row = db.query(UserSavingGoal).filter(UserSavingGoal.id == goal_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(row)
    db.commit()
    return {"deleted": True, "id": str(goal_id)}