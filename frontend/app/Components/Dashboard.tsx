"use client";

import { useState } from "react";
import "../CSS/Dashboard.css";
import MonthCard from "./MonthSliderCard";
import FinanceCards from "./FinanceCards";
import QuickAddEntry from "./QuickAddEntry";
import CsvImporter, { ImportedRow } from "./CsvImporter";
import ExpensePieChart from "./ExpensePieChart";
import IncomeExpenseTable from "./IncomeExpenseTable";

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  date: Date;
};

type Props = {
  selectedMonth: Date;
  setSelectedMonth: (date: Date) => void;
  entries: Entry[];
  entriesThisMonth: Entry[];
  loadingEntries: boolean;
  lastIncomeCategory: string;
  lastExpenseCategory: string;
  addQuickEntry: (
    type: "income" | "expense",
    category: string,
    amount: number
  ) => Promise<void>;
  handleCsvData: (rows: ImportedRow[]) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
};

export default function DashboardSection({
  selectedMonth,
  setSelectedMonth,
  entries,
  entriesThisMonth,
  loadingEntries,
  lastIncomeCategory,
  lastExpenseCategory,
  addQuickEntry,
  handleCsvData,
  deleteEntry,
}: Props) {
  const [isMobileToolsCollapsed, setIsMobileToolsCollapsed] = useState(false);

  return (
    <section id="dashboard-section" className="dashboard-section-block">
      <div className="dashboard-section-hero-head">
        <div>
          <h1 className="dashboard-main-heading">Dashboard</h1>
        </div>
      </div>

      <div className="dashboard-firstpart-container">
        <MonthCard value={selectedMonth} onChange={setSelectedMonth} />
        <FinanceCards selectedDate={selectedMonth} entries={entries} />
      </div>

      <div className="dashboard-secondpart-container">
        <div className="dashboard-quick-add-container">
          <div className="dashboard-mobile-tools-head">
            <button
              type="button"
              className={`dashboard-mobile-tools-toggle ${
                isMobileToolsCollapsed ? "is-collapsed" : ""
              }`}
              onClick={() => setIsMobileToolsCollapsed((prev) => !prev)}
              aria-expanded={!isMobileToolsCollapsed}
              aria-label={
                isMobileToolsCollapsed ? "Expand quick tools" : "Collapse quick tools"
              }
            >
              
              <span className="dashboard-mobile-tools-toggle-text">{isMobileToolsCollapsed ? "Add Entry" : " Hide  Entry"}</span>
              
            </button>
          </div>

          <div
            className={`dashboard-mobile-tools-panel ${
              isMobileToolsCollapsed ? "is-collapsed" : ""
            }`}
          >
            <div className="dashboard-mobile-tools-panel-inner">
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
            </div>
          </div>

          <ExpensePieChart selectedDate={selectedMonth} entries={entries} />
        </div>

        <div className="dashboard-transaction-table-container">
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
  );
}