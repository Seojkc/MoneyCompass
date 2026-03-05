from pydantic import BaseModel, ConfigDict
from uuid import UUID

class UserDebtOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: str
    step_key: str
    name: str
    interest_pct: float
    balance: float
    total_payment: float


class UserDebtCreate(BaseModel):
    user_id: str
    step_key: str
    name: str
    interest_pct: float = 0
    balance: float = 0
    total_payment: float = 0


class UserDebtPatch(BaseModel):
    name: str | None = None
    interest_pct: float | None = None
    balance: float | None = None
    total_payment: float | None = None