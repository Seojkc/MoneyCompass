const API_URL = process.env.NEXT_PUBLIC_API_URL!;

console.log("API_URL =", API_URL); 

export type UiEntry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  date: Date;
};

type ApiEntry = {
  id: string;
  date: string; 
  year: number;
  month: number;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  currency?: string | "CAD";
  notes?: string | null;
};


type ApiEntryCreate = {
  date: string; // "YYYY-MM-DD"
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  currency?: string;
  notes?: string | null;
};

type ApiEntryUpdate = Partial<ApiEntryCreate>;


function dateToYmd(d: Date): string {
  // avoids timezone shifting
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ymdToDate(ymd: string): Date {
  // force local date (no TZ surprises)
  return new Date(`${ymd}T00:00:00`);
}

function apiToUi(e: ApiEntry): UiEntry {
  return {
    id: e.id,
    type: e.type,
    name: e.name,
    category: e.category,
    amount: Number(e.amount),
    date: ymdToDate(e.date),
  };
}


async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const method = (options.method ?? "GET").toUpperCase();

  const headers = new Headers(options.headers);

  // Only set Content-Type when you're actually sending a JSON body
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      ...options,
      method,
      headers,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    // handle empty response
    return (text ? JSON.parse(text) : null) as T;
  } catch (err) {
    console.error("Fetch failed", { url, err });
    throw err;
  }
}


export async function listEntries(): Promise<UiEntry[]> {
  const data = await request<ApiEntry[]>("/entries");
  return data.map(apiToUi);
}

export async function createEntryFromUi(input: Omit<UiEntry, "id">): Promise<UiEntry> {
  const payload: ApiEntryCreate = {
    date: dateToYmd(input.date),
    type: input.type,
    name: input.name,
    category: input.category,
    amount: input.amount,
    currency: "CAD",
    notes: null,
  };
  const created = await request<ApiEntry>("/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return apiToUi(created);
}

export async function patchEntryFromUi(id: string, patch: Partial<Omit<UiEntry, "id">>): Promise<UiEntry> {
  const payload: ApiEntryUpdate = {
    ...(patch.date ? { date: dateToYmd(patch.date) } : {}),
    ...(patch.type ? { type: patch.type } : {}),
    ...(patch.name ? { name: patch.name } : {}),
    ...(patch.category ? { category: patch.category } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
  };

  const updated = await request<ApiEntry>(`/entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return apiToUi(updated);
}


export async function putEntryFromUi(id: string, entry: Omit<UiEntry, "id">): Promise<UiEntry> {
  const payload: ApiEntryCreate = {
    date: dateToYmd(entry.date),
    type: entry.type,
    name: entry.name,
    category: entry.category,
    amount: entry.amount,
    currency: "CAD",
    notes: null,
  };

  const updated = await request<ApiEntry>(`/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return apiToUi(updated);
}

export async function deleteEntryApi(id: string) {
  return request<{ deleted: boolean; id: string }>(`/entries/${id}`, { method: "DELETE" });
}