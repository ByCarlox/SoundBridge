"""Pydantic v2 models with strict validation for the stateless S2YM API."""

from __future__ import annotations

import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

YTM_PLAYLIST_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{2,128}$")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _strip_control_chars(value: str) -> str:
    return CONTROL_CHARS_RE.sub("", value).strip()


def _validate_headers_dict(headers: dict[str, str]) -> dict[str, str]:
    if not isinstance(headers, dict) or not headers:
        raise ValueError("Headers dictionary cannot be empty.")
    if len(headers) > 64:
        raise ValueError("Too many header entries provided.")
    cleaned: dict[str, str] = {}
    for k, v in headers.items():
        if not isinstance(k, str) or not isinstance(v, str):
            raise ValueError("Header keys and values must be strings.")
        key_clean = _strip_control_chars(k).lower()
        val_clean = _strip_control_chars(v)
        if not key_clean:
            continue
        if len(key_clean) > 128:
            raise ValueError("Header name exceeds maximum length.")
        if len(val_clean) > 65536:
            raise ValueError("Header value exceeds maximum length.")
        cleaned[key_clean] = val_clean
    if "cookie" not in cleaned:
        raise ValueError("Headers dictionary is missing required 'cookie' entry.")
    return cleaned


class HealthResponse(BaseModel):
    status: str = "ok"
    mode: str = "stateless-zero-storage"
    version: str = "2.0.0"


class YTMValidateRequest(BaseModel):
    raw_input: str = Field(
        ...,
        min_length=1,
        max_length=150000,
        description="Raw cURL command (Safari/Chrome/Firefox/Edge) or raw HTTP headers.",
    )


class YTMDiagnostics(BaseModel):
    has_cookie: bool = False
    has_sapisid: bool = False
    has_authorization: bool = False
    browser_detected: str = "Unknown"


class YTMPlaylistSummary(BaseModel):
    playlistId: str
    title: str
    count: Optional[int | str] = 0
    thumbnails: list[dict] = Field(default_factory=list)


class YTMValidateResponse(BaseModel):
    valid: bool
    diagnostics: YTMDiagnostics
    sanitized_headers: dict[str, str] = Field(default_factory=dict)
    playlist_count: int = 0
    playlists: list[YTMPlaylistSummary] = Field(default_factory=list)
    error_code: Optional[str] = None
    message: Optional[str] = None


class YTMPlaylistsRequest(BaseModel):
    headers: dict[str, str]

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, v: dict[str, str]) -> dict[str, str]:
        return _validate_headers_dict(v)


class YTMPlaylistsResponse(BaseModel):
    playlists: list[YTMPlaylistSummary] = Field(default_factory=list)


class YTMPreparePlaylistRequest(BaseModel):
    headers: dict[str, str]
    playlist_name: str = Field(..., min_length=1, max_length=150)
    description: str = Field(default="Copied from Spotify", max_length=500)

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, v: dict[str, str]) -> dict[str, str]:
        return _validate_headers_dict(v)

    @field_validator("playlist_name")
    @classmethod
    def clean_playlist_name(cls, v: str) -> str:
        cleaned = _strip_control_chars(v)[:150]
        if not cleaned:
            raise ValueError("Playlist name cannot be empty.")
        return cleaned

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str) -> str:
        return _strip_control_chars(v)[:500]


class YTMPreparePlaylistResponse(BaseModel):
    ytm_playlist_id: str
    created_new: bool
    existing_video_ids: list[str] = Field(default_factory=list)
    existing_count: int = 0


class YTMTransferBatchRequest(BaseModel):
    headers: dict[str, str]
    ytm_playlist_id: str = Field(..., min_length=2, max_length=128)
    tracks: list[str] = Field(..., min_length=1, max_length=25)
    existing_video_ids: list[str] = Field(default_factory=list, max_length=15000)

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, v: dict[str, str]) -> dict[str, str]:
        return _validate_headers_dict(v)

    @field_validator("ytm_playlist_id")
    @classmethod
    def validate_playlist_id(cls, v: str) -> str:
        cleaned = v.strip()
        if not YTM_PLAYLIST_ID_RE.match(cleaned):
            raise ValueError(
                "Invalid YouTube Music playlist ID format. Only alphanumeric, '_' and '-' are allowed."
            )
        return cleaned

    @field_validator("tracks")
    @classmethod
    def validate_tracks(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Tracks batch cannot be empty.")
        if len(v) > 25:
            raise ValueError("Batch size cannot exceed 25 tracks per request.")
        cleaned_tracks: list[str] = []
        for track in v:
            if not isinstance(track, str):
                raise ValueError("Each track query must be a string.")
            t = _strip_control_chars(track)[:300]
            if t:
                cleaned_tracks.append(t)
        if not cleaned_tracks:
            raise ValueError("Tracks batch contains no valid non-empty queries.")
        return cleaned_tracks

    @field_validator("existing_video_ids")
    @classmethod
    def validate_existing_ids(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        for vid in v[:15000]:
            if isinstance(vid, str):
                s = _strip_control_chars(vid)[:64]
                if s:
                    cleaned.append(s)
        return cleaned


class TrackTransferResult(BaseModel):
    query: str
    status: Literal["added", "already_present", "not_found", "error"]
    video_id: Optional[str] = None
    matched_title: Optional[str] = None
    matched_artist: Optional[str] = None
    message: str = ""


class YTMTransferBatchResponse(BaseModel):
    results: list[TrackTransferResult]
    added_count: int = 0
    skipped_count: int = 0
    not_found_count: int = 0
    auth_expired: bool = False


class SpotifyPublicPlaylistRequest(BaseModel):
    url_or_id: str = Field(..., min_length=1, max_length=512)
    access_token: Optional[str] = Field(default=None, max_length=2048)

    @field_validator("url_or_id")
    @classmethod
    def clean_url_or_id(cls, v: str) -> str:
        cleaned = _strip_control_chars(v)
        if not cleaned:
            raise ValueError("Spotify URL or playlist ID cannot be empty.")
        return cleaned


class SpotifyTrackItem(BaseModel):
    id: str
    artist: str
    name: str
    query: str
    duration_ms: int = 0


class SpotifyPublicPlaylistResponse(BaseModel):
    playlist_id: str
    name: str
    owner: str
    cover_url: Optional[str] = None
    total_tracks: int
    tracks: list[SpotifyTrackItem]
    is_partial_embed: bool = False
