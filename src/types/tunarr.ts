// ─── Core ID / Type Helpers ────────────────────────────────────────────────────

export type UUID = string;

export type Nullable<T> = T | null;

// ─── TerminalProgram ──────────────────────────────────────────────────────────

export interface ProgramIdentifier {
  id: string;
  type: "plex" | "plex-guid" | "imdb" | "tmdb" | "tvdb" | "jellyfin" | "emby";
  sourceId?: string;
}

export interface PersonInfo {
  uuid: UUID;
  name: string;
  externalInfo?: Nullable<{ source: MediaSourceType; id: string }>;
  thumb?: Nullable<string>;
}

export type MediaSourceType = "plex" | "jellyfin" | "emby" | "local";

export interface ArtworkItem {
  id: UUID;
  type:
    | "poster"
    | "thumbnail"
    | "logo"
    | "fanart"
    | "watermark"
    | "banner"
    | "landscape";
  path?: Nullable<string>;
}

export interface StreamInfo {
  index: number;
  codec: string;
  streamType:
    | "video"
    | "audio"
    | "subtitles"
    | "attachment"
    | "external_subtitles";
  profile?: Nullable<string>;
  title?: Nullable<string>;
  mimeType?: Nullable<string>;
  frameRate?: Nullable<number | string>;
  pixelFormat?: Nullable<string>;
  bitDepth?: Nullable<number>;
  channels?: Nullable<number>;
  languageCodeISO6392?: Nullable<string>;
  selected?: Nullable<boolean>;
  default?: Nullable<boolean>;
  forced?: Nullable<boolean>;
}

export interface MediaLocation {
  path: string;
  type: "local" | "remote";
  sourceType?: MediaSourceType;
  externalKey?: string;
}

export interface MediaItemInfo {
  streams: StreamInfo[];
  duration: number;
  locations: MediaLocation[];
  sampleAspectRatio?: Nullable<string>;
  displayAspectRatio?: Nullable<string>;
  frameRate?: Nullable<number | string>;
  resolution?: Nullable<{ widthPx: number; heightPx: number }>;
  chapters?: Nullable<ChapterInfo[]>;
  scanKind?: Nullable<"unknown" | "progressive" | "interlaced">;
  externalKey?: Nullable<string>;
}

export interface ChapterInfo {
  index: number;
  startTime: number;
  endTime: number;
  title?: Nullable<string>;
  chapterType?: "chapter" | "intro" | "outro";
}

export interface ExternalSubtitle {
  subtitleType: "embedded" | "sidecar";
  codec: string;
  language: string;
  title?: Nullable<string>;
  streamIndex?: Nullable<number>;
  default?: Nullable<boolean>;
  forced?: Nullable<boolean>;
  sdh?: Nullable<boolean>;
  path?: Nullable<string>;
}

export interface TerminalProgram {
  uuid: UUID;
  sourceType: MediaSourceType;
  type: "movie" | "music_video";
  identifiers: ProgramIdentifier[];
  title: string;
  sortTitle: string;
  tags: string[];
  originalTitle: Nullable<string>;
  year?: Nullable<number>;
  releaseDate: number; // epoch timestamp
  releaseDateString?: Nullable<string>;
  actors?: PersonInfo[];
  writers?: PersonInfo[];
  directors?: PersonInfo[];
  genres?: { uuid: UUID; name: string; externalInfo?: Nullable<{ source: MediaSourceType; id: string }> }[];
  studios?: { uuid: UUID; name: string; externalInfo?: Nullable<{ source: MediaSourceType; id: string }> }[];
  artwork: ArtworkItem[];
  state: "ok" | "missing";
  mediaSourceId: string;
  libraryId: string;
  canonicalId: string;
  externalId: string;
  mediaItem?: MediaItemInfo;
  duration: number;
}

// ─── Channel ──────────────────────────────────────────────────────────────────

