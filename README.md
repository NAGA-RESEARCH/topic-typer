# TopicTyper ⚡ // Tactical Cyber-Terminal HUD

A high-performance, modular **Bento-Grid Hacker / Cyber-Terminal Dashboard** for typing practice on dynamic Wikipedia intel feeds.

![Theme](https://img.shields.io/badge/Aesthetic-Tactical%20Pentesting%20HUD-05070a?style=flat-square&labelColor=05070a&color=00ff41)
![Bento Grid](https://img.shields.io/badge/Layout-Modular%20Bento--Grid-00f3ff?style=flat-square&labelColor=080c14)
![Vanilla JS](https://img.shields.io/badge/Stack-Pure%20JS%20%2F%20CSS3-38bdf8?style=flat-square&labelColor=080c14)
![Wikipedia REST API](https://img.shields.io/badge/API-Wikipedia%20REST%20v1-00ff41?style=flat-square&labelColor=080c14)

---

## 🖥️ Modular Bento-Grid Architecture

Instead of a monolithic window, the entire interface is architected as an independent, floating **Bento-Grid HUD**:

- **Card 1 [TARGET ACQUISITION / SEARCH]** (Top-Left):
  - Tactical terminal command line: `root@typer:~# fetch --topic`
  - Instant topic search with real-time fetch feedback.
  - `[🎲 RANDOM TARGET]` button querying Wikipedia's live random summary endpoint.
  - Shuffled category chips (`💻 Computer Science`, `🚀 Space Exploration`, `🐧 Linux`, `⚡ Quantum Computing`, `🧠 Neuroscience`, etc.) with `🔀 SHUFFLE_POOLS`.
- **Card 2 [LIVE TELEMETRY HUD]** (Top-Right):
  - 4 real-time telemetry quadrants: **WPM (Net)**, **Accuracy (%)**, **Elapsed Time (MM:SS)**, and **Buffer Stream Progress (Chars & %)**.
  - Cyber laser progress bar with status state indicator (`[STATUS: READY]`, `[STATUS: DECRYPTING]`, `[STATUS: BUFFER_COMPLETE]`).
  - Tactical status badges (`CIPHER: AES_READY`, `PROTOCOL: REST_API`, `ENGINE: 0_LATENCY`).
- **Card 3 [PAYLOAD / TYPING ARENA]** (Full-Width Prominent Center):
  - Prominent full-width typing console with large, crisp monospace typography.
  - Surgical **smooth blinking block cursor** that dynamically matches character geometry.
  - Tactical payload header with article intelligence, Wikipedia external link, chunk counter, and chunk navigation (`◀ PREV` / `NEXT ▶`).
  - Integrated audio toggle button (`🔊 SOUND: ON/OFF`) with synthesized mechanical switch clicks via the Web Audio API.
  - Quick action controls: `↻ RESTART CHUNK [Esc]` and `➔ NEXT CHUNK [Tab]`.
- **Card 4 [SESSION LOGS / HISTORY]** (Compact Bottom Card):
  - **Execution Journal**: Real-time telemetry log displaying completed topic chunks, WPM scores, accuracy ratings, timestamps, and status badges. Includes a `[PURGE_LOGS]` button.
  - **Command Matrix**: Quick reference HUD for tactical keyboard shortcuts (`Tab`, `Esc`, `/`, `Enter`, `Space`).

---

## 🎨 Theme & Aesthetic

- **Deep Pitch-Black Void**: Base color `#05070a` with a subtle 32px cyber-grid texture.
- **Phosphor Terminal Green (`#00ff41`) & Electric Cyan (`#00f3ff`)**: Authentic high-contrast tactical accents with neon glow blooms.
- **Tactical Reticle Accents**: 1px sharp borders with neon corner brackets on every floating card.
- **Subtle CRT Scanlines & Vignette**: Ambient scanline filter and radial lens darkening without compromising text sharpness.
- **Crisp Monospace Fonts**: JetBrains Mono and Fira Code.

---

## ⌨️ Command Matrix & Keyboard Shortcuts

| Shortcut | Scope | Tactical Action |
| :--- | :--- | :--- |
| <kbd>/</kbd> | Global | Jump directly to topic search input (`fetch --topic`) |
| <kbd>Esc</kbd> | Arena | Restart current chunk payload & reset keystream timer |
| <kbd>Tab</kbd> | Arena | Next chunk payload or replay |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Results Modal | Advance to next payload chunk cleanly |
| <kbd>Esc</kbd> | Results Modal | Retry current chunk immediately |
| `Any key` | Global | Automatically captures focus into typing stream |

---

## 🚀 Running Locally

```bash
cd /home/amn/Developer/topic-typer
python3 -m http.server 8080
```
Open **`http://localhost:8080`** in your browser.
