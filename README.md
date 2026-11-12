# TopicTyper ⌨️ — Learn While You Type

A clean, modern, and intuitive typing practice web app designed for everyday users and students. Learn interesting topics from Wikipedia while improving your typing speed and accuracy.

![Theme](https://img.shields.io/badge/Aesthetic-Clean%20Modern%20Dark--Slate-0f172a?style=flat-square&labelColor=0f172a&color=38bdf8)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20CSS3-3b82f6?style=flat-square&labelColor=1e293b)
![API](https://img.shields.io/badge/API-Wikipedia%20REST%20v1-10b981?style=flat-square&labelColor=1e293b)

---

## ✨ Features & Architecture

TopicTyper is organized into clean, distraction-free sections:

- **Top Header**:
  - Clean branding: "TopicTyper — Learn While You Type".
  - Quick action controls: Sound toggle (`🔊 Sound: On/Off`), Practice History shortcut, and live clock.
- **Section 1 (Topic Picker)**:
  - Welcoming search bar: `"What do you want to learn and type today? (e.g., Solar System, History, Python)"` with instant search.
  - `[🎲 Surprise Me (Random)]` button pulling fascinating articles directly from Wikipedia's live random summary endpoint.
  - Friendly horizontal topic pills (Science, History, Space, Technology, Movies, Nature, etc.) with a `🔀 More Topics` shuffle button.
- **Section 2 (Article Info & Live Stats)**:
  - Left card: Topic title, direct Wikipedia link (`Read on Wikipedia ↗`), clean summary, and paragraph navigation (`◀ Prev` / `Next ▶`).
  - Right card: Clear, high-contrast stat cards for **Speed (WPM)**, **Accuracy (%)**, **Time (MM:SS)**, and **Progress (Chars & %)** with a smooth progress bar.
- **Section 3 (Main Typing Area)**:
  - Spacious, high-contrast reading and typing card.
  - Text is 100% readable from the start with no intrusive blur.
  - Smooth blinking cursor with character tracking across lines.
  - Convenient controls below: `↺ Restart [Esc]` and `Next Paragraph [Tab] ➔`.
- **Section 4 (Practice History)**:
  - Session history log tracking your completed runs, WPM, accuracy, and timestamps.
  - `Clear History` button to purge past runs whenever needed.
- **Completion Modal**:
  - Clean celebration dialog showing speed, accuracy, elapsed time, raw WPM, errors, and characters typed.
  - Fast keyboard flow: <kbd>Enter</kbd> / <kbd>Space</kbd> for Next Paragraph, <kbd>Esc</kbd> to practice again, or click outside to dismiss cleanly.

---

## 🎨 Design & Aesthetic

- **Theme**: Soft dark slate (`#0f172a` background, `#1e293b` elevated cards, `#334155` soft borders).
- **Typography**: Clean sans-serif (`Inter` / system-ui) for all user interface controls, headings, and buttons; crisp monospace (`JetBrains Mono` / `Fira Code`) reserved exclusively for the typing text.
- **Readability**: Easy on the eyes, generous spacing, zero aggressive blur, and high-contrast color highlights (emerald for correct characters, soft rose for typos).

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
