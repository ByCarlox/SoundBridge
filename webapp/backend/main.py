"""FastAPI Stateless Zero-Disk-Storage Backend for Spotify2YoutubeMusic Web Platform."""

from __future__ import annotations

from collections import defaultdict, deque
import os
from pathlib import Path
import threading
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from webapp.backend.models import (
    HealthResponse,
    SpotifyPublicPlaylistRequest,
    SpotifyPublicPlaylistResponse,
    YTMPlaylistsRequest,
    YTMPlaylistsResponse,
    YTMPreparePlaylistRequest,
    YTMPreparePlaylistResponse,
    YTMTransferBatchRequest,
    YTMTransferBatchResponse,
    YTMValidateRequest,
)
from webapp.backend.services.curl_parser import parse_curl_or_headers
from webapp.backend.services.spotify_service import fetch_public_spotify_playlist
from webapp.backend.services.ytm_service import (
    create_or_get_ytm_playlist,
    is_auth_expired_error,
    list_user_playlists,
    sanitize_error_message,
    transfer_batch,
    validate_ytm_session,
)

APP_VERSION = "2.0.0"
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach strict security headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        response = await call_next(request)
        is_hf_space = bool(os.environ.get("SPACE_ID"))
        response.headers["X-Content-Type-Options"] = "nosniff"
        if not is_hf_space:
            response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        frame_ancestors = (
            "frame-ancestors 'self' https://huggingface.co https://*.hf.space; "
            if is_hf_space
            else "frame-ancestors 'none'; "
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "object-src 'none'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; "
            "img-src 'self' data: blob: https://*.scdn.co https://*.spotifycdn.com https://*.ytimg.com https://*.ggpht.com; "
            "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https:*; "
            + frame_ancestors
            + "base-uri 'self'; "
            "form-action 'self';"
        )
        return response


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    """Thread-safe in-memory sliding-window IP rate limiter for /api/* endpoints."""

    def __init__(self, app: Any, max_requests_per_minute: int = 240) -> None:
        super().__init__(app)
        self.max_requests = max_requests_per_minute
        self.window_seconds = 60.0
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        if not request.url.path.startswith("/api/") or request.url.path == "/api/health":
            return await call_next(request)

        client_ip = (request.client.host if request.client else "unknown") or "unknown"
        now = time.monotonic()

        with self._lock:
            q = self._hits[client_ip]
            while q and (now - q[0]) > self.window_seconds:
                q.popleft()
            if len(q) >= self.max_requests:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error_code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests from this IP. Please wait a moment and try again.",
                    },
                )
            q.append(now)

        return await call_next(request)


app = FastAPI(
    title="Spotify2YoutubeMusic Stateless API",
    description="Zero-Disk-Storage Stateless Web API for transferring Spotify playlists to YouTube Music.",
    version=APP_VERSION,
)

# Configure CORS for dual deployment (GitHub Pages frontend + Cloud/Docker backend)
cors_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()] if cors_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(InMemoryRateLimitMiddleware, max_requests_per_minute=240)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return clean, sanitized validation errors without echoing sensitive request payloads."""
    errors = exc.errors()
    first_msg = "Invalid request payload."
    if errors:
        loc = " -> ".join(str(p) for p in errors[0].get("loc", []) if p != "body")
        msg = errors[0].get("msg", "Invalid field")
        first_msg = f"{loc}: {msg}" if loc else str(msg)

    return JSONResponse(
        status_code=400,
        content={
            "valid": False,
            "error_code": "VALIDATION_ERROR",
            "message": sanitize_error_message(first_msg),
            "detail": sanitize_error_message(first_msg),
        },
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Stateless health check endpoint."""
    return HealthResponse(status="ok", mode="stateless-zero-storage", version=APP_VERSION)


@app.post("/api/ytm/validate")
async def validate_ytm_credentials(payload: YTMValidateRequest) -> JSONResponse:
    """Parse cURL/raw headers in memory and verify live YouTube Music session."""
    parsed = parse_curl_or_headers(payload.raw_input)
    if not parsed["valid"]:
        return JSONResponse(
            status_code=400,
            content={
                "valid": False,
                "error_code": parsed["error_code"] or "INVALID_HEADERS",
                "message": parsed["message"],
                "diagnostics": parsed["diagnostics"],
                "sanitized_headers": {},
                "playlist_count": 0,
                "playlists": [],
            },
        )

    sanitized_headers = parsed["sanitized_headers"]
    diagnostics = parsed["diagnostics"]

    try:
        playlists, updated_headers = await run_in_threadpool(validate_ytm_session, sanitized_headers)
    except Exception as exc:
        err_code = "YTM_AUTH_EXPIRED" if is_auth_expired_error(exc) else "YTM_CONNECTION_FAILED"
        return JSONResponse(
            status_code=401,
            content={
                "valid": False,
                "error_code": err_code,
                "message": (
                    "Headers were parsed, but YouTube Music rejected the session or cookies have expired. "
                    f"Details: {sanitize_error_message(exc)}"
                ),
                "diagnostics": diagnostics,
                "sanitized_headers": {},
                "playlist_count": 0,
                "playlists": [],
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "valid": True,
            "diagnostics": diagnostics,
            "sanitized_headers": updated_headers,
            "playlist_count": len(playlists),
            "playlists": playlists,
            "error_code": None,
            "message": "Connected to YouTube Music in stateless memory mode.",
        },
    )


