"use client";

import React, { useEffect, useMemo, useState } from "react";
import "../../CSS/RoadmapTimeLine.css";
import Tradegraph from "./tradegraph";
import StarterEmergencyFundCard from "./StarterEmergency";
import EliminateHighInterestDebtCard from "./EliminateHighInterestDebtCard";
import InsuranceCard from "./Insurance";
import FullEmergencyFundCard from "./FullEmergencyFundCard";
import { listUserRoadmapSteps } from "@/lib/bridge";
import AutomateSavingCard from "./AutomateSavingCard";
import InvestCard from "./InvestCard";
import IncreaseIncomeCard from "./IncreaseIncomeCard";
import FinancialIndependenceCard from "./FinancialIndependence";

type Step = {
  id?: string;
  key: string;
  title: string;
  subtitle: string;
  step_order: number;
};

type Props = {
  userId: string;
};

const CORE_STEP_KEYS = [
  "starter-fund",
  "debt",
  "insurance",
  "full-fund",
  "automate",
  "invest",
  "income",
] as const;

const FI_STEP: Step = {
  id: "fi",
  key: "fi",
  title: "Financial Independence",
  subtitle: "Work becomes optional",
  step_order: 9,
};

export default function RoadmapTimeline({ userId }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const [active, setActive] = useState<string>("starter-fund");
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let mounted = true;

    const loadSteps = async () => {
      try {
        setLoadingSteps(true);
        setStepsError(null);

        const apiSteps = await listUserRoadmapSteps(userId, true);

        const normalized: Step[] = apiSteps
          .map((s: any) => ({
            id: s.id,
            key: s.key,
            title: s.title,
            subtitle: s.subtitle,
            step_order: s.step_order,
          }))
          .filter((s: Step) => s.key !== "fi")
          .sort((a: Step, b: Step) => a.step_order - b.step_order);

        if (!mounted) return;

        setSteps(normalized);
        setActive((prev) => {
          const exists = normalized.some((x: Step) => x.key === prev);
          return exists ? prev : normalized[0]?.key ?? "starter-fund";
        });
      } catch (e: any) {
        if (!mounted) return;
        setStepsError(e?.message ?? "Failed to load roadmap steps");
      } finally {
        if (!mounted) return;
        setLoadingSteps(false);
      }
    };

    if (userId) loadSteps();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const updateCompleted = (key: string, done: boolean) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (done) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const isCompleted = (key: string) => completed.has(key);

  const allCoreStepsCompleted = useMemo(() => {
    return CORE_STEP_KEYS.every((key) => completed.has(key));
  }, [completed]);

  const visibleSteps = useMemo(() => {
    const base = [...steps];
    if (allCoreStepsCompleted) base.push(FI_STEP);
    return base.sort((a, b) => a.step_order - b.step_order);
  }, [steps, allCoreStepsCompleted]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const journeyList = useMemo(() => {
    if (loadingSteps) {
      return (
        <div className="roadmap-skeleton-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="roadmap-skeleton-row">
              <div className="roadmap-skeleton-dot" />
              <div className="roadmap-skeleton-lines">
                <div className="roadmap-skeleton-line-lg" />
                <div className="roadmap-skeleton-line-sm" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (stepsError) {
      return (
        <div className="roadmap-message error">
          {stepsError}
          <div className="roadmap-message-tip">
            Tip: confirm roadmap API is working for the logged-in user.
          </div>
        </div>
      );
    }

    if (!visibleSteps.length) {
      return <div className="roadmap-message empty">No roadmap steps found.</div>;
    }

    return (
      <div className="roadmap-list">
        {visibleSteps.map((s, idx) => {
          const activeNow = active === s.key;
          const done = isCompleted(s.key);
          const isFi = s.key === "fi";

          return (
            <button
              key={s.key}
              onClick={() => scrollTo(s.key)}
              className="roadmap-item-btn"
              type="button"
            >
              <div className="roadmap-item-row">
                

                <div className="roadmap-item-content">
                  <div
                    className={[
                      "roadmap-item-title",
                      done ? (isFi ? "fi-done" : "done") : "",
                      !done && activeNow ? "active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {idx + 1}. {s.title}
                  </div>
                  <div className="roadmap-item-subtitle">{s.subtitle}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }, [visibleSteps, active, loadingSteps, stepsError, completed]);

  return (
    <div className="roadmap-shell">
      <div className="roadmap-top">
        <div className="roadmap-top-grid">
          <div className="roadmap-panel roadmap-panel--journey">
            <div className="roadmap-panel-inner">
              <div className="roadmap-journey-header">
                <div>
                  <div className="roadmap-eyebrow">Roadmap</div>
                  <div className="roadmap-title">Your Money Journey</div>
                </div>

                <div className="roadmap-journey-badge">
                  {visibleSteps.length} Steps
                </div>
              </div>

              <div className="roadmap-journey-wrap">
                <div className="roadmap-journey-line" />
                {journeyList}
              </div>
            </div>
          </div>

          <div className="roadmap-trade-card">
            <div className="roadmap-panel-inner">
              <Tradegraph moneySpent={2400} category="Groceries" />
            </div>
          </div>
        </div>
      </div>

      <main className="roadmap-sections">
        <section id="starter-fund" className="roadmap-section">
          <StarterEmergencyFundCard
            userId={userId}
            stepKey="starter-fund"
            initialTarget={2400}
            initialSaved={900}
            initialMonthlySave={200}
            onCompletionChange={(done) => updateCompleted("starter-fund", done)}
          />
        </section>

        <section id="debt" className="roadmap-section">
          <EliminateHighInterestDebtCard
            userId={userId}
            stepKey="debt"
            onCompletionChange={(done) => updateCompleted("debt", done)}
          />
        </section>

        <section id="insurance" className="roadmap-section">
          <InsuranceCard
            userId={userId}
            stepKey="insurance"
            onCompletionChange={(done) => updateCompleted("insurance", done)}
          />
        </section>

        <section id="full-fund" className="roadmap-section">
          <FullEmergencyFundCard
            userId={userId}
            stepKey="full-fund"
            onCompletionChange={(done) => updateCompleted("full-fund", done)}
          />
        </section>

        <section id="automate" className="roadmap-section">
          <AutomateSavingCard
            userId={userId}
            stepKey="automate"
            initialGeneralSaved={0}
            initialGeneralMonthly={0}
            onCompletionChange={(done) => updateCompleted("automate", done)}
          />
        </section>

        <section id="invest" className="roadmap-section">
          <InvestCard
            userId={userId}
            stepKey="invest"
            onCompletionChange={(done) => updateCompleted("invest", done)}
          />
        </section>

        <section id="income" className="roadmap-section">
          <IncreaseIncomeCard
            userId={userId}
            stepKey="income"
            onCompletionChange={(done) => updateCompleted("income", done)}
          />
        </section>

        <section id="fi" className="roadmap-section">
          {allCoreStepsCompleted && <FinancialIndependenceCard userId={userId} />}
        </section>
      </main>
    </div>
  );
}