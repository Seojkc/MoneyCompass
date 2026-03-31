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
import "../../CSS/InvestCard.css";

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
    <div className="invest-why-content">
      <div className="invest-why-group">
        <h3>📈 Why This Matters</h3>
        <p>
          Once your cash flow is stable, your emergency fund is built, and
          high-interest debt is under control, the next step is to let your
          money start working for you.
        </p>
      </div>

      <div className="invest-why-block">
        <h4>Inflation slowly reduces cash value</h4>
        <p>
          If inflation stays around 3% per year, money sitting in cash loses
          purchasing power over time. Investing aims to help your money grow
          faster than inflation.
        </p>
      </div>

      <div className="invest-why-cards">
        <div className="invest-why-mini-card">
          <div className="invest-why-mini-card__title">Savings account</div>
          <div className="invest-why-mini-card__sub">Often lower growth</div>
          <div className="invest-why-mini-card__value">~1–3%</div>
        </div>
        <div className="invest-why-mini-card">
          <div className="invest-why-mini-card__title">Bonds</div>
          <div className="invest-why-mini-card__sub">
            Moderate risk / return
          </div>
          <div className="invest-why-mini-card__value">~3–5%</div>
        </div>
        <div className="invest-why-mini-card">
          <div className="invest-why-mini-card__title">Stock market index</div>
          <div className="invest-why-mini-card__sub">
            Higher risk, higher long-term return
          </div>
          <div className="invest-why-mini-card__value">~7–10%</div>
        </div>
      </div>

      <div className="invest-why-block">
        <h4>🧠 The power of compounding</h4>
        <p>
          Returns can generate more returns over time. That is why starting
          earlier often matters more than starting with a large amount later.
        </p>
      </div>

      <div className="invest-why-block">
        <h4>Common investment types</h4>
        <ul>
          <li>• ETFs: simple, diversified, low cost, beginner-friendly</li>
          <li>• Index funds: broad market exposure</li>
          <li>• Mutual funds: managed but often higher fees</li>
          <li>• Individual stocks: higher risk, less diversified</li>
        </ul>
      </div>

      <div className="invest-why-block">
        <h4>Common Canadian account types</h4>
        <ul>
          <li>• TFSA: tax-free growth and withdrawals</li>
          <li>• RRSP: tax deduction today, taxed later</li>
          <li>• FHSA: for an eligible first home</li>
          <li>• Taxable account: regular non-registered investing account</li>
        </ul>
      </div>

      <div className="invest-why-callout invest-why-callout--green">
        Diversification matters. Spreading your money across many companies,
        sectors, and markets can reduce concentration risk.
      </div>

      <div className="invest-why-callout invest-why-callout--amber">
        Important: projections on this card are estimates only. They are not
        guaranteed returns or financial advice.
      </div>

      <div className="invest-why-footer">
        <p>Investing works best as a long-term habit, not a short-term prediction game.</p>
        <span>Start simple. Stay consistent. Give compounding time.</span>
      </div>
    </div>
  );

  return (
    <>
      <section className="invest-card">
        <div className="invest-card__glow" />

        <div className="invest-card__header">
          <div className="invest-card__title-wrap">
            <div className="invest-card__eyebrow">Step 6</div>
            <h1 className="invest-card__title">Investing</h1>

            <div className="invest-card__status">
              {loading ? (
                "Loading saved settings…"
              ) : saveState === "saving" ? (
                "Saving…"
              ) : saveState === "saved" ? (
                "Saved ✓"
              ) : saveState === "error" ? (
                <span className="invest-card__status--error">
                  Couldn’t save (check API)
                </span>
              ) : (
                "Synced"
              )}
            </div>
          </div>

          <button
            onClick={() => setWhyOpen(true)}
            className="invest-card__why-btn"
          >
            <span>Why?</span>
            <span className="invest-card__why-arrow">›</span>
          </button>
        </div>

        <div className="invest-toolbar">
          <button
            onClick={() => setAddOpen(true)}
            className="invest-add-btn"
          >
            <span className="invest-add-btn__plus">＋</span>
            Add investment
          </button>

          <a
            href={INVEST_LEARN_LINK}
            target="_blank"
            rel="noreferrer"
            className="invest-learn-btn"
          >
            <span className="invest-learn-btn__icon">▶</span>
            Watch on YouTube
          </a>
        </div>

        <div className="invest-stats-strip">
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

        <div className="invest-section">
          <div className="invest-section__header">
            <div>
              <h2 className="invest-section__title">Investment holdings</h2>
              <p className="invest-section__subtitle">
                Track your accounts, monthly contributions, and estimated return.
              </p>
            </div>
          </div>

          <div className="invest-table-wrap">
            <table className="invest-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Investment</th>
                  <th>Type</th>
                  <th>Risk</th>
                  <th>Avg return</th>
                  <th>Current invested</th>
                  <th>Monthly amount</th>
                  <th>Link</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="invest-table__empty">
                      No investments yet. Add one to begin your projection.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <select
                          value={row.accountType}
                          onChange={(e) =>
                            updateRow(
                              row.id,
                              "accountType",
                              e.target.value as AccountType
                            )
                          }
                          className="invest-field invest-field--select"
                        >
                          <option value="TFSA">TFSA</option>
                          <option value="RRSP">RRSP</option>
                          <option value="FHSA">FHSA</option>
                          <option value="Taxable">Taxable</option>
                          <option value="RESP">RESP</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>

                      <td>
                        <input
                          value={row.name}
                          onChange={(e) => updateRow(row.id, "name", e.target.value)}
                          className="invest-field"
                        />
                      </td>

                      <td className="invest-table__text">{row.kind}</td>

                      <td>
                        {row.risk ? (
                          <span
                            className={[
                              "invest-risk-pill",
                              row.risk === "Low"
                                ? "invest-risk-pill--low"
                                : row.risk === "Medium"
                                ? "invest-risk-pill--medium"
                                : "invest-risk-pill--high",
                            ].join(" ")}
                          >
                            {row.risk}
                          </span>
                        ) : (
                          <span className="invest-table__muted">—</span>
                        )}
                      </td>

                      <td>
                        <div className="invest-input-inline">
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
                            className="invest-input-inline__input"
                          />
                          <span className="invest-input-inline__suffix">%</span>
                        </div>
                      </td>

                      <td>
                        <div className="invest-input-inline">
                          <span className="invest-input-inline__prefix">$</span>
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
                            className="invest-input-inline__input"
                          />
                        </div>
                      </td>

                      <td>
                        <div className="invest-input-inline">
                          <span className="invest-input-inline__prefix">$</span>
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
                            className="invest-input-inline__input"
                          />
                        </div>
                      </td>

                      <td>
                        {row.website ? (
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noreferrer"
                            className="invest-link-btn"
                          >
                            Open site
                          </a>
                        ) : (
                          <span className="invest-table__muted">—</span>
                        )}
                      </td>

                      <td>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="invest-delete-btn"
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

          <div className="invest-status-row">
            <span className="invest-status-row__label">Status:</span>
            <span
              className={[
                "invest-status-row__pill",
                isDone ? "invest-status-row__pill--done" : "",
              ].join(" ")}
            >
              {isDone ? "Completed ✓" : "In progress"}
            </span>
            <span className="invest-status-row__text">
              Based on your current entries, this card shows estimated values only.
            </span>
          </div>
        </div>

        <div className="invest-section">
          <div className="invest-section__header invest-section__header--split">
            <div>
              <h2 className="invest-section__title">
                Estimated investment projection
              </h2>
              <p className="invest-section__subtitle">
                Formula uses monthly compounding and your weighted average return.
              </p>
            </div>

            <div className="invest-note-pill">
              Not guaranteed. For planning only.
            </div>
          </div>

          <div className="invest-projection-layout">
            <div className="invest-projection-chart">
              <ProjectionChart data={projections} />
            </div>

            <div className="invest-projection-table-wrap">
              <table className="invest-projection-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Total contributed</th>
                    <th>Estimated growth</th>
                    <th>Estimated value</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((item) => {
                    const growth = item.estimatedValue - item.totalContributed;

                    return (
                      <tr key={item.years}>
                        <td>{item.years} years</td>
                        <td>${money(Math.round(item.totalContributed))}</td>
                        <td className="invest-projection-table__growth">
                          ${money(Math.round(growth))}
                        </td>
                        <td className="invest-projection-table__value">
                          ${money(Math.round(item.estimatedValue))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          
        </div>
      </section>

      {whyOpen && (
        <OverlayShell onClose={() => setWhyOpen(false)}>
          <div className="invest-modal__top">
            <div>
              <div className="invest-modal__title">{whyTitle}</div>
              <div className="invest-modal__subtitle">
                Quick explanation (tap outside to close).
              </div>
            </div>

            <CloseButton onClick={() => setWhyOpen(false)} />
          </div>

          <div className="invest-modal__body">{whyContent ?? defaultWhy}</div>

          
        </OverlayShell>
      )}

      {addOpen && (
        <OverlayShell onClose={() => setAddOpen(false)} maxWidthClass="invest-modal__panel--wide">
          <div className="invest-modal__top">
            <div>
              <div className="invest-modal__title">Add investment</div>
              <div className="invest-modal__subtitle">
                Choose a preset or enter your own investment manually.
              </div>
            </div>

          </div>

          <div className="invest-form-grid">
            <Field label="Investment account type">
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="invest-field"
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
                className="invest-field"
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
                  className="invest-field"
                />
              </Field>
            )}

            <Field label="Investment type">
              <div className="invest-static-field">
                {selectedPreset ? selectedPreset.kind : "Other"}
              </div>
            </Field>

            <Field label="Monthly investment amount">
              <div className="invest-money-field">
                <span className="invest-money-field__prefix">$</span>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(Number(e.target.value || 0))}
                  className="invest-money-field__input"
                />
              </div>
            </Field>

            <Field label="Currently invested">
              <div className="invest-money-field">
                <span className="invest-money-field__prefix">$</span>
                <input
                  type="number"
                  value={currentInvested}
                  onChange={(e) => setCurrentInvested(Number(e.target.value || 0))}
                  className="invest-money-field__input"
                />
              </div>
            </Field>

            <Field label="Average annual return used for estimate (Data based on January 31, 2026, 5-year average return)">
              <div className="invest-money-field">
                <input
                  type="number"
                  value={averageReturnInput}
                  onChange={(e) =>
                    setAverageReturnInput(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="invest-money-field__input invest-money-field__input--full"
                />
                <span className="invest-money-field__prefix">%</span>
              </div>
            </Field>

            <div className="invest-form-grid__full">
              <div className="invest-form-note invest-form-note--amber">
                Use this as an estimated rate only. Do not treat it as a promise
                of future returns.
              </div>
            </div>

            {selectedPreset && (
              <div className="invest-form-grid__full invest-selected-preset">
                <div>
                  Selected:{" "}
                  <span className="invest-selected-preset__name">
                    {selectedPreset.name}
                  </span>
                </div>
                <a
                  href={selectedPreset.website}
                  target="_blank"
                  rel="noreferrer"
                  className="invest-link-btn"
                >
                  Open official site
                </a>
              </div>
            )}
          </div>

          <div className="invest-modal__actions">
            <button
              onClick={() => setAddOpen(false)}
              className="invest-modal__secondary-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleAddInvestment}
              className="invest-modal__primary-btn"
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
    <div className="invest-stat">
      <div className="invest-stat__label">{label}</div>
      <div className="invest-stat__value">{value}</div>
      <div className="invest-stat__sub">{sub}</div>
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
    <label className="invest-form-field">
      <div className="invest-form-field__label">{label}</div>
      {children}
    </label>
  );
}

function OverlayShell({
  children,
  onClose,
  maxWidthClass = "",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
}) {
  return (
    <div
      className="invest-modal"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Close overlay"
        onClick={onClose}
        className="invest-modal__backdrop"
      />

      <div className={`invest-modal__panel ${maxWidthClass}`}>
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="invest-close-btn"
      aria-label="Close"
    >
      <span className="sr-only">Close</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="invest-close-btn__icon"
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
  const width = 760;
  const height = 320;
  const leftPad = 72;
  const rightPad = 18;
  const topPad = 18;
  const bottomPad = 46;

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
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.totalContributed)}`)
    .join(" ");

  const yTicks = 3;
  const tickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => (maxY / yTicks) * i
  );

  return (
    <div className="invest-chart">
      <div className="invest-chart__legend">
        <span className="invest-chart__legend-item">
          <span className="invest-chart__legend-dot invest-chart__legend-dot--estimated" />
          Estimated
        </span>
        <span className="invest-chart__legend-item">
          <span className="invest-chart__legend-dot invest-chart__legend-dot--contributed" />
          Contributed
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="invest-chart__svg"
      >
        {tickValues.map((v, idx) => {
          const y = getY(v);
          return (
            <g key={idx}>
              <line
                x1={leftPad}
                y1={y}
                x2={width - rightPad}
                y2={y}
                className="invest-chart__grid-line"
              />
              <text
                x={leftPad +12}
                y={y + 5}
                textAnchor="end"
                className="invest-chart__y-label"
              >
                ${money(Math.round(v))}
              </text>
            </g>
          );
        })}

        <path
          d={contributedPath}
          fill="none"
          className="invest-chart__line invest-chart__line--contributed"
        />

        <path
          d={estimatedPath}
          fill="none"
          className="invest-chart__line invest-chart__line--estimated"
        />

        {data.map((d, i) => (
          <g key={d.years}>
            <circle
              cx={getX(i)}
              cy={getY(d.totalContributed)}
              r="4"
              className="invest-chart__point invest-chart__point--contributed"
            />
            <circle
              cx={getX(i)}
              cy={getY(d.estimatedValue)}
              r="4.5"
              className="invest-chart__point invest-chart__point--estimated"
            />
            <text
              x={getX(i)}
              y={height - 12}
              textAnchor="middle"
              className="invest-chart__x-label"
            >
              {d.years}y
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}