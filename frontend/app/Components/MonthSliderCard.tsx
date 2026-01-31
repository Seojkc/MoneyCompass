import { useState } from "react";
import "../CSS/MonthCard.css";

type Props = {
  onChange: (date: Date) => void;
};

export default function MonthCard({ onChange }: Props) {
  const [date, setDate] = useState<Date>(new Date());

  const changeMonth = (direction: -1 | 1) => {
    const newDate = new Date(date);
    newDate.setMonth(date.getMonth() + direction);

    setDate(newDate);     // update child
    onChange(newDate);   // update parent
  };

  const monthYear = date.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="month-wrapper">
      <button className="nav-btn" onClick={() => changeMonth(-1)}>◀</button>
      <div className="month-card">{monthYear}</div>
      <button className="nav-btn" onClick={() => changeMonth(1)}>▶</button>
    </div>
  );
}
