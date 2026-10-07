# Product Context: **SoundBridge** (Spotify a YouTube Music)

## 1. Product Purpose & Consumer Value Proposition
**SoundBridge** (*"Tu música, sin fronteras. Pasa tus playlists y favoritos de Spotify a YouTube Music en segundos"*) is an effortless, consumer-grade, 100% private web application for moving playlists and *Canciones que te gustan (Liked Songs)* from Spotify to YouTube Music.

Most playlist migration tools frustrate everyday music lovers in three ways:
1. They charge monthly subscriptions or force users to hand over account passwords to shady third-party servers.
2. They look like intimidating developer terminals filled with scary technical jargon (`OAuth 2.0 PKCE`, `cURL headers`, `Lotes idempotentes`) and overwhelm the user with 4 or 5 complex panels on screen at once.
3. They fail silently on large playlists (`+100 canciones`) or duplicate songs if a transfer is interrupted.

**SoundBridge** solves this by wrapping a bulletproof, zero-storage migration engine inside a **delightful, interactive 3-Step Guided Experience**:
- **100% Privado (Sin Guardar Datos):** Tus sesiones viven únicamente en tu navegador mientras usas la app. Un botón claro de **"Borrar mis datos"** limpia todo al instante.
- **Doble Forma de Elegir tu Música de Spotify (Paso 1):**
  - **Pegar link de Playlist (Rápido, sin cuenta):** Pega el enlace de cualquier playlist pública de Spotify y cárgala en 1 segundo sin iniciar sesión. Si la lista tiene más de 100 canciones, SoundBridge te avisa amablemente y te permite conectar tu cuenta con 1 clic.
  - **Conectar mi cuenta de Spotify (Tus 'Me Gusta' y todas tus listas):** Trae tu colección completa, incluyendo tus *Canciones que te gustan* y listas de cualquier tamaño, con una guía visual paso a paso súper sencilla.
  - **Modo Demo Instantáneo ("Probar con playlists de ejemplo"):** Permite a cualquier usuario explorar y probar la transferencia interactiva en 1 clic sin pegar nada.
- **Conexión Mágica con YouTube Music con Auto-Validación al Pegar (Paso 2):**
  - Guía visual interactiva con los logos oficiales de **Safari**, **Chrome**, **Firefox** y **Edge** (detectando automáticamente el navegador del usuario) y una ilustración visual de dónde hacer clic (`Red` → `browse` → `Copiar como cURL`).
  - **Pegado Inteligente (Zero-Click Validation):** En cuanto el usuario presiona `⌘V` / `Ctrl+V` (o pulsa *"Pegar desde mi portapapeles"*), SoundBridge valida la conexión automáticamente sin obligarle a buscar botones adicionales.
- **Transferencia en Vivo con Puente de Audio Interactivo (Paso 3):**
  - Un visualizador sonoro animado conecta el logo de **Spotify (`#1ED760`)** con el logo de **YouTube Music (`#FF0033`)**, mostrando las canciones que cruzan el puente en tiempo real, evitando duplicados automáticamente y celebrando al final con un botón directo: **"Abrir mi Playlist en YouTube Music ↗"**.

## 2. Target Audience & Experience Mode
- **Primary Audience:** Music lovers, playlist curators, and everyday users moving from Spotify to YouTube Music who want an app that feels as cool, modern, and intuitive as Spotify Wrapped or Apple Music—never a gray sysadmin dashboard.
- **Experience Architecture:** **3-Step Guided Interactive Wizard** with animated transitions (`motion/react`), recognizable brand logos, tactile album art cards, and zero technical jargon in primary headlines.
- **Deployment Topologies:**
  - **Single-Container Mode:** FastAPI serves both `/api/*` and the compiled React SPA.
  - **Hybrid Mode:** Static frontend connects seamlessly to the FastAPI backend (with a discreet settings popover for advanced server configuration so normal users are never distracted by server URLs).

## 3. The 3-Step Consumer Journey
1. **Paso 1 · Elige tu música de Spotify:** Pega el link de una playlist rápida, conecta tu cuenta completa para incluir tus *Me Gusta*, o carga las playlists de ejemplo con un clic. Selecciona tus listas viendo sus portadas y canciones.
2. **Paso 2 · Conecta tu YouTube Music:** Sigue las 3 tarjetas visuales con el logo de tu navegador (`Safari`, `Chrome`, `Firefox` o `Edge`), pega con `⌘V` / `Ctrl+V` (o usa el modo demo con 1 clic) y pasa automáticamente al siguiente paso.
3. **Paso 3 · ¡Transfiriendo tu música!:** Disfruta de la animación del puente sonoro mientras tus canciones se agregan a YouTube Music sin duplicados, y abre tu nueva playlist directamente en YouTube Music con un solo clic.
