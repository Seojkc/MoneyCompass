'use client';

import "../CSS/FinanceCards.css";

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number; // always positive in your entries
  date: Date;
};

type Props = {
  selectedDate: Date;
  entries: Entry[];
};

export default function FinanceCards({ selectedDate, entries }: Props) {
  const { income, expense } = calcTotals(selectedDate, entries);
  const net = income - expense;

  return (
    <div className="cards-wrapper">
      <div className="card">
        <p>Total Income 📈</p>
        <h2 className="green">${income.toLocaleString()}</h2>
      </div>

      <div className="card">
        <p>Total Expense 📉</p>
        <h2 className="red">${expense.toLocaleString()}</h2>
      </div>

      <div className="card">
        <p>Net Cashflow 💰</p>
        <h2 className={net < 0 ? "red" : "green"}>
          ${net.toLocaleString()}
        </h2>
      </div>
    </div>
  );
}

function calcTotals(selectedDate: Date, entries: Entry[]) {
  const month = selectedDate.getMonth();
  const year = selectedDate.getFullYear();

  let income = 0;
  let expense = 0;

  for (const e of entries) {
    const d = e.date;
    if (d.getMonth() !== month || d.getFullYear() !== year) continue;

    if (e.type === "income") income += e.amount;
    else expense += e.amount;
  }

  return { income, expense };
}
