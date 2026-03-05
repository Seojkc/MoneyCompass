from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_db
from app.models import UserDebt
from app.schemas.user_debt import UserDebtOut, UserDebtCreate, UserDebtPatch

router = APIRouter(prefix="/user-debts", tags=["user_debts"])


@router.get("", response_model=list[UserDebtOut])
def list_debts(
    db: Session = Depends(get_db),
    user_id: str = Query(...),
    step_key: str = Query(...),
):
    return (
        db.query(UserDebt)
        .filter(UserDebt.user_id == user_id, UserDebt.step_key == step_key)
        .order_by(UserDebt.updated_at.desc())
        .all()
    )


@router.post("", response_model=UserDebtOut)
def create_debt(payload: UserDebtCreate, db: Session = Depends(get_db)):
    row = UserDebt(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{debt_id}", response_model=UserDebtOut)
def patch_debt(debt_id: UUID, payload: UserDebtPatch, db: Session = Depends(get_db)):
    row = db.query(UserDebt).filter(UserDebt.id == debt_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Debt not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if v is not None:
            setattr(row, k, v)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{debt_id}")
def delete_debt(debt_id: UUID, db: Session = Depends(get_db)):
    row = db.query(UserDebt).filter(UserDebt.id == debt_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Debt not found")

    db.delete(row)
    db.commit()
    return {"deleted": True, "id": str(debt_id)}