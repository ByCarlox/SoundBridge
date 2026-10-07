"""Universal in-memory cURL & HTTP Header Parser for YouTube Music authentication.

Supports:
- Safari `Copy as cURL` (with `-H '...'`, `--data-binary $'\\x1f\\x8b...'`, multiline `\\`)
- Chrome / Edge `Copy as cURL (bash)` and `Copy as cURL (cmd)` (including `-b` / `--cookie` flags)
- Firefox `Copy as cURL` and `Copy Request Headers` (`-H "..."`, `--header`)
- Raw HTTP header lines (`Key: Value` and Chrome DevTools alternating key/value lines)
- Raw JSON dictionary (`browser.json` format)

100% Stateless: Never reads or writes files on disk.Never logs Cookie or Authorization values.
"""

from __future__ import annotations

import hashlib
from http.cookies import SimpleCookie
import json
import re
import shlex
import time
from typing import Any

YTM_ORIGIN = "https://music.youtube.com"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# Regex patterns for extracting -H / --header and -b / --cookie from cURL commands
CURL_HEADER_PATTERN = re.compile(
    r"(?:^|\s)(?:-H|--header)(?:\s+|=)(?:\$'((?:\\.|[^'\\])*)'|'([^']*)'|\"((?:\\.|[^\"\\])*)\")",
    re.MULTILINE,
)

CURL_COOKIE_PATTERN = re.compile(
    r"(?:^|\s)(?:-b|--cookie)(?:\s+|=)(?:\$'((?:\\.|[^'\\])*)'|'([^']*)'|\"((?:\\.|[^\"\\])*)\")",
    re.MULTILINE,
)

CURL_USER_AGENT_PATTERN = re.compile(
    r"(?:^|\s)(?:-A|--user-agent)(?:\s+|=)(?:\$'((?:\\.|[^'\\])*)'|'([^']*)'|\"((?:\\.|[^\"\\])*)\")",
    re.MULTILINE,
)

SAPISID_COOKIE_PATTERN = re.compile(
    r"(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID|__Secure-1PAPISID)=([^;\s\"']+)"
)


def detect_browser(user_agent: str) -> str:
    """Detect browser name from User-Agent header."""
    if not user_agent:
        return "Browser"
    ua = user_agent.lower()
    if "edg/" in ua or "edge/" in ua or "edgios/" in ua or "edga/" in ua:
        return "Edge"
    if "firefox/" in ua or "fxios/" in ua:
        return "Firefox"
    if ("chrome/" in ua or "crios/" in ua) and "safari/" in ua:
        return "Chrome"
    if "safari/" in ua and "chrome/" not in ua and "crios/" not in ua:
        return "Safari"
    return "Browser"


def compute_sapisidhash(sapisid: str, origin: str = YTM_ORIGIN, timestamp: int | None = None) -> str:
    """Compute YouTube Music SAPISIDHASH Authorization header value."""
    ts = str(timestamp if timestamp is not None else int(time.time()))
    sha1_hex = hashlib.sha1(f"{ts} {sapisid} {origin}".encode("utf-8")).hexdigest()
    return f"SAPISIDHASH {ts}_{sha1_hex}"


def extract_sapisid_from_cookie_str(cookie_str: str) -> str | None:
    """Extract __Secure-3PAPISID, SAPISID, or __Secure-1PAPISID from cookie string."""
    if not cookie_str:
        return None
    # Priority order: __Secure-3PAPISID -> SAPISID -> __Secure-1PAPISID
    for cookie_name in ("__Secure-3PAPISID", "SAPISID", "__Secure-1PAPISID"):
        m = re.search(rf"(?:^|;\s*){re.escape(cookie_name)}=([^;\s\"']+)", cookie_str)
        if m and m.group(1):
            return m.group(1).strip()
    m = SAPISID_COOKIE_PATTERN.search(cookie_str)
    return m.group(1).strip() if m else None


