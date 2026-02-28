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

export type UiUserStepMetric = {
  id: string;
  user_id: string;
  step_key: string;
  metric_key: string;
  value_num: number;
};

export type UpsertMetric = {
  user_id: string;
  step_key: string;
  metric_key: string;
  value_num: number;
};

export type UiUserStepProgress = {
  id: string;
  user_id: string;
  step_key: string;
  progress: number; // 0-100
};


export type UiRoadmapStep = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  description?: string | null;
  step_order: number;
  is_active: boolean;
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


type ListEntriesParams = {
  year?: number;
  month?: number; // 1-12
  type?: "income" | "expense";
  limit?: number; // optional, backend default 100
};


export async function listEntries(params?: ListEntriesParams): Promise<UiEntry[]> {
  const qs = new URLSearchParams();

  if (params?.year != null) qs.set("year", String(params.year));
  if (params?.month != null) qs.set("month", String(params.month));
  if (params?.type) qs.set("type", params.type);
  if (params?.limit != null) qs.set("limit", String(params.limit));

  const url = `/entries${qs.toString() ? `?${qs.toString()}` : ""}`;

  const data = await request<ApiEntry[]>(url);
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


export async function listRoadmapSteps(activeOnly = true): Promise<UiRoadmapStep[]> {
  const qs = new URLSearchParams();
  qs.set("active_only", String(activeOnly));
  const data = await request<UiRoadmapStep[]>(`/roadmap-steps?${qs.toString()}`);
  return data;
}


export async function listUserStepsProgress(userId: string): Promise<UiUserStepProgress[]> {
  const qs = new URLSearchParams({ user_id: userId });
  const data = await request<UiUserStepProgress[]>(`/user-steps-progress?${qs.toString()}`);
  return data;
}

export async function upsertUserStepProgress(input: {
  user_id: string;
  step_key: string;
  progress: number; // 0-100
}): Promise<UiUserStepProgress> {
  const data = await request<UiUserStepProgress>("/user-steps-progress", {
    method: "PUT",
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
  });
  return data;
}

export async function listUserStepMetrics(params: {
  userId: string;
  stepKey?: string;
}): Promise<UiUserStepMetric[]> {
  const qs = new URLSearchParams();
  qs.set("user_id", params.userId);
  if (params.stepKey) qs.set("step_key", params.stepKey);

  const data = await request<UiUserStepMetric[]>(`/user-step-metrics?${qs.toString()}`);
  return data;
}

export async function bulkUpsertUserStepMetrics(payload: UpsertMetric[]) {
  const res = await fetch(`/api/user-step-metrics/bulk`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to save metrics");
  }

  return (await res.json()) as UiUserStepMetric[];
}