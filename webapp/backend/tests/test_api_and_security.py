"""Comprehensive Automated QA, Contract, and Security Test Suite for S2YM Stateless Web Backend.

Covers:
1. Universal cURL & Header Parser (Safari binary $'\\x1f\\x8b...', Chrome -b, Firefox, Edge, raw headers, SAPISIDHASH)
2. Zero-Disk-Storage Verification (guarantees no browser.json, raw_headers.txt, config.json, or cache files are created)
3. Concurrent Multi-User Isolation (simultaneous requests from User A and User B never bleed state)
4. SSRF & Input Validation (blocks path traversal, metadata SSRF, non-Spotify domains, malformed IDs)
5. Credential Redaction & Error Sanitization (strips SID, SAPISID, __Secure-3PAPISID, SAPISIDHASH from errors)
6. Batch Transfer & Auth Expiry Hot-Reload (added, already_present, not_found, and HTTP 401 AUTH_EXPIRED)
7. Single-Container SPA Static Serving & Strict Security Headers (CSP, X-Frame-Options, nosniff)
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
from pathlib import Path
import sys
from typing import Any
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient
import pytest

from webapp.backend.main import FRONTEND_DIST_DIR, app
from webapp.backend.services.curl_parser import (
    YTM_ORIGIN,
    compute_sapisidhash,
    parse_curl_or_headers,
)
from webapp.backend.services.spotify_service import extract_spotify_playlist_id
from webapp.backend.services.ytm_service import (
    TRACK_SEARCH_CACHE,
    sanitize_error_message,
)

client = TestClient(app)

REPO_ROOT = Path(__file__).resolve().parents[3]
FORBIDDEN_PERSISTENCE_FILES = {
    "browser.json",
    "raw_headers.txt",
    "config.json",
    "song_cache.json",
    "oauth.json",
}


# ============================================================================
# TEST 1: UNIVERSAL CURL & HTTP HEADER PARSER
# ============================================================================


def test_1a_safari_curl_with_gzip_binary_payload_and_multiline_continuations() -> None:
    """Safari macOS 'Copy as cURL' includes --data-raw / --data-binary $'\\x1f\\x8b\\x08...' and multiline \\."""
    safari_curl = (
        "curl 'https://music.youtube.com/youtubei/v1/browse?prettyPrint=false' \\\n"
        "-X 'POST' \\\n"
        "-H 'Accept: */*' \\\n"
        "-H 'Content-Type: application/json' \\\n"
        "-H 'Origin: https://music.youtube.com' \\\n"
        "-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15' \\\n"
        "-H 'Cookie: VISITOR_INFO1_LIVE=xyz; SID=safari_sid_1; "
        "SAPISID=safari_sapisid_999/AbCdEf; __Secure-3PAPISID=safari_sapisid_999/AbCdEf' \\\n"
        "-H 'X-Goog-Visitor-Id: Cgt SafariVisitorId==' \\\n"
        "--data-raw $'\\x1f\\x8b\\x08\\x00\\x00\\x00\\x00\\x00\\x00\\x03\\xabV*I-.Q\\xb2RP*J\\xcd+\\x01\\x00'"
    )

    parsed = parse_curl_or_headers(safari_curl)
    assert parsed["valid"] is True
    assert parsed["error_code"] is None
    assert parsed["diagnostics"]["has_cookie"] is True
    assert parsed["diagnostics"]["has_sapisid"] is True
    assert parsed["diagnostics"]["has_authorization"] is True
    assert parsed["diagnostics"]["browser_detected"] == "Safari"

    headers = parsed["sanitized_headers"]
    assert "__Secure-3PAPISID=safari_sapisid_999/AbCdEf" in headers["cookie"]
    assert headers["authorization"].startswith("SAPISIDHASH ")
    assert headers["origin"] == YTM_ORIGIN
    assert headers["x-origin"] == YTM_ORIGIN


def test_1b_chrome_curl_with_b_cookie_flag_and_firefox_headers() -> None:
    """Chrome 'Copy as cURL (bash)' uses -b / --cookie flags; Firefox uses --header."""
    chrome_curl = (
        "curl 'https://music.youtube.com/youtubei/v1/browse?prettyPrint=false' "
        "-H 'authority: music.youtube.com' "
        "-H 'accept-language: es-ES,es;q=0.9' "
        "-b 'PREF=f6=400; SID=chrome_sid; __Secure-1PAPISID=chrome_sapisid_777/XyZ' "
        "-H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' "
        "--data-raw '{\"context\":{\"client\":{\"clientName\":\"WEB_REMIX\"}}}' "
        "--compressed"
    )
    parsed_chrome = parse_curl_or_headers(chrome_curl)
    assert parsed_chrome["valid"] is True
    assert parsed_chrome["diagnostics"]["browser_detected"] == "Chrome"
    # Even when only __Secure-1PAPISID is in -b, parser must inject __Secure-3PAPISID for ytmusicapi compatibility
    assert "__Secure-3PAPISID=chrome_sapisid_777/XyZ" in parsed_chrome["sanitized_headers"]["cookie"]
    assert parsed_chrome["sanitized_headers"]["authorization"].startswith("SAPISIDHASH ")

    firefox_curl = (
        'curl "https://music.youtube.com/youtubei/v1/browse" '
        '--header "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0" '
        '--header "Cookie: SAPISID=ff_sapisid_555/QwErTy; SID=ff_sid" '
        '--header "Authorization: SAPISIDHASH 1710000000_0123456789abcdef0123456789abcdef01234567"'
    )
    parsed_ff = parse_curl_or_headers(firefox_curl)
    assert parsed_ff["valid"] is True
    assert parsed_ff["diagnostics"]["browser_detected"] == "Firefox"
    assert "__Secure-3PAPISID=ff_sapisid_555/QwErTy" in parsed_ff["sanitized_headers"]["cookie"]


def test_1c_raw_http_headers_and_sapisidhash_cryptographic_verification() -> None:
    """Raw HTTP headers (with HTTP/2 pseudo-headers) and deterministic SAPISIDHASH SHA-1 verification."""
    raw_headers = """POST /youtubei/v1/browse?prettyPrint=false HTTP/2
