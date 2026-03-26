"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  ensureFullFundMetricsSeeded,
  UiUserStepMetric,
} from "@/lib/bridge";
import "../../CSS/FullEmergencyFundCard.css";

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

        const metrics = await ensureFullFundMetricsSeeded({
          userId,
          stepKey,
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
    <div className="fullfund-why-content">
      <div className="fullfund-why-block">
        <h3>Why a full emergency fund matters</h3>
        <p>
          Life rarely warns us before something changes. A job can pause, an unexpected
          bill can appear, or circumstances can shift overnight. In those moments,
          people without a safety net often face stress, panic, or high-interest debt.
        </p>
        <p>
          A full emergency fund changes that experience completely. Instead of fear
          and urgency, you gain time, clarity, and control over your next move.
        </p>
      </div>

      <div className="fullfund-why-block">
        <h4>What this fund really protects</h4>
        <ul className="fullfund-why-list">
          <li>• Your home and essential living expenses</li>
          <li>• Your ability to recover from unexpected situations</li>
          <li>• Your freedom to make calm decisions instead of rushed ones</li>
          <li>• Your long-term financial progress</li>
        </ul>
      </div>

      <div className="fullfund-why-block">
        <h4>Think about this for a moment</h4>
        <p>
          If your income stopped tomorrow, how long could your essential life continue
          without stress?
        </p>
        <p>A full emergency fund is the answer to that question.</p>
      </div>

      <div className="fullfund-why-callout fullfund-why-callout--green">
        This fund isn’t just money in an account. It’s peace of mind, stability, and
        the confidence that you’re prepared for whatever life brings.
      </div>
    </div>
  );

  const defaultHow = (
    <div className="fullfund-why-content">
      <div className="fullfund-why-block">
        <h3>How to choose the right amount</h3>
        <p>
          Most financial experts recommend saving between <strong>3 to 6 months</strong> of
          essential living expenses. The right number depends on how stable and predictable
          your life situation is.
        </p>
      </div>

      <div className="fullfund-why-block">
        <h4>A 3-month fund may be enough if:</h4>
        <ul className="fullfund-why-list">
          <li>• Your income is stable and predictable</li>
          <li>• You work in a field with strong job demand</li>
          <li>• You have multiple income sources in your household</li>
          <li>• Your monthly essential expenses are relatively low</li>
        </ul>
      </div>

      <div className="fullfund-why-block">
        <h4>A 6-month fund may be safer if:</h4>
        <ul className="fullfund-why-list">
          <li>• Your income is irregular or contract-based</li>
          <li>• You are self-employed or freelancing</li>
          <li>• You support dependents or family members</li>
          <li>• Your job market may take longer to recover from setbacks</li>
          <li>• Your monthly fixed expenses are high</li>
        </ul>
      </div>

      <div className="fullfund-why-block">
        <h4>Remember</h4>
        <p>
          This number isn’t about fear — it’s about confidence. The goal is to build
          enough financial space so that unexpected events don’t force rushed decisions.
        </p>
        <p>
          Choose the level that helps you sleep peacefully at night, knowing your
          essentials are protected.
        </p>
      </div>

      <div className="fullfund-why-callout fullfund-why-callout--amber">
        There is no perfect number. The best emergency fund is the one that gives you
        confidence and keeps your life stable when things don’t go as planned.
      </div>
    </div>
  );

  return (
    <>
      <section className="fullfund-card">
        <div className="fullfund-card__glow" />

        <div className="fullfund-card__header">
          <div className="fullfund-card__title-wrap">
            <div className="fullfund-card__eyebrow">Step 4</div>
            <h1 className="fullfund-card__title">Full Emergency Fund</h1>

            <div className="fullfund-card__status">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="fullfund-card__status--error">
                  Couldn’t save (check API)
                </span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="fullfund-card__why-btn"
          >
            <span>Why?</span>
            <span className="fullfund-card__why-arrow">›</span>
          </button>
        </div>

       

        <div className="fullfund-progress">
          <div className="fullfund-progress__bar">
            <div className="fullfund-progress__gradient" />
            <div className="fullfund-progress__shine" />

            <div
              className="fullfund-progress__dot"
              style={{ left: `calc(${progress * 100}% - 11px)` }}
              title={`Saved $${money(currentSaved)}`}
            >
              <div className="fullfund-progress__dot-core" />
            </div>
          </div>

          <div className="fullfund-progress__ticks">
            <div className="fullfund-progress__tick fullfund-progress__tick--start">$0</div>

            {ticks.map((v) => (
              <div
                key={v}
                className="fullfund-progress__tick"
                style={{
                  left: `calc(${(v / Math.max(1, target)) * 100}% - 18px)`,
                }}
              >
                ${money(v)}
              </div>
            ))}

            <div className="fullfund-progress__target-text">${money(target)}</div>
          </div>
        </div>

        <div className="fullfund-duration">
          <div className="fullfund-duration__header">
            <div>
              <div className="fullfund-duration__title">Emergency fund duration</div>
              <div className="fullfund-duration__subtitle">
                Select your protection level
              </div>
            </div>

            <button
              onClick={() => setHowOpen(true)}
              className="fullfund-duration__help-btn"
            >
              How to choose?
            </button>
          </div>

          <div className="fullfund-duration__toggle-wrap">
            <SwipeToggle value={selectedMonths} onChange={setSelectedMonths} />
          </div>
        </div>

        <div className="fullfund-expenses">
          <div className="fullfund-expenses__head">
            <div>Usually includes</div>
            <div>Amount</div>
          </div>

          <div className="fullfund-expenses__body">
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

          <div className="fullfund-expenses__footer">
            <div>
              <div className="fullfund-expenses__footer-title">
                Total essential expenses
              </div>
              <div className="fullfund-expenses__footer-subtitle">
                Monthly essentials used for target
              </div>
            </div>

            <div className="fullfund-expenses__footer-right">
              <div className="fullfund-expenses__footer-value">
                ${money(essentialMonthlyExpenses)}
              </div>
              <div className="fullfund-expenses__footer-note">per month</div>
            </div>
          </div>
        </div>

        <div className="fullfund-card__body">
          <ReadOnlyCalcRow
            label={`Target (${selectedMonths} months × essential expenses)`}
            value={target}
          />

          <EditableRow
            label="Currently Saved"
            value={currentSaved}
            onChange={setCurrentSaved}
          />

          <div className="fullfund-monthly">
            <div className="fullfund-monthly__line">
              <span className="fullfund-monthly__label">Saving</span>

              <span className="fullfund-input fullfund-input--small">
                <span className="fullfund-input__currency">$</span>
                <input
                  className="fullfund-input__field fullfund-input__field--small"
                  type="number"
                  value={savePerMonth}
                  onChange={(e) => setSavePerMonth(Number(e.target.value || 0))}
                />
              </span>

              <span className="fullfund-monthly__text">per month</span>
              <span className="fullfund-monthly__arrow">→</span>
              <span className="fullfund-monthly__hint">
                You&apos;ll reach your goal in
              </span>

              <span className="fullfund-monthly__pill">
                {monthsToGoal === null ? "—" : `${monthsToGoal} months`}
              </span>

              <span
                className={`fullfund-monthly__state ${
                  isDone ? "fullfund-monthly__state--done" : ""
                }`}
              >
                {isDone ? "Completed ✓" : "In progress"}
              </span>
            </div>

            <div className="fullfund-monthly__micro">
              <span className="fullfund-monthly__micro-dot" />
              {microLine}
            </div>
          </div>
        </div>
      </section>

      {whyOpen && (
        <OverlayShell
          title={whyTitle}
          subtitle=""
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
    <div className="fullfund-toggle">
      <div
        className="fullfund-toggle__pill"
        style={{
          left: value === 3 ? "4px" : "calc(50% + 0px)",
        }}
      />

      <button
        type="button"
        onClick={() => onChange(3)}
        className={`fullfund-toggle__btn ${
          value === 3 ? "fullfund-toggle__btn--active" : ""
        }`}
      >
        <div>3 Months</div>
        <div className="fullfund-toggle__sub">Stable income</div>
      </button>

      <button
        type="button"
        onClick={() => onChange(6)}
        className={`fullfund-toggle__btn ${
          value === 6 ? "fullfund-toggle__btn--active" : ""
        }`}
      >
        <div>6 Months</div>
        <div className="fullfund-toggle__sub">Less stable income</div>
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
    <div className="fullfund-expense-row">
      <div className="fullfund-expense-row__label">{label}</div>

      <div className="fullfund-input fullfund-input--compact">
        <span className="fullfund-input__currency">$</span>
        <input
          className="fullfund-input__field fullfund-input__field--compact"
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
    <div className="fullfund-row">
      <div className="fullfund-row__label">{label}</div>

      <div className="fullfund-input">
        <span className="fullfund-input__currency">$</span>
        <input
          className="fullfund-input__field"
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
    <div className="fullfund-row">
      <div className="fullfund-row__label">{label}</div>

      <div className="fullfund-input fullfund-input--success">
        <span className="fullfund-input__currency fullfund-input__currency--success">$</span>
        <span className="fullfund-input__value fullfund-input__value--success">
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
    <div className="fullfund-modal" role="dialog" aria-modal="true">
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="fullfund-modal__backdrop"
      />

      <div className="fullfund-modal__panel">
        <div className="fullfund-modal__header">
          <div>
            <div className="fullfund-modal__title">{title}</div>
            {subtitle ? (
              <div className="fullfund-modal__subtitle">{subtitle}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="fullfund-modal__close"
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

        <div className="fullfund-modal__body">{children}</div>

        <div className="fullfund-modal__footer">
         
        </div>
      </div>
    </div>
  );
}