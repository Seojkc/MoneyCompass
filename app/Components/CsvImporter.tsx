'use client';

import React, { useState } from "react";
import "../CSS/csvImporter.css";

export type ImportedRow = {
  id: string;
  date: string;      // yyyy-mm-dd
  name: string;
  category: string;
  amount: number;    // negative=expense, positive=income
};

type Props = {
  onData: (rows: ImportedRow[]) => void;
};

export default function CsvImporter({ onData }: Props) {
  const [file, setFile] = useState<File | null>(null);

  // modal + draft rows
  const [isOpen, setIsOpen] = useState(false);
  const [draftRows, setDraftRows] = useState<ImportedRow[]>([]);

  const CATEGORY_MAP: Record<string, string[]> = {
    Travel: ["uber","lyft","taxi","cab","airbnb","expedia","booking","flight","westjet","air canada","gas","petro","shell","esso","parking","toll"],
    Groceries: ["walmart","costco","superstore","loblaws","nofrills","freshco","metro","sobeys","whole foods","food basics","grocery"],
    Food: ["mcdonald","burger","kfc","subway","pizza","starbucks","tim hortons","coffee","cafe","restaurant","ubereats","doordash","skip"],
    Shopping: ["amazon","ebay","best buy","apple","samsung","sony","ikea","home depot","canadian tire","winners","marshalls","zara","h&m","nike","adidas"],
    Utilities: ["internet","hydro","electric","water","rogers","bell","telus","fido","freedom","koodo","mobile","wifi","utility"],
    Rent: ["rent","lease","apartment","condo","mortgage","property"],
    Transfer: ["transfer","etransfer","e-transfer","interac","deposit","withdraw","atm","wire","bank","cibc","rbc","td","scotia","payment","pay"],
    Health: ["pharmacy","shoppers","rexall","clinic","hospital","dentist","medical"],
    Subscriptions: ["netflix","spotify","prime","amazon prime","icloud","dropbox","adobe","microsoft","office","365","zoom"],
    Insurance: ["insurance","premium","coverage","intact","aviva","desjardins"],
    Education: ["college","university","course","udemy","coursera","tuition","fees"],
    Entertainment: ["movie","cinema","theatre","imax","ticketmaster","steam","xbox","playstation"],
    Other: [],
  };

  const makeId = () =>
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // ✅ IMPORTANT: empty => NaN (not 0)
  const cleanNumber = (v: string) => {
    const raw = (v ?? "").replace(/[$,"]/g, "").trim();
    if (raw === "") return NaN;
    const num = Number(raw);
    return Number.isFinite(num) ? num : NaN;
  };

  const detectCategory = (name: string) => {
    const n = name.toLowerCase();
    for (const category in CATEGORY_MAP) {
      for (const keyword of CATEGORY_MAP[category]) {
        if (n.includes(keyword)) return category;
      }
    }
    return "Other";
  };

  // ✅ Real CSV line parser: handles commas, quotes, and empty cells
  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // Handle escaped quotes: ""
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur.trim());
    return out;
  };

  const looksLikeHeader = (cols: string[]) => {
    const joined = cols.join(" ").toLowerCase();
    return joined.includes("date") && (joined.includes("debit") || joined.includes("credit") || joined.includes("description") || joined.includes("name"));
  };

  // CIBC common:
  // (A) date, desc, debit, credit
  // (B) date, desc, debit,    (credit missing)
  // (C) date, desc, amount    (some banks)
  const parseRow = (cols: string[]): ImportedRow | null => {
    if (cols.length < 3) return null;

    const dateRaw = (cols[0] ?? "").replace(/"/g, "").trim();
    const name = (cols[1] ?? "").replace(/"/g, "").trim();

    if (!dateRaw || !name) return null;

    const col2 = (cols[2] ?? "").trim();
    const col3 = (cols[3] ?? "").trim(); // may be undefined

    const debit = cleanNumber(col2);
    const credit = cleanNumber(col3);

    let amount: number | null = null;

    // If we have 4 columns and last is credit:
    if (cols.length >= 4) {
      // debit (expense)
      if (col2 !== "" && !isNaN(debit)) amount = -Math.abs(debit);
      // credit (income)
      if (col3 !== "" && !isNaN(credit)) amount = Math.abs(credit);
    } else {
      // 3 columns: date, desc, amount (could be signed or not)
      const val = cleanNumber(col2);
      if (!isNaN(val)) amount = val; // keep sign if provided
    }

    if (amount === null) return null;

    return {
      id: makeId(),
      date: dateRaw,
      name,
      category: detectCategory(name),
      amount,
    };
  };

  const handleUpload = async () => {
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (lines.length === 0) {
      setDraftRows([]);
      setIsOpen(true);
      return;
    }

    const firstCols = parseCsvLine(lines[0]);
    const startIndex = looksLikeHeader(firstCols) ? 1 : 0;

    const results: ImportedRow[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const row = parseRow(cols);
      if (row) results.push(row);
    }

    console.log("PARSED (before review):", results);
    setDraftRows(results);
    setIsOpen(true);
  };

  // editing helpers
  const updateRow = (id: string, patch: Partial<ImportedRow>) => {
    setDraftRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleType = (id: string) => {
    setDraftRows(prev => prev.map(r => (r.id === id ? { ...r, amount: r.amount * -1 } : r)));
  };

  const deleteRow = (id: string) => {
    setDraftRows(prev => prev.filter(r => r.id !== id));
  };

  const confirmUpload = () => {
    console.log("FINAL (after review):", draftRows);
    onData(draftRows);
    setIsOpen(false);
    setDraftRows([]);
    setFile(null);
  };

  return (
    <>
      <div className="csv-upload-wrapper">
        <label className="csv-picker">
          <input
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
            hidden
          />
          📂 Choose CSV File
        </label>

        {file && <span className="csv-filename">{file.name}</span>}

        <button onClick={handleUpload} disabled={!file} className="csv-upload-btn">
          🚀 Import
        </button>
      </div>

      {isOpen && (
        <div className="csv-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="csv-modal" onClick={e => e.stopPropagation()}>
            <div className="csv-modal-header">
              <h3>Review Transactions</h3>
              <button className="csv-close" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="csv-table-wrap">
              <table className="csv-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>➖</th>
                  </tr>
                </thead>

                <tbody>
                  {draftRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 16, textAlign: "center", opacity: 0.75 }}>
                        No rows parsed. (Check CSV columns: date, description, debit, credit)
                      </td>
                    </tr>
                  ) : (
                    draftRows.map(r => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className={`type-pill ${r.amount >= 0 ? "income" : "expense"}`}
                            onClick={() => toggleType(r.id)}
                          >
                            {r.amount >= 0 ? "Income" : "Expense"}
                          </button>
                        </td>

                        <td>
                          <input
                            className="csv-input"
                            type="date"
                            value={r.date}
                            onChange={e => updateRow(r.id, { date: e.target.value })}
                          />
                        </td>

                        <td>
                          <input
                            className="csv-input"
                            value={r.name}
                            onChange={e => updateRow(r.id, { name: e.target.value })}
                          />
                        </td>

                        <td>
                          <input
                            className="csv-input"
                            value={r.category}
                            onChange={e => updateRow(r.id, { category: e.target.value })}
                          />
                        </td>

                        <td>
                          <input
                            className="csv-input"
                            type="number"
                            step="0.01"
                            value={Math.abs(r.amount)}
                            onChange={e => {
                              const v = Number(e.target.value || 0);
                              updateRow(r.id, { amount: r.amount >= 0 ? Math.abs(v) : -Math.abs(v) });
                            }}
                          />
                        </td>

                        <td>
                          <button className="delete-minus" onClick={() => deleteRow(r.id)}>
                            ➖
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="csv-modal-actions">
              <button className="btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={confirmUpload}>✅ Upload</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
