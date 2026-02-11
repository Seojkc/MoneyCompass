from datetime import date
from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID

class EntryCreate(BaseModel):
    date: date
    type: Literal["income", "expense"]
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    currency: str = "CAD"
    notes: Optional[str] = None

class EntryUpdate(BaseModel):
    date: Optional[date] = None
    type: Optional[Literal["income", "expense"]] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    amount: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = None
    notes: Optional[str] = None

class EntryOut(BaseModel):
    id: UUID
    date: date
    year: int
    month: int
    type: str
    name: str
    category: str
    amount: float
    currency: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True
