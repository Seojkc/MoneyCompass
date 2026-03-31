"use client";

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

export default function IncomeExpenseTable({
  title,
  entries,
  onDelete,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let result = 0;

      switch (sortKey) {
        case "date":
          result = new Date(a.date).getTime() - new Date(b.date).getTime();
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
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === "date" ? false : true);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortAsc ? "▲" : "▼";
  };

  const showTooltip = (id: string) => setActiveTooltipId(id);
  const hideTooltip = (id: string) => {
    setActiveTooltipId((prev) => (prev === id ? null : prev));
  };

  return (
    <div className="table-container">
      <div className="table-header-row">
        <h3 className="table-title">{title}</h3>
      </div>

      <div className="table-scroll">
        <table className="transaction-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort("amount")}
                className="sortable amount-head"
              >
                <span>Amount</span>
                <span className="sort-icon">{sortIndicator("amount")}</span>
              </th>
              <th
                onClick={() => handleSort("category")}
                className="sortable"
              >
                <span>Category</span>
                <span className="sort-icon">{sortIndicator("category")}</span>
              </th>
              <th onClick={() => handleSort("name")} className="sortable">
                <span>Name</span>
                <span className="sort-icon">{sortIndicator("name")}</span>
              </th>
              <th onClick={() => handleSort("date")} className="sortable">
                <span>Date</span>
                <span className="sort-icon">{sortIndicator("date")}</span>
              </th>
              <th className="action-head">Action</th>
            </tr>
          </thead>

          <tbody>
            {sortedEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state-cell">
                  <div className="empty-state">
                    <span>No entries yet</span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={
                    entry.type === "income" ? "income-row" : "expense-row"
                  }
                >
                  <td
                    className={`amount-cell ${
                      entry.type === "income" ? "green" : "red"
                    }`}
                  >
                    ${entry.amount.toLocaleString()}
                  </td>

                  <td className="category-cell">
                    <span className="category-badge">{entry.category}</span>
                  </td>

                  <td
                    className="name-cell"
                    style={{ position: "relative", overflow: "visible" }}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => showTooltip(entry.id)}
                      onMouseLeave={() => hideTooltip(entry.id)}
                      onMouseDown={() => showTooltip(entry.id)}
                      onMouseUp={() => hideTooltip(entry.id)}
                      onTouchStart={() => showTooltip(entry.id)}
                      onTouchEnd={() => hideTooltip(entry.id)}
                      onTouchCancel={() => hideTooltip(entry.id)}
                      onBlur={() => hideTooltip(entry.id)}
                      aria-label={entry.name}
                      style={{
                        all: "unset",
                        display: "block",
                        width: "100%",
                        cursor: "pointer",
                        position: "relative",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                        WebkitTouchCallout: "none",
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          WebkitUserSelect: "none",
                          userSelect: "none",
                          WebkitTouchCallout: "none",
                          pointerEvents: "none",
                        }}
                      >
                        {entry.name}
                      </span>

                      {activeTooltipId === entry.id && (
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            bottom: "calc(100% + 30px)",
                            zIndex: 50,
                            maxWidth: "320px",
                            minWidth: "180px",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            background: "rgb(15, 23, 42)",
                            color: "#f8fafc",
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow:
                              "0 16px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            lineHeight: 1.35,
                            fontSize: "0.82rem",
                            fontWeight: 500,
                            backdropFilter: "blur(14px)",
                            WebkitBackdropFilter: "blur(14px)",
                          }}
                        >
                          {entry.name}
                        </span>
                      )}
                    </button>
                  </td>

                  <td className="date-cell">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>

                  <td className="action-cell">
                    <button
                      className="delete-btn"
                      onClick={() => onDelete(entry.id)}
                      aria-label={`Delete ${entry.name}`}
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