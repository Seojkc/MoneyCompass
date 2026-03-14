"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  upsertUserStepProgress,
  UiUserStepMetric,

  // debts table APIs
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
  interestPct: number; // %
  balance: number;
  totalPayment: number;
};

type Props = {
  userId: string;
  stepKey?: string; // default "debt"
  whyTitle?: string;
  whyContent?: React.ReactNode;
  onCompletionChange?: (done: boolean) => void;

  // fallbacks if DB empty
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

// ---------- helpers ----------
function moneyFmt(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function apiDebtToUi(d: UiUserDebt): Debt {
  return {
    id: d.id,
    name: d.name,
    interestPct: Number((d as any).interest_pct ?? (d as any).interestPct) || 0,
    balance: Number(d.balance) || 0,
    totalPayment: Number((d as any).total_payment ?? (d as any).totalPayment) || 0,
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
  // WHY overlay state
  const [whyOpen, setWhyOpen] = useState(false);

  // Loading/saving states
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hydratedRef = useRef(false);

  // ✅ baseline to prevent “empty table = completed”
  const [initialTotalBalance, setInitialTotalBalance] = useState<number>(0);

  // Data
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [contributing, setContributing] = useState<number>(initialContributing);

  // Debounce map for patch calls (per debt row)
  const patchTimersRef = useRef<Record<string, number | null>>({});

  // Add-dialog
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
      mStrategy === "snowball" || mStrategy === "avalanche" ? mStrategy : initialStrategy;

    const nextContributing = mContrib != null ? Number(mContrib) || 0 : initialContributing;

    return { nextStrategy, nextContributing, map };
  };

  // -------------------- LOAD (metrics + debts table) --------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        // 1) load metrics
        const metrics = await listUserStepMetrics({ userId, stepKey });
        if (!mounted) return;

        const { nextStrategy, nextContributing, map } = parseMetrics(metrics);
        setStrategy(nextStrategy);
        setContributing(nextContributing);

        // 2) load debts from user_debts table
        const debtRows = await listUserDebts({ userId, stepKey });
        if (!mounted) return;

        const uiDebts = (debtRows ?? []).map(apiDebtToUi);

        if (uiDebts.length) {
          setDebts(uiDebts);
        } else {
          // keep fallbacks in UI (don’t auto-insert into DB)
          setDebts(initialDebts);
        }

        hydratedRef.current = true;

        // 3) baseline: set initial_total_balance ONCE if missing
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

          setInitialTotalBalance(Number(totalBal) || 0);
        } else {
          setInitialTotalBalance(initFromDb);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, stepKey]);

  // -------------------- SORTING --------------------
  const sortedDebts = useMemo(() => {
    const copy = [...debts];
    if (strategy === "avalanche") {
      copy.sort((a, b) => b.interestPct - a.interestPct || b.balance - a.balance);
    } else {
      copy.sort((a, b) => a.balance - b.balance || b.interestPct - a.interestPct);
    }
    return copy;

  }, [debts, strategy]);

  const estimatedBalanceNextYear = useMemo(() => {
    return estimateTotalBalanceAfterMonths(debts, 12);
  }, [debts]);

  // -------------------- TOTALS (sum debts table) --------------------
  const totals = useMemo(() => {
    const totalBalance = debts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
    const totalPayment = debts.reduce((sum, d) => sum + (Number(d.totalPayment) || 0), 0);
    return { totalBalance, totalPayment };
  }, [debts]);

  // ✅ Completed only if there was debt initially
  const isDone = useMemo(() => {
    return totals.totalBalance <= 0.00001;
  }, [totals.totalBalance]);

  // notify parent only when changed
  const lastDoneRef = useRef<boolean>(isDone);
  useEffect(() => {
    if (!onCompletionChange) return;
    if (lastDoneRef.current !== isDone) {
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [isDone, onCompletionChange]);

  // months estimate
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
    if ((Number(contributing) || 0) <= 0) return "Set a monthly contribution to see your timeline.";
    if (isDone) return "Debt-free. Your cash flow is now yours again.";
    if ((monthsToDebtFree ?? 0) <= 6) return "You’re very close — keep the momentum.";
    if ((monthsToDebtFree ?? 0) <= 18) return "Consistent payments will change everything.";
    return "This is a long game — small wins, every month.";
  }, [debts.length, contributing, monthsToDebtFree, isDone]);

  // -------------------- SAVE metrics ONLY (strategy + contributing + progress) --------------------
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
        const baseline = Number(initialTotalBalance) || 0;

        const pct =
          baseline <= 0
            ? totals.totalBalance <= 0
              ? 100
              : 0
            : Math.round((1 - totals.totalBalance / baseline) * 100);

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
          progress: Math.max(0, Math.min(100, isDone ? 100 : pct)),
        });

        setSaveState("saved");
        window.setTimeout(() => setSaveState((p) => (p === "saved" ? "idle" : p)), 1200);
      } catch {
        setSaveState("error");
      }
    }, 500);
  };

  useEffect(() => {
    if (loading) return;
    queueSaveMetrics(strategy, contributing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, contributing, totals.totalBalance, isDone, initialTotalBalance]);

  useEffect(() => {
    return () => {
      if (saveMetricsDebounced.current) window.clearTimeout(saveMetricsDebounced.current);
      Object.values(patchTimersRef.current).forEach((t) => t && window.clearTimeout(t));
    };
  }, []);

  // -------------------- DEBT CRUD (table row save) --------------------
  const queuePatchDebt = (id: string, patch: Partial<Debt>) => {
    if (!hydratedRef.current) return;

    const old = patchTimersRef.current[id];
    if (old) window.clearTimeout(old);

    patchTimersRef.current[id] = window.setTimeout(async () => {
      try {
        setSaveState("saving");

        await patchUserDebt(id, {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.interestPct !== undefined ? { interest_pct: Number(patch.interestPct) || 0 } : {}),
          ...(patch.balance !== undefined ? { balance: Number(patch.balance) || 0 } : {}),
          ...(patch.totalPayment !== undefined ? { total_payment: Number(patch.totalPayment) || 0 } : {}),
        });

        setSaveState("saved");
        window.setTimeout(() => setSaveState((p) => (p === "saved" ? "idle" : p)), 900);
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
      window.setTimeout(() => setSaveState((p) => (p === "saved" ? "idle" : p)), 900);
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
      window.setTimeout(() => setSaveState((p) => (p === "saved" ? "idle" : p)), 900);
    } catch {
      setSaveState("error");
    }
  };

  // Close on ESC
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

  // Lock body scroll when overlay open
  useEffect(() => {
    if (!whyOpen && !addOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [whyOpen, addOpen]);

  const defaultWhy = (
    <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-3">
        <h3 className="text-xl md:text-2xl font-semibold text-white">
          💳 Why eliminating high-interest debt changes everything
        </h3>
        <p className="text-white/80 leading-relaxed">
          High-interest debt grows even when you do nothing. Interest is the “silent bill” that keeps charging you
          for the past. Paying debt down is like buying back your monthly freedom.
        </p>
      </div>

      <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-rose-200">
        <div className="font-semibold">⚠️ Interest is a money leak</div>
        <div className="mt-1 text-white/80">
          If you keep high-interest balances, a portion of every paycheck disappears into interest before it can
          build your savings, investing, or life goals.
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-white font-semibold">📉 What interest can cost (approx.)</div>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-4 bg-white/5 text-xs text-white/60">
            <div className="px-3 py-2">Balance</div>
            <div className="px-3 py-2">APR</div>
            <div className="px-3 py-2">Interest / month</div>
            <div className="px-3 py-2">Interest / year</div>
          </div>

          {[
            { bal: 2500, apr: 10 },
            { bal: 5000, apr: 20 },
            { bal: 10000, apr: 24 },
            { bal: 25000, apr: 8 },
          ].map((r) => {
            const monthly = (r.bal * (r.apr / 100)) / 12;
            const yearly = r.bal * (r.apr / 100);

            return (
              <div
                key={`${r.bal}-${r.apr}`}
                className="grid grid-cols-4 border-t border-white/10 bg-black/10 text-sm"
              >
                <div className="px-3 py-2 text-white/85">${moneyFmt(r.bal)}</div>
                <div className="px-3 py-2 text-white/85">{r.apr}%</div>
                <div className="px-3 py-2 text-amber-200/90">${moneyFmt(monthly)}</div>
                <div className="px-3 py-2 text-amber-200/90">${moneyFmt(yearly)}</div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-white/55">
          *Simple estimate (APR ÷ 12). Real interest depends on compounding and your payments — but the “money leak”
          is real.
        </div>
      </div>

      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-200 font-medium">
        👉 Paying off a 20% debt is like a guaranteed 20% return — with zero market risk.
      </div>

      <div className="space-y-3">
        <div className="text-white font-semibold">🧠 Choose a strategy you’ll stick to</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-semibold text-white">⚡ Avalanche</div>
            <div className="mt-1 text-white/75">Highest interest first → saves the most money overall.</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-semibold text-white">🏔 Snowball</div>
            <div className="mt-1 text-white/75">Lowest balance first → faster wins → easier motivation.</div>
          </div>
        </div>

        <div className="text-white/75">Best strategy = the one you can follow for months.</div>
      </div>

      <div className="space-y-3">
        <div className="text-white font-semibold">🛡 How to avoid future unnecessary high debt</div>
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200">
          <ul className="space-y-2">
            <li>✅ Don’t finance “wants” if you can’t repay this month.</li>
            <li>✅ If borrowing is necessary, set a payoff deadline (6–12 months).</li>
            <li>✅ Keep a starter emergency fund to stop debt from returning.</li>
            <li>✅ Credit cards are a payment tool — not extra income.</li>
          </ul>
        </div>
      </div>

      <div className="pt-3 border-t border-white/10 space-y-2">
        <p className="text-lg font-semibold text-white">🧭 Debt freedom is cash flow + peace of mind.</p>
        <p className="text-white/70 italic text-sm">Start small, but start today — momentum compounds too.</p>
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white fs-1 text-3xl">Eliminate High-Interest Debt</h1>

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
            className="text-lg text-white/80 hover:text-white rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
          >
            Why? <span className="ml-1">›</span>
          </button>
        </div>

        {/* Toggle bar */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStrategy("avalanche")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-semibold border transition",
                strategy === "avalanche"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-transparent text-white/60 hover:text-white",
              ].join(" ")}
            >
              Avalanche
              <div className="text-[11px] font-normal text-white/50">Start with highest interest</div>
            </button>

            <button
              onClick={() => setStrategy("snowball")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-semibold border transition",
                strategy === "snowball"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-transparent text-white/60 hover:text-white",
              ].join(" ")}
            >
              Snowball
              <div className="text-[11px] font-normal text-white/50">Start with lowest balance</div>
            </button>
          </div>
        </div>

        {/* Table */}
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
              <div key={d.id} className="grid grid-cols-[1.4fr_.7fr_.8fr_.9fr_.3fr] gap-0 bg-black/10">
                <div className="px-3 py-2">
                  <input
                    className="w-full bg-transparent outline-none text-sm md:text-base font-semibold text-white placeholder:text-white/30"
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
                  <InlineMoney value={d.balance} onChange={(n) => updateDebt(d.id, { balance: n })} />
                </div>

                <div className="px-3 py-2">
                  <InlineMoney value={d.totalPayment} onChange={(n) => updateDebt(d.id, { totalPayment: n })} />
                </div>

                <div className="px-3 py-2 flex justify-end">
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
              <div className="p-4 text-sm text-white/60 bg-black/10">No debts yet. Add one to begin.</div>
            )}
          </div>

          <div className="p-3 bg-black/10 border-t border-white/10">
            <button
              onClick={openAdd}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              + Add new debt
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <MiniMetric label="Total balance" value={`$${moneyFmt(totals.totalBalance)}`} />
          <MiniMetric label="Total payment" value={`$${moneyFmt(totals.totalPayment)}`} />
          <MiniMetric
            label={<span className="text-red-400">Est. total balance next year</span>}
            value={`$${moneyFmt(estimatedBalanceNextYear)}`}
          />
        </div>

        {/* Contribution line */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="text-sm md:text-base text-white/85 flex flex-wrap items-center gap-2">
            <span className="font-semibold">Contributing</span>

            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <span className="text-white/50 text-sm">$</span>
              <input
                className="w-14 bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white"
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
                "ml-1 text-xs rounded-full border px-2 py-1",
                isDone ? "border-green-500/60 text-green-300" : "border-white/15 text-white/50",
              ].join(" ")}
            >
              {isDone ? "Completed ✓" : "In progress"}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-emerald-200/70">
            <span className="w-2 h-2 rounded-full bg-emerald-200/70" />
            {microLine}
          </div>
        </div>
      </section>

      {/* WHY OVERLAY */}
      {whyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button aria-label="Close overlay" onClick={() => setWhyOpen(false)} className="absolute inset-0 bg-black/60" />

          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-lg md:text-xl">{whyTitle}</div>
                <div className="mt-1 text-white/60 text-xs md:text-sm">Quick explanation (tap outside to close).</div>
              </div>

              <button
                onClick={() => setWhyOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

      {/* ADD DEBT DIALOG */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button aria-label="Close dialog" onClick={() => setAddOpen(false)} className="absolute inset-0 bg-black/60" />

          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-lg md:text-xl">Add new debt</div>
                <div className="mt-1 text-white/60 text-xs md:text-sm">Enter details — you can edit anytime later.</div>
              </div>

              <button
                onClick={() => setAddOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Interest %">
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
                    type="number"
                    min={0}
                    value={newDebt.interestPct}
                    onChange={(e) => setNewDebt((p) => ({ ...p, interestPct: Number(e.target.value || 0) }))}
                  />
                </Field>

                <Field label="Balance">
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
                    type="number"
                    min={0}
                    value={newDebt.balance}
                    onChange={(e) => setNewDebt((p) => ({ ...p, balance: Number(e.target.value || 0) }))}
                  />
                </Field>

                <Field label="Total payment">
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
                    type="number"
                    min={0}
                    value={newDebt.totalPayment}
                    onChange={(e) => setNewDebt((p) => ({ ...p, totalPayment: Number(e.target.value || 0) }))}
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

/* ---------------- helpers UI ---------------- */

function MiniMetric({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="rounded-lg border p-3 border-white/10 bg-white/5">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function estimateTotalBalanceAfterMonths(debts: Debt[], months: number) {
  let working = debts.map((d) => ({
    balance: Math.max(0, Number(d.balance) || 0),
    interestPct: Math.max(0, Number(d.interestPct) || 0),
    totalPayment: Math.max(0, Number(d.totalPayment) || 0),
  }));

  for (let i = 0; i < months; i++) {
    working = working.map((d) => {
      if (d.balance <= 0) return d;

      const monthlyRate = d.interestPct / 100 / 12;
      const interestForMonth = d.balance * monthlyRate;

      const nextBalance = d.balance + interestForMonth - d.totalPayment;

      return {
        ...d,
        balance: Math.max(0, nextBalance),
      };
    });
  }

  return working.reduce((sum, d) => sum + d.balance, 0);
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-1">{label}</div>
      {children}
    </div>
  );
}

function InlineMoney({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
      <span className="text-white/50 text-sm">$</span>
      <input
        className="w-24 bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white"
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
        className={[widthClass, "bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white"].join(
          " "
        )}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
      {suffix ? <span className="ml-1 text-white/50 text-sm">{suffix}</span> : null}
    </span>
  );
}