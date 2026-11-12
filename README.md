# TopicTyper — Learn While You Type

An open-learning typing & reading experiment built by **Naga Research Lab**. Learn interesting Wikipedia topics while improving your typing speed and accuracy.

![Theme](https://img.shields.io/badge/Theme-Deep%20Midnight%20Navy-0B1120?style=flat-square&labelColor=0B1120&color=38BDF8)
![Built By](https://img.shields.io/badge/Built%20By-Naga%20Research%20Lab-10B981?style=flat-square&labelColor=131C31)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20HTML5%20Canvas%20%2F%20CSS3-38BDF8?style=flat-square&labelColor=131C31)
![API](https://img.shields.io/badge/API-Wikipedia%20REST%20v1-10B981?style=flat-square&labelColor=131C31)

---

## 🌟 Multi-Page Application Architecture

TopicTyper is structured as a high-performance, distraction-free multi-page web application sharing a unified stylesheet (`style.css`) and modular client-side engine (`app.js`):

### 1. Home Page (`index.html`) — Setup Dashboard & Telemetry
- **Mode Selection**:
  - **Complete Paragraph Mode**: Read and type full article chunks at your own pace without time pressure.
  - **Timed Speed Sprint**: Fast-paced 15s, 30s, 60s, or 120s sprint challenges with automatic completion and idle-aware time accumulation.
- **Curated Topic Grid**: Instant launch cards for Space, Science, AI, History, Nature, Philosophy, Renaissance Art, or Random Surprise.
- **Custom Topic Search**: Type any subject to fetch live summaries directly from Wikipedia's REST API.
- **Performance Telemetry & WPM Progress Chart**: HTML5 Canvas cubic-bezier trendline across the last 15 completed sessions with moving averages and hover tooltips.
- **Weak Keys Detector & Heatmap**: Per-key accuracy tracking across sessions, visual QWERTY mini-keyboard heatmap, and custom 40-word targeted accuracy drill generation.

### 2. Distraction-Free Arena (`practice.html`) — Pure Focus Flow
- **Single-Column 94vw Viewport (up to 1350px)**: Zero sidebars or nested visual clutter.
- **Sharp Glowing Caret**: 2px wide vertical I-beam bar caret (`#38BDF8`) positioned cleanly before the active character with **zero text obstruction**.
- **Idle-Aware Engine**: Automatically pauses active timer accumulation after 3 seconds of inactivity and displays a subtle *"Paused — type to resume"* pill. Resumes instantly on the next keystroke, keeping WPM metrics mathematically accurate.
- **Minimal Meta HUD**: Compact topic title, 1-line description, Wikipedia source link, and live telemetry (WPM, Accuracy, Time/Countdown, Progress).
- **Completion Modal**: Celebration summary with net WPM, accuracy, active time, gross speed, errors, characters, and mini WPM trend chart.

### 3. Showcase & Philosophy (`about.html`) — Naga Research Lab
- **The TopicTyper Philosophy**: Merging active knowledge acquisition with motor-skill typing fluency.
- **Naga Research Lab**: Independent research and open-source software engineering lab building cognitive augmentations and developer tooling.
- **Creator Profile (AK Bisariya)**: Founder & Lead Researcher, with interactive showcase cards linking directly to:
  - **GitHub**: [github.com/NAGA-RESEARCH](https://github.com/NAGA-RESEARCH)
  - **YouTube**: [youtube.com/@AK_Bisariya](https://youtube.com/@AK_Bisariya)
  - **X (Twitter)**: [x.com/AK_Bisariya](https://x.com/AK_Bisariya)

---

## 🎨 Color Psychology & Aesthetics

- **Deep Midnight Navy (`#0B1120`)**: Ambient geometric dot-matrix background with soft radial ambient glows (`rgba(56, 189, 248, 0.07)`).
- **Elevated Slate-Glass Cards (`#131C31`)**: Subtle `1px solid rgba(148, 163, 184, 0.12)` borders.
- **Cognitive Sky Blue (`#38BDF8`)**: High-visibility accent for active carets, links, and primary CTA buttons.
- **Emerald (`#10B981`)**: Positive feedback for correct keystrokes and high accuracy.
- **Soft Coral (`#F43F5E`)**: Gentle typo identification with subtle coral highlights.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| <kbd>/</kbd> | Global | Jump directly to topic search input |
| <kbd>Esc</kbd> | Practice Arena | Restart current chunk & reset session |
| <kbd>Tab</kbd> | Practice Arena | Next paragraph or repeat drill |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Results Modal | Advance to next paragraph |
| <kbd>Esc</kbd> | Results Modal | Practice paragraph again immediately |
| `Any key` | Practice Arena | Captures focus into typing stream |

---

## 🚀 Running Locally

```bash
cd /home/amn/Developer/topic-typer
python3 -m http.server 8080
```
Open **`http://localhost:8080`** in your browser.
