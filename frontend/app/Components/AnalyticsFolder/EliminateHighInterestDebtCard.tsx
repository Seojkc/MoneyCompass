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

  const hasDebtContext = useMemo(() => {
    return initialTotalBalance > 0 || debts.length > 0;
  }, [initialTotalBalance, debts.length]);

  const isDone = useMemo(() => {
    return hasDebtContext && totals.totalBalance <= 0.00001;
  }, [hasDebtContext, totals.totalBalance]);

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
    if (c <= 0) return null;
    return Math.max(0, Math.ceil(totals.totalBalance / c));
  }, [contributing, totals.totalBalance]);

  const debtFreeBy = useMemo(() => {
    if (monthsToDebtFree == null) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToDebtFree);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  }, [monthsToDebtFree]);

  const microLine = useMemo(() => {
    if (!debts.length) return "Add a debt to start your payoff plan.";
    if ((Number(contributing) || 0) <= 0) {
      return "Set a monthly contribution to see your timeline.";
    }
    if (isDone) return "Debt-free. Your cash flow is now yours again.";
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
    <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-2 text-sm text-white/85 md:text-base">
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-white md:text-2xl">
          💳 Why eliminating high-interest debt changes everything
        </h3>
        <p className="leading-relaxed text-white/80">
          High-interest debt grows even when you do nothing. Interest is the “silent
          bill” that keeps charging you for the past. Paying debt down is like buying
          back your monthly freedom.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="fs-1 text-3xl font-semibold text-white">
              Eliminate High-Interest Debt
            </h1>

            <div className="mt-1 text-xs text-white/50">
              {loading
                ? "Loading saved settings…"
                : saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                ? "Saved ✓"
                : saveState === "error"
                ? <span className="text-red-300">Couldn’t save (check API)</span>
                : "Synced"}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-lg text-white/80 hover:text-white"
          >
            Why? <span className="ml-1">›</span>
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStrategy("avalanche")}
              className={[
                "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                strategy === "avalanche"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-transparent text-white/60 hover:text-white",
              ].join(" ")}
            >
              Avalanche
              <div className="text-[11px] font-normal text-white/50">
                Start with highest interest
              </div>
            </button>

            <button
              onClick={() => setStrategy("snowball")}
              className={[
                "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                strategy === "snowball"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-transparent text-white/60 hover:text-white",
              ].join(" ")}
            >
              Snowball
              <div className="text-[11px] font-normal text-white/50">
                Start with lowest balance
              </div>
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[1.4fr_.7fr_.8fr_.9fr_.3fr] gap-0 bg-white/5 text-xs text-white/60">
            <div className="px-3 py-2">Payment name</div>
            <div className="px-3 py-2">Interest</div>
            <div className="px-3 py-2">Balance</div>
            <div className="px-3 py-2">Total payment</div>
            <div className="px-3 py-2 text-right"> </div>
          </div>

          <div className="divide-y divide-white/10">
            {sortedDebts.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[1.4fr_.7fr_.8fr_.9fr_.3fr] gap-0 bg-black/10"
              >
                <div className="px-3 py-2">
                  <input
                    className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30 md:text-base"
                    value={d.name}
                    onChange={(e) => updateDebt(d.id, { name: e.target.value })}
                    placeholder="Debt name"
                  />
                </div>

                <div className="px-3 py-2">
                  <InlineNumber
                    suffix="%"
                    value={d.interestPct}
                    onChange={(n) => updateDebt(d.id, { interestPct: n })}
                    widthClass="w-16"
                  />
                </div>

                <div className="px-3 py-2">
                  <InlineMoney
                    value={d.balance}
                    onChange={(n) => updateDebt(d.id, { balance: n })}
                  />
                </div>

                <div className="px-3 py-2">
                  <InlineMoney
                    value={d.totalPayment}
                    onChange={(n) => updateDebt(d.id, { totalPayment: n })}
                  />
                </div>

                <div className="flex justify-end px-3 py-2">
                  <button
                    onClick={() => removeDebt(d.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:text-white"
                    title="Delete"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {!sortedDebts.length && (
              <div className="bg-black/10 p-4 text-sm text-white/60">
                No debts yet. Add one to begin.
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/10 p-3">
            <button
              onClick={openAdd}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              + Add new debt
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MiniMetric label="Total balance" value={`$${moneyFmt(totals.totalBalance)}`} />
          <MiniMetric label="Total payment" value={`$${moneyFmt(totals.totalPayment)}`} />
          <MiniMetric
            label={<span className="text-red-400">Est. total balance next year</span>}
            value={`$${moneyFmt(estimatedBalanceNextYear)}`}
          />
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/85 md:text-base">
            <span className="font-semibold">Extra contributing</span>

            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <span className="text-sm text-white/50">$</span>
              <input
                className="w-14 bg-transparent text-right text-sm font-semibold text-white outline-none md:text-base"
                type="number"
                value={contributing}
                onChange={(e) => setContributing(Number(e.target.value || 0))}
              />
            </span>

            <span>per month</span>
            <span className="text-white/60">→</span>
            <span className="text-white/70">You&apos;ll be debt-free in</span>

            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-white">
              {monthsToDebtFree === null ? "—" : `${monthsToDebtFree} months`}
            </span>

            <span className="text-white/60">({debtFreeBy ?? "—"})</span>

            <span
              className={[
                "ml-1 rounded-full border px-2 py-1 text-xs",
                isDone
                  ? "border-green-500/60 text-green-300"
                  : "border-white/15 text-white/50",
              ].join(" ")}
            >
              {isDone ? "Completed ✓" : "In progress"}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-emerald-200/70">
            <span className="h-2 w-2 rounded-full bg-emerald-200/70" />
            {microLine}
          </div>
        </div>
      </section>

      {whyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            aria-label="Close overlay"
            onClick={() => setWhyOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white md:text-xl">
                  {whyTitle}
                </div>
                <div className="mt-1 text-xs text-white/60 md:text-sm">
                  Quick explanation (tap outside to close).
                </div>
              </div>

              <button
                onClick={() => setWhyOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4">{whyContent ?? defaultWhy}</div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setWhyOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            aria-label="Close dialog"
            onClick={() => setAddOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white md:text-xl">
                  Add new debt
                </div>
                <div className="mt-1 text-xs text-white/60 md:text-sm">
                  Enter details — you can edit anytime later.
                </div>
              </div>

              <button
                onClick={() => setAddOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Payment name">
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
                  value={newDebt.name}
                  onChange={(e) => setNewDebt((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Credit card"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Interest %">
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
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
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
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
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
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

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={addDebt}
                className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
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
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
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
    <div>
      <div className="mb-1 text-xs text-white/60">{label}</div>
      {children}
    </div>
  );
}

function InlineMoney({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
      <span className="text-sm text-white/50">$</span>
      <input
        className="w-24 bg-transparent text-right text-sm font-semibold text-white outline-none md:text-base"
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
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
      <input
        className={[
          widthClass,
          "bg-transparent text-right text-sm font-semibold text-white outline-none md:text-base",
        ].join(" ")}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
      {suffix ? <span className="ml-1 text-sm text-white/50">{suffix}</span> : null}
    </span>
  );
}