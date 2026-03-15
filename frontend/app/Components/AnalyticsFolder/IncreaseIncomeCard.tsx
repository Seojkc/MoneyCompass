"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";

type Props = {
  userId: string;
  stepKey?: string;
  onCompletionChange?: (done: boolean) => void;
  whyTitle?: string;
  whyContent?: React.ReactNode;
  initialStrategies?: IncomeStrategy[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

type IncomeStrategy =
  | "career"
  | "skills"
  | "side-hustle"
  | "passive"
  | "business"
  | "investing";

type StrategyItem = {
  key: IncomeStrategy;
  label: string;
  short: string;
  description: string;
};

const METRIC_KEYS = {
  completed: "is_completed",
} as const;

const DEFAULT_STRATEGIES: IncomeStrategy[] = ["career", "skills"];

const STRATEGIES: StrategyItem[] = [
  {
    key: "career",
    label: "Career Advancement",
    short: "Promotion, new role, salary negotiation",
    description:
      "Grow income through promotions, better roles, switching companies, or negotiating compensation.",
  },
  {
    key: "skills",
    label: "Education / Skill Development",
    short: "Certifications, training, courses",
    description:
      "Learning valuable skills can multiply your earning power over time.",
  },
  {
    key: "side-hustle",
    label: "Side Income",
    short: "Freelancing, tutoring, consulting",
    description:
      "Additional monthly income can meaningfully increase savings and investing power.",
  },
  {
    key: "passive",
    label: "Passive Income",
    short: "Dividends, rentals, digital products",
    description:
      "Income streams that can continue with less ongoing effort.",
  },
  {
    key: "business",
    label: "Entrepreneurship",
    short: "Small business, local services, online store",
    description:
      "Higher risk, but potentially much larger upside and flexibility.",
  },
  {
    key: "investing",
    label: "Investing Income",
    short: "Dividends, interest, capital gains",
    description:
      "Over time, your money can begin producing income on its own.",
  },
];

export default function IncreaseIncomeCard({
  userId,
  stepKey = "income",
  onCompletionChange,
  whyTitle = "Why increase income?",
  whyContent,
  initialStrategies,
}: Props) {
  const safeInitialStrategies = initialStrategies ?? DEFAULT_STRATEGIES;

  const [selectedStrategies, setSelectedStrategies] =
    useState<IncomeStrategy[]>(safeInitialStrategies);

  const [manualCompleted, setManualCompleted] = useState(false);

  const [whyOpen, setWhyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastMetricSnapshotRef = useRef<string>("");
  const lastDoneRef = useRef<boolean>(false);

  const isDone = manualCompleted;

  useEffect(() => {
    if (!onCompletionChange) return;
    if (lastDoneRef.current !== isDone) {
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [isDone, onCompletionChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWhyOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!whyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [whyOpen]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const metrics = await listUserStepMetrics({ userId, stepKey });

        if (!mounted) return;

        const map = new Map<string, UiUserStepMetric>();
        metrics.forEach((m) => map.set(m.metric_key, m));

        const dbCompleted = map.get(METRIC_KEYS.completed)?.value_num;
        const nextCompleted =
          dbCompleted != null ? Number(dbCompleted) === 1 : false;

        setManualCompleted(nextCompleted);

        lastMetricSnapshotRef.current = JSON.stringify({
          c: nextCompleted ? 1 : 0,
        });

        hydratedRef.current = true;
        setSaveState("idle");
      } catch (e) {
        if (!mounted) return;
        setSaveState("error");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, stepKey]);

  const queueMetricSave = (nextManualCompleted: boolean) => {
    if (!hydratedRef.current) return;

    const snap = JSON.stringify({
      c: nextManualCompleted ? 1 : 0,
    });

    if (snap === lastMetricSnapshotRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await bulkUpsertUserStepMetrics([
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.completed,
            value_num: nextManualCompleted ? 1 : 0,
          },
        ]);

        lastMetricSnapshotRef.current = snap;
        setSaveState("saved");

        window.setTimeout(() => {
          setSaveState((prev) => (prev === "saved" ? "idle" : prev));
        }, 1200);
      } catch (e) {
        setSaveState("error");
      }
    }, 600);
  };

  useEffect(() => {
    queueMetricSave(manualCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualCompleted]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const toggleStrategy = (key: IncomeStrategy) => {
    setSelectedStrategies((prev) => {
      if (prev.includes(key)) {
        return prev.filter((x) => x !== key);
      }
      return [...prev, key];
    });
  };

  const defaultWhy = (
        <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">

            <div className="space-y-3">
            <h3 className="text-xl md:text-2xl font-semibold text-white">
                🚀 Why Increasing Your Income Matters
            </h3>

            <p className="text-white/80 leading-relaxed">
                Most financial advice focuses on cutting expenses.  
                Budget tighter. Spend less. Skip things you enjoy.
            </p>

            <p className="text-white/80 leading-relaxed">
                But there is a limit to how much you can reduce.
            </p>

            <p className="text-white font-medium">
                There is almost no limit to how much your income can grow.
            </p>
            </div>


            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
            <p className="leading-relaxed">
                Increasing income is not just about earning more money.
                <br />
                <span className="font-semibold">
                It is about expanding what is possible in your life.
                </span>
            </p>
            </div>


            <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">💡 The Hidden Power of Income Growth</h4>

            <p className="text-white/80 leading-relaxed">
                Imagine two people:
            </p>

            <div className="space-y-2 text-white/80">
                <p>Person A earns $50,000 and invests $400 per month.</p>
                <p>Person B earns $70,000 and invests $1,200 per month.</p>
            </div>

            <p className="text-white/80 leading-relaxed">
                Over time, the difference in wealth becomes enormous.
            </p>

            <p className="text-white font-medium">
                A higher income multiplies every other financial decision.
            </p>
            </div>


            <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">🌱 Income Creates Opportunity</h4>

            <p className="text-white/80 leading-relaxed">
                A growing income can give you things that money alone cannot buy:
            </p>

            <ul className="space-y-2 text-white/80">
                <li>• the ability to save without constant stress</li>
                <li>• freedom to invest in your future</li>
                <li>• flexibility when unexpected life events happen</li>
                <li>• the power to help the people you care about</li>
            </ul>
            </div>


            <div className="rounded-xl border border-sky-300/20 bg-sky-300/10 p-4 text-sky-200">
            <p className="leading-relaxed">
                Increasing income is not about greed.
                <br />
                <span className="font-semibold">
                It is about creating stability, freedom, and choices.
                </span>
            </p>
            </div>


            <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">🧠 A Mindset Shift</h4>

            <p className="text-white/80 leading-relaxed">
                Many people spend their lives trying to survive financially.
            </p>

            <p className="text-white/80 leading-relaxed">
                But when you focus on growing your earning power, something changes:
            </p>

            <p className="text-white font-medium">
                You move from surviving… to designing your future.
            </p>
            </div>


            <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">✨ Small Improvements Can Change Everything</h4>

            <p className="text-white/80 leading-relaxed">
                Even a small income increase can create powerful long-term effects.
            </p>

            <p className="text-white/80 leading-relaxed">
                An extra $400 per month invested consistently can grow into hundreds of thousands over time.
            </p>

            <p className="text-white font-medium">
                What feels small today can become life-changing tomorrow.
            </p>
            </div>


            <div className="space-y-3">
            <h4 className="text-white font-semibold text-lg">💛 This Step Is Not About Pressure</h4>

            <p className="text-white/80 leading-relaxed">
                Everyone's situation is different.
            </p>

            <p className="text-white/80 leading-relaxed">
                Increasing income does not always happen quickly.  
                Sometimes it takes learning new skills, changing roles, or exploring new opportunities.
            </p>

            <p className="text-white font-medium">
                The goal is simply to start thinking about your earning potential.
            </p>
            </div>


            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
            <p className="leading-relaxed">
                Your income is one of the most powerful engines behind your financial future.
            </p>

            <p className="mt-2 font-semibold">
                The bigger the engine, the further you can go.
            </p>
            </div>


            <div className="pt-4 border-t border-white/10 space-y-3">
            <p className="text-lg font-semibold text-white">
                🌟 The real goal is not just to earn more money.
            </p>

            <p className="text-emerald-200 font-medium text-lg">
                It is to build a life where your opportunities keep growing.
            </p>

            <p className="text-white/65 italic">
                Your earning power is not fixed.
                <br />
                It is something you can develop over time.
            </p>
            </div>

        </div>
        );


  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white fs-1 text-3xl">
              Increase Income
            </h1>

            <div className="mt-1 text-xs text-white/50">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="text-red-300">Couldn’t save</span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="text-lg text-white/80 hover:text-white rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
          >
            Why? <span className="ml-1">›</span>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm md:text-base text-white/85 font-semibold">
            Expand the size of your financial engine
          </div>

          <div className="mt-3 space-y-3 text-sm md:text-base text-white/75 leading-relaxed">
            <p>
              Many people try to improve finances only by cutting expenses.
              But expense cutting has a limit.
            </p>
            <p>
              Increasing income can have a much bigger long-term impact because it improves how much
              you can save, invest, and compound over time.
            </p>
            <p className="text-emerald-200">
              This step is not about pressure. It is about exploring realistic ways to grow your
              earning power.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
            <div className="text-sm md:text-base text-white/85 font-semibold">
                Choose realistic income growth paths
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {STRATEGIES.map((item) => {
                return (
                    <div
                    key={item.key}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                        <div className="text-white font-semibold">{item.label}</div>
                        <div className="mt-1 text-sm text-white/60">{item.short}</div>
                        </div>
                    </div>

                    <div className="mt-2 text-sm text-white/70 leading-relaxed">
                        {item.description}
                    </div>
                    </div>
                );
                })}
            </div>
            </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
          <div className="text-sm md:text-base text-white/85 font-semibold">
            Educational perspective
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-white font-semibold">Focus on opportunities</div>
              <div className="mt-2 space-y-1 text-white/70">
                <div>• promotions</div>
                <div>• better roles</div>
                <div>• new certifications</div>
                <div>• stronger skills</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-white font-semibold">Build multiple paths</div>
              <div className="mt-2 space-y-1 text-white/70">
                <div>• side income</div>
                <div>• passive income</div>
                <div>• entrepreneurship</div>
                <div>• investment income</div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-violet-300/15 bg-violet-300/10 p-3 text-violet-100 text-sm">
            The real goal is not just to earn more money — it is to design a life where earning
            power grows over time.
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-white/10 pt-4">
          <div className="text-sm text-white/70">
            {manualCompleted ? (
              <span className="text-emerald-200">This step is marked as complete.</span>
            ) : (
              <span>
                Explore your options and mark this step complete when you are ready.
              </span>
            )}
          </div>

          <button
            onClick={() => setManualCompleted((prev) => !prev)}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold border",
              manualCompleted
                ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-200"
                : "border-white/10 bg-white/5 text-white/85 hover:text-white",
            ].join(" ")}
          >
            {manualCompleted ? "Completed ✓" : "Mark as Complete"}
          </button>
        </div>
      </section>

      {whyOpen && (
        <OverlayShell onClose={() => setWhyOpen(false)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold text-lg md:text-xl">{whyTitle}</div>
              <div className="mt-1 text-white/60 text-xs md:text-sm">
                Quick explanation (tap outside to close).
              </div>
            </div>

            <CloseButton onClick={() => setWhyOpen(false)} />
          </div>

          <div className="mt-4">{whyContent ?? defaultWhy}</div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => setWhyOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              Close
            </button>
          </div>
        </OverlayShell>
      )}
    </>
  );
}

function OverlayShell({
  children,
  onClose,
  maxWidth = "max-w-2xl",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className={`relative w-full ${maxWidth} rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 hover:text-white"
      aria-label="Close"
    >
      <span className="sr-only">Close</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-90"
      >
        <path
          d="M18 6L6 18M6 6L18 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