def _ensure_ytmusicapi_cookie_compatibility(cookie_str: str, sapisid: str) -> str:
    """Ensure ytmusicapi.helpers.sapisid_from_cookie() can always parse __Secure-3PAPISID."""
    cleaned = cookie_str.strip().strip(";").strip()
    if "__Secure-3PAPISID=" not in cleaned:
        cleaned = f"__Secure-3PAPISID={sapisid}; {cleaned}" if cleaned else f"__Secure-3PAPISID={sapisid}"

    # Verify SimpleCookie can extract __Secure-3PAPISID; if a malformed earlier cookie
    # breaks stdlib SimpleCookie.load(), prepend __Secure-3PAPISID at the very start.
    try:
        sc = SimpleCookie()
        sc.load(cleaned.replace('"', ""))
        if "__Secure-3PAPISID" not in sc or not sc["__Secure-3PAPISID"].value:
            cleaned = f"__Secure-3PAPISID={sapisid}; {cleaned}"
    except Exception:
        cleaned = f"__Secure-3PAPISID={sapisid}; {cleaned}"
    return cleaned


def _unescape_quoted_value(ansi_c_val: str | None, single_val: str | None, double_val: str | None) -> str:
    """Unescape a value captured from $'...', '...', or "..."."""
    if ansi_c_val is not None:
        # Unescape common ANSI-C sequences safely without corrupting UTF-8
        val = (
            ansi_c_val.replace(r"\'", "'")
            .replace(r"\"", '"')
            .replace(r"\\", "\\")
            .replace(r"\n", " ")
            .replace(r"\r", " ")
            .replace(r"\t", " ")
        )
        return val.strip()
    if single_val is not None:
        return single_val.strip()
    if double_val is not None:
        val = (
            double_val.replace(r"\"", '"')
            .replace(r"\\", "\\")
            .replace(r"\n", " ")
            .replace(r"\r", " ")
        )
        return val.strip()
    return ""


def _normalize_windows_cmd_curl(text: str) -> str:
    """Normalize Windows 'Copy as cURL (cmd)' caret-escaped strings into standard quotes."""
    # Replace caret line continuations
    normalized = re.sub(r"\^\r?\n", " ", text)
    if '^"' in normalized:
        # Windows cmd escapes outer quotes as ^" and inner quotes as \^" or ^\^"
        normalized = normalized.replace(r"\^\"", "'").replace('^"', '"')
        normalized = normalized.replace("^^", "^").replace("^%", "%").replace("^&", "&")
    return normalized


def _parse_as_curl(raw_text: str) -> dict[str, str]:
    """Extract headers and cookies from a cURL command."""
    # Join backslash line continuations
    normalized = re.sub(r"\\\r?\n", " ", raw_text.strip())
    normalized = _normalize_windows_cmd_curl(normalized)

    headers: dict[str, str] = {}
    cookies_list: list[str] = []

    # 1. Regex pass over -H / --header flags
    for match in CURL_HEADER_PATTERN.finditer(normalized):
        header_line = _unescape_quoted_value(match.group(1), match.group(2), match.group(3))
        if ":" in header_line and not header_line.startswith(":"):
            key, val = header_line.split(":", 1)
            k_lower = key.strip().lower()
            v_clean = val.strip()
            if k_lower == "cookie":
                if v_clean:
                    cookies_list.append(v_clean)
            elif k_lower:
                headers[k_lower] = v_clean

    # 2. Regex pass over -b / --cookie flags
    for match in CURL_COOKIE_PATTERN.finditer(normalized):
        cookie_val = _unescape_quoted_value(match.group(1), match.group(2), match.group(3))
        if cookie_val:
            cookies_list.append(cookie_val)

    # 3. Regex pass over -A / --user-agent flags
    for match in CURL_USER_AGENT_PATTERN.finditer(normalized):
        ua_val = _unescape_quoted_value(match.group(1), match.group(2), match.group(3))
        if ua_val and "user-agent" not in headers:
            headers["user-agent"] = ua_val

    # 4. Fallback / supplementary shlex pass (stripping --data* binary payloads first so shlex never chokes)
    cleaned_for_shlex = re.sub(
        r"(?:--data-binary|--data-raw|--data-ascii|--data|-d)\s+(?:\$'(?:\\.|[^'\\])*'|'[^']*'|\"(?:\\.|[^\"\\])*\"|\S+)",
        "",
        normalized,
    )
    cleaned_for_shlex = re.sub(r"\$'((?:\\.|[^'\\])*)'", r"'\1'", cleaned_for_shlex)
    try:
        tokens = shlex.split(cleaned_for_shlex, posix=True)
        i = 0
        while i < len(tokens):
            tok = tokens[i]
            if tok in ("-H", "--header") and i + 1 < len(tokens):
                hline = tokens[i + 1]
                if ":" in hline and not hline.startswith(":"):
                    k, v = hline.split(":", 1)
                    kl = k.strip().lower()
                    vc = v.strip()
                    if kl == "cookie":
                        if vc and vc not in cookies_list:
                            cookies_list.append(vc)
                    elif kl and kl not in headers:
                        headers[kl] = vc
                i += 2
                continue
            if tok in ("-b", "--cookie") and i + 1 < len(tokens):
                cval = tokens[i + 1].strip()
                if cval and cval not in cookies_list:
                    cookies_list.append(cval)
                i += 2
                continue
            if tok in ("-A", "--user-agent") and i + 1 < len(tokens):
                uaval = tokens[i + 1].strip()
                if uaval and "user-agent" not in headers:
                    headers["user-agent"] = uaval
                i += 2
                continue
            i += 1
    except ValueError:
        # shlex can fail on unbalanced quotes in truncated pastes; regex results above still succeed
        pass

    if cookies_list:
        headers["cookie"] = "; ".join(cookies_list)

    return headers


