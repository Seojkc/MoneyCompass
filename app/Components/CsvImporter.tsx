'use client';

import React, { useState } from "react";
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

  const CATEGORY_MAP: Record<string, string[]> = {
    Travel: [
      "uber","lyft","taxi","cab","bolt","grab","ola","airbnb","expedia","booking",
      "trip","flight","air canada","westjet","porter","delta","united","emirates",
      "airways","train","via rail","amtrak","bus","greyhound","megabus","gas",
      "petro","shell","esso","chevron","circle k","parking","toll"
    ],

    Groceries: [
      "walmart","costco","superstore","loblaws","nofrills","freshco","metro",
      "sobeys","save on foods","whole foods","food basics","giant tiger",
      "asian market","indian store","farm boy","produce","mart","grocery"
    ],

    Food: [
      "mcdonald","burger","kfc","subway","pizza","domino","pizzahut","starbucks",
      "tim hortons","coffee","cafe","restaurant","bistro","bar","pub","diner",
      "shawarma","taco","chipotle","wendy","five guys","ubereats","doordash","skip"
    ],

    Shopping: [
      "amazon","ebay","best buy","apple","samsung","sony","ikea","home depot",
      "canadian tire","lowes","wayfair","etsy","winners","marshalls","hudsons bay",
      "sport chek","decathlon","gap","zara","h&m","uniqlo","adidas","nike"
    ],

    Utilities: [
      "internet","hydro","electric","water","gas bill","rogers","bell","telus",
      "fido","virgin","freedom","koodo","mobile","wifi","energy","power","utility"
    ],

    Rent: [
      "rent","landlord","property","lease","apartment","condo","housing",
      "mortgage","realtor","real estate","pmc","management"
    ],

    Transfer: [
      "transfer","etransfer","e-transfer","interac","payment","pay","deposit",
      "withdraw","atm","cash","wire","bank","cibc","rbc","td","scotia"
    ],

    Health: [
      "pharmacy","drug mart","shoppers","rexall","clinic","hospital","dentist",
      "medical","health","vision","optical","physio","massage","therapy"
    ],

    Subscriptions: [
      "netflix","spotify","apple music","google","youtube","prime","amazon prime",
      "icloud","dropbox","adobe","canva","notion","chatgpt","openai","microsoft",
      "office","365","zoom","slack"
    ],

    Insurance: [
      "insurance","policy","life","auto insurance","car insurance","home insurance",
      "premium","coverage","allstate","state farm","intact","desjardins","aviva"
    ],

    Education: [
      "school","college","university","course","udemy","coursera","edx","pluralsight",
      "training","bootcamp","class","lesson","exam","tuition","fees"
    ],

    Entertainment: [
      "movie","cinema","theatre","imax","concert","event","ticketmaster","show",
      "music","festival","game","steam","playstation","xbox","nintendo","arcade"
    ],

    Other: []
  };

  
  const makeId = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random();


  const cleanNumber = (v: string) => {
    if (!v) return NaN;
    return Number(v.replace(/[$,]/g, "").trim());
  };

  const detectCategory = (name: string) => {
    const n = name.toLowerCase();

    for (const category in CATEGORY_MAP) {
      for (const keyword of CATEGORY_MAP[category]) {
        if (n.includes(keyword)) {
          return category;
        }
      }
    }

    return "Other";
  };

  const parseDate = (v: string) => {
    // prevents timezone shift
    return new Date(v + "T00:00:00");
  };

  const handleUpload = async () => {
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);

    const results: ImportedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");

      if (cols.length < 4) continue;

      const dateRaw = cols[0].trim();
      const name = cols[1].trim();

      const debit = cleanNumber(cols[2]);
      const credit = cleanNumber(cols[3]);

      let amount = 0;

      if (!isNaN(debit) && debit !== 0) {
        amount = -debit; // expense
      } else if (!isNaN(credit) && credit !== 0) {
        amount = credit; // income
      } else {
        continue;
      }

      results.push({
        id: makeId(),
        date: dateRaw,
        name,
        category: detectCategory(name),
        amount,
      });
    }

    console.log("CSV OUTPUT:", results);
    onData(results);
  };

  return (
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

      {file && (
        <span className="csv-filename">
          {file.name}
        </span>
      )}
      
      <button
        onClick={handleUpload}
        disabled={!file}
        className="csv-upload-btn"
      >
        🚀 Import
      </button>
    </div>

  );
}
