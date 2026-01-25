import "../CSS/FinanceCards.css"

type Props = {
  selectedDate: Date;
};

export default function FinanceCards({ selectedDate }: Props) {

  const income = getIncome(selectedDate);
  const expense = getExpense(selectedDate);

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

// --- example logic (replace with API later)
function getIncome(date: Date) {
  return 3000 + date.getMonth() * 120;
}

function getExpense(date: Date) {
  return 2200 + date.getMonth() * 140;
}
