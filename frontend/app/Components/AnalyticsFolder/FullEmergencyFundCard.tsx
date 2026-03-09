"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  ensureUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";

type Props = {
  userId: string;
  stepKey?: string;
  onCompletionChange?: (done: boolean) => void;
  whyTitle?: string;
  whyContent?: React.ReactNode;
  howTitle?: string;
  howContent?: React.ReactNode;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type MonthChoice = 3 | 6;

type ExpenseKey =
  | "rent"
  | "utilities"
  | "groceries"
  | "transportation"
  | "phone_internet"
  | "insurance"
  | "minimum_debt_payments"
  | "essential_medical_costs"
  | "child_essentials"
  | "other_expenses";

type ExpensesState = Record<ExpenseKey, number>;

const METRIC_KEYS = {
  rent: "rent",
  utilities: "utilities",
  groceries: "groceries",
  transportation: "transportation",
  phoneInternet: "phone_internet",
  insurance: "insurance",
  minimumDebtPayments: "minimum_debt_payments",
  essentialMedicalCosts: "essential_medical_costs",
  childEssentials: "child_essentials",
  otherExpenses: "other_expenses",
  selectedMonths: "selected_months",
  currentSaved: "current_saved",
  savePerMonth: "save_per_month",
} as const;

const DEFAULT_EXPENSES: ExpensesState = {
  rent: 0,
  utilities: 0,
  groceries: 0,
  transportation: 0,
  phone_internet: 0,
  insurance: 0,
  minimum_debt_payments: 0,
  essential_medical_costs: 0,
  child_essentials: 0,
  other_expenses: 0,
};

const REQUIRED_DEFAULTS = [
  { metric_key: METRIC_KEYS.rent, value_num: 0 },
  { metric_key: METRIC_KEYS.utilities, value_num: 0 },
  { metric_key: METRIC_KEYS.groceries, value_num: 0 },
  { metric_key: METRIC_KEYS.transportation, value_num: 0 },
  { metric_key: METRIC_KEYS.phoneInternet, value_num: 0 },
  { metric_key: METRIC_KEYS.insurance, value_num: 0 },
  { metric_key: METRIC_KEYS.minimumDebtPayments, value_num: 0 },
  { metric_key: METRIC_KEYS.essentialMedicalCosts, value_num: 0 },
  { metric_key: METRIC_KEYS.childEssentials, value_num: 0 },
  { metric_key: METRIC_KEYS.otherExpenses, value_num: 0 },
  { metric_key: METRIC_KEYS.selectedMonths, value_num: 3 },
  { metric_key: METRIC_KEYS.currentSaved, value_num: 0 },
  { metric_key: METRIC_KEYS.savePerMonth, value_num: 0 },
];

export default function FullEmergencyFundCard({
  userId,
  stepKey = "full-fund",
  onCompletionChange,
  whyTitle = "Why a full emergency fund?",
  whyContent,
  howTitle = "How do I choose 3 months or 6 months?",
  howContent,
}: Props) {
  const [expenses, setExpenses] = useState<ExpensesState>(DEFAULT_EXPENSES);
  const [selectedMonths, setSelectedMonths] = useState<MonthChoice>(3);
  const [currentSaved, setCurrentSaved] = useState<number>(0);
  const [savePerMonth, setSavePerMonth] = useState<number>(0);

  const [whyOpen, setWhyOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const saveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");

  const essentialMonthlyExpenses = useMemo(() => {
    return Object.values(expenses).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [expenses]);

  const target = useMemo(() => {
    return essentialMonthlyExpenses * selectedMonths;
  }, [essentialMonthlyExpenses, selectedMonths]);

  const progress = useMemo(() => {
    if (target <= 0) return 0;
    return Math.max(0, Math.min(1, currentSaved / target));
  }, [target, currentSaved]);

  const protectedPct = Math.round(progress * 100);
  const isDone = target > 0 && currentSaved >= target;

  const monthsToGoal = useMemo(() => {
    const remaining = Math.max(0, target - currentSaved);
    if (savePerMonth <= 0) return null;
    return Math.ceil(remaining / savePerMonth);
  }, [target, currentSaved, savePerMonth]);

  const ticks = useMemo(() => {
    const t = Math.max(1, target);
    const raw = [0.25, 0.5, 0.75].map((p) => Math.round((t * p) / 50) * 50);
    return Array.from(new Set(raw)).sort((a, b) => a - b);
  }, [target]);

  const microLine = useMemo(() => {
    if (progress < 0.2) return "A full emergency fund builds real stability.";
    if (progress < 0.5) return "You’re creating a strong financial buffer.";
    if (progress < 0.85) return "You’re moving toward real peace of mind.";
    return "Almost there. Your safety net is getting strong.";
  }, [progress]);

  const money = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const lastDoneRef = useRef<boolean>(isDone);

  useEffect(() => {
    if (!onCompletionChange) return;
    if (lastDoneRef.current !== isDone) {
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [isDone, onCompletionChange]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const metrics = await ensureUserStepMetrics({
          userId,
          stepKey,
          defaults: REQUIRED_DEFAULTS,
        });

        if (!mounted) return;

        const map = new Map<string, number>();
        metrics.forEach((m: UiUserStepMetric) => {
          map.set(m.metric_key, Number(m.value_num) || 0);
        });

        const nextExpenses: ExpensesState = {
          rent: map.get(METRIC_KEYS.rent) ?? 0,
          utilities: map.get(METRIC_KEYS.utilities) ?? 0,
          groceries: map.get(METRIC_KEYS.groceries) ?? 0,
          transportation: map.get(METRIC_KEYS.transportation) ?? 0,
          phone_internet: map.get(METRIC_KEYS.phoneInternet) ?? 0,
          insurance: map.get(METRIC_KEYS.insurance) ?? 0,
          minimum_debt_payments: map.get(METRIC_KEYS.minimumDebtPayments) ?? 0,
          essential_medical_costs: map.get(METRIC_KEYS.essentialMedicalCosts) ?? 0,
          child_essentials: map.get(METRIC_KEYS.childEssentials) ?? 0,
          other_expenses: map.get(METRIC_KEYS.otherExpenses) ?? 0,
        };

        const dbMonths = map.get(METRIC_KEYS.selectedMonths);
        const nextSelectedMonths: MonthChoice = dbMonths === 6 ? 6 : 3;
        const nextCurrentSaved = map.get(METRIC_KEYS.currentSaved) ?? 0;
        const nextSavePerMonth = map.get(METRIC_KEYS.savePerMonth) ?? 0;

        setExpenses(nextExpenses);
        setSelectedMonths(nextSelectedMonths);
        setCurrentSaved(nextCurrentSaved);
        setSavePerMonth(nextSavePerMonth);

        lastSavedSnapshotRef.current = JSON.stringify({
          expenses: nextExpenses,
          selectedMonths: nextSelectedMonths,
          currentSaved: nextCurrentSaved,
          savePerMonth: nextSavePerMonth,
        });

        hydratedRef.current = true;
        setSaveState("idle");
      } catch {
        if (!mounted) return;
        setSaveState("error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, stepKey]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    const snapshot = JSON.stringify({
      expenses,
      selectedMonths,
      currentSaved,
      savePerMonth,
    });

    if (snapshot === lastSavedSnapshotRef.current) return;

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
            metric_key: METRIC_KEYS.rent,
            value_num: Number(expenses.rent) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.utilities,
            value_num: Number(expenses.utilities) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.groceries,
            value_num: Number(expenses.groceries) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.transportation,
            value_num: Number(expenses.transportation) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.phoneInternet,
            value_num: Number(expenses.phone_internet) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.insurance,
            value_num: Number(expenses.insurance) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.minimumDebtPayments,
            value_num: Number(expenses.minimum_debt_payments) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.essentialMedicalCosts,
            value_num: Number(expenses.essential_medical_costs) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.childEssentials,
            value_num: Number(expenses.child_essentials) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.otherExpenses,
            value_num: Number(expenses.other_expenses) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.selectedMonths,
            value_num: Number(selectedMonths) || 3,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.currentSaved,
            value_num: Number(currentSaved) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.savePerMonth,
            value_num: Number(savePerMonth) || 0,
          },
        ]);

        lastSavedSnapshotRef.current = snapshot;
        setSaveState("saved");

        window.setTimeout(() => {
          setSaveState((prev) => (prev === "saved" ? "idle" : prev));
        }, 1200);
      } catch {
        setSaveState("error");
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [expenses, selectedMonths, currentSaved, savePerMonth, userId, stepKey]);

  useEffect(() => {
    if (!(whyOpen || howOpen)) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWhyOpen(false);
        setHowOpen(false);
      }
    };

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [whyOpen, howOpen]);

  const updateExpense = (key: ExpenseKey, value: number) => {
    setExpenses((prev) => ({
      ...prev,
      [key]: Number(value) || 0,
    }));
  };

  const defaultWhy = (
    <div className="space-y-5 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <h3 className="text-xl md:text-2xl font-semibold text-white">Why this matters</h3>
        <p className="leading-relaxed text-white/80">
          A full emergency fund protects your essential life expenses if income drops, work stops,
          or a serious disruption happens.
        </p>
      </div>

      <ul className="space-y-2">
        <li>• Helps prevent high-interest debt during income loss</li>
        <li>• Protects housing, food, bills, and basic stability</li>
        <li>• Gives you time to recover without panic</li>
        <li>• Supports long-term financial progress</li>
      </ul>

      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200">
        A full fund is your financial breathing room.
      </div>
    </div>
  );

  const defaultHow = (
    <div className="space-y-5 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <div className="text-lg md:text-xl font-semibold text-white">Common recommendation</div>
        <p>3 months if income is stable</p>
        <p>6 months if income is unstable</p>
      </div>

      <div className="space-y-2">
        <div className="font-semibold text-white">Could be more if:</div>
        <ul className="space-y-1 text-white/80">
          <li>• self-employed</li>
          <li>• contract worker</li>
          <li>• seasonal job</li>
          <li>• dependents</li>
          <li>• single-income household</li>
          <li>• health uncertainty</li>
          <li>• difficult job market</li>
          <li>• immigration / visa uncertainty</li>
          <li>• large fixed expenses</li>
        </ul>
      </div>

      <div className="space-y-2">
        <div className="font-semibold text-white">Could be less if:</div>
        <ul className="space-y-1 text-white/80">
          <li>• very stable income</li>
          <li>• strong family support</li>
          <li>• dual income household</li>
          <li>• low fixed expenses</li>
        </ul>
      </div>

      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-200">
        The card should guide intelligently, not force one universal number.
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white fs-1 text-3xl">
              Full Emergency Fund
            </h1>

            <div className="mt-1 text-xs text-white/50">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="text-red-300">Couldn’t save (check API)</span>
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

        <div className="relative w-fit mx-auto mt-4">
          <div className="rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs md:text-sm text-amber-100">
            You&apos;re <span className="font-semibold">{protectedPct}%</span> protected
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-0 w-0 border-x-[10px] border-x-transparent border-t-[10px] border-t-amber-200/20" />
        </div>

        <div className="mt-5">
          <div className="relative h-5 rounded-full border border-white/10 overflow-hidden shadow-inner">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg," +
                  "#ff4b4b 0%," +
                  "#ff4b4b 18%," +
                  "#ff7a3d 26%," +
                  "#ffd84a 40%," +
                  "#ffd84a 60%," +
                  "#bfe75f 72%," +
                  "#59e07a 82%," +
                  "#2fd06c 100%)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 to-transparent opacity-25" />

            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-white/25 bg-black/30 shadow transition-[left] duration-300"
              style={{ left: `calc(${progress * 100}% - 10px)` }}
              title={`Saved $${money(currentSaved)}`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white/90 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="absolute right-2 -top-9 flex items-center">
              <div className="rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[11px] text-emerald-100">
                Target
              </div>
            </div>
          </div>

          <div className="relative mt-2 h-6">
            <div className="absolute left-0 top-0 text-xs md:text-sm text-white/70">$0</div>

            {ticks.map((v) => (
              <div
                key={v}
                className="absolute top-0 text-xs md:text-sm text-white/70"
                style={{
                  left: `calc(${(v / Math.max(1, target)) * 100}% - 18px)`,
                }}
              >
                ${money(v)}
              </div>
            ))}

            <div className="absolute right-0 top-0 text-xs md:text-sm text-emerald-200/70">
              ${money(target)}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm md:text-base font-semibold text-white">
                Emergency fund duration
              </div>
              <div className="text-xs md:text-sm text-white/55">
                Select your protection level
              </div>
            </div>

            <button
              onClick={() => setHowOpen(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:text-white"
            >
              How to choose?
            </button>
          </div>

          <div className="mt-4">
            <SwipeToggle
              value={selectedMonths}
              onChange={setSelectedMonths}
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 overflow-hidden w-[60%] mx-auto flex flex-col">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-3 py-2 text-[11px] md:text-xs font-semibold uppercase tracking-wide text-white/60">
            <div>Usually includes</div>
            <div>Amount</div>
          </div>

          <div className="divide-y divide-white/10 flex-1">
            <CompactExpenseRow
              label="Rent / Mortgage"
              value={expenses.rent}
              onChange={(n) => updateExpense("rent", n)}
            />
            <CompactExpenseRow
              label="Utilities"
              value={expenses.utilities}
              onChange={(n) => updateExpense("utilities", n)}
            />
            <CompactExpenseRow
              label="Groceries"
              value={expenses.groceries}
              onChange={(n) => updateExpense("groceries", n)}
            />
            <CompactExpenseRow
              label="Transportation"
              value={expenses.transportation}
              onChange={(n) => updateExpense("transportation", n)}
            />
            <CompactExpenseRow
              label="Phone / Internet"
              value={expenses.phone_internet}
              onChange={(n) => updateExpense("phone_internet", n)}
            />
            <CompactExpenseRow
              label="Insurance"
              value={expenses.insurance}
              onChange={(n) => updateExpense("insurance", n)}
            />
            <CompactExpenseRow
              label="Minimum Debt Payments"
              value={expenses.minimum_debt_payments}
              onChange={(n) => updateExpense("minimum_debt_payments", n)}
            />
            <CompactExpenseRow
              label="Essential Medical Costs"
              value={expenses.essential_medical_costs}
              onChange={(n) => updateExpense("essential_medical_costs", n)}
            />
            <CompactExpenseRow
              label="Child Essentials"
              value={expenses.child_essentials}
              onChange={(n) => updateExpense("child_essentials", n)}
            />
            <CompactExpenseRow
              label="Other Expenses"
              value={expenses.other_expenses}
              onChange={(n) => updateExpense("other_expenses", n)}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-white/10 bg-white/[0.03] px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-white">
            Total essential expenses
              </div>
              <div className="text-[11px] md:text-xs text-white/55">
            Monthly essentials used for target
              </div>
            </div>

            <div className="text-right">
              <div className="text-base md:text-lg font-semibold text-white">
            ${money(essentialMonthlyExpenses)}
              </div>
              <div className="text-[11px] text-white/50">per month</div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 space-y-4">
          <ReadOnlyCalcRow
            label={`Target (${selectedMonths} months × essential expenses)`}
            value={target}
          />

          <EditableRow
            label="Currently Saved"
            value={currentSaved}
            onChange={setCurrentSaved}
          />

          <div>
            <div className="text-sm md:text-base text-white/85 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Saving</span>

              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <span className="text-white/50 text-sm">$</span>
                <input
                  className="w-16 bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white"
                  type="number"
                  value={savePerMonth}
                  onChange={(e) => setSavePerMonth(Number(e.target.value || 0))}
                />
              </span>

              <span>per month</span>
              <span className="text-white/60">→</span>
              <span className="text-white/70">You&apos;ll reach your goal in</span>

              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-white">
                {monthsToGoal === null ? "—" : `${monthsToGoal} months`}
              </span>

              <span
                className={[
                  "ml-1 text-xs rounded-full border px-2 py-1",
                  isDone
                    ? "border-green-500/60 text-green-300"
                    : "border-white/15 text-white/50",
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
        </div>
      </section>

      {whyOpen && (
        <OverlayShell
          title={whyTitle}
          subtitle="Quick explanation (tap outside to close)."
          onClose={() => setWhyOpen(false)}
        >
          {whyContent ?? defaultWhy}
        </OverlayShell>
      )}

      {howOpen && (
        <OverlayShell
          title={howTitle}
          subtitle="Guidance to choose the right target."
          onClose={() => setHowOpen(false)}
        >
          {howContent ?? defaultHow}
        </OverlayShell>
      )}
    </>
  );
}

function SwipeToggle({
  value,
  onChange,
}: {
  value: 3 | 6;
  onChange: (value: 3 | 6) => void;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 overflow-hidden">
      <div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white/10 border border-emerald-300/20 transition-all duration-300"
        style={{
          left: value === 3 ? "4px" : "calc(50% + 0px)",
        }}
      />

      <button
        type="button"
        onClick={() => onChange(3)}
        className={[
          "relative z-10 rounded-lg px-4 py-3 text-sm font-semibold transition",
          value === 3 ? "text-white" : "text-white/60 hover:text-white/80",
        ].join(" ")}
      >
        <div>3 Months</div>
        <div className="mt-0.5 text-[11px] font-normal text-white/55">Stable income</div>
      </button>

      <button
        type="button"
        onClick={() => onChange(6)}
        className={[
          "relative z-10 rounded-lg px-4 py-3 text-sm font-semibold transition",
          value === 6 ? "text-white" : "text-white/60 hover:text-white/80",
        ].join(" ")}
      >
        <div>6 Months</div>
        <div className="mt-0.5 text-[11px] font-normal text-white/55">Less stable income</div>
      </button>
    </div>
  );
}

function CompactExpenseRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2.5 items-center">
      <div className="text-sm text-white/80 leading-tight">{label}</div>

      <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
        <span className="text-white/45 text-xs">$</span>
        <input
          className="w-20 bg-transparent outline-none text-right text-sm font-semibold text-white"
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
        />
      </div>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs md:text-sm text-white/60">{label}</div>

      <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <span className="text-white/50 text-sm">$</span>
        <input
          className="w-24 bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white"
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
        />
      </div>
    </div>
  );
}

function ReadOnlyCalcRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs md:text-sm text-white/60">{label}</div>

      <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/15 bg-emerald-200/10 px-3 py-2">
        <span className="text-emerald-100/70 text-sm">$</span>
        <span className="w-24 text-right text-sm md:text-base font-semibold text-emerald-100">
          {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

function OverlayShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold text-lg md:text-xl">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-white/60 text-xs md:text-sm">{subtitle}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
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
        </div>

        <div className="mt-4">{children}</div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}