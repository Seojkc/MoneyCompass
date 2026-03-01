"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";

type Props = {
  // Still supported as fallbacks (if DB has no values yet)
  initialTarget?: number;
  initialSaved?: number;
  initialMonthlySave?: number;

  onCompletionChange?: (done: boolean) => void;

  // Optional: allow parent to pass custom Why content
  whyTitle?: string;
  whyContent?: React.ReactNode;

  // ✅ NEW: required to load/save from DB
  userId: string;

  // ✅ NEW: optional override (default matches your roadmap_steps key)
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

  // WHY overlay state
  const [whyOpen, setWhyOpen] = useState(false);

  // Loading/saving states
  const [loading, setLoading] = useState<boolean>(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false); // prevent saving before initial load
  const lastSavedSnapshotRef = useRef<string>(""); // prevent duplicate saves

  const progress = useMemo(() => {
    if (target <= 0) return 0;
    return Math.max(0, Math.min(1, saved / target));
  }, [saved, target]);

  const protectedPct = Math.round(progress * 100);
  const isDone = progress >= 1;

  // Avoid spamming parent: only notify when done changes
  const lastDoneRef = useRef<boolean>(isDone);

  useEffect(() => {
    if (!onCompletionChange) return;
    if (lastDoneRef.current !== isDone) {
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [isDone, onCompletionChange]);

  // Close on ESC
  useEffect(() => {
    if (!whyOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWhyOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [whyOpen]);

  // Lock body scroll when open
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

  // Dynamic micro-motivation
  const microLine = useMemo(() => {
    if (progress < 0.25) return "Every dollar saved reduces stress.";
    if (progress < 0.75) return "You’re building real financial stability.";
    return "Almost there. Freedom is close.";
  }, [progress]);

  // --------- DB: Load metrics on mount ----------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const metrics = await listUserStepMetrics({ userId, stepKey });

        if (!mounted) return;

        const map = new Map<string, number>();
        metrics.forEach((m: UiUserStepMetric) => map.set(m.metric_key, Number(m.value_num) || 0));

        // Use DB values if present, else fallback props
        const dbTarget = map.get(METRIC_KEYS.target);
        const dbSaved = map.get(METRIC_KEYS.saved);
        const dbMonthly = map.get(METRIC_KEYS.perMonth);

        setTarget(dbTarget != null ? dbTarget : initialTarget);
        setSaved(dbSaved != null ? dbSaved : initialSaved);
        setMonthlySave(dbMonthly != null ? dbMonthly : initialMonthlySave);

        hydratedRef.current = true;

        // set last snapshot to avoid immediate "save" on first render
        const snap = JSON.stringify({
          t: dbTarget != null ? dbTarget : initialTarget,
          s: dbSaved != null ? dbSaved : initialSaved,
          m: dbMonthly != null ? dbMonthly : initialMonthlySave,
        });
        lastSavedSnapshotRef.current = snap;
        setSaveState("idle");
      } catch (e) {
        // If load fails, keep local values but show error state
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

  // --------- DB: Debounced save ----------
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

        // fade "saved" back to idle
        window.setTimeout(() => {
          setSaveState((prev) => (prev === "saved" ? "idle" : prev));
        }, 1200);
      } catch (e) {
        setSaveState("error");
      }
    }, 600); // debounce delay
  };

  // Save whenever values change (debounced)
  useEffect(() => {
    queueSave(target, saved, monthlySave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, saved, monthlySave]);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const defaultWhy = (
    <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-3">
        <h3 className="text-xl md:text-2xl font-semibold text-white">💡 Why This Matters</h3>
        <p className="text-white/80 leading-relaxed">
          Life is unpredictable. A small safety cushion gives you control when unexpected expenses
          appear — instead of reacting with stress or debt.
        </p>
      </div>

      <ul className="space-y-2">
        <li>• Prevents falling into credit card debt during surprises</li>
        <li>• Reduces anxiety because you know you’re prepared</li>
        <li>• Creates a stable foundation before investing</li>
        <li>• Keeps your long-term goals on track even when life happens</li>
      </ul>

      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-200 font-medium">
        👉 Think of this as your financial shock absorber.
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">🧠 Reality Check</h4>
        <p className="text-white/75">
          Even minor events — like a car repair, a dental bill, or a few missed workdays — can
          disrupt your finances if you don’t have a buffer.
        </p>
        <p className="text-white font-medium">
          A starter emergency fund turns “panic moments” into manageable inconveniences.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-white font-semibold">🛠 What Counts as an Emergency</h4>

        <div>
          <div className="text-emerald-300 font-medium mb-1">
            Use this fund only for true unexpected needs:
          </div>
          <ul className="space-y-1 text-emerald-200/90">
            <li>✅ Medical or urgent health costs</li>
            <li>✅ Car repairs needed for daily life</li>
            <li>✅ Essential home fixes (heat, plumbing, safety)</li>
            <li>✅ Emergency travel for family situations</li>
            <li>✅ Temporary income interruption</li>
          </ul>
        </div>

        <div>
          <div className="text-red-300 font-medium mt-3 mb-1">Avoid using it for:</div>
          <ul className="space-y-1 text-red-200/80">
            <li>❌ Shopping or impulse spending</li>
            <li>❌ Vacations or upgrades</li>
            <li>❌ Non-urgent lifestyle choices</li>
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">🎯 Recommended Target</h4>
        <p>Start with a simple goal:</p>
        <ul className="space-y-1">
          <li>
            • Minimum protection: <span className="font-semibold">$1,000</span>
          </li>
          <li>
            • Stronger protection:{" "}
            <span className="font-semibold">1 month of essential expenses</span>
          </li>
        </ul>
        <p className="italic text-white/70">The goal isn’t perfection — it’s protection.</p>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">💰 How to Build It</h4>
        <ul className="space-y-1">
          <li>⬜ Open a separate savings account to avoid temptation</li>
          <li>⬜ Automate a small weekly transfer</li>
          <li>⬜ Direct unexpected money (refunds, gifts, bonuses) here</li>
          <li>⬜ Temporarily reduce one non-essential expense</li>
        </ul>
        <p className="text-white/70">Progress matters more than speed.</p>
      </div>

      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200">
        ⚡ Building this fund is not about restriction — it’s about buying peace of mind.
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">📈 Smart Perspective</h4>
        <p>Saving even a small amount regularly can quickly build resilience.</p>
        <p className="text-white/70 italic">
          What small habit could you adjust today to protect your future self?
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">🔍 Common Mistakes to Avoid</h4>
        <ul className="space-y-1">
          <li>• Investing emergency money in risky assets</li>
          <li>• Keeping it where it gets accidentally spent</li>
          <li>• Waiting until income increases to start</li>
        </ul>
        <p className="font-medium text-white">Starting now — even small — is powerful.</p>
      </div>

      <div className="pt-3 border-t border-white/10 space-y-3">
        <p className="text-lg font-semibold text-white">
          🧭 You’re not just saving money — you’re creating stability and confidence for whatever
          comes next.
        </p>

        <p className="text-white/60 italic text-sm">
          “Do not save what is left after spending, but spend what is left after saving.”
          <br />— Warren Buffett
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white fs-1 text-3xl">
              Starter Emergency Fund
            </h1>

            {/* tiny status */}
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

        {/* Badge */}
        <div className="relative w-fit mx-auto mt-4">
          <div className="rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs md:text-sm text-amber-100">
            You&apos;re <span className="font-semibold">{protectedPct}%</span>{" "}
            protected
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-0 w-0 border-x-[10px] border-x-transparent border-t-[10px] border-t-amber-200/20" />
        </div>

        {/* Progress Bar */}
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
              title={`Saved $${money(saved)}`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white/90 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="absolute right-2 -top-9 flex items-center">
              <div className="relative">
                <div className="rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[11px] text-emerald-100">
                  Target
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-2 h-6">
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
              Target
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mt-6 border-t border-white/10 pt-4 space-y-4">
          <Row
            label="Your Safety Cushion (1 month expenses)"
            value={target}
            onChange={setTarget}
          />
          <Row label="Currently Saved" value={saved} onChange={setSaved} />

          <div>
            <div className="text-sm md:text-base text-white/85 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Saving</span>

              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <span className="text-white/50 text-sm">$</span>
                <input
                  className="w-12 bg-transparent outline-none text-right text-sm md:text-base font-semibold text-white"
                  type="number"
                  value={monthlySave}
                  onChange={(e) => setMonthlySave(Number(e.target.value || 0))}
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

      {/* WHY OVERLAY POPUP */}
      {whyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            aria-label="Close overlay"
            onClick={() => setWhyOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-lg md:text-xl">{whyTitle}</div>
                <div className="mt-1 text-white/60 text-xs md:text-sm">
                  Quick explanation (tap outside to close).
                </div>
              </div>

              <button
                onClick={() => setWhyOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
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