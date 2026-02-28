from app.db.session import SessionLocal
from app.models import RoadmapStep

steps = [
    {"key":"starter-fund","title":"Starter Emergency Fund","subtitle":"Build a quick buffer","step_order":1},
    {"key":"debt","title":"Eliminate High-Interest Debt","subtitle":"Stop interest bleeding","step_order":2},
    {"key":"insurance","title":"Insurance Protection","subtitle":"Protect your foundation","step_order":3},
    {"key":"full-fund","title":"Full Emergency Fund","subtitle":"3–6 months essentials","step_order":4},
    {"key":"automate","title":"Automate Saving","subtitle":"Make it consistent","step_order":5},
    {"key":"invest","title":"Start Investing","subtitle":"Let money grow","step_order":6},
    {"key":"grow","title":"Invest for Growth","subtitle":"Increase contributions","step_order":7},
    {"key":"income","title":"Increase Income","subtitle":"Fastest lever","step_order":8},
    {"key":"fi","title":"Financial Independence","subtitle":"Work becomes optional","step_order":9},
]

def seed():
    db = SessionLocal()

    for s in steps:
        exists = db.query(RoadmapStep).filter(RoadmapStep.key == s["key"]).first()
        if not exists:
            db.add(RoadmapStep(**s))

    db.commit()
    db.close()
    print("✅ Roadmap steps seeded successfully")

if __name__ == "__main__":
    seed()