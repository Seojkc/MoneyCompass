'use client';

import "./CSS/Dashboard.css";
import { useState } from "react";
import MonthCard from "./Components/MonthSliderCard";
import FinanceCards from "./Components/FinanceCards";
import QuickAddEntry from "./Components/QuickAddEntry";
import IncomeExpenseTable from "./Components/IncomeExpenseTable";
import ExpensePieChart from "./Components/ExpensePieChart";
import CsvImporter, { ImportedRow } from "./Components/CsvImporter";

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

  const makeId = () =>
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // ✅ QuickAdd should update BOTH: transactions (for last used) AND entries (for table)
  const addQuickEntry = (type: "income" | "expense", category: string, amount: number) => {
    setTransactions(prev => [...prev, { type, category, amount }]);

    const today = new Date();
    // keep "today" clean (no timezone surprises in UI)
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const newEntry: Entry = {
      id: makeId(),
      type,
      name: "QuickEntry",
      category,
      amount: Math.abs(amount),
      date: dateOnly,
    };

    setEntries(prev => [newEntry, ...prev]); // put latest at top
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleCsvData = (rows: ImportedRow[]) => {
    const converted: Entry[] = rows.map(r => {
      const [y, m, d] = r.date.split("-").map(Number);

      return {
        id: r.id,
        type: r.amount < 0 ? "expense" : "income",
        name: r.name || "Unknown",
        category: r.category || "Other",
        amount: Math.abs(r.amount),
        date: new Date(y, m - 1, d),
      };
    });

    setEntries(prev => [...converted, ...prev]);
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