:authority: music.youtube.com
:method: POST
:path: /youtubei/v1/browse?prettyPrint=false
:scheme: https
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0
cookie: SID=edge_sid; __Secure-3PAPISID=edge_sapisid_123/HashCheck
x-goog-authuser: 2
"""
    parsed = parse_curl_or_headers(raw_headers)
    assert parsed["valid"] is True
    assert parsed["diagnostics"]["browser_detected"] == "Edge"
    assert parsed["sanitized_headers"]["x-goog-authuser"] == "2"

    # Verify SAPISIDHASH formula: SHA1("<timestamp> <sapisid> https://music.youtube.com")
    fixed_ts = 1720000000
    sapisid_val = "edge_sapisid_123/HashCheck"
    expected_sha1 = hashlib.sha1(f"{fixed_ts} {sapisid_val} {YTM_ORIGIN}".encode("utf-8")).hexdigest()
    computed = compute_sapisidhash(sapisid_val, YTM_ORIGIN, timestamp=fixed_ts)
    assert computed == f"SAPISIDHASH {fixed_ts}_{expected_sha1}"


def test_1d_rejects_empty_and_malformed_inputs() -> None:
    """Verify clear error codes when input is empty, missing Cookie, or missing SAPISID."""
    res_empty = parse_curl_or_headers("   ")
    assert res_empty["valid"] is False
    assert res_empty["error_code"] == "EMPTY_INPUT"

    res_no_cookie = parse_curl_or_headers("curl 'https://music.youtube.com/youtubei/v1/browse' -H 'Accept: */*'")
    assert res_no_cookie["valid"] is False
    assert res_no_cookie["error_code"] == "MISSING_COOKIE"
    assert res_no_cookie["diagnostics"]["has_cookie"] is False

    res_no_sapisid = parse_curl_or_headers(
        "curl 'https://music.youtube.com/youtubei/v1/browse' -H 'Cookie: VISITOR_INFO1_LIVE=only_visitor; PREF=f6=400'"
    )
    assert res_no_sapisid["valid"] is False
    assert res_no_sapisid["error_code"] == "MISSING_SAPISID"
    assert res_no_sapisid["diagnostics"]["has_cookie"] is True
    assert res_no_sapisid["diagnostics"]["has_sapisid"] is False


# ============================================================================
# TEST 2: ZERO-DISK-STORAGE VERIFICATION
# ============================================================================


def _snapshot_disk_files(root: Path) -> dict[Path, float]:
    """Return mapping of all files inside webapp/ (excluding __pycache__) to their mtime."""
    snapshot: dict[Path, float] = {}
    webapp_dir = root / "webapp"
    for p in webapp_dir.rglob("*"):
        if p.is_file() and "__pycache__" not in p.parts and ".pytest_cache" not in p.parts:
            snapshot[p] = p.stat().st_mtime
    for fname in FORBIDDEN_PERSISTENCE_FILES:
        candidate = root / fname
        if candidate.exists():
            snapshot[candidate] = candidate.stat().st_mtime
    return snapshot


def test_2_zero_disk_storage_across_validate_prepare_and_transfer() -> None:
    """Prove that /api/ytm/validate, /api/ytm/prepare-playlist, and /api/ytm/transfer-batch never write to disk."""
    TRACK_SEARCH_CACHE.put("clear_probe", None)
    before_files = _snapshot_disk_files(REPO_ROOT)

    fake_ytm_instance = MagicMock()
    fake_ytm_instance.base_headers = {"X-Goog-Visitor-Id": "Visitor123"}
    fake_ytm_instance.get_library_playlists.return_value = [
        {"playlistId": "PL_EXISTING_1", "title": "City pop", "count": 8, "thumbnails": []}
    ]
    fake_ytm_instance.get_playlist.return_value = {
        "tracks": [{"videoId": "vid_already_1"}]
    }
    fake_ytm_instance.search.return_value = [
        {
            "videoId": "vid_new_2",
            "title": "4:00A.M.",
            "artists": [{"name": "Taeko Onuki"}],
        }
    ]
    fake_ytm_instance.add_playlist_items.return_value = {"status": "STATUS_SUCCEEDED"}

    with patch("webapp.backend.services.ytm_service.YTMusic", return_value=fake_ytm_instance):
        # 1. /api/ytm/validate
        val_resp = client.post(
            "/api/ytm/validate",
            json={
                "raw_input": (
                    "curl 'https://music.youtube.com/youtubei/v1/browse' "
                    "-H 'Cookie: SAPISID=zero_disk_sapisid/12345; __Secure-3PAPISID=zero_disk_sapisid/12345' "
                    "-H 'X-Goog-Visitor-Id: Visitor123'"
                )
            },
        )
        assert val_resp.status_code == 200
        val_data = val_resp.json()
        assert val_data["valid"] is True
        sanitized_headers = val_data["sanitized_headers"]

        # 2. /api/ytm/prepare-playlist
        prep_resp = client.post(
            "/api/ytm/prepare-playlist",
            json={
                "headers": sanitized_headers,
                "playlist_name": "City pop",
                "description": "Zero disk test",
            },
        )
        assert prep_resp.status_code == 200
        prep_data = prep_resp.json()
        assert prep_data["ytm_playlist_id"] == "PL_EXISTING_1"
        assert prep_data["created_new"] is False
        assert prep_data["existing_video_ids"] == ["vid_already_1"]

        # 3. /api/ytm/transfer-batch
        batch_resp = client.post(
            "/api/ytm/transfer-batch",
            json={
                "headers": sanitized_headers,
                "ytm_playlist_id": "PL_EXISTING_1",
                "tracks": ["Taeko Onuki - 4:00A.M."],
                "existing_video_ids": prep_data["existing_video_ids"],
            },
        )
        assert batch_resp.status_code == 200
        assert batch_resp.json()["added_count"] == 1

    after_files = _snapshot_disk_files(REPO_ROOT)

    # Verify zero new files and zero modified files
    assert set(before_files.keys()) == set(after_files.keys())
    for path, mtime in before_files.items():
        assert after_files[path] == mtime, f"File modified during stateless execution: {path}"

    # Explicitly assert none of the forbidden credential/cache files exist in webapp/backend
    backend_dir = REPO_ROOT / "webapp" / "backend"
    for forbidden in FORBIDDEN_PERSISTENCE_FILES:
        assert not (backend_dir / forbidden).exists()


# ============================================================================
# TEST 3: CONCURRENT MULTI-USER ISOLATION
# ============================================================================


def test_3_concurrent_multi_user_isolation() -> None:
    """Simulate User A and User B making simultaneous API requests with distinct cookies; verify zero bleed."""
    captured_cookies_by_playlist_title: dict[str, str] = {}

    def fake_ytm_factory(auth: dict[str, str]) -> MagicMock:
        cookie_hdr = auth.get("cookie", "")
        mock_client = MagicMock()
        mock_client.base_headers = {"X-Goog-Visitor-Id": "VisConcurrent"}

        if "user_A_secret_sapisid" in cookie_hdr:
            user_tag = "USER_A"
        elif "user_B_secret_sapisid" in cookie_hdr:
            user_tag = "USER_B"
        else:
            user_tag = "UNKNOWN"

        def get_library_playlists(limit: int | None = None) -> list[dict[str, Any]]:
            return [{"playlistId": f"PL_{user_tag}", "title": f"Playlist of {user_tag}", "count": 5}]

        def create_playlist(title: str, description: str) -> str:
            captured_cookies_by_playlist_title[title] = cookie_hdr
            return f"CREATED_BY_{user_tag}"

        mock_client.get_library_playlists.side_effect = get_library_playlists
        mock_client.create_playlist.side_effect = create_playlist
        return mock_client

    headers_user_a = {
        "cookie": "__Secure-3PAPISID=user_A_secret_sapisid/111; SAPISID=user_A_secret_sapisid/111",
        "x-goog-visitor-id": "visA",
    }
    headers_user_b = {
        "cookie": "__Secure-3PAPISID=user_B_secret_sapisid/222; SAPISID=user_B_secret_sapisid/222",
        "x-goog-visitor-id": "visB",
    }

    def run_user_request(idx: int) -> tuple[str, int, dict[str, Any]]:
        is_a = idx % 2 == 0
        user_label = "USER_A" if is_a else "USER_B"
        hdrs = headers_user_a if is_a else headers_user_b
        resp = client.post(
            "/api/ytm/prepare-playlist",
            json={
                "headers": hdrs,
                "playlist_name": f"Unique_{user_label}_{idx}",
                "description": "Concurrent isolation test",
            },
        )
        return user_label, resp.status_code, resp.json()

    with patch("webapp.backend.services.ytm_service.YTMusic", side_effect=fake_ytm_factory):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(run_user_request, range(16)))

    for user_label, status_code, body in results:
        assert status_code == 200
        assert body["ytm_playlist_id"] == f"CREATED_BY_{user_label}"

    for title, seen_cookie in captured_cookies_by_playlist_title.items():
        if "USER_A" in title:
            assert "user_A_secret_sapisid" in seen_cookie
            assert "user_B_secret_sapisid" not in seen_cookie
        else:
            assert "user_B_secret_sapisid" in seen_cookie
            assert "user_A_secret_sapisid" not in seen_cookie


# ============================================================================
# TEST 4: SSRF & INPUT VALIDATION
# ============================================================================


@pytest.mark.parametrize(
    "malicious_input",
    [
        "../../etc/passwd",
        "https://evil.com/playlist/1shiB0V7nNcpDaPXYdF4Jf",
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        "http://127.0.0.1:8000/api/health",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://open.spotify.com/playlist/../../etc/passwd",
        "https://open.spotify.com.evil.com/playlist/1shiB0V7nNcpDaPXYdF4Jf",
        "'; DROP TABLE playlists; --",
        "<script>alert('xss')</script>",
    ],
)
def test_4a_ssrf_and_path_traversal_rejected_on_spotify_endpoint(malicious_input: str) -> None:
    """Ensure non-Spotify domains, metadata IPs, and path traversal payloads never trigger network calls."""
    with patch("webapp.backend.services.spotify_service.requests.get") as mock_get:
        resp = client.post("/api/spotify/public-playlist", json={"url_or_id": malicious_input})
        assert resp.status_code in (400, 422)
        mock_get.assert_not_called()

    with pytest.raises(ValueError):
        extract_spotify_playlist_id(malicious_input)


def test_4b_ytm_endpoints_reject_invalid_playlist_ids_and_oversized_batches() -> None:
    """Verify strict Pydantic validation on /api/ytm/transfer-batch and /api/ytm/prepare-playlist."""
    valid_headers = {"cookie": "__Secure-3PAPISID=valid_sapisid/123"}

    # Path traversal in ytm_playlist_id
    resp_traversal = client.post(
        "/api/ytm/transfer-batch",
        json={
            "headers": valid_headers,
            "ytm_playlist_id": "../../etc/passwd",
            "tracks": ["Anri - Last Summer Whisper"],
        },
    )
    assert resp_traversal.status_code in (400, 422)

    # Batch size > 25 tracks
    resp_oversized = client.post(
        "/api/ytm/transfer-batch",
        json={
            "headers": valid_headers,
            "ytm_playlist_id": "PL_VALID_123",
            "tracks": [f"Track {i}" for i in range(30)],
        },
    )
    assert resp_oversized.status_code in (400, 422)

    # Missing cookie in headers dict
    resp_missing_cookie = client.post(
        "/api/ytm/playlists",
        json={"headers": {"user-agent": "Mozilla/5.0"}},
    )
    assert resp_missing_cookie.status_code in (400, 422)


# ============================================================================
# TEST 5: CREDENTIAL REDACTION & ERROR SANITIZATION
# ============================================================================


def test_5_credential_redaction_in_error_sanitizer_and_api_responses() -> None:
    """Verify cookies, SID, SAPISID, __Secure-3PAPISID, and SAPISIDHASH never leak in API errors."""
    raw_exception_msg = (
        "YTMusic request failed with headers: "
        "Cookie: SID=secret123; HSID=secret_hsid_999; SAPISID=secret456; __Secure-3PAPISID=secret789 | "
        "Authorization: SAPISIDHASH 1710000000_supersecrethashvalue | "
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret_jwt"
    )
    sanitized = sanitize_error_message(RuntimeError(raw_exception_msg))
    assert "secret123" not in sanitized
    assert "secret_hsid_999" not in sanitized
    assert "secret456" not in sanitized
    assert "secret789" not in sanitized
    assert "supersecrethashvalue" not in sanitized
    assert "secret_jwt" not in sanitized
    assert "[REDACTED]" in sanitized

    # Simulate exception thrown inside /api/ytm/playlists and verify response body is scrubbed
    with patch(
        "webapp.backend.services.ytm_service.YTMusic",
        side_effect=RuntimeError("Fatal crash with Cookie: SID=secret123; SAPISID=secret456"),
    ):
        resp = client.post(
            "/api/ytm/playlists",
            json={"headers": {"cookie": "SID=secret123; SAPISID=secret456; __Secure-3PAPISID=secret456"}},
        )
        assert resp.status_code == 502
        body_text = resp.text
        assert "secret123" not in body_text
        assert "secret456" not in body_text
        assert "[REDACTED]" in body_text


# ============================================================================
# TEST 6: BATCH TRANSFER CATEGORIZATION & AUTH EXPIRY HOT-RELOAD
# ============================================================================


def test_6a_batch_transfer_categorizes_added_already_present_and_not_found() -> None:
    """Verify /api/ytm/transfer-batch categorizes added, already_present, and not_found tracks accurately."""
    fake_ytm = MagicMock()
    fake_ytm.base_headers = {"X-Goog-Visitor-Id": "VisBatch"}

    def mock_search(query: str, filter: str = "songs", limit: int = 5) -> list[dict[str, Any]]:
        if "Taeko Onuki" in query:
            return [{"videoId": "vid_taeko", "title": "4:00A.M.", "artists": [{"name": "Taeko Onuki"}]}]
        if "Anri" in query:
            return [{"videoId": "vid_anri_existing", "title": "Last Summer Whisper", "artists": [{"name": "Anri"}]}]
        if "Unfindable Track" in query:
            return []
        return []

    fake_ytm.search.side_effect = mock_search
    fake_ytm.add_playlist_items.return_value = {"status": "STATUS_SUCCEEDED"}

    with patch("webapp.backend.services.ytm_service.YTMusic", return_value=fake_ytm):
        resp = client.post(
            "/api/ytm/transfer-batch",
            json={
                "headers": {"cookie": "__Secure-3PAPISID=batch_sapisid/123", "x-goog-visitor-id": "VisBatch"},
                "ytm_playlist_id": "PL_TARGET_123",
                "tracks": [
                    "Taeko Onuki - 4:00A.M. (Unique Batch Test)",
                    "Anri - Last Summer Whisper (Already Present Test)",
                    "Unfindable Track - Nonexistent Artist 99999",
                ],
                "existing_video_ids": ["vid_anri_existing"],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["added_count"] == 1
    assert data["skipped_count"] == 1
    assert data["not_found_count"] == 1
    assert data["auth_expired"] is False

    statuses = {r["query"]: r["status"] for r in data["results"]}
    assert statuses["Taeko Onuki - 4:00A.M. (Unique Batch Test)"] == "added"
    assert statuses["Anri - Last Summer Whisper (Already Present Test)"] == "already_present"
    assert statuses["Unfindable Track - Nonexistent Artist 99999"] == "not_found"


def test_6b_batch_transfer_returns_401_auth_expired_for_hot_reload() -> None:
    """Verify /api/ytm/transfer-batch returns HTTP 401 and AUTH_EXPIRED when YTM session expires mid-transfer."""
    fake_ytm = MagicMock()
    fake_ytm.base_headers = {"X-Goog-Visitor-Id": "VisExpired"}
    fake_ytm.search.side_effect = RuntimeError(
        "Server returned HTTP 401: Unauthorized. Request had invalid authentication credentials."
    )

    with patch("webapp.backend.services.ytm_service.YTMusic", return_value=fake_ytm):
        resp = client.post(
            "/api/ytm/transfer-batch",
            json={
                "headers": {"cookie": "__Secure-3PAPISID=expired_sapisid/000", "x-goog-visitor-id": "VisExpired"},
                "ytm_playlist_id": "PL_TARGET_123",
                "tracks": ["Uncached Song Mid Transfer 401 Check"],
                "existing_video_ids": [],
            },
        )

    assert resp.status_code == 401
    data = resp.json()
    assert data["auth_expired"] is True
    assert "AUTH_EXPIRED" in data["error_code"]


# ============================================================================
# TEST 7: SINGLE-CONTAINER SPA STATIC SERVING & SECURITY HEADERS
# ============================================================================


def test_7_single_container_spa_serving_and_strict_security_headers() -> None:
    """Verify GET / serves compiled webapp/frontend/dist/index.html with strict CSP and security headers."""
    assert (FRONTEND_DIST_DIR / "index.html").is_file(), (
        "Frontend production build (webapp/frontend/dist/index.html) must exist."
    )

    resp = client.get("/")
    assert resp.status_code == 200
    assert "<!doctype html>" in resp.text.lower()
    assert "SoundBridge" in resp.text

    # Verify strict security headers on SPA response
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "no-referrer"
    assert "camera=()" in resp.headers.get("Permissions-Policy", "")

    csp = resp.headers.get("Content-Security-Policy", "")
    assert "script-src 'self'" in csp
    assert "object-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "https://api.spotify.com" in csp
    assert "https://accounts.spotify.com" in csp
    assert "style-src 'self' 'unsafe-inline'" in csp
    assert "font-src 'self' data:" in csp
    assert "https://*.scdn.co" in csp
    assert "https://*.ytimg.com" in csp

    # Verify unknown /api/* route returns 404 JSON, not SPA HTML
    api_404 = client.get("/api/nonexistent-endpoint")
    assert api_404.status_code == 404
    assert api_404.json()["detail"] == "API endpoint not found"
