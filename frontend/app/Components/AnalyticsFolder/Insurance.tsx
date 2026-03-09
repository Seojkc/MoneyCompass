"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  listUserStepMetrics,
  UiUserStepMetric,
} from "@/lib/bridge";

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
      <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
     <div className="space-y-3">
          <h3 className="text-xl md:text-2xl font-semibold text-white">
            ❤️ Why Health Insurance Matters
          </h3>

          <p className="text-white/80 leading-relaxed">
            Health is one of the most important foundations of your life.
            Everything you build — your work, your dreams, your relationships —
            depends on it.
          </p>

          <p className="text-white/80 leading-relaxed">
            But healthcare costs can appear suddenly and unexpectedly.
            A single hospital visit, medical treatment, or emergency procedure
            can cost far more than most people expect.
          </p>
        </div>

        <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">
          <p className="font-medium leading-relaxed">
            When health problems arrive, the last thing anyone should worry about
            is money.
          </p>

          <p className="mt-2 text-rose-100/90">
            Health insurance ensures that when you need care,
            you can focus on healing — not financial stress.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-white font-semibold">💡 What Health Insurance Really Protects</h4>

          <ul className="space-y-1 text-white/75">
            <li>• Protection from unexpected medical bills</li>
            <li>• Access to doctors, hospitals, and treatments</li>
            <li>• Financial security during medical emergencies</li>
            <li>• Peace of mind for you and your loved ones</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">🌱 Why People Often Delay It</h4>

          <p className="text-white/75 leading-relaxed">
            Many people believe they are young, healthy, and unlikely to need it.
            So they postpone getting coverage.
          </p>

          <p className="text-white/75 leading-relaxed">
            But health insurance is most valuable when it is already in place
            before something unexpected happens.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
          <p className="font-medium leading-relaxed">
            Health insurance is not just about medical bills.
            It is about protecting your future and preserving the financial
            stability you are working hard to build.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">🛡 Think of It This Way</h4>

          <p className="text-white/75 leading-relaxed">
            You protect your phone with a case.
            You insure your car.
            You lock your home.
          </p>

          <p className="text-white/75 leading-relaxed">
            Your health is far more valuable than all of those things combined.
            Protecting it is one of the smartest financial decisions you can make.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
          <p className="font-medium leading-relaxed">
            The goal of health insurance is simple:
          </p>

          <p className="mt-2 text-amber-100/90">
            If life brings an unexpected medical challenge,
            your savings, your progress, and your future goals
            remain protected.
          </p>
        </div>

        <div className="pt-3 border-t border-white/10 space-y-3">
          <p className="text-lg font-semibold text-white leading-relaxed">
            🌿 Health insurance gives you something priceless:
            the ability to focus on living your life without fear of
            a medical crisis becoming a financial crisis.
          </p>

          <p className="text-white/60 italic text-sm">
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
      <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
        <div className="space-y-3">
          <h3 className="text-xl md:text-2xl font-semibold text-white">
            👨‍👩‍👧 Why Dependent Health Insurance Matters
          </h3>

          <p className="text-white/80 leading-relaxed">
            When someone depends on you, your responsibility becomes bigger than
            just taking care of yourself.
          </p>

          <p className="text-white/80 leading-relaxed">
            Whether it is your spouse, children, or family members who rely on you,
            their health and well-being naturally become one of your top priorities.
          </p>
        </div>

        <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">
          <p className="font-medium leading-relaxed">
            A medical emergency affecting someone you love can be emotionally
            overwhelming.
          </p>

          <p className="mt-2 text-rose-100/90">
            Dependent health insurance ensures that during those moments,
            financial stress does not make a difficult situation even harder.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-white font-semibold">💡 What Dependent Coverage Provides</h4>

          <ul className="space-y-1 text-white/75">
            <li>• Medical coverage for family members who rely on you</li>
            <li>• Protection against unexpected healthcare costs</li>
            <li>• Access to necessary treatments when they need it most</li>
            <li>• Peace of mind knowing your loved ones are protected</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">❤️ It’s More Than Just Insurance</h4>

          <p className="text-white/75 leading-relaxed">
            Choosing dependent coverage is an act of care.
            It reflects the quiet promise you make to the people who trust you:
          </p>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white font-medium">
            “No matter what happens, I want you to be safe and protected.”
          </div>
        </div>

        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
          <p className="font-medium leading-relaxed">
            When your loved ones are protected, you gain something priceless:
            the peace of mind that the people who matter most will always have
            access to care when they need it.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">🌱 Thinking About the Future</h4>

          <p className="text-white/75 leading-relaxed">
            Life is full of beautiful moments — but also unexpected challenges.
            Protecting your dependents today helps ensure that those challenges
            never turn into financial hardship for your family.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
          <p className="font-medium leading-relaxed">
            Dependent health insurance is not just about policies or paperwork.
          </p>

          <p className="mt-2 text-amber-100/90">
            It is about protecting the people who bring meaning to your life.
          </p>
        </div>

        <div className="pt-3 border-t border-white/10 space-y-3">
          <p className="text-lg font-semibold text-white leading-relaxed">
            🌿 When the people you love are protected, you can move through life
            with greater confidence, knowing their health and safety are secured.
          </p>

          <p className="text-white/60 italic text-sm">
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
      <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
        <div className="space-y-3">
          <h3 className="text-xl md:text-2xl font-semibold text-white">
            ❤️ Why Term Life Insurance Matters
          </h3>

          <p className="text-white/80 leading-relaxed">
            Life insurance is one of the quietest and most powerful acts of love.
          </p>

          <p className="text-white/80 leading-relaxed">
            It is not something you buy for yourself.
            It is something you choose for the people who would feel your absence the most.
          </p>
        </div>

        <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">
          <p className="font-medium leading-relaxed">
            The people who depend on you — your partner, children, or family —
            rely on your presence, your care, and often your financial support.
          </p>

          <p className="mt-2 text-rose-100/90">
            Term insurance ensures that if life ever changes unexpectedly,
            their stability and security are still protected.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-white font-semibold">💡 What Term Insurance Protects</h4>

          <ul className="space-y-1 text-white/75">
            <li>• Your family’s financial stability</li>
            <li>• Daily living expenses for loved ones</li>
            <li>• Children’s education and future goals</li>
            <li>• Protection from financial hardship during a difficult time</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">❤️ The Real Meaning Behind It</h4>

          <p className="text-white/75 leading-relaxed">
            Term insurance is not about expecting the worst.
            It is about taking responsibility for the people who matter most to you.
          </p>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white font-medium">
            It says:
            “Even if I am not there one day, I still want you to be safe.”
          </div>
        </div>

        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
          <p className="font-medium leading-relaxed">
            Term insurance transforms uncertainty into protection.
            It allows your loved ones to continue their lives with dignity,
            stability, and opportunity.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">🌱 Why People Often Wait</h4>

          <p className="text-white/75 leading-relaxed">
            Many people postpone life insurance because it feels like something
            they can think about later.
          </p>

          <p className="text-white/75 leading-relaxed">
            But the best time to build protection is when life is stable,
            when decisions can be made calmly and thoughtfully.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
          <p className="font-medium leading-relaxed">
            Term insurance is not about preparing for loss.
          </p>

          <p className="mt-2 text-amber-100/90">
            It is about ensuring that the people you love never have to face
            financial uncertainty during one of the most difficult moments of life.
          </p>
        </div>

        <div className="pt-3 border-t border-white/10 space-y-3">
          <p className="text-lg font-semibold text-white leading-relaxed">
            🌿 One decision today can protect the future of the people you love most.
          </p>

          <p className="text-white/60 italic text-sm">
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
      <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
        <div className="space-y-3">
          <h3 className="text-xl md:text-2xl font-semibold text-white">
            💼 Why Disability Insurance Matters
          </h3>

          <p className="text-white/80 leading-relaxed">
            Most people insure their phone, their car, or their home.
            But many forget to protect the one thing that makes all of those
            possible — their ability to earn an income.
          </p>

          <p className="text-white/80 leading-relaxed">
            Your income is one of your greatest financial assets.
            It fuels your savings, supports your family, and helps you build the
            future you imagine.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
          <p className="font-medium leading-relaxed">
            If an illness or injury temporarily prevents you from working,
            disability insurance helps ensure that your financial life
            continues to move forward.
          </p>

          <p className="mt-2 text-amber-100/90">
            It provides support when your ability to earn is interrupted,
            allowing you to focus on recovery instead of financial pressure.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-white font-semibold">💡 What Disability Insurance Protects</h4>

          <ul className="space-y-1 text-white/75">
            <li>• A portion of your monthly income if you cannot work</li>
            <li>• Stability for your household during recovery</li>
            <li>• Protection for your savings and investments</li>
            <li>• Time and peace of mind to focus on healing</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">🌱 Why It’s Often Overlooked</h4>

          <p className="text-white/75 leading-relaxed">
            Many people think disability insurance is only necessary for
            dangerous jobs or older workers.
          </p>

          <p className="text-white/75 leading-relaxed">
            In reality, unexpected injuries or health conditions can happen to
            anyone — and even a few months without income can place enormous
            pressure on financial stability.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
          <p className="font-medium leading-relaxed">
            Disability insurance protects the engine of your financial life:
            your ability to earn and provide.
          </p>

          <p className="mt-2 text-emerald-200/90">
            When that engine is protected, your goals, savings, and future plans
            remain secure even during unexpected setbacks.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-semibold">🧠 A Different Perspective</h4>

          <p className="text-white/75 leading-relaxed">
            Imagine protecting your financial journey the same way athletes
            protect their careers — by preparing for the unexpected before it
            happens.
          </p>

          <p className="text-white/75 leading-relaxed">
            Disability insurance is not about expecting problems.
            It is about respecting the value of the income you work so hard to earn.
          </p>
        </div>

        <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">
          <p className="font-medium leading-relaxed">
            Your ability to work is one of the most powerful tools you have for
            building your future.
          </p>

          <p className="mt-2 text-rose-100/90">
            Protecting it ensures that even if life slows you down temporarily,
            your financial progress does not stop.
          </p>
        </div>

        <div className="pt-3 border-t border-white/10 space-y-3">
          <p className="text-lg font-semibold text-white leading-relaxed">
            🌿 Disability insurance gives you something invaluable:
            the confidence that your income — and everything it supports —
            remains protected.
          </p>

          <p className="text-white/60 italic text-sm">
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
    <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-3">
        <h3 className="text-xl md:text-2xl font-semibold text-white">
          🛡 Why Insurance Matters
        </h3>
        <p className="text-white/80 leading-relaxed">
          Most people do not think about insurance when life feels normal.
          That is exactly why it matters.
        </p>
        <p className="text-white/80 leading-relaxed">
          Insurance is not something you buy because you expect the worst.
          You choose it because you care deeply about your future, your peace,
          your health, and the people who depend on you.
        </p>
      </div>

      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
        <p className="font-medium leading-relaxed">
          One unexpected moment can change everything financially.
          A medical bill, an illness, an accident, or time away from work can
          place heavy pressure on your savings and your family.
        </p>
        <p className="mt-2 text-amber-100/90">
          Insurance helps make sure that one difficult moment does not become a
          long financial struggle.
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">💡 The Real Meaning of Insurance</h4>
        <p className="text-white/75 leading-relaxed">
          Insurance is more than a policy.
          It is a quiet promise to yourself:
          <span className="text-white font-medium">
            {" "}“If life becomes hard, I will still have protection.”
          </span>
        </p>
        <p className="text-white/75 leading-relaxed">
          It protects the money you worked hard to earn.
          It protects the progress you fought hard to build.
          And sometimes, it protects the people you love from carrying a burden
          they should never have to carry alone.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-white font-semibold">❤️ Why People Often Delay It</h4>
        <p className="text-white/75 leading-relaxed">
          Many people think,
          <span className="italic"> “I am still young.”</span>
          {" "}Or,
          <span className="italic"> “Nothing will happen to me.”</span>
          {" "}Or,
          <span className="italic"> “I will do it later when life is more settled.”</span>
        </p>
        <p className="text-white/75 leading-relaxed">
          But life does not always wait for the perfect time.
          Protection matters most when it is already in place before you need it.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
        <p className="font-medium leading-relaxed">
          Insurance is not about fear.
          It is about strength, responsibility, and peace of mind.
        </p>
        <p className="mt-2 text-emerald-200/90">
          It allows you to move through life with more confidence because you know
          one setback does not have the power to destroy everything you built.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-white font-semibold">🌿 What Each Protection Can Mean</h4>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Health Insurance</div>
          <p className="mt-1 text-white/70 leading-relaxed">
            Your health is your foundation.
            When something unexpected happens, the last thing you should worry
            about is how to afford care.
            Health insurance helps protect both your body and your finances.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Dependent Health Insurance</div>
          <p className="mt-1 text-white/70 leading-relaxed">
            When you care for others, your responsibility becomes bigger than just yourself.
            Protecting your dependents means protecting the people whose well-being
            matters deeply to you.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Term Insurance</div>
          <p className="mt-1 text-white/70 leading-relaxed">
            Term insurance is an act of love.
            It says that even if you are not there one day, your loved ones should
            still have financial support, stability, and dignity.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Disability Insurance</div>
          <p className="mt-1 text-white/70 leading-relaxed">
            Many people insure their phone, car, or belongings —
            but forget to protect their income.
            Your ability to work is one of your greatest financial assets.
            Disability insurance helps protect that if life suddenly changes.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">✨ A Better Way to Think About It</h4>
        <p className="text-white/75 leading-relaxed">
          Insurance is not money wasted.
          It is money placed between your life and a potential financial crisis.
        </p>
        <p className="text-white/75 leading-relaxed">
          You hope you never need it.
          But if you ever do, you will be grateful that your past self chose protection,
          preparation, and care.
        </p>
      </div>

      <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">
        <p className="font-medium leading-relaxed">
          The people who love you want you safe.
          The future version of you wants stability.
          Choosing insurance is one of the quietest and strongest ways to say:
          <span className="text-white"> “I am protecting what matters.”</span>
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">🎯 Start Simple</h4>
        <p className="text-white/75 leading-relaxed">
          You do not need every type of insurance all at once.
          Start with the most important protection first.
          Build step by step.
        </p>
        <p className="text-white/75 leading-relaxed">
          What matters is not perfection.
          What matters is making the decision to stop leaving your future unprotected.
        </p>
      </div>

      <div className="pt-3 border-t border-white/10 space-y-3">
        <p className="text-lg font-semibold text-white leading-relaxed">
          🌍 Insurance gives you something deeply valuable:
          the ability to face life with more confidence, less fear, and greater peace.
        </p>

        <p className="text-white/60 italic text-sm leading-relaxed">
          Protecting yourself is not negativity.
          It is self-respect, responsibility, and love in action.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white fs-1 text-3xl">
              Insurance
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
            onClick={() => openWhy(whyTitle, whyContent)}
            className="text-lg text-white/80 hover:text-white rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
          >
            Why? <span className="ml-1">›</span>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm md:text-base text-white/85">
            <span className="font-semibold">Selected</span>

            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-white">
              {completedCount} / {totalCount}
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
            Protect the essentials first, then add optional layers as needed.
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
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

          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-lg md:text-xl">
                  {activeWhy?.title ?? whyTitle}
                </div>
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

            <div className="mt-4">
              {activeWhy?.content ?? defaultWhy}
            </div>

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

function InsuranceRow({
  label,
  checked,
  optional,
  onToggle,
  onWhy,
}: {
  label: string;
  checked: boolean;
  optional: boolean;
  onToggle: () => void;
  onWhy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 md:px-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          className={[
            "relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition",
            checked
              ? "border-emerald-400/60 bg-emerald-400/20"
              : "border-white/20 bg-white/5 hover:bg-white/10",
          ].join(" ")}
          aria-pressed={checked}
          aria-label={`Toggle ${label}`}
        >
          {checked && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="text-emerald-200"
            >
              <path
                d="M5 13L9 17L19 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm md:text-base font-medium text-white">
              {label}
            </span>

            {optional ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/55">
                Optional
              </span>
            ) : (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200/90">
                Required
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onWhy}
        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:text-white"
      >
        Why?
      </button>
    </div>
  );
}