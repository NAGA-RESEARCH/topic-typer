# TopicTyper v6.0 — Learn While You Type

An open-learning typing & reading experiment built by **Naga Research Lab**. Learn interesting Wikipedia topics and master developer typing speed across realistic programming languages and algorithms.

[![Live Demo](https://img.shields.io/badge/Live-Render-success?style=for-the-badge)](https://topic-typer.onrender.com)
[![Version v6.0](https://img.shields.io/badge/Version-v6.0-blue?style=for-the-badge)](https://github.com/NAGA-RESEARCH/topic-typer)

## 🚀 What's New in TopicTyper v6.0

1. **Bug-Free Keystroke Engine & No Code Overflow**
   - **Single-Character Space Handling:** Pressing `Space` mid-word evaluates strictly against `targetText[currentIndex]` as a single character. If `targetText[currentIndex] !== ' '`, it marks ONLY that single character as `.incorrect` (coral red) and advances `currentIndex` by 1 without skipping the rest of the word.
   - **Zero Line Clipping:** Code blocks and multiline text never clip off the right edge (`white-space: pre-wrap;`).

2. **Web Audio Sound Design & Ambient Focus**
   - Implemented multi-profile mechanical keyboard audio (`Creamy`, `Midnight`, `Tactile Brown`, `Clicky Blue`, `Retro Typewriter`).
   - Integrated **Ambient Focus Pad** low-pass warm concentration drone using Web Audio API oscillators.

3. **Production-Grade Architecture**
   - Built with **Django 6**, SQLite, Gunicorn, and **WhiteNoise** for seamless static asset compilation and serving on Render.

## 🛠️ Tech Stack
- **Backend:** Django 6, SQLite, Gunicorn, WhiteNoise
- **Frontend:** Vanilla JS, HTML5 Canvas, CSS3
- **Hosting:** Render.com (`https://topic-typer.onrender.com`)

---
Built with passion by **Naga Research Lab** (@AK_Bisariya).
