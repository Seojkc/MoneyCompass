'use client';
import { useState, useEffect } from "react";
import "../CSS/QuickAddEntry.css";

type Props = {
  type: "income" | "expense";
  lastUsedCategory: string;
  onAdd: (category: string, amount: number) => void;
};

export default function QuickAddEntry({ type, lastUsedCategory, onAdd }: Props) {
  const [category, setCategory] = useState<string>(lastUsedCategory);
  const [amount, setAmount] = useState<string>("");

  // Keep category updated if parent changes lastUsedCategory
  useEffect(() => {
    setCategory(lastUsedCategory);
  }, [lastUsedCategory]);

  const handleAdd = () => {
    const num = parseFloat(amount);
    if (!category || isNaN(num) || num <= 0) return;
    onAdd(category, num);
    setAmount(""); // reset input
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="quick-add-entry">
      <p className="entry-label">{type === "income" ? "Income 💵" : "Expense 💸"}</p>
      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="category-dropdown"
      >
        <option value={category}>{category}</option>
        {type === "income" ? (
          <>
            <option value="Salary">Salary</option>
            <option value="Bonus">Bonus</option>
            <option value="Business">Business Income</option>
            <option value="Freelance">Freelance</option>
            <option value="Commission">Commission</option>
            <option value="Interest">Interest</option>
            <option value="Dividends">Dividends</option>
            <option value="Investment">Investment Gains</option>
            <option value="Rental Income">Rental Income</option>
            <option value="Refund">Refund / Reimbursement</option>
            <option value="Gift">Gift Received</option>
            <option value="Transfer">Transfer In</option>
            <option value="Other">Other Income</option>
          </>
        ) : (
          <>
            <option value="Rent">Rent</option>
            <option value="Groceries">Groceries</option>
            <option value="Food">Food & Dining</option>
            <option value="Utilities">Utilities</option>
            <option value="Internet">Internet</option>
            <option value="Mobile">Mobile / Phone</option>
            <option value="Travel">Travel</option>
            <option value="Transport">Transport</option>
            <option value="Fuel">Fuel / Gas</option>
            <option value="Shopping">Shopping</option>
            <option value="Subscriptions">Subscriptions</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Health">Health / Medical</option>
            <option value="Insurance">Insurance</option>
            <option value="Education">Education</option>
            <option value="Personal Care">Personal Care</option>
            <option value="Transfer">Transfer Out</option>
            <option value="Fees">Bank Fees</option>
            <option value="Taxes">Taxes</option>
            <option value="Charity">Charity / Donations</option>
            <option value="Other">Other Expense</option>
          </>
        )}

      </select>

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        onKeyDown={handleKeyPress}
        className="amount-input"
      />

      <button onClick={handleAdd} className="add-btn">Add</button>
    </div>
  );
}
