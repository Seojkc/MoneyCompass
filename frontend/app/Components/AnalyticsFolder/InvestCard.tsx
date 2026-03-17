"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkUpsertUserStepMetrics,
  createUserInvestment,
  deleteUserInvestment,
  listUserInvestments,
  patchUserInvestment,
  UiUserInvestment,
} from "@/lib/bridge";

type Props = {
  userId: string;
  stepKey?: string;
  onCompletionChange?: (done: boolean) => void;
  whyTitle?: string;
  whyContent?: React.ReactNode;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type RiskLevel = "Low" | "Medium" | "High";
type InvestmentKind = "ETF" | "Stock" | "Mutual Fund" | "Other";
type AccountType = "TFSA" | "RRSP" | "FHSA" | "Taxable" | "RESP" | "Other";

type PresetInvestment = {
  id: string;
  name: string;
  kind: InvestmentKind;
  risk: RiskLevel;
  website: string;
  averageReturn5y?: number;
};

type InvestmentRow = {
  id: string;
  accountType: AccountType;
  name: string;
  kind: InvestmentKind;
  risk: RiskLevel | "";
  monthlyAmount: number;
  currentInvested: number;
  averageReturn: number | "";
  website?: string;
  presetId?: string;
  isCustom?: boolean;
};

const METRIC_KEYS = {
  currentInvested: "current_invested",
  monthlyInvesting: "monthly_investing",
  weightedAvgReturn: "weighted_avg_return",
  completed: "is_completed",
} as const;

const PROJECTION_YEARS = [1, 3, 5, 10, 15, 20];

const INVEST_LEARN_LINK =
  "https://youtu.be/9s8LJejwlPE?si=_yCc7DIkoh2FJwMs";

const PRESETS: PresetInvestment[] = [
  {
    id: "zcs",
    name: "BMO Short Corporate Bond Index ETF (ZCS)",
    kind: "ETF",
    risk: "Low",
    website:
      "https://bmogam.com/ca-en/products/exchange-traded-fund/bmo-short-corporate-bond-index-etf-zcs/",
    averageReturn5y: 2.38,
  },
  {
    id: "vbal",
    name: "Vanguard Balanced ETF Portfolio (VBAL)",
    kind: "ETF",
    risk: "Low",
    website:
      "https://www.vanguard.ca/en/product/etf/asset-allocation/9578/vanguard-balanced-etf-portfolio",
    averageReturn5y: 7.93,
  },

  {
    id: "xic",
    name: "iShares Core S&P/TSX Capped Composite Index ETF (XIC)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://www.blackrock.com/ca/investors/en/products/239837/ishares-sptsx-capped-composite-index-etf",
    averageReturn5y: 16.28,
  },
  {
    id: "vdy",
    name: "Vanguard FTSE Canadian High Dividend Yield Index ETF (VDY)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://www.vanguard.ca/en/product/etf/equity/9560/vanguard-ftse-canadian-high-dividend-yield-index-etf",
    averageReturn5y: 18.82,
  },
  {
    id: "xiu",
    name: "iShares S&P/TSX 60 Index ETF (XIU)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://www.blackrock.com/ca/investors/en/products/239832/ishares-sptsx-60-index-etf",
    averageReturn5y: 16.74,
  },
  {
    id: "zlb",
    name: "BMO Low Volatility Canadian Equity ETF (ZLB)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://bmogam.com/ca-en/products/exchange-traded-fund/bmo-low-volatility-canadian-equity-etf-zlb/",
    averageReturn5y: 16.42,
  },
  {
    id: "xwd",
    name: "iShares MSCI World Index ETF (XWD)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://www.blackrock.com/ca/investors/en/products/239692/ishares-msci-world-index-etf",
    averageReturn5y: 14.16,
  },
  {
    id: "xei",
    name: "iShares S&P/TSX Composite High Dividend Index ETF (XEI)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://www.blackrock.com/ca/investors/en/products/239846/ishares-sptsx-equity-income-index-etf",
    averageReturn5y: 17.06,
  },
  {
    id: "xdiv",
    name: "iShares Core MSCI Canadian Quality Dividend Index ETF (XDIV)",
    kind: "ETF",
    risk: "Medium",
    website:
      "https://www.blackrock.com/ca/investors/en/products/287823/ishares-core-msci-canadian-quality-dividend-index-etf",
    averageReturn5y: 18.54,
  },

  {
    id: "vfv",
    name: "Vanguard S&P 500 Index ETF (VFV)",
    kind: "ETF",
    risk: "High",
    website:
      "https://www.vanguard.ca/en/product/etf/equity/9563/vanguard-sp-500-index-etf",
    averageReturn5y: 16.11,
  },
  {
    id: "xeqt",
    name: "iShares Core Equity ETF Portfolio (XEQT)",
    kind: "ETF",
    risk: "High",
    website:
      "https://www.blackrock.com/ca/investors/en/products/309480/ishares-core-equity-etf-portfolio",
    averageReturn5y: 14.0,
  },
  {
    id: "xqq",
    name: "iShares NASDAQ 100 Index ETF (XQQ)",
    kind: "ETF",
    risk: "High",
    website:
      "https://www.blackrock.com/ca/investors/en/products/239699/ishares-nasdaq-100-index-etf",
    averageReturn5y: 16.32,
  },
  {
    id: "qqc",
    name: "Invesco NASDAQ 100 Index ETF (QQC)",
    kind: "ETF",
    risk: "High",
    website:
      "https://www.invesco.com/ca/en/financial-products/etfs/invesco-nasdaq-100-index-etf-cad.html",
    averageReturn5y: 12.92,
  },
  {
    id: "hta",
    name: "Harvest Tech Achievers Growth & Income ETF (HTA)",
    kind: "ETF",
    risk: "High",
    website: "https://harvestportfolios.com/etf/hta/",
    averageReturn5y: 18.42,
  },
  {
    id: "zqq",
    name: "BMO NASDAQ 100 Equity Hedged to CAD Index ETF (ZQQ)",
    kind: "ETF",
    risk: "High",
    website:
      "https://bmogam.com/ca-en/products/exchange-traded-fund/bmo-nasdaq-100-equity-hedged-to-cad-index-etf-zqq/",
    averageReturn5y: 13.09,
  },
  {
    id: "znq",
    name: "BMO NASDAQ 100 Equity Index ETF (ZNQ)",
    kind: "ETF",
    risk: "High",
    website:
      "https://bmogam.com/ca-en/products/exchange-traded-fund/bmo-nasdaq-100-equity-index-etf-znq/",
    averageReturn5y: 16.02,
  },
  {
    id: "xcs",
    name: "iShares S&P/TSX SmallCap Index ETF (XCS)",
    kind: "ETF",
    risk: "High",
    website:
      "https://www.blackrock.com/ca/investors/en/products/239842/ishares-sptsx-smallcap-index-etf",
    averageReturn5y: 17.47,
  },
  {
    id: "tec",
    name: "TD Global Technology Leaders Index ETF (TEC)",
    kind: "ETF",
    risk: "High",
    website:
      "https://www.td.com/ca/en/asset-management/funds/solutions/etfs/fundcard?fundId=7113&fundname=TD-Global-Technology-Leaders-Index-ETF",
    averageReturn5y: 18.73,
  },
];

function money(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function percent(n: number) {
  return `${n.toFixed(1)}%`;
}

function compoundFutureValue(
  presentValue: number,
  monthlyContribution: number,
  annualRatePct: number,
  years: number
) {
  const months = years * 12;
  const r = annualRatePct / 100 / 12;

  if (months <= 0) return presentValue;

  if (r === 0) {
    return presentValue + monthlyContribution * months;
  }

  const fvPresent = presentValue * Math.pow(1 + r, months);
  const fvSeries =
    monthlyContribution * ((Math.pow(1 + r, months) - 1) / r);

  return fvPresent + fvSeries;
}

function rowFromApi(r: UiUserInvestment): InvestmentRow {
  return {
    id: r.id,
    accountType: (r.account_type as AccountType) ?? "TFSA",
    name: r.name,
    kind: (r.kind as InvestmentKind) ?? "Other",
    risk: (r.risk as RiskLevel | "") ?? "",
    monthlyAmount: Number(r.monthly_amount) || 0,
    currentInvested: Number(r.current_invested) || 0,
    averageReturn:
      r.average_return === null || r.average_return === undefined
        ? ""
        : Number(r.average_return),
    website: r.website ?? "",
    presetId: r.preset_id ?? undefined,
    isCustom: !!r.is_custom,
  };
}

export default function InvestCard({
  userId,
  stepKey = "invest",
  onCompletionChange,
  whyTitle = "Why investing matters",
  whyContent,
}: Props) {
  const [rows, setRows] = useState<InvestmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [whyOpen, setWhyOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const lastDoneRef = useRef(false);
  const summarySaveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const rowPatchTimersRef = useRef<Record<string, number>>({});

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("TFSA");
  const [monthlyAmount, setMonthlyAmount] = useState<number>(250);
  const [currentInvested, setCurrentInvested] = useState<number>(1000);
  const [averageReturnInput, setAverageReturnInput] = useState<number | "">("");

  const selectedPreset = useMemo(
    () => PRESETS.find((p) => p.id === selectedPresetId),
    [selectedPresetId]
  );

  useEffect(() => {
    if (selectedPreset) {
      setAverageReturnInput(selectedPreset.averageReturn5y ?? "");
    }
  }, [selectedPreset]);

  const totalMonthly = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.monthlyAmount) || 0), 0),
    [rows]
  );

  const totalCurrentInvested = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.currentInvested) || 0), 0),
    [rows]
  );

  const weightedAverageReturn = useMemo(() => {
    const base = rows.reduce(
      (sum, row) => sum + (Number(row.currentInvested) || 0),
      0
    );

    if (rows.length === 0) return 0;

    if (base <= 0) {
      const valid = rows
        .map((r) =>
          typeof r.averageReturn === "number" ? r.averageReturn : null
        )
        .filter((v): v is number => v !== null);

      if (valid.length === 0) return 0;
      return valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    let total = 0;
    for (const row of rows) {
      const invested = Number(row.currentInvested) || 0;
      const rate =
        typeof row.averageReturn === "number" ? row.averageReturn : 0;
      total += invested * rate;
    }
    return total / base;
  }, [rows]);

  const projections = useMemo(() => {
    return PROJECTION_YEARS.map((years) => {
      const estimatedValue = compoundFutureValue(
        totalCurrentInvested,
        totalMonthly,
        weightedAverageReturn,
        years
      );

      const totalContributed = totalCurrentInvested + totalMonthly * years * 12;

      return {
        years,
        estimatedValue,
        totalContributed,
      };
    });
  }, [totalCurrentInvested, totalMonthly, weightedAverageReturn]);

  const isDone = rows.length > 0 && (totalMonthly > 0 || totalCurrentInvested > 0);

  const hasReportedInitialStateRef = useRef(false);

  useEffect(() => {
    if (!onCompletionChange) return;
    if (loading) return;

    if (!hasReportedInitialStateRef.current) {
      hasReportedInitialStateRef.current = true;
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
      return;
    }

    if (lastDoneRef.current !== isDone) {
      lastDoneRef.current = isDone;
      onCompletionChange(isDone);
    }
  }, [loading, isDone, onCompletionChange]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const data = await listUserInvestments({
          userId,
          stepKey,
        });

        if (!mounted) return;

        setRows(data.map(rowFromApi));
        hydratedRef.current = true;
        setSaveState("idle");
      } catch (e) {
        if (!mounted) return;
        console.error(e);
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

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (summarySaveTimerRef.current) {
      window.clearTimeout(summarySaveTimerRef.current);
      summarySaveTimerRef.current = null;
    }

    setSaveState("saving");

    summarySaveTimerRef.current = window.setTimeout(async () => {
      try {
        await bulkUpsertUserStepMetrics([
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.currentInvested,
            value_num: Number(totalCurrentInvested) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.monthlyInvesting,
            value_num: Number(totalMonthly) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.weightedAvgReturn,
            value_num: Number(weightedAverageReturn) || 0,
          },
          {
            user_id: userId,
            step_key: stepKey,
            metric_key: METRIC_KEYS.completed,
            value_num: isDone ? 1 : 0,
          },
        ]);

        setSaveState("saved");
        window.setTimeout(() => {
          setSaveState((prev) => (prev === "saved" ? "idle" : prev));
        }, 1200);
      } catch (e) {
        console.error(e);
        setSaveState("error");
      }
    }, 500);

    return () => {
      if (summarySaveTimerRef.current) {
        window.clearTimeout(summarySaveTimerRef.current);
      }
    };
  }, [
    userId,
    stepKey,
    totalCurrentInvested,
    totalMonthly,
    weightedAverageReturn,
    isDone,
  ]);

  useEffect(() => {
    if (!whyOpen && !addOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWhyOpen(false);
        setAddOpen(false);
      }
    };

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [whyOpen, addOpen]);

  useEffect(() => {
    return () => {
      if (summarySaveTimerRef.current) {
        window.clearTimeout(summarySaveTimerRef.current);
      }

      Object.values(rowPatchTimersRef.current).forEach((t) => {
        window.clearTimeout(t);
      });
    };
  }, []);

  const resetAddForm = () => {
    setSelectedPresetId("");
    setCustomName("");
    setAccountType("TFSA");
    setMonthlyAmount(250);
    setCurrentInvested(1000);
    setAverageReturnInput("");
  };

  const handleAddInvestment = async () => {
    const usingPreset = !!selectedPreset;
    const name = usingPreset ? selectedPreset.name : customName.trim();

    if (!name) return;

    try {
      const created = await createUserInvestment({
        user_id: userId,
        step_key: stepKey,
        account_type: accountType,
        name,
        kind: usingPreset ? selectedPreset.kind : "Other",
        risk: usingPreset ? selectedPreset.risk : "",
        monthly_amount: Number(monthlyAmount) || 0,
        current_invested: Number(currentInvested) || 0,
        average_return:
          averageReturnInput === "" ? 0 : Number(averageReturnInput),
        website: usingPreset ? selectedPreset.website : "",
        preset_id: usingPreset ? selectedPreset.id : null,
        is_custom: !usingPreset,
      });

      setRows((prev) => [rowFromApi(created), ...prev]);
      resetAddForm();
      setAddOpen(false);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  };

  const queuePatch = (
    id: string,
    patch: Partial<
      Pick<
        UiUserInvestment,
        | "account_type"
        | "name"
        | "monthly_amount"
        | "current_invested"
        | "average_return"
      >
    >
  ) => {
    const existing = rowPatchTimersRef.current[id];
    if (existing) {
      window.clearTimeout(existing);
    }

    rowPatchTimersRef.current[id] = window.setTimeout(async () => {
      try {
        await patchUserInvestment(id, patch);
      } catch (e) {
        console.error(e);
        setSaveState("error");
      }
    }, 450);
  };

  const updateRow = <K extends keyof InvestmentRow>(
    id: string,
    key: K,
    value: InvestmentRow[K]
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, [key]: value };
      })
    );

    if (key === "accountType") {
      queuePatch(id, { account_type: value as string });
    } else if (key === "name") {
      queuePatch(id, { name: value as string });
    } else if (key === "monthlyAmount") {
      queuePatch(id, { monthly_amount: Number(value) || 0 });
    } else if (key === "currentInvested") {
      queuePatch(id, { current_invested: Number(value) || 0 });
    } else if (key === "averageReturn") {
      queuePatch(id, { average_return: value === "" ? 0 : Number(value) || 0 });
    }
  };

  const handleDeleteRow = async (id: string) => {
    const previous = rows;
    setRows((prev) => prev.filter((row) => row.id !== id));

    try {
      await deleteUserInvestment(id);
    } catch (e) {
      console.error(e);
      setRows(previous);
      setSaveState("error");
    }
  };

  const defaultWhy = (
    <div className="space-y-6 text-sm md:text-base text-white/85 max-h-[65vh] overflow-y-auto pr-2">
      <div className="space-y-3">
        <h3 className="text-xl md:text-2xl font-semibold text-white">
          📈 Why This Matters
        </h3>
        <p className="text-white/80 leading-relaxed">
          Once your cash flow is stable, your emergency fund is built, and
          high-interest debt is under control, the next step is to let your
          money start working for you.
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">
          Inflation slowly reduces cash value
        </h4>
        <p className="text-white/75">
          If inflation stays around 3% per year, money sitting in cash loses
          purchasing power over time. Investing aims to help your money grow
          faster than inflation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Savings account</div>
          <div className="text-white/60 text-sm mt-1">Often lower growth</div>
          <div className="text-amber-200 mt-2 font-semibold">~1–3%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Bonds</div>
          <div className="text-white/60 text-sm mt-1">
            Moderate risk / return
          </div>
          <div className="text-amber-200 mt-2 font-semibold">~3–5%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-white font-medium">Stock market index</div>
          <div className="text-white/60 text-sm mt-1">
            Higher risk, higher long-term return
          </div>
          <div className="text-amber-200 mt-2 font-semibold">~7–10%</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">🧠 The power of compounding</h4>
        <p className="text-white/75">
          Returns can generate more returns over time. That is why starting
          earlier often matters more than starting with a large amount later.
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">Common investment types</h4>
        <ul className="space-y-1 text-white/80">
          <li>• ETFs: simple, diversified, low cost, beginner-friendly</li>
          <li>• Index funds: broad market exposure</li>
          <li>• Mutual funds: managed but often higher fees</li>
          <li>• Individual stocks: higher risk, less diversified</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="text-white font-semibold">
          Common Canadian account types
        </h4>
        <ul className="space-y-1 text-white/80">
          <li>• TFSA: tax-free growth and withdrawals</li>
          <li>• RRSP: tax deduction today, taxed later</li>
          <li>• FHSA: for an eligible first home</li>
          <li>• Taxable account: regular non-registered investing account</li>
        </ul>
      </div>

      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200">
        Diversification matters. Spreading your money across many companies,
        sectors, and markets can reduce concentration risk.
      </div>

      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-100">
        Important: projections on this card are estimates only. They are not
        guaranteed returns or financial advice.
      </div>

      <div className="pt-3 border-t border-white/10 space-y-2">
        <p className="text-lg font-semibold text-white">
          Investing works best as a long-term habit, not a short-term prediction
          game.
        </p>
        <p className="text-white/60 italic text-sm">
          Start simple. Stay consistent. Give compounding time.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-white text-3xl">Investing</h1>
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

          

        <div className="mt-6 flex justify-start">
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm md:text-base font-semibold text-emerald-100 hover:bg-emerald-300/15"
          >
            <span className="text-lg leading-none">+</span>
            Add investment
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mx-4">
            <a
              href={INVEST_LEARN_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-200/20 bg-black/20 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-black/30"
            >
              <span className="text-base">▶</span>
              Watch on YouTube
            </a>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard
            label="Currently invested"
            value={`$${money(totalCurrentInvested)}`}
            sub="Sum of all positions"
          />
          <StatCard
            label="Monthly investing"
            value={`$${money(totalMonthly)}`}
            sub="Automatic monthly contributions"
          />
          <StatCard
            label="Weighted avg. return"
            value={rows.length ? percent(weightedAverageReturn) : "—"}
            sub="Used for estimate only"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-white/60">
                  <th className="px-3 py-3 font-medium">Account</th>
                  <th className="px-3 py-3 font-medium">Investment</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Risk</th>
                  <th className="px-3 py-3 font-medium">Avg return</th>
                  <th className="px-3 py-3 font-medium">Current invested</th>
                  <th className="px-3 py-3 font-medium">Monthly amount</th>
                  <th className="px-3 py-3 font-medium">Link</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-white/50"
                    >
                      No investments yet. Add one to begin your projection.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={
                        idx !== rows.length - 1 ? "border-b border-white/10" : ""
                      }
                    >
                      <td className="px-3 py-3">
                        <select
                          value={row.accountType}
                          onChange={(e) =>
                            updateRow(
                              row.id,
                              "accountType",
                              e.target.value as AccountType
                            )
                          }
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                        >
                          <option value="TFSA">TFSA</option>
                          <option value="RRSP">RRSP</option>
                          <option value="FHSA">FHSA</option>
                          <option value="Taxable">Taxable</option>
                          <option value="RESP">RESP</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          value={row.name}
                          onChange={(e) => updateRow(row.id, "name", e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                        />
                      </td>

                      <td className="px-3 py-3 text-white/80">{row.kind}</td>

                      <td className="px-3 py-3">
                        {row.risk ? (
                          <span
                            className={[
                              "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                              row.risk === "Low"
                                ? "border-emerald-400/40 text-emerald-200"
                                : row.risk === "Medium"
                                ? "border-amber-400/40 text-amber-200"
                                : "border-rose-400/40 text-rose-200",
                            ].join(" ")}
                          >
                            {row.risk}
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <input
                            type="number"
                            value={row.averageReturn}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "averageReturn",
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            className="w-16 bg-transparent text-right text-white outline-none"
                          />
                          <span className="text-white/50">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <span className="text-white/50">$</span>
                          <input
                            type="number"
                            value={row.currentInvested}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "currentInvested",
                                Number(e.target.value || 0)
                              )
                            }
                            className="w-24 bg-transparent text-right text-white outline-none"
                          />
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <span className="text-white/50">$</span>
                          <input
                            type="number"
                            value={row.monthlyAmount}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "monthlyAmount",
                                Number(e.target.value || 0)
                              )
                            }
                            className="w-24 bg-transparent text-right text-white outline-none"
                          />
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {row.website ? (
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-300/15"
                          >
                            Open site
                          </a>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="inline-flex rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-300/15"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm md:text-base text-white/85">
          <span className="font-semibold">Status:</span>

          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs",
              isDone
                ? "border-green-500/60 text-green-300"
                : "border-white/15 text-white/50",
            ].join(" ")}
          >
            {isDone ? "Completed ✓" : "In progress"}
          </span>

          <span className="text-white/50">•</span>
          <span className="text-white/70">
            Based on your current entries, this card shows estimated values only.
          </span>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-white text-lg md:text-xl font-semibold">
                Estimated investment projection
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Formula uses monthly compounding and your weighted average return.
              </p>
            </div>

            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs md:text-sm text-amber-100">
              Not guaranteed. For planning only.
            </div>
          </div>

          <div className="mt-5">
            <ProjectionChart data={projections} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[680px] w-full text-sm">
              <thead>
                <tr className="text-left text-white/60 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium text-center">Time</th>
                  <th className="py-2 pr-3 font-medium text-center">
                    Total contributed
                  </th>
                  <th className="py-2 pr-3 font-medium text-center">
                    Estimated growth
                  </th>
                  <th className="py-2 pr-3 font-medium text-center">
                    Estimated value
                  </th>
                </tr>
              </thead>
              <tbody>
                {projections.map((item) => {
                  const growth = item.estimatedValue - item.totalContributed;

                  return (
                    <tr
                      key={item.years}
                      className="border-b border-white/5 text-center"
                    >
                      <td className="py-3 pr-3 text-white">{item.years} years</td>
                      <td className="py-3 pr-3 text-white/75 text-center">
                        ${money(Math.round(item.totalContributed))}
                      </td>
                      <td className="py-3 pr-3 text-sky-200 text-center">
                        ${money(Math.round(growth))}
                      </td>
                      <td className="py-3 pr-3 text-emerald-200 font-semibold text-center">
                        ${money(Math.round(item.estimatedValue))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-white/45 leading-relaxed">
            Projection formula:
            <span className="text-white/65">
              {" "}
              Estimated value = current invested × (1 + r/12)^(12t) + monthly
              investment × [((1 + r/12)^(12t) - 1) / (r/12)]
            </span>
          </div>
        </div>
      </section>

      {whyOpen && (
        <OverlayShell onClose={() => setWhyOpen(false)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold text-lg md:text-xl">
                {whyTitle}
              </div>
              <div className="mt-1 text-white/60 text-xs md:text-sm">
                Quick explanation (tap outside to close).
              </div>
            </div>

            <CloseButton onClick={() => setWhyOpen(false)} />
          </div>

          <div className="mt-4">{whyContent ?? defaultWhy}</div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => setWhyOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              Close
            </button>
          </div>
        </OverlayShell>
      )}

      {addOpen && (
        <OverlayShell onClose={() => setAddOpen(false)} maxWidth="max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold text-lg md:text-xl">
                Add investment
              </div>
              <div className="mt-1 text-white/60 text-xs md:text-sm">
                Choose a preset or enter your own investment manually.
              </div>
            </div>

            <CloseButton onClick={() => setAddOpen(false)} />
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Investment account type">
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
              >
                <option value="TFSA">TFSA</option>
                <option value="RRSP">RRSP</option>
                <option value="FHSA">FHSA</option>
                <option value="Taxable">Taxable</option>
                <option value="RESP">RESP</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Choose preset example">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
              >
                <option value="">Other / custom investment</option>

                <optgroup label="Low risk">
                  {PRESETS.filter((p) => p.risk === "Low").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Medium risk">
                  {PRESETS.filter((p) => p.risk === "Medium").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="High risk">
                  {PRESETS.filter((p) => p.risk === "High").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>

            {!selectedPreset && (
              <Field label="Other investment name">
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Example: My bank mutual fund / custom ETF"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none placeholder:text-white/30"
                />
              </Field>
            )}

            <Field label="Investment type">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white/80">
                {selectedPreset ? selectedPreset.kind : "Other"}
              </div>
            </Field>

            <Field label="Monthly investment amount">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <span className="text-white/50">$</span>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(Number(e.target.value || 0))}
                  className="w-full bg-transparent text-white outline-none"
                />
              </div>
            </Field>

            <Field label="Currently invested">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <span className="text-white/50">$</span>
                <input
                  type="number"
                  value={currentInvested}
                  onChange={(e) => setCurrentInvested(Number(e.target.value || 0))}
                  className="w-full bg-transparent text-white outline-none"
                />
              </div>
            </Field>

            <Field label="Average annual return used for estimate (Data based on Januray 31, 2026, 5-year average return)">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <input
                  type="number"
                  value={averageReturnInput}
                  onChange={(e) =>
                    setAverageReturnInput(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full bg-transparent text-white outline-none"
                />
                <span className="text-white/50">%</span>
              </div>
            </Field>

            <div className="md:col-span-2">
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                Use this as an estimated rate only. Do not treat it as a promise
                of future returns.
              </div>
            </div>

            {selectedPreset && (
              <div className="md:col-span-2 rounded-xl border border-sky-300/20 bg-sky-300/10 p-3 text-sm text-sky-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  Selected:{" "}
                  <span className="font-semibold">{selectedPreset.name}</span>
                </div>
                <a
                  href={selectedPreset.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-sky-200/20 bg-black/20 px-3 py-2 text-xs font-medium"
                >
                  Open official site
                </a>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleAddInvestment}
              className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/15"
            >
              Add investment
            </button>
          </div>
        </OverlayShell>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/45">{sub}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-white/70">{label}</div>
      {children}
    </label>
  );
}

function OverlayShell({
  children,
  onClose,
  maxWidth = "max-w-2xl",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className={`relative w-full ${maxWidth} rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur p-4 md:p-6 shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
  );
}

function ProjectionChart({
  data,
}: {
  data: { years: number; estimatedValue: number; totalContributed: number }[];
}) {
  const width = 900;
  const height = 300;
  const leftPad = 46;
  const rightPad = 18;
  const topPad = 16;
  const bottomPad = 34;

  const maxY = Math.max(
    1,
    ...data.map((d) => Math.max(d.estimatedValue, d.totalContributed))
  );

  const chartW = width - leftPad - rightPad;
  const chartH = height - topPad - bottomPad;

  const getX = (index: number) => {
    if (data.length <= 1) return leftPad;
    return leftPad + (index / (data.length - 1)) * chartW;
  };

  const getY = (value: number) => {
    const ratio = value / maxY;
    return topPad + chartH - ratio * chartH;
  };

  const estimatedPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.estimatedValue)}`)
    .join(" ");

  const contributedPath = data
    .map((d, i) =>
      `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.totalContributed)}`
    )
    .join(" ");

  const yTicks = 4;
  const tickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => (maxY / yTicks) * i
  );

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[760px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {tickValues.map((v, idx) => {
            const y = getY(v);
            return (
              <g key={idx}>
                <line
                  x1={leftPad}
                  y1={y}
                  x2={width - rightPad}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={leftPad - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(255,255,255,0.45)"
                >
                  ${money(Math.round(v))}
                </text>
              </g>
            );
          })}

          <path
            d={contributedPath}
            fill="none"
            stroke="rgba(125,211,252,0.85)"
            strokeWidth="3"
            strokeDasharray="5 5"
          />

          <path
            d={estimatedPath}
            fill="none"
            stroke="rgba(52,211,153,0.95)"
            strokeWidth="4"
          />

          {data.map((d, i) => (
            <g key={d.years}>
              <circle
                cx={getX(i)}
                cy={getY(d.estimatedValue)}
                r="4.5"
                fill="rgba(52,211,153,1)"
              />
              <circle
                cx={getX(i)}
                cy={getY(d.totalContributed)}
                r="4"
                fill="rgba(125,211,252,1)"
              />
              <text
                x={getX(i)}
                y={height - 10}
                textAnchor="middle"
                fontSize="12"
                fill="rgba(255,255,255,0.65)"
              >
                {d.years}y
              </text>
            </g>
          ))}

          <g transform={`translate(${leftPad},${topPad - 4})`}>
            <rect
              x="0"
              y="0"
              width="12"
              height="12"
              rx="999"
              fill="rgba(52,211,153,1)"
            />
            <text x="18" y="10" fontSize="12" fill="rgba(255,255,255,0.7)">
              Estimated value
            </text>

            <rect
              x="130"
              y="0"
              width="12"
              height="12"
              rx="999"
              fill="rgba(125,211,252,1)"
            />
            <text x="148" y="10" fontSize="12" fill="rgba(255,255,255,0.7)">
              Total contributed
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}