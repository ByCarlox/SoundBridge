# ==============================================================================
# Stage 1: Build the React + Vite Frontend SPA
# ==============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build/webapp/frontend

COPY webapp/frontend/package*.json ./
RUN npm install

COPY webapp/frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Stateless Python FastAPI Runtime (Zero-Disk-Storage)
# ==============================================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /app

# Create non-root user (compatible with Hugging Face Spaces UID 1000 & Render/Fly/Railway)
RUN useradd -m -u 1000 appuser

COPY webapp/backend/requirements.txt /app/webapp/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/webapp/backend/requirements.txt

COPY webapp/__init__.py /app/webapp/__init__.py
COPY webapp/backend /app/webapp/backend
COPY --from=frontend-builder /build/webapp/frontend/dist /app/webapp/frontend/dist

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; port = os.environ.get('PORT', '7860'); urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health')" || exit 1

CMD ["sh", "-c", "uvicorn webapp.backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
