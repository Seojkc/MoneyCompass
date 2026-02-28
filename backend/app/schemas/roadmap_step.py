from pydantic import BaseModel, Field
from uuid import UUID

class RoadmapStepBase(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    subtitle: str = Field(min_length=1, max_length=250)
    description: str | None = None
    step_order: int = Field(ge=1)
    is_active: bool = True

class RoadmapStepCreate(RoadmapStepBase):
    pass

class RoadmapStepUpdate(BaseModel):
    key: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    step_order: int | None = Field(default=None, ge=1)
    is_active: bool | None = None

class RoadmapStepOut(RoadmapStepBase):
    id: UUID

    class Config:
        from_attributes = True