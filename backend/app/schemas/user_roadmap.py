from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class UserRoadmapStepOut(BaseModel):
    id: UUID
    key: str
    title: str
    subtitle: str
    description: str | None = None
    step_order: int
    is_active: bool

    progress: int
    progress_updated_at: datetime | None = None

    class Config:
        from_attributes = True