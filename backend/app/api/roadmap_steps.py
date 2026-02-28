from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models import RoadmapStep
from app.schemas.roadmap_step import RoadmapStepCreate, RoadmapStepUpdate, RoadmapStepOut

router = APIRouter(prefix="/roadmap-steps", tags=["roadmap_steps"])

@router.get("", response_model=list[RoadmapStepOut])
def list_steps(
    db: Session = Depends(get_db),
    active_only: bool = Query(default=True),
):
    q = db.query(RoadmapStep)
    if active_only:
        q = q.filter(RoadmapStep.is_active == True)  # noqa: E712
    return q.order_by(RoadmapStep.step_order.asc()).all()

@router.post("", response_model=RoadmapStepOut)
def create_step(payload: RoadmapStepCreate, db: Session = Depends(get_db)):
    exists = db.query(RoadmapStep).filter(RoadmapStep.key == payload.key).first()
    if exists:
        raise HTTPException(status_code=409, detail="Step key already exists")

    step = RoadmapStep(**payload.model_dump())
    db.add(step)
    db.commit()
    db.refresh(step)
    return step

@router.patch("/{step_id}", response_model=RoadmapStepOut)
def update_step(step_id, payload: RoadmapStepUpdate, db: Session = Depends(get_db)):
    step = db.query(RoadmapStep).filter(RoadmapStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(step, k, v)

    db.commit()
    db.refresh(step)
    return step

@router.delete("/{step_id}")
def delete_step(step_id, db: Session = Depends(get_db)):
    step = db.query(RoadmapStep).filter(RoadmapStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    db.delete(step)
    db.commit()
    return {"deleted": True, "id": str(step_id)}