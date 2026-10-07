import type { SpotifyTrackItem, UnifiedPlaylist } from '../types';
import { fetchPublicSpotifyPlaylist } from './api';

const PKCE_VERIFIER_KEY = 's2ym_spotify_pkce_verifier';
const CLIENT_ID_KEY = 's2ym_spotify_client_id';
const ACCESS_TOKEN_KEY = 's2ym_spotify_access_token';
const TOKEN_EXPIRY_KEY = 's2ym_spotify_token_expiry';
const USER_PROFILE_KEY = 's2ym_spotify_user_profile';

export interface SpotifyUserProfile {
  id: string;
  displayName: string;
}

export function getCurrentRedirectUri(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000/';
  return `${window.location.origin}${window.location.pathname}`;
}

export function getSavedSpotifyClientId(): string {
  try {
    return sessionStorage.getItem(CLIENT_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSpotifyClientId(clientId: string): void {
  try {
    sessionStorage.setItem(CLIENT_ID_KEY, clientId.trim());
  } catch {
    // Ignore
  }
}

export function getSavedSpotifyToken(): string | null {
  try {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const expiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
    if (token && expiry > Date.now()) {
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export function getSavedSpotifyProfile(): SpotifyUserProfile | null {
  try {
    const raw = sessionStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SpotifyUserProfile;
  } catch {
    return null;
  }
}

export function clearSpotifySession(): void {
  try {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(USER_PROFILE_KEY);
  } catch {
    // Ignore
  }
}

function generateRandomVerifier(length = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

export async function startSpotifyPkceLogin(clientId: string): Promise<void> {
  const cleanedId = clientId.trim();
  if (!cleanedId) {
    throw new Error('Ingresa un Client ID de Spotify válido antes de iniciar sesión.');
  }

  saveSpotifyClientId(cleanedId);
  const verifier = generateRandomVerifier(64);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const challenge = await createCodeChallenge(verifier);
  const redirectUri = getCurrentRedirectUri();
  const scope = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: cleanedId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope,
  });

  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

export async function exchangeSpotifyPkceCodeIfPresent(): Promise<{
  exchanged: boolean;
  accessToken?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') return { exchanged: false };
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    url.searchParams.delete('error');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.pathname + url.search);
    return {
      exchanged: false,
      error: `Autorización de Spotify cancelada o denegada (${errorParam}).`,
    };
  }

  if (!code) {
    return { exchanged: false };
  }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const clientId = getSavedSpotifyClientId();

  // Clean code from URL immediately so reload doesn't re-submit it
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, document.title, url.pathname + url.search);

  if (!verifier || !clientId) {
    return {
      exchanged: false,
      error:
        'No se encontró el verificador PKCE o Client ID en esta pestaña. Inicia el flujo nuevamente.',
    };
  }

  const redirectUri = getCurrentRedirectUri();
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    let detail = 'Error al intercambiar el código PKCE con Spotify.';
    try {
      const errJson = await res.json();
      if (errJson?.error_description) detail = errJson.error_description;
    } catch {
      // Ignore
    }
    return { exchanged: false, error: detail };
  }

  const tokenData = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokenData.access_token);
  sessionStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + (tokenData.expires_in || 3600) * 1000)
  );

  return { exchanged: true, accessToken: tokenData.access_token };
}

function mapSpotifyRawTrack(rawTrack: unknown, index: number): SpotifyTrackItem | null {
  if (!rawTrack || typeof rawTrack !== 'object') return null;
  const trackObj = rawTrack as Record<string, unknown>;
  const name = typeof trackObj.name === 'string' ? trackObj.name.trim() : '';
  if (!name) return null;

  const artistsRaw = Array.isArray(trackObj.artists) ? trackObj.artists : [];
  const artistNames = artistsRaw
    .map((a) => (a && typeof a === 'object' ? (a as { name?: string }).name : ''))
    .filter((n): n is string => Boolean(n && n.trim()));

  const artist = artistNames.length > 0 ? artistNames.join(', ') : 'Artista desconocido';
  const id =
    typeof trackObj.id === 'string' && trackObj.id
      ? trackObj.id
      : `sp-track-${index}-${name.slice(0, 12)}`;
  const duration_ms =
    typeof trackObj.duration_ms === 'number' ? trackObj.duration_ms : 0;

  return {
    id,
    artist,
    name,
    query: `${artist} - ${name}`,
    duration_ms,
  };
}

