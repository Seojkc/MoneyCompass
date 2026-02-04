from sqlalchemy import Column, String, Date, Numeric, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base
import uuid

def uuid_str():
  return str(uuid.uuid4())

class User(Base):
  __tablename__ = "users"

  id = Column(String, primary_key=True, default=uuid_str)
  email = Column(String, unique=True, nullable=False, index=True)
  hashed_password = Column(String, nullable=False)

  entries = relationship("Entry", back_populates="user", cascade="all, delete-orphan")


class Entry(Base):
  __tablename__ = "entries"

  id = Column(String, primary_key=True, default=uuid_str)
  user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

  type = Column(String, nullable=False)        # "income" | "expense"
  name = Column(Text, nullable=False)
  category = Column(String, nullable=False)
  amount = Column(Numeric(12, 2), nullable=False)  # store positive numbers
  date = Column(Date, nullable=False)

  user = relationship("User", back_populates="entries")
