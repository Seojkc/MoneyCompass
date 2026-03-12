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
  value_text?: string | null; 

};

export type UpsertMetric = {
  user_id: string;
  step_key: string;
  metric_key: string;
  value_num: number;
  value_text?: string | null;

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

export type UiUserRoadmapStep = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  step_order: number;
  progress: number;
  progress_updated_at?: string | null;
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


export type UiUserDebt = {
  id: string;
  user_id: string;
  step_key: string;
  name: string;
  interest_pct: number;
  balance: number;
  total_payment: number;
};


export type UiUserSavingGoal = {
  id: string;
  user_id: string;
  step_key: string;
  name: string;
  saved: number;
  target: number;
  monthly: number;
};

type ApiUserSavingGoal = {
  id: string;
  user_id: string;
  step_key: string;
  name: string;
  saved: number;
  target: number;
  monthly: number;
};



export type UiUserInvestment = {
  id: string;
  user_id: string;
  step_key: string;
  account_type: string;
  name: string;
  kind: string;
  risk?: string | null;
  monthly_amount: number;
  current_invested: number;
  average_return: number;
  website?: string | null;
  preset_id?: string | null;
  is_custom?: boolean | null;
};




type ApiEntryCreate = {
  user_id: string; // ✅ ADD
  date: string;
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
    user_id: "demo-user-1", // ✅ for now
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
  return await request<UiUserStepMetric[]>(`/user-step-metrics/bulk`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export const FULL_FUND_DEFAULT_METRICS: UpsertMetric[] = [
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "rent", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "utilities", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "groceries", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "transportation", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "phone_internet", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "insurance", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "minimum_debt_payments", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "essential_medical_costs", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "child_essentials", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "other_expenses", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "selected_months", value_num: 3 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "current_saved", value_num: 0 },
  { user_id: "demo-user-1", step_key: "full-fund", metric_key: "save_per_month", value_num: 0 },
];

export async function ensureUserStepMetrics(params: {
  userId: string;
  stepKey: string;
  defaults: Array<{ metric_key: string; value_num: number; value_text?: string | null }>;
}): Promise<UiUserStepMetric[]> {
  const existing = await listUserStepMetrics({
    userId: params.userId,
    stepKey: params.stepKey,
  });

  const existingKeys = new Set(existing.map((m) => m.metric_key));

  const missingPayload: UpsertMetric[] = params.defaults
    .filter((d) => !existingKeys.has(d.metric_key))
    .map((d) => ({
      user_id: params.userId,
      step_key: params.stepKey,
      metric_key: d.metric_key,
      value_num: d.value_num,
      value_text: d.value_text ?? null,
    }));

  if (missingPayload.length > 0) {
    await bulkUpsertUserStepMetrics(missingPayload);
    return await listUserStepMetrics({
      userId: params.userId,
      stepKey: params.stepKey,
    });
  }

  return existing;
}

export type SummaryResponse = {
  months_requested: number;
  months_used: number;
  avg_income_per_month: number;
  avg_expense_per_month: number;
  savings_rate: number;
  anchor?: { year: number; month: number };
};

export async function getSummary(params: { months: 3 | 6 | 12 }) {
  const qs = new URLSearchParams();
  qs.set("months", String(params.months));
  return await request<SummaryResponse>(`/analytics/summary?${qs.toString()}`);
}

export async function listUserRoadmapSteps(
  userId: string,
  activeOnly = true
): Promise<UiUserRoadmapStep[]> {
  const qs = new URLSearchParams();
  qs.set("user_id", userId);
  qs.set("active_only", String(activeOnly));
  return request<UiUserRoadmapStep[]>(`/user-roadmap?${qs.toString()}`);
}




export async function listUserDebts(params: { userId: string; stepKey: string }) {
  const qs = new URLSearchParams({ user_id: params.userId, step_key: params.stepKey });
  return await request<UiUserDebt[]>(`/user-debts?${qs.toString()}`);
}

export async function createUserDebt(payload: Omit<UiUserDebt, "id">) {
  return await request<UiUserDebt>(`/user-debts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchUserDebt(
  id: string,
  patch: Partial<Pick<UiUserDebt, "name" | "interest_pct" | "balance" | "total_payment">>
) {
  return await request<UiUserDebt>(`/user-debts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteUserDebt(id: string) {
  return await request<{ deleted: boolean; id: string }>(`/user-debts/${id}`, {
    method: "DELETE",
  });
}

type ListUserEntriesParams = {
  userId: string;
  year?: number;
  month?: number;
  type?: "income" | "expense";
  limit?: number;
};

export async function listEntriesByUser(params: ListUserEntriesParams): Promise<UiEntry[]> {
  const qs = new URLSearchParams();

  qs.set("user_id", params.userId);
  if (params.year != null) qs.set("year", String(params.year));
  if (params.month != null) qs.set("month", String(params.month));
  if (params.type) qs.set("type", params.type);
  if (params.limit != null) qs.set("limit", String(params.limit));

  const data = await request<ApiEntry[]>(`/entries/by-user?${qs.toString()}`);
  return data.map(apiToUi);
}

export type FullFundSeed = {
  rent: number;
  utilities: number;
  groceries: number;
  transportation: number;
  phone_internet: number;
  insurance: number;
  minimum_debt_payments: number;
  essential_medical_costs: number;
  child_essentials: number;
  other_expenses: number;
  selected_months: 3 | 6;
  current_saved: number;
  save_per_month: number;
};

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function deriveFullFundSeedFromEntries(userId: string): Promise<FullFundSeed> {
  const entries = await listEntriesByUser({
    userId,
    type: "expense",
    limit: 500,
  });

  const latestMonthKeys = Array.from(
    new Set(entries.map((e) => monthKey(e.date)).sort((a, b) => (a < b ? 1 : -1)))
  ).slice(0, 3);

  const recentExpenses = entries.filter((e) => latestMonthKeys.includes(monthKey(e.date)));

  const bucketMonthTotals: Record<string, Record<string, number>> = {
    rent: {},
    utilities: {},
    groceries: {},
    transportation: {},
    phone_internet: {},
    insurance: {},
    minimum_debt_payments: {},
    essential_medical_costs: {},
    child_essentials: {},
    other_expenses: {},
  };

  function addToBucket(bucket: keyof typeof bucketMonthTotals, entry: UiEntry) {
    const mk = monthKey(entry.date);
    bucketMonthTotals[bucket][mk] =
      (bucketMonthTotals[bucket][mk] ?? 0) + Number(entry.amount || 0);
  }

  for (const entry of recentExpenses) {
    const cat = normalizeCategory(entry.category);

    if (cat === "rent") {
      addToBucket("rent", entry);
    } else if (cat === "utilities") {
      addToBucket("utilities", entry);
    } else if (cat === "groceries" || cat === "food") {
      addToBucket("groceries", entry);
    } else if (cat === "travel" || cat === "transportation") {
      addToBucket("transportation", entry);
    } else if (
      cat === "phone" ||
      cat === "internet" ||
      cat === "phone / internet" ||
      cat === "phone/internet"
    ) {
      addToBucket("phone_internet", entry);
    } else if (cat === "insurance") {
      addToBucket("insurance", entry);
    } else if (
      cat === "debt" ||
      cat === "loan" ||
      cat === "credit card" ||
      cat === "minimum debt payments"
    ) {
      addToBucket("minimum_debt_payments", entry);
    } else if (
      cat === "medical" ||
      cat === "health" ||
      cat === "pharmacy" ||
      cat === "essential medical costs"
    ) {
      addToBucket("essential_medical_costs", entry);
    } else if (
      cat === "child" ||
      cat === "kids" ||
      cat === "baby" ||
      cat === "child essentials"
    ) {
      addToBucket("child_essentials", entry);
    } else if (cat === "other") {
      addToBucket("other_expenses", entry);
    }
  }

  function averageFromMonths(monthTotals: Record<string, number>): number {
    const vals = Object.values(monthTotals).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return roundMoney(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  return {
    rent: averageFromMonths(bucketMonthTotals.rent),
    utilities: averageFromMonths(bucketMonthTotals.utilities),
    groceries: averageFromMonths(bucketMonthTotals.groceries),
    transportation: averageFromMonths(bucketMonthTotals.transportation),
    phone_internet: averageFromMonths(bucketMonthTotals.phone_internet),
    insurance: averageFromMonths(bucketMonthTotals.insurance),
    minimum_debt_payments: averageFromMonths(bucketMonthTotals.minimum_debt_payments),
    essential_medical_costs: averageFromMonths(bucketMonthTotals.essential_medical_costs),
    child_essentials: averageFromMonths(bucketMonthTotals.child_essentials),
    other_expenses: averageFromMonths(bucketMonthTotals.other_expenses),
    selected_months: 3,
    current_saved: 0,
    save_per_month: 0,
  };
}

export async function ensureFullFundMetricsSeeded(params: {
  userId: string;
  stepKey?: string;
}): Promise<UiUserStepMetric[]> {
  const stepKey = params.stepKey ?? "full-fund";

  const existing = await listUserStepMetrics({
    userId: params.userId,
    stepKey,
  });

  const existingKeys = new Set(existing.map((m) => m.metric_key));

  const requiredKeys = [
    "rent",
    "utilities",
    "groceries",
    "transportation",
    "phone_internet",
    "insurance",
    "minimum_debt_payments",
    "essential_medical_costs",
    "child_essentials",
    "other_expenses",
    "selected_months",
    "current_saved",
    "save_per_month",
  ];

  if (existing.length === 0) {
    const seed = await deriveFullFundSeedFromEntries(params.userId);

    const payload: UpsertMetric[] = [
      { user_id: params.userId, step_key: stepKey, metric_key: "rent", value_num: seed.rent },
      { user_id: params.userId, step_key: stepKey, metric_key: "utilities", value_num: seed.utilities },
      { user_id: params.userId, step_key: stepKey, metric_key: "groceries", value_num: seed.groceries },
      { user_id: params.userId, step_key: stepKey, metric_key: "transportation", value_num: seed.transportation },
      { user_id: params.userId, step_key: stepKey, metric_key: "phone_internet", value_num: seed.phone_internet },
      { user_id: params.userId, step_key: stepKey, metric_key: "insurance", value_num: seed.insurance },
      { user_id: params.userId, step_key: stepKey, metric_key: "minimum_debt_payments", value_num: seed.minimum_debt_payments },
      { user_id: params.userId, step_key: stepKey, metric_key: "essential_medical_costs", value_num: seed.essential_medical_costs },
      { user_id: params.userId, step_key: stepKey, metric_key: "child_essentials", value_num: seed.child_essentials },
      { user_id: params.userId, step_key: stepKey, metric_key: "other_expenses", value_num: seed.other_expenses },
      { user_id: params.userId, step_key: stepKey, metric_key: "selected_months", value_num: seed.selected_months },
      { user_id: params.userId, step_key: stepKey, metric_key: "current_saved", value_num: seed.current_saved },
      { user_id: params.userId, step_key: stepKey, metric_key: "save_per_month", value_num: seed.save_per_month },
    ];

    await bulkUpsertUserStepMetrics(payload);

    return await listUserStepMetrics({
      userId: params.userId,
      stepKey,
    });
  }

  const missingPayload: UpsertMetric[] = requiredKeys
    .filter((k) => !existingKeys.has(k))
    .map((k) => ({
      user_id: params.userId,
      step_key: stepKey,
      metric_key: k,
      value_num: k === "selected_months" ? 3 : 0,
    }));

  if (missingPayload.length > 0) {
    await bulkUpsertUserStepMetrics(missingPayload);

    return await listUserStepMetrics({
      userId: params.userId,
      stepKey,
    });
  }

  return existing;
}


export async function listUserSavingGoals(params: {
  userId: string;
  stepKey?: string;
}) {
  const qs = new URLSearchParams({
    user_id: params.userId,
    step_key: params.stepKey ?? "automate",
  });

  return await request<UiUserSavingGoal[]>(`/user-saving-goals?${qs.toString()}`);
}

export async function createUserSavingGoal(payload: {
  user_id: string;
  step_key?: string;
  name: string;
  saved: number;
  target: number;
  monthly: number;
}) {
  return await request<UiUserSavingGoal>(`/user-saving-goals`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      step_key: payload.step_key ?? "automate",
    }),
  });
}

export async function patchUserSavingGoal(
  id: string,
  patch: Partial<Pick<UiUserSavingGoal, "saved" | "target" | "monthly">>
) {
  return await request<UiUserSavingGoal>(`/user-saving-goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteUserSavingGoal(id: string) {
  return await request<{ deleted: boolean; id: string }>(`/user-saving-goals/${id}`, {
    method: "DELETE",
  });
}


export async function listUserInvestments(params: { userId: string; stepKey?: string }) {
  const qs = new URLSearchParams({
    user_id: params.userId,
    step_key: params.stepKey ?? "invest",
  });

  return await request<UiUserInvestment[]>(`/user-investments?${qs.toString()}`);
}

export async function createUserInvestment(
  payload: Omit<UiUserInvestment, "id">
) {
  return await request<UiUserInvestment>(`/user-investments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchUserInvestment(
  id: string,
  patch: Partial<
    Pick<
      UiUserInvestment,
      | "account_type"
      | "name"
      | "kind"
      | "risk"
      | "monthly_amount"
      | "current_invested"
      | "average_return"
      | "website"
      | "preset_id"
      | "is_custom"
    >
  >
) {
  return await request<UiUserInvestment>(`/user-investments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteUserInvestment(id: string) {
  return await request<{ deleted: boolean; id: string }>(`/user-investments/${id}`, {
    method: "DELETE",
  });
}