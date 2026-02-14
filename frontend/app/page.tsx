'use client';

import "./CSS/Dashboard.css";
import { useState ,useEffect} from "react";
import MonthCard from "./Components/MonthSliderCard";
import FinanceCards from "./Components/FinanceCards";
import QuickAddEntry from "./Components/QuickAddEntry";
import IncomeExpenseTable from "./Components/IncomeExpenseTable";
import ExpensePieChart from "./Components/ExpensePieChart";
import CsvImporter, { ImportedRow } from "./Components/CsvImporter";
import { UiEntry, listEntries, createEntryFromUi, deleteEntryApi } from "@/lib/bridge";





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
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      const dbEntries = await listEntries();
      setEntries(dbEntries);
      console.log("Loaded entries from backend:", dbEntries);
    })();
  }, []);



  const makeId = () =>
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // ✅ QuickAdd should update BOTH: transactions (for last used) AND entries (for table)
  const addQuickEntry = async (type: "income" | "expense",category: string,amount: number) => {
    setTransactions((prev) => [...prev, { type, category, amount }]);

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 1) Create a temp entry for instant UI update
    const tempId = makeId();
    const optimisticEntry: Entry = {
      id: tempId,
      type,
      name: "QuickEntry",
      category,
      amount: Math.abs(amount),
      date: dateOnly,
    };

    setEntries((prev) => [optimisticEntry, ...prev]);

    try {
      // 2) POST to backend (NO id in payload)
      const created = await createEntryFromUi({
        type: optimisticEntry.type,
        name: optimisticEntry.name,
        category: optimisticEntry.category,
        amount: optimisticEntry.amount,
        date: optimisticEntry.date,
      });

      // 3) Replace temp entry with real DB entry (real id)
      setEntries((prev) =>
        prev.map((e) => (e.id === tempId ? created : e))
      );
    } catch (err) {
      console.error("Failed to create entry:", err);

      // 4) Rollback optimistic UI if API failed
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
    }
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleCsvData = async (rows: ImportedRow[]) => {
    // 1) Convert CSV rows -> UI entries (use TEMP ids for UI)
    const converted: Entry[] = rows.map((r) => {
      const [y, m, d] = r.date.split("-").map(Number);

      return {
        id: crypto.randomUUID(), // temp id for UI
        type: r.amount < 0 ? "expense" : "income",
        name: r.name || "Unknown",
        category: r.category || "Other",
        amount: Math.abs(r.amount),
        date: new Date(y, m - 1, d),
      };
    });

    // 2) Optimistic UI update
    setEntries((prev) => [...converted, ...prev]);

    // 3) POST each entry to backend, then replace temp with real DB entry
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

    // 4) Apply updates / rollbacks
    setEntries((prev) => {
      let next = [...prev];

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { tempId, created } = r.value;
          next = next.map((e) => (e.id === tempId ? created : e));
        } else {
          // remove failed ones
          // (optional) you can keep them and mark as "failed" instead
          const failedTemp = converted.find((x) => results.indexOf(r as any) >= 0)?.id;
          // safer: remove by matching all temps that didn't fulfill
        }
      }

      // safer rollback: remove any temp ids that failed
      const failedTempIds = results
        .filter((x) => x.status === "rejected")
        .map((_, idx) => converted[idx].id);

      next = next.filter((e) => !failedTempIds.includes(e.id));

      return next;
    });

    // Optional: log failures
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.error("CSV row failed to import:", converted[idx], r.reason);
      }
    });
  };

  // Last used categories
  const lastIncomeCategory =
    [...transactions].filter(t => t.type === "income").map(t => t.category).pop() || "Salary";

  const lastExpenseCategory =
    [...transactions].filter(t => t.type === "expense").map(t => t.category).pop() || "Food";


  const sameMonth = (d: Date, selected: Date) =>
    d.getMonth() === selected.getMonth() && d.getFullYear() === selected.getFullYear();

  const entriesThisMonth = entries.filter(e => sameMonth(e.date, selectedMonth));


  return (
    <div className="">
      <h1 className="main-heading">Dashboard</h1>

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
            entries={entriesThisMonth.filter(e => e.type === "income")}
            onDelete={deleteEntry}
          />

          <IncomeExpenseTable
            title="Expense"
            entries={entriesThisMonth.filter(e => e.type === "expense")}
            onDelete={deleteEntry}
          />

        </div>
      </div>
    </div>
  );
}
