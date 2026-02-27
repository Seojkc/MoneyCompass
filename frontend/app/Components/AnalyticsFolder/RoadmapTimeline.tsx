"use client";

import { useMemo, useState } from "react";
import React from "react";
import Tradegraph from "./tradegraph";
import StarterEmergencyFundCard from "./StarterEmergency";


type Step = {
  key: string;
  title: string;
  subtitle: string;
};

export default function RoadmapTimeline() {
  const steps: Step[] = useMemo(
    () => [
      { key: "starter-fund", title: "Starter Emergency Fund", subtitle: "Build a quick buffer" },
      { key: "debt", title: "Eliminate High-Interest Debt", subtitle: "Stop interest bleeding" },
      { key: "insurance", title: "Insurance Protection", subtitle: "Protect your foundation" },
      { key: "full-fund", title: "Full Emergency Fund", subtitle: "3–6 months essentials" },
      { key: "automate", title: "Automate Saving", subtitle: "Make it consistent" },
      { key: "invest", title: "Start Investing", subtitle: "Let money grow" },
      { key: "grow", title: "Invest for Growth", subtitle: "Increase contributions" },
      { key: "income", title: "Increase Income", subtitle: "Fastest lever" },
      { key: "fi", title: "Financial Independence", subtitle: "Work becomes optional" },
    ],
    []
  );

  const [active, setActive] = useState<string>(steps[0].key);
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());

  const isCompleted = (key: string) => completed.has(key);

  const toggleComplete = (key: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full">
      {/* ✅ TOP: Sticky journey map (same vertical list) + empty card */}
      <div className=" top-0 z-20 backdrop-blur bg-black/30 border-b border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 p-4">
          {/* Journey map card (kept same style/structure) */}
          <div className="rounded-xl border p-4 bg-transparent">
            <div className="text-sm font-semibold mb-3 text-white">Your Money Journey</div>

            <div className="relative pl-4">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10" />

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
            </div>
          </div>

          {/* Empty card placeholder */}
          <div className="rounded-xl border p-4 bg-transparent">
            
            <Tradegraph  moneySpent={2400} category="Groceries"  />
          </div>
        </div>
      </div>

      {/* ✅ DOWN: Full-width detail sections */}
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