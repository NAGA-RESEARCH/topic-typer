# TopicTyper — Learn While You Type

An open-learning typing & reading experiment built by **Naga Research Lab**. Learn interesting Wikipedia topics while improving your typing speed and accuracy.

![Theme](https://img.shields.io/badge/Theme-Deep%20Midnight%20Navy-0B1120?style=flat-square&labelColor=0B1120&color=38BDF8)
![Built By](https://img.shields.io/badge/Built%20By-Naga%20Research%20Lab-10B981?style=flat-square&labelColor=131C31)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20CSS3-38BDF8?style=flat-square&labelColor=131C31)
![API](https://img.shields.io/badge/API-Wikipedia%20REST%20v1-10B981?style=flat-square&labelColor=131C31)

---

## ✨ Balanced 2-Column Full-Screen Architecture

TopicTyper utilizes screen space efficiently (94vw up to 1600px) with a clean 2-column grid that stacks responsively on mobile and tablets:

- **Top Header**:
  - Custom brand logo (`logo.png`, 38px x 38px, rounded 10px).
  - Clean title: "TopicTyper" with subtitle "Learn While You Type".
  - Quick action controls: Sound toggle (`🔊 Sound: On/Off`), Practice History shortcut, and live session timer.
- **Sleek Topic Discovery Bar**:
  - Clean search input with placeholder: `"Search any topic (e.g., Quantum Computing, Astrophysics, History)..."` (kept empty on initial load and when rolling random topics).
  - `[🎲 Surprise Me (Random)]` button querying live Wikipedia summaries.
  - Horizontal quick-pick chips with a `🔀 More Topics` shuffle button.
- **Left Column (Topic Overview & Live Telemetry)**:
  - Topic title, direct Wikipedia link (`Read on Wikipedia ↗`), short description, and paragraph navigation (`◀ Prev` / `Next ▶`).
  - High-contrast stat cards for **Speed (WPM)**, **Accuracy (%)**, **Time (MM:SS)**, and **Progress (Chars & %)** with a smooth progress bar.
- **Spacious Typing Arena**:
  - Spacious card without nested borders.
  - Crisp monospace typography (`1.45rem`, generous line-height `1.9`).
  - Unblurred text overlay keeping text 100% visible before typing.
  - Action buttons below: `↺ Restart [Esc]` and `Next Paragraph [Tab] ➔`.
- **Intelligent Performance Analytics & WPM Progress Chart**:
  - Samples instantaneous WPM every 2 seconds during active typing.
  - Tracks speed progression across the last 15 completed paragraphs using pure HTML5 Canvas (zero external libraries).
  - Features smooth cubic Bezier spline curves, linear gradient area fill (`#38BDF8`), a 3-session moving-average line (`#10B981`), and interactive glassmorphic hover tooltips.
  - Mirrored responsive mini-trend chart directly inside the **Completion Modal**.
- **Weak Keys Detector & Heatmap Ergonomics**:
  - Automatically records keystroke accuracy per character in persistent storage (`topictyper_keystats`).
  - Highlights Top 5 attention keys color-coded by error rate: Soft Coral (`#F43F5E`) if > 15%, Amber (`#F59E0B`) if 5–15%, Emerald (`#10B981`) if < 5%.
  - Visual interactive QWERTY mini-keyboard heatmap color-coded by finger accuracy.
  - **`🎯 Practice Weak Keys`**: Generates a custom 40-word drill packed with words containing the user's top weak letters, loaded directly into the arena.
- **Completion Modal**:
  - Celebration dialog with speed, accuracy, elapsed time, raw WPM, errors, characters typed, and WPM trend chart.
  - Fast keyboard flow: <kbd>Enter</kbd> / <kbd>Space</kbd> for Next Paragraph, <kbd>Esc</kbd> to practice again, or click outside to dismiss cleanly.
- **Naga Research Lab Footer**:
  - Attribution: `"TopicTyper — An open-learning typing & reading experiment. Built by Naga Research Lab."`
  - Subtle badges for quick keyboard shortcuts.

---

## 🎨 Color Psychology & Aesthetic

- **Deep Midnight Navy (`#0B1120`)**: Deep low-fatigue background promoting sustained focus.
- **Elevated Slate-Glass Cards (`#131C31`)**: Subtle `1px solid rgba(148, 163, 184, 0.12)` borders.
- **Cognitive Sky Blue (`#38BDF8`)**: High-visibility accent for the active caret, links, and primary actions.
- **Emerald (`#10B981`)**: Positive feedback for correct keystrokes and high accuracy.
- **Soft Coral (`#F43F5E`)**: Gentle, non-punitive identification of typos.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| <kbd>/</kbd> | Global | Jump directly to topic search |
| <kbd>Esc</kbd> | Typing Area | Restart current paragraph & reset timer |
| <kbd>Tab</kbd> | Typing Area | Next paragraph or repeat |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Completion Modal | Advance to next paragraph cleanly |
| <kbd>Esc</kbd> | Completion Modal | Practice paragraph again immediately |
| `Any key` | Global | Automatically captures focus into typing stream |

---

## 🚀 Running Locally

```bash
cd /home/amn/Developer/topic-typer
python3 -m http.server 8080
```
Open **`http://localhost:8080`** in your browser.
