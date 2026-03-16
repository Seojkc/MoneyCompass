"use client";

import React, { useEffect, useMemo, useState } from "react";
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

    if (userId) {
      loadSteps();
    }

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
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-3">
                <div className="mt-1 h-3 w-3 rounded-full border border-white/10 bg-white/10" />
                <div className="flex-1">
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="mt-2 h-2 w-1/2 rounded bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (stepsError) {
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {stepsError}
          <div className="mt-2 text-xs text-red-200/70">
            Tip: confirm roadmap API is working for the logged-in user.
          </div>
        </div>
      );
    }

    if (!visibleSteps.length) {
      return <div className="text-sm text-white/60">No roadmap steps found.</div>;
    }

    return (
      <div className="space-y-3">
        {visibleSteps.map((s, idx) => {
          const activeNow = active === s.key;
          const done = isCompleted(s.key);
          const isFi = s.key === "fi";

          return (
            <button
              key={s.key}
              onClick={() => scrollTo(s.key)}
              className="group w-full text-left"
            >
              <div className="relative flex gap-3">
                <span
                  className={[
                    "mt-1 h-3 w-3 rounded-full border transition-colors",
                    done
                      ? isFi
                        ? "border-yellow-400 bg-yellow-400"
                        : "border-green-500 bg-green-500"
                      : activeNow
                        ? "border-white bg-white"
                        : "border-white/20 bg-white/10",
                  ].join(" ")}
                />

                <div className="min-w-0">
                  <div
                    className={[
                      "text-sm font-medium leading-tight transition-colors",
                      done
                        ? isFi
                          ? "text-yellow-300"
                          : "text-green-400"
                        : activeNow
                          ? "text-white"
                          : "text-white/70 group-hover:text-white",
                    ].join(" ")}
                  >
                    {idx + 1}. {s.title}
                  </div>
                  <div className="text-xs text-white/50">{s.subtitle}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }, [visibleSteps, active, loadingSteps, stepsError, completed]);

  return (
    <div className="w-full">
      <div className="top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-[280px_1fr]">
          <div className="rounded-xl border bg-transparent p-4">
            <div className="mb-3 text-sm font-semibold text-white">
              Your Money Journey
            </div>

            <div className="relative pl-4">
              <div className="absolute bottom-0 left-2 top-0 w-px bg-white/10" />
              {journeyList}
            </div>
          </div>

          <div className="rounded-xl border bg-transparent p-4">
            <Tradegraph moneySpent={2400} category="Groceries" />
          </div>
        </div>
      </div>

      <main className="space-y-8 p-4">
        <section id="starter-fund" className="scroll-mt-24">
          <StarterEmergencyFundCard
            userId={userId}
            stepKey="starter-fund"
            initialTarget={2400}
            initialSaved={900}
            initialMonthlySave={200}
            onCompletionChange={(done) => updateCompleted("starter-fund", done)}
          />
        </section>

        <section id="debt" className="scroll-mt-24">
          <EliminateHighInterestDebtCard
            userId={userId}
            stepKey="debt"
            onCompletionChange={(done) => updateCompleted("debt", done)}
          />
        </section>

        <section id="insurance" className="scroll-mt-24">
          <InsuranceCard
            userId={userId}
            stepKey="insurance"
            onCompletionChange={(done) => updateCompleted("insurance", done)}
          />
        </section>

        <section id="full-fund" className="scroll-mt-24">
          <FullEmergencyFundCard
            userId={userId}
            stepKey="full-fund"
            onCompletionChange={(done) => updateCompleted("full-fund", done)}
          />
        </section>

        <section id="automate" className="scroll-mt-24">
          <AutomateSavingCard
            userId={userId}
            stepKey="automate"
            initialGeneralSaved={0}
            initialGeneralMonthly={0}
            onCompletionChange={(done) => updateCompleted("automate", done)}
          />
        </section>

        <section id="invest" className="scroll-mt-24">
          <InvestCard
            userId={userId}
            stepKey="invest"
            onCompletionChange={(done) => updateCompleted("invest", done)}
          />
        </section>

        <section id="income" className="scroll-mt-24">
          <IncreaseIncomeCard
            userId={userId}
            stepKey="income"
            onCompletionChange={(done) => updateCompleted("income", done)}
          />
        </section>

        <section id="fi" className="scroll-mt-24">
          {allCoreStepsCompleted && <FinancialIndependenceCard userId={userId}/>}
        </section>
      </main>
    </div>
  );
}