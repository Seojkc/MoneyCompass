"use client";

import React, { useState } from "react";
import "../../CSS/Analytics.css";
import SummaryCards from "./SummaryCards";
import GraphsPanel from "./GraphsPanel";

interface AnalyticsProps {
  userId: string;
}

export type RangeKey = "3M" | "6M" | "1Y";

export const Analytics: React.FC<AnalyticsProps> = ({ userId }) => {
  const [range, setRange] = useState<RangeKey>("3M");

  return (
    <div className="analytics-container">
      <div className="analytics-header-row">
        <div>
          <h1 className="main-heading">Analytics</h1>
         
        </div>
      </div>

      <div className="analytics-layout">
        <aside className="analytics-summary-col">
          <SummaryCards userId={userId} range={range} onRangeChange={setRange} />
        </aside>

        <section className="analytics-graphs-col">
          <GraphsPanel userId={userId} range={range} />
        </section>
      </div>
    </div>
  );
};

export default Analytics;