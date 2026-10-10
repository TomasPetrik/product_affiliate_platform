"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { MoveHorizontal, Scissors, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

const TRACK_HEIGHT = 72;
const AUDIO_TRACK_HEIGHT = 44;
const HANDLE_WIDTH = 14;
const MIN_TRIM_SEC = 0.08;
const SEGMENT_GAP = 4;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const LONG_PRESS_MS = 320;
const LONG_PRESS_MOVE_CANCEL_PX = 16;

function formatTimelineTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00.00";
  const totalMs = Math.round(sec * 100);
  const centis = totalMs % 100;
  const totalSec = Math.floor(totalMs / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (!Number.isFinite(time)) return;
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Seek failed."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.max(0, time);
  });
}

function useFilmstrip(
  videoUrl: string,
  durationSec: number,
  trimStartSec: number,
  trimEndSec: number,
  frameCount: number,
) {
  const [frames, setFrames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const span = Math.max(0.05, trimEndSec - trimStartSec);
    if (!videoUrl || !(durationSec > 0) || frameCount < 1) {
      setFrames([]);
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = videoUrl;

    const canvas = document.createElement("canvas");
    canvas.width = 81;
    canvas.height = 144;
    const ctx = canvas.getContext("2d");

    setLoading(true);
    void (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("Could not load video."));
        });
        if (!ctx || cancelled) return;

        const thumbs: string[] = [];
        for (let i = 0; i < frameCount; i += 1) {
          if (cancelled) return;
          const t = Math.min(
            trimEndSec - 0.01,
            trimStartSec + (span * (i + 0.5)) / frameCount,
          );
          await seekVideo(video, Math.max(0, t));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL("image/jpeg", 0.72));
        }
        if (!cancelled) setFrames(thumbs);
      } catch {
        if (!cancelled) setFrames([]);
      } finally {
        if (!cancelled) setLoading(false);
        video.removeAttribute("src");
        video.load();
      }
    })();

    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [videoUrl, durationSec, trimStartSec, trimEndSec, frameCount]);

  return { frames, loading };
}

export interface MergeTimelineSegmentView {
  instanceId: string;
  videoUrl: string;
  label: string;
  /** Source / export quality caption (e.g. "1080p" or "720p → 1080p"). */
  qualityLabel?: string | null;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  /** Clip audio silenced for this segment. */
  muted?: boolean;
}

function keptDuration(segment: MergeTimelineSegmentView): number {
  return Math.max(MIN_TRIM_SEC, segment.trimEndSec - segment.trimStartSec);
}

function segmentWidthPx(
  segment: MergeTimelineSegmentView,
  pixelsPerSecond: number,
): number {
  return Math.max(72, keptDuration(segment) * pixelsPerSecond);
}

/** Map composition time (kept timeline) → segment + source time. */
export function compositionToSource(
  segments: MergeTimelineSegmentView[],
  compositionSec: number,
): { instanceId: string; sourceSec: number; index: number } | null {
  if (segments.length === 0) return null;
  let remaining = Math.max(0, compositionSec);
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    const kept = keptDuration(segment);
    if (remaining <= kept || i === segments.length - 1) {
      const sourceSec = Math.min(
        segment.trimEndSec,
        Math.max(segment.trimStartSec, segment.trimStartSec + remaining),
      );
      return { instanceId: segment.instanceId, sourceSec, index: i };
    }
    remaining -= kept;
  }
  const last = segments[segments.length - 1]!;
  return {
    instanceId: last.instanceId,
    sourceSec: last.trimEndSec,
    index: segments.length - 1,
  };
}

/** Map segment source time → composition time. */
export function sourceToComposition(
  segments: MergeTimelineSegmentView[],
  instanceId: string,
  sourceSec: number,
): number {
  let offset = 0;
  for (const segment of segments) {
    if (segment.instanceId === instanceId) {
      const clamped = Math.min(
        segment.trimEndSec,
        Math.max(segment.trimStartSec, sourceSec),
      );
      return offset + (clamped - segment.trimStartSec);
    }
    offset += keptDuration(segment);
  }
  return offset;
}

type TimelineLayoutItem = {
  segment: MergeTimelineSegmentView;
  left: number;
  width: number;
};

function videoKeptSecFromLayout(layout: TimelineLayoutItem[]): number {
  return layout.reduce((sum, item) => sum + keptDuration(item.segment), 0);
}

function videoEndPxFromLayout(layout: TimelineLayoutItem[]): number {
  if (layout.length === 0) return 0;
  const last = layout[layout.length - 1]!;
  return last.left + last.width;
}

/**
 * Map composition seconds → x position on the laid-out track.
 * Accounts for segment gaps and minimum clip widths (unlike sec * pps).
 * Past the last clip, extends linearly (black-pad / audio overrun region).
 */
function compositionToLayoutPx(
  layout: TimelineLayoutItem[],
  compositionSec: number,
  pixelsPerSecond: number,
): number {
  if (layout.length === 0) {
    return Math.max(0, compositionSec) * pixelsPerSecond;
  }
  const videoKept = videoKeptSecFromLayout(layout);
  const videoEndPx = videoEndPxFromLayout(layout);
  if (compositionSec > videoKept + 1e-6) {
    return videoEndPx + (compositionSec - videoKept) * pixelsPerSecond;
  }
  let remaining = Math.max(0, compositionSec);
  for (let i = 0; i < layout.length; i += 1) {
    const item = layout[i]!;
    const kept = keptDuration(item.segment);
    const isLast = i === layout.length - 1;
    if (remaining <= kept + 1e-6 || isLast) {
      const local = Math.min(kept, Math.max(0, remaining));
      const ratio = kept > 0 ? local / kept : 0;
      return item.left + ratio * item.width;
    }
    remaining -= kept;
  }
  return videoEndPx;
}

