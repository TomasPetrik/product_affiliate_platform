/** Time span with how many frames to sample (first + last always included when count ≥ 2). */
export interface FrameSpan {
  id: string;
  start: number;
  end: number;
  frameCount: number;
}

export interface ExtractedFrame {
  id: string;
  spanId: string;
  index: number;
  time: number;
  blob: Blob;
  url: string;
  filename: string;
  /** True when `url` is a server path (do not revoke as object URL). */
  persisted?: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/**
 * Build an uncompressed ZIP (JPGs are already compressed). No extra dependency.
 */
export function createZipBlob(files: { name: string; data: Uint8Array }[]): Blob {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 8, 0);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, file.data.length);
    writeU32(localView, 22, file.data.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    local.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 10, 0);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, file.data.length);
    writeU32(centralView, 24, file.data.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);

    parts.push(local, file.data);
    central.push(centralHeader);
    offset += local.length + file.data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 8, files.length);
  writeU16(endView, 10, files.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);

  return new Blob([...parts, ...central, end] as BlobPart[], { type: "application/zip" });
}

/** Evenly spaced timestamps; for count ≥ 2 includes span start and end. */
export function timestampsForSpan(start: number, end: number, count: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(count)) {
    return [];
  }
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) {
    return [];
  }
  const from = Math.max(0, start);
  const to = Math.max(from, end);
  if (safeCount === 1) {
    return [from];
  }
  const span = to - from;
  return Array.from({ length: safeCount }, (_, i) => from + (span * i) / (safeCount - 1));
}

export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00.0";
  }
  const whole = Math.floor(seconds);
  const tenths = Math.floor((seconds - whole) * 10);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
}

export function newSpanId(): string {
  return `span-${crypto.randomUUID()}`;
}

export function createDefaultSpans(duration: number): FrameSpan[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [];
  }
  return [
    {
      id: newSpanId(),
      start: 0,
      end: duration,
      frameCount: 4,
    },
  ];
}

export function totalFrameCount(spans: FrameSpan[]): number {
  return spans.reduce((sum, span) => sum + Math.max(0, Math.floor(span.frameCount)), 0);
}

export function clampSpan(span: FrameSpan, duration: number): FrameSpan {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const rawStart = Number.isFinite(span.start) ? span.start : 0;
  const rawEnd = Number.isFinite(span.end) ? span.end : rawStart;
  const start = Math.min(Math.max(0, rawStart), safeDuration);
  const end = Math.min(Math.max(start, rawEnd), safeDuration);
  return {
    ...span,
    start,
    end,
    frameCount: Math.max(1, Math.min(120, Math.floor(span.frameCount) || 1)),
  };
}

/** Round to slider step so preview cache keys stay stable while dragging. */
export function previewTimeKey(time: number, step = 0.1): string {
  if (!Number.isFinite(time)) {
    return "0.0";
  }
  const rounded = Math.round(time / step) * step;
  return rounded.toFixed(1);
}

export function uniquePreviewTimes(spans: FrameSpan[], step = 0.1): number[] {
  const seen = new Set<string>();
  const times: number[] = [];
  for (const span of spans) {
    for (const time of timestampsForSpan(span.start, span.end, span.frameCount)) {
      const key = previewTimeKey(time, step);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      times.push(Number(key));
    }
  }
  return times.sort((a, b) => a - b);
}
