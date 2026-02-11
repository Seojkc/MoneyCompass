from sqlalchemy import Column, String, Date, Numeric, ForeignKey, Text, Integer,Boolean, DateTime,UniqueConstraint,DATETIME, func
from sqlalchemy.orm import relationship
from app.db.session import Base
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

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

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  user = relationship("User", back_populates="entries")
  date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
  year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
  month: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  
  type: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  
  name: Mapped[str] = mapped_column(String(200), nullable=False)
  category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
  amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)  
  currency: Mapped[str] = mapped_column(String(8), nullable=False, server_default="CAD")
  notes: Mapped[str | None] = mapped_column(Text, nullable=True)
  is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
  created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
  updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)