/** Map track x position → segment + source time (gaps resolve to the nearer clip). */
function layoutPxToSource(
  layout: TimelineLayoutItem[],
  x: number,
  pixelsPerSecond: number,
): {
  instanceId: string;
  sourceSec: number;
  index: number;
  compositionSec: number;
} | null {
  if (layout.length === 0) return null;
  const clampedX = Math.max(0, x);
  const videoKept = videoKeptSecFromLayout(layout);
  const videoEndPx = videoEndPxFromLayout(layout);
  const last = layout[layout.length - 1]!;

  if (clampedX > videoEndPx + 0.5) {
    const compositionSec =
      videoKept + (clampedX - videoEndPx) / Math.max(1, pixelsPerSecond);
    return {
      instanceId: last.segment.instanceId,
      sourceSec: last.segment.trimEndSec,
      index: layout.length - 1,
      compositionSec: Number(compositionSec.toFixed(3)),
    };
  }

  for (let i = 0; i < layout.length; i += 1) {
    const item = layout[i]!;
    const end =
      i < layout.length - 1
        ? layout[i + 1]!.left
        : item.left + item.width;
    if (clampedX < end || i === layout.length - 1) {
      const rel = Math.min(item.width, Math.max(0, clampedX - item.left));
      const ratio = item.width > 0 ? rel / item.width : 0;
      const sourceSec =
        item.segment.trimStartSec + ratio * keptDuration(item.segment);
      const compositionSec = sourceToComposition(
        layout.map((row) => row.segment),
        item.segment.instanceId,
        sourceSec,
      );
      return {
        instanceId: item.segment.instanceId,
        sourceSec: Number(sourceSec.toFixed(3)),
        index: i,
        compositionSec: Number(compositionSec.toFixed(3)),
      };
    }
  }
  return {
    instanceId: last.segment.instanceId,
    sourceSec: last.segment.trimEndSec,
    index: layout.length - 1,
    compositionSec: videoKept,
  };
}

function layoutPxToComposition(
  layout: TimelineLayoutItem[],
  x: number,
  pixelsPerSecond: number,
): number {
  const mapped = layoutPxToSource(layout, x, pixelsPerSecond);
  return mapped?.compositionSec ?? 0;
}

export interface MergeTimelineAudioTrackView {
  instanceId: string;
  label: string;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  /** Composition time where the trimmed audio begins. */
  startAtSec: number;
}

export interface VideoFrameMergeTimelineProps {
  segments: MergeTimelineSegmentView[];
  /** Optional soundtrack clips on a second track (composition time). */
  audioTracks?: MergeTimelineAudioTrackView[];
  selectedId: string | null;
  /**
   * Video segment the playhead is currently in (source-time space of `playheadSec`).
   * Must stay set when a soundtrack is selected so the needle does not jump.
   */
  playheadSegmentId?: string | null;
  /** Source time within `playheadSegmentId`. */
  playheadSec: number;
  /** Zoom multiplier (0.5–8). */
  zoom: number;
  /** Pixels per second of kept timeline (= base * zoom). */
  pixelsPerSecond: number;
  onSelect: (instanceId: string) => void;
  onTrimChange: (
    instanceId: string,
    trimStartSec: number,
    trimEndSec: number,
  ) => void;
  /** Fired once when a trim-handle drag begins (for undo snapshots). */
  onTrimGestureStart?: () => void;
  onPlayheadChange: (
    instanceId: string,
    playheadSec: number,
    compositionSec?: number,
  ) => void;
  /**
   * Extra composition time past the last video clip (black pad / audio overrun).
   * Added on top of the mapped playhead composition when rendering the needle.
   */
  blackPadSec?: number;
  onZoomChange: (zoom: number) => void;
  /** Reorder by long-press then drag; `toIndex` is the target slot. */
  onReorder?: (fromInstanceId: string, toIndex: number) => void;
  onReorderGestureStart?: () => void;
  onAudioSelect?: (instanceId: string) => void;
  onAudioTrimChange?: (
    instanceId: string,
    trimStartSec: number,
    trimEndSec: number,
    /** When set (left-edge trim), keeps the right composition edge anchored. */
    startAtSec?: number,
  ) => void;
  onAudioMove?: (instanceId: string, startAtSec: number) => void;
  onAudioGestureStart?: () => void;
}

type DragKind = "start" | "end" | null;

