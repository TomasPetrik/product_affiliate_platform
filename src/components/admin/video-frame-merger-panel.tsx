"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Download,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Scissors,
  Trash2,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  VideoFrameMergeTimeline,
  formatMergeTimelineTime,
} from "@/components/admin/video-frame-merge-timeline";
import {
  MERGE_EXPORT_QUALITIES,
  MERGE_EXPORT_QUALITY_SIZES,
  classifyClipQualityLabel,
  parseMergeExportQuality,
  type MergeExportQuality,
} from "@/lib/video-frame-merge-quality";
import {
  MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES,
  MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES,
} from "@/lib/video-frame-project-paths";
import {
  emptyVideoFrameMergerState,
  sanitizeVideoFrameMergerState,
  type VideoFrameMergerAudioTrackState,
  type VideoFrameMergerState,
} from "@/lib/video-frame-merger-state";
import { cn } from "@/lib/utils";
import {
  mergeVideoFrameClipsAction,
  saveVideoFrameMergerStateAction,
  uploadVideoFrameLocalAudioAction,
  uploadVideoFrameLocalClipAction,
} from "@/server/actions/video-frame-project.actions";
import type { VideoFrameProjectAssetDto } from "@/server/services/video-frame-project.service";
import { sourceToComposition } from "@/components/admin/video-frame-merge-timeline";

const POOL_DRAG_TYPE = "application/x-video-frame-merge-pool";
const ACCEPT_VIDEO =
  "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v";
const ACCEPT_AUDIO =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.aac,.ogg,.m4a,.webm";
const THUMB_CLASS =
  "aspect-[9/16] w-full rounded-md bg-black object-cover ring-1 ring-border";
const BASE_PPS = 48;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const MERGER_AUTOSAVE_DEBOUNCE_MS = 700;
/** Minimum kept duration on each side of a split. */
const MIN_SPLIT_SEC = 0.08;

interface MergeSegment {
  instanceId: string;
  assetId: string;
  trimStartSec: number;
  trimEndSec: number;
  durationSec: number;
  muted?: boolean;
}

type MergeAudioTrack = VideoFrameMergerAudioTrackState;

/** Content fingerprint for autosave — excludes playhead / preview index (ephemeral). */
function mergerStateFingerprint(state: VideoFrameMergerState): string {
  return JSON.stringify({
    segments: state.segments,
    audioTracks: state.audioTracks,
    selectedId: state.selectedId,
    zoom: state.zoom,
    stripAudio: state.stripAudio,
    exportQuality: state.exportQuality,
  });
}

interface TimelineSnapshot {
  segments: MergeSegment[];
  audioTracks: MergeAudioTrack[];
  selectedId: string | null;
  playheadSec: number;
  previewSegIndex: number;
}

function newInstanceId(prefix = "seg") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

function clipProviderLabel(fileName: string): string {
  if (fileName.includes("-wan-edit-")) return "Wan edit";
  if (fileName.includes("-wan-")) return "Wan clip";
  if (fileName.includes("-krea-")) return "Krea";
  if (fileName.includes("-local-")) return "Local";
  return "Clip";
}

function compareMergedVersions(
  a: VideoFrameProjectAssetDto,
  b: VideoFrameProjectAssetDto,
): number {
  const aMinor = Number(/^1\.(\d+)$/.exec(a.label ?? "")?.[1] ?? -1);
  const bMinor = Number(/^1\.(\d+)$/.exec(b.label ?? "")?.[1] ?? -1);
  if (aMinor !== bMinor) return bMinor - aMinor;
  return b.fileName.localeCompare(a.fileName);
}

function clipsFromAssets(
  assets: VideoFrameProjectAssetDto[],
): VideoFrameProjectAssetDto[] {
  return assets
    .filter((asset) => asset.kind === "CLIP")
    .sort(
      (a, b) => b.timeSec - a.timeSec || a.fileName.localeCompare(b.fileName),
    );
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return /\.(mp3|wav|aac|ogg|m4a|webm)$/i.test(file.name);
}

function videoFilesFromList(list: FileList | File[]): File[] {
  return Array.from(list).filter(isVideoFile);
}

function audioFilesFromList(list: FileList | File[]): File[] {
  return Array.from(list).filter(isAudioFile);
}

function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      audio.removeAttribute("src");
      audio.load();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Invalid audio duration."));
        return;
      }
      resolve(duration);
    };
    audio.onerror = () => {
      audio.removeAttribute("src");
      audio.load();
      reject(new Error("Could not read audio metadata."));
    };
    audio.src = url;
  });
}

function hasFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function loadVideoDuration(url: string): Promise<number> {
  return loadVideoMeta(url).then((meta) => meta.duration);
}

function loadVideoMeta(
  url: string,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      video.removeAttribute("src");
      video.load();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Invalid duration."));
        return;
      }
      resolve({
        duration,
        width: Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
      });
    };
    video.onerror = () => {
      video.removeAttribute("src");
      video.load();
      reject(new Error("Could not read video metadata."));
    };
    video.src = url;
  });
}

interface VideoFrameMergerPanelProps {
  projectId: string;
  clips: VideoFrameProjectAssetDto[];
  audioAssets: VideoFrameProjectAssetDto[];
  merged: VideoFrameProjectAssetDto[];
  initialMergerState?: VideoFrameMergerState | null;
  onAssetsUpdated: (projectAssets: VideoFrameProjectAssetDto[]) => void;
  onOpenClip: (asset: VideoFrameProjectAssetDto) => void;
}

function hydrateMergerState(
  initial: VideoFrameMergerState | null | undefined,
  clipIds: ReadonlySet<string>,
  audioIds: ReadonlySet<string>,
): VideoFrameMergerState {
  return sanitizeVideoFrameMergerState(
    initial ?? emptyVideoFrameMergerState(),
    clipIds,
    audioIds,
  );
}

