"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { MoveHorizontal, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";

const TRACK_HEIGHT = 72;
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

export interface VideoFrameMergeTimelineProps {
  segments: MergeTimelineSegmentView[];
  selectedId: string | null;
  /** Source time within the selected segment. */
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
  onPlayheadChange: (instanceId: string, playheadSec: number) => void;
  onZoomChange: (zoom: number) => void;
  /** Reorder by long-press then drag; `toIndex` is the target slot. */
  onReorder?: (fromInstanceId: string, toIndex: number) => void;
  onReorderGestureStart?: () => void;
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

export function VideoFrameMergeTimeline({
  segments,
  selectedId,
  playheadSec,
  zoom,
  pixelsPerSecond,
  onSelect,
  onTrimChange,
  onTrimGestureStart,
  onPlayheadChange,
  onZoomChange,
  onReorder,
  onReorderGestureStart,
}: VideoFrameMergeTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRowRef = useRef<HTMLDivElement>(null);
  const draggingPlayheadRef = useRef(false);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const reorderIdRef = useRef<string | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const layoutRef = useRef<
    Array<{ segment: MergeTimelineSegmentView; left: number; width: number }>
  >([]);

  const totalKeptSec = useMemo(
    () => segments.reduce((sum, segment) => sum + keptDuration(segment), 0),
    [segments],
  );

  const selected = segments.find((segment) => segment.instanceId === selectedId);

  const compositionSec = useMemo(() => {
    if (!selectedId) return 0;
    return sourceToComposition(segments, selectedId, playheadSec);
  }, [segments, selectedId, playheadSec]);

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

  const totalWidth = Math.max(160, layout.reduce((sum, item, index) => {
    return sum + item.width + (index > 0 ? SEGMENT_GAP : 0);
  }, 0));

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
    Math.max(0, compositionSec * pixelsPerSecond),
  );

  const tickStep =
    pixelsPerSecond >= 120
      ? 0.25
      : pixelsPerSecond >= 60
        ? 0.5
        : pixelsPerSecond >= 30
          ? 1
          : 2;

  const ticks: number[] = [];
  for (let t = 0; t <= totalKeptSec + 0.001; t += tickStep) {
    ticks.push(Number(t.toFixed(3)));
  }

  function seekFromClientX(clientX: number) {
    const row = trackRowRef.current;
    if (!row || segments.length === 0) return;
    const rect = row.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const composition = x / pixelsPerSecond;
    const mapped = compositionToSource(segments, composition);
    if (!mapped) return;
    onSelect(mapped.instanceId);
    onPlayheadChange(mapped.instanceId, mapped.sourceSec);
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

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700/80 bg-[#1c1c1e] text-zinc-100 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5">
        <p className="truncate text-[11px] font-medium text-zinc-300">
          {segments.length} clip{segments.length === 1 ? "" : "s"} · total kept{" "}
          {formatTimelineTime(totalKeptSec)}
          {selected ? ` · ${selected.label}` : ""}
          <span className="ml-2 text-zinc-500">
            Hold a clip to reorder · pinch / Ctrl+scroll to zoom
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
          style={{ width: totalWidth, minHeight: TRACK_HEIGHT + 52 }}
        >
          <div className="relative mb-1 h-3" style={{ width: totalWidth }}>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-2 w-px bg-zinc-600"
                style={{ left: t * pixelsPerSecond }}
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
                const isSelected = segment.instanceId === selectedId;
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

            {dropLineLeft != null ? (
              <div
                className="pointer-events-none absolute top-[-4px] z-50 h-[calc(100%+8px)] w-0.5 rounded-full bg-[#f5d000] shadow-[0_0_6px_rgba(245,208,0,0.8)]"
                style={{ left: dropLineLeft }}
              />
            ) : null}

            {/* Global playhead cursor across the whole row */}
            <div
              data-playhead
              className={cn(
                "absolute top-[-10px] z-40 flex h-[calc(100%+18px)] w-4 -translate-x-1/2 cursor-ew-resize flex-col items-center",
                draggingPlayhead && "opacity-100",
                reorderId && "pointer-events-none opacity-40",
              )}
              style={{ left: playheadPx }}
              onPointerDown={beginPlayheadDrag}
              role="slider"
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={totalKeptSec}
              aria-valuenow={compositionSec}
              tabIndex={0}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.25 : 0.05;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const delta = event.key === "ArrowLeft" ? -step : step;
                  const nextComp = Math.min(
                    totalKeptSec,
                    Math.max(0, compositionSec + delta),
                  );
                  const mapped = compositionToSource(segments, nextComp);
                  if (!mapped) return;
                  onSelect(mapped.instanceId);
                  onPlayheadChange(mapped.instanceId, mapped.sourceSec);
                }
              }}
            >
              <Scissors className="size-3.5 shrink-0 text-white drop-shadow" />
              <div className="w-0 flex-1 border-l-2 border-dashed border-white/95" />
              <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f5d000] ring-2 ring-black/40" />
            </div>
          </div>

          <div
            className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-500"
            style={{ width: totalWidth }}
          >
            <span>00:00.00</span>
            <span>{formatTimelineTime(totalKeptSec)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function formatMergeTimelineTime(sec: number): string {
  return formatTimelineTime(sec);
}
