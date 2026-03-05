from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID

class UserStepMetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: str
    step_key: str
    metric_key: str
    value_num: float
    value_text: str | None = None

class UserStepMetricUpsert(BaseModel):
    user_id: str
    step_key: str
    metric_key: str = Field(min_length=1, max_length=80)
    value_num: float
    value_text: str | None = None