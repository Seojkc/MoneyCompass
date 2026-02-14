from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_db
from app.models import Entry
from app.schemas.entry import EntryCreate, EntryUpdate, EntryOut

router = APIRouter(prefix="/entries", tags=["entries"])


@router.get("", response_model=list[EntryOut])
def list_entries(
    db: Session = Depends(get_db),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    type: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    q = db.query(Entry)  # noqa: E712

    if year is not None:
        q = q.filter(Entry.year == year)
    if month is not None:
        q = q.filter(Entry.month == month)
    if type is not None:
        q = q.filter(Entry.type == type)

    return q.order_by(Entry.date.desc()).limit(limit).all()


@router.post("", response_model=EntryOut)
def create_entry(payload: EntryCreate, db: Session = Depends(get_db)):
    y = payload.date.year
    m = payload.date.month

    entry = Entry(
        date=payload.date,
        year=y,
        month=m,
        type=payload.type,
        name=payload.name,
        category=payload.category,
        amount=payload.amount,
        currency=payload.currency,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(entry_id: UUID, payload: EntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_deleted == False).first()  # noqa: E712
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    data = payload.model_dump(exclude_unset=True)

    # If date changes, recalc month/year
    if "date" in data and data["date"] is not None:
        data["year"] = data["date"].year
        data["month"] = data["date"].month

    for k, v in data.items():
        setattr(entry, k, v)

    db.commit()
    db.refresh(entry)
    return entry
@router.put("/{entry_id}", response_model=EntryOut)
def replace_entry(
    entry_id: UUID,
    payload: EntryCreate,   # PUT should take the full create schema
    db: Session = Depends(get_db),
):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # overwrite all fields
    entry.date = payload.date
    entry.type = payload.type
    entry.name = payload.name
    entry.category = payload.category
    entry.amount = payload.amount
    entry.currency = payload.currency
    entry.notes = payload.notes

    # keep year/month in sync with date
    entry.year = payload.date.year
    entry.month = payload.date.month

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_entry(entry_id: UUID, db: Session = Depends(get_db)):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    db.delete(entry)
    db.commit()
    return {"deleted": True, "id": str(entry_id), "mode": "hard"}