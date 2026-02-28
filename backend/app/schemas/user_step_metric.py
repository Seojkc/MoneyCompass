from pydantic import BaseModel, Field
from uuid import UUID

class UserStepMetricOut(BaseModel):
    id: UUID
    user_id: str
    step_key: str
    metric_key: str
    value_num: float

    class Config:
        from_attributes = True

class UserStepMetricUpsert(BaseModel):
    user_id: str
    step_key: str
    metric_key: str = Field(min_length=1, max_length=80)
    value_num: float