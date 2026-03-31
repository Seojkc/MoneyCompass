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
import { CheckCircle2, Trophy } from "lucide-react";

type Step = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  step_order: number;
};

type Props = {
  userId: string;
};

export default function RoadmapTimeline( { userId }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const [active, setActive] = useState<string>("starter-fund");
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingSteps(true);
        setStepsError(null);

       
        const apiSteps = await listUserRoadmapSteps(userId, true);

        const normalized = apiSteps
          .map((s: any) => ({
            id: s.id,
            key: s.key,
            title: s.title,
            subtitle: s.subtitle,
            step_order: s.step_order,
            progress: s.progress,
          }))
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
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isCompleted = (key: string) => completed.has(key);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    setActive(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateCompleted = (key: string, done: boolean) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (done) next.add(key);
      else next.delete(key);
      return next;
    });
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
            Tip: confirm FastAPI has <code>/roadmap-steps</code> in{" "}
            <code>http://localhost:8000/docs</code>
          </div>
        </div>
      );
    }

    if (!steps.length) {
      return <div className="text-sm text-white/60">No roadmap steps found.</div>;
    }

    return (
      <div className="space-y-3">
        {steps.map((s, idx) => {
          const activeNow = active === s.key;
          const done = isCompleted(s.key);

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
                      ? "border-green-500 bg-green-500"
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
                        ? "text-green-400"
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
  }, [steps, active, loadingSteps, stepsError, completed]);

  return (
    <div className="w-full">
      <main className="space-y-8 p-4">
        <section id="fi" className="scroll-mt-24">
          <FinancialIndependenceCard completed />
        </section>
      </main>
    </div>
  );
}
function FinancialIndependenceCard({ completed = true }: { completed?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,216,107,0.18),transparent_28%)]" />
        <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-yellow-300/10 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-200/50 to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10 md:px-10 md:py-14">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-500 shadow-[0_0_35px_rgba(255,215,90,0.35)] ring-1 ring-white/20 sm:h-24 sm:w-24">
          <div className="absolute inset-[6px] rounded-full border border-white/25" />
          <Trophy className="h-10 w-10 text-amber-950 sm:h-12 sm:w-12" strokeWidth={2.2} />
        </div>

        <div className="inline-flex items-center rounded-full border border-yellow-200/20 bg-yellow-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100 sm:px-4 sm:text-xs">
          Final Milestone
        </div>

        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-5xl">
          Financial Independence
        </h2>

        <p className="mt-2 text-sm text-white/60 sm:text-base md:text-xl">
          Work becomes optional
        </p>

        <div className="mt-6 h-px w-full max-w-xl bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/75 sm:text-base md:text-2xl md:leading-[1.5]">
          Congratulations. You have built a financial system strong enough to
          support freedom, flexibility, and the life you truly want to live.
        </p>

        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Meaning
            </div>
            <div className="mt-2 text-sm leading-6 text-white/80 sm:text-[15px]">
              Your core financial steps are complete and your money is now working
              for you instead of against you.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Outcome
            </div>
            <div className="mt-2 text-sm leading-6 text-white/80 sm:text-[15px]">
              More peace, more choice, and more confidence in your future.
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <div
            className={[
              "inline-flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.22)] sm:px-6 sm:text-base",
              completed
                ? "border-emerald-300/30 bg-emerald-300/12 text-white"
                : "border-white/15 bg-white/5 text-white/70",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10",
                completed
                  ? "bg-lime-300 text-lime-900 shadow-[0_0_22px_rgba(163,230,53,0.35)]"
                  : "bg-white/10 text-white/70",
              ].join(" ")}
            >
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.8} />
            </span>

            {completed ? "Completed" : "Locked"}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </div>
  );
}
