export interface HealthResponse {
  status: string;
  mode: string;
  version: string;
}

export interface YTMDiagnostics {
  has_cookie: boolean;
  has_sapisid: boolean;
  has_authorization: boolean;
  browser_detected: string;
}

export interface YTMPlaylistSummary {
  playlistId: string;
  title: string;
  count?: number | string;
  thumbnails: Array<{ url?: string; width?: number; height?: number }>;
}

export interface YTMValidateResponse {
  valid: boolean;
  diagnostics: YTMDiagnostics;
  sanitized_headers: Record<string, string>;
  playlist_count: number;
  playlists: YTMPlaylistSummary[];
  error_code?: string | null;
  message?: string | null;
}

export interface YTMPreparePlaylistResponse {
  ytm_playlist_id: string;
  created_new: boolean;
  existing_video_ids: string[];
  existing_count: number;
}

export type TrackTransferStatus = 'added' | 'already_present' | 'not_found' | 'error';

export interface TrackTransferResult {
  query: string;
  status: TrackTransferStatus;
  video_id?: string | null;
  matched_title?: string | null;
  matched_artist?: string | null;
  message: string;
}

export interface YTMTransferBatchResponse {
  results: TrackTransferResult[];
  added_count: number;
  skipped_count: number;
  not_found_count: number;
  auth_expired: boolean;
}

export interface SpotifyTrackItem {
  id: string;
  artist: string;
  name: string;
  query: string;
  duration_ms: number;
}

export interface SpotifyPublicPlaylistResponse {
  playlist_id: string;
  name: string;
  owner: string;
  cover_url?: string | null;
  total_tracks: number;
  tracks: SpotifyTrackItem[];
  is_partial_embed: boolean;
}

export interface UnifiedPlaylist {
  id: string;
  name: string;
  owner: string;
  coverUrl?: string | null;
  totalTracks: number;
  tracks: SpotifyTrackItem[];
  tracksLoaded: boolean;
  isPartialEmbed?: boolean;
  isLikedSongs?: boolean;
  sourceMode: 'public-link' | 'pkce-oauth' | 'audit-fixture';
}

export interface MigrationLogEntry extends TrackTransferResult {
  playlistId: string;
  playlistName: string;
  batchIndex: number;
  timestamp: string;
}

export interface PausedMigrationState {
  playlistIds: string[];
  currentPlaylistIdx: number;
  currentBatchStartIndex: number;
  ytmPlaylistId: string;
  existingVideoIds: string[];
  reason: string;
}

export type AuditDatasetMode = 'live' | 'demo' | 'worst' | 'empty' | 'one' | 'huge';

export type BrowserKind = 'Safari' | 'Chrome' | 'Firefox' | 'Edge';
