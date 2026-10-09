/** Browser-local history for Wan image edit (IndexedDB). */

export const WAN_HISTORY_DB_NAME = "radarcut-wan-image-edit";
export const WAN_HISTORY_STORE = "history";
export const WAN_HISTORY_DB_VERSION = 1;
export const MAX_WAN_HISTORY_ENTRIES = 30;

export interface WanStoredImage {
  name: string;
  type: string;
  blob: Blob;
}

export interface WanHistoryEntry {
  id: string;
  createdAt: string;
  prompt: string;
  size: string;
  seed: string;
  mainImage: WanStoredImage;
  referenceImages: WanStoredImage[];
  predictionId: string;
  status: string;
  outputs: string[];
  inferenceMs?: number;
  error?: string;
}

export function createWanHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function fileToStoredImage(file: File): Promise<WanStoredImage> {
  return {
    name: file.name || "image",
    type: file.type || "application/octet-stream",
    blob: file.slice(0, file.size, file.type || undefined),
  };
}

export function storedImageToFile(image: WanStoredImage): File {
  return new File([image.blob], image.name, {
    type: image.type || "application/octet-stream",
  });
}

export function sortWanHistoryNewestFirst(
  entries: WanHistoryEntry[],
): WanHistoryEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns ids beyond `max` when sorted newest-first (oldest to drop). */
export function wanHistoryIdsToTrim(
  newestFirst: WanHistoryEntry[],
  max = MAX_WAN_HISTORY_ENTRIES,
): string[] {
  if (newestFirst.length <= max) return [];
  return newestFirst.slice(max).map((entry) => entry.id);
}

export function formatWanHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateWanPrompt(prompt: string, max = 96): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WAN_HISTORY_DB_NAME, WAN_HISTORY_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WAN_HISTORY_STORE)) {
        db.createObjectStore(WAN_HISTORY_STORE, { keyPath: "id" });
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function listWanHistory(): Promise<WanHistoryEntry[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const tx = db.transaction(WAN_HISTORY_STORE, "readonly");
    const store = tx.objectStore(WAN_HISTORY_STORE);
    const rows = await idbRequest(store.getAll() as IDBRequest<WanHistoryEntry[]>);
    return sortWanHistoryNewestFirst(rows ?? []);
  } finally {
    db.close();
  }
}

export async function saveWanHistoryEntry(entry: WanHistoryEntry): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    // Keep all store ops in one transaction (no await between requests).
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WAN_HISTORY_STORE, "readwrite");
      const store = tx.objectStore(WAN_HISTORY_STORE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB save failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB save aborted"));

      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const existing = (getAllReq.result as WanHistoryEntry[]) ?? [];
        const next = sortWanHistoryNewestFirst([
          entry,
          ...existing.filter((item) => item.id !== entry.id),
        ]);
        store.put(entry);
        for (const id of wanHistoryIdsToTrim(next)) {
          store.delete(id);
        }
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteWanHistoryEntry(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WAN_HISTORY_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB delete aborted"));
      tx.objectStore(WAN_HISTORY_STORE).delete(id);
    });
  } finally {
    db.close();
  }
}
