'use client';

import "./CSS/Dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MonthCard from "./Components/MonthSliderCard";
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
    <div className="">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <h1 className="main-heading">Dashboard</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "14px", opacity: 0.8 }}>
            {currentUser.email}
          </span>

          <button
            onClick={handleLogout}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="firstpart-container">
        <MonthCard onChange={setSelectedMonth} />

        <FinanceCards
          userId={currentUser.id}
          selectedDate={selectedMonth}
          entries={entries}
        />
      </div>

      <div className="secondpart-container">
        <div className="quick-add-container">
          <QuickAddEntry
            userId={currentUser.id}
            type="income"
            lastUsedCategory={lastIncomeCategory}
            onAdd={(cat, amt) => addQuickEntry("income", cat, amt)}
          />

          <QuickAddEntry
            userId={currentUser.id}
            type="expense"
            lastUsedCategory={lastExpenseCategory}
            onAdd={(cat, amt) => addQuickEntry("expense", cat, amt)}
          />

          <CsvImporter
            userId={currentUser.id}
            onData={handleCsvData}
          />

          <ExpensePieChart
            userId={currentUser.id}
            selectedDate={selectedMonth}
            entries={entries}
          />
        </div>

        <div className="TransactionTable-container">
          <IncomeExpenseTable
            userId={currentUser.id}
            title="Income"
            entries={entriesThisMonth.filter((e) => e.type === "income")}
            onDelete={deleteEntry}
          />

          <IncomeExpenseTable
            userId={currentUser.id}
            title="Expense"
            entries={entriesThisMonth.filter((e) => e.type === "expense")}
            onDelete={deleteEntry}
          />
        </div>
      </div>

      <Analytics
        userId={currentUser.id}
        selectedDate={selectedMonth}
        entries={entries}
        loading={loadingEntries}
      />
    </div>
  );
}