# TopicTyper — Learn While You Type

An open-learning typing & reading experiment built by **Naga Research Lab**. Learn interesting Wikipedia topics while improving your typing speed and accuracy.

![Theme](https://img.shields.io/badge/Theme-Deep%20Midnight%20Navy-0B1120?style=flat-square&labelColor=0B1120&color=38BDF8)
![Built By](https://img.shields.io/badge/Built%20By-Naga%20Research%20Lab-10B981?style=flat-square&labelColor=131C31)
![Backend](https://img.shields.io/badge/Backend-Django%206%20%2F%20SQLite3-38BDF8?style=flat-square&labelColor=131C31)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20HTML5%20Canvas%20%2F%20CSS3-10B981?style=flat-square&labelColor=131C31)

---

## 🌟 Django Architecture & Features

TopicTyper is structured as a full-featured Django web application with a core app named `typer`, SQLite database persistence, and a modular client-side engine:

### 1. Project & App Structure
- **`topictyper_project/`**: Django project configuration (`settings.py`, `urls.py`, `wsgi.py`).
- **`typer/`**: Core application module:
  - **`models.py`**: SQLite database models (`TypingSession`, `KeyStat`, `CachedTopic`).
  - **`views.py`**: Template rendering views (`home`, `practice`, `about`) and JSON REST API endpoints.
  - **`services.py`**: Wikipedia REST API fetching, fallback resolution, and text sanitization.
  - **`admin.py`**: Admin dashboard registration with custom filters and search capabilities.
  - **`templates/typer/`**: Django template inheritance (`base.html`, `index.html`, `practice.html`, `about.html`).
  - **`static/typer/`**: Clean asset organization (`css/style.css`, `js/app.js`, `img/logo.png`).

### 2. SQLite Database Models
- **`TypingSession`**: Stores completed practice runs with `topic_title`, `mode`, `duration_seconds`, `wpm`, `raw_wpm`, `accuracy`, `errors_count`, `characters_typed`, and timestamp.
- **`KeyStat`**: Tracks per-character attempts and errors across all sessions, calculating exact error rate percentages.
- **`CachedTopic`**: Caches sanitized Wikipedia article extracts, descriptions, and source URLs to guarantee instantaneous load times.

### 3. REST API Endpoints
- `GET /api/topic/?q=<query>`: Checks `CachedTopic` first (case-insensitive); if not cached, fetches Wikipedia's REST API, sanitizes text, caches it in SQLite, and returns JSON.
- `GET /api/topic/random/`: Fetches a random Wikipedia summary, sanitizes it, caches it in SQLite, and returns JSON.
- `POST /api/session/save/`: Validates CSRF token, saves a new `TypingSession`, and atomically increments `KeyStat` records.
- `GET /api/analytics/`: Returns the last 15 `TypingSession` records (ordered oldest-to-newest for the progress chart) and top weak keys from `KeyStat`.

---

## 🎨 Color Psychology & Aesthetics

- **Deep Midnight Navy (`#0B1120`)**: Ambient geometric dot-matrix background with GPU-accelerated drifting ambient gradient orbs (`#38BDF8`, `#6366F1`, `#10B981`).
- **Elevated Slate-Glass Cards (`#131C31`)**: Subtle `1px solid rgba(148, 163, 184, 0.12)` borders.
- **Cognitive Sky Blue (`#38BDF8`)**: High-visibility accent for active carets, links, and primary CTA buttons.
- **Emerald (`#10B981`)**: Positive feedback for correct keystrokes and high accuracy.
- **Soft Coral (`#F43F5E`)**: Gentle typo identification with subtle coral highlights.

---

## 🎧 Procedural Web Audio API Sound Engine

TopicTyper features a zero-dependency, procedural acoustic synthesis sound studio modeled after mechanical switches and retro typewriters:

- **Dynamics Compression & Clean Master Bus**: Powered by a `DynamicsCompressorNode` and `GainNode` to ensure rapid 100+ WPM typing bursts never distort or clip.
- **Organic Micro-Randomization**: Every keystroke applies a subtle `±6%` pitch frequency variation and `±5%` gain jitter to emulate natural physical switch variations.
- **Differentiated Key Modeling**: Distinct acoustic profiles for regular character keys, spacebars (deep resonant hollow thump with stabilizer rattle), backspace (softer reverse-feel tap), enter/tab (solid clack return), and mistakes (gentle muted ~95 Hz thud).
- **Selectable Switch Profiles**:
  - **Creamy Thock (Default)**: Deep PBT switch punch (`~240 Hz` down to `110 Hz`).
  - **Tactile Brown**: Balanced mid-range bump (`~330 Hz` down to `160 Hz`).
  - **Clicky Blue**: Sharp high-frequency click-jacket snap (`2.4 kHz` transient).
  - **Retro Typewriter**: Heavy vintage strike clack with metallic carriage return bell (`2093 Hz C7`).
  - **Theme Sync (Auto)**: Dynamically adjusts acoustic textures based on active theme (cyber synth blips in Hacking, arcade pops in Funny/Arcade, IDE taps in Coding, creamy thock in Midnight).
- **Milestone Chimes & Fanfares**: Harmonic chord completion chimes (`C5 - E5 - G5`) and celebratory 5-note sparkle fanfares (`C5 -> E5 -> G5 -> B5 -> C6`) whenever a new Personal Best WPM is achieved.

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

## 🚀 Installation & Running Locally

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Run Database Migrations**:
```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

3. **Start Development Server**:
```bash
python3 manage.py runserver 8000
```
Open **`http://127.0.0.1:8000`** in your browser.

4. **Run Test Suite**:
```bash
python3 manage.py test
```
