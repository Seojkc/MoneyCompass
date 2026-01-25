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
            <option value="Investment">Investment</option>
            <option value="Other">Other</option>
            </>
        ) : (
            <>
            <option value="Rent">Rent</option>
            <option value="Food">Food</option>
            <option value="Utilities">Utilities</option>
            <option value="Travel">Travel</option>
            <option value="Other">Other</option>
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
