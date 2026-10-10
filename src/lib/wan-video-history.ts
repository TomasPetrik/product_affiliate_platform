/** Browser-local history for Wan video reference (IndexedDB). */

export const WAN_VIDEO_HISTORY_DB_NAME = "radarcut-wan-video";
export const WAN_VIDEO_HISTORY_STORE = "history";
export const WAN_VIDEO_HISTORY_DB_VERSION = 1;
export const MAX_WAN_VIDEO_HISTORY_ENTRIES = 30;

export interface WanVideoStoredImage {
  name: string;
  type: string;
  blob: Blob;
}

export type WanVideoHistorySource = "standalone" | "video-frame";

export interface WanVideoHistoryEntry {
  id: string;
  createdAt: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  referenceImages: WanVideoStoredImage[];
  predictionId: string;
  status: string;
  outputs: string[];
  inferenceMs?: number;
  error?: string;
  source?: WanVideoHistorySource;
  sourceLabel?: string;
  /** Set when a video-frame project clip is saved from this run. */
  projectId?: string;
  spanId?: string;
  savedClipFileName?: string;
}

export function createWanVideoHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wanvid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function fileToWanVideoStoredImage(
  file: File,
): Promise<WanVideoStoredImage> {
  return {
    name: file.name || "image",
    type: file.type || "application/octet-stream",
    blob: file.slice(0, file.size, file.type || undefined),
  };
}

export function wanVideoStoredImageToFile(image: WanVideoStoredImage): File {
  return new File([image.blob], image.name, {
    type: image.type || "application/octet-stream",
  });
}

export function sortWanVideoHistoryNewestFirst(
  entries: WanVideoHistoryEntry[],
): WanVideoHistoryEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function wanVideoHistoryIdsToTrim(
  newestFirst: WanVideoHistoryEntry[],
  max = MAX_WAN_VIDEO_HISTORY_ENTRIES,
): string[] {
  if (newestFirst.length <= max) return [];
  return newestFirst.slice(max).map((entry) => entry.id);
}

export function formatWanVideoHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateWanVideoPrompt(prompt: string, max = 96): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      WAN_VIDEO_HISTORY_DB_NAME,
      WAN_VIDEO_HISTORY_DB_VERSION,
    );
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WAN_VIDEO_HISTORY_STORE)) {
        db.createObjectStore(WAN_VIDEO_HISTORY_STORE, { keyPath: "id" });
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function listWanVideoHistory(): Promise<WanVideoHistoryEntry[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const tx = db.transaction(WAN_VIDEO_HISTORY_STORE, "readonly");
    const store = tx.objectStore(WAN_VIDEO_HISTORY_STORE);
    const rows = await idbRequest(
      store.getAll() as IDBRequest<WanVideoHistoryEntry[]>,
    );
    return sortWanVideoHistoryNewestFirst(rows ?? []);
  } finally {
    db.close();
  }
}

export async function getWanVideoHistoryEntry(
  id: string,
): Promise<WanVideoHistoryEntry | null> {
  if (typeof indexedDB === "undefined" || !id) return null;
  const db = await openDb();
  try {
    const tx = db.transaction(WAN_VIDEO_HISTORY_STORE, "readonly");
    const store = tx.objectStore(WAN_VIDEO_HISTORY_STORE);
    const row = await idbRequest(
      store.get(id) as IDBRequest<WanVideoHistoryEntry | undefined>,
    );
    return row ?? null;
  } finally {
    db.close();
  }
}

/** Prefer exact saved filename; else best unused completed run for this project/span. */
export function findWanVideoHistoryForClip(input: {
  entries: WanVideoHistoryEntry[];
  fileName: string;
  projectId: string;
  spanId: string | null;
  claimedEntryIds?: Set<string>;
}): WanVideoHistoryEntry | null {
  const claimedIds = input.claimedEntryIds ?? new Set<string>();
  const exact = input.entries.find(
    (entry) =>
      entry.savedClipFileName === input.fileName && !claimedIds.has(entry.id),
  );
  if (exact) return exact;

  if (!input.spanId) return null;
  const spanKey = input.spanId.slice(0, 8);
  const candidates = input.entries.filter((entry) => {
    if (claimedIds.has(entry.id)) return false;
    if (entry.status !== "completed") return false;
    if (entry.source && entry.source !== "video-frame") return false;
    if (entry.savedClipFileName && entry.savedClipFileName !== input.fileName) {
      return false;
    }
    if (entry.projectId && entry.projectId !== input.projectId) return false;
    if (entry.spanId) return entry.spanId === input.spanId;
    return input.fileName.includes(spanKey);
  });
  return candidates[0] ?? null;
}

export async function saveWanVideoHistoryEntry(
  entry: WanVideoHistoryEntry,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WAN_VIDEO_HISTORY_STORE, "readwrite");
      const store = tx.objectStore(WAN_VIDEO_HISTORY_STORE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB save failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB save aborted"));

      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const existing = (getAllReq.result as WanVideoHistoryEntry[]) ?? [];
        const next = sortWanVideoHistoryNewestFirst([
          entry,
          ...existing.filter((item) => item.id !== entry.id),
        ]);
        store.put(entry);
        for (const id of wanVideoHistoryIdsToTrim(next)) {
          store.delete(id);
        }
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteWanVideoHistoryEntry(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WAN_VIDEO_HISTORY_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB delete aborted"));
      tx.objectStore(WAN_VIDEO_HISTORY_STORE).delete(id);
    });
  } finally {
    db.close();
  }
}
