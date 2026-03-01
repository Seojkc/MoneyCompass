from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, and_

from app.api.deps import get_db
from app.models import Entry

router = APIRouter(prefix="/analytics", tags=["analytics"])

def ym_to_index(y: int, m: int) -> int:
    return y * 12 + (m - 1)

@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    months: int = Query(3, ge=1, le=24),
):
    # Anchor to latest data month (so March with only Jan/Feb still uses Feb as anchor)
    latest = (
        db.query(Entry.year, Entry.month)
        .filter(Entry.is_deleted == False)  # noqa: E712
        .order_by(Entry.year.desc(), Entry.month.desc())
        .first()
    )

    if not latest:
        return {
            "months_requested": months,
            "months_used": 0,
            "avg_income_per_month": 0,
            "avg_expense_per_month": 0,
            "savings_rate": 0,
        }

    anchor_year, anchor_month = int(latest[0]), int(latest[1])

    end_idx = ym_to_index(anchor_year, anchor_month)
    start_idx = end_idx - (months - 1)

    ym_idx = (Entry.year * 12 + (Entry.month - 1))

    base_filter = and_(
        Entry.is_deleted == False,  # noqa: E712
        ym_idx >= start_idx,
        ym_idx <= end_idx,
    )

    # months_used = how many distinct months exist in the window
    months_used = (
        db.query(func.count(distinct(ym_idx)))
        .filter(base_filter)
        .scalar()
    )
    months_used = int(months_used or 0)

    if months_used == 0:
        return {
            "months_requested": months,
            "months_used": 0,
            "avg_income_per_month": 0,
            "avg_expense_per_month": 0,
            "savings_rate": 0,
        }

    income_sum = (
        db.query(func.coalesce(func.sum(Entry.amount), 0))
        .filter(base_filter, Entry.type == "income")
        .scalar()
    )
    expense_sum = (
        db.query(func.coalesce(func.sum(Entry.amount), 0))
        .filter(base_filter, Entry.type == "expense")
        .scalar()
    )

    income_sum = float(income_sum or 0)
    expense_sum = float(expense_sum or 0)

    # ✅ divide by months that exist, NOT requested months
    avg_income = income_sum / months_used
    avg_expense = expense_sum / months_used

    savings = max(avg_income - avg_expense, 0)
    savings_rate = (savings / avg_income * 100) if avg_income > 0 else 0

    return {
        "months_requested": months,
        "months_used": months_used,
        "avg_income_per_month": avg_income,
        "avg_expense_per_month": avg_expense,
        "savings_rate": savings_rate,
        "anchor": {"year": anchor_year, "month": anchor_month},
    }