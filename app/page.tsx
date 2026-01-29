'use client';

import Image from "next/image";
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
  const [rows, setRows] = useState<ImportedRow[]>([]);


  const addTransaction = (type: "income" | "expense", category: string, amount: number) => {
    setTransactions(prev => [...prev, { type, category, amount }]);
  };

  const deleteTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
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

    setEntries(prev => [...prev, ...converted]);
  };



  // Last used categories (optional)
  const lastIncomeCategory = [...transactions]
    .filter(t => t.type === "income")
    .map(t => t.category)
    .pop() || "Salary";

  const lastExpenseCategory = [...transactions]
    .filter(t => t.type === "expense")
    .map(t => t.category)
    .pop() || "Food";



  return (
    <div className="">
      <h1 className="main-heading">Dashboard</h1>

    <div className="firstpart-container">
      <MonthCard onChange={setSelectedMonth} />
      <FinanceCards selectedDate={selectedMonth} />
    </div>

    <div className="secondpart-container">
      <div className="quick-add-container">
        <QuickAddEntry
          type="income"
          lastUsedCategory={lastIncomeCategory}
          onAdd={(cat, amt) => addTransaction("income", cat, amt)}
        />

        <QuickAddEntry
          type="expense"
          lastUsedCategory={lastExpenseCategory}
          onAdd={(cat, amt) => addTransaction("expense", cat, amt)}
        />

        <CsvImporter onData={handleCsvData} />


        <ExpensePieChart selectedDate={selectedMonth} />

    </div>
    <div className="TransactionTable-container">
      <IncomeExpenseTable
        title="Income"
        entries={entries.filter(e => e.type === "income")}
        onDelete={deleteEntry}
      />

      <IncomeExpenseTable
        title="Expense"
        entries={entries.filter(e => e.type === "expense")}
        onDelete={deleteEntry}
      />

    </div>
    </div>
    
      

    </div>
  );
}
