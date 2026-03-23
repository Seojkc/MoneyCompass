"use client";

import "../CSS/FinanceCards.css";

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
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
    <div className="finance-cards-wrapper">
      <div className="finance-card finance-card-income">
        <div className="finance-card-top">
          <div className="finance-card-text">
            <p className="finance-card-label">Total Income</p>
          </div>
        </div>

        <h2 className="finance-card-value finance-green">
          ${income.toLocaleString()}
        </h2>
      </div>

      <div className="finance-card finance-card-expense">
        <div className="finance-card-top">
          <div className="finance-card-text">
            <p className="finance-card-label">Total Expense</p>
          </div>
        </div>

        <h2 className="finance-card-value finance-red">
          ${expense.toLocaleString()}
        </h2>
      </div>

      <div className="finance-card finance-card-net">
        <div className="finance-card-top">
          <div className="finance-card-text">
            <p className="finance-card-label">Net Cashflow</p>
          </div>
        </div>

        <h2
          className={`finance-card-value ${
            net < 0 ? "finance-red" : "finance-green"
          }`}
        >
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