function SegmentBlock({
  segment,
  selected,
  reordering,
  dropTarget,
  /** When set, trim handles cannot cross this source time. */
  playheadGuideSec,
  pixelsPerSecond,
  onSelect,
  onTrimChange,
  onTrimGestureStart,
  onSeek,
  onReorderActivate,
  onReorderMove,
  onReorderEnd,
}: {
  segment: MergeTimelineSegmentView;
  selected: boolean;
  reordering: boolean;
  dropTarget: boolean;
  playheadGuideSec: number | null;
  pixelsPerSecond: number;
  onSelect: () => void;
  onTrimChange: (trimStartSec: number, trimEndSec: number) => void;
  onTrimGestureStart?: () => void;
  onSeek: (sourceSec: number) => void;
  onReorderActivate: () => void;
  onReorderMove: (clientX: number) => void;
  onReorderEnd: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragKindRef = useRef<DragKind>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number; clientX: number } | null>(
    null,
  );
  const reorderActiveRef = useRef(false);
  const [dragging, setDragging] = useState<DragKind>(null);

  const duration = Math.max(0.1, segment.durationSec);
  const kept = keptDuration(segment);
  const blockWidth = segmentWidthPx(segment, pixelsPerSecond);
  const frameCount = Math.max(3, Math.min(36, Math.ceil(blockWidth / 36)));
  const { frames, loading } = useFilmstrip(
    segment.videoUrl,
    duration,
    segment.trimStartSec,
    segment.trimEndSec,
    frameCount,
  );

  function sourceTimeFromClientX(clientX: number): number {
    const track = trackRef.current;
    if (!track) return segment.trimStartSec;
    const rect = track.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    return segment.trimStartSec + (x / rect.width) * kept;
  }

  function clampTrim(
    start: number,
    end: number,
  ): { start: number; end: number } {
    let nextStart = Math.min(Math.max(0, start), duration - MIN_TRIM_SEC);
    let nextEnd = Math.min(duration, Math.max(MIN_TRIM_SEC, end));

    // Scissors guide: trim edges cannot cross the playhead.
    if (playheadGuideSec != null && Number.isFinite(playheadGuideSec)) {
      const guide = Math.min(duration, Math.max(0, playheadGuideSec));
      if (dragKindRef.current === "start") {
        nextStart = Math.min(nextStart, guide);
      } else if (dragKindRef.current === "end") {
        nextEnd = Math.max(nextEnd, guide);
      } else {
        nextStart = Math.min(nextStart, guide);
        nextEnd = Math.max(nextEnd, guide);
      }
    }

    if (nextEnd - nextStart < MIN_TRIM_SEC) {
      if (dragKindRef.current === "start") {
        nextStart = nextEnd - MIN_TRIM_SEC;
        if (playheadGuideSec != null) {
          nextStart = Math.min(nextStart, playheadGuideSec);
        }
      } else {
        nextEnd = nextStart + MIN_TRIM_SEC;
        if (playheadGuideSec != null) {
          nextEnd = Math.max(nextEnd, playheadGuideSec);
        }
      }
    }
    return {
      start: Math.max(0, nextStart),
      end: Math.min(duration, nextEnd),
    };
  }

  function onPointerMove(event: PointerEvent) {
    const kind = dragKindRef.current;
    if (!kind) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();

    if (kind === "start") {
      const keptPx = Math.max(HANDLE_WIDTH * 2, rect.right - event.clientX);
      const nextKept = keptPx / pixelsPerSecond;
      const next = clampTrim(segment.trimEndSec - nextKept, segment.trimEndSec);
      onTrimChange(next.start, next.end);
      return;
    }

    const keptPx = Math.max(HANDLE_WIDTH * 2, event.clientX - rect.left);
    const nextKept = keptPx / pixelsPerSecond;
    const next = clampTrim(
      segment.trimStartSec,
      segment.trimStartSec + nextKept,
    );
    onTrimChange(next.start, next.end);
  }

  function stopDragging() {
    dragKindRef.current = null;
    setDragging(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }

  function beginDrag(kind: DragKind, event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    clearLongPress();
    onSelect();
    onTrimGestureStart?.();
    dragKindRef.current = kind;
    setDragging(kind);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
  }

  function clearLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressOriginRef.current = null;
  }

  function onBodyPointerMove(event: PointerEvent) {
    if (reorderActiveRef.current) {
      onReorderMove(event.clientX);
      return;
    }
    const origin = pressOriginRef.current;
    if (!origin || longPressTimerRef.current == null) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPress();
    }
  }

  function onBodyPointerUp(event: PointerEvent) {
    window.removeEventListener("pointermove", onBodyPointerMove);
    window.removeEventListener("pointerup", onBodyPointerUp);
    window.removeEventListener("pointercancel", onBodyPointerUp);

    if (reorderActiveRef.current) {
      reorderActiveRef.current = false;
      onReorderEnd();
      clearLongPress();
      return;
    }

    const origin = pressOriginRef.current;
    const wasPending = longPressTimerRef.current != null;
    clearLongPress();

    // Short tap (no long-press): seek playhead.
    if (wasPending && origin && event.type !== "pointercancel") {
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (Math.hypot(dx, dy) <= LONG_PRESS_MOVE_CANCEL_PX) {
        onSelect();
        onSeek(sourceTimeFromClientX(origin.clientX));
      }
    }
  }

  function onBodyPointerDown(event: ReactPointerEvent) {
    if ((event.target as HTMLElement).closest("[data-handle]")) {
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPress();
    reorderActiveRef.current = false;
    pressOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      clientX: event.clientX,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore if capture is unsupported for this pointer.
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      reorderActiveRef.current = true;
      onSelect();
      onReorderActivate();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(12);
      }
    }, LONG_PRESS_MS);
    window.addEventListener("pointermove", onBodyPointerMove);
    window.addEventListener("pointerup", onBodyPointerUp);
    window.addEventListener("pointercancel", onBodyPointerUp);
  }

  useEffect(
    () => () => {
      stopDragging();
      clearLongPress();
      window.removeEventListener("pointermove", onBodyPointerMove);
      window.removeEventListener("pointerup", onBodyPointerUp);
      window.removeEventListener("pointercancel", onBodyPointerUp);
    },
    [],
  );

  return (
    <div
      className="relative shrink-0"
      style={{ width: blockWidth, height: TRACK_HEIGHT + 16 }}
      title={`${segment.label} · hold to reorder`}
    >
      <div
        ref={trackRef}
        className={cn(
          "absolute inset-x-0 top-0 touch-none select-none overflow-hidden rounded-lg border-[3px] bg-zinc-800",
          reordering ? "cursor-grabbing opacity-45" : "cursor-grab",
          selected
            ? "border-[#f5d000] shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            : "border-zinc-600",
          dropTarget && !reordering && "ring-2 ring-[#f5d000] ring-offset-1 ring-offset-[#1c1c1e]",
        )}
        style={{ height: TRACK_HEIGHT }}
        onPointerDown={onBodyPointerDown}
      >
        <div className="flex h-full w-full">
          {frames.length > 0
            ? frames.map((src, index) => (
                <img
                  key={`${segment.instanceId}-${index}`}
                  src={src}
                  alt=""
                  draggable={false}
                  className="h-full flex-1 object-cover"
                />
              ))
            : Array.from({ length: frameCount }).map((_, index) => (
                <div
                  key={index}
                  className="h-full flex-1 border-r border-zinc-700/60 bg-zinc-800"
                />
              ))}
        </div>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-zinc-300">
            …
          </div>
        ) : null}
        {segment.muted ? (
          <div
            className="pointer-events-none absolute left-1/2 top-1 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-zinc-100"
            title="Clip audio muted"
          >
            <VolumeX className="size-3" />
            Mute
          </div>
        ) : null}

        <button
          type="button"
          data-handle="start"
          aria-label="Trim start"
          className={cn(
            "absolute inset-y-0 left-0 z-20 flex w-3.5 cursor-ew-resize items-center justify-center bg-[#f5d000]",
            dragging === "start" && "brightness-110",
          )}
          onPointerDown={(event) => beginDrag("start", event)}
        >
          <span className="h-8 w-0.5 rounded-full bg-zinc-900/80" />
        </button>
        <button
          type="button"
          data-handle="end"
          aria-label="Trim end"
          className={cn(
            "absolute inset-y-0 right-0 z-20 flex w-3.5 cursor-ew-resize items-center justify-center bg-[#f5d000]",
            dragging === "end" && "brightness-110",
          )}
          onPointerDown={(event) => beginDrag("end", event)}
        >
          <MoveHorizontal className="size-3.5 text-zinc-900 drop-shadow" />
        </button>
      </div>
      {segment.qualityLabel ? (
        <p
          className="absolute inset-x-0 bottom-0 truncate px-0.5 text-center text-[10px] font-medium tabular-nums text-zinc-400"
          title={segment.qualityLabel}
        >
          {segment.qualityLabel}
        </p>
      ) : null}
    </div>
  );
}

