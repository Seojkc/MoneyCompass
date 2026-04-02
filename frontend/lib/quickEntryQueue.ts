import { openDB } from "idb";

type QuickEntryType = "income" | "expense";

export type PendingQuickEntry = {
  localId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: QuickEntryType;
  name: string;
  category: string;
  amount: number;
  createdAt: number;
  status: "pending" | "sending" | "failed";
  retryCount: number;
};

type ApiEntry = {
  id: string;
  date: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
};

const DB_NAME = "moneycompass-offline";
const STORE = "quick-entry-queue";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

function apiToUi(e: ApiEntry) {
  return {
    id: e.id,
    type: e.type,
    name: e.name,
    category: e.category,
    amount: Number(e.amount),
    date: ymdToDate(e.date),
  };
}

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    },
  });
}

export async function enqueueQuickEntry(entry: PendingQuickEntry) {
  const db = await getDb();
  await db.put(STORE, entry);
}

export async function listPendingQuickEntries(userId?: string) {
  const db = await getDb();
  const all = await db.getAll(STORE);
  return userId ? all.filter((x) => x.userId === userId) : all;
}

export async function deletePendingQuickEntry(localId: string) {
  const db = await getDb();
  await db.delete(STORE, localId);
}

export async function updatePendingQuickEntry(entry: PendingQuickEntry) {
  const db = await getDb();
  await db.put(STORE, entry);
}

export async function flushPendingQuickEntries(opts?: {
  onlyLocalIds?: string[];
}) {
  const db = await getDb();
  let queued = await db.getAll(STORE);

  if (opts?.onlyLocalIds?.length) {
    const wanted = new Set(opts.onlyLocalIds);
    queued = queued.filter((q) => wanted.has(q.localId));
  }

  const synced: Array<{
    localId: string;
    created: {
      id: string;
      type: "income" | "expense";
      name: string;
      category: string;
      amount: number;
      date: Date;
    };
  }> = [];

  for (const item of queued) {
    try {
      await db.put(STORE, { ...item, status: "sending" as const });

      const res = await fetch(`${API_BASE}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: item.userId,
          date: item.date,
          type: item.type,
          name: item.name,
          category: item.category,
          amount: item.amount,
          currency: "CAD",
          notes: null,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const created = (await res.json()) as ApiEntry;
      await db.delete(STORE, item.localId);

      synced.push({
        localId: item.localId,
        created: apiToUi(created),
      });
    } catch {
      await db.put(STORE, {
        ...item,
        status: "failed" as const,
        retryCount: item.retryCount + 1,
      });
    }
  }

  return synced;
}

export async function registerQuickEntrySync() {
  if (typeof window === "undefined") return;

  if (!("serviceWorker" in navigator)) return;

  const reg = await navigator.serviceWorker.ready;

  if ("sync" in reg) {
    try {
      // @ts-expect-error browser support varies
      await reg.sync.register("sync-quick-entries");
    } catch {
      // ignore; fallback is flush on next app open/online
    }
  }
}

export async function registerQuickEntryServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.error("Service worker registration failed", err);
  }
}