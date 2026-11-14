<<<<<<< HEAD
# TopicTyper v5.0 — Learn While You Type

An open-learning typing & reading experiment built by **Naga Research Lab**. Learn interesting Wikipedia topics and master developer typing speed across realistic programming languages and algorithms.

![Version](https://img.shields.io/badge/Version-v5.0-38BDF8?style=flat-square&labelColor=0B1120)
![Theme](https://img.shields.io/badge/Themes-Midnight%20%7C%20Coding%20%7C%20Hacking%20%7C%20Arcade-0B1120?style=flat-square&labelColor=0B1120&color=38BDF8)
![Built By](https://img.shields.io/badge/Built%20By-Naga%20Research%20Lab-10B981?style=flat-square&labelColor=131C31)
![Backend](https://img.shields.io/badge/Backend-Django%206%20%2F%20SQLite3-38BDF8?style=flat-square&labelColor=131C31)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20HTML5%20Canvas%20%2F%20CSS3-10B981?style=flat-square&labelColor=131C31)

---

## 🌟 What's New in TopicTyper v5.0

### 1. Bug-Free Keystroke Engine & No Code Overflow
- **Single-Character Space Handling**: Pressing `Space` mid-word now evaluates strictly against `targetText[currentIndex]` as a single character. If `targetText[currentIndex] !== ' '`, it marks ONLY that single character as `.incorrect` (coral red) and advances `currentIndex` by 1 without skipping the rest of the word.
- **Zero Line Clipping**: Code blocks and multiline text never clip off the right edge (`white-space: pre-wrap; word-break: break-word;` with auto-scrolling caret tracking).

### 2. Dedicated IDE Code Arena (`/code/`)
- Accessible directly via the top navigation bar.
- **Language Selector Tabs**: Interactive tabs for **Python**, **C++**, **JavaScript**, **SQL**, **Linux / Bash**, and **HTML/CSS**.
- **Difficulty Filtering**: Filter between `All`, `Beginner`, `Intermediate`, and `DSA & Algorithms`.
- **Curated Code Library (36+ Programs)**: Runnable, idiomatic developer snippets (decorators, smart pointers, async fetch pipelines, window functions, Docker scripts, and modern CSS components).
- **True IDE Experience**:
  - Code gutter with real-time active line numbering.
  - Subtle syntax-aware coloring for keywords, strings, comments, numbers, and symbols.
  - **Smart Enter Indentation**: Pressing Enter automatically skips leading indentation spaces on the next line so typing feels natural.

### 3. User Authentication & Personalized Recommendations
- **Themed Auth Pages**: Clean `/signup/`, `/login/`, and `/logout/` views styled with active CSS theme variables.
- **Custom Preferences**: During signup, select favorite programming languages and initial skill level (`Beginner`, `Intermediate`, `Pro`).
- **User-Linked Analytics**: `UserProfile` model and nullable `user` foreign key on `TypingSession` and `KeyStat` isolate personal stats for logged-in users while preserving guest mode.
- **Smart "Recommended For You" Strip**: Displays tailored topic cards, coding programs, and targeted drills matching the user's selected languages, current WPM speed tier (`Pace Builder`, `Velocity Sprint`, `Hyperspeed Master`), and weakest keys.

### 4. Specialized Developer Drills
- **Symbols & Brackets Gauntlet**: Heavy practice on `{}` `[]` `()` `<>` `=>` `!=` `&&` `||` `;` `:`.
- **Linux & Git Command Line**: Real terminal commands (`git`, `grep`, `awk`, `docker`, `chmod`, `ssh`).
- **Numbers & Data Sprint**: Alphanumeric codes, IP addresses, dates, and financial figures.

---

## 🎧 Procedural Web Audio API Sound Engine

TopicTyper features a zero-dependency, procedural acoustic synthesis sound studio modeled after mechanical switches and retro typewriters:

- **Dynamics Compression & Clean Master Bus**: Powered by a `DynamicsCompressorNode` and `GainNode` to ensure rapid 100+ WPM typing bursts never distort or clip.
- **Selectable Switch Profiles**:
  - **Creamy Thock (Default)**: Deep PBT switch punch (`~240 Hz` down to `110 Hz`).
  - **Tactile Brown**: Balanced mid-range bump (`~330 Hz` down to `160 Hz`).
  - **Clicky Blue**: Sharp high-frequency click-jacket snap (`2.4 kHz` transient).
  - **Retro Typewriter**: Heavy vintage strike clack with metallic carriage return bell (`2093 Hz C7`).
  - **Theme Sync (Auto)**: Dynamically adjusts acoustic textures based on active visual theme.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| <kbd>/</kbd> | Global | Jump directly to topic search input |
| <kbd>Esc</kbd> | Practice Arena / Code Arena | Restart current snippet & reset session |
| <kbd>Tab</kbd> | Practice Arena / Code Arena | Advance to next snippet / paragraph |
| <kbd>Enter</kbd> | Code Arena | Smart Indent (auto-advances to matching code column) |
| <kbd>Esc</kbd> | Results Modal | Practice snippet again immediately |
| `Any key` | Arena | Automatically captures focus into the keystream |

---

## 🚀 Installation & Running Locally

1. **Activate Virtual Environment**:
```bash
source venv/bin/activate
```

2. **Run Database Migrations**:
```bash
python manage.py makemigrations
python manage.py migrate
```

3. **Start Development Server**:
```bash
python manage.py runserver 8000
```
Open **`http://127.0.0.1:8000`** in your browser.

4. **Run Test Suite**:
```bash
python manage.py test
```

---

Built with pride by **Naga Research Lab**.
=======
# topic-typer
>>>>>>> 5982049ebbe280bc75dcb872c8beaec2d13cd215