export function VideoFrameMergerPanel({
  projectId,
  clips,
  audioAssets,
  merged,
  initialMergerState = null,
  onAssetsUpdated,
  onOpenClip,
}: VideoFrameMergerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const initialClipIds = useMemo(
    () => new Set(clips.map((clip) => clip.id)),
    // Only for first paint hydration — ignore later clip list churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialAudioIds = useMemo(
    () => new Set(audioAssets.map((asset) => asset.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const hydrated = useMemo(
    () =>
      hydrateMergerState(initialMergerState, initialClipIds, initialAudioIds),
    [initialMergerState, initialClipIds, initialAudioIds],
  );

  const [segments, setSegments] = useState<MergeSegment[]>(
    () => hydrated.segments,
  );
  const [audioTracks, setAudioTracks] = useState<MergeAudioTrack[]>(
    () => hydrated.audioTracks ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => hydrated.selectedId,
  );
  const [dragPoolId, setDragPoolId] = useState<string | null>(null);
  const [fileDropOver, setFileDropOver] = useState(false);
  const [audioDropOver, setAudioDropOver] = useState(false);
  const [merging, setMerging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => hydrated.zoom);
  const [stripAudio, setStripAudio] = useState(() => hydrated.stripAudio);
  const [exportQuality, setExportQuality] = useState<MergeExportQuality>(() =>
    parseMergeExportQuality(hydrated.exportQuality),
  );
  const [clipQualityById, setClipQualityById] = useState<
    Record<string, string>
  >({});
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(() => hydrated.playheadSec);
  /** Composition time past the last video clip (black frames + continuing audio). */
  const [blackPadSec, setBlackPadSec] = useState(0);
  const [previewSegIndex, setPreviewSegIndex] = useState(
    () => hydrated.previewSegIndex,
  );
  const [undoStack, setUndoStack] = useState<TimelineSnapshot[]>([]);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const previewPlayingRef = useRef(false);
  const advancingClipRef = useRef(false);
  const segmentsRef = useRef(segments);
  const audioTracksRef = useRef(audioTracks);
  const selectedIdRef = useRef(selectedId);
  const playheadSecRef = useRef(playheadSec);
  const blackPadSecRef = useRef(blackPadSec);
  const previewSegIndexRef = useRef(previewSegIndex);
  const sequenceClipsRef = useRef<
    Array<{ segment: MergeSegment; clip: VideoFrameProjectAssetDto }>
  >([]);
  const timelineAudioTracksRef = useRef<
    Array<{ track: MergeAudioTrack; asset: VideoFrameProjectAssetDto }>
  >([]);
  const zoomRef = useRef(zoom);
  const stripAudioRef = useRef(stripAudio);
  const exportQualityRef = useRef(exportQuality);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    previewPlayingRef.current = previewPlaying;
  }, [previewPlaying]);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  useEffect(() => {
    audioTracksRef.current = audioTracks;
  }, [audioTracks]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    playheadSecRef.current = playheadSec;
  }, [playheadSec]);
  useEffect(() => {
    blackPadSecRef.current = blackPadSec;
  }, [blackPadSec]);
  useEffect(() => {
    previewSegIndexRef.current = previewSegIndex;
  }, [previewSegIndex]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    stripAudioRef.current = stripAudio;
  }, [stripAudio]);
  useEffect(() => {
    exportQualityRef.current = exportQuality;
  }, [exportQuality]);

  // Allow one paint with restored state before autosave starts.
  useEffect(() => {
    lastSavedFingerprintRef.current = mergerStateFingerprint({
      segments: hydrated.segments,
      audioTracks: hydrated.audioTracks ?? [],
      selectedId: hydrated.selectedId,
      playheadSec: hydrated.playheadSec,
      previewSegIndex: hydrated.previewSegIndex,
      zoom: hydrated.zoom,
      stripAudio: hydrated.stripAudio,
      exportQuality: hydrated.exportQuality,
    });
    const timer = window.setTimeout(() => setAutosaveReady(true), 50);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const clipById = useMemo(() => {
    const map = new Map<string, VideoFrameProjectAssetDto>();
    for (const clip of clips) {
      map.set(clip.id, clip);
    }
    return map;
  }, [clips]);

  const audioById = useMemo(() => {
    const map = new Map<string, VideoFrameProjectAssetDto>();
    for (const asset of audioAssets) {
      map.set(asset.id, asset);
    }
    return map;
  }, [audioAssets]);

  useEffect(() => {
    setSegments((current) => {
      const next = current.filter((segment) => clipById.has(segment.assetId));
      // Keep the same array reference when nothing was removed — avoids autosave loops.
      return next.length === current.length ? current : next;
    });
  }, [clipById]);

  useEffect(() => {
    setAudioTracks((current) => {
      const next = current.filter((track) => audioById.has(track.assetId));
      return next.length === current.length ? current : next;
    });
  }, [audioById]);

  // Debounced autosave of merger timeline to the project.
  // Do not depend on playheadSec / previewSegIndex — those update continuously while
  // previewing and were causing Saving… / Saved to flicker.
  useEffect(() => {
    if (!autosaveReady || uploading || uploadingAudio || merging) {
      return;
    }
    const timer = window.setTimeout(() => {
      const state: VideoFrameMergerState = {
        segments: segmentsRef.current.map((segment) => ({ ...segment })),
        audioTracks: audioTracksRef.current.map((track) => ({ ...track })),
        selectedId: selectedIdRef.current,
        playheadSec: playheadSecRef.current,
        previewSegIndex: previewSegIndexRef.current,
        zoom: zoomRef.current,
        stripAudio: stripAudioRef.current,
        exportQuality: exportQualityRef.current,
      };
      const fingerprint = mergerStateFingerprint(state);
      if (fingerprint === lastSavedFingerprintRef.current) {
        return;
      }
      const requestId = ++saveRequestIdRef.current;
      setSaveState("saving");
      void saveVideoFrameMergerStateAction({ projectId, state }).then(
        (result) => {
          if (requestId !== saveRequestIdRef.current) return;
          if (result.error) {
            setSaveState("error");
            return;
          }
          lastSavedFingerprintRef.current = fingerprint;
          setSaveState("saved");
        },
      );
    }, MERGER_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    autosaveReady,
    uploading,
    uploadingAudio,
    merging,
    projectId,
    segments,
    audioTracks,
    selectedId,
    zoom,
    stripAudio,
    exportQuality,
  ]);

  const clipQualityByIdRef = useRef(clipQualityById);
  clipQualityByIdRef.current = clipQualityById;

  useEffect(() => {
    let cancelled = false;
    const missing = clips.filter(
      (clip) => clipQualityByIdRef.current[clip.id] == null,
    );
    if (missing.length === 0) return;

    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        missing.map(async (clip) => {
          try {
            const meta = await loadVideoMeta(clip.path);
            next[clip.id] = classifyClipQualityLabel(meta.width, meta.height);
          } catch {
            next[clip.id] = "—";
          }
        }),
      );
      if (cancelled) return;
      setClipQualityById((current) => ({ ...current, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [clips]);

  const sequenceClips = segments
    .map((segment) => {
      const clip = clipById.get(segment.assetId);
      if (!clip) return null;
      return { segment, clip };
    })
    .filter(
      (
        row,
      ): row is { segment: MergeSegment; clip: VideoFrameProjectAssetDto } =>
        row != null,
    );

  const selected =
    sequenceClips.find((row) => row.segment.instanceId === selectedId) ??
    null;
  const selectedAudioTrack =
    audioTracks.find((track) => track.instanceId === selectedId) ?? null;

  const timelineAudioTracks = audioTracks
    .map((track) => {
      const asset = audioById.get(track.assetId);
      if (!asset) return null;
      return { track, asset };
    })
    .filter(
      (
        row,
      ): row is { track: MergeAudioTrack; asset: VideoFrameProjectAssetDto } =>
        row != null,
    );
  sequenceClipsRef.current = sequenceClips;
  timelineAudioTracksRef.current = timelineAudioTracks;

  useEffect(() => {
    if (
      selectedId &&
      (sequenceClips.some((row) => row.segment.instanceId === selectedId) ||
        audioTracks.some((track) => track.instanceId === selectedId))
    ) {
      return;
    }
    const first = sequenceClips[0];
    setSelectedId(first?.segment.instanceId ?? audioTracks[0]?.instanceId ?? null);
    if (first) {
      setPreviewSegIndex(0);
      setPlayheadSec(first.segment.trimStartSec);
    }
  }, [selectedId, sequenceClips, audioTracks]);

  const availableClips = clips.filter(
    (clip) => !segments.some((segment) => segment.assetId === clip.id),
  );
  const availableAudio = audioAssets.filter(
    (asset) => !audioTracks.some((track) => track.assetId === asset.id),
  );
  const savedMerges = useMemo(
    () => [...merged].sort(compareMergedVersions),
    [merged],
  );

  const maxMb = Math.round(MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES / (1024 * 1024));
  const maxAudioMb = Math.round(
    MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES / (1024 * 1024),
  );
  const pixelsPerSecond = BASE_PPS * zoom;

  const activePreview = sequenceClips[previewSegIndex] ?? null;
  const soundtrackPreviewKey = timelineAudioTracks
    .map(
      ({ track }) =>
        `${track.instanceId}:${track.startAtSec}:${track.trimStartSec}:${track.trimEndSec}`,
    )
    .join("|");

  const videoCompositionSec = useMemo(
    () =>
      sequenceClips.reduce(
        (sum, row) =>
          sum +
          Math.max(0, row.segment.trimEndSec - row.segment.trimStartSec),
        0,
      ),
    [sequenceClips],
  );

  const audioExtentSec = useMemo(() => {
    let max = 0;
    for (const track of audioTracks) {
      max = Math.max(
        max,
        Math.max(0, track.startAtSec) +
          Math.max(0, track.trimEndSec - track.trimStartSec),
      );
    }
    return max;
  }, [audioTracks]);

  const timelineDurationSec = Math.max(videoCompositionSec, audioExtentSec);
  const inBlackPad = blackPadSec > 0.02;

  function compositionSecFromState(): number {
    const viewSegments = sequenceClips.map(({ segment, clip }) => ({
      instanceId: segment.instanceId,
      videoUrl: clip.path,
      label: clip.fileName,
      durationSec: segment.durationSec,
      trimStartSec: segment.trimStartSec,
      trimEndSec: segment.trimEndSec,
    }));
    const active = sequenceClips[previewSegIndexRef.current];
    if (!active) return Math.max(0, blackPadSecRef.current);
    const base = sourceToComposition(
      viewSegments,
      active.segment.instanceId,
      playheadSecRef.current,
    );
    return base + Math.max(0, blackPadSecRef.current);
  }

  function pushUndoSnapshot() {
    setUndoStack((stack) => [
      ...stack.slice(-39),
      {
        segments: segmentsRef.current.map((segment) => ({ ...segment })),
        audioTracks: audioTracksRef.current.map((track) => ({ ...track })),
        selectedId: selectedIdRef.current,
        playheadSec: playheadSecRef.current,
        previewSegIndex: previewSegIndexRef.current,
      },
    ]);
  }

  function undoTimeline() {
    setUndoStack((stack) => {
      const prev = stack[stack.length - 1];
      if (!prev) return stack;
      setPreviewPlaying(false);
      setBlackPadSec(0);
      setSegments(prev.segments.map((segment) => ({ ...segment })));
      setAudioTracks(prev.audioTracks.map((track) => ({ ...track })));
      setSelectedId(prev.selectedId);
      setPlayheadSec(prev.playheadSec);
      setPreviewSegIndex(prev.previewSegIndex);
      return stack.slice(0, -1);
    });
  }

  useEffect(() => {
    if (!fullPreviewOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFullPreviewOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullPreviewOpen]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !activePreview || previewPlaying) return;
    if (blackPadSec > 0.02) {
      // Hold last frame of the last clip under the black pad.
      if (video.getAttribute("src") !== activePreview.clip.path) {
        video.src = activePreview.clip.path;
        video.load();
      }
      const end = Math.max(
        activePreview.segment.trimStartSec,
        activePreview.segment.trimEndSec - 0.02,
      );
      if (video.readyState >= 1 && Math.abs(video.currentTime - end) > 0.05) {
        video.currentTime = end;
      }
      return;
    }
    if (video.getAttribute("src") !== activePreview.clip.path) {
      video.src = activePreview.clip.path;
      video.load();
    }
    const target = Math.min(
      activePreview.segment.trimEndSec - 0.02,
      Math.max(activePreview.segment.trimStartSec, playheadSec),
    );
    const apply = () => {
      if (Math.abs(video.currentTime - target) > 0.05) {
        video.currentTime = target;
      }
    };
    if (video.readyState >= 1) {
      apply();
    } else {
      video.onloadeddata = () => {
        apply();
        video.onloadeddata = null;
      };
    }
    // Re-run when toggling full preview so the remounted <video> picks up src/time.
  }, [activePreview, playheadSec, previewPlaying, fullPreviewOpen, blackPadSec]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !activePreview) return;

    if (!previewPlaying) {
      video.pause();
      advancingClipRef.current = false;
      return;
    }

    // Black-pad region: video stays on last frame / paused; rAF drives the needle.
    if (blackPadSecRef.current > 0.02) {
      video.pause();
      return;
    }

    const startAt = Math.min(
      activePreview.segment.trimEndSec - 0.02,
      Math.max(activePreview.segment.trimStartSec, playheadSecRef.current),
    );

    const playAt = () => {
      video.currentTime = startAt;
      void video.play().catch(() => setPreviewPlaying(false));
      // Keep advancingClipRef true until timeupdate confirms we're inside
      // this segment — clearing it here caused the next clip (often the last)
      // to be skipped when the previous timeupdate closure still fired.
    };

    if (video.getAttribute("src") !== activePreview.clip.path) {
      video.src = activePreview.clip.path;
      const onReady = () => {
        video.removeEventListener("loadeddata", onReady);
        playAt();
      };
      video.addEventListener("loadeddata", onReady);
      video.load();
      return () => video.removeEventListener("loadeddata", onReady);
    }

    if (
      advancingClipRef.current ||
      Math.abs(video.currentTime - startAt) > 0.12
    ) {
      playAt();
    } else {
      advancingClipRef.current = false;
      void video.play().catch(() => setPreviewPlaying(false));
    }
    // playheadSec read from ref; fullPreviewOpen remounts the video element
    // eslint-disable-next-line react-hooks/exhaustive-deps -- continuous play advances by instance change
  }, [
    previewPlaying,
    activePreview?.segment.instanceId,
    activePreview?.clip.path,
    fullPreviewOpen,
  ]);

  // Soundtrack preview: follow composition time across video clip swaps.
  // May start late (audio begins after playhead) and may switch pieces after a split.
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (!previewPlaying || timelineAudioTracksRef.current.length === 0) {
      audio.pause();
      return;
    }

    const video = previewVideoRef.current;
    let cancelled = false;
    let activeInstanceId: string | null = null;

    function compositionFromVideo(): number {
      const clips = sequenceClipsRef.current;
      const pad = Math.max(0, blackPadSecRef.current);
      if (!video || clips.length === 0) return compositionSecFromState();
      const viewSegments = clips.map(({ segment, clip }) => ({
        instanceId: segment.instanceId,
        videoUrl: clip.path,
        label: clip.fileName,
        durationSec: segment.durationSec,
        trimStartSec: segment.trimStartSec,
        trimEndSec: segment.trimEndSec,
      }));
      const active = clips[previewSegIndexRef.current];
      if (!active) return compositionSecFromState();
      return (
        sourceToComposition(
          viewSegments,
          active.segment.instanceId,
          pad > 0.02 ? active.segment.trimEndSec : video.currentTime,
        ) + pad
      );
    }

    function resolveSoundtrack(compositionSec: number): {
      assetPath: string;
      sourceSec: number;
      instanceId: string;
    } | null {
      for (const { track, asset } of timelineAudioTracksRef.current) {
        const localSec =
          track.trimStartSec + (compositionSec - track.startAtSec);
        if (
          compositionSec < track.startAtSec - 0.05 ||
          localSec < track.trimStartSec - 0.05 ||
          localSec > track.trimEndSec + 0.05
        ) {
          continue;
        }
        return {
          assetPath: asset.path,
          instanceId: track.instanceId,
          sourceSec: Math.min(
            track.trimEndSec - 0.02,
            Math.max(track.trimStartSec, localSec),
          ),
        };
      }
      return null;
    }

    const syncAudio = () => {
      if (cancelled) return;
      const resolved = resolveSoundtrack(compositionFromVideo());
      if (!resolved) {
        activeInstanceId = null;
        if (!audio.paused) audio.pause();
        return;
      }

      const switched =
        activeInstanceId !== resolved.instanceId ||
        audio.getAttribute("src") !== resolved.assetPath;

      if (switched) {
        activeInstanceId = resolved.instanceId;
        if (audio.getAttribute("src") !== resolved.assetPath) {
          audio.src = resolved.assetPath;
        }
        const play = () => {
          if (cancelled) return;
          audio.currentTime = resolved.sourceSec;
          void audio.play().catch(() => {});
        };
        if (audio.readyState >= 1) {
          play();
        } else {
          const onReady = () => {
            audio.removeEventListener("loadeddata", onReady);
            play();
          };
          audio.addEventListener("loadeddata", onReady);
        }
        return;
      }

      if (audio.paused) {
        audio.currentTime = resolved.sourceSec;
        void audio.play().catch(() => {});
        return;
      }
      if (Math.abs(audio.currentTime - resolved.sourceSec) > 0.85) {
        audio.currentTime = resolved.sourceSec;
      }
    };

    // Wait a frame so video has applied its seek for this Play press.
    const startTimer = window.setTimeout(syncAudio, 40);
    video?.addEventListener("timeupdate", syncAudio);
    // Poll while playing so soundtrack keeps syncing through the black-pad
    // region (video is paused there, so timeupdate stops).
    const poll = window.setInterval(syncAudio, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearInterval(poll);
      video?.removeEventListener("timeupdate", syncAudio);
      audio.pause();
    };
    // Keep effect stable across clip advances; track list identity is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPlaying, soundtrackPreviewKey]);

  async function addClipToSequence(assetId: string) {
    const clip = clipById.get(assetId);
    if (!clip || segments.some((segment) => segment.assetId === assetId)) {
      return;
    }
    try {
      const durationSec = await loadVideoDuration(clip.path);
      const segment: MergeSegment = {
        instanceId: newInstanceId(),
        assetId,
        trimStartSec: 0,
        trimEndSec: durationSec,
        durationSec,
      };
      pushUndoSnapshot();
      setSegments((current) => [...current, segment]);
      setSelectedId(segment.instanceId);
      setPreviewSegIndex(segments.length);
      setPlayheadSec(0);
      setError(null);
    } catch {
      setError(`Could not read duration for ${clip.fileName}.`);
    }
  }

  function onPoolDragStart(event: DragEvent<HTMLButtonElement>, id: string) {
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(POOL_DRAG_TYPE, id);
    event.dataTransfer.setData("text/plain", id);
    setDragPoolId(id);
  }

  function onPoolDragEnd() {
    setDragPoolId(null);
    setFileDropOver(false);
    setAudioDropOver(false);
  }

  function onSequenceDragOver(event: DragEvent<HTMLDivElement>) {
    if (hasFileDrag(event) || dragPoolId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!fileDropOver) setFileDropOver(true);
    }
  }

  function onSequenceDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setFileDropOver(false);
  }

  function onSequenceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setFileDropOver(false);
    if (!dragPoolId) {
      const videos = videoFilesFromList(event.dataTransfer.files);
      const audios = audioFilesFromList(event.dataTransfer.files);
      if (videos.length > 0) {
        void uploadLocalClips(videos);
        return;
      }
      if (audios.length > 0) {
        void uploadLocalAudio(audios);
        return;
      }
    }
    const poolId =
      dragPoolId ?? event.dataTransfer.getData(POOL_DRAG_TYPE) ?? "";
    setDragPoolId(null);
    if (poolId) void addClipToSequence(poolId);
  }

  function onAvailableDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFileDrag(event) || dragPoolId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!fileDropOver) setFileDropOver(true);
  }

  function onAvailableDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setFileDropOver(false);
  }

  function onAvailableDrop(event: DragEvent<HTMLDivElement>) {
    if (dragPoolId) return;
    event.preventDefault();
    setFileDropOver(false);
    const videos = videoFilesFromList(event.dataTransfer.files);
    const audios = audioFilesFromList(event.dataTransfer.files);
    if (videos.length > 0) void uploadLocalClips(videos);
    else if (audios.length > 0) void uploadLocalAudio(audios);
  }

  function onSoundtrackDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFileDrag(event) || dragPoolId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!audioDropOver) setAudioDropOver(true);
  }

  function onSoundtrackDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setAudioDropOver(false);
  }

  function onSoundtrackDrop(event: DragEvent<HTMLDivElement>) {
    if (dragPoolId) return;
    event.preventDefault();
    setAudioDropOver(false);
    const audios = audioFilesFromList(event.dataTransfer.files);
    if (audios.length > 0) {
      void uploadLocalAudio(audios);
      return;
    }
    const videos = videoFilesFromList(event.dataTransfer.files);
    if (videos.length > 0) {
      setError("Drop audio files (MP3, WAV, AAC, OGG, M4A) on Soundtrack.");
    }
  }

  function removeSegment(instanceId: string) {
    pushUndoSnapshot();
    setSegments((current) =>
      current.filter((segment) => segment.instanceId !== instanceId),
    );
  }

  function applyReorder(fromInstanceId: string, toIndex: number) {
    setSegments((current) => {
      const fromIndex = current.findIndex(
        (segment) => segment.instanceId === fromInstanceId,
      );
      const next = reorderList(current, fromIndex, toIndex);
      if (next === current) return current;
      const selectedIndex = next.findIndex(
        (segment) => segment.instanceId === fromInstanceId,
      );
      if (selectedIndex >= 0) {
        setPreviewSegIndex(selectedIndex);
      }
      return next;
    });
  }

  function moveSegment(instanceId: string, direction: -1 | 1) {
    pushUndoSnapshot();
    setSegments((current) => {
      const fromIndex = current.findIndex(
        (segment) => segment.instanceId === instanceId,
      );
      const toIndex = fromIndex + direction;
      const next = reorderList(current, fromIndex, toIndex);
      const selectedIndex = next.findIndex(
        (segment) => segment.instanceId === instanceId,
      );
      if (selectedIndex >= 0) {
        setPreviewSegIndex(selectedIndex);
      }
      return next;
    });
  }

  function updateTrim(instanceId: string, trimStartSec: number, trimEndSec: number) {
    setSegments((current) =>
      current.map((segment) =>
        segment.instanceId === instanceId
          ? { ...segment, trimStartSec, trimEndSec }
          : segment,
      ),
    );
  }

  function toggleSegmentMuted(instanceId: string) {
    pushUndoSnapshot();
    setSegments((current) =>
      current.map((segment) =>
        segment.instanceId === instanceId
          ? { ...segment, muted: !segment.muted }
          : segment,
      ),
    );
  }

  function canSplitSelectedVideo(): boolean {
    if (!selected) return false;
    if (selected.segment.instanceId !== activePreview?.segment.instanceId) {
      return false;
    }
    const { trimStartSec, trimEndSec } = selected.segment;
    return (
      playheadSec >= trimStartSec + MIN_SPLIT_SEC &&
      playheadSec <= trimEndSec - MIN_SPLIT_SEC
    );
  }

  function canSplitSelectedAudio(): boolean {
    if (!selectedAudioTrack) return false;
    const compositionSec = compositionSecFromState();
    const track = selectedAudioTrack;
    const localSec =
      track.trimStartSec + (compositionSec - track.startAtSec);
    return (
      compositionSec >= track.startAtSec + MIN_SPLIT_SEC - 0.001 &&
      localSec >= track.trimStartSec + MIN_SPLIT_SEC &&
      localSec <= track.trimEndSec - MIN_SPLIT_SEC
    );
  }

  function splitSelectedVideo() {
    if (!selected || !canSplitSelectedVideo()) return;
    const splitAt = playheadSec;
    const index = sequenceClips.findIndex(
      (row) => row.segment.instanceId === selected.segment.instanceId,
    );
    if (index < 0) return;

    const original = selected.segment;
    const left: MergeSegment = {
      ...original,
      instanceId: newInstanceId("seg"),
      trimStartSec: original.trimStartSec,
      trimEndSec: splitAt,
    };
    const right: MergeSegment = {
      ...original,
      instanceId: newInstanceId("seg"),
      trimStartSec: splitAt,
      trimEndSec: original.trimEndSec,
    };

    pushUndoSnapshot();
    setSegments((current) => {
      const from = current.findIndex(
        (segment) => segment.instanceId === original.instanceId,
      );
      if (from < 0) return current;
      const next = [...current];
      next.splice(from, 1, left, right);
      return next;
    });
    setSelectedId(left.instanceId);
    setPreviewSegIndex(index);
    setPlayheadSec(splitAt);
    setPreviewPlaying(false);
  }

  function splitSelectedAudio() {
    if (!selectedAudioTrack || !canSplitSelectedAudio()) return;
    const compositionSec = compositionSecFromState();
    const original = selectedAudioTrack;
    const localSec = Number(
      (
        original.trimStartSec +
        (compositionSec - original.startAtSec)
      ).toFixed(3),
    );

    const left: MergeAudioTrack = {
      ...original,
      instanceId: newInstanceId("aud"),
      trimStartSec: original.trimStartSec,
      trimEndSec: localSec,
      startAtSec: original.startAtSec,
    };
    const right: MergeAudioTrack = {
      ...original,
      instanceId: newInstanceId("aud"),
      trimStartSec: localSec,
      trimEndSec: original.trimEndSec,
      startAtSec: Math.max(0, compositionSec),
    };

    pushUndoSnapshot();
    setAudioTracks((current) => {
      const from = current.findIndex(
        (track) => track.instanceId === original.instanceId,
      );
      if (from < 0) return current;
      const next = [...current];
      next.splice(from, 1, left, right);
      return next;
    });
    setSelectedId(left.instanceId);
    setPreviewPlaying(false);
  }

  function updateAudioTrim(
    instanceId: string,
    trimStartSec: number,
    trimEndSec: number,
    startAtSec?: number,
  ) {
    setAudioTracks((current) =>
      current.map((track) =>
        track.instanceId === instanceId
          ? {
              ...track,
              trimStartSec,
              trimEndSec,
              ...(startAtSec != null
                ? { startAtSec: Math.max(0, startAtSec) }
                : {}),
            }
          : track,
      ),
    );
  }

  function updateAudioStartAt(instanceId: string, startAtSec: number) {
    setAudioTracks((current) =>
      current.map((track) =>
        track.instanceId === instanceId
          ? { ...track, startAtSec: Math.max(0, startAtSec) }
          : track,
      ),
    );
  }

  function removeAudioTrack(instanceId: string) {
    pushUndoSnapshot();
    setAudioTracks((current) =>
      current.filter((track) => track.instanceId !== instanceId),
    );
  }

  async function addAudioToTimeline(assetId: string) {
    const asset = audioById.get(assetId);
    if (!asset || audioTracks.some((track) => track.assetId === assetId)) {
      return;
    }
    try {
      const durationSec = await loadAudioDuration(asset.path);
      const track: MergeAudioTrack = {
        instanceId: newInstanceId("aud"),
        assetId,
        trimStartSec: 0,
        trimEndSec: durationSec,
        durationSec,
        startAtSec: 0,
      };
      pushUndoSnapshot();
      setAudioTracks((current) => [...current, track]);
      setSelectedId(track.instanceId);
      setError(null);
    } catch {
      setError(`Could not read duration for ${asset.fileName}.`);
    }
  }

  async function uploadLocalAudio(files: File[]) {
    if (uploadingAudio || files.length === 0) return;
    setUploadingAudio(true);
    setError(null);
    let latestAssets: VideoFrameProjectAssetDto[] | null = null;
    const newIds: string[] = [];
    const knownIds = new Set(audioAssets.map((asset) => asset.id));

    try {
      for (const file of files) {
        if (file.size > MAX_VIDEO_FRAME_PROJECT_AUDIO_BYTES) {
          setError(
            `${file.name} is larger than ${maxAudioMb}MB and was skipped.`,
          );
          continue;
        }
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("audio", file);
        const result = await uploadVideoFrameLocalAudioAction(formData);
        if (result.error || !result.project) {
          setError(result.error ?? `Upload failed for ${file.name}.`);
          break;
        }
        latestAssets = result.project.assets;
        const uploaded = latestAssets.find(
          (asset) => asset.kind === "AUDIO" && !knownIds.has(asset.id),
        );
        if (uploaded) {
          newIds.push(uploaded.id);
          knownIds.add(uploaded.id);
        }
      }
      if (latestAssets) {
        onAssetsUpdated(latestAssets);
        if (newIds.length > 0) {
          pushUndoSnapshot();
        }
        for (const id of newIds) {
          const asset = latestAssets.find((row) => row.id === id);
          if (!asset) continue;
          try {
            const durationSec = await loadAudioDuration(asset.path);
            const track: MergeAudioTrack = {
              instanceId: newInstanceId("aud"),
              assetId: id,
              trimStartSec: 0,
              trimEndSec: durationSec,
              durationSec,
              startAtSec: 0,
            };
            setAudioTracks((current) =>
              current.some((row) => row.assetId === id)
                ? current
                : [...current, track],
            );
            setSelectedId(track.instanceId);
          } catch {
            setError(`Could not read duration for ${asset.fileName}.`);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audio upload failed.");
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  async function uploadLocalClips(files: File[]) {
    if (uploading || files.length === 0) return;
    setUploading(true);
    setError(null);
    let latestAssets: VideoFrameProjectAssetDto[] | null = null;
    const newIds: string[] = [];
    const knownIds = new Set(clips.map((clip) => clip.id));

    try {
      for (const file of files) {
        if (file.size > MAX_VIDEO_FRAME_PROJECT_VIDEO_BYTES) {
          setError(`${file.name} is larger than ${maxMb}MB and was skipped.`);
          continue;
        }
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("video", file);
        const result = await uploadVideoFrameLocalClipAction(formData);
        if (result.error || !result.project) {
          setError(result.error ?? `Upload failed for ${file.name}.`);
          break;
        }
        latestAssets = result.project.assets;
        const nextClips = clipsFromAssets(latestAssets);
        const uploaded =
          nextClips.find((clip) => !knownIds.has(clip.id)) ?? null;
        if (uploaded) {
          newIds.push(uploaded.id);
          knownIds.add(uploaded.id);
        }
      }
      if (latestAssets) {
        onAssetsUpdated(latestAssets);
        if (newIds.length > 0) {
          pushUndoSnapshot();
        }
        for (const id of newIds) {
          const clip = latestAssets.find((asset) => asset.id === id);
          if (!clip) continue;
          try {
            const durationSec = await loadVideoDuration(clip.path);
            const segment: MergeSegment = {
              instanceId: newInstanceId(),
              assetId: id,
              trimStartSec: 0,
              trimEndSec: durationSec,
              durationSec,
            };
            setSegments((current) =>
              current.some((row) => row.assetId === id)
                ? current
                : [...current, segment],
            );
            setSelectedId(segment.instanceId);
            setPlayheadSec(0);
          } catch {
            setError(`Could not read duration for ${clip.fileName}.`);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function generateMerge() {
    if (segments.length < 2 || merging) return;
    const notReady = segments.find((segment) => !(segment.durationSec > 0));
    if (notReady) {
      setError("Wait for all clip durations to load before merging.");
      return;
    }
    const audioNotReady = audioTracks.find(
      (track) => !(track.durationSec > 0) || !(track.trimEndSec > track.trimStartSec),
    );
    if (audioNotReady) {
      setError("Wait for soundtrack durations to load before merging.");
      return;
    }
    setMerging(true);
    setError(null);
    setPreviewPlaying(false);
    try {
      const result = await mergeVideoFrameClipsAction({
        projectId,
        stripAudio,
        exportQuality,
        segments: segments.map((segment) => ({
          assetId: segment.assetId,
          trimStartSec: segment.trimStartSec,
          trimEndSec: segment.trimEndSec,
          muted: segment.muted === true,
        })),
        audioTracks: audioTracks.map((track) => ({
          assetId: track.assetId,
          trimStartSec: track.trimStartSec,
          trimEndSec: track.trimEndSec,
          startAtSec: track.startAtSec,
          volume: track.volume,
        })),
      });
      if (result.error || !result.project) {
        setError(result.error ?? "Merge failed.");
        return;
      }
      onAssetsUpdated(result.project.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed.");
    } finally {
      setMerging(false);
    }
  }

  function togglePreviewPlayback() {
    if (!activePreview) return;
    setPreviewPlaying((current) => !current);
  }

  function videoKeptFromClips(
    clips: Array<{ segment: MergeSegment }>,
  ): number {
    return clips.reduce(
      (sum, row) =>
        sum + Math.max(0, row.segment.trimEndSec - row.segment.trimStartSec),
      0,
    );
  }

  function audioExtentFromTracks(tracks: MergeAudioTrack[]): number {
    let max = 0;
    for (const track of tracks) {
      max = Math.max(
        max,
        Math.max(0, track.startAtSec) +
          Math.max(0, track.trimEndSec - track.trimStartSec),
      );
    }
    return max;
  }

  function advanceToNextClip() {
    if (advancingClipRef.current) return;
    const clips = sequenceClipsRef.current;
    const index = previewSegIndexRef.current;
    if (index >= clips.length - 1) {
      const last = clips[index];
      if (last) setPlayheadSec(last.segment.trimEndSec);
      const videoKept = videoKeptFromClips(clips);
      const timelineDur = Math.max(
        videoKept,
        audioExtentFromTracks(audioTracksRef.current),
      );
      if (timelineDur > videoKept + 0.05) {
        // Continue into black pad while soundtrack keeps playing.
        setBlackPadSec(0.001);
        setPreviewPlaying(true);
        return;
      }
      setBlackPadSec(0);
      setPreviewPlaying(false);
      return;
    }
    const next = clips[index + 1];
    if (!next) {
      setPreviewPlaying(false);
      return;
    }
    advancingClipRef.current = true;
    setBlackPadSec(0);
    setPreviewSegIndex(index + 1);
    setSelectedId(next.segment.instanceId);
    setPlayheadSec(next.segment.trimStartSec);
    setPreviewPlaying(true);
  }

  function onPreviewTimeUpdate() {
    const video = previewVideoRef.current;
    if (!video || !previewPlayingRef.current) return;
    if (blackPadSecRef.current > 0.02) return;

    const clips = sequenceClipsRef.current;
    const index = previewSegIndexRef.current;
    const row = clips[index];
    if (!row) return;

    const t = video.currentTime;
    const { trimStartSec, trimEndSec } = row.segment;
    const clamped = Math.min(trimEndSec, Math.max(trimStartSec, t));

    // After a clip advance, ignore end-of-clip checks until the video has
    // actually landed inside the new segment (prevents skipping the last clip).
    if (advancingClipRef.current) {
      if (t >= trimStartSec - 0.08 && t <= trimEndSec + 0.02) {
        advancingClipRef.current = false;
        setPlayheadSec(clamped);
        // Fall through only when safely before the end threshold.
        if (t >= trimEndSec - 0.04) {
          advanceToNextClip();
        }
      }
      return;
    }

    setPlayheadSec(clamped);
    if (t >= trimEndSec - 0.04) {
      advanceToNextClip();
    }
  }

  function seekPreviewTo(segIndex: number, timeSec: number) {
    const row = sequenceClips[segIndex];
    if (!row) return;
    setPreviewPlaying(false);
    setBlackPadSec(0);
    setPreviewSegIndex(segIndex);
    setSelectedId(row.segment.instanceId);
    setPlayheadSec(
      Math.min(
        row.segment.trimEndSec,
        Math.max(row.segment.trimStartSec, timeSec),
      ),
    );
  }

  const blackPadActive = blackPadSec > 0;

  // Drive playhead through the black-pad / audio-overrun region.
  useEffect(() => {
    if (!previewPlaying || !blackPadActive) return;
    const video = previewVideoRef.current;
    video?.pause();

    const clips = sequenceClipsRef.current;
    const videoKept = videoKeptFromClips(clips);
    const timelineDur = Math.max(
      videoKept,
      audioExtentFromTracks(audioTracksRef.current),
    );
    if (!(timelineDur > videoKept + 0.04)) {
      setBlackPadSec(0);
      setPreviewPlaying(false);
      return;
    }

    const startPad = Math.max(0, blackPadSecRef.current);
    const startWall = performance.now();
    let raf = 0;

    const tick = () => {
      if (!previewPlayingRef.current) return;
      const elapsed = (performance.now() - startWall) / 1000;
      const nextPad = startPad + elapsed;
      if (videoKept + nextPad >= timelineDur - 0.02) {
        setBlackPadSec(Math.max(0, timelineDur - videoKept));
        setPreviewPlaying(false);
        return;
      }
      setBlackPadSec(nextPad);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [previewPlaying, blackPadActive]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Video merger</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Build a sequence, trim each clip on the timeline (zoom for precision),
          preview from any frame, then generate a versioned merge.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div
          className={cn(
            "grid gap-2 rounded-xl transition-colors",
            fileDropOver && "ring-2 ring-primary/40 ring-offset-2",
          )}
          onDragOver={onAvailableDragOver}
          onDragLeave={onAvailableDragLeave}
          onDrop={onAvailableDrop}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Available clips
              {availableClips.length > 0 ? ` (${availableClips.length})` : ""}
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_VIDEO}
                multiple
                className="sr-only"
                disabled={uploading || merging}
                onChange={(event) => {
                  const files = videoFilesFromList(event.target.files ?? []);
                  if (files.length > 0) void uploadLocalClips(files);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading || merging}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {uploading ? "Uploading…" : "Add local clip"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            MP4, WebM, or MOV · max {maxMb}MB. Drop files here or click a clip
            to add it to the timeline.
          </p>
          {availableClips.length === 0 ? (
            <p
              className={cn(
                "rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground",
                fileDropOver && "border-primary bg-primary/5",
              )}
            >
              {clips.length === 0
                ? "Drop local videos here, or generate span clips."
                : "All clips are on the timeline. Drop more local videos here."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableClips.map((clip) => (
                <button
                  key={clip.id}
                  type="button"
                  draggable
                  onDragStart={(event) => onPoolDragStart(event, clip.id)}
                  onDragEnd={onPoolDragEnd}
                  onClick={() => void addClipToSequence(clip.id)}
                  className={cn(
                    "group flex w-[4.75rem] flex-col gap-1 rounded-lg border bg-background p-1.5 text-left transition-opacity hover:border-foreground/30",
                    dragPoolId === clip.id && "opacity-60",
                  )}
                  title={`Add ${clip.fileName}`}
                >
                  <video
                    src={clip.path}
                    muted
                    playsInline
                    preload="metadata"
                    draggable={false}
                    className={THUMB_CLASS}
                  />
                  <span className="truncate text-[10px] font-medium">
                    {clipProviderLabel(clip.fileName)}
                  </span>
                  <span className="truncate text-[10px] tabular-nums text-muted-foreground">
                    {clipQualityById[clip.id] ?? "…"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            "grid gap-2 rounded-xl transition-colors",
            audioDropOver && "ring-2 ring-sky-500/40 ring-offset-2",
          )}
          onDragOver={onSoundtrackDragOver}
          onDragLeave={onSoundtrackDragLeave}
          onDrop={onSoundtrackDrop}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Soundtrack
              {audioAssets.length > 0 ? ` (${audioAssets.length})` : ""}
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={audioInputRef}
                type="file"
                accept={ACCEPT_AUDIO}
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = audioFilesFromList(event.target.files ?? []);
                  if (files.length > 0) void uploadLocalAudio(files);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploadingAudio || merging || uploading}
                onClick={() => audioInputRef.current?.click()}
              >
                {uploadingAudio ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Music className="size-3.5" />
                )}
                {uploadingAudio ? "Uploading…" : "Add soundtrack"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            MP3, WAV, AAC, OGG, or M4A · max {maxAudioMb}MB. Drop audio here, then
            trim / move on the blue track — included in Generate merge.
          </p>
          {availableAudio.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableAudio.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => void addAudioToTimeline(asset.id)}
                  className="flex max-w-[12rem] items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left transition-colors hover:border-sky-500/50"
                  title={`Add ${asset.fileName} to soundtrack track`}
                >
                  <Music className="size-3.5 shrink-0 text-sky-600" />
                  <span className="truncate text-[11px] font-medium">
                    {asset.fileName}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p
              className={cn(
                "rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground",
                audioDropOver && "border-sky-500 bg-sky-500/5",
              )}
            >
              {audioAssets.length > 0
                ? "All uploaded soundtracks are on the timeline. Drop more audio here."
                : "Drop audio files here to add a soundtrack."}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Timeline
              {sequenceClips.length > 0 ? ` (${sequenceClips.length})` : ""}
              {audioTracks.length > 0 ? ` · ${audioTracks.length} audio` : ""}
              {saveState === "saving" ? (
                <span className="ml-2 text-[10px]">Saving…</span>
              ) : saveState === "saved" ? (
                <span className="ml-2 text-[10px]">Saved</span>
              ) : saveState === "error" ? (
                <span className="ml-2 text-[10px] text-destructive">
                  Save failed
                </span>
              ) : null}
            </p>
            {sequenceClips.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={
                    undoStack.length === 0 ||
                    merging ||
                    uploading ||
                    uploadingAudio
                  }
                  onClick={undoTimeline}
                  title="Undo last timeline edit"
                >
                  <Undo2 className="size-3.5" />
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom out"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={() =>
                    setZoom((current) =>
                      Math.max(MIN_ZOOM, Number((current / 1.35).toFixed(2))),
                    )
                  }
                >
                  <ZoomOut className="size-3.5" />
                </Button>
                <span className="min-w-12 text-center text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom in"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() =>
                    setZoom((current) =>
                      Math.min(MAX_ZOOM, Number((current * 1.35).toFixed(2))),
                    )
                  }
                >
                  <ZoomIn className="size-3.5" />
                </Button>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.1}
                  value={zoom}
                  aria-label="Timeline zoom"
                  className="ml-1 w-28 accent-[#f5d000]"
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  Pinch / Ctrl+scroll
                </span>
              </div>
            ) : null}
          </div>

          <div
            onDragOver={onSequenceDragOver}
            onDragLeave={onSequenceDragLeave}
            onDrop={onSequenceDrop}
            className={cn(
              "min-h-[7rem] rounded-xl border border-dashed p-3 transition-colors",
              fileDropOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/20",
            )}
          >
            {sequenceClips.length === 0 ? (
              <p className="flex min-h-[5rem] items-center justify-center text-center text-sm text-muted-foreground">
                Drop clips or local videos here to start the timeline.
              </p>
            ) : (
              <div className="grid gap-2">
                {selected ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Selected: {clipProviderLabel(selected.clip.fileName)} ·{" "}
                      {formatMergeTimelineTime(
                        selected.segment.trimEndSec -
                          selected.segment.trimStartSec,
                      )}{" "}
                      kept
                      {selected.segment.muted ? " · muted" : ""}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        disabled={!canSplitSelectedVideo()}
                        title={
                          canSplitSelectedVideo()
                            ? "Split this clip at the playhead"
                            : "Move the playhead inside the selected clip to split"
                        }
                        onClick={splitSelectedVideo}
                      >
                        <Scissors className="size-3.5" />
                        Split
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        disabled={stripAudio}
                        title={
                          stripAudio
                            ? "Global “Remove clip audio” is on"
                            : selected.segment.muted
                              ? "Unmute this clip"
                              : "Mute this clip (soundtrack can still play)"
                        }
                        onClick={() =>
                          toggleSegmentMuted(selected.segment.instanceId)
                        }
                      >
                        {selected.segment.muted || stripAudio ? (
                          <VolumeX className="size-3.5" />
                        ) : (
                          <Volume2 className="size-3.5" />
                        )}
                        {selected.segment.muted || stripAudio ? "Muted" : "Mute"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={previewSegIndex <= 0}
                        onClick={() =>
                          moveSegment(selected.segment.instanceId, -1)
                        }
                      >
                        Left
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          previewSegIndex >= sequenceClips.length - 1
                        }
                        onClick={() =>
                          moveSegment(selected.segment.instanceId, 1)
                        }
                      >
                        Right
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeSegment(selected.segment.instanceId)
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}
                {selectedAudioTrack ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300">
                      Soundtrack:{" "}
                      {audioById.get(selectedAudioTrack.assetId)?.fileName ??
                        "audio"}{" "}
                      · starts{" "}
                      {formatMergeTimelineTime(selectedAudioTrack.startAtSec)} ·{" "}
                      {formatMergeTimelineTime(
                        selectedAudioTrack.trimEndSec -
                          selectedAudioTrack.trimStartSec,
                      )}{" "}
                      kept
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        disabled={!canSplitSelectedAudio()}
                        title={
                          canSplitSelectedAudio()
                            ? "Split soundtrack at the playhead"
                            : "Move the playhead over the selected soundtrack to split"
                        }
                        onClick={splitSelectedAudio}
                      >
                        <Scissors className="size-3.5" />
                        Split
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeAudioTrack(selectedAudioTrack.instanceId)
                        }
                      >
                        Remove audio
                      </Button>
                    </div>
                  </div>
                ) : null}
                <VideoFrameMergeTimeline
                  segments={sequenceClips.map(({ segment, clip }) => ({
                    instanceId: segment.instanceId,
                    videoUrl: clip.path,
                    label: `${clipProviderLabel(clip.fileName)} · ${clip.fileName}`,
                    qualityLabel: clipQualityById[clip.id] ?? "…",
                    durationSec: segment.durationSec,
                    trimStartSec: segment.trimStartSec,
                    trimEndSec: segment.trimEndSec,
                    muted: segment.muted === true || stripAudio,
                  }))}
                  audioTracks={timelineAudioTracks.map(({ track, asset }) => ({
                    instanceId: track.instanceId,
                    label: asset.fileName,
                    durationSec: track.durationSec,
                    trimStartSec: track.trimStartSec,
                    trimEndSec: track.trimEndSec,
                    startAtSec: track.startAtSec,
                  }))}
                  selectedId={selectedId}
                  playheadSegmentId={
                    sequenceClips[previewSegIndex]?.segment.instanceId ?? null
                  }
                  playheadSec={playheadSec}
                  blackPadSec={blackPadSec}
                  zoom={zoom}
                  pixelsPerSecond={pixelsPerSecond}
                  onZoomChange={setZoom}
                  onSelect={(instanceId) => {
                    const index = sequenceClips.findIndex(
                      (row) => row.segment.instanceId === instanceId,
                    );
                    const row = sequenceClips[index];
                    if (!row) return;
                    setSelectedId(instanceId);
                    setPreviewSegIndex(index);
                    setPreviewPlaying(false);
                    setBlackPadSec(0);
                    // Keep playhead if re-selecting same clip; otherwise jump to trim start.
                    if (instanceId !== selectedId) {
                      setPlayheadSec(row.segment.trimStartSec);
                    }
                  }}
                  onTrimChange={(instanceId, start, end) =>
                    updateTrim(instanceId, start, end)
                  }
                  onTrimGestureStart={pushUndoSnapshot}
                  onPlayheadChange={(instanceId, sec, compositionSec) => {
                    const index = sequenceClips.findIndex(
                      (row) => row.segment.instanceId === instanceId,
                    );
                    setPreviewSegIndex(index);
                    setPreviewPlaying(false);
                    const videoKept = videoCompositionSec;
                    if (
                      compositionSec != null &&
                      compositionSec > videoKept + 0.02
                    ) {
                      const last = sequenceClips[sequenceClips.length - 1];
                      if (last) {
                        setPlayheadSec(last.segment.trimEndSec);
                      } else {
                        setPlayheadSec(sec);
                      }
                      setBlackPadSec(compositionSec - videoKept);
                    } else {
                      setPlayheadSec(sec);
                      setBlackPadSec(0);
                    }
                    // Keep soundtrack selected while scrubbing so Split targets audio.
                    const audioStillSelected = audioTracksRef.current.some(
                      (track) => track.instanceId === selectedIdRef.current,
                    );
                    if (!audioStillSelected) {
                      setSelectedId(instanceId);
                    }
                  }}
                  onReorderGestureStart={pushUndoSnapshot}
                  onReorder={(instanceId, toIndex) => {
                    applyReorder(instanceId, toIndex);
                  }}
                  onAudioSelect={(instanceId) => {
                    setSelectedId(instanceId);
                    setPreviewPlaying(false);
                  }}
                  onAudioTrimChange={updateAudioTrim}
                  onAudioMove={updateAudioStartAt}
                  onAudioGestureStart={pushUndoSnapshot}
                />
              </div>
            )}
          </div>
        </div>

        <audio ref={previewAudioRef} preload="auto" className="hidden" />

        {activePreview ? (
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Live preview ·{" "}
              {inBlackPad
                ? `black pad · ${formatMergeTimelineTime(videoCompositionSec + blackPadSec)}`
                : `part ${previewSegIndex + 1} of ${sequenceClips.length} · ${formatMergeTimelineTime(playheadSec)}`}
              {timelineDurationSec > videoCompositionSec + 0.04
                ? ` · timeline ${formatMergeTimelineTime(timelineDurationSec)}`
                : ""}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              {!fullPreviewOpen ? (
                <div className="relative w-[11rem] overflow-hidden rounded-xl border bg-black ring-1 ring-border">
                  <video
                    ref={previewVideoRef}
                    muted={
                      stripAudio || activePreview.segment.muted === true
                    }
                    playsInline
                    controls={false}
                    preload="metadata"
                    onTimeUpdate={onPreviewTimeUpdate}
                    onEnded={() => {
                      if (previewPlayingRef.current) {
                        advanceToNextClip();
                      }
                    }}
                    className={cn(
                      "aspect-[9/16] w-full object-contain",
                      inBlackPad && "opacity-0",
                    )}
                  />
                  {inBlackPad ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Black pad
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex w-[11rem] aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-center text-[10px] text-muted-foreground">
                  Open in full preview
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading || merging}
                    onClick={togglePreviewPlayback}
                  >
                    {previewPlaying ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {previewPlaying ? "Pause" : "Play sequence"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading || merging}
                    onClick={() => setFullPreviewOpen(true)}
                  >
                    <Maximize2 className="size-3.5" />
                    Full preview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={previewSegIndex <= 0 || merging}
                    onClick={() => {
                      const prev = sequenceClips[previewSegIndex - 1]!;
                      seekPreviewTo(
                        previewSegIndex - 1,
                        prev.segment.trimStartSec,
                      );
                      setPreviewPlaying(false);
                    }}
                  >
                    Prev clip
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      previewSegIndex >= sequenceClips.length - 1 || merging
                    }
                    onClick={() => {
                      const next = sequenceClips[previewSegIndex + 1]!;
                      seekPreviewTo(
                        previewSegIndex + 1,
                        next.segment.trimStartSec,
                      );
                      setPreviewPlaying(false);
                    }}
                  >
                    Next clip
                  </Button>
                </div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Full preview shows source clips at native resolution in a 9:16
                  frame (same framing as export). Play runs the whole sequence.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {fullPreviewOpen && activePreview ? (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/92"
            role="dialog"
            aria-modal="true"
            aria-label="Full resolution merge preview"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-zinc-100">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Full preview · 9:16 ·{" "}
                  {inBlackPad
                    ? "black pad"
                    : `part ${previewSegIndex + 1} of ${sequenceClips.length}`}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {inBlackPad
                    ? formatMergeTimelineTime(videoCompositionSec + blackPadSec)
                    : `${activePreview.clip.fileName} · ${formatMergeTimelineTime(playheadSec)}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={togglePreviewPlayback}
                >
                  {previewPlaying ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  {previewPlaying ? "Pause" : "Play"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={previewSegIndex <= 0}
                  onClick={() => {
                    const prev = sequenceClips[previewSegIndex - 1]!;
                    seekPreviewTo(
                      previewSegIndex - 1,
                      prev.segment.trimStartSec,
                    );
                  }}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={previewSegIndex >= sequenceClips.length - 1}
                  onClick={() => {
                    const next = sequenceClips[previewSegIndex + 1]!;
                    seekPreviewTo(
                      previewSegIndex + 1,
                      next.segment.trimStartSec,
                    );
                  }}
                >
                  Next
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setFullPreviewOpen(false)}
                >
                  <Minimize2 className="size-3.5" />
                  Compact
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-zinc-100 hover:bg-white/10 hover:text-white"
                  aria-label="Close full preview"
                  onClick={() => setFullPreviewOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              <div className="relative h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/15 aspect-[9/16]">
                <video
                  ref={previewVideoRef}
                  muted={
                    stripAudio ||
                    (activePreview?.segment.muted === true)
                  }
                  playsInline
                  controls={false}
                  preload="metadata"
                  onTimeUpdate={onPreviewTimeUpdate}
                  onEnded={() => {
                    if (previewPlayingRef.current) {
                      advanceToNextClip();
                    }
                  }}
                  className={cn(
                    "h-full w-full object-contain",
                    inBlackPad && "opacity-0",
                  )}
                />
                {inBlackPad ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Black pad
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="gap-1.5"
            disabled={merging || uploading || sequenceClips.length < 2}
            onClick={() => void generateMerge()}
          >
            {merging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
            {merging ? "Merging…" : "Generate merge"}
          </Button>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="merger-export-quality"
              className="text-sm font-normal text-muted-foreground"
            >
              Export
            </Label>
            <Select
              value={exportQuality}
              onValueChange={(value) =>
                setExportQuality(parseMergeExportQuality(value))
              }
              disabled={merging || uploading}
            >
              <SelectTrigger
                id="merger-export-quality"
                size="sm"
                className="w-[9.5rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MERGE_EXPORT_QUALITIES.map((quality) => (
                  <SelectItem key={quality} value={quality}>
                    {MERGE_EXPORT_QUALITY_SIZES[quality].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="merger-strip-audio"
              checked={stripAudio}
              disabled={merging || uploading}
              onCheckedChange={setStripAudio}
            />
            <Label
              htmlFor="merger-strip-audio"
              className="text-sm font-normal text-muted-foreground"
            >
              Mute all clip audio
            </Label>
          </div>
          {sequenceClips.length > 0 || audioTracks.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={merging || uploading || uploadingAudio}
              onClick={() => {
                pushUndoSnapshot();
                setSegments([]);
                setAudioTracks([]);
                setSelectedId(null);
                setPreviewPlaying(false);
              }}
            >
              <Trash2 className="size-3.5" />
              Clear timeline
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Needs at least two clips. Output is 9:16{" "}
            {MERGE_EXPORT_QUALITY_SIZES[exportQuality].label}, saved as the next
            version
            {audioTracks.length > 0
              ? " · soundtrack overlays clip audio"
              : stripAudio
                ? " · no clip audio"
                : ""}
            {segments.some((segment) => segment.muted) && !stripAudio
              ? " · some clips muted"
              : ""}
            .
          </p>
        </div>

        {savedMerges.length > 0 ? (
          <div className="grid gap-2 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Saved merges ({savedMerges.length})
            </p>
            <ul className="grid gap-2">
              {savedMerges.map((asset) => (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/80 p-2"
                >
                  <video
                    src={asset.path}
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] h-28 w-auto rounded-md bg-black object-cover ring-1 ring-border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      Version {asset.label ?? "—"} · {asset.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(asset.bytes / (1024 * 1024)).toFixed(2)}MB
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenClip(asset)}
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={
                        <a
                          href={asset.path}
                          download={asset.fileName}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