def _parse_as_raw_headers(raw_text: str) -> dict[str, str]:
    """Extract headers from raw HTTP Key: Value lines or Chrome DevTools multi-line format."""
    headers: dict[str, str] = {}
    cookies_list: list[str] = []
    remembered_key: str = ""

    lines = raw_text.splitlines()
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        # Skip HTTP request line (e.g. POST /youtubei/v1/browse HTTP/2)
        if re.match(r"^(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+\S+\s+HTTP/", line, re.IGNORECASE):
            continue

        # Skip HTTP/2 pseudo-headers (:authority, :method, :path, :scheme)
        if line.startswith(":"):
            remembered_key = ""
            continue

        # Handle Chrome's alternating-line copy-paste format where key is on its own line ("cookie:" or "cookie")
        if line.endswith(":") and " " not in line:
            remembered_key = line[:-1].strip().lower()
            continue

        if ": " in line or ":" in line:
            key_part, val_part = line.split(":", 1)
            key_clean = key_part.strip().lower()
            val_clean = val_part.strip()
            # Ensure key looks like a valid HTTP header name
            if re.match(r"^[a-z0-9_-]+$", key_clean):
                remembered_key = ""
                if key_clean == "cookie":
                    if val_clean:
                        cookies_list.append(val_clean)
                else:
                    headers[key_clean] = val_clean
                continue

        # If line had no colon (or wasn't a valid header key), check remembered_key
        if remembered_key:
            if remembered_key == "cookie":
                cookies_list.append(line)
            else:
                headers[remembered_key] = line
            remembered_key = ""
        elif re.match(r"^[a-zA-Z0-9_-]+$", line):
            remembered_key = line.lower()

    if cookies_list:
        headers["cookie"] = "; ".join(cookies_list)

    return headers


