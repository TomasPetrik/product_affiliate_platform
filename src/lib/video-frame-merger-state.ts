/** Persisted Video merger timeline state for a Video creator project. */

import {
  DEFAULT_MERGE_EXPORT_QUALITY,
  parseMergeExportQuality,
  type MergeExportQuality,
} from "@/lib/video-frame-merge-quality";

export interface VideoFrameMergerSegmentState {
  instanceId: string;
  assetId: string;
  trimStartSec: number;
  trimEndSec: number;
  durationSec: number;
  /** When true, this clip's audio is silenced in the merge (soundtrack can still overlay). */
  muted?: boolean;
}

/** Soundtrack placed on composition time (move via startAtSec, trim like video). */
export interface VideoFrameMergerAudioTrackState {
  instanceId: string;
  assetId: string;
  trimStartSec: number;
  trimEndSec: number;
  durationSec: number;
  /** Where the trimmed audio begins on the merged composition timeline. */
  startAtSec: number;
  /** Linear gain 0–1. Defaults to 1 when omitted. */
  volume?: number;
}

export interface VideoFrameMergerState {
  segments: VideoFrameMergerSegmentState[];
  audioTracks: VideoFrameMergerAudioTrackState[];
  selectedId: string | null;
  playheadSec: number;
  previewSegIndex: number;
  zoom: number;
  /** When true, Generate merge strips clip audio (soundtrack still mixed in). */
  stripAudio: boolean;
  /** 9:16 export size for Generate merge. */
  exportQuality: MergeExportQuality;
}

const MIN_TRIM_SEC = 0.08;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSegment(value: unknown): VideoFrameMergerSegmentState | null {
  if (!isRecord(value)) return null;
  const instanceId =
    typeof value.instanceId === "string" ? value.instanceId.trim() : "";
  const assetId = typeof value.assetId === "string" ? value.assetId.trim() : "";
  const trimStartSec =
    typeof value.trimStartSec === "number" ? value.trimStartSec : NaN;
  const trimEndSec =
    typeof value.trimEndSec === "number" ? value.trimEndSec : NaN;
  const durationSec =
    typeof value.durationSec === "number" ? value.durationSec : NaN;
  if (
    !instanceId ||
    !assetId ||
    !Number.isFinite(trimStartSec) ||
    !Number.isFinite(trimEndSec) ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    trimStartSec < 0 ||
    trimEndSec <= trimStartSec + MIN_TRIM_SEC * 0.5
  ) {
    return null;
  }
  return {
    instanceId,
    assetId,
    trimStartSec: Math.max(0, trimStartSec),
    trimEndSec: Math.min(durationSec, Math.max(trimStartSec + MIN_TRIM_SEC, trimEndSec)),
    durationSec,
    ...(value.muted === true ? { muted: true } : {}),
  };
}

function parseAudioTrack(value: unknown): VideoFrameMergerAudioTrackState | null {
  const base = parseSegment(value);
  if (!base || !isRecord(value)) return null;
  const startAtSec =
    typeof value.startAtSec === "number" && Number.isFinite(value.startAtSec)
      ? Math.max(0, value.startAtSec)
      : 0;
  const volumeRaw =
    typeof value.volume === "number" && Number.isFinite(value.volume)
      ? value.volume
      : undefined;
  const volume =
    volumeRaw == null
      ? undefined
      : Math.min(1, Math.max(0, volumeRaw));
  return {
    ...base,
    startAtSec,
    ...(volume != null ? { volume } : {}),
  };
}

/** Parse JSON from DB / client into a validated merger state. */
export function parseVideoFrameMergerState(
  value: unknown,
): VideoFrameMergerState | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.segments)) return null;

  const segments: VideoFrameMergerSegmentState[] = [];
  for (const item of value.segments) {
    const segment = parseSegment(item);
    if (segment) segments.push(segment);
  }

  const audioTracks: VideoFrameMergerAudioTrackState[] = [];
  if (Array.isArray(value.audioTracks)) {
    for (const item of value.audioTracks) {
      const track = parseAudioTrack(item);
      if (track) audioTracks.push(track);
    }
  }

  const zoomRaw = typeof value.zoom === "number" ? value.zoom : 1.5;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRaw));
  const playheadSec =
    typeof value.playheadSec === "number" && Number.isFinite(value.playheadSec)
      ? Math.max(0, value.playheadSec)
      : 0;
  const previewSegIndex =
    typeof value.previewSegIndex === "number" &&
    Number.isFinite(value.previewSegIndex)
      ? Math.max(0, Math.floor(value.previewSegIndex))
      : 0;
  const selectedId =
    typeof value.selectedId === "string" && value.selectedId.trim()
      ? value.selectedId.trim()
      : null;

  return {
    segments,
    audioTracks,
    selectedId,
    playheadSec,
    previewSegIndex: Math.min(
      previewSegIndex,
      Math.max(0, segments.length - 1),
    ),
    zoom,
    stripAudio: value.stripAudio === true,
    exportQuality: parseMergeExportQuality(value.exportQuality),
  };
}

/** Drop segments/tracks whose assets no longer exist; clamp selection/playhead. */
export function sanitizeVideoFrameMergerState(
  state: VideoFrameMergerState,
  existingClipIds: ReadonlySet<string>,
  existingAudioIds: ReadonlySet<string> = new Set(),
): VideoFrameMergerState {
  const segments = state.segments.filter((segment) =>
    existingClipIds.has(segment.assetId),
  );
  const audioTracks = (state.audioTracks ?? []).filter((track) =>
    existingAudioIds.has(track.assetId),
  );
  const selectedStillThere =
    state.selectedId != null &&
    (segments.some((segment) => segment.instanceId === state.selectedId) ||
      audioTracks.some((track) => track.instanceId === state.selectedId));
  const selectedId = selectedStillThere
    ? state.selectedId
    : (segments[0]?.instanceId ?? audioTracks[0]?.instanceId ?? null);
  let previewSegIndex = state.previewSegIndex;
  if (selectedId) {
    const idx = segments.findIndex((segment) => segment.instanceId === selectedId);
    if (idx >= 0) previewSegIndex = idx;
  } else {
    previewSegIndex = 0;
  }
  const selected = segments[previewSegIndex] ?? segments[0] ?? null;
  const playheadSec = selected
    ? Math.min(
        selected.trimEndSec,
        Math.max(selected.trimStartSec, state.playheadSec),
      )
    : Math.max(0, state.playheadSec);

  return {
    segments,
    audioTracks,
    selectedId,
    playheadSec,
    previewSegIndex,
    zoom: state.zoom,
    stripAudio: state.stripAudio === true,
    exportQuality: parseMergeExportQuality(state.exportQuality),
  };
}

export function emptyVideoFrameMergerState(): VideoFrameMergerState {
  return {
    segments: [],
    audioTracks: [],
    selectedId: null,
    playheadSec: 0,
    previewSegIndex: 0,
    zoom: 1.5,
    stripAudio: false,
    exportQuality: DEFAULT_MERGE_EXPORT_QUALITY,
  };
}
