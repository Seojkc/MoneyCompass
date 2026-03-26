"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  upsertUserStepProgress,
  UiUserStepMetric,
  listUserDebts,
  createUserDebt,
  patchUserDebt,
  deleteUserDebt,
  UiUserDebt,
} from "@/lib/bridge";

type Strategy = "avalanche" | "snowball";
type SaveState = "idle" | "saving" | "saved" | "error";

type Debt = {
  id: string;
  name: string;
  interestPct: number;
  balance: number;
  totalPayment: number;
};

type Props = {
  userId: string;
  stepKey?: string;
  whyTitle?: string;
  whyContent?: React.ReactNode;
  onCompletionChange?: (done: boolean) => void;
  initialStrategy?: Strategy;
  initialContributing?: number;
  initialDebts?: Debt[];
};

const DEFAULT_DEBTS: Debt[] = [];

const METRIC_KEYS = {
  strategy: "strategy",
  contributing: "contributing_per_month",
  initialTotalBalance: "initial_total_balance",
} as const;

function moneyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function apiDebtToUi(d: UiUserDebt): Debt {
  return {
    id: d.id,
    name: d.name,
    interestPct: Number((d as any).interest_pct ?? (d as any).interestPct) || 0,
    balance: Number(d.balance) || 0,
    totalPayment:
      Number((d as any).total_payment ?? (d as any).totalPayment) || 0,
  };
}

