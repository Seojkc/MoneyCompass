"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";
import "../../CSS/TimeLineSteps.css";

type Props = {
  initialTarget?: number;
  initialSaved?: number;
  initialMonthlySave?: number;
  onCompletionChange?: (done: boolean) => void;
  whyTitle?: string;
  whyContent?: React.ReactNode;
  userId: string;
  stepKey?: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const METRIC_KEYS = {
  saved: "current_saved",
  target: "target",
  perMonth: "save_per_month",
} as const;

export default function StarterEmergencyFundCard({
  userId,
  stepKey = "starter-fund",
  initialTarget = 2400,
  initialSaved = 900,
  initialMonthlySave = 200,
  onCompletionChange,
  whyTitle = "Why an emergency fund?",
  whyContent,
}: Props) {
  const [target, setTarget] = useState<number>(initialTarget);
  const [saved, setSaved] = useState<number>(initialSaved);
  const [monthlySave, setMonthlySave] = useState<number>(initialMonthlySave);

  const [whyOpen, setWhyOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const saveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string>("");

  const progress = useMemo(() => {
    if (target <= 0) return 0;
    return Math.max(0, Math.min(1, saved / target));
  }, [saved, target]);

  const protectedPct = Math.round(progress * 100);
  const isDone = progress >= 1;

  const lastDoneRef = useRef<boolean>(isDone);

  useEffect(() => {
    if (!onCompletionChange) return;
    if (lastDoneRef.current !== isDone) {
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [isDone, onCompletionChange]);

  useEffect(() => {
    if (!whyOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWhyOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [whyOpen]);

  useEffect(() => {
    if (!whyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [whyOpen]);

  const ticks = useMemo(() => {
    const t = Math.max(1, target);
    const raw = [0.25, 0.5, 0.75].map((p) => Math.round((t * p) / 50) * 50);
    return Array.from(new Set(raw)).sort((a, b) => a - b);
  }, [target]);

  const monthsToGoal = useMemo(() => {
    const remaining = Math.max(0, target - saved);
    if (monthlySave <= 0) return null;
    return Math.ceil(remaining / monthlySave);
  }, [target, saved, monthlySave]);

  const money = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const microLine = useMemo(() => {
    if (progress < 0.25) return "";
    if (progress < 0.75) return "";
    return "";
  }, [progress]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const metrics = await listUserStepMetrics({ userId, stepKey });

        if (!mounted) return;

        const map = new Map<string, number>();
        metrics.forEach((m: UiUserStepMetric) =>
          map.set(m.metric_key, Number(m.value_num) || 0)
        );

        const dbTarget = map.get(METRIC_KEYS.target);
        const dbSaved = map.get(METRIC_KEYS.saved);
        const dbMonthly = map.get(METRIC_KEYS.perMonth);

        setTarget(dbTarget != null ? dbTarget : initialTarget);
        setSaved(dbSaved != null ? dbSaved : initialSaved);
        setMonthlySave(dbMonthly != null ? dbMonthly : initialMonthlySave);

        hydratedRef.current = true;

        const snap = JSON.stringify({
          t: dbTarget != null ? dbTarget : initialTarget,
          s: dbSaved != null ? dbSaved : initialSaved,
          m: dbMonthly != null ? dbMonthly : initialMonthlySave,
        });
        lastSavedSnapshotRef.current = snap;
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
  }, [userId, stepKey, initialTarget, initialSaved, initialMonthlySave]);

  const queueSave = (nextTarget: number, nextSaved: number, nextMonthly: number) => {
    if (!hydratedRef.current) return;

    const snap = JSON.stringify({ t: nextTarget, s: nextSaved, m: nextMonthly });
    if (snap === lastSavedSnapshotRef.current) return;

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
            metric_key: METRIC_KEYS.saved,
            value_num: Number(nextSaved) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.target,
            value_num: Number(nextTarget) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.perMonth,
            value_num: Number(nextMonthly) || 0,
          },
        ]);

        lastSavedSnapshotRef.current = snap;
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
    queueSave(target, saved, monthlySave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, saved, monthlySave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const defaultWhy = (
    <div className="starter-why-content">
      <div className="starter-why-block">
        <h3>💡 Why This Matters</h3>
        <p>
          Life is unpredictable. A small safety cushion gives you control when
          unexpected expenses appear — instead of reacting with stress or debt.
        </p>
      </div>

      <ul className="starter-why-list">
        <li>• Prevents falling into credit card debt during surprises</li>
        <li>• Reduces anxiety because you know you’re prepared</li>
        <li>• Creates a stable foundation before investing</li>
        <li>• Keeps your long-term goals on track even when life happens</li>
      </ul>

      <div className="starter-why-callout starter-why-callout--amber">
        👉 Think of this as your financial shock absorber.
      </div>

      <div className="starter-why-block">
        <h4>🧠 Reality Check</h4>
        <p>
          Even minor events — like a car repair, a dental bill, or a few missed
          workdays — can disrupt your finances if you don’t have a buffer.
        </p>
        <p className="starter-why-strong">
          A starter emergency fund turns “panic moments” into manageable inconveniences.
        </p>
      </div>

      <div className="starter-why-block">
        <h4>🛠 What Counts as an Emergency</h4>

        <div className="starter-why-subgroup">
          <div className="starter-why-green">Use this fund only for true unexpected needs:</div>
          <ul className="starter-why-list starter-why-list--green">
            <li>✅ Medical or urgent health costs</li>
            <li>✅ Car repairs needed for daily life</li>
            <li>✅ Essential home fixes (heat, plumbing, safety)</li>
            <li>✅ Emergency travel for family situations</li>
            <li>✅ Temporary income interruption</li>
          </ul>
        </div>

        <div className="starter-why-subgroup">
          <div className="starter-why-red">Avoid using it for:</div>
          <ul className="starter-why-list starter-why-list--red">
            <li>❌ Shopping or impulse spending</li>
            <li>❌ Vacations or upgrades</li>
            <li>❌ Non-urgent lifestyle choices</li>
          </ul>
        </div>
      </div>

      <div className="starter-why-block">
        <h4>🎯 Recommended Target</h4>
        <p>Start with a simple goal:</p>
        <ul className="starter-why-list">
          <li>• Minimum protection: <strong>$1,000</strong></li>
          <li>• Stronger protection: <strong>2 months of essential expenses</strong></li>
        </ul>
        <p className="starter-why-muted">
          The goal isn’t perfection — it’s protection.
        </p>
      </div>

      <div className="starter-why-block">
        <h4>💰 How to Build It</h4>
        <ul className="starter-why-list">
          <li>⬜ Open a separate savings account to avoid temptation</li>
          <li>⬜ Automate a small weekly transfer</li>
          <li>⬜ Direct unexpected money (refunds, gifts, bonuses) here</li>
          <li>⬜ Temporarily reduce one non-essential expense</li>
        </ul>
        <p className="starter-why-muted">Progress matters more than speed.</p>
      </div>

      <div className="starter-why-callout starter-why-callout--green">
        ⚡ Building this fund is not about restriction — it’s about buying peace of mind.
      </div>

      <div className="starter-why-block">
        <h4>📈 Smart Perspective</h4>
        <p>Saving even a small amount regularly can quickly build resilience.</p>
        <p className="starter-why-muted">
          What small habit could you adjust today to protect your future self?
        </p>
      </div>

      <div className="starter-why-block">
        <h4>🔍 Common Mistakes to Avoid</h4>
        <ul className="starter-why-list">
          <li>• Investing emergency money in risky assets</li>
          <li>• Keeping it where it gets accidentally spent</li>
          <li>• Waiting until income increases to start</li>
        </ul>
        <p className="starter-why-strong">Starting now — even small — is powerful.</p>
      </div>

      <div className="starter-why-footer">
        <p className="starter-why-closing">
          🧭 You’re not just saving money — you’re creating stability and confidence for whatever
          comes next.
        </p>

        <p className="starter-why-quote">
          “Do not save what is left after spending, but spend what is left after saving.”
          <br />— Warren Buffett
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="starter-card">
        <div className="starter-card__glow" />

        <div className="starter-card__header">
          <div className="starter-card__title-wrap">
            <div className="starter-card__eyebrow">Step 1</div>
            <h1 className="starter-card__title">Starter Emergency Fund</h1>

            <div className="starter-card__status">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="starter-card__status--error">Couldn’t save (check API)</span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button onClick={() => setWhyOpen(true)} className="starter-card__why-btn">
            <span>Why?</span>
            <span className="starter-card__why-arrow">›</span>
          </button>
        </div>

        

        <div className="starter-progress">
          <div className="starter-progress__bar">
            <div className="starter-progress__gradient" />
            <div className="starter-progress__shine" />

            <div
              className="starter-progress__dot"
              style={{ left: `calc(${progress * 100}% - 11px)` }}
              title={`Saved $${money(saved)}`}
            >
              <div className="starter-progress__dot-core" />
            </div>

            
          </div>

          <div className="starter-progress__ticks">
            {ticks.map((v) => (
              <div
                key={v}
                className="starter-progress__tick"
                style={{
                  left: `calc(${(v / Math.max(1, target)) * 100}% - 18px)`,
                }}
              >
                ${money(v)}
              </div>
            ))}
            <div className="starter-progress__target-text">Target</div>
          </div>
        </div>

        <div className="starter-card__body">
          <Row
            label="Your Safety Cushion (2 month expenses)"
            value={target}
            onChange={setTarget}
          />
          <Row label="Currently Saved" value={saved} onChange={setSaved} />

          <div className="starter-monthly">
            <div className="starter-monthly__line">
              <span className="starter-monthly__label">Saving</span>

              <span className="starter-input starter-input--small">
                <span className="starter-input__currency">$</span>
                <input
                  className="starter-input__field starter-input__field--small"
                  type="number"
                  value={monthlySave}
                  onChange={(e) => setMonthlySave(Number(e.target.value || 0))}
                />
              </span>

              <span className="starter-monthly__text">per month</span>
              <span className="starter-monthly__arrow">→</span>
              <span className="starter-monthly__hint">You&apos;ll reach your goal in</span>

              <span className="starter-monthly__pill">
                {monthsToGoal === null ? "—" : `${monthsToGoal} months`}
              </span>

              <span
                className={`starter-monthly__state ${
                  isDone ? "starter-monthly__state--done" : ""
                }`}
              >
                {isDone ? "Completed ✓" : "In progress"}
              </span>
            </div>

           
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
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

            <div className="starter-modal__body">{whyContent ?? defaultWhy}</div>

            
          </div>
        </div>
      )}
    </>
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
    <div className="starter-row">
      <div className="starter-row__label">{label}</div>

      <div className="starter-input">
        <span className="starter-input__currency">$</span>
        <input
          className="starter-input__field"
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
        />
      </div>
    </div>
  );
}