def parse_curl_or_headers(raw_input: str) -> dict[str, Any]:
    """Parse a cURL command, raw HTTP headers, or JSON headers dict completely in memory.

    Returns a dictionary containing:
        - valid (bool)
        - diagnostics (dict: has_cookie, has_sapisid, has_authorization, browser_detected)
        - sanitized_headers (dict[str, str] ready for YTMusic(auth=...))
        - headers (alias for sanitized_headers)
        - auth_json (str JSON representation of sanitized_headers)
        - error_code (str | None)
        - message (str)
    """
    empty_diagnostics = {
        "has_cookie": False,
        "has_sapisid": False,
        "has_authorization": False,
        "browser_detected": "Unknown",
    }

    if not raw_input or not isinstance(raw_input, str) or not raw_input.strip():
        return {
            "valid": False,
            "diagnostics": empty_diagnostics,
            "sanitized_headers": {},
            "headers": {},
            "auth_json": "{}",
            "error_code": "EMPTY_INPUT",
            "message": "Input is empty. Please paste your 'Copy as cURL' command or raw HTTP headers.",
        }

    text = raw_input.strip()
    extracted: dict[str, str] = {}

    # 1. Check if input is already a JSON object (e.g., browser.json content)
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed_json = json.loads(text)
            if isinstance(parsed_json, dict):
                for k, v in parsed_json.items():
                    if isinstance(k, str) and isinstance(v, str):
                        extracted[k.strip().lower()] = v.strip()
        except Exception:
            pass

    # 2. Check if input looks like a cURL command or contains cURL flags
    if not extracted:
        is_curl = (
             bool(re.match(r"^\s*curl\b", text, re.IGNORECASE))
            or bool(CURL_HEADER_PATTERN.search(text))
            or bool(CURL_COOKIE_PATTERN.search(text))
        )
        if is_curl:
            extracted = _parse_as_curl(text)
        if not extracted.get("cookie"):
            # Try raw header line parser as fallback or primary
            raw_extracted = _parse_as_raw_headers(text)
            for k, v in raw_extracted.items():
                if k not in extracted or not extracted[k]:
                    extracted[k] = v

    user_agent = extracted.get("user-agent", "")
    browser_detected = detect_browser(user_agent) if user_agent else "Browser"

    cookie_raw = extracted.get("cookie", "").strip()
    has_cookie = bool(cookie_raw)

    sapisid = extract_sapisid_from_cookie_str(cookie_raw) if has_cookie else None
    has_sapisid = bool(sapisid)

    raw_auth = extracted.get("authorization", "").strip()
    has_explicit_auth = "SAPISIDHASH" in raw_auth or raw_auth.startswith("Bearer ")

    diagnostics = {
        "has_cookie": has_cookie,
        "has_sapisid": has_sapisid,
        "has_authorization": bool(has_explicit_auth or has_sapisid),
        "browser_detected": browser_detected,
    }

    if not has_cookie:
        return {
            "valid": False,
            "diagnostics": diagnostics,
            "sanitized_headers": {},
            "headers": {},
            "auth_json": "{}",
            "error_code": "MISSING_COOKIE",
            "message": (
                "No 'Cookie' header or '-b' flag was found in your paste. "
                "Make sure you right-clicked a POST '/browse' request to music.youtube.com "
                "and selected 'Copy as cURL' (or copied all Request Headers including Cookie)."
            ),
        }

    if not has_sapisid or not sapisid:
        return {
            "valid": False,
            "diagnostics": diagnostics,
            "sanitized_headers": {},
            "headers": {},
            "auth_json": "{}",
            "error_code": "MISSING_SAPISID",
            "message": (
                "Cookie header was found, but Google authentication cookies "
                "('__Secure-3PAPISID' or 'SAPISID') are missing. "
                "Ensure you are signed in to music.youtube.com in a normal (non-logged-out) tab."
            ),
        }

    normalized_cookie = _ensure_ytmusicapi_cookie_compatibility(cookie_raw, sapisid)
    authorization = raw_auth if "SAPISIDHASH" in raw_auth else compute_sapisidhash(sapisid, YTM_ORIGIN)

    sanitized_headers: dict[str, str] = {
        "user-agent": user_agent or DEFAULT_USER_AGENT,
        "accept": extracted.get("accept", "*/*"),
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
        "content-encoding": "gzip",
        "origin": YTM_ORIGIN,
        "x-origin": YTM_ORIGIN,
        "x-goog-authuser": extracted.get("x-goog-authuser", "0") or "0",
        "cookie": normalized_cookie,
        "authorization": authorization,
    }

    if "x-goog-visitor-id" in extracted and extracted["x-goog-visitor-id"]:
        sanitized_headers["x-goog-visitor-id"] = extracted["x-goog-visitor-id"]
    if "accept-language" in extracted and extracted["accept-language"]:
        sanitized_headers["accept-language"] = extracted["accept-language"]

    auth_json = json.dumps(sanitized_headers, ensure_ascii=True, sort_keys=True)

    return {
        "valid": True,
        "diagnostics": diagnostics,
        "sanitized_headers": sanitized_headers,
        "headers": sanitized_headers,
        "auth_json": auth_json,
        "error_code": None,
        "message": "YouTube Music credentials parsed and verified in memory.",
    }