export default function EliminateHighInterestDebtCard({
  userId,
  stepKey = "debt",
  whyTitle = "Why eliminate high-interest debt?",
  whyContent,
  onCompletionChange,
  initialStrategy = "avalanche",
  initialContributing = 350,
  initialDebts = DEFAULT_DEBTS,
}: Props) {
  const [whyOpen, setWhyOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hydratedRef = useRef(false);

  const [initialTotalBalance, setInitialTotalBalance] = useState<number>(0);

  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [contributing, setContributing] = useState<number>(initialContributing);

  const patchTimersRef = useRef<Record<string, number | null>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [newDebt, setNewDebt] = useState<Omit<Debt, "id">>({
    name: "",
    interestPct: 0,
    balance: 0,
    totalPayment: 0,
  });

  const parseMetrics = (metrics: UiUserStepMetric[]) => {
    const map = new Map<string, UiUserStepMetric>();
    metrics.forEach((m) => map.set(m.metric_key, m));

    const mStrategy = map.get(METRIC_KEYS.strategy)?.value_text;
    const mContrib = map.get(METRIC_KEYS.contributing)?.value_num;

    const nextStrategy: Strategy =
      mStrategy === "snowball" || mStrategy === "avalanche"
        ? mStrategy
        : initialStrategy;

    const nextContributing =
      mContrib != null ? Number(mContrib) || 0 : initialContributing;

    return { nextStrategy, nextContributing, map };
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const metrics = await listUserStepMetrics({ userId, stepKey });
        if (!mounted) return;

        const { nextStrategy, nextContributing, map } = parseMetrics(metrics);
        setStrategy(nextStrategy);
        setContributing(nextContributing);

        const debtRows = await listUserDebts({ userId, stepKey });
        if (!mounted) return;

        const uiDebts = (debtRows ?? []).map(apiDebtToUi);

        if (uiDebts.length) {
          setDebts(uiDebts);
        } else {
          setDebts(initialDebts);
        }

        const initMetric = map.get(METRIC_KEYS.initialTotalBalance)?.value_num;
        const initFromDb = initMetric != null ? Number(initMetric) || 0 : 0;
        const hasInitial = map.has(METRIC_KEYS.initialTotalBalance);

        if (!hasInitial) {
          const totalBal = uiDebts.length
            ? uiDebts.reduce((s, d) => s + (Number(d.balance) || 0), 0)
            : initialDebts.reduce((s, d) => s + (Number(d.balance) || 0), 0);

          await bulkUpsertUserStepMetrics([
            {
              user_id: userId,
              step_key: stepKey,
              metric_key: METRIC_KEYS.initialTotalBalance,
              value_num: Number(totalBal) || 0,
              value_text: null,
            },
          ]);

          if (!mounted) return;
          setInitialTotalBalance(Number(totalBal) || 0);
        } else {
          setInitialTotalBalance(initFromDb);
        }

        hydratedRef.current = true;
        setSaveState("idle");
      } catch {
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
  }, [userId, stepKey, initialContributing, initialDebts, initialStrategy]);

  const sortedDebts = useMemo(() => {
    const copy = [...debts];
    if (strategy === "avalanche") {
      copy.sort((a, b) => b.interestPct - a.interestPct || b.balance - a.balance);
    } else {
      copy.sort((a, b) => a.balance - b.balance || b.interestPct - a.interestPct);
    }
    return copy;
  }, [debts, strategy]);

  const totals = useMemo(() => {
    const totalBalance = debts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
    const totalPayment = debts.reduce(
      (sum, d) => sum + (Number(d.totalPayment) || 0),
      0
    );
    return { totalBalance, totalPayment };
  }, [debts]);

  const estimatedBalanceNextYear = useMemo(() => {
    return estimateBalanceNextYearFromInterestOnly(debts);
  }, [debts]);

  const isDone = useMemo(() => {
    return totals.totalBalance <= 0.00001;
  }, [totals.totalBalance]);

  const progressPct = useMemo(() => {
    const baseline = Number(initialTotalBalance) || 0;

    if (baseline <= 0) {
      return isDone ? 100 : 0;
    }

    return Math.max(
      0,
      Math.min(100, Math.round((1 - totals.totalBalance / baseline) * 100))
    );
  }, [initialTotalBalance, totals.totalBalance, isDone]);

  const lastReportedDoneRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!onCompletionChange) return;
    if (loading) return;

    if (lastReportedDoneRef.current !== isDone) {
      lastReportedDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [isDone, loading, onCompletionChange]);

  const monthsToDebtFree = useMemo(() => {
    const c = Number(contributing) || 0;
    if (c <= 0 || totals.totalBalance <= 0) return 0;
    return Math.max(0, Math.ceil(totals.totalBalance / c));
  }, [contributing, totals.totalBalance]);

  const debtFreeBy = useMemo(() => {
    if (totals.totalBalance <= 0) return "Now";
    if (monthsToDebtFree == null) return null;

    const d = new Date();
    d.setMonth(d.getMonth() + monthsToDebtFree);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  }, [monthsToDebtFree, totals.totalBalance]);

  const microLine = useMemo(() => {
    if (isDone) return "Debt-free. Your cash flow is now yours again.";
    if (!debts.length) return "Add a debt to start your payoff plan.";
    if ((Number(contributing) || 0) <= 0) {
      return "Set a monthly contribution to see your timeline.";
    }
    if ((monthsToDebtFree ?? 0) <= 6) return "You’re very close — keep the momentum.";
    if ((monthsToDebtFree ?? 0) <= 18) {
      return "Consistent payments will change everything.";
    }
    return "This is a long game — small wins, every month.";
  }, [debts.length, contributing, monthsToDebtFree, isDone]);

  const saveMetricsDebounced = useRef<number | null>(null);

  const queueSaveMetrics = (nextStrategy: Strategy, nextContributing: number) => {
    if (!hydratedRef.current) return;

    if (saveMetricsDebounced.current) {
      window.clearTimeout(saveMetricsDebounced.current);
      saveMetricsDebounced.current = null;
    }

    setSaveState("saving");

    saveMetricsDebounced.current = window.setTimeout(async () => {
      try {
        await bulkUpsertUserStepMetrics([
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.strategy,
            value_num: 0,
            value_text: nextStrategy,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.contributing,
            value_num: Number(nextContributing) || 0,
            value_text: null,
          },
        ]);

        await upsertUserStepProgress({
          user_id: userId,
          step_key: stepKey,
          progress: progressPct,
        });

        setSaveState("saved");
        window.setTimeout(() => {
          setSaveState((p) => (p === "saved" ? "idle" : p));
        }, 1200);
      } catch {
        setSaveState("error");
      }
    }, 500);
  };

  useEffect(() => {
    if (loading) return;
    queueSaveMetrics(strategy, contributing);
  }, [loading, strategy, contributing, totals.totalBalance, progressPct]);

  useEffect(() => {
    return () => {
      if (saveMetricsDebounced.current) {
        window.clearTimeout(saveMetricsDebounced.current);
      }
      Object.values(patchTimersRef.current).forEach((t) => {
        if (t) window.clearTimeout(t);
      });
    };
  }, []);

  const queuePatchDebt = (id: string, patch: Partial<Debt>) => {
    if (!hydratedRef.current) return;

    const old = patchTimersRef.current[id];
    if (old) window.clearTimeout(old);

    patchTimersRef.current[id] = window.setTimeout(async () => {
      try {
        setSaveState("saving");

        await patchUserDebt(id, {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.interestPct !== undefined
            ? { interest_pct: Number(patch.interestPct) || 0 }
            : {}),
          ...(patch.balance !== undefined
            ? { balance: Number(patch.balance) || 0 }
            : {}),
          ...(patch.totalPayment !== undefined
            ? { total_payment: Number(patch.totalPayment) || 0 }
            : {}),
        });

        setSaveState("saved");
        window.setTimeout(() => {
          setSaveState((p) => (p === "saved" ? "idle" : p));
        }, 900);
      } catch {
        setSaveState("error");
      }
    }, 450);
  };

  const updateDebt = (id: string, patch: Partial<Debt>) => {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    queuePatchDebt(id, patch);
  };

  const removeDebt = async (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));

    try {
      setSaveState("saving");
      await deleteUserDebt(id);
      setSaveState("saved");
      window.setTimeout(() => {
        setSaveState((p) => (p === "saved" ? "idle" : p));
      }, 900);
    } catch {
      setSaveState("error");
    }
  };

  const openAdd = () => {
    setNewDebt({ name: "", interestPct: 0, balance: 0, totalPayment: 0 });
    setAddOpen(true);
  };

  const addDebt = async () => {
    const name = newDebt.name.trim();
    if (!name) return;

    try {
      setSaveState("saving");

      const created = await createUserDebt({
        user_id: userId,
        step_key: stepKey,
        name,
        interest_pct: Number(newDebt.interestPct) || 0,
        balance: Number(newDebt.balance) || 0,
        total_payment: Number(newDebt.totalPayment) || 0,
      });

      const ui = apiDebtToUi(created);
      setDebts((prev) => [...prev, ui]);
      setAddOpen(false);

      setSaveState("saved");
      window.setTimeout(() => {
        setSaveState((p) => (p === "saved" ? "idle" : p));
      }, 900);
    } catch {
      setSaveState("error");
    }
  };

  useEffect(() => {
    if (!whyOpen && !addOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWhyOpen(false);
        setAddOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [whyOpen, addOpen]);

  useEffect(() => {
    if (!whyOpen && !addOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [whyOpen, addOpen]);

  const defaultWhy = (
    <div className="debt-why-content">
      <div className="debt-why-block">
        <h3>💳 Why eliminating high-interest debt changes everything</h3>
        <p>
          High-interest debt grows even when you do nothing. Interest is the
          silent bill that keeps charging you for the past. Paying debt down is
          like buying back your monthly freedom.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="starter-card debt-card">
        <div className="starter-card__glow" />

        <div className="starter-card__header">
          <div className="starter-card__title-wrap">
            <div className="starter-card__eyebrow">Step 2</div>
            <h1 className="starter-card__title">Eliminate High-Interest Debt</h1>

            <div className="starter-card__status">
              {loading
                ? "Loading saved settings…"
                : saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                ? "Saved ✓"
                : saveState === "error"
                ? <span className="starter-card__status--error">Couldn’t save (check API)</span>
                : "Synced"}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="starter-card__why-btn"
          >
            Why? <span className="starter-card__why-arrow">›</span>
          </button>
        </div>

        <div className="debt-strategy">
          <div className="debt-strategy__grid">
            <button
              onClick={() => setStrategy("avalanche")}
              className={[
                "debt-strategy__btn",
                strategy === "avalanche" ? "debt-strategy__btn--active" : "",
              ].join(" ")}
            >
              <span className="debt-strategy__title">Avalanche</span>
              <span className="debt-strategy__sub">Start with highest interest</span>
            </button>

            <button
              onClick={() => setStrategy("snowball")}
              className={[
                "debt-strategy__btn",
                strategy === "snowball" ? "debt-strategy__btn--active" : "",
              ].join(" ")}
            >
              <span className="debt-strategy__title">Snowball</span>
              <span className="debt-strategy__sub">Start with lowest balance</span>
            </button>
          </div>
        </div>

        <div className="debt-table">
          <div className="debt-table__head debt-table__grid">
            <div>Payment name</div>
            <div>Interest</div>
            <div>Balance</div>
            <div>Total payment</div>
            <div className="debt-table__delete-head"> </div>
          </div>

          <div className="debt-table__body">
            {sortedDebts.map((d) => (
              <div key={d.id} className="debt-table__row debt-table__grid">
                <div className="debt-table__cell">
                  <input
                    className="debt-table__name-input"
                    value={d.name}
                    onChange={(e) => updateDebt(d.id, { name: e.target.value })}
                    placeholder="Debt name"
                  />
                </div>

                <div className="debt-table__cell">
                  <InlineNumber
                    suffix="%"
                    value={d.interestPct}
                    onChange={(n) => updateDebt(d.id, { interestPct: n })}
                    widthClass="w-16"
                  />
                </div>

                <div className="debt-table__cell">
                  <InlineMoney
                    value={d.balance}
                    onChange={(n) => updateDebt(d.id, { balance: n })}
                  />
                </div>

                <div className="debt-table__cell">
                  <InlineMoney
                    value={d.totalPayment}
                    onChange={(n) => updateDebt(d.id, { totalPayment: n })}
                  />
                </div>

                <div className="debt-table__cell debt-table__cell--delete">
                  <button
                    onClick={() => removeDebt(d.id)}
                    className="debt-table__delete-btn"
                    title="Delete"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {!sortedDebts.length && (
              <div className="debt-table__empty">
                No debts yet. Add one to begin.
              </div>
            )}
          </div>

          <div className="debt-table__footer">
            <button onClick={openAdd} className="debt-table__add-btn">
              + Add new debt
            </button>
          </div>
        </div>

        <div className="debt-metrics">
          <MiniMetric label="Total balance" value={`$${moneyFmt(totals.totalBalance)}`} />
          <MiniMetric label="Total payment" value={`$${moneyFmt(totals.totalPayment)}`} />
          <MiniMetric 
            label={<span className="debt-metrics__danger">Est. total balance next year</span>}
            value={`$${moneyFmt(estimatedBalanceNextYear)}`}
          />
        </div>

        <div className="starter-card__body debt-summary">
          <div className="debt-summary__line">
            <span className="debt-summary__label">Extra contributing</span>

            <span className="starter-input starter-input--small">
              <span className="starter-input__currency">$</span>
              <input
                className="starter-input__field starter-input__field--small"
                type="number"
                value={contributing}
                onChange={(e) => setContributing(Number(e.target.value || 0))}
              />
            </span>

            <span className="debt-summary__text">per month</span>
            <span className="debt-summary__arrow">→</span>
            <span className="debt-summary__text">You&apos;ll be debt-free in</span>

            <span className="starter-monthly__pill">
              {monthsToDebtFree === null ? "—" : `${monthsToDebtFree} months`}
            </span>

            <span className="debt-summary__date">({debtFreeBy ?? "—"})</span>

            <span
              className={[
                "starter-monthly__state",
                isDone ? "starter-monthly__state--done" : "",
              ].join(" ")}
            >
              {isDone ? "Completed ✓" : "In progress"}
            </span>
          </div>

          
        </div>
      </section>

      {whyOpen && (
        <div className="starter-modal" role="dialog" aria-modal="true">
          <button
            aria-label="Close overlay"
            onClick={() => setWhyOpen(false)}
            className="starter-modal__backdrop"
          />

          <div className="starter-modal__panel">
            <div className="starter-modal__header">
              <div>
                <div className="starter-modal__title">{whyTitle}</div>
                <div className="starter-modal__subtitle">
                  Quick explanation (tap outside to close).
                </div>
              </div>

              <button
                onClick={() => setWhyOpen(false)}
                className="starter-modal__close"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="starter-modal__body">{whyContent ?? defaultWhy}</div>

            <div className="starter-modal__footer">
              
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="starter-modal" role="dialog" aria-modal="true">
          <button
            aria-label="Close dialog"
            onClick={() => setAddOpen(false)}
            className="starter-modal__backdrop"
          />

          <div className="starter-modal__panel debt-add-modal">
            <div className="starter-modal__header">
              <div>
                <div className="starter-modal__title">Add new debt</div>
                <div className="starter-modal__subtitle">
                  Enter details — you can edit anytime later.
                </div>
              </div>

              <button
                onClick={() => setAddOpen(false)}
                className="starter-modal__close"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="debt-add-modal__form">
              <Field label="Payment name">
                <input
                  className="debt-add-modal__input"
                  value={newDebt.name}
                  onChange={(e) => setNewDebt((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Credit card"
                />
              </Field>

              <div className="debt-add-modal__grid">
                <Field label="Interest %">
                  <input
                    className="debt-add-modal__input"
                    type="number"
                    min={0}
                    value={newDebt.interestPct}
                    onChange={(e) =>
                      setNewDebt((p) => ({
                        ...p,
                        interestPct: Number(e.target.value || 0),
                      }))
                    }
                  />
                </Field>

                <Field label="Balance">
                  <input
                    className="debt-add-modal__input"
                    type="number"
                    min={0}
                    value={newDebt.balance}
                    onChange={(e) =>
                      setNewDebt((p) => ({
                        ...p,
                        balance: Number(e.target.value || 0),
                      }))
                    }
                  />
                </Field>

                <Field label="Total payment">
                  <input
                    className="debt-add-modal__input"
                    type="number"
                    min={0}
                    value={newDebt.totalPayment}
                    onChange={(e) =>
                      setNewDebt((p) => ({
                        ...p,
                        totalPayment: Number(e.target.value || 0),
                      }))
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="starter-modal__footer debt-add-modal__actions">
              <button
                onClick={() => setAddOpen(false)}
                className="starter-modal__action"
              >
                Cancel
              </button>
              <button
                onClick={addDebt}
                className="starter-modal__action debt-add-modal__action--primary"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MiniMetric({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="debt-mini-metric">
      <div className="debt-mini-metric__label">{label}</div>
      <div className="debt-mini-metric__value">{value}</div>
    </div>
  );
}

function estimateBalanceNextYearFromInterestOnly(debts: Debt[]) {
  return debts.reduce((sum, d) => {
    const balance = Math.max(0, Number(d.balance) || 0);
    const interestPct = Math.max(0, Number(d.interestPct) || 0);
    const nextYearBalance = balance + balance * (interestPct / 100);
    return sum + nextYearBalance;
  }, 0);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="debt-field">
      <div className="debt-field__label">{label}</div>
      {children}
    </div>
  );
}

function InlineMoney({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="debt-inline-input">
      <span className="debt-inline-input__prefix">$</span>
      <input
        className="debt-inline-input__field debt-inline-input__field--money"
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </span>
  );
}

function InlineNumber({
  value,
  onChange,
  suffix,
  widthClass = "w-14",
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  widthClass?: string;
}) {
  return (
    <span className="debt-inline-input">
      <input
        className={[
          widthClass,
          "debt-inline-input__field",
        ].join(" ")}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
      {suffix ? <span className="debt-inline-input__suffix">{suffix}</span> : null}
    </span>
  );
}