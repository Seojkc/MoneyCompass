from sqlalchemy import Column, Integer, String, Float, Date, Enum
from .base import Base
import enum

class EntryType(str, enum.Enum):
    income = "income"
    expense = "expense"

class Entry(Base):
    __tablename__ = "entries"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(EntryType), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
