"""Stateless YouTube Music service with thread-safe in-memory LRU search cache.

Zero-Disk-Storage:
- Never writes `browser.json`, `raw_headers.txt`, `song_cache.json`, or `progress_*.json`.
- Constructs `YTMusic` instances per request in memory and discards them after the request.
"""

from __future__ import annotations

from collections import OrderedDict
import re
import threading
import time
from typing import Any

from ytmusicapi import YTMusic

from webapp.backend.services.curl_parser import (
    DEFAULT_USER_AGENT,
    YTM_ORIGIN,
    _ensure_ytmusicapi_cookie_compatibility,
    compute_sapisidhash,
    extract_sapisid_from_cookie_str,
)

SENSITIVE_PATTERNS = re.compile(
    r"("
    r"SAPISIDHASH\s+[^\s\"',;]+"
    r"|Bearer\s+[^\s\"',;]+"
    r"|(?:__Secure-[13]P(?:APISID|SID|SIDTS|SIDCC)|SAPISID|APISID|SSID|HSID|SID|LOGIN_INFO)=[^;\s\"']+"
    r"|cookie\s*[:=]\s*[^\r\n\"']+"
    r")",
    re.IGNORECASE,
)


def sanitize_error_message(exc: Exception | str) -> str:
    """Remove any potential cookie or authorization tokens from error messages."""
    raw = str(exc)
    sanitized = SENSITIVE_PATTERNS.sub("[REDACTED]", raw)
    return sanitized[:500]


def is_auth_expired_error(exc: Exception | str) -> bool:
    """Detect 401/403 or unauthenticated errors from ytmusicapi or Google APIs."""
    msg = str(exc).lower()
    auth_indicators = (
        "401",
        "403",
        "unauthorized",
        "unauthenticated",
        "invalid authentication",
        "authentication credentials",
        "login required",
        "must be signed in",
        "missing the required value __secure-3papisid",
        "session expired",
    )
    return any(ind in msg for ind in auth_indicators)


class ThreadSafeLRUCache:
    """Thread-safe in-memory LRU cache for track_query -> YTM search match metadata."""

    def __init__(self, max_size: int = 5000) -> None:
        self.max_size = max_size
        self._cache: OrderedDict[str, dict[str, str | None] | None] = OrderedDict()
        self._lock = threading.Lock()

    def _normalize_key(self, query: str) -> str:
        return " ".join(query.strip().lower().split())

    def get(self, query: str) -> tuple[bool, dict[str, str | None] | None]:
        key = self._normalize_key(query)
        with self._lock:
            if key not in self._cache:
                return False, None
            self._cache.move_to_end(key)
            val = self._cache[key]
            return True, (val.copy() if isinstance(val, dict) else None)

    def put(self, query: str, value: dict[str, str | None] | None) -> None:
        key = self._normalize_key(query)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = value.copy() if isinstance(value, dict) else None
            while len(self._cache) > self.max_size:
                self._cache.popitem(last=False)

    def size(self) -> int:
        with self._lock:
            return len(self._cache)


# Global thread-safe in-memory search cache (contains only public song query -> videoId mappings, zero user data)
TRACK_SEARCH_CACHE = ThreadSafeLRUCache(max_size=5000)


