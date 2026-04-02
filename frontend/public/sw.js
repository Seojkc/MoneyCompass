const DB_NAME = "moneycompass-offline";
const STORE = "quick-entry-queue";

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function put(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(value);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function del(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function flushQuickEntries() {
  const db = await openQueueDb();
  const jobs = await getAll(db);

  for (const item of jobs) {
    try {
      await put(db, { ...item, status: "sending" });

      const apiBase =
        item.apiBase || "http://localhost:8000";

      const res = await fetch(`${apiBase}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      await del(db, item.localId);
    } catch {
      await put(db, {
        ...item,
        status: "failed",
        retryCount: (item.retryCount || 0) + 1,
      });
    }
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-quick-entries") {
    event.waitUntil(flushQuickEntries());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "flush-quick-entries") {
    event.waitUntil(flushQuickEntries());
  }
});