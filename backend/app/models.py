from sqlalchemy import Column, String, Date,CheckConstraint, Numeric, ForeignKey, Text, Integer,Boolean, DateTime,UniqueConstraint,DATETIME, func
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


class RoadmapStep(Base):
    __tablename__ = "roadmap_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(250), nullable=False)

    # Optional: longer text you can show in overlay later
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    step_order: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UserStepProgress(Base):
    __tablename__ = "user_steps_progress"

    __table_args__ = (
        UniqueConstraint("user_id", "step_key", name="uq_user_step"),
        CheckConstraint("progress >= 0 AND progress <= 100", name="ck_progress_0_100"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # NOTE: your users.id is String in your current model, so keep this as String.
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # step_key references roadmap_steps.key (string)
    step_key: Mapped[str] = mapped_column(String(80), ForeignKey("roadmap_steps.key", ondelete="CASCADE"), nullable=False, index=True)

    progress: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Optional relationships (not required, but nice)
    # user = relationship("User")
    # step = relationship("RoadmapStep", primaryjoin="UserStepProgress.step_key == RoadmapStep.key")
    
    
    
    

class UserStepMetric(Base):
    __tablename__ = "user_step_metrics"

    __table_args__ = (
        UniqueConstraint("user_id", "step_key", "metric_key", name="uq_user_step_metric"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # users.id is String in your current model
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # roadmap_steps.key is String
    step_key: Mapped[str] = mapped_column(String(80), ForeignKey("roadmap_steps.key", ondelete="CASCADE"), nullable=False, index=True)

    metric_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)

    # Store numeric metrics (money, percent, counts)
    value_num: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)