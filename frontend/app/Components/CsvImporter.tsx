"use client";

import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import "../CSS/csvImporter.css";

export type ImportedRow = {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
};

type Props = {
  onData: (rows: ImportedRow[]) => void;
};

export default function CsvImporter({ onData }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftRows, setDraftRows] = useState<ImportedRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const CATEGORY_MAP: Record<string, string[]> = {
    Travel: [
      "uber",
      "lyft",
      "taxi",
      "cab",
      "airbnb",
      "expedia",
      "booking",
      "flight",
      "westjet",
      "air canada",
      "gas",
      "petro",
      "shell",
      "esso",
      "parking",
      "toll",
    ],
    Groceries: [
      "wal-mart",
      "costco",
      "superstore",
      "loblaws",
      "nofrills",
      "freshco",
      "metro",
      "sobeys",
      "whole foods",
      "food basics",
      "grocery",
    ],
    Food: [
      "mcdonald",
      "burger",
      "kfc",
      "subway",
      "pizza",
      "starbucks",
      "tim hortons",
      "coffee",
      "cafe",
      "restaurant",
      "ubereats",
      "doordash",
      "skip",
    ],
    Shopping: [
      "amazon",
      "ebay",
      "best buy",
      "apple",
      "samsung",
      "sony",
      "ikea",
      "home depot",
      "canadian tire",
      "winners",
      "marshalls",
      "zara",
      "h&m",
      "nike",
      "adidas",
    ],
    Utilities: [
      "internet",
      "hydro",
      "electric",
      "water",
      "rogers",
      "bell",
      "telus",
      "fido",
      "freedom",
      "koodo",
      "mobile",
      "wifi",
      "utility",
    ],
    Rent: ["rent", "lease", "apartment", "condo", "mortgage", "property"],
    Transfer: [
      "transfer",
      "etransfer",
      "e-transfer",
      "interac",
      "deposit",
      "withdraw",
      "atm",
      "wire",
      "bank",
      "cibc",
      "rbc",
      "td",
      "scotia",
      "payment",
      "pay",
    ],
    Health: [
      "pharmacy",
      "shoppers",
      "rexall",
      "clinic",
      "hospital",
      "dentist",
      "medical",
    ],
    Subscriptions: [
      "netflix",
      "spotify",
      "prime",
      "amazon prime",
      "icloud",
      "dropbox",
      "adobe",
      "microsoft",
      "office",
      "365",
      "zoom",
    ],
    Insurance: ["insurance", "premium", "coverage", "intact", "aviva", "desjardins"],
    Education: [
      "college",
      "university",
      "course",
      "udemy",
      "coursera",
      "tuition",
      "fees",
    ],
    Entertainment: [
      "movie",
      "cinema",
      "theatre",
      "imax",
      "ticketmaster",
      "steam",
      "xbox",
      "playstation",
    ],
    Other: [],
  };

  const EXPENSE_CATEGORIES = [
    "Rent",
    "Groceries",
    "Food",
    "Travel",
    "Utilities",
    "Shopping",
    "Health",
    "Subscriptions",
    "Insurance",
    "Education",
    "Entertainment",
    "Transfer",
    "Other",
  ];

  const INCOME_CATEGORIES = [
    "Salary",
    "Business",
    "Freelance",
    "Interest",
    "Refund",
    "Gift",
    "Investment",
    "Transfer",
    "Other",
  ];

  const makeId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const cleanNumber = (v: unknown) => {
    const raw = String(v ?? "")
      .replace(/[$,"]/g, "")
      .trim();
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

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
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
    return (
      joined.includes("date") &&
      (joined.includes("debit") ||
        joined.includes("credit") ||
        joined.includes("description") ||
        joined.includes("name") ||
        joined.includes("amount"))
    );
  };

  const normalizeDate = (value: unknown): string => {
    if (value == null || value === "") return "";

    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return "";
      const yyyy = String(parsed.y).padStart(4, "0");
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    const raw = String(value).trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return raw;
  };

  const parseRow = (cols: (string | number | undefined | null)[]): ImportedRow | null => {
    if (cols.length < 3) return null;

    const dateRaw = normalizeDate(cols[0]);
    const name = String(cols[1] ?? "").replace(/"/g, "").trim();

    if (!dateRaw || !name) return null;

    const col2 = String(cols[2] ?? "").trim();
    const col3 = String(cols[3] ?? "").trim();

    const debit = cleanNumber(col2);
    const credit = cleanNumber(col3);

    let amount: number | null = null;

    if (cols.length >= 4) {
      if (col2 !== "" && !isNaN(debit)) amount = -Math.abs(debit);
      if (col3 !== "" && !isNaN(credit)) amount = Math.abs(credit);
    } else {
      const val = cleanNumber(col2);
      if (!isNaN(val)) amount = val;
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

  const parseCsvFile = async (selectedFile: File): Promise<ImportedRow[]> => {
    const text = await selectedFile.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length === 0) return [];

    const firstCols = parseCsvLine(lines[0]);
    const startIndex = looksLikeHeader(firstCols) ? 1 : 0;

    const results: ImportedRow[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const row = parseRow(cols);
      if (row) results.push(row);
    }
    return results;
  };

  const parseExcelFile = async (selectedFile: File): Promise<ImportedRow[]> => {
    const buffer = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      raw: true,
      defval: "",
    });

    if (!rows.length) return [];

    const firstRow = (rows[0] ?? []).map((cell) => String(cell ?? "").trim());
    const startIndex = looksLikeHeader(firstRow) ? 1 : 0;

    const results: ImportedRow[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const row = parseRow(rows[i] ?? []);
      if (row) results.push(row);
    }
    return results;
  };

  const handleUpload = async (selectedFile: File) => {
    try {
      const lowerName = selectedFile.name.toLowerCase();
      let results: ImportedRow[] = [];

      if (lowerName.endsWith(".csv")) {
        results = await parseCsvFile(selectedFile);
      } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        results = await parseExcelFile(selectedFile);
      } else {
        alert("Please choose a .csv, .xlsx, or .xls file.");
        return;
      }

      setFile(selectedFile);
      setDraftRows(results);
      setIsOpen(true);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Could not read this file. Please check the format and try again.");
    }
  };

  const updateRow = (id: string, patch: Partial<ImportedRow>) => {
    setDraftRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleType = (id: string) => {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const wasExpense = r.amount < 0;
        return {
          ...r,
          amount: r.amount * -1,
          category: wasExpense ? "Salary" : "Other",
        };
      })
    );
  };

  const deleteRow = (id: string) => {
    setDraftRows((prev) => prev.filter((r) => r.id !== id));
  };

  const confirmUpload = () => {
    onData(draftRows);
    setIsOpen(false);
    setDraftRows([]);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeModal = () => {
    setIsOpen(false);
    setDraftRows([]);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await handleUpload(selectedFile);
  };

  const modal = isOpen ? (
    <div className="csv-modal-backdrop csv-screen-backdrop" onClick={closeModal}>
      <div className="csv-modal csv-screen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="csv-modal-header csv-screen-header">
          <div className="csv-modal-title-wrap">
            <h3 className="csv-modal-title">Review Transactions</h3>
            <p className="csv-modal-subtitle">
              Check, edit, and confirm before importing
            </p>
          </div>

          <button className="csv-close" onClick={closeModal} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="csv-table-wrap csv-screen-table-wrap">
          <table className="csv-table csv-screen-table">
            <thead>
              <tr>
                <th>Remove</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Name</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {draftRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="csv-empty-cell">
                    No rows parsed. Check the columns: date, description, debit, credit, or amount.
                  </td>
                </tr>
              ) : (
                draftRows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Remove">
                      <button className="delete-minus" onClick={() => deleteRow(r.id)}>
                        ✕
                      </button>
                    </td>

                    <td data-label="Type">
                      <button
                        className={`type-pill ${r.amount >= 0 ? "income" : "expense"}`}
                        onClick={() => toggleType(r.id)}
                      >
                        {r.amount >= 0 ? "Income" : "Expense"}
                      </button>
                    </td>

                    <td data-label="Amount">
                      <input
                        className="csv-input csv-numberpad"
                        type="number"
                        step="0.01"
                        value={Math.abs(r.amount)}
                        onChange={(e) => {
                          const v = Number(e.target.value || 0);
                          updateRow(r.id, {
                            amount: r.amount >= 0 ? Math.abs(v) : -Math.abs(v),
                          });
                        }}
                      />
                    </td>
                    <td data-label="Category">
                      <select
                        className="csv-input csv-select"
                        value={r.category}
                        onChange={(e) => updateRow(r.id, { category: e.target.value })}
                      >
                        {(r.amount < 0 ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                   

                    <td data-label="Name">
                      <input
                        className="csv-input csv-name"
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      />
                    </td>

                    

                    
                     <td data-label="Date">
                      <input
                        className="csv-input csv-datepad"
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.id, { date: e.target.value })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table> 
        </div>

        <div className="csv-modal-actions csv-screen-actions">
          <button className="btn-secondary" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn-primary" onClick={confirmUpload}>
            Upload
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="csv-upload-wrapper">
        <label className="csv-import-btn">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            hidden
          />
          <span>Import File</span>
        </label>
      </div>

      {typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}