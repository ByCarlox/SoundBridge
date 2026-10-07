"""Root entrypoint for Hugging Face Spaces (Gradio / ZeroGPU Free Tier) and cloud runners."""

import os

try:
    import spaces  # type: ignore

    @spaces.GPU
    def _health_probe() -> str:
        return "ok"
except Exception:
    pass

import uvicorn
from webapp.backend.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("GRADIO_SERVER_PORT", "7860")))
    uvicorn.run(app, host="0.0.0.0", port=port)
