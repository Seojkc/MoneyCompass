'use client';

import React from "react";
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

export default function IncomeExpenseTable({ title, entries, onDelete }: Props) {
  return (
    <div className="table-container">
      <h3 className="table-title">{title}</h3>
      <div className="table-scroll">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "#888" }}>
                  No entries yet
                </td>
              </tr>
            ) : (
              entries.map(entry => (
                <tr  key={entry.id} className={entry.type === "income" ? "income-row" : "expense-row"}>
                  <td>{entry.date.toLocaleDateString()}</td>
                  <td>{entry.name}</td>
                  <td>{entry.category}</td>

                  <td className={entry.type === "income" ? "green" : "red"}>
                    {entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString()}
                  </td>
                  <td>
                    <button className="delete-btn" onClick={() => onDelete(entry.id)}>
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