def _prepare_in_memory_auth_dict(headers_dict: dict[str, Any]) -> dict[str, str]:
    """Normalize a headers dict so YTMusic(auth=...) always initializes as AuthType.BROWSER in memory."""
    if not isinstance(headers_dict, dict):
        raise ValueError("headers_dict must be a dictionary.")

    # Unwrap if caller passed the full result of parse_curl_or_headers()
    if "sanitized_headers" in headers_dict and isinstance(headers_dict["sanitized_headers"], dict):
        source = headers_dict["sanitized_headers"]
    elif "headers" in headers_dict and isinstance(headers_dict["headers"], dict):
        source = headers_dict["headers"]
    else:
        source = headers_dict

    lower_map: dict[str, str] = {
        str(k).strip().lower(): str(v).strip()
        for k, v in source.items()
        if isinstance(k, str) and isinstance(v, str)
    }

    cookie_raw = lower_map.get("cookie", "")
    if not cookie_raw:
        raise ValueError("Missing 'cookie' in YouTube Music headers.")

    sapisid = extract_sapisid_from_cookie_str(cookie_raw)
    if not sapisid:
        raise ValueError("Missing '__Secure-3PAPISID' or 'SAPISID' in cookie header.")

    normalized_cookie = _ensure_ytmusicapi_cookie_compatibility(cookie_raw, sapisid)
    raw_auth = lower_map.get("authorization", "")
    authorization = raw_auth if "SAPISIDHASH" in raw_auth else compute_sapisidhash(sapisid, YTM_ORIGIN)

    auth_headers: dict[str, str] = {
        "user-agent": lower_map.get("user-agent") or DEFAULT_USER_AGENT,
        "accept": lower_map.get("accept") or "*/*",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
        "content-encoding": "gzip",
        "origin": YTM_ORIGIN,
        "x-origin": YTM_ORIGIN,
        "x-goog-authuser": lower_map.get("x-goog-authuser") or "0",
        "cookie": normalized_cookie,
        "authorization": authorization,
    }

    if lower_map.get("x-goog-visitor-id"):
        auth_headers["x-goog-visitor-id"] = lower_map["x-goog-visitor-id"]
    if lower_map.get("accept-language"):
        auth_headers["accept-language"] = lower_map["accept-language"]

    return auth_headers


def create_ytm_client(headers_dict: dict[str, Any]) -> YTMusic:
    """Create a stateless, in-memory YTMusic client without touching disk."""
    auth_headers = _prepare_in_memory_auth_dict(headers_dict)
    return YTMusic(auth=auth_headers)


def _format_playlist_summary(p: dict[str, Any]) -> dict[str, Any]:
    """Normalize a ytmusicapi playlist item for frontend consumption."""
    raw_count = p.get("count", p.get("trackCount", 0))
    if isinstance(raw_count, str):
        digits = re.sub(r"[^\d]", "", raw_count)
        count_val: int | str = int(digits) if digits else raw_count
    elif isinstance(raw_count, int):
        count_val = raw_count
    else:
        count_val = 0

    return {
        "playlistId": str(p.get("playlistId", "")),
        "title": str(p.get("title", "Untitled Playlist")),
        "count": count_val,
        "thumbnails": p.get("thumbnails", []) if isinstance(p.get("thumbnails"), list) else [],
    }


