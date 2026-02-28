from pydantic import BaseModel, Field
from uuid import UUID

class UserStepProgressOut(BaseModel):
    id: UUID
    user_id: str
    step_key: str
    progress: int = Field(ge=0, le=100)

    class Config:
        from_attributes = True

class UserStepProgressUpsert(BaseModel):
    user_id: str
    step_key: str
    progress: int = Field(ge=0, le=100)