export interface IconConfig {
  path: string;
  width: number;
  duration: number;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface FillerCollectionRef {
  id: string;
  weight: number;
  cooldownSeconds: number;
}

export interface Channel {
  id?: string;
  uuid?: UUID;
  name: string;
  type: string;
  duration?: number;
  groupTitle?: string;
  guideFlexTitle?: string;
  guideMinimumDuration?: number;
  icon?: IconConfig;
  disableFillerOverlay?: boolean;
  fillerCollections?: FillerCollectionRef[];
  fillerRepeatCooldown?: number;
  fallback?: Record<string, any>; // complex nested structure
  [key: string]: unknown;
}

// ─── MediaSource ──────────────────────────────────────────────────────────────

export interface PathReplacement {
  serverPath: string;
  localPath: string;
}

export interface LibraryInfo {
  id: UUID;
  name: string;
  type?: string;
  [key: string]: unknown;
}

export interface MediaSource {
  id: string;
  name: string;
  uri: string;
  accessToken?: string;
  userId?: Nullable<string>;
  username?: Nullable<string>;
  libraries?: LibraryInfo[];
  pathReplacements?: PathReplacement[];
  type?: "plex";
  sendGuideUpdates?: boolean;
  index?: number;
  clientIdentifier?: string;
}

// ─── SmartCollection ──────────────────────────────────────────────────────────

export interface SmartCollection {
  uuid: UUID;
  name: string;
  keywords: string;
  filter?: SearchFilter;
  filterString?: string;
}

export type FilterOp = "or" | "and";
export type FilterType = "op" | "value";

export interface SearchFilter {
  type: FilterType;
  op?: FilterOp;
  grouped?: boolean;
  children?: SearchFilter[];
  fieldSpec?: any;
  comparisonOperator?: string;
  value?: any;
}

// ─── GuideStatus ──────────────────────────────────────────────────────────────

export interface GuideStatus {
  [key: string]: unknown;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionType =
  | "hls"
  | "hls_slower"
  | "mpegts"
  | "hls_direct"
  | "hls_direct_v2"
  | "hls_concat"
  | "hls_slower_concat"
  | "mpegts_concat"
  | "hls_direct_concat"
  | "hls_direct_v2_concat";

export interface SessionConnection {
  ip: string;
  [key: string]: unknown;
}

export interface SessionInfo {
  type: SessionType;
  state: string;
  numConnections: number;
  connections: SessionConnection[];
}

// Sessions response is keyed by channel ID
export type SessionsMap = Record<string, SessionInfo[]>;

// ─── TranscodeConfig ──────────────────────────────────────────────────────────

export type HardwareAccelMode = "none" | "cuda" | "vaapi" | "qsv" | "videotoolbox";
export type VaapiDriver = "system" | "ihd" | "i965" | "radeonsi" | "nouveau";
export type VideoFormat = "h264" | "hevc" | "mpeg2video";

export interface TranscodeConfig {
  id: string;
  name: string;
  threadCount?: number;
  hardwareAccelerationMode?: HardwareAccelMode;
  vaapiDriver?: VaapiDriver;
  vaapiDevice?: Nullable<string>;
  resolution?: { widthPx: number; heightPx: number };
  videoFormat?: VideoFormat;
  videoProfile?: Nullable<string>;
  videoPreset?: Nullable<string>;
  audioFormat?: string;
  audioCodec?: string;
  audioBitrate?: number;
  maxAudioChannels?: number;
  [key: string]: unknown;
}

// ─── Version / System Health ──────────────────────────────────────────────────

export interface VersionInfo {
  tunarr: string;
  ffmpeg: string;
  nodejs: string;
}

export type HealthType = "healthy" | "info" | "warning" | "error";

export interface HealthEntry {
  type: HealthType;
  context?: string;
}

export interface SystemHealth {
  [key: string]: HealthEntry;
}

// ─── FFMPEG Info ──────────────────────────────────────────────────────────────

export interface EncoderInfo {
  name: string;
  ffmpegName: string;
}

export interface FfmpegInfo {
  audioEncoders?: EncoderInfo[];
  videoEncoders?: EncoderInfo[];
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type SchedulePeriod = "day" | "week";
export type FlexPreference = "distribute" | "end";

export interface ChannelSchedule {
  schedule?: {
    type: "time";
    flexPreference?: FlexPreference;
    latenessMs?: number;
    maxDays?: number;
    padMs?: number;
    period?: SchedulePeriod;
    slots?: any[];
  };
}

// ─── Settings Types ───────────────────────────────────────────────────────────

export type SettingType =
  | "ffmpeg"
  | "plex"
  | "xmltv"
  | "hdhr"
  | "system"
  | "feature-flags";

// ─── Lineup Item (for /api/channels/all/lineups) ──────────────────────────────

export interface LineupItem {
  icon?: IconConfig;
  [key: string]: unknown;
}
