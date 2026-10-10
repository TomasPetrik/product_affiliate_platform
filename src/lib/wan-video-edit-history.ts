/** Browser-local history for Wan video edit (IndexedDB). */

export const WAN_VIDEO_EDIT_HISTORY_DB_NAME = "radarcut-wan-video-edit";
export const WAN_VIDEO_EDIT_HISTORY_STORE = "history";
export const WAN_VIDEO_EDIT_HISTORY_DB_VERSION = 1;
export const MAX_WAN_VIDEO_EDIT_HISTORY_ENTRIES = 30;

export interface WanVideoEditStoredBlob {
  name: string;
  type: string;
  blob: Blob;
}

export type WanVideoEditHistorySource = "standalone" | "video-frame";

export interface WanVideoEditHistoryEntry {
  id: string;
  createdAt: string;
  prompt: string;
  /** null = auto (match input duration). */
  duration: number | null;
  resolution: string;
  seed: string;
  generateAudio: boolean;
  enablePromptExpansion: boolean;
  /** Optional cut range for video-frame source. */
  cutStartSec?: number;
  cutEndSec?: number;
  sourceVideoName?: string;
  sourceVideo?: WanVideoEditStoredBlob | null;
  referenceImages: WanVideoEditStoredBlob[];
  referenceAudios: WanVideoEditStoredBlob[];
  predictionId: string;
  status: string;
  outputs: string[];
  inferenceMs?: number;
  error?: string;
  source?: WanVideoEditHistorySource;
  sourceLabel?: string;
  /** Set when a video-frame project clip is saved from this run. */
  projectId?: string;
  spanId?: string;
  savedClipFileName?: string;
}

export function createWanVideoEditHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wanvidedit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function fileToWanVideoEditStoredBlob(
  file: File,
): Promise<WanVideoEditStoredBlob> {
  return {
    name: file.name || "file",
    type: file.type || "application/octet-stream",
    blob: file.slice(0, file.size, file.type || undefined),
  };
}

export function wanVideoEditStoredBlobToFile(
  image: WanVideoEditStoredBlob,
): File {
  return new File([image.blob], image.name, {
    type: image.type || "application/octet-stream",
  });
}

export function sortWanVideoEditHistoryNewestFirst(
  entries: WanVideoEditHistoryEntry[],
): WanVideoEditHistoryEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function wanVideoEditHistoryIdsToTrim(
  newestFirst: WanVideoEditHistoryEntry[],
  max = MAX_WAN_VIDEO_EDIT_HISTORY_ENTRIES,
): string[] {
  if (newestFirst.length <= max) return [];
  return newestFirst.slice(max).map((entry) => entry.id);
}

export function formatWanVideoEditHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateWanVideoEditPrompt(prompt: string, max = 96): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      WAN_VIDEO_EDIT_HISTORY_DB_NAME,
      WAN_VIDEO_EDIT_HISTORY_DB_VERSION,
    );
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WAN_VIDEO_EDIT_HISTORY_STORE)) {
        db.createObjectStore(WAN_VIDEO_EDIT_HISTORY_STORE, { keyPath: "id" });
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

export async function listWanVideoEditHistory(): Promise<
  WanVideoEditHistoryEntry[]
> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const tx = db.transaction(WAN_VIDEO_EDIT_HISTORY_STORE, "readonly");
    const store = tx.objectStore(WAN_VIDEO_EDIT_HISTORY_STORE);
    const rows = await idbRequest(
      store.getAll() as IDBRequest<WanVideoEditHistoryEntry[]>,
    );
    return sortWanVideoEditHistoryNewestFirst(rows ?? []);
  } finally {
    db.close();
  }
}

export async function getWanVideoEditHistoryEntry(
  id: string,
): Promise<WanVideoEditHistoryEntry | null> {
  if (typeof indexedDB === "undefined" || !id) return null;
  const db = await openDb();
  try {
    const tx = db.transaction(WAN_VIDEO_EDIT_HISTORY_STORE, "readonly");
    const store = tx.objectStore(WAN_VIDEO_EDIT_HISTORY_STORE);
    const row = await idbRequest(
      store.get(id) as IDBRequest<WanVideoEditHistoryEntry | undefined>,
    );
    return row ?? null;
  } finally {
    db.close();
  }
}

/** Prefer exact saved filename; else best unused completed run for this project/span. */
export function findWanVideoEditHistoryForClip(input: {
  entries: WanVideoEditHistoryEntry[];
  fileName: string;
  projectId: string;
  spanId: string | null;
  claimedEntryIds?: Set<string>;
}): WanVideoEditHistoryEntry | null {
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

export async function saveWanVideoEditHistoryEntry(
  entry: WanVideoEditHistoryEntry,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WAN_VIDEO_EDIT_HISTORY_STORE, "readwrite");
      const store = tx.objectStore(WAN_VIDEO_EDIT_HISTORY_STORE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB save failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB save aborted"));

      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const existing = (getAllReq.result as WanVideoEditHistoryEntry[]) ?? [];
        const next = sortWanVideoEditHistoryNewestFirst([
          entry,
          ...existing.filter((item) => item.id !== entry.id),
        ]);
        store.put(entry);
        for (const id of wanVideoEditHistoryIdsToTrim(next)) {
          store.delete(id);
        }
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteWanVideoEditHistoryEntry(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WAN_VIDEO_EDIT_HISTORY_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB delete aborted"));
      tx.objectStore(WAN_VIDEO_EDIT_HISTORY_STORE).delete(id);
    });
  } finally {
    db.close();
  }
}
