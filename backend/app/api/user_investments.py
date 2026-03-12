from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import UserInvestment
from app.schemas.user_investments import (
    UserInvestmentCreate,
    UserInvestmentPatch,
    UserInvestmentOut,
)
router = APIRouter(prefix="/user-investments", tags=["user_investments"])


@router.get("", response_model=list[UserInvestmentOut])
def list_user_investments(
    db: Session = Depends(get_db),
    user_id: str = Query(...),
    step_key: str = Query(default="invest"),
):
    return (
        db.query(UserInvestment)
        .filter(
            UserInvestment.user_id == user_id,
            UserInvestment.step_key == step_key,
        )
        .order_by(UserInvestment.updated_at.desc())
        .all()
    )


@router.post("", response_model=UserInvestmentOut)
def create_user_investment(payload: UserInvestmentCreate, db: Session = Depends(get_db)):
    row = UserInvestment(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{investment_id}", response_model=UserInvestmentOut)
def patch_user_investment(investment_id: str, payload: UserInvestmentPatch, db: Session = Depends(get_db)):
    row = db.query(UserInvestment).filter(UserInvestment.id == investment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Investment not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{investment_id}")
def delete_user_investment(investment_id: str, db: Session = Depends(get_db)):
    row = db.query(UserInvestment).filter(UserInvestment.id == investment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Investment not found")

    db.delete(row)
    db.commit()
    return {"deleted": True, "id": investment_id}