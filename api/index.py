"""Vercel Serverless Python entrypoint for SoundBridge FastAPI backend."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path in Vercel serverless environment
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from webapp.backend.main import app  # noqa: E402, F401
