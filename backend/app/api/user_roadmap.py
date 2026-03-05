from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.api.deps import get_db
from app.models import RoadmapStep, UserStepProgress
from app.schemas.user_roadmap import UserRoadmapStepOut

router = APIRouter(prefix="/user-roadmap", tags=["user_roadmap"])


@router.get("", response_model=list[UserRoadmapStepOut])
def list_user_roadmap(
    db: Session = Depends(get_db),
    user_id: str = Query(...),
    active_only: bool = Query(default=True),
):
    # 1) master list of steps
    steps_q = db.query(RoadmapStep)
    if active_only:
        steps_q = steps_q.filter(RoadmapStep.is_active == True)  # noqa: E712
    steps = steps_q.order_by(RoadmapStep.step_order.asc()).all()

    if not steps:
        return []

    step_keys = [s.key for s in steps]

    # 2) existing progress for this user (only for these step keys)
    existing = (
        db.query(UserStepProgress)
        .filter(
            UserStepProgress.user_id == user_id,
            UserStepProgress.step_key.in_(step_keys),
        )
        .all()
    )
    existing_map = {r.step_key: r for r in existing}

    # 3) create missing progress rows (progress=0)
    to_create = []
    for s in steps:
        if s.key not in existing_map:
            to_create.append(
                UserStepProgress(
                    user_id=user_id,
                    step_key=s.key,
                    progress=0,
                )
            )

    if to_create:
        db.add_all(to_create)
        db.commit()

        # refresh map (simple + safe)
        existing = (
            db.query(UserStepProgress)
            .filter(
                UserStepProgress.user_id == user_id,
                UserStepProgress.step_key.in_(step_keys),
            )
            .all()
        )
        existing_map = {r.step_key: r for r in existing}

    # 4) return joined view ordered by step_order
    out: list[UserRoadmapStepOut] = []
    for s in steps:
        p = existing_map.get(s.key)
        out.append(
            UserRoadmapStepOut(
                id=s.id,
                key=s.key,
                title=s.title,
                subtitle=s.subtitle,
                description=s.description,
                step_order=s.step_order,
                is_active=s.is_active,
                progress=int(p.progress) if p else 0,
                progress_updated_at=p.updated_at if p else None,
            )
        )

    return out