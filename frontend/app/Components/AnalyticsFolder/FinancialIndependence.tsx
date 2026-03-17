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
    <div className="relative overflow-hidden rounded-[34px] border border-yellow-200/15 bg-[radial-gradient(circle_at_top,_rgba(255,220,120,0.18),_rgba(18,12,20,0.9)_34%,_rgba(7,7,14,0.98)_72%)] shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,211,92,0.28),transparent_20%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,218,120,0.22)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="absolute left-1/2 top-[72px] h-px w-[76%] -translate-x-1/2 bg-gradient-to-r from-transparent via-yellow-200/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-yellow-200/10 to-transparent blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-10 text-center md:px-10 md:py-14">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-yellow-200 to-yellow-500 shadow-[0_0_45px_rgba(255,214,102,0.4)] ring-4 ring-yellow-100/10">
          <Trophy className="h-12 w-12 text-amber-900" strokeWidth={2.2} />
        </div>

        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
          Financial Independence
        </h2>

        <p className="mt-3 text-lg text-white/70 md:text-2xl">
          Work becomes optional
        </p>

        <div className="mx-auto mt-8 h-px w-full max-w-2xl bg-white/10" />

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-white/75 md:text-3xl md:leading-[1.45]">
          Congratulations! Everything is in place for you
          <br className="hidden md:block" /> to live your best life.
        </p>

        <div className="mt-10 flex justify-center">
          <div
            className={[
              "inline-flex items-center gap-3 rounded-full border px-6 py-3 text-xl font-semibold shadow-lg",
              completed
                ? "border-yellow-300/40 bg-yellow-300/10 text-white"
                : "border-white/15 bg-white/5 text-white/70",
            ].join(" ")}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-300 text-lime-900 shadow-[0_0_25px_rgba(163,230,53,0.45)]">
              <CheckCircle2 className="h-6 w-6" strokeWidth={2.8} />
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
