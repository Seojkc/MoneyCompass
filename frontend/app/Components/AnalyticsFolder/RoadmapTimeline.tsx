"use client";

import React, { useEffect, useMemo, useState } from "react";
import Tradegraph from "./tradegraph";
import StarterEmergencyFundCard from "./StarterEmergency";
import { listRoadmapSteps } from "@/lib/bridge";

type Step = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  step_order: number;
};

export default function RoadmapTimeline() {
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

        const apiSteps = await listRoadmapSteps(true);

        // Normalize + sort (backend should already sort, but keep safe)
        const normalized: Step[] = apiSteps
          .map((s: any) => ({
            id: s.id,
            key: s.key,
            title: s.title,
            subtitle: s.subtitle,
            step_order: s.step_order,
          }))
          .sort((a, b) => a.step_order - b.step_order);

        if (!mounted) return;

        setSteps(normalized);

        // Pick a safe default active step
        setActive((prev) => {
          const exists = normalized.some((x) => x.key === prev);
          return exists ? prev : (normalized[0]?.key ?? "starter-fund");
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

  const journeyList = useMemo(() => {
    if (loadingSteps) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-white/10 border border-white/10" />
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
      return (
        <div className="text-sm text-white/60">
          No roadmap steps found.
        </div>
      );
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
                      ? "bg-green-500 border-green-500"
                      : activeNow
                      ? "bg-white border-white"
                      : "bg-white/10 border-white/20",
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
      {/* TOP */}
      <div className="top-0 z-20 backdrop-blur bg-black/30 border-b border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 p-4">
          {/* Journey map card */}
          <div className="rounded-xl border p-4 bg-transparent">
            <div className="text-sm font-semibold mb-3 text-white">
              Your Money Journey
            </div>

            <div className="relative pl-4">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10" />
              {journeyList}
            </div>
          </div>

          {/* Right card placeholder */}
          <div className="rounded-xl border p-4 bg-transparent">
            <Tradegraph moneySpent={2400} category="Groceries" />
          </div>
        </div>
      </div>

      {/* DOWN */}
      <main className="p-4 space-y-8">
        <StarterEmergencyFundCard
          initialTarget={2400}
          initialSaved={900}
          initialMonthlySave={200}
          onCompletionChange={(done) => {
            setCompleted((prev) => {
              const next = new Set(prev);
              if (done) next.add("starter-fund");
              else next.delete("starter-fund");
              return next;
            });
          }}
        />
      </main>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 border-white/10">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </div>
  );
}