@app.post("/api/ytm/playlists", response_model=YTMPlaylistsResponse)
async def get_ytm_playlists(payload: YTMPlaylistsRequest) -> Any:
    """List the user's YouTube Music playlists using in-memory request headers."""
    try:
        playlists = await run_in_threadpool(list_user_playlists, payload.headers)
        return {"playlists": playlists}
    except Exception as exc:
        status_code = 401 if is_auth_expired_error(exc) else 502
        return JSONResponse(
            status_code=status_code,
            content={
                "error_code": "YTM_AUTH_EXPIRED" if status_code == 401 else "YTM_ERROR",
                "message": sanitize_error_message(exc),
                "detail": sanitize_error_message(exc),
            },
        )


@app.post("/api/ytm/prepare-playlist", response_model=YTMPreparePlaylistResponse)
async def prepare_ytm_playlist(payload: YTMPreparePlaylistRequest) -> Any:
    """Create or locate a target YouTube Music playlist and return existing track videoIds for deduplication."""
    try:
        result = await run_in_threadpool(
            create_or_get_ytm_playlist,
            payload.headers,
            payload.playlist_name,
            payload.description,
        )
        return result
    except Exception as exc:
        status_code = 401 if is_auth_expired_error(exc) else 502
        return JSONResponse(
            status_code=status_code,
            content={
                "error_code": "YTM_AUTH_EXPIRED" if status_code == 401 else "YTM_PLAYLIST_PREPARE_FAILED",
                "message": sanitize_error_message(exc),
                "detail": sanitize_error_message(exc),
            },
        )


@app.post("/api/ytm/transfer-batch", response_model=YTMTransferBatchResponse)
async def transfer_ytm_batch(payload: YTMTransferBatchRequest) -> Any:
    """Search and add a batch of tracks to a YouTube Music playlist statelessly."""
    try:
        result = await run_in_threadpool(
            transfer_batch,
            payload.headers,
            payload.ytm_playlist_id,
            payload.tracks,
            payload.existing_video_ids,
        )
        if result.get("auth_expired"):
            return JSONResponse(
                status_code=401,
                content={
                    **result,
                    "error_code": "AUTH_EXPIRED",
                    "message": "YouTube Music authentication expired. Please paste fresh headers to resume.",
                    "auth_expired": True,
                },
            )
        return result
    except Exception as exc:
        if is_auth_expired_error(exc):
            return JSONResponse(
                status_code=401,
                content={
                    "results": [],
                    "added_count": 0,
                    "skipped_count": 0,
                    "not_found_count": 0,
                    "error_code": "AUTH_EXPIRED",
                    "message": "YouTube Music authentication expired. Please paste fresh headers to resume.",
                    "auth_expired": True,
                },
            )
        return JSONResponse(
            status_code=502,
            content={
                "error_code": "YTM_BATCH_FAILED",
                "message": sanitize_error_message(exc),
                "auth_expired": False,
            },
        )


@app.post("/api/spotify/public-playlist", response_model=SpotifyPublicPlaylistResponse)
async def get_public_spotify_playlist(payload: SpotifyPublicPlaylistRequest) -> Any:
    """Fetch a public Spotify playlist by URL, URI, or 22-character ID without API keys."""
    try:
        data = await run_in_threadpool(
            fetch_public_spotify_playlist,
            payload.url_or_id,
            payload.access_token,
        )
        return data
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error_code": "INVALID_SPOTIFY_ID",
                "message": str(exc),
                "detail": str(exc),
            },
        )
    except LookupError as exc:
        return JSONResponse(
            status_code=404,
            content={
                "error_code": "SPOTIFY_PLAYLIST_NOT_FOUND",
                "message": str(exc),
                "detail": str(exc),
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error_code": "SPOTIFY_FETCH_ERROR",
                "message": sanitize_error_message(exc),
                "detail": sanitize_error_message(exc),
            },
        )


# Mount compiled frontend SPA assets if present, and register SPA fallback route (Single-Container mode)
if (FRONTEND_DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str) -> Any:
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})
    if full_path and FRONTEND_DIST_DIR.is_dir():
        candidate = (FRONTEND_DIST_DIR / full_path).resolve()
        if candidate.is_file() and str(candidate).startswith(str(FRONTEND_DIST_DIR.resolve())):
            return FileResponse(str(candidate))
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))
    return JSONResponse(status_code=404, content={"detail": "Frontend build not found"})

