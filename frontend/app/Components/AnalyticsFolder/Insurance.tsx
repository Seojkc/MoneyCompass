"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";
import "../../CSS/InsuranceCard.css";

type InsuranceItemKey =
  | "health-insurance"
  | "dependent-health-insurance"
  | "term-insurance"
  | "disability-insurance";

type InsuranceItem = {
  key: InsuranceItemKey;
  label: string;
  optional: boolean;
  checked: boolean;
  whyTitle: string;
  whyContent?: React.ReactNode;
};

type Props = {
  userId: string;
  stepKey?: string;
  onCompletionChange?: (done: boolean) => void;
  whyTitle?: string;
  whyContent?: React.ReactNode;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const METRIC_KEYS: Record<InsuranceItemKey, string> = {
  "health-insurance": "health_insurance",
  "dependent-health-insurance": "dependent_health_insurance",
  "term-insurance": "term_insurance",
  "disability-insurance": "disability_insurance",
};

const INITIAL_ITEMS: InsuranceItem[] = [
  {
    key: "health-insurance",
    label: "Health Insurance",
    optional: false,
    checked: false,
    whyTitle: "Why Health Insurance?",
    whyContent: (
      <div className="insurance-why-content">
        <div className="insurance-why-block">
          <h3>❤️ Why Health Insurance Matters</h3>
          <p>
            Health is one of the most important foundations of your life.
            Everything you build — your work, your dreams, your relationships —
            depends on it.
          </p>
          <p>
            But healthcare costs can appear suddenly and unexpectedly.
            A single hospital visit, medical treatment, or emergency procedure
            can cost far more than most people expect.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--rose">
          <p>
            When health problems arrive, the last thing anyone should worry about
            is money.
          </p>
          <p>
            Health insurance ensures that when you need care,
            you can focus on healing — not financial stress.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>💡 What Health Insurance Really Protects</h4>
          <ul className="insurance-why-list">
            <li>• Protection from unexpected medical bills</li>
            <li>• Access to doctors, hospitals, and treatments</li>
            <li>• Financial security during medical emergencies</li>
            <li>• Peace of mind for you and your loved ones</li>
          </ul>
        </div>

        <div className="insurance-why-block">
          <h4>🌱 Why People Often Delay It</h4>
          <p>
            Many people believe they are young, healthy, and unlikely to need it.
            So they postpone getting coverage.
          </p>
          <p>
            But health insurance is most valuable when it is already in place
            before something unexpected happens.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--green">
          <p>
            Health insurance is not just about medical bills.
            It is about protecting your future and preserving the financial
            stability you are working hard to build.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>🛡 Think of It This Way</h4>
          <p>
            You protect your phone with a case. You insure your car. You lock your home.
          </p>
          <p>
            Your health is far more valuable than all of those things combined.
            Protecting it is one of the smartest financial decisions you can make.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--amber">
          <p>The goal of health insurance is simple:</p>
          <p>
            If life brings an unexpected medical challenge,
            your savings, your progress, and your future goals remain protected.
          </p>
        </div>

        <div className="insurance-why-footer">
          <p className="insurance-why-closing">
            🌿 Health insurance gives you something priceless:
            the ability to focus on living your life without fear of
            a medical crisis becoming a financial crisis.
          </p>
          <p className="insurance-why-quote">
            Taking care of your health also means protecting your financial future.
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "dependent-health-insurance",
    label: "Dependent Health Insurance",
    optional: true,
    checked: false,
    whyTitle: "Why Dependent Health Insurance?",
    whyContent: (
      <div className="insurance-why-content">
        <div className="insurance-why-block">
          <h3>👨‍👩‍👧 Why Dependent Health Insurance Matters</h3>
          <p>
            When someone depends on you, your responsibility becomes bigger than
            just taking care of yourself.
          </p>
          <p>
            Whether it is your spouse, children, or family members who rely on you,
            their health and well-being naturally become one of your top priorities.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--rose">
          <p>
            A medical emergency affecting someone you love can be emotionally
            overwhelming.
          </p>
          <p>
            Dependent health insurance ensures that during those moments,
            financial stress does not make a difficult situation even harder.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>💡 What Dependent Coverage Provides</h4>
          <ul className="insurance-why-list">
            <li>• Medical coverage for family members who rely on you</li>
            <li>• Protection against unexpected healthcare costs</li>
            <li>• Access to necessary treatments when they need it most</li>
            <li>• Peace of mind knowing your loved ones are protected</li>
          </ul>
        </div>

        <div className="insurance-why-block">
          <h4>❤️ It’s More Than Just Insurance</h4>
          <p>
            Choosing dependent coverage is an act of care.
            It reflects the quiet promise you make to the people who trust you:
          </p>
          <div className="insurance-why-mini-card">
            “No matter what happens, I want you to be safe and protected.”
          </div>
        </div>

        <div className="insurance-why-callout insurance-why-callout--green">
          <p>
            When your loved ones are protected, you gain something priceless:
            the peace of mind that the people who matter most will always have
            access to care when they need it.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>🌱 Thinking About the Future</h4>
          <p>
            Life is full of beautiful moments — but also unexpected challenges.
            Protecting your dependents today helps ensure that those challenges
            never turn into financial hardship for your family.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--amber">
          <p>
            Dependent health insurance is not just about policies or paperwork.
          </p>
          <p>It is about protecting the people who bring meaning to your life.</p>
        </div>

        <div className="insurance-why-footer">
          <p className="insurance-why-closing">
            🌿 When the people you love are protected, you can move through life
            with greater confidence, knowing their health and safety are secured.
          </p>
          <p className="insurance-why-quote">
            Sometimes the best financial decisions are simply the ones that protect
            the people who matter most.
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "term-insurance",
    label: "Term Insurance",
    optional: true,
    checked: false,
    whyTitle: "Why Term Insurance?",
    whyContent: (
      <div className="insurance-why-content">
        <div className="insurance-why-block">
          <h3>❤️ Why Term Life Insurance Matters</h3>
          <p>
            Life insurance is one of the quietest and most powerful acts of love.
          </p>
          <p>
            It is not something you buy for yourself.
            It is something you choose for the people who would feel your absence the most.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--rose">
          <p>
            The people who depend on you — your partner, children, or family —
            rely on your presence, your care, and often your financial support.
          </p>
          <p>
            Term insurance ensures that if life ever changes unexpectedly,
            their stability and security are still protected.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>💡 What Term Insurance Protects</h4>
          <ul className="insurance-why-list">
            <li>• Your family’s financial stability</li>
            <li>• Daily living expenses for loved ones</li>
            <li>• Children’s education and future goals</li>
            <li>• Protection from financial hardship during a difficult time</li>
          </ul>
        </div>

        <div className="insurance-why-block">
          <h4>❤️ The Real Meaning Behind It</h4>
          <p>
            Term insurance is not about expecting the worst.
            It is about taking responsibility for the people who matter most to you.
          </p>
          <div className="insurance-why-mini-card">
            It says: “Even if I am not there one day, I still want you to be safe.”
          </div>
        </div>

        <div className="insurance-why-callout insurance-why-callout--green">
          <p>
            Term insurance transforms uncertainty into protection.
            It allows your loved ones to continue their lives with dignity,
            stability, and opportunity.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>🌱 Why People Often Wait</h4>
          <p>
            Many people postpone life insurance because it feels like something
            they can think about later.
          </p>
          <p>
            But the best time to build protection is when life is stable,
            when decisions can be made calmly and thoughtfully.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--amber">
          <p>Term insurance is not about preparing for loss.</p>
          <p>
            It is about ensuring that the people you love never have to face
            financial uncertainty during one of the most difficult moments of life.
          </p>
        </div>

        <div className="insurance-why-footer">
          <p className="insurance-why-closing">
            🌿 One decision today can protect the future of the people you love most.
          </p>
          <p className="insurance-why-quote">
            True protection is not always visible — but it can make all the
            difference when it matters most.
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "disability-insurance",
    label: "Disability Insurance",
    optional: true,
    checked: false,
    whyTitle: "Why Disability Insurance?",
    whyContent: (
      <div className="insurance-why-content">
        <div className="insurance-why-block">
          <h3>💼 Why Disability Insurance Matters</h3>
          <p>
            Most people insure their phone, their car, or their home.
            But many forget to protect the one thing that makes all of those
            possible — their ability to earn an income.
          </p>
          <p>
            Your income is one of your greatest financial assets.
            It fuels your savings, supports your family, and helps you build the
            future you imagine.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--amber">
          <p>
            If an illness or injury temporarily prevents you from working,
            disability insurance helps ensure that your financial life
            continues to move forward.
          </p>
          <p>
            It provides support when your ability to earn is interrupted,
            allowing you to focus on recovery instead of financial pressure.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>💡 What Disability Insurance Protects</h4>
          <ul className="insurance-why-list">
            <li>• A portion of your monthly income if you cannot work</li>
            <li>• Stability for your household during recovery</li>
            <li>• Protection for your savings and investments</li>
            <li>• Time and peace of mind to focus on healing</li>
          </ul>
        </div>

        <div className="insurance-why-block">
          <h4>🌱 Why It’s Often Overlooked</h4>
          <p>
            Many people think disability insurance is only necessary for
            dangerous jobs or older workers.
          </p>
          <p>
            In reality, unexpected injuries or health conditions can happen to
            anyone — and even a few months without income can place enormous
            pressure on financial stability.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--green">
          <p>
            Disability insurance protects the engine of your financial life:
            your ability to earn and provide.
          </p>
          <p>
            When that engine is protected, your goals, savings, and future plans
            remain secure even during unexpected setbacks.
          </p>
        </div>

        <div className="insurance-why-block">
          <h4>🧠 A Different Perspective</h4>
          <p>
            Imagine protecting your financial journey the same way athletes
            protect their careers — by preparing for the unexpected before it
            happens.
          </p>
          <p>
            Disability insurance is not about expecting problems.
            It is about respecting the value of the income you work so hard to earn.
          </p>
        </div>

        <div className="insurance-why-callout insurance-why-callout--rose">
          <p>
            Your ability to work is one of the most powerful tools you have for
            building your future.
          </p>
          <p>
            Protecting it ensures that even if life slows you down temporarily,
            your financial progress does not stop.
          </p>
        </div>

        <div className="insurance-why-footer">
          <p className="insurance-why-closing">
            🌿 Disability insurance gives you something invaluable:
            the confidence that your income — and everything it supports —
            remains protected.
          </p>
          <p className="insurance-why-quote">
            Protecting your ability to earn is one of the smartest financial
            decisions you can make.
          </p>
        </div>
      </div>
    ),
  },
];

export default function InsuranceCard({
  userId,
  stepKey = "insurance",
  onCompletionChange,
  whyTitle = "Why insurance matters",
  whyContent,
}: Props) {
  const [items, setItems] = useState<InsuranceItem[]>(INITIAL_ITEMS);

  const [whyOpen, setWhyOpen] = useState(false);
  const [activeWhy, setActiveWhy] = useState<{
    title: string;
    content?: React.ReactNode;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string>("");

  const isDone = useMemo(() => {
    return items.find((item) => item.key === "health-insurance")?.checked ?? false;
  }, [items]);

  const completedCount = useMemo(() => {
    return items.filter((item) => item.checked).length;
  }, [items]);

  const totalCount = items.length;
  const progress = totalCount === 0 ? 0 : completedCount / totalCount;
  const progressPct = Math.round(progress * 100);

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const metrics = await listUserStepMetrics({ userId, stepKey });

        if (!mounted) return;

        const metricMap = new Map<string, number>();
        metrics.forEach((m: UiUserStepMetric) => {
          metricMap.set(m.metric_key, Number(m.value_num) || 0);
        });

        const nextItems = INITIAL_ITEMS.map((item) => ({
          ...item,
          checked: (metricMap.get(METRIC_KEYS[item.key]) ?? 0) === 1,
        }));

        setItems(nextItems);
        hydratedRef.current = true;

        const snap = JSON.stringify(
          nextItems.map((item) => ({
            key: item.key,
            checked: item.checked ? 1 : 0,
          }))
        );

        lastSavedSnapshotRef.current = snap;
        setSaveState("idle");
      } catch (error) {
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

  const queueSave = (nextItems: InsuranceItem[]) => {
    if (!hydratedRef.current) return;

    const snap = JSON.stringify(
      nextItems.map((item) => ({
        key: item.key,
        checked: item.checked ? 1 : 0,
      }))
    );

    if (snap === lastSavedSnapshotRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await bulkUpsertUserStepMetrics(
          nextItems.map((item) => ({
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS[item.key],
            value_num: item.checked ? 1 : 0,
          }))
        );

        lastSavedSnapshotRef.current = snap;
        setSaveState("saved");

        window.setTimeout(() => {
          setSaveState((prev) => (prev === "saved" ? "idle" : prev));
        }, 1200);
      } catch (error) {
        setSaveState("error");
      }
    }, 600);
  };

  useEffect(() => {
    queueSave(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const toggleItem = (key: InsuranceItemKey) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const openWhy = (title: string, content?: React.ReactNode) => {
    setActiveWhy({ title, content });
    setWhyOpen(true);
  };

  const defaultWhy = (
    <div className="insurance-why-content">
      <div className="insurance-why-block">
        <h3>🛡 Why Insurance Matters</h3>
        <p>
          Most people do not think about insurance when life feels normal.
          That is exactly why it matters.
        </p>
        <p>
          Insurance is not something you buy because you expect the worst.
          You choose it because you care deeply about your future, your peace,
          your health, and the people who depend on you.
        </p>
      </div>

      <div className="insurance-why-callout insurance-why-callout--amber">
        <p>
          One unexpected moment can change everything financially.
          A medical bill, an illness, an accident, or time away from work can
          place heavy pressure on your savings and your family.
        </p>
        <p>
          Insurance helps make sure that one difficult moment does not become a
          long financial struggle.
        </p>
      </div>

      <div className="insurance-why-block">
        <h4>💡 The Real Meaning of Insurance</h4>
        <p>
          Insurance is more than a policy. It is a quiet promise to yourself:
          <strong> “If life becomes hard, I will still have protection.”</strong>
        </p>
        <p>
          It protects the money you worked hard to earn.
          It protects the progress you fought hard to build.
          And sometimes, it protects the people you love from carrying a burden
          they should never have to carry alone.
        </p>
      </div>

      <div className="insurance-why-block">
        <h4>❤️ Why People Often Delay It</h4>
        <p>
          Many people think, “I am still young.” Or, “Nothing will happen to me.”
          Or, “I will do it later when life is more settled.”
        </p>
        <p>
          But life does not always wait for the perfect time.
          Protection matters most when it is already in place before you need it.
        </p>
      </div>

      <div className="insurance-why-callout insurance-why-callout--green">
        <p>
          Insurance is not about fear. It is about strength, responsibility, and peace of mind.
        </p>
        <p>
          It allows you to move through life with more confidence because you know
          one setback does not have the power to destroy everything you built.
        </p>
      </div>

      <div className="insurance-why-block">
        <h4>🌿 What Each Protection Can Mean</h4>

        <div className="insurance-why-mini-card">
          <strong>Health Insurance</strong>
          <p>
            Your health is your foundation. When something unexpected happens,
            the last thing you should worry about is how to afford care.
          </p>
        </div>

        <div className="insurance-why-mini-card">
          <strong>Dependent Health Insurance</strong>
          <p>
            Protecting your dependents means protecting the people whose well-being
            matters deeply to you.
          </p>
        </div>

        <div className="insurance-why-mini-card">
          <strong>Term Insurance</strong>
          <p>
            It says that even if you are not there one day, your loved ones should
            still have financial support and stability.
          </p>
        </div>

        <div className="insurance-why-mini-card">
          <strong>Disability Insurance</strong>
          <p>
            Your ability to work is one of your greatest financial assets.
            Disability insurance helps protect that if life suddenly changes.
          </p>
        </div>
      </div>

      <div className="insurance-why-callout insurance-why-callout--rose">
        <p>
          Choosing insurance is one of the quietest and strongest ways to say:
          <strong> “I am protecting what matters.”</strong>
        </p>
      </div>

      <div className="insurance-why-footer">
        <p className="insurance-why-closing">
          🌍 Insurance gives you the ability to face life with more confidence,
          less fear, and greater peace.
        </p>
        <p className="insurance-why-quote">
          Protecting yourself is not negativity. It is self-respect, responsibility,
          and love in action.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="insurance-card">
        <div className="insurance-card__glow" />

        <div className="insurance-card__header">
          <div className="insurance-card__title-wrap">
            <div className="insurance-card__eyebrow">Step 3</div>
            <h1 className="insurance-card__title">Insurance</h1>

            <div className="insurance-card__status">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="insurance-card__status--error">
                  Couldn’t save (check API)
                </span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button
            onClick={() => openWhy(whyTitle, whyContent)}
            className="insurance-card__why-btn"
          >
            <span>Why?</span>
            <span className="insurance-card__why-arrow">›</span>
          </button>
        </div>

       

      

        <div className="insurance-card__summary">
          

          <div
            className={`insurance-card__summary-state ${
              isDone ? "insurance-card__summary-state--done" : ""
            }`}
          >
            {isDone ? "Completed ✓" : "In progress"}
          </div>
        </div>

        <div className="insurance-card__micro">
          <span className="insurance-card__micro-dot" />
          Protect the essentials first, then add optional layers as needed.
        </div>

        <div className="insurance-card__body">
          {items.map((item) => (
            <InsuranceRow
              key={item.key}
              label={item.label}
              checked={item.checked}
              optional={item.optional}
              onToggle={() => toggleItem(item.key)}
              onWhy={() => openWhy(item.whyTitle, item.whyContent)}
            />
          ))}
        </div>
      </section>

      {whyOpen && (
        <div className="insurance-modal" role="dialog" aria-modal="true">
          <button
            aria-label="Close overlay"
            onClick={() => setWhyOpen(false)}
            className="insurance-modal__backdrop"
          />

          <div className="insurance-modal__panel">
            <div className="insurance-modal__header">
              <div>
                <div className="insurance-modal__title">
                  {activeWhy?.title || whyTitle}
                </div>
                <div className="insurance-modal__subtitle">
                  Learn why this protection matters
                </div>
              </div>

              <button
                onClick={() => setWhyOpen(false)}
                className="insurance-modal__close"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="insurance-modal__body">
              {activeWhy?.content || whyContent || defaultWhy}
            </div>

            <div className="insurance-modal__footer">
              
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InsuranceRow({
  label,
  checked,
  optional,
  onToggle,
  onWhy,
}: {
  label: string;
  checked: boolean;
  optional?: boolean;
  onToggle: () => void;
  onWhy: () => void;
}) {
  return (
    <div className={`insurance-row ${checked ? "insurance-row--checked" : ""}`}>
      <button
        type="button"
        className={`insurance-row__check ${checked ? "insurance-row__check--checked" : ""}`}
        onClick={onToggle}
        aria-pressed={checked}
      >
        <span className="insurance-row__check-inner">{checked ? "✓" : ""}</span>
      </button>

      <div className="insurance-row__content">
        <div className="insurance-row__top">
          <div className="insurance-row__label-wrap">
            <div className="insurance-row__label">{label}</div>
            <span
              className={`insurance-row__tag ${
                optional ? "insurance-row__tag--optional" : "insurance-row__tag--required"
              }`}
            >
              {optional ? "Optional" : "Essential"}
            </span>
          </div>

          <button
            type="button"
            className="insurance-row__why-btn"
            onClick={onWhy}
          >
            Why?
          </button>
        </div>

       
      </div>
    </div>
  );
}