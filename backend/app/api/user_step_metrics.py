from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import UserStepMetric
from app.schemas.user_step_metric import UserStepMetricOut, UserStepMetricUpsert

router = APIRouter(prefix="/user-step-metrics", tags=["user_step_metrics"])

@router.get("", response_model=list[UserStepMetricOut])
def list_metrics(
    db: Session = Depends(get_db),
    user_id: str = Query(...),
    step_key: str | None = Query(default=None),
):
    q = db.query(UserStepMetric).filter(UserStepMetric.user_id == user_id)
    if step_key is not None:
        q = q.filter(UserStepMetric.step_key == step_key)
    return q.order_by(UserStepMetric.updated_at.desc()).all()

@router.put("", response_model=UserStepMetricOut)
def upsert_metric(payload: UserStepMetricUpsert, db: Session = Depends(get_db)):
    row = (
        db.query(UserStepMetric)
        .filter(
            UserStepMetric.user_id == payload.user_id,
            UserStepMetric.step_key == payload.step_key,
            UserStepMetric.metric_key == payload.metric_key,
        )
        .first()
    )

    if row:
        row.value_num = payload.value_num
    else:
        row = UserStepMetric(**payload.model_dump())
        db.add(row)

    db.commit()
    db.refresh(row)
    return row

@router.put("/bulk", response_model=list[UserStepMetricOut])
def bulk_upsert(payload: list[UserStepMetricUpsert], db: Session = Depends(get_db)):
    out: list[UserStepMetric] = []

    for item in payload:
        row = (
            db.query(UserStepMetric)
            .filter(
                UserStepMetric.user_id == item.user_id,
                UserStepMetric.step_key == item.step_key,
                UserStepMetric.metric_key == item.metric_key,
            )
            .first()
        )

        if row:
            row.value_num = item.value_num
        else:
            row = UserStepMetric(**item.model_dump())
            db.add(row)

        out.append(row)

    db.commit()
    for r in out:
        db.refresh(r)

    return out