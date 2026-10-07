"""Stateless Spotify playlist scraping and parsing service with strict SSRF protection."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

import requests

SPOTIFY_PLAYLIST_ID_RE = re.compile(r"^[a-zA-Z0-9]{22}$")
SPOTIFY_URI_RE = re.compile(r"^spotify:playlist:([a-zA-Z0-9]{22})$")
SPOTIFY_PATH_RE = re.compile(r"^(?:/intl-[a-zA-Z-]+)?(?:/embed)?/playlist/([a-zA-Z0-9]{22})(?:/.*)?$")
NEXT_DATA_RE = re.compile(
    r'<script\s+id="__NEXT_DATA__"\s+type="application/json"[^>]*>(.*?)</script>',
    re.DOTALL,
)

EMBED_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def extract_spotify_playlist_id(url_or_id: str) -> str:
    """Extract and strictly validate a 22-character base62 Spotify playlist ID.

    Accepts:
    - https://open.spotify.com/playlist/1shiB0V7nNcpDaPXYdF4Jf?si=...
    - https://open.spotify.com/intl-es/playlist/1shiB0V7nNcpDaPXYdF4Jf
    - https://open.spotify.com/embed/playlist/1shiB0V7nNcpDaPXYdF4Jf
    - spotify:playlist:1shiB0V7nNcpDaPXYdF4Jf
    - 1shiB0V7nNcpDaPXYdF4Jf

    Raises ValueError on any invalid input, non-Spotify host, or path traversal attempt.
    """
    if not url_or_id or not isinstance(url_or_id, str):
        raise ValueError("Spotify playlist URL or ID is required.")

    candidate = url_or_id.strip()

    # 1. Raw 22-char base62 ID
    if SPOTIFY_PLAYLIST_ID_RE.match(candidate):
        return candidate

    # 2. Spotify URI: spotify:playlist:<22-char-id>
    uri_match = SPOTIFY_URI_RE.match(candidate)
    if uri_match:
        return uri_match.group(1)

    # 3. Full URL: strictly validate scheme and hostname to prevent SSRF
    try:
        parsed = urlparse(candidate)
    except Exception as exc:
        raise ValueError("Malformed Spotify URL.") from exc

    if parsed.scheme not in ("https", "http"):
        raise ValueError("Invalid URL scheme. Expected https://open.spotify.com/playlist/...")

    if (parsed.hostname or "").lower() != "open.spotify.com":
        raise ValueError("Invalid hostname. Only 'open.spotify.com' playlist URLs are allowed.")

    # Reject any path traversal sequences
    if ".." in parsed.path or "\\" in parsed.path:
        raise ValueError("Invalid path in Spotify URL.")

    path_match = SPOTIFY_PATH_RE.match(parsed.path)
    if not path_match:
        raise ValueError(
            "Could not extract a valid 22-character Spotify playlist ID from URL. "
            "Expected format: https://open.spotify.com/playlist/<22-char-id>"
        )

    playlist_id = path_match.group(1)
    if not SPOTIFY_PLAYLIST_ID_RE.match(playlist_id):
        raise ValueError("Invalid 22-character base62 Spotify playlist ID.")

    return playlist_id


def fetch_public_spotify_playlist(url_or_id: str, access_token: str | None = None) -> dict[str, Any]:
    """Fetch a public Spotify playlist without requiring user Spotify API keys.

    Uses the zero-key `https://open.spotify.com/embed/playlist/{playlist_id}` endpoint
    (or optional Bearer access_token if provided for >100 track pagination).
    """
    playlist_id = extract_spotify_playlist_id(url_or_id)

    # Optional: If user provided a Spotify Bearer token, fetch full paginated tracks via Web API
    if access_token and access_token.strip():
        token_clean = access_token.strip()
        if token_clean.lower().startswith("bearer "):
            token_clean = token_clean[7:].strip()
        try:
            return _fetch_via_spotify_web_api(playlist_id, token_clean)
        except Exception:
            # Fall back to zero-key embed scraper if token fails
            pass

    embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
    headers = {
        "User-Agent": EMBED_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(embed_url, headers=headers, timeout=12, allow_redirects=False)
    except requests.RequestException as exc:
        raise RuntimeError(f"Failed to connect to Spotify embed endpoint: {exc}") from exc

    if resp.status_code == 404:
        raise LookupError(
            f"Spotify playlist '{playlist_id}' was not found or is set to Private. "
            "Make sure the playlist is Public on Spotify."
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Spotify embed endpoint returned HTTP {resp.status_code}.")

    match = NEXT_DATA_RE.search(resp.text)
    if not match:
        raise RuntimeError("Could not locate __NEXT_DATA__ payload in Spotify embed page.")

    try:
        data = json.loads(match.group(1))
    except Exception as exc:
        raise RuntimeError("Failed to parse Spotify embed JSON payload.") from exc

    entity = (
        data.get("props", {})
        .get("pageProps", {})
        .get("state", {})
        .get("data", {})
        .get("entity", {})
    )
    if not isinstance(entity, dict) or not entity:
        raise LookupError(
            f"Spotify playlist '{playlist_id}' returned no data. Verify that the playlist is Public."
        )

    playlist_name = (
        str(entity.get("name") or entity.get("title") or f"Spotify Playlist {playlist_id}").strip()
    )
    owner = str(entity.get("subtitle") or "Spotify").strip().replace("\xa0", " ")

    cover_url: str | None = None
    cover_sources = entity.get("coverArt", {}).get("sources", [])
    if isinstance(cover_sources, list) and cover_sources:
        first_src = cover_sources[0]
        if isinstance(first_src, dict) and isinstance(first_src.get("url"), str):
            cover_url = first_src["url"]
    if not cover_url:
        vis_images = entity.get("visualIdentity", {}).get("image", [])
        if isinstance(vis_images, list) and vis_images:
            first_img = vis_images[0]
            if isinstance(first_img, dict) and isinstance(first_img.get("url"), str):
                cover_url = first_img["url"]

    raw_track_list = entity.get("trackList", [])
    if not isinstance(raw_track_list, list):
        raw_track_list = []

    tracks: list[dict[str, Any]] = []
    for idx, t in enumerate(raw_track_list):
        if not isinstance(t, dict):
            continue
        title = str(t.get("title", "")).strip()
        subtitle = str(t.get("subtitle", "")).strip().replace("\xa0", " ")
        if not title:
            continue

        uri = str(t.get("uri", ""))
        track_id = uri.split(":")[-1] if ":" in uri else f"track_{idx + 1}"
        duration_raw = t.get("duration", 0)
        try:
            duration_ms = int(duration_raw) if duration_raw is not None else 0
        except (ValueError, TypeError):
            duration_ms = 0

        artist = subtitle or "Unknown Artist"
        query = f"{artist} - {title}" if subtitle else title

        tracks.append(
            {
                "id": track_id,
                "artist": artist,
                "name": title,
                "query": query,
                "duration_ms": duration_ms,
            }
        )

    if not tracks:
        raise LookupError(
            f"No tracks found in Spotify playlist '{playlist_name}'. "
            "Ensure the playlist is Public and contains at least one track."
        )

    return {
        "playlist_id": playlist_id,
        "name": playlist_name,
        "owner": owner,
        "cover_url": cover_url,
        "total_tracks": len(tracks),
        "tracks": tracks,
        "is_partial_embed": len(tracks) >= 100,
    }


def _fetch_via_spotify_web_api(playlist_id: str, bearer_token: str) -> dict[str, Any]:
    """Fetch full playlist metadata and paginated tracks via official Spotify Web API using an in-memory Bearer token."""
    headers = {"Authorization": f"Bearer {bearer_token}"}
    meta_url = f"https://api.spotify.com/v1/playlists/{playlist_id}?fields=id,name,owner(display_name),images,tracks(total)"
    meta_resp = requests.get(meta_url, headers=headers, timeout=10)
    if meta_resp.status_code != 200:
        raise RuntimeError(f"Spotify Web API returned HTTP {meta_resp.status_code}")

    meta = meta_resp.json()
    playlist_name = str(meta.get("name") or f"Spotify Playlist {playlist_id}").strip()
    owner = str((meta.get("owner") or {}).get("display_name") or "Spotify").strip()
    images = meta.get("images") or []
    cover_url = images[0].get("url") if isinstance(images, list) and images and isinstance(images[0], dict) else None

    tracks: list[dict[str, Any]] = []
    next_url: str | None = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit=100"

    while next_url:
        page_resp = requests.get(next_url, headers=headers, timeout=10)
        if page_resp.status_code != 200:
            break
        page_data = page_resp.json()
        for idx, item in enumerate(page_data.get("items") or []):
            if not isinstance(item, dict):
                continue
            track_obj = item.get("track") or item.get("item")
            if not isinstance(track_obj, dict):
                continue
            title = str(track_obj.get("name") or "").strip()
            if not title:
                continue
            artists = [
                str(a.get("name", "")).strip()
                for a in (track_obj.get("artists") or [])
                if isinstance(a, dict) and a.get("name")
            ]
            artist_str = ", ".join(artists) if artists else "Unknown Artist"
            track_id = str(track_obj.get("id") or f"track_{len(tracks) + 1}")
            duration_ms = int(track_obj.get("duration_ms") or 0)
            tracks.append(
                {
                    "id": track_id,
                    "artist": artist_str,
                    "name": title,
                    "query": f"{artist_str} - {title}",
                    "duration_ms": duration_ms,
                }
            )
        candidate_next = page_data.get("next")
        if isinstance(candidate_next, str) and candidate_next.startswith("https://api.spotify.com/"):
            next_url = candidate_next
        else:
            next_url = None

    if not tracks:
        raise LookupError("No tracks returned from Spotify Web API.")

    return {
        "playlist_id": playlist_id,
        "name": playlist_name,
        "owner": owner,
        "cover_url": cover_url,
        "total_tracks": len(tracks),
        "tracks": tracks,
        "is_partial_embed": False,
    }