export async function fetchSpotifyUserProfile(
  accessToken: string
): Promise<SpotifyUserProfile> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener el perfil de Spotify (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { id?: string; display_name?: string };
  const profile: SpotifyUserProfile = {
    id: data.id || 'spotify-user',
    displayName: data.display_name || data.id || 'Usuario de Spotify',
  };
  try {
    sessionStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore
  }
  return profile;
}

export async function fetchSpotifyLikedSongs(
  accessToken: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<UnifiedPlaylist> {
  const tracks: SpotifyTrackItem[] = [];
  let nextUrl: string | null = 'https://api.spotify.com/v1/me/tracks?limit=50';
  let total = 0;
  let pagesFetched = 0;

  while (nextUrl && pagesFetched < 30) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      break;
    }
    const page = (await res.json()) as {
      total?: number;
      next?: string | null;
      items?: Array<{ track?: unknown }>;
    };
    if (typeof page.total === 'number') {
      total = page.total;
    }
    const items = Array.isArray(page.items) ? page.items : [];
    for (const item of items) {
      const mapped = mapSpotifyRawTrack(item?.track, tracks.length);
      if (mapped) tracks.push(mapped);
    }
    onProgress?.(tracks.length, total || tracks.length);
    nextUrl = page.next || null;
    pagesFetched += 1;
  }

  return {
    id: 'liked-songs-spotify',
    name: 'Liked Songs from Spotify',
    owner: 'Tu biblioteca personal',
    coverUrl: null,
    totalTracks: total || tracks.length,
    tracks,
    tracksLoaded: true,
    isLikedSongs: true,
    sourceMode: 'pkce-oauth',
  };
}

export async function fetchSpotifyUserPlaylistsList(
  accessToken: string
): Promise<UnifiedPlaylist[]> {
  const playlists: UnifiedPlaylist[] = [];
  let nextUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
  let pages = 0;

  while (nextUrl && pages < 10) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Error al listar playlists de Spotify (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as {
      next?: string | null;
      items?: Array<{
        id?: string;
        name?: string;
        owner?: { display_name?: string; id?: string };
        images?: Array<{ url?: string }>;
        tracks?: { total?: number };
      }>;
    };

    const items = Array.isArray(data.items) ? data.items : [];
    for (const raw of items) {
      if (!raw || !raw.id) continue;
      playlists.push({
        id: raw.id,
        name: (raw.name || '').trim() || 'Playlist sin título',
        owner: raw.owner?.display_name || raw.owner?.id || 'Spotify',
        coverUrl: raw.images?.[0]?.url || null,
        totalTracks: raw.tracks?.total ?? 0,
        tracks: [],
        tracksLoaded: false,
        sourceMode: 'pkce-oauth',
      });
    }

    nextUrl = data.next || null;
    pages += 1;
  }

  return playlists;
}

export async function loadTracksForSpotifyPlaylist(
  playlist: UnifiedPlaylist,
  accessToken: string
): Promise<{
  tracks: SpotifyTrackItem[];
  isPartialEmbed: boolean;
  usedPublicFallback: boolean;
}> {
  if (playlist.tracksLoaded && playlist.tracks.length > 0) {
    return {
      tracks: playlist.tracks,
      isPartialEmbed: Boolean(playlist.isPartialEmbed),
      usedPublicFallback: false,
    };
  }

  const tracks: SpotifyTrackItem[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
    playlist.id
  )}/tracks?limit=100`;
  let pages = 0;

  while (nextUrl && pages < 20) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Fallback to backend public embed extractor if Spotify returns 403 Forbidden or 404 on algorithmic/followed playlists
    if (res.status === 403 || res.status === 404) {
      const fallback = await fetchPublicSpotifyPlaylist(playlist.id, accessToken);
      return {
        tracks: fallback.tracks,
        isPartialEmbed: fallback.is_partial_embed,
        usedPublicFallback: true,
      };
    }

    if (!res.ok) {
      throw new Error(`No se pudieron cargar las pistas de "${playlist.name}" (HTTP ${res.status}).`);
    }

    const page = (await res.json()) as {
      next?: string | null;
      items?: Array<{ track?: unknown }>;
    };

    const items = Array.isArray(page.items) ? page.items : [];
    for (const item of items) {
      const mapped = mapSpotifyRawTrack(item?.track, tracks.length);
      if (mapped) tracks.push(mapped);
    }

    nextUrl = page.next || null;
    pages += 1;
  }

  return {
    tracks,
    isPartialEmbed: false,
    usedPublicFallback: false,
  };
}