const AUDIO_MOVE_THRESHOLD_PX = 6;
/** Snap soundtrack start to video-part starts when within this many pixels. */
const AUDIO_SNAP_THRESHOLD_PX = 14;

/** Composition-time starts of each video part (0, after first kept, …). */
function videoPartStartSecs(segments: MergeTimelineSegmentView[]): number[] {
  const starts: number[] = [0];
  let t = 0;
  for (let i = 0; i < segments.length - 1; i += 1) {
    t += keptDuration(segments[i]!);
    starts.push(Number(t.toFixed(3)));
  }
  return starts;
}

function snapToNearest(
  value: number,
  targets: number[],
  thresholdSec: number,
): number | null {
  let best: number | null = null;
  let bestDist = thresholdSec;
  for (const target of targets) {
    const dist = Math.abs(value - target);
    if (dist <= bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  return best;
}

function AudioTrackBlock({
  track,
  selected,
  pixelsPerSecond,
  compositionDurationSec,
  layout,
  snapTargetsSec,
  onSelect,
  onTrimChange,
  onMove,
  onGestureStart,
  onSnapGuideChange,
}: {
  track: MergeTimelineAudioTrackView;
  selected: boolean;
  pixelsPerSecond: number;
  compositionDurationSec: number;
  layout: TimelineLayoutItem[];
  snapTargetsSec: number[];
  onSelect: () => void;
  onTrimChange: (
    trimStartSec: number,
    trimEndSec: number,
    startAtSec?: number,
  ) => void;
  onMove: (startAtSec: number) => void;
  onGestureStart?: () => void;
  onSnapGuideChange?: (compositionSec: number | null) => void;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const dragKindRef = useRef<"start" | "end" | "move" | null>(null);
  const pendingMoveRef = useRef<{
    clientX: number;
    startAtSec: number;
    leftPx: number;
  } | null>(null);
  const moveOriginRef = useRef<{
    clientX: number;
    startAtSec: number;
    leftPx: number;
  } | null>(null);
  const trimOriginRef = useRef<{
    clientX: number;
    trimStartSec: number;
    trimEndSec: number;
    startAtSec: number;
    /** Composition time of the right edge — stays fixed while dragging left. */
    rightCompSec: number;
  } | null>(null);
  const gestureStartedRef = useRef(false);
  const [dragging, setDragging] = useState<"start" | "end" | "move" | null>(
    null,
  );
  const [snapped, setSnapped] = useState(false);

  const duration = Math.max(0.1, track.durationSec);
  const kept = Math.max(MIN_TRIM_SEC, track.trimEndSec - track.trimStartSec);
  const leftPx = compositionToLayoutPx(
    layout,
    Math.max(0, track.startAtSec),
    pixelsPerSecond,
  );
  const rightPx = compositionToLayoutPx(
    layout,
    Math.max(0, track.startAtSec) + kept,
    pixelsPerSecond,
  );
  const blockWidth = Math.max(56, rightPx - leftPx);
  // Allow dragging past the video end — timeline grows with audio overrun.
  const maxStartAt = Math.max(
    compositionDurationSec - MIN_TRIM_SEC,
    track.startAtSec,
    0,
  );
  const snapThresholdSec = AUDIO_SNAP_THRESHOLD_PX / Math.max(1, pixelsPerSecond);

  function clampTrim(
    start: number,
    end: number,
  ): { start: number; end: number } {
    let nextStart = Math.min(Math.max(0, start), duration - MIN_TRIM_SEC);
    let nextEnd = Math.min(duration, Math.max(MIN_TRIM_SEC, end));
    if (nextEnd - nextStart < MIN_TRIM_SEC) {
      if (dragKindRef.current === "start") {
        nextStart = nextEnd - MIN_TRIM_SEC;
      } else {
        nextEnd = nextStart + MIN_TRIM_SEC;
      }
    }
    return {
      start: Math.max(0, nextStart),
      end: Math.min(duration, nextEnd),
    };
  }

  function ensureGestureStarted() {
    if (gestureStartedRef.current) return;
    gestureStartedRef.current = true;
    onGestureStart?.();
  }

  function onPointerMove(event: PointerEvent) {
    const pending = pendingMoveRef.current;
    if (pending && dragKindRef.current == null) {
      const dx = Math.abs(event.clientX - pending.clientX);
      if (dx < AUDIO_MOVE_THRESHOLD_PX) return;
      // Past threshold: promote tap → move drag.
      ensureGestureStarted();
      dragKindRef.current = "move";
      moveOriginRef.current = pending;
      pendingMoveRef.current = null;
      setDragging("move");
    }

    const kind = dragKindRef.current;
    if (!kind) return;

    if (kind === "move") {
      const origin = moveOriginRef.current;
      if (!origin) return;
      const nextLeftPx = origin.leftPx + (event.clientX - origin.clientX);
      const raw = Math.min(
        maxStartAt + kept,
        Math.max(0, layoutPxToComposition(layout, nextLeftPx, pixelsPerSecond)),
      );
      const snappedTo = snapToNearest(raw, snapTargetsSec, snapThresholdSec);
      const next = snappedTo ?? raw;
      setSnapped(snappedTo != null);
      onSnapGuideChange?.(snappedTo);
      onMove(Number(next.toFixed(3)));
      return;
    }

    const origin = trimOriginRef.current;
    if (!origin) return;
    const deltaSec =
      (event.clientX - origin.clientX) / Math.max(1, pixelsPerSecond);

    if (kind === "start") {
      // Left edge only: keep right composition edge + trimEnd fixed.
      let nextTrimStart = origin.trimStartSec + deltaSec;
      nextTrimStart = Math.min(
        origin.trimEndSec - MIN_TRIM_SEC,
        Math.max(0, nextTrimStart),
      );
      const nextKept = origin.trimEndSec - nextTrimStart;
      let nextStartAt = origin.rightCompSec - nextKept;
      if (nextStartAt < 0) {
        nextStartAt = 0;
        nextTrimStart = origin.trimEndSec - origin.rightCompSec;
        nextTrimStart = Math.min(
          origin.trimEndSec - MIN_TRIM_SEC,
          Math.max(0, nextTrimStart),
        );
      }
      const next = clampTrim(nextTrimStart, origin.trimEndSec);
      const keptAfter = next.end - next.start;
      onTrimChange(
        next.start,
        next.end,
        Math.max(0, origin.rightCompSec - keptAfter),
      );
      return;
    }

    // Right edge only: keep left composition edge + trimStart fixed.
    let nextTrimEnd = origin.trimEndSec + deltaSec;
    nextTrimEnd = Math.min(
      duration,
      Math.max(origin.trimStartSec + MIN_TRIM_SEC, nextTrimEnd),
    );
    const next = clampTrim(origin.trimStartSec, nextTrimEnd);
    onTrimChange(next.start, next.end);
  }

  function stopDragging() {
    dragKindRef.current = null;
    moveOriginRef.current = null;
    pendingMoveRef.current = null;
    trimOriginRef.current = null;
    gestureStartedRef.current = false;
    setDragging(null);
    setSnapped(false);
    onSnapGuideChange?.(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }

  function beginTrimDrag(kind: "start" | "end", event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    ensureGestureStarted();
    dragKindRef.current = kind;
    const keptNow = Math.max(
      MIN_TRIM_SEC,
      track.trimEndSec - track.trimStartSec,
    );
    trimOriginRef.current = {
      clientX: event.clientX,
      trimStartSec: track.trimStartSec,
      trimEndSec: track.trimEndSec,
      startAtSec: track.startAtSec,
      rightCompSec: Math.max(0, track.startAtSec) + keptNow,
    };
    setDragging(kind);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
  }

  function beginBodyPointer(event: ReactPointerEvent) {
    if ((event.target as HTMLElement).closest("[data-handle]")) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    // Tap selects only; drag past threshold moves the clip.
    pendingMoveRef.current = {
      clientX: event.clientX,
      startAtSec: track.startAtSec,
      leftPx,
    };
    dragKindRef.current = null;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
  }

  useEffect(
    () => () => {
      stopDragging();
    },
    [],
  );

  return (
    <div
      ref={blockRef}
      data-audio-id={track.instanceId}
      className={cn(
        "absolute top-0 touch-none select-none overflow-hidden rounded-md border-2",
        selected
          ? "border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          : "border-sky-700/80",
        snapped && "border-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.7)]",
        dragging === "move" ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{
        left: leftPx,
        width: blockWidth,
        height: AUDIO_TRACK_HEIGHT,
        background:
          "repeating-linear-gradient(90deg, #0c4a6e 0px, #0c4a6e 3px, #075985 3px, #075985 6px)",
      }}
      title={`${track.label} · tap to select · drag to move (snaps to video starts) · trim handles on edges`}
      onPointerDown={beginBodyPointer}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
        <span className="truncate text-[10px] font-medium text-sky-100/90">
          {track.label}
        </span>
      </div>
      <button
        type="button"
        data-handle="start"
        aria-label="Trim audio start"
        className={cn(
          "absolute inset-y-0 left-0 z-20 flex w-3 cursor-ew-resize items-center justify-center bg-sky-300",
          dragging === "start" && "brightness-110",
        )}
        onPointerDown={(event) => beginTrimDrag("start", event)}
      >
        <span className="h-5 w-0.5 rounded-full bg-sky-950/80" />
      </button>
      <button
        type="button"
        data-handle="end"
        aria-label="Trim audio end"
        className={cn(
          "absolute inset-y-0 right-0 z-20 flex w-3 cursor-ew-resize items-center justify-center bg-sky-300",
          dragging === "end" && "brightness-110",
        )}
        onPointerDown={(event) => beginTrimDrag("end", event)}
      >
        <MoveHorizontal className="size-3 text-sky-950 drop-shadow" />
      </button>
    </div>
  );
}

export function VideoFrameMergeTimeline({
  segments,
  audioTracks = [],
  selectedId,
  playheadSegmentId = null,
  playheadSec,
  blackPadSec = 0,
  zoom,
  pixelsPerSecond,
  onSelect,
  onTrimChange,
  onTrimGestureStart,
  onPlayheadChange,
  onZoomChange,
  onReorder,
  onReorderGestureStart,
  onAudioSelect,
  onAudioTrimChange,
  onAudioMove,
  onAudioGestureStart,
}: VideoFrameMergeTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRowRef = useRef<HTMLDivElement>(null);
  const draggingPlayheadRef = useRef(false);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [audioSnapSec, setAudioSnapSec] = useState<number | null>(null);
  const reorderIdRef = useRef<string | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const layoutRef = useRef<
    Array<{ segment: MergeTimelineSegmentView; left: number; width: number }>
  >([]);

  const totalKeptSec = useMemo(
    () => segments.reduce((sum, segment) => sum + keptDuration(segment), 0),
    [segments],
  );

  const audioExtentSec = useMemo(() => {
    let max = 0;
    for (const track of audioTracks) {
      const kept = Math.max(
        MIN_TRIM_SEC,
        track.trimEndSec - track.trimStartSec,
      );
      max = Math.max(max, Math.max(0, track.startAtSec) + kept);
    }
    return max;
  }, [audioTracks]);

  const timelineDurationSec = Math.max(totalKeptSec, audioExtentSec);
  const overrunSec = Math.max(0, timelineDurationSec - totalKeptSec);

  const audioSnapTargetsSec = useMemo(
    () => videoPartStartSecs(segments),
    [segments],
  );

  const selected = segments.find((segment) => segment.instanceId === selectedId);
  /** Prefer explicit playhead segment so soundtrack selection does not remap the needle. */
  const playheadSegment =
    segments.find((segment) => segment.instanceId === playheadSegmentId) ??
    selected ??
    segments[0] ??
    null;

  const compositionSec = useMemo(() => {
    if (!playheadSegment) return Math.max(0, blackPadSec);
    const sourceSec = Math.min(
      playheadSegment.trimEndSec,
      Math.max(playheadSegment.trimStartSec, playheadSec),
    );
    const base = sourceToComposition(
      segments,
      playheadSegment.instanceId,
      sourceSec,
    );
    return base + Math.max(0, blackPadSec);
  }, [segments, playheadSegment, playheadSec, blackPadSec]);

  const layout = useMemo(() => {
    let x = 0;
    return segments.map((segment, index) => {
      const width = segmentWidthPx(segment, pixelsPerSecond);
      const left = x;
      x += width + (index < segments.length - 1 ? SEGMENT_GAP : 0);
      return { segment, left, width };
    });
  }, [segments, pixelsPerSecond]);
  layoutRef.current = layout;

  const videoTrackWidth = Math.max(
    160,
    layout.reduce((sum, item, index) => {
      return sum + item.width + (index > 0 ? SEGMENT_GAP : 0);
    }, 0),
  );
  const totalWidth = Math.max(
    160,
    videoTrackWidth + overrunSec * pixelsPerSecond,
  );

  function dropIndexFromClientX(clientX: number): number {
    const row = trackRowRef.current;
    const items = layoutRef.current;
    if (!row || items.length === 0) return 0;
    const rect = row.getBoundingClientRect();
    const x = clientX - rect.left;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      if (x < item.left + item.width / 2) {
        return i;
      }
    }
    return items.length - 1;
  }

  function activateReorder(instanceId: string) {
    if (!onReorder) return;
    onReorderGestureStart?.();
    const from = segments.findIndex(
      (segment) => segment.instanceId === instanceId,
    );
    const index = from >= 0 ? from : 0;
    reorderIdRef.current = instanceId;
    dropIndexRef.current = index;
    setReorderId(instanceId);
    setDropIndex(index);
  }

  function moveReorder(clientX: number) {
    if (!reorderIdRef.current) return;
    const next = dropIndexFromClientX(clientX);
    dropIndexRef.current = next;
    setDropIndex(next);
  }

  function endReorder() {
    const id = reorderIdRef.current;
    const to = dropIndexRef.current;
    if (id != null && to != null && onReorder) {
      const from = segments.findIndex((segment) => segment.instanceId === id);
      if (from >= 0 && from !== to) {
        onReorder(id, to);
      }
    }
    reorderIdRef.current = null;
    dropIndexRef.current = null;
    setReorderId(null);
    setDropIndex(null);
  }

  const dropLineLeft = useMemo(() => {
    if (dropIndex == null || !layout[dropIndex] || reorderId == null) {
      return null;
    }
    const from = segments.findIndex((s) => s.instanceId === reorderId);
    const item = layout[dropIndex]!;
    // Line on the side we're inserting toward.
    if (from < dropIndex) {
      return item.left + item.width + SEGMENT_GAP / 2;
    }
    return item.left - SEGMENT_GAP / 2;
  }, [dropIndex, layout, reorderId, segments]);

  const playheadPx = Math.min(
    totalWidth,
    Math.max(
      0,
      compositionToLayoutPx(layout, compositionSec, pixelsPerSecond),
    ),
  );

  const audioSnapPx =
    audioSnapSec != null
      ? Math.min(
          totalWidth,
          Math.max(
            0,
            compositionToLayoutPx(layout, audioSnapSec, pixelsPerSecond),
          ),
        )
      : null;

  const tickStep =
    pixelsPerSecond >= 120
      ? 0.25
      : pixelsPerSecond >= 60
        ? 0.5
        : pixelsPerSecond >= 30
          ? 1
          : 2;

  const ticks: number[] = [];
  for (let t = 0; t <= timelineDurationSec + 0.001; t += tickStep) {
    ticks.push(Number(t.toFixed(3)));
  }

  function seekFromClientX(clientX: number) {
    const row = trackRowRef.current;
    if (!row || segments.length === 0) return;
    const rect = row.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const mapped = layoutPxToSource(layoutRef.current, x, pixelsPerSecond);
    if (!mapped) return;
    // Scrubbing must not steal selection (e.g. soundtrack) onto the video under the needle.
    onPlayheadChange(
      mapped.instanceId,
      mapped.sourceSec,
      mapped.compositionSec,
    );
  }

  function onPlayheadPointerMove(event: PointerEvent) {
    if (!draggingPlayheadRef.current) return;
    seekFromClientX(event.clientX);
  }

  function stopPlayheadDrag() {
    draggingPlayheadRef.current = false;
    setDraggingPlayhead(false);
    window.removeEventListener("pointermove", onPlayheadPointerMove);
    window.removeEventListener("pointerup", stopPlayheadDrag);
  }

  function beginPlayheadDrag(event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    draggingPlayheadRef.current = true;
    setDraggingPlayhead(true);
    seekFromClientX(event.clientX);
    window.addEventListener("pointermove", onPlayheadPointerMove);
    window.addEventListener("pointerup", stopPlayheadDrag);
  }

  useEffect(() => () => stopPlayheadDrag(), []);

  // Trackpad pinch (ctrl+wheel on macOS) and ctrl/meta+scroll zoom.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onWheel = (event: WheelEvent) => {
      const isPinch = event.ctrlKey || event.metaKey;
      if (!isPinch) return;
      event.preventDefault();

      const factor = Math.exp(-event.deltaY * 0.01);
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Number((zoom * factor).toFixed(3))),
      );
      if (next === zoom) return;

      // Zoom around cursor: keep composition time under pointer stable.
      const row = trackRowRef.current;
      if (row) {
        const rect = row.getBoundingClientRect();
        const xInContent =
          event.clientX - rect.left + (scroller.scrollLeft - 12);
        const compositionUnderCursor = Math.max(
          0,
          xInContent / pixelsPerSecond,
        );
        onZoomChange(next);
        const nextPps = (pixelsPerSecond / zoom) * next;
        requestAnimationFrame(() => {
          const targetScroll =
            compositionUnderCursor * nextPps - (event.clientX - scroller.getBoundingClientRect().left) + 12;
          scroller.scrollLeft = Math.max(0, targetScroll);
        });
        return;
      }
      onZoomChange(next);
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [zoom, pixelsPerSecond, onZoomChange]);

  // Safari trackpad gesture zoom.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let gestureStartZoom = zoom;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartZoom = zoom;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale ?? 1;
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Number((gestureStartZoom * scale).toFixed(3))),
      );
      onZoomChange(next);
    };

    scroller.addEventListener("gesturestart", onGestureStart, {
      passive: false,
    } as AddEventListenerOptions);
    scroller.addEventListener("gesturechange", onGestureChange, {
      passive: false,
    } as AddEventListenerOptions);
    return () => {
      scroller.removeEventListener("gesturestart", onGestureStart);
      scroller.removeEventListener("gesturechange", onGestureChange);
    };
  }, [zoom, onZoomChange]);

  useEffect(() => {
    if (!selectedId || !scrollerRef.current || draggingPlayhead || reorderId) {
      return;
    }
    const el = scrollerRef.current.querySelector<HTMLElement>(
      `[data-segment-id="${selectedId}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [selectedId, pixelsPerSecond, draggingPlayhead, reorderId]);

  function onTrackWheel(event: ReactWheelEvent<HTMLDivElement>) {
    // Non-pinch two-finger scroll remains native horizontal/vertical scroll.
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }

  const hasAudioTrack = audioTracks.length > 0;
  const audioLaneHeight = hasAudioTrack ? AUDIO_TRACK_HEIGHT + 22 : 0;
  const playheadExtra = hasAudioTrack ? audioLaneHeight + 8 : 0;

  if (segments.length === 0) {
    return null;
  }

  const selectedAudio =
    audioTracks.find((track) => track.instanceId === selectedId) ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700/80 bg-[#1c1c1e] text-zinc-100 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5">
        <p className="truncate text-[11px] font-medium text-zinc-300">
          {segments.length} clip{segments.length === 1 ? "" : "s"}
          {hasAudioTrack
            ? ` · ${audioTracks.length} audio`
            : ""}{" "}
          · video {formatTimelineTime(totalKeptSec)}
          {overrunSec > 0.04
            ? ` · timeline ${formatTimelineTime(timelineDurationSec)} (black pad ${formatTimelineTime(overrunSec)})`
            : ""}
          {selected ? ` · ${selected.label}` : ""}
          {selectedAudio ? ` · ${selectedAudio.label}` : ""}
          <span className="ml-2 text-zinc-500">
            Hold a clip to reorder · drag audio to move · pinch / Ctrl+scroll to
            zoom
          </span>
        </p>
        <div className="relative shrink-0">
          <div className="rounded-md bg-[#f5d000] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-900 shadow">
            {formatTimelineTime(compositionSec)}
          </div>
          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-[#f5d000]" />
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="overflow-x-auto overflow-y-hidden px-3 py-3"
        onWheel={onTrackWheel}
      >
        <div
          className="relative"
          style={{
            width: totalWidth,
            minHeight: TRACK_HEIGHT + 52 + audioLaneHeight,
          }}
        >
          <div className="relative mb-1 h-3" style={{ width: totalWidth }}>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-2 w-px bg-zinc-600"
                style={{
                  left: compositionToLayoutPx(layout, t, pixelsPerSecond),
                }}
              />
            ))}
          </div>

          <div
            ref={trackRowRef}
            className="relative"
            style={{ width: totalWidth, height: TRACK_HEIGHT + 16 }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("[data-handle]")) {
                return;
              }
              if ((event.target as HTMLElement).closest("[data-playhead]")) {
                return;
              }
              // Click empty track / segment body seeks via segment handlers;
              // also allow clicking the row background.
              if (event.target === trackRowRef.current) {
                beginPlayheadDrag(event);
              }
            }}
          >
            <div className="flex items-stretch" style={{ gap: SEGMENT_GAP }}>
              {layout.map(({ segment }, index) => {
                const isSelected =
                  segment.instanceId === selectedId && blackPadSec < 0.02;
                const guideInSegment =
                  isSelected &&
                  playheadSec >= segment.trimStartSec - 0.001 &&
                  playheadSec <= segment.trimEndSec + 0.001
                    ? playheadSec
                    : null;
                return (
                  <div
                    key={segment.instanceId}
                    data-segment-id={segment.instanceId}
                  >
                    <SegmentBlock
                      segment={segment}
                      selected={isSelected}
                      reordering={reorderId === segment.instanceId}
                      dropTarget={
                        reorderId != null &&
                        dropIndex === index &&
                        reorderId !== segment.instanceId
                      }
                      playheadGuideSec={guideInSegment}
                      pixelsPerSecond={pixelsPerSecond}
                      onSelect={() => onSelect(segment.instanceId)}
                      onTrimChange={(start, end) =>
                        onTrimChange(segment.instanceId, start, end)
                      }
                      onTrimGestureStart={onTrimGestureStart}
                      onSeek={(sourceSec) =>
                        onPlayheadChange(segment.instanceId, sourceSec)
                      }
                      onReorderActivate={() =>
                        activateReorder(segment.instanceId)
                      }
                      onReorderMove={moveReorder}
                      onReorderEnd={endReorder}
                    />
                  </div>
                );
              })}
            </div>

            {overrunSec > 0.04 ? (
              <div
                className="absolute top-0 flex items-center justify-center rounded-md border border-dashed border-zinc-600 bg-zinc-950/90 text-[10px] font-medium uppercase tracking-wide text-zinc-500"
                style={{
                  left: videoTrackWidth,
                  width: Math.max(48, overrunSec * pixelsPerSecond),
                  height: TRACK_HEIGHT,
                }}
                title="Black pad — video holds black while soundtrack continues"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  beginPlayheadDrag(event);
                }}
              >
                Black
              </div>
            ) : null}

            {dropLineLeft != null ? (
              <div
                className="pointer-events-none absolute top-[-4px] z-50 h-[calc(100%+8px)] w-0.5 rounded-full bg-[#f5d000] shadow-[0_0_6px_rgba(245,208,0,0.8)]"
                style={{ left: dropLineLeft }}
              />
            ) : null}

            {audioSnapPx != null ? (
              <div
                className="pointer-events-none absolute top-[-6px] z-50 w-0.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                style={{
                  left: audioSnapPx,
                  height: `calc(100% + 20px + ${playheadExtra}px)`,
                }}
                aria-hidden
              />
            ) : null}

            {/* Global playhead cursor across video (+ audio lane when present) */}
            <div
              data-playhead
              className={cn(
                "absolute top-[-10px] z-40 flex w-4 -translate-x-1/2 cursor-ew-resize flex-col items-center",
                draggingPlayhead && "opacity-100",
                reorderId && "pointer-events-none opacity-40",
              )}
              style={{
                left: playheadPx,
                height: `calc(100% + 18px + ${playheadExtra}px)`,
              }}
              onPointerDown={beginPlayheadDrag}
              role="slider"
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={timelineDurationSec}
              aria-valuenow={compositionSec}
              tabIndex={0}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.25 : 0.05;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const delta = event.key === "ArrowLeft" ? -step : step;
                  const nextComp = Math.min(
                    timelineDurationSec,
                    Math.max(0, compositionSec + delta),
                  );
                  if (nextComp > totalKeptSec + 0.001) {
                    const last = segments[segments.length - 1];
                    if (!last) return;
                    onPlayheadChange(
                      last.instanceId,
                      last.trimEndSec,
                      nextComp,
                    );
                    return;
                  }
                  const mapped = compositionToSource(segments, nextComp);
                  if (!mapped) return;
                  onPlayheadChange(
                    mapped.instanceId,
                    mapped.sourceSec,
                    nextComp,
                  );
                }
              }}
            >
              <Scissors className="size-3.5 shrink-0 text-white drop-shadow" />
              <div className="w-0 flex-1 border-l-2 border-dashed border-white/95" />
              <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f5d000] ring-2 ring-black/40" />
            </div>
          </div>

          {hasAudioTrack ? (
            <div className="mt-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-sky-400/90">
                Soundtrack
              </p>
              <div
                className="relative rounded-md bg-zinc-900/80 ring-1 ring-sky-900/60"
                style={{
                  width: totalWidth,
                  height: AUDIO_TRACK_HEIGHT + 4,
                }}
              >
                {audioTracks.map((track) => (
                  <AudioTrackBlock
                    key={track.instanceId}
                    track={track}
                    selected={track.instanceId === selectedId}
                    pixelsPerSecond={pixelsPerSecond}
                    compositionDurationSec={timelineDurationSec}
                    layout={layout}
                    snapTargetsSec={audioSnapTargetsSec}
                    onSelect={() => onAudioSelect?.(track.instanceId)}
                    onTrimChange={(start, end, startAtSec) =>
                      onAudioTrimChange?.(
                        track.instanceId,
                        start,
                        end,
                        startAtSec,
                      )
                    }
                    onMove={(startAtSec) =>
                      onAudioMove?.(track.instanceId, startAtSec)
                    }
                    onGestureStart={onAudioGestureStart}
                    onSnapGuideChange={setAudioSnapSec}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div
            className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-500"
            style={{ width: totalWidth }}
          >
            <span>00:00.00</span>
            <span>{formatTimelineTime(timelineDurationSec)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function formatMergeTimelineTime(sec: number): string {
  return formatTimelineTime(sec);
}
