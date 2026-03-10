from uuid import UUID
from pydantic import BaseModel, ConfigDict


class UserSavingGoalBase(BaseModel):
    user_id: str
    step_key: str = "automate"
    name: str
    saved: float
    target: float
    monthly: float


class UserSavingGoalCreate(UserSavingGoalBase):
    pass


class UserSavingGoalPatch(BaseModel):
    saved: float | None = None
    target: float | None = None
    monthly: float | None = None


class UserSavingGoalOut(UserSavingGoalBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID