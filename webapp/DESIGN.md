# Design System: **SoundBridge** (Sonic Dual-Glow Interactive UI)

> **Design Philosophy:** *An expressive, music-native consumer web app that bridges the iconic visual worlds of **Spotify (`#1ED760`)** and **YouTube Music (`#FF0033`)** across an Obsidian Concert Hall canvas (`#060609`). Built with Double-Bezel glass architecture, official vector brand logos, choreographed spring animations (`motion/react`), and a guided 3-Step Interactive Wizard that makes playlist migration feel effortless and magical.*

---

## 1. Visual Theme & Atmosphere
- **Surface Mode:** Consumer Music Experience + Guided Interactive Wizard
- **Three Dials Configuration:**
  - `DESIGN_VARIANCE: 8` (Expressive Sonic Bridge header, dual-brand ambient lighting, interactive album cards, and live audio equalizer transfer deck)
  - `MOTION_INTENSITY: 8` (Choreographed spring step transitions, animated audio wave bridge between Spotify and YouTube Music logos, flying track cards during transfer, tactile hover/press physics)
  - `VISUAL_DENSITY: 5` (Focused 1-step-at-a-time progressive wizard so the user is never overwhelmed by 4 panels at once; generous breathing room)
- **Atmosphere:** Deep Obsidian Concert Hall (`#060609`) illuminated by a **Sonic Dual-Glow System**: soft **Spotify Emerald (`#1ED760`)** ambient light on the left (Source), **Sonic Cyan (`#00D4FF`)** in the center bridge, and **YouTube Music Crimson (`#FF0033`)** on the right (Destination).

---

## 2. Color Palette & Brand Tokens (The Sonic Dual-Glow System)

> **CRITICAL RULE:** The old dull brown-orange (`#E0523C`) and flat dark-gray admin boxes are strictly retired. Always use the authentic platform colors below:

- **Obsidian Concert Canvas (`#060609`)** — Primary viewport background (`min-h-[100dvh]`) with subtle radial ambient spotlights (`rgba(30, 215, 96, 0.08)` top-left and `rgba(255, 0, 51, 0.08)` top-right).
- **Double-Bezel Outer Glass Shell (`rgba(255, 255, 255, 0.03)`)** — Outer container (`rounded-[2rem] border border-white/[0.08] p-2 backdrop-blur-xl`).
- **Inner Stage Core (`#0D0E14`)** — Primary card interior (`rounded-[1.6rem] border border-white/[0.05]`).
- **Elevated Interactive Surface (`#151722`)** — Input wells, playlist cards, browser tabs, and hover states (`border-white/[0.1]`).
- **Spotify Source Identity (Official Spotify Green):**
  - Primary Accent: `#1ED760` (Hover: `#3BE477`, Core Brand: `#1DB954`)
  - Ambient Glow / Tint: `rgba(30, 215, 96, 0.14)` fill, `rgba(30, 215, 96, 0.38)` border
- **YouTube Music Destination Identity (Official YouTube Music Red):**
  - Primary Accent: `#FF0033` (Hover: `#FF2A54`)
  - Ambient Glow / Tint: `rgba(255, 0, 51, 0.14)` fill, `rgba(255, 0, 51, 0.38)` border
- **Sonic Bridge Gradient:**
  - `linear-gradient(90deg, #1ED760 0%, #00D4FF 50%, #FF0033 100%)`
  - Used for the SoundBridge brand mark, the animated Sonic Wave connecting Step 1 → Step 2 → Step 3, and the live transfer progress bar.
- **Typography Hierarchy:**
  - **Pure Stage White (`#F8FAFC`)** — Headlines, active step titles, and primary labels.
  - **Soft Silver (`#94A3B8`)** — Friendly subtitles, artist names, and helper descriptions.
  - **Muted Slate (`#64748B`)** — Secondary metadata, durations, and inactive steps.
- **Semantic Status Pills:**
  - **¡Agregada! / Conectado (Success):** Text `#1ED760`, Surface `rgba(30, 215, 96, 0.14)`, Border `rgba(30, 215, 96, 0.35)`
  - **Ya estaba en tu lista (Skipped / Info):** Text `#FBBF24`, Surface `rgba(251, 191, 36, 0.14)`, Border `rgba(251, 191, 36, 0.35)`
  - **No encontrada / Atención (Error):** Text `#FF4D6D`, Surface `rgba(255, 77, 109, 0.14)`, Border `rgba(255, 77, 109, 0.35)`

---

## 3. Mandatory Brand Vector Logos (SVG Component Library)

The UI must include dedicated, high-precision SVG logo components (`BrandLogos.tsx`) so users immediately recognize every app and browser:

1. **`<SpotifyLogo />`:** Official-style Spotify circle in `#1ED760` with the three curved acoustic waves. Displayed in the top Sonic Bridge, Step 1 header, mode cards, and playlist badges.
2. **`<YouTubeMusicLogo />`:** Official-style YouTube Music circle in `#FF0033` with white outer vinyl ring and inner white play triangle. Displayed in the top Sonic Bridge, Step 2 header, Step 3 destination visualizer, and the "Abrir en YouTube Music" CTA.
3. **`<SoundBridgeLogo />`:** Custom sonic wave bridge icon blending `#1ED760` → `#00D4FF` → `#FF0033`.
4. **Browser Brand Logos (`<SafariLogo />`, `<ChromeLogo />`, `<FirefoxLogo />`, `<EdgeLogo />`):** Multi-color vector icons rendered inside the Step 2 browser selector tabs so users recognize their browser at a glance.

---

## 4. Typography & Consumer Copy Rules
- **Display & UI Sans (`Geist`):**
  - **Hero Title:** `clamp(1.75rem, 3vw, 2.5rem)`, `font-weight: 700`, `letter-spacing: -0.03em`.
  - **Step Title:** `clamp(1.25rem, 2vw, 1.6rem)`, `font-weight: 600`, `letter-spacing: -0.02em`.
  - **Body Copy:** `1rem` (`16px`), `line-height: 1.6`, warm and conversational Spanish (see `BRAND.md` dictionary—zero developer jargon in primary headings).
- **Technical Monospace (`Geist Mono`):**
  - Strictly reserved for keyboard shortcuts (`<kbd>⌘</kbd> <kbd>Option</kbd> <kbd>I</kbd>`), live numeric counters (`tabular-nums`), and track durations (`03:42`).

---

## 5. Layout Architecture: The 3-Step Interactive Wizard

Instead of showing 4 cramped boxes simultaneously, the interface centers on an interactive **3-Step Guided Stage** (`max-w-[1120px] mx-auto px-4 sm:px-6`):

### 5.1. Top Header & Interactive Sonic Bridge Stepper
- **Brand Bar:** `<SoundBridgeLogo />` + **SoundBridge** title + *"100% Privado · Sin guardar contraseñas"* pill + discreet gear popover for server status + *"Borrar datos"* button.
- **Interactive 3-Step Visual Bridge:**
  - Three connected interactive nodes that users can click at any time:
    1. **[Spotify Logo] 1. Elige tu música** (Glows `#1ED760` when active/completed)
    2. **[YouTube Music Logo] 2. Conecta YouTube Music** (Glows `#FF0033` when active/completed)
    3. **[Sonic Wave Icon] 3. Transferencia en Vivo** (Glows with Sonic Gradient when active/completed)
  - Between the nodes runs an animated SVG **Sonic Wave Line** that fills with `#1ED760 → #00D4FF → #FF0033` as the user progresses.

### 5.2. Step 1 View: Elige tu música de Spotify
- **Mode Selector Cards (2 Large Visual Cards):**
  - **Opción Rápida: Pegar Link de Playlist** (Default active — big input with `<SpotifyLogo />`, instant **"Buscar Playlist"** emerald button, and prominent **"Probar con playlists de ejemplo"** button).
  - **Mi Cuenta Completa: Traer mis 'Me Gusta' y todas mis listas** (Friendly guided Spotify connection with collapsible visual helper).
- **Loaded Playlists Showcase:**
  - Appears with a smooth spring animation right below once playlists are loaded.
  - Interactive album cover cards with emerald selection rings, search filter, expandable track preview, and a sticky/prominent **"Continuar a YouTube Music (X canciones listas) →"** CTA button.

### 5.3. Step 2 View: Conecta tu YouTube Music
- **Browser-Aware Visual Guide:**
  - Tabs with `<SafariLogo />`, `<ChromeLogo />`, `<FirefoxLogo />`, `<EdgeLogo />` + **"Detectado"** badge on the user's browser.
  - **Visual DevTools Mini-Illustration:** A sleek graphical mock of the browser's `Red (Network)` bar showing the filter `[ browse ]` and a highlighted row with a cursor clicking `Copiar como cURL`, so even non-technical users understand it in 3 seconds.
- **Auto-Validating Magic Paste Box:**
  - Large interactive dropzone with **"Pegar desde mi portapapeles"** button and `onPaste` listener that **automatically runs validation the instant text is pasted**—no extra button click needed!
  - Also includes a 1-click **"Probar con conexión de demostración"** button so users testing in demo mode can jump straight to Step 3.

### 5.4. Step 3 View: ¡Transfiriendo tu música en vivo!
- **The Live Sonic Bridge Visualizer:**
  - Left card: `<SpotifyLogo />` + source playlist cover & title.
  - Center stage: Animated 16-bar **Sonic Equalizer** (`#1ED760 → #00D4FF → #FF0033`) + live **Now Transferring Track Card** animating across the bridge.
  - Right card: `<YouTubeMusicLogo />` + destination playlist card filling up in real time.
- **Live Scoreboard & Track Feed:**
  - Big `tabular-nums` counters for **Agregadas con éxito**, **Ya estaban en tu lista**, and **No encontradas**.
  - Celebration banner on completion with a big crimson CTA: **`<YouTubeMusicLogo />` Abrir mi Playlist en YouTube Music ↗**.

---

## 6. Motion & Interactive Micro-Moments (`motion/react`)
- **Step Transitions:** Smooth horizontal/vertical spring transitions (`{ type: "spring", stiffness: 260, damping: 26 }`) when moving between Step 1, Step 2, and Step 3.
- **Sonic Equalizer Bars:** CSS/SVG keyframe equalizer bars that pulse gently in idle state and dance dynamically while batches are actively transferring.
- **Tactile Card Physics:** Playlist cards lift gently on hover (`translateY(-2px)`) with a subtle Spotify Emerald border glow; buttons compress (`scale(0.97)`) on press.
- **Defensive Layout Hardening:** All playlist titles and track rows enforce `min-w-0`, `truncate` / `line-clamp-2`, and `tabular-nums` so long titles or rapid counter updates never break the layout.
