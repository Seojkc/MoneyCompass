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
import "../../CSS/AutomateSavingCard.css";

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

  const hasSavingSetup = useMemo(() => {
    return (
      generalMonthly > 0 ||
      generalSaved > 0 ||
      goals.some(
        (g) =>
          Number(g.saved) > 0 ||
          Number(g.target) > 0 ||
          Number(g.monthly) > 0
      )
    );
  }, [generalMonthly, generalSaved, goals]);

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
        const nextCompleted =
          dbCompleted != null ? Number(dbCompleted) === 1 : false;

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
    <div className="autosave-why-content">
      <div className="autosave-why-block">
        <h3>Why automating savings changes everything</h3>
        <p>
          Saving money is not only about numbers. It is about creating peace in
          your life. When saving depends only on memory, motivation, or leftover
          money, it often gets delayed. But when it becomes automatic, something
          powerful happens: <strong>your future starts getting protected on purpose.</strong>
        </p>
      </div>

      <div className="autosave-why-callout autosave-why-callout--blue">
        Automating savings is one of the simplest ways to tell yourself:
        <strong> “I matter. My future matters. My peace matters.”</strong>
      </div>

      <div className="autosave-why-block">
        <h4>Small amounts become real change</h4>
        <p>
          Most people think saving starts when they earn more. But real progress
          usually starts when they create a system. Even small monthly amounts can
          slowly become something meaningful: safety, freedom, confidence, options,
          and breathing room.
        </p>
        <p>It is not about being perfect. It is about becoming consistent.</p>
      </div>

      <div className="autosave-why-block">
        <h4>Why this matters emotionally</h4>
        <p>
          Money stress is heavy. It can quietly affect sleep, confidence,
          relationships, and daily decisions. When you automate savings, you reduce
          that constant pressure little by little.
        </p>
      </div>

      <div className="autosave-why-callout autosave-why-callout--green">
        A savings system is not just money management.
        <strong> It is self-respect in action.</strong>
      </div>

      <div className="autosave-why-block">
        <h4>Why goals matter</h4>
        <p>
          General savings gives you flexibility. Goal-based savings gives you
          direction. One protects you from uncertainty. The other moves you toward
          something meaningful.
        </p>
        <ul className="autosave-why-list">
          <li>• General savings helps you feel more secure</li>
          <li>• Goal savings helps you stay motivated and focused</li>
          <li>• Together, they create balance in your financial life</li>
        </ul>
      </div>

      <div className="autosave-why-block">
        <h4>What automation really does</h4>
        <p>
          Automation removes the need to keep making the same hard decision every
          month. Instead of asking, “Should I save this time?” the decision is
          already made.
        </p>
      </div>

      <div className="autosave-why-callout autosave-why-callout--amber">
        The truth is, your future does not need dramatic changes.
        <strong> It needs a dependable pattern.</strong>
      </div>

      <div className="autosave-why-block">
        <h4>Imagine what this can become</h4>
        <p>
          A few automatic transfers can become your emergency cushion, a travel
          dream, a laptop for your next opportunity, or a step toward freedom.
        </p>
      </div>

      <div className="autosave-why-block">
        <h4>A healthier mindset</h4>
        <p>
          Saving should not feel like punishment. It should feel like care. You are
          not taking money away from yourself. <strong>You are giving something to your future self:</strong>
          stability, choice, and relief.
        </p>
      </div>

      <div className="autosave-why-footer">
        <p>
          Every automatic dollar is a quiet promise:
          <br />
          <span>“I am building a life that feels safer, calmer, and stronger.”</span>
        </p>
        <p className="autosave-why-note">
          Start small. Stay steady. Let the system carry you forward.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="autosave-card">
        <div className="autosave-card__glow" />

        <div className="autosave-card__header">
          <div className="autosave-card__title-wrap">
            <div className="autosave-card__eyebrow">Step 5</div>
            <h1 className="autosave-card__title">Automate Saving</h1>

            <div className="autosave-card__status">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="autosave-card__status--error">Couldn’t save</span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="autosave-card__why-btn"
          >
            <span>Why?</span>
            <span className="autosave-card__why-arrow">›</span>
          </button>
        </div>

        

        <div className="autosave-section">
          <div className="autosave-section__header">
            <div>
              <h2 className="autosave-section__title">General Saving</h2>
              <p className="autosave-section__subtitle">
                For money you want to save without a specific purpose yet.
              </p>
            </div>
          </div>

          <div className="autosave-general-grid">
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

        <div className="autosave-section">
          <div className="autosave-section__header autosave-section__header--split">
            <div>
              <h2 className="autosave-section__title">Saving Goals</h2>
              <p className="autosave-section__subtitle">
                Add goals and track monthly progress.
              </p>
            </div>

            <button
              onClick={() => setGoalModalOpen(true)}
              className="autosave-add-btn"
            >
              <span className="autosave-add-btn__plus">＋</span>
              Add new goal
            </button>
          </div>

          <div className="autosave-goals-table-wrap">
            <table className="autosave-goals-table">
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Saved</th>
                  <th>Target</th>
                  <th>Monthly</th>
                  <th>ETA</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {goals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="autosave-goals-table__empty">
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
                      <tr key={goal.id}>
                        <td>
                          <div className="autosave-goal-name">{goal.name}</div>
                        </td>

                        <td>
                          <div className="autosave-table-input-wrap">
                            <NumberBox
                              value={saved}
                              onChange={(v) =>
                                updateGoalLocal(goal.id, { saved: Math.max(0, v) })
                              }
                            />
                          </div>
                        </td>

                        <td>
                          <div className="autosave-table-input-wrap autosave-table-input-wrap--target">
                            <NumberBox
                              value={target}
                              onChange={(v) =>
                                updateGoalLocal(goal.id, { target: Math.max(0, v) })
                              }
                            />
                            <div className="autosave-goal-progress">
                              <div
                                className="autosave-goal-progress__fill"
                                style={{ width: `${ratio * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="autosave-table-input-wrap">
                            <NumberBox
                              value={monthly}
                              onChange={(v) =>
                                updateGoalLocal(goal.id, { monthly: Math.max(0, v) })
                              }
                            />
                          </div>
                        </td>

                        <td>
                          {goalDone ? (
                            <div className="autosave-eta autosave-eta--done">
                              Completed
                            </div>
                          ) : (
                            <div className="autosave-eta">
                              {eta === null ? "—" : eta === 0 ? "Now" : `${eta} months`}
                            </div>
                          )}
                        </td>

                        <td className="autosave-goals-table__delete-cell">
                          <button
                            onClick={() => deleteGoal(goal.id)}
                            className="autosave-delete-btn"
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

          <div className="autosave-total-box">
            <div className="autosave-total-box__label">Total savings per month</div>
            <div className="autosave-total-box__value">${money(totalMonthlySavings)}</div>
          </div>
        </div>

        <div className="autosave-complete">
          

          <button
            onClick={() => setManualCompleted((prev) => !prev)}
            className={[
              "autosave-complete__btn",
              manualCompleted ? "autosave-complete__btn--done" : "",
            ].join(" ")}
          >
            {manualCompleted ? "Completed ✓" : "Mark as Complete"}
          </button>
        </div>
      </section>

      {whyOpen && (
        <OverlayShell onClose={() => setWhyOpen(false)}>
          <div className="autosave-modal__header">
            <div>
              <div className="autosave-modal__title">{whyTitle}</div>
              <div className="autosave-modal__subtitle">
                Quick explanation (tap outside to close).
              </div>
            </div>

            <CloseButton onClick={() => setWhyOpen(false)} />
          </div>

          <div className="autosave-modal__body">{whyContent ?? defaultWhy}</div>

          <div className="autosave-modal__footer">
            <button
              onClick={() => setWhyOpen(false)}
              className="autosave-modal__secondary"
            >
              Close
            </button>
          </div>
        </OverlayShell>
      )}

      {goalModalOpen && (
        <OverlayShell onClose={() => setGoalModalOpen(false)} maxWidth="autosave-modal--sm">
          <div className="autosave-modal__header">
            <div>
              <div className="autosave-modal__title">Add new goal</div>
              <div className="autosave-modal__subtitle">
                Create a savings goal and track it monthly.
              </div>
            </div>

            <CloseButton onClick={() => setGoalModalOpen(false)} />
          </div>

          <div className="autosave-form">
            <div>
              <label className="autosave-form__label">Goal name</label>
              <input
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="Vacation 2025"
                className="autosave-form__input"
              />
            </div>

            <div className="autosave-form__grid">
              <div>
                <label className="autosave-form__label">Saved</label>
                <MoneyInput value={newGoalSaved} onChange={setNewGoalSaved} />
              </div>

              <div>
                <label className="autosave-form__label">Target</label>
                <MoneyInput value={newGoalTarget} onChange={setNewGoalTarget} />
              </div>

              <div>
                <label className="autosave-form__label">Monthly</label>
                <MoneyInput value={newGoalMonthly} onChange={setNewGoalMonthly} />
              </div>
            </div>
          </div>

          <div className="autosave-modal__footer autosave-modal__footer--split">
            <button
              onClick={() => setGoalModalOpen(false)}
              className="autosave-modal__secondary"
            >
              Cancel
            </button>

            <button
              onClick={addGoal}
              className="autosave-modal__primary"
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
  maxWidth,
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="autosave-modal" role="dialog" aria-modal="true">
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="autosave-modal__backdrop"
      />

      <div
        className={`autosave-modal__panel ${maxWidth ?? ""}`.trim()}
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
      className="autosave-close-btn"
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
    <div className="autosave-row">
      <div className="autosave-row__label">{label}</div>

      <div className="autosave-money-box">
        <span className="autosave-money-box__currency">$</span>
        <input
          className="autosave-money-box__input"
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
    <div className="autosave-money-box autosave-money-box--full">
      <span className="autosave-money-box__currency">$</span>
      <input
        className="autosave-money-box__input autosave-money-box__input--full"
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
    <div className="autosave-number-box">
      <input
        className="autosave-number-box__input"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}