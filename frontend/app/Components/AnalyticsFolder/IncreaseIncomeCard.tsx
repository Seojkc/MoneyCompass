"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";
import "../../CSS/IncreaseIncomeCard.css";

type Props = {
  userId: string;
  stepKey?: string;
  onCompletionChange?: (done: boolean) => void;
  whyTitle?: string;
  whyContent?: React.ReactNode;
  initialStrategies?: IncomeStrategy[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

type IncomeStrategy =
  | "career"
  | "skills"
  | "side-hustle"
  | "passive"
  | "business"
  | "investing";

type StrategyItem = {
  key: IncomeStrategy;
  label: string;
  short: string;
  description: string;
};

const METRIC_KEYS = {
  completed: "is_completed",
} as const;

const DEFAULT_STRATEGIES: IncomeStrategy[] = ["career", "skills"];

const STRATEGIES: StrategyItem[] = [
  {
    key: "career",
    label: "Career Advancement",
    short: "Promotion, new role, salary negotiation",
    description:
      "Grow income through promotions, better roles, switching companies, or negotiating compensation.",
  },
  {
    key: "skills",
    label: "Education / Skill Development",
    short: "Certifications, training, courses",
    description:
      "Learning valuable skills can multiply your earning power over time.",
  },
  {
    key: "side-hustle",
    label: "Side Income",
    short: "Freelancing, tutoring, consulting",
    description:
      "Additional monthly income can meaningfully increase savings and investing power.",
  },
  {
    key: "passive",
    label: "Passive Income",
    short: "Dividends, rentals, digital products",
    description:
      "Income streams that can continue with less ongoing effort.",
  },
  {
    key: "business",
    label: "Entrepreneurship",
    short: "Small business, local services, online store",
    description:
      "Higher risk, but potentially much larger upside and flexibility.",
  },
  {
    key: "investing",
    label: "Investing Income",
    short: "Dividends, interest, capital gains",
    description:
      "Over time, your money can begin producing income on its own.",
  },
];

export default function IncreaseIncomeCard({
  userId,
  stepKey = "income",
  onCompletionChange,
  whyTitle = "Why increase income?",
  whyContent,
  initialStrategies,
}: Props) {
  const safeInitialStrategies = initialStrategies ?? DEFAULT_STRATEGIES;

  const [selectedStrategies, setSelectedStrategies] =
    useState<IncomeStrategy[]>(safeInitialStrategies);

  const [manualCompleted, setManualCompleted] = useState(false);

  const [whyOpen, setWhyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastMetricSnapshotRef = useRef<string>("");
  const lastDoneRef = useRef<boolean>(false);

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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

        const map = new Map<string, UiUserStepMetric>();
        metrics.forEach((m) => map.set(m.metric_key, m));

        const dbCompleted = map.get(METRIC_KEYS.completed)?.value_num;
        const nextCompleted =
          dbCompleted != null ? Number(dbCompleted) === 1 : false;

        setManualCompleted(nextCompleted);

        lastMetricSnapshotRef.current = JSON.stringify({
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
  }, [userId, stepKey]);

  const queueMetricSave = (nextManualCompleted: boolean) => {
    if (!hydratedRef.current) return;

    const snap = JSON.stringify({
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
    queueMetricSave(manualCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualCompleted]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const toggleStrategy = (key: IncomeStrategy) => {
    setSelectedStrategies((prev) => {
      if (prev.includes(key)) {
        return prev.filter((x) => x !== key);
      }
      return [...prev, key];
    });
  };

  const defaultWhy = (
    <div className="income-why-content">
      <div className="income-why-block">
        <h3>🚀 Why Increasing Your Income Matters</h3>

        <p>
          Most financial advice focuses on cutting expenses. Budget tighter.
          Spend less. Skip things you enjoy.
        </p>

        <p>But there is a limit to how much you can reduce.</p>

        <p className="income-why-strong">
          There is almost no limit to how much your income can grow.
        </p>
      </div>

      <div className="income-why-callout income-why-callout--green">
        Increasing income is not just about earning more money.
        <strong> It is about expanding what is possible in your life.</strong>
      </div>

      <div className="income-why-block">
        <h4>💡 The Hidden Power of Income Growth</h4>

        <p>Imagine two people:</p>

        <div className="income-why-list">
          <p>• Person A earns $50,000 and invests $400 per month.</p>
          <p>• Person B earns $70,000 and invests $1,200 per month.</p>
        </div>

        <p>Over time, the difference in wealth becomes enormous.</p>

        <p className="income-why-strong">
          A higher income multiplies every other financial decision.
        </p>
      </div>

      <div className="income-why-block">
        <h4>🌱 Income Creates Opportunity</h4>

        <p>A growing income can give you things that money alone cannot buy:</p>

        <div className="income-why-list">
          <p>• the ability to save without constant stress</p>
          <p>• freedom to invest in your future</p>
          <p>• flexibility when unexpected life events happen</p>
          <p>• the power to help the people you care about</p>
        </div>
      </div>

      <div className="income-why-callout income-why-callout--blue">
        Increasing income is not about greed.
        <strong> It is about creating stability, freedom, and choices.</strong>
      </div>

      <div className="income-why-block">
        <h4>🧠 A Mindset Shift</h4>

        <p>Many people spend their lives trying to survive financially.</p>
        <p>
          But when you focus on growing your earning power, something changes:
        </p>
        <p className="income-why-strong">
          You move from surviving… to designing your future.
        </p>
      </div>

      <div className="income-why-block">
        <h4>✨ Small Improvements Can Change Everything</h4>

        <p>Even a small income increase can create powerful long-term effects.</p>
        <p>
          An extra $400 per month invested consistently can grow into hundreds of
          thousands over time.
        </p>
        <p className="income-why-strong">
          What feels small today can become life-changing tomorrow.
        </p>
      </div>

      <div className="income-why-block">
        <h4>💛 This Step Is Not About Pressure</h4>

        <p>Everyone's situation is different.</p>
        <p>
          Increasing income does not always happen quickly. Sometimes it takes
          learning new skills, changing roles, or exploring new opportunities.
        </p>
        <p className="income-why-strong">
          The goal is simply to start thinking about your earning potential.
        </p>
      </div>

      <div className="income-why-callout income-why-callout--amber">
        Your income is one of the most powerful engines behind your financial
        future.
        <strong> The bigger the engine, the further you can go.</strong>
      </div>

      <div className="income-why-footer">
        <p>🌟 The real goal is not just to earn more money.</p>
        <p className="income-why-footer__highlight">
          It is to build a life where your opportunities keep growing.
        </p>
        <p className="income-why-note">
          Your earning power is not fixed.
          <br />
          It is something you can develop over time.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="income-card">
        <div className="income-card__glow" />

        <div className="income-card__header">
          <div className="income-card__title-wrap">
            <div className="income-card__eyebrow">Step 7</div>
            <h1 className="income-card__title">Increase Income</h1>

            <div className="income-card__status">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="income-card__status--error">Couldn’t save</span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="income-card__why-btn"
          >
            <span>Why?</span>
            <span className="income-card__why-arrow">›</span>
          </button>
        </div>

        <div className="income-summary">
          <div className="income-summary__pill">
            Income growth can expand how much you can{" "}
            <span>save, invest, and build</span> over time.
          </div>
          <div className="income-summary__subtext">
            Think of this step as growing the size of your financial engine.
          </div>
        </div>

        <div className="income-section">
          <div className="income-section__header">
            <div>
              <h2 className="income-section__title">
                Expand the size of your financial engine
              </h2>
              <p className="income-section__subtitle">
                Increasing income can have a bigger long-term impact than only
                cutting expenses.
              </p>
            </div>
          </div>

          <div className="income-message-box">
            <p>
              Many people try to improve finances only by cutting expenses. But
              expense cutting has a limit.
            </p>
            <p>
              Increasing income can have a much bigger long-term impact because it
              improves how much you can save, invest, and compound over time.
            </p>
            <p className="income-message-box__highlight">
              This step is not about pressure. It is about exploring realistic
              ways to grow your earning power.
            </p>
          </div>
        </div>

        <div className="income-section">
          <div className="income-section__header">
            <div>
              <h2 className="income-section__title">
                Choose realistic income growth paths
              </h2>
              <p className="income-section__subtitle">
                Explore different ways to increase your earning power.
              </p>
            </div>
          </div>

          <div className="income-strategy-grid">
            {STRATEGIES.map((item) => {
              const selected = selectedStrategies.includes(item.key);

              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => toggleStrategy(item.key)}
                  className={[
                    "income-strategy-card",
                    selected ? "income-strategy-card--selected" : "",
                  ].join(" ")}
                >
                  <div className="income-strategy-card__top">
                    <div>
                      <div className="income-strategy-card__title">
                        {item.label}
                      </div>
                      <div className="income-strategy-card__short">
                        {item.short}
                      </div>
                    </div>

                    <div className="income-strategy-card__check">
                      {selected ? "✓" : ""}
                    </div>
                  </div>

                  <div className="income-strategy-card__desc">
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="income-section">
          <div className="income-section__header">
            <div>
              <h2 className="income-section__title">Educational perspective</h2>
              <p className="income-section__subtitle">
                Income can grow through stronger skills, better roles, and more
                than one path.
              </p>
            </div>
          </div>

          <div className="income-perspective-grid">
            <div className="income-perspective-card">
              <div className="income-perspective-card__title">
                Focus on opportunities
              </div>
              <div className="income-perspective-card__list">
                <div>• promotions</div>
                <div>• better roles</div>
                <div>• new certifications</div>
                <div>• stronger skills</div>
              </div>
            </div>

            <div className="income-perspective-card">
              <div className="income-perspective-card__title">
                Build multiple paths
              </div>
              <div className="income-perspective-card__list">
                <div>• side income</div>
                <div>• passive income</div>
                <div>• entrepreneurship</div>
                <div>• investment income</div>
              </div>
            </div>
          </div>

          <div className="income-note-box">
            The real goal is not just to earn more money — it is to design a
            life where earning power grows over time.
          </div>
        </div>

        <div className="income-complete">
          <div className="income-complete__text">
            {manualCompleted ? (
              <span className="income-complete__text--done">
                This step is marked as complete.
              </span>
            ) : (
              <span>
                Explore your options and mark this step complete when you are
                ready.
              </span>
            )}
          </div>

          <button
            onClick={() => setManualCompleted((prev) => !prev)}
            className={[
              "income-complete__btn",
              manualCompleted ? "income-complete__btn--done" : "",
            ].join(" ")}
          >
            {manualCompleted ? "Completed ✓" : "Mark as Complete"}
          </button>
        </div>
      </section>

      {whyOpen && (
        <OverlayShell onClose={() => setWhyOpen(false)}>
          <div className="income-modal__header">
            <div>
              <div className="income-modal__title">{whyTitle}</div>
              <div className="income-modal__subtitle">
                Quick explanation (tap outside to close).
              </div>
            </div>

            <CloseButton onClick={() => setWhyOpen(false)} />
          </div>

          <div className="income-modal__body">{whyContent ?? defaultWhy}</div>

          <div className="income-modal__footer">
            <button
              onClick={() => setWhyOpen(false)}
              className="income-modal__secondary"
            >
              Close
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
    <div className="income-modal" role="dialog" aria-modal="true">
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="income-modal__backdrop"
      />

      <div className={`income-modal__panel ${maxWidth ?? ""}`.trim()}>
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="income-close-btn"
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