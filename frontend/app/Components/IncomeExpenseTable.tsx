'use client';

import React, { useMemo, useState } from "react";
import "../CSS/TransactionTable.css";

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  date: Date;
};

type Props = {
  title: string;
  entries: Entry[];
  onDelete: (id: string) => void;
};

type SortKey = "date" | "name" | "category" | "amount";

export default function IncomeExpenseTable({ title, entries, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false); // default = date DESC

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let result = 0;

      switch (sortKey) {
        case "date":
          result = a.date.getTime() - b.date.getTime();
          break;
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "category":
          result = a.category.localeCompare(b.category);
          break;
        case "amount":
          result = a.amount - b.amount;
          break;
      }

      return sortAsc ? result : -result;
    });

    return sorted;
  }, [entries, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev); // toggle direction
    } else {
      setSortKey(key);
      setSortAsc(key === "date" ? false : true); 
      // date default DESC, others default ASC
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  };

  return (
    <div className="table-container">
      <h3 className="table-title">{title}</h3>

      <div className="table-scroll">
        <table className="transaction-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("date")} style={{ cursor: "pointer" }}>
                Date{sortIndicator("date")}
              </th>
              <th onClick={() => handleSort("name")} style={{ cursor: "pointer" }}>
                Name{sortIndicator("name")}
              </th>
              <th onClick={() => handleSort("category")} style={{ cursor: "pointer" }}>
                Category{sortIndicator("category")}
              </th>
              <th onClick={() => handleSort("amount")} style={{ cursor: "pointer" }}>
                Amount{sortIndicator("amount")}
              </th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {sortedEntries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#888" }}>
                  No entries yet
                </td>
              </tr>
            ) : (
              sortedEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={entry.type === "income" ? "income-row" : "expense-row"}
                >
                  <td>{entry.date.toLocaleDateString()}</td>
                  <td>{entry.name}</td>
                  <td>{entry.category}</td>

                  <td className={entry.type === "income" ? "green" : "red"}>
                    {entry.type === "income" ? "+" : "-"}$
                    {entry.amount.toLocaleString()}
                  </td>

                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => onDelete(entry.id)}
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
  );
}