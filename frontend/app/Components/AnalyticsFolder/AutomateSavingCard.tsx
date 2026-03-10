"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  createUserSavingGoal,
  deleteUserSavingGoal,
  listUserSavingGoals,
  listUserStepMetrics,
  patchUserSavingGoal,
  UiUserSavingGoal,
  UiUserStepMetric,
} from "@/lib/bridge";

type Props = {
  userId: string;
  stepKey?: string;

  onCompletionChange?: (done: boolean) => void;

  whyTitle?: string;
  whyContent?: React.ReactNode;

  initialGeneralSaved?: number;
  initialGeneralMonthly?: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const METRIC_KEYS = {
  currentSaved: "current_saved",
  perMonth: "save_per_month",
  completed: "is_completed",
} as const;

export default function AutomateSavingCard({
  userId,
  stepKey = "automate",
  onCompletionChange,
  whyTitle = "Why automate saving?",
  whyContent,
  initialGeneralSaved = 0,
  initialGeneralMonthly = 0,
}: Props) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const [generalSaved, setGeneralSaved] = useState(initialGeneralSaved);
  const [generalMonthly, setGeneralMonthly] = useState(initialGeneralMonthly);
  const [manualCompleted, setManualCompleted] = useState(false);

  const [goals, setGoals] = useState<UiUserSavingGoal[]>([]);

  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalSaved, setNewGoalSaved] = useState(0);
  const [newGoalTarget, setNewGoalTarget] = useState(0);
  const [newGoalMonthly, setNewGoalMonthly] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastMetricSnapshotRef = useRef<string>("");
  const goalPatchTimersRef = useRef<Record<string, number>>({});
  const lastDoneRef = useRef<boolean>(false);

  const money = (n: number) =>
    Number(n || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

  const totalMonthlySavings = useMemo(() => {
    const goalsMonthly = goals.reduce(
      (sum, g) => sum + Math.max(0, Number(g.monthly) || 0),
      0
    );
    return Math.max(0, Number(generalMonthly) || 0) + goalsMonthly;
  }, [generalMonthly, goals]);

  const autoDone = useMemo(() => {
    const hasSystem =
      generalMonthly > 0 ||
      generalSaved > 0 ||
      goals.some(
        (g) =>
          Number(g.saved) > 0 ||
          Number(g.target) > 0 ||
          Number(g.monthly) > 0
      );

    return hasSystem;
  }, [generalMonthly, generalSaved, goals]);

  const isDone = manualCompleted || autoDone;

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
        setGoalModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!whyOpen && !goalModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [whyOpen, goalModalOpen]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const [metrics, savingGoals] = await Promise.all([
          listUserStepMetrics({ userId, stepKey }),
          listUserSavingGoals({ userId, stepKey }),
        ]);

        if (!mounted) return;

        const map = new Map<string, UiUserStepMetric>();
        metrics.forEach((m) => map.set(m.metric_key, m));

        const dbSaved = map.get(METRIC_KEYS.currentSaved)?.value_num;
        const dbMonthly = map.get(METRIC_KEYS.perMonth)?.value_num;
        const dbCompleted = map.get(METRIC_KEYS.completed)?.value_num;

        const nextGeneralSaved =
          dbSaved != null ? Number(dbSaved) || 0 : initialGeneralSaved;
        const nextGeneralMonthly =
          dbMonthly != null ? Number(dbMonthly) || 0 : initialGeneralMonthly;
        const nextCompleted = dbCompleted != null ? Number(dbCompleted) === 1 : false;

        setGeneralSaved(nextGeneralSaved);
        setGeneralMonthly(nextGeneralMonthly);
        setManualCompleted(nextCompleted);
        setGoals(savingGoals);

        lastMetricSnapshotRef.current = JSON.stringify({
          s: nextGeneralSaved,
          m: nextGeneralMonthly,
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
  }, [userId, stepKey, initialGeneralSaved, initialGeneralMonthly]);

  const queueMetricSave = (
    nextGeneralSaved: number,
    nextGeneralMonthly: number,
    nextManualCompleted: boolean
  ) => {
    if (!hydratedRef.current) return;

    const snap = JSON.stringify({
      s: Number(nextGeneralSaved) || 0,
      m: Number(nextGeneralMonthly) || 0,
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
            metric_key: METRIC_KEYS.currentSaved,
            value_num: Number(nextGeneralSaved) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.perMonth,
            value_num: Number(nextGeneralMonthly) || 0,
          },
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
    queueMetricSave(generalSaved, generalMonthly, manualCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalSaved, generalMonthly, manualCompleted]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

      Object.values(goalPatchTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  const queueGoalPatch = (
    goalId: string,
    patch: Partial<Pick<UiUserSavingGoal, "saved" | "target" | "monthly">>
  ) => {
    if (goalPatchTimersRef.current[goalId]) {
      window.clearTimeout(goalPatchTimersRef.current[goalId]);
    }

    goalPatchTimersRef.current[goalId] = window.setTimeout(async () => {
      try {
        await patchUserSavingGoal(goalId, patch);
      } catch (e) {
        setSaveState("error");
      } finally {
        delete goalPatchTimersRef.current[goalId];
      }
    }, 500);
  };

  const addGoal = async () => {
    if (!newGoalName.trim()) return;

    try {
      setSaveState("saving");

      const created = await createUserSavingGoal({
        user_id: userId,
        step_key: stepKey,
        name: newGoalName.trim(),
        saved: Math.max(0, Number(newGoalSaved) || 0),
        target: Math.max(0, Number(newGoalTarget) || 0),
        monthly: Math.max(0, Number(newGoalMonthly) || 0),
      });

      setGoals((prev) => [...prev, created]);

      setNewGoalName("");
      setNewGoalSaved(0);
      setNewGoalTarget(0);
      setNewGoalMonthly(0);
      setGoalModalOpen(false);

      setSaveState("saved");
      window.setTimeout(() => {
        setSaveState((prev) => (prev === "saved" ? "idle" : prev));
      }, 1200);
    } catch (e) {
      setSaveState("error");
    }
  };

  const deleteGoal = async (id: string) => {
    const prevGoals = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));

    try {
      await deleteUserSavingGoal(id);
    } catch (e) {
      setGoals(prevGoals);
      setSaveState("error");
    }
  };

  const updateGoalLocal = (
    id: string,
    patch: Partial<Pick<UiUserSavingGoal, "saved" | "target" | "monthly">>
  ) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              ...patch,
            }
          : g
      )
    );

    queueGoalPatch(id, patch);
  };

  const defaultWhy = (
    <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-3">
        <h3 className="text-xl md:text-2xl font-semibold text-white">⚙️ Why This Matters</h3>
        <p className="text-white/80 leading-relaxed">
          Saving works better when it becomes automatic. Instead of deciding every month where money
          should go, you create a system that moves money with intention.
        </p>
      </div>

      <ul className="space-y-2">
        <li>• Reduces the chance of forgetting to save</li>
        <li>• Makes progress more consistent</li>
        <li>• Helps separate flexible savings and specific goals</li>
        <li>• Builds a habit without relying on motivation</li>
      </ul>

      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200 font-medium">
        👉 A system is easier to trust than memory.
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white fs-1 text-3xl">Automate Saving</h1>

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

        <div className="mt-6 border-t border-white/10 pt-4 space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-lg md:text-xl">General Saving</h2>
              <p className="mt-1 text-sm text-white/55">
                For money you want to save without a specific purpose yet.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Row
                label="Currently Saved"
                value={generalSaved}
                onChange={setGeneralSaved}
              />

              <Row
                label="Monthly Saving"
                value={generalMonthly}
                onChange={setGeneralMonthly}
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-white font-semibold text-lg md:text-xl">Saving Goals</h2>
                <p className="mt-1 text-sm text-white/55">
                  Add goals and track monthly progress.
                </p>
              </div>

              <button
                onClick={() => setGoalModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 hover:text-white"
              >
                <span className="text-emerald-300 text-lg leading-none">＋</span>
                Add new goal
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/55">
                    <th className="px-4 py-4 font-medium">Goal</th>
                    <th className="px-4 py-4 font-medium">Saved</th>
                    <th className="px-4 py-4 font-medium">Target</th>
                    <th className="px-4 py-4 font-medium">Monthly</th>
                    <th className="px-4 py-4 font-medium">ETA</th>
                    <th className="px-4 py-4 font-medium"></th>
                  </tr>
                </thead>

                <tbody>
                  {goals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                        No goals added yet.
                      </td>
                    </tr>
                  ) : (
                    goals.map((goal) => {
                      const saved = Number(goal.saved) || 0;
                      const target = Number(goal.target) || 0;
                      const monthly = Number(goal.monthly) || 0;

                      const ratio =
                        target <= 0 ? 0 : Math.max(0, Math.min(1, saved / target));

                      const remaining = Math.max(0, target - saved);
                      const eta = monthly <= 0 ? null : Math.ceil(remaining / monthly);

                      const goalDone = target > 0 && saved >= target;

                      return (
                        <tr
                          key={goal.id}
                          className="border-b border-white/8 last:border-b-0"
                        >
                          <td className="px-4 py-4">
                            <div className="text-white font-medium leading-snug">
                              {goal.name}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="w-[96px]">
                              <NumberBox
                                value={saved}
                                onChange={(v) =>
                                  updateGoalLocal(goal.id, { saved: Math.max(0, v) })
                                }
                              />
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="w-[110px]">
                              <NumberBox
                                value={target}
                                onChange={(v) =>
                                  updateGoalLocal(goal.id, { target: Math.max(0, v) })
                                }
                              />
                            </div>

                            <div className="mt-2 h-[4px] w-[110px] rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${ratio * 100}%`,
                                  background:
                                    "linear-gradient(90deg,#2dd4bf 0%,#22c55e 100%)",
                                }}
                              />
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="w-[96px]">
                              <NumberBox
                                value={monthly}
                                onChange={(v) =>
                                  updateGoalLocal(goal.id, { monthly: Math.max(0, v) })
                                }
                              />
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            {goalDone ? (
                              <div className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                                Completed
                              </div>
                            ) : (
                              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/85">
                                {eta === null ? "—" : eta === 0 ? "Now" : `${eta} months`}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              className="rounded-lg border border-red-300/15 bg-red-300/8 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-300/12"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-sm text-white/60">Total savings per month</div>
              <div className="mt-1 text-lg font-semibold text-white">
                ${money(totalMonthlySavings)}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-white/70">
              {manualCompleted ? (
                <span className="text-emerald-200">This step is marked as complete.</span>
              ) : autoDone ? (
                <span className="text-emerald-200">Your saving system is active.</span>
              ) : (
                <span>Set at least one monthly saving path to complete this step.</span>
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

      {goalModalOpen && (
        <OverlayShell onClose={() => setGoalModalOpen(false)} maxWidth="max-w-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold text-lg md:text-xl">Add new goal</div>
              <div className="mt-1 text-white/60 text-xs md:text-sm">
                Create a savings goal and track it monthly.
              </div>
            </div>

            <CloseButton onClick={() => setGoalModalOpen(false)} />
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-1.5 block text-sm text-white/65">Goal name</label>
              <input
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="Vacation 2025"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/25"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm text-white/65">Saved</label>
                <MoneyInput value={newGoalSaved} onChange={setNewGoalSaved} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/65">Target</label>
                <MoneyInput value={newGoalTarget} onChange={setNewGoalTarget} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/65">Monthly</label>
                <MoneyInput value={newGoalMonthly} onChange={setNewGoalMonthly} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setGoalModalOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              Cancel
            </button>

            <button
              onClick={addGoal}
              className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-300/15"
            >
              Add Goal
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

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-sm text-white/70">{label}</div>

      <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <span className="text-white/50 text-sm">$</span>
        <input
          className="w-24 bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
        />
      </div>
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <span className="text-white/50 text-sm">$</span>
      <input
        className="w-full bg-transparent outline-none text-right text-sm font-semibold text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}

function NumberBox({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex h-10 w-full items-center rounded-lg border border-white/10 bg-white/[0.04] px-3">
      <input
        className="w-full bg-transparent outline-none text-white text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}