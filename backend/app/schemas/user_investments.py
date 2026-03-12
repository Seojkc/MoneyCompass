from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class UserInvestmentBase(BaseModel):
    user_id: str
    step_key: str = "invest"
    account_type: str
    name: str
    kind: str
    risk: Optional[str] = None
    monthly_amount: float
    current_invested: float
    average_return: float
    website: Optional[str] = None
    preset_id: Optional[str] = None
    is_custom: Optional[bool] = False


class UserInvestmentCreate(UserInvestmentBase):
    pass


class UserInvestmentPatch(BaseModel):
    account_type: Optional[str] = None
    name: Optional[str] = None
    kind: Optional[str] = None
    risk: Optional[str] = None
    monthly_amount: Optional[float] = None
    current_invested: Optional[float] = None
    average_return: Optional[float] = None
    website: Optional[str] = None
    preset_id: Optional[str] = None
    is_custom: Optional[bool] = None


class UserInvestmentOut(UserInvestmentBase):
    id: UUID

    class Config:
        from_attributes = True