def validate_ytm_session(headers_dict: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Verify YTMusic credentials against live YouTube Music library and return (playlists, updated_headers)."""
    auth_headers = _prepare_in_memory_auth_dict(headers_dict)
    ytm = YTMusic(auth=auth_headers)

    raw_playlists = ytm.get_library_playlists(limit=50)
    if raw_playlists is None:
        raise RuntimeError("YouTube Music returned an empty library response (session may be expired).")

    # Preserve visitor ID if ytmusicapi fetched one so subsequent requests skip the extra GET roundtrip
    visitor_id = ytm.base_headers.get("X-Goog-Visitor-Id") or ytm.base_headers.get("x-goog-visitor-id")
    if visitor_id and "x-goog-visitor-id" not in auth_headers:
        auth_headers["x-goog-visitor-id"] = str(visitor_id)

    formatted = [
        _format_playlist_summary(p)
        for p in raw_playlists
        if isinstance(p, dict) and p.get("playlistId")
    ]
    return formatted, auth_headers


def list_user_playlists(headers_dict: dict[str, Any]) -> list[dict[str, Any]]:
    """Fetch all playlists in the user's YouTube Music library."""
    ytm = create_ytm_client(headers_dict)
    raw_playlists = ytm.get_library_playlists(limit=None) or []
    return [
        _format_playlist_summary(p)
        for p in raw_playlists
        if isinstance(p, dict) and p.get("playlistId")
    ]


def get_ytm_playlist_video_ids(ytm: YTMusic, playlist_id: str) -> list[str]:
    """Fetch all existing videoIds in a YouTube Music playlist for deduplication."""
    video_ids: list[str] = []
    seen: set[str] = set()
    playlist_data = ytm.get_playlist(playlist_id, limit=10000)
    for track in (playlist_data or {}).get("tracks", []) or []:
        if isinstance(track, dict):
            vid = track.get("videoId")
            if vid and isinstance(vid, str) and vid not in seen:
                seen.add(vid)
                video_ids.append(vid)
    return video_ids


def create_or_get_ytm_playlist(
    headers_dict: dict[str, Any],
    playlist_name: str,
    description: str = "Copied from Spotify",
) -> dict[str, Any]:
    """Find an existing playlist by name or create a new one, returning existing videoIds."""
    ytm = create_ytm_client(headers_dict)
    target_title = playlist_name.strip()[:150]
    target_lower = target_title.lower()

    library_playlists = ytm.get_library_playlists(limit=None) or []
    existing_playlist_id: str | None = None

    for p in library_playlists:
        if not isinstance(p, dict):
            continue
        p_title = str(p.get("title", "")).strip().lower()
        p_id = p.get("playlistId")
        # Ignore YouTube Music's auto-generated 'LM' (Liked Music) pseudo-playlist unless explicitly matched
        if p_title == target_lower and p_id and p_id != "LM":
            existing_playlist_id = str(p_id)
            break

    if existing_playlist_id:
        existing_video_ids = get_ytm_playlist_video_ids(ytm, existing_playlist_id)
        return {
            "ytm_playlist_id": existing_playlist_id,
            "created_new": False,
            "existing_video_ids": existing_video_ids,
            "existing_count": len(existing_video_ids),
        }

    created_id = ytm.create_playlist(title=target_title, description=description.strip()[:500])
    if not created_id or not isinstance(created_id, str):
        raise RuntimeError(
            "Failed to create YouTube Music playlist. Your daily quota may be exhausted or session expired."
        )

    return {
        "ytm_playlist_id": created_id,
        "created_new": True,
        "existing_video_ids": [],
        "existing_count": 0,
    }


def search_track_with_client(ytm: YTMusic, track_query: str) -> dict[str, str | None] | None:
    """Search for a track on YouTube Music using the in-memory LRU cache and smart song/video fallback."""
    hit, cached_val = TRACK_SEARCH_CACHE.get(track_query)
    if hit:
        return cached_val

    # 1. Primary search with filter="songs" (mirrors copy_playlists.py)
    search_results = ytm.search(query=track_query, filter="songs", limit=5)

    # 2. Fallback to filter="videos" if no song match is found
    if not search_results:
        search_results = ytm.search(query=track_query, filter="videos", limit=5)

    if search_results and isinstance(search_results, list):
        for item in search_results:
            if isinstance(item, dict) and item.get("videoId"):
                video_id = str(item["videoId"])
                matched_title = str(item.get("title", "")).strip() or None
                artists_list = item.get("artists") or []
                if isinstance(artists_list, list) and artists_list:
                    matched_artist = ", ".join(
                        str(a.get("name", "")).strip()
                        for a in artists_list
                        if isinstance(a, dict) and a.get("name")
                    ) or None
                else:
                    matched_artist = None

                match_info: dict[str, str | None] = {
                    "video_id": video_id,
                    "matched_title": matched_title,
                    "matched_artist": matched_artist,
                }
                TRACK_SEARCH_CACHE.put(track_query, match_info)
                return match_info

    TRACK_SEARCH_CACHE.put(track_query, None)
    return None


def transfer_batch(
    headers_dict: dict[str, Any],
    ytm_playlist_id: str,
    tracks: list[str],
    existing_video_ids: list[str] | set[str] | None = None,
) -> dict[str, Any]:
    """Search and add a batch of tracks (up to 25) to a YouTube Music playlist."""
    ytm = create_ytm_client(headers_dict)
    existing_set: set[str] = set(existing_video_ids or [])

    results: list[dict[str, Any]] = []
    pending_add_indices: list[int] = []
    video_ids_to_add: list[str] = []

    added_count = 0
    skipped_count = 0
    not_found_count = 0
    auth_expired = False

    for idx, query in enumerate(tracks):
        if auth_expired:
            results.append(
                {
                    "query": query,
                    "status": "error",
                    "video_id": None,
                    "matched_title": None,
                    "matched_artist": None,
                    "message": "Skipped because YouTube Music session expired.",
                }
            )
            continue

        try:
            match_info = search_track_with_client(ytm, query)
        except Exception as exc:
            if is_auth_expired_error(exc):
                auth_expired = True
                results.append(
                    {
                        "query": query,
                        "status": "error",
                        "video_id": None,
                        "matched_title": None,
                        "matched_artist": None,
                        "message": "YouTube Music authentication expired during search.",
                    }
                )
                continue
            results.append(
                {
                    "query": query,
                    "status": "error",
                    "video_id": None,
                    "matched_title": None,
                    "matched_artist": None,
                    "message": f"Search error: {sanitize_error_message(exc)}",
                }
            )
            continue

        if not match_info or not match_info.get("video_id"):
            not_found_count += 1
            results.append(
                {
                    "query": query,
                    "status": "not_found",
                    "video_id": None,
                    "matched_title": None,
                    "matched_artist": None,
                    "message": "No matching song found on YouTube Music.",
                }
            )
            continue

        video_id = str(match_info["video_id"])
        matched_title = match_info.get("matched_title")
        matched_artist = match_info.get("matched_artist")

        if video_id in existing_set:
            skipped_count += 1
            results.append(
                {
                    "query": query,
                    "status": "already_present",
                    "video_id": video_id,
                    "matched_title": matched_title,
                    "matched_artist": matched_artist,
                    "message": "Track already present in target playlist.",
                }
            )
            continue

        # Reserve in existing_set to prevent duplicate videoIds within the same batch
        existing_set.add(video_id)
        video_ids_to_add.append(video_id)
        pending_add_indices.append(len(results))
        results.append(
            {
                "query": query,
                "status": "added",
                "video_id": video_id,
                "matched_title": matched_title,
                "matched_artist": matched_artist,
                "message": "Added to YouTube Music playlist.",
            }
        )

    # Batch insert all newly matched videoIds into the playlist
    if video_ids_to_add and not auth_expired:
        max_retries = 2
        batch_added_ok = False
        last_err_msg = ""

        for attempt in range(max_retries):
            try:
                add_resp = ytm.add_playlist_items(
                    playlistId=ytm_playlist_id,
                    videoIds=video_ids_to_add,
                    duplicates=False,
                )
                # Check if ytmusicapi returned an error status dict instead of raising
                if isinstance(add_resp, dict):
                    status_str = str(add_resp.get("status", "")).upper()
                    if "FAILED" in status_str or "ERROR" in status_str:
                        raise RuntimeError(str(add_resp))
                batch_added_ok = True
                break
            except Exception as exc:
                if is_auth_expired_error(exc):
                    auth_expired = True
                    last_err_msg = "YouTube Music authentication expired while adding tracks."
                    break
                if "HTTP 409" in str(exc) or "409" in str(exc):
                    # Conflict indicates items already exist in playlist
                    batch_added_ok = True
                    break
                last_err_msg = sanitize_error_message(exc)
                if attempt < max_retries - 1:
                    time.sleep(1.0)

        if batch_added_ok:
            added_count = len(video_ids_to_add)
        else:
            for res_idx in pending_add_indices:
                results[res_idx]["status"] = "error"
                results[res_idx]["message"] = last_err_msg or "Failed to add batch to playlist."

    return {
        "results": results,
        "added_count": added_count,
        "skipped_count": skipped_count,
        "not_found_count": not_found_count,
        "auth_expired": auth_expired,
    }
