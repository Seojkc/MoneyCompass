"use client";

import "./CSS/Dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MonthCard from "./Components/MonthSliderCard";
import RoadmapTimeline from "./Components/AnalyticsFolder/RoadmapTimeline";
import FinanceCards from "./Components/FinanceCards";
import QuickAddEntry from "./Components/QuickAddEntry";
import IncomeExpenseTable from "./Components/IncomeExpenseTable";
import ExpensePieChart from "./Components/ExpensePieChart";
import CsvImporter, { ImportedRow } from "./Components/CsvImporter";
import {
  listEntriesByUser,
  createEntryFromUi,
  deleteEntryApi,
  getCurrentUser,
  logoutUser,
  type AuthUser,
} from "@/lib/bridge";
import Analytics from "./Components/AnalyticsFolder/Analytics";

type Transaction = {
  type: "income" | "expense";
  category: string;
  amount: number;
};

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  date: Date;
};

export default function Home() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();

    if (!user?.id || !user?.email) {
      logoutUser();
      router.replace("/login");
      return;
    }

    setCurrentUser(user);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!authChecked || !currentUser?.id) return;

    const loadEntries = async () => {
      setLoadingEntries(true);
      try {
        const y = selectedMonth.getFullYear();
        const m = selectedMonth.getMonth() + 1;

        const dbEntries = await listEntriesByUser({
          userId: currentUser.id,
          year: y,
          month: m,
          limit: 500,
        });

        setEntries(dbEntries);
      } catch (err) {
        console.error("Failed to load entries:", err);
      } finally {
        setLoadingEntries(false);
      }
    };

    loadEntries();
  }, [selectedMonth, authChecked, currentUser]);

  const makeId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const addQuickEntry = async (
    type: "income" | "expense",
    category: string,
    amount: number
  ) => {
    if (!currentUser?.id) {
      router.replace("/login");
      return;
    }

    setTransactions((prev) => [...prev, { type, category, amount }]);

    const today = new Date();
    const isSameSelectedMonthAsToday =
      selectedMonth.getFullYear() === today.getFullYear() &&
      selectedMonth.getMonth() === today.getMonth();

    const quickDate = isSameSelectedMonthAsToday
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
      : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);

    const tempId = makeId();

    const optimisticEntry: Entry = {
      id: tempId,
      type,
      name: "QuickEntry",
      category,
      amount: Math.abs(amount),
      date: quickDate,
    };

    setEntries((prev) => [optimisticEntry, ...prev]);

    try {
      const created = await createEntryFromUi({
        type: optimisticEntry.type,
        name: optimisticEntry.name,
        category: optimisticEntry.category,
        amount: optimisticEntry.amount,
        date: optimisticEntry.date,
      });

      setEntries((prev) => prev.map((e) => (e.id === tempId ? created : e)));
    } catch (err) {
      console.error("Failed to create entry:", err);
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
    }
  };

  const deleteEntry = async (id: string) => {
    const snapshot = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));

    try {
      const res = await deleteEntryApi(id);

      if (!res?.deleted) {
        throw new Error("Backend did not confirm deletion");
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
      setEntries(snapshot);
    }
  };

  const handleCsvData = async (rows: ImportedRow[]) => {
    if (!currentUser?.id) {
      router.replace("/login");
      return;
    }

    const converted: Entry[] = rows.map((r) => {
      const [y, m, d] = r.date.split("-").map(Number);

      return {
        id: makeId(),
        type: r.amount < 0 ? "expense" : "income",
        name: r.name || "Unknown",
        category: r.category || "Other",
        amount: Math.abs(r.amount),
        date: new Date(y, m - 1, d),
      };
    });

    setEntries((prev) => [...converted, ...prev]);

    const results = await Promise.allSettled(
      converted.map(async (temp) => {
        const created = await createEntryFromUi({
          type: temp.type,
          name: temp.name,
          category: temp.category,
          amount: temp.amount,
          date: temp.date,
        });

        return { tempId: temp.id, created };
      })
    );

    setEntries((prev) => {
      let next = [...prev];

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { tempId, created } = result.value;
          next = next.map((e) => (e.id === tempId ? created : e));
        }
      });

      const failedTempIds = results
        .map((result, idx) =>
          result.status === "rejected" ? converted[idx].id : null
        )
        .filter((id): id is string => Boolean(id));

      next = next.filter((e) => !failedTempIds.includes(e.id));

      return next;
    });

    results.forEach((result, idx) => {
      if (result.status === "rejected") {
        console.error("CSV row failed to import:", converted[idx], result.reason);
      }
    });
  };

  const handleLogout = () => {
    logoutUser();
    router.push("/login");
  };

  const handleLogin = () => {
    router.push("/login");
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;

    const navbarOffset = 110;
    const y = el.getBoundingClientRect().top + window.scrollY - navbarOffset;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  };

  const lastIncomeCategory = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.type === "income")
        .map((t) => t.category)
        .pop() || "Salary",
    [transactions]
  );

  const lastExpenseCategory = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.type === "expense")
        .map((t) => t.category)
        .pop() || "Food",
    [transactions]
  );

  const entriesThisMonth = useMemo(() => {
    return entries.filter((e) => {
      return (
        e.date.getMonth() === selectedMonth.getMonth() &&
        e.date.getFullYear() === selectedMonth.getFullYear()
      );
    });
  }, [entries, selectedMonth]);

  if (!authChecked || !currentUser) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "#e5eefb",
        background:
          "radial-gradient(circle at top left, rgba(56,189,248,0.16) 0%, transparent 24%), radial-gradient(circle at top right, rgba(139,92,246,0.14) 0%, transparent 28%), linear-gradient(180deg, #050816 0%, #0a1020 32%, #0d1326 68%, #09101d 100%)",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 12,
          zIndex: 1000,
          padding: "16px 20px 0",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            padding: "14px 18px",
            borderRadius: "26px",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.82), rgba(17,25,40,0.62))",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow:
              "0 18px 50px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div>
              MoneyCompass
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px",
                borderRadius: "18px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.18)",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => scrollToSection("dashboard-section")}
                style={navBtnStyle}
              >
                Dashboard
              </button>

              <button
                onClick={() => scrollToSection("analytics-section")}
                style={navBtnStyle}
              >
                Analytics
              </button>

              <button
                onClick={() => scrollToSection("journey-section")}
                style={navBtnStyle}
              >
                Journey Progress
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#cbd5e1",
                fontSize: "13px",
                maxWidth: "260px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              title={currentUser.email}
            >
              {currentUser.email}
            </div>

            {currentUser ? (
              <button
                onClick={handleLogout}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "16px",
                  padding: "12px 18px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#fff",
                  background:
                    "linear-gradient(135deg, rgba(239,68,68,0.95), rgba(190,24,93,0.95))",
                  boxShadow:
                    "0 12px 28px rgba(239,68,68,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                  transition: "all 0.22s ease",
                }}
              >
                Logout
              </button>
            ) : (
              <button
                onClick={handleLogin}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "16px",
                  padding: "12px 18px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#fff",
                  background:
                    "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(139,92,246,0.95))",
                  boxShadow:
                    "0 12px 28px rgba(59,130,246,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                  transition: "all 0.22s ease",
                }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "26px 20px 44px",
        }}
      >
        <section
          id="dashboard-section"
          style={{
            scrollMarginTop: "130px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              marginBottom: "18px",
              padding: "22px 22px 18px",
              borderRadius: "24px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 12px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h1
                  className="main-heading"
                  style={{ marginBottom: "6px", color: "#f8fafc" }}
                >
                  Dashboard
                </h1>
                <p
                  style={{
                    margin: 0,
                    color: "#94a3b8",
                    fontSize: "15px",
                  }}
                >
                  Track your money, review your analytics, and move forward with clarity.
                </p>
              </div>

              {loadingEntries && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#cbd5e1",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  Loading entries...
                </div>
              )}
            </div>
          </div>

          <div className="firstpart-container">
            <MonthCard onChange={setSelectedMonth} />
            <FinanceCards selectedDate={selectedMonth} entries={entries} />
          </div>

          <div className="secondpart-container">
            <div className="quick-add-container">
              <QuickAddEntry
                type="income"
                lastUsedCategory={lastIncomeCategory}
                onAdd={(cat, amt) => addQuickEntry("income", cat, amt)}
              />

              <QuickAddEntry
                type="expense"
                lastUsedCategory={lastExpenseCategory}
                onAdd={(cat, amt) => addQuickEntry("expense", cat, amt)}
              />

              <CsvImporter onData={handleCsvData} />
              <ExpensePieChart selectedDate={selectedMonth} entries={entries} />
            </div>

            <div className="TransactionTable-container">
              <IncomeExpenseTable
                title="Income"
                entries={entriesThisMonth.filter((e) => e.type === "income")}
                onDelete={deleteEntry}
              />

              <IncomeExpenseTable
                title="Expense"
                entries={entriesThisMonth.filter((e) => e.type === "expense")}
                onDelete={deleteEntry}
              />
            </div>
          </div>
        </section>

        <section
          id="analytics-section"
          style={{
            scrollMarginTop: "130px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              padding: "18px",
              borderRadius: "24px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 12px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <Analytics userId={currentUser.id} />
          </div>
        </section>

        <section
          id="journey-section"
          className="thirdpart-container p-4"
          style={{
            scrollMarginTop: "130px",
            borderRadius: "24px",
            padding: "22px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 12px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <h1 className="main-heading" style={{ color: "#f8fafc" }}>
            Journey Progress
          </h1>
          <h3 style={{ color: "#94a3b8" }}>
            How to become Financial independent ?
          </h3>
          <RoadmapTimeline userId={currentUser.id} />
        </section>
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  border: "1px solid transparent",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
  padding: "10px 16px",
  borderRadius: "14px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "14px",
  color: "#e2e8f0",
  transition: "all 0.22s ease",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};