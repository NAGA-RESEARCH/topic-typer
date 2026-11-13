/**
 * TOPIC TYPER - Modular Core Application
 * 
 * 1. TextSanitizer: Strips citations, cleans unicode, chunks into 50-70 words.
 * 2. WikipediaService: Integrates with Wikipedia REST API & Random Summary endpoint.
 * 3. SoundService: Web Audio API tactile mechanical typing sounds.
 * 4. TypingEngine: Interactive typing engine with real-time character comparison & smooth caret tracking.
 * 5. UIController: Wires together UI state, events, animations, randomizer, and modals.
 */

// ============================================================================
// 1. TEXT SANITIZER & CHUNKER MODULE
// ============================================================================
const TextSanitizer = {
  /**
   * Cleans raw Wikipedia extract text:
   * - Strips citations like [1], [edit], [citation needed]
   * - Strips HTML tags
   * - Normalizes unicode quotes, dashes, ellipsis, spaces
   * - Normalizes diacritics to standard ASCII
   * - Cleans up orphaned spaces before punctuation
   */
  sanitize(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    return rawText
      // Remove HTML tags if present
      .replace(/<[^>]*>/g, '')
      // Remove bracketed citations and editor tags e.g. [1], [12], [edit], [citation needed], [note 1]
      .replace(/\[\s*(?:\d+|edit|citation needed|note\s*\d+|[a-zA-Z\s]+)\s*\]/gi, '')
      // Normalize unicode single quotes & apostrophes to ASCII '
      .replace(/[\u2018\u2019\u201A\u201B\u02BC\u02B9\u0060\u00B4]/g, "'")
      // Normalize unicode double quotes to ASCII "
      .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
      // Normalize dashes (en-dash, em-dash, minus, horizontal bar) to standard hyphen -
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
      // Normalize ellipsis … to ...
      .replace(/\u2026/g, '...')
      // Normalize unusual spaces (non-breaking space, thin space, etc.) to standard space
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
      // Normalize diacritics / accents (e.g. résumé -> resume, Schrödinger -> Schrodinger)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace unusual math symbols with readable ASCII
      .replace(/[×]/g, 'x')
      .replace(/[÷]/g, '/')
      // Strip control chars or non-printable ASCII (retain printable ASCII: 0x20 to 0x7E)
      .replace(/[^\x20-\x7E]/g, '')
      // Clean empty parentheses or brackets left behind by citations
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      // Fix spaces immediately preceding punctuation (e.g., "word ." -> "word.")
      .replace(/\s+([.,;:!?])/g, '$1')
      // Collapse multiple whitespace into a single space
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Splits text into natural sentences
   */
  splitSentences(text) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
        const sentences = Array.from(segmenter.segment(text), s => s.segment.trim()).filter(Boolean);
        if (sentences.length > 0) return sentences;
      } catch (e) {
        // Fallback to regex
      }
    }
    // Regex fallback
    return text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [text];
  },

  /**
   * Sanitizes and chunks text into clean 50-70 word typing chunks.
   * Maintains sentence boundaries whenever possible.
   */
  chunkText(rawText, minWords = 50, maxWords = 70) {
    const clean = this.sanitize(rawText);
    if (!clean) return [];

    const totalWords = clean.split(/\s+/).filter(Boolean);
    // If the whole text fits in maxWords, return as single chunk
    if (totalWords.length <= maxWords) {
      return [clean];
    }

    const sentences = this.splitSentences(clean);
    const chunks = [];
    let currentWords = [];

    for (const sentence of sentences) {
      const sWords = sentence.split(/\s+/).filter(Boolean);
      if (sWords.length === 0) continue;

      // Handle rare case where a single sentence exceeds maxWords
      if (sWords.length > maxWords) {
        if (currentWords.length > 0) {
          chunks.push(currentWords.join(' '));
          currentWords = [];
        }
        for (let i = 0; i < sWords.length; i += 60) {
          chunks.push(sWords.slice(i, i + 60).join(' '));
        }
        continue;
      }

      // Check if adding this sentence stays within maxWords
      if (currentWords.length + sWords.length <= maxWords) {
        currentWords.push(...sWords);
      } else {
        // Adding sentence pushes past maxWords
        if (currentWords.length >= minWords || chunks.length === 0) {
          chunks.push(currentWords.join(' '));
          currentWords = [...sWords];
        } else {
          // If current is slightly under minWords, allow slight overflow up to maxWords + 8
          if (currentWords.length + sWords.length <= maxWords + 8) {
            currentWords.push(...sWords);
            chunks.push(currentWords.join(' '));
            currentWords = [];
          } else {
            chunks.push(currentWords.join(' '));
            currentWords = [...sWords];
          }
        }
      }
    }

    if (currentWords.length > 0) {
      // If trailing chunk is very small (< 22 words) and we have a previous chunk, merge if reasonable
      if (chunks.length > 0 && currentWords.length < 22) {
        const prevWords = chunks[chunks.length - 1].split(/\s+/);
        if (prevWords.length + currentWords.length <= maxWords + 16) {
          chunks[chunks.length - 1] = [...prevWords, ...currentWords].join(' ');
        } else {
          chunks.push(currentWords.join(' '));
        }
      } else {
        chunks.push(currentWords.join(' '));
      }
    }

    return chunks.filter(c => c.trim().length > 0);
  }
};

// ============================================================================
// 2. WIKIPEDIA API SERVICE (WITH RANDOM SUMMARY INTEGRATION)
// ============================================================================

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.getAttribute('content')) {
    return meta.getAttribute('content');
  }
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (let c of cookies) {
    const trimmed = c.trim();
    if (trimmed.startsWith('csrftoken=')) {
      return decodeURIComponent(trimmed.substring(10));
    }
  }
  return '';
}


// ============================================================================
// 1.5 THEME SERVICE & THEME-AWARE AMBIENT ENGINE
// ============================================================================
const ThemeService = {
  THEMES: ['midnight', 'coding', 'hacking', 'funny'],
  currentTheme: 'midnight',

  init() {
    this.currentTheme = localStorage.getItem('topictyper_theme') || 'midnight';
    if (!this.THEMES.includes(this.currentTheme)) {
      this.currentTheme = 'midnight';
    }
    this.applyTheme(this.currentTheme, false);
    this.bindEvents();
  },

  applyTheme(theme, save = true) {
    if (!this.THEMES.includes(theme)) theme = 'midnight';
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      try {
        localStorage.setItem('topictyper_theme', theme);
      } catch (e) {}
    }
    this.updateUI();
    window.dispatchEvent(new CustomEvent('topictyper:themechange', { detail: { theme } }));
  },

  updateUI() {
    const activeLabelEl = document.getElementById('theme-active-name');
    if (activeLabelEl) {
      const names = {
        midnight: 'Midnight',
        coding: 'Coding IDE',
        hacking: 'Hacking',
        funny: 'Arcade'
      };
      activeLabelEl.textContent = names[this.currentTheme] || 'Theme';
    }

    const options = document.querySelectorAll('.theme-option-btn');
    options.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.theme === this.currentTheme);
    });
  },

  bindEvents() {
    const menuBtn = document.getElementById('theme-menu-btn');
    const dropdownMenu = document.getElementById('theme-dropdown-menu');

    if (menuBtn && dropdownMenu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdownMenu.classList.contains('hidden');
        dropdownMenu.classList.toggle('hidden', !isHidden);
        menuBtn.setAttribute('aria-expanded', String(isHidden));
      });

      document.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
          dropdownMenu.classList.add('hidden');
          menuBtn.setAttribute('aria-expanded', 'false');
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdownMenu.classList.contains('hidden')) {
          dropdownMenu.classList.add('hidden');
          menuBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const options = document.querySelectorAll('.theme-option-btn');
    options.forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.theme;
        this.applyTheme(selected);
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
      });
    });
  }
};

const AmbientEngine = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  animId: null,
  theme: 'midnight',
  particles: [],
  matrixColumns: [],

  init() {
    this.canvas = document.getElementById('ambient-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    this.theme = document.documentElement.getAttribute('data-theme') || 'midnight';
    this.resize();
    this.setupThemeParticles();

    window.addEventListener('resize', () => {
      this.resize();
      this.setupThemeParticles();
    });

    window.addEventListener('topictyper:themechange', (e) => {
      this.theme = e.detail?.theme || 'midnight';
      this.setupThemeParticles();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
      } else {
        this.start();
      }
    });

    this.start();
  },

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  },

  setupThemeParticles() {
    this.particles = [];
    this.matrixColumns = [];

    if (this.theme === 'hacking') {
      // Matrix rain columns
      const colWidth = 20;
      const colCount = Math.floor(this.width / colWidth);
      for (let i = 0; i < colCount; i++) {
        this.matrixColumns.push({
          x: i * colWidth,
          y: Math.random() * -this.height,
          speed: 2.2 + Math.random() * 3.5,
          length: Math.floor(10 + Math.random() * 18)
        });
      }
    } else if (this.theme === 'coding') {
      // Syntax tokens
      const tokens = ['{ }', '< >', '=>', '01', '//', 'fn()', '++', '&&', '::', 'const', 'return'];
      const count = Math.min(26, Math.floor(this.width / 50));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          text: tokens[Math.floor(Math.random() * tokens.length)],
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.3 - Math.random() * 0.5,
          alpha: 0.12 + Math.random() * 0.22,
          size: 13 + Math.random() * 8
        });
      }
    } else if (this.theme === 'funny') {
      // Arcade confetti
      const shapes = ['★', '◆', '●', '▲', '✦'];
      const colors = ['#FF6B6B', '#FFD93D', '#4CC9F0', '#9D4EDD', '#A6E3A1'];
      const count = Math.min(32, Math.floor(this.width / 45));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.4 - Math.random() * 0.6,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.03,
          size: 14 + Math.random() * 10,
          alpha: 0.20 + Math.random() * 0.25
        });
      }
    } else {
      // Midnight constellation nodes
      const count = Math.min(36, Math.floor(this.width / 40));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: 1.5 + Math.random() * 2.5,
          alpha: 0.2 + Math.random() * 0.35
        });
      }
    }
  },

  start() {
    if (this.animId) return;
    const loop = () => {
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  },

  draw() {
    if (!this.ctx || !this.width || !this.height) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.theme === 'hacking') {
      this.drawMatrixRain();
    } else if (this.theme === 'coding') {
      this.drawSyntaxTokens();
    } else if (this.theme === 'funny') {
      this.drawConfetti();
    } else {
      this.drawConstellation();
    }
  },

  drawMatrixRain() {
    const chars = '0123456789ABCDEF$#@*<>~¥§';
    this.ctx.font = '13px monospace';

    for (const col of this.matrixColumns) {
      col.y += col.speed;
      if (col.y > this.height + col.length * 16) {
        col.y = -col.length * 16;
        col.speed = 2.2 + Math.random() * 3.5;
      }

      for (let j = 0; j < col.length; j++) {
        const charY = col.y - j * 16;
        if (charY < -16 || charY > this.height) continue;

        const isLead = (j === 0);
        const alpha = isLead ? 0.85 : Math.max(0.04, 0.26 * (1 - j / col.length));
        this.ctx.fillStyle = isLead ? '#FFFFFF' : `rgba(0, 255, 65, ${alpha})`;

        const glyph = chars[Math.floor((col.x + j * 7 + Date.now() / 200) % chars.length)];
        this.ctx.fillText(glyph, col.x, charY);
      }
    }
  },

  drawSyntaxTokens() {
    this.ctx.font = '14px JetBrains Mono, monospace';
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -30) p.y = this.height + 20;
      if (p.x < -30) p.x = this.width + 20;
      if (p.x > this.width + 30) p.x = -20;

      this.ctx.fillStyle = `rgba(203, 166, 247, ${p.alpha})`;
      this.ctx.fillText(p.text, p.x, p.y);
    }
  },

  drawConfetti() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;

      if (p.y < -30) p.y = this.height + 20;
      if (p.x < -30) p.x = this.width + 20;
      if (p.x > this.width + 30) p.x = -20;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rot);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.font = `${p.size}px sans-serif`;
      this.ctx.fillText(p.shape, -p.size / 2, p.size / 2);
      this.ctx.restore();
    }
  },

  drawConstellation() {
    this.ctx.lineWidth = 0.8;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          const lineAlpha = (1 - dist / 110) * 0.16;
          this.ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha})`;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;

      this.ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
};

const WikipediaService = {
  // Curated diverse categories & topics for shuffling and fallback
  curatedTopics: [
    { title: 'Science', icon: '🔬' },
    { title: 'History', icon: '📜' },
    { title: 'Space Exploration', icon: '🚀' },
    { title: 'Technology', icon: '💻' },
    { title: 'Cinema', icon: '🎬' },
    { title: 'Nature', icon: '🌿' },
    { title: 'Solar System', icon: '🪐' },
    { title: 'Artificial Intelligence', icon: '🤖' },
    { title: 'Neuroscience', icon: '🧠' },
    { title: 'Ancient Rome', icon: '🏛️' },
    { title: 'Dinosaurs', icon: '🦖' },
    { title: 'Ocean', icon: '🌊' },
    { title: 'Music', icon: '🎵' },
    { title: 'Philosophy', icon: '📚' },
    { title: 'Renaissance', icon: '🎨' },
    { title: 'Albert Einstein', icon: '💡' }
  ],

  // Built-in offline fallback topics in case network is disconnected
  fallbacks: {
    'quantum computing': {
      title: 'Quantum computing',
      description: 'Computer hardware technology that uses quantum mechanics',
      extract: 'A quantum computer is a computer that represents and processes information using quantum states. Quantum computations exploit phenomena such as superposition, interference, and entanglement. Quantum computers have the potential to complete some calculations exponentially faster than classical computers. For example, a large-scale quantum computer could break widely used encryption schemes and aid physicists in performing physical simulations. However, current hardware implementations of quantum computation are largely experimental and suitable for only certain specialized tasks.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Quantum_computing' } }
    },
    'computer science': {
      title: 'Computer science',
      description: 'Study of computation, information, and automation',
      extract: 'Computer science is the study of computation, information, and automation. Computer science spans theoretical disciplines such as algorithms, theory of computation, and information theory to applied disciplines including the design and implementation of hardware and software. Though more recently considered an academic discipline, computing had existed for decades before that, and computer technology had developed into a field of study in its own right.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Computer_science' } }
    },
    'space exploration': {
      title: 'Space exploration',
      description: 'Use of astronomy and space technology to explore outer space',
      extract: 'Space exploration is the use of astronomy and space technology to explore outer space. While the exploration of space is carried out mainly by astronomers with telescopes, its physical exploration is conducted both by uncrewed robotic space probes and human spaceflight. Space exploration serves as one of the areas for international competition and collaboration.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Space_exploration' } }
    }
  },

  /**
   * Fetches topic summary using Wikipedia REST API:
   * https://en.wikipedia.org/api/rest_v1/page/summary/{topic}
   */
  async fetchTopicSummary(topicQuery) {
    const rawQuery = topicQuery.trim();
    if (!rawQuery) throw new Error('Please enter a valid topic name.');

    // 1. Django SQLite Backend REST API (/api/topic/?q=...)
    try {
      const apiRes = await fetch(`/api/topic/?q=${encodeURIComponent(rawQuery)}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.extract && data.extract.trim().length > 0) {
          return {
            title: data.title,
            description: data.description || 'Wikipedia Article Summary',
            extract: data.extract,
            url: data.source_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
            thumbnail: null
          };
        }
      }
    } catch (err) {
      console.warn('Backend /api/topic/ fetch failed, attempting client Wikipedia fallback...', err);
    }

    const headers = { 'Api-User-Agent': 'TopicTyper/1.0 (typing-practice-app)' };
    const formattedTitle = rawQuery.replace(/\s+/g, '_');

    // 2. Direct REST Summary Request
    try {
      const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(formattedTitle)}`;
      const res = await fetch(directUrl, { headers });

      if (res.ok) {
        const data = await res.json();
        if (data.type === 'standard' && data.extract && data.extract.trim().length > 30) {
          return {
            title: data.title,
            description: data.description || 'Wikipedia Article Summary',
            extract: data.extract,
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
            thumbnail: data.thumbnail?.source || null
          };
        }
      }
    } catch (err) {
      console.warn('Direct REST summary fetch failed, attempting search fallback...', err);
    }

    // 2. Fallback Search: If direct query returned 404 or disambiguation
    try {
      const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(rawQuery)}&limit=5`;
      const searchRes = await fetch(searchUrl, { headers });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.pages && searchData.pages.length > 0) {
          for (const page of searchData.pages) {
            if (page.description && page.description.toLowerCase().includes('disambiguation')) {
              continue;
            }
            const candUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.key)}`;
            const candRes = await fetch(candUrl, { headers });
            if (candRes.ok) {
              const candData = await candRes.json();
              if (candData.extract && candData.extract.trim().length > 30) {
                return {
                  title: candData.title,
                  description: candData.description || page.description || 'Wikipedia Article Summary',
                  extract: candData.extract,
                  url: candData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(candData.title)}`,
                  thumbnail: candData.thumbnail?.source || null
                };
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Title search fallback failed, attempting full text search...', err);
    }

    // 3. Fallback Full Search
    try {
      const querySearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(rawQuery)}&format=json&origin=*`;
      const qRes = await fetch(querySearchUrl);
      if (qRes.ok) {
        const qData = await qRes.json();
        if (qData.query?.search?.length > 0) {
          const topTitle = qData.query.search[0].title.replace(/\s+/g, '_');
          const finalUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
          const finalRes = await fetch(finalUrl, { headers });
          if (finalRes.ok) {
            const finalData = await finalRes.json();
            if (finalData.extract && finalData.extract.trim().length > 30) {
              return {
                title: finalData.title,
                description: finalData.description || 'Wikipedia Article Summary',
                extract: finalData.extract,
                url: finalData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(finalData.title)}`,
                thumbnail: finalData.thumbnail?.source || null
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('Wikipedia full search failed.', err);
    }

    // 4. Built-in fallback check if offline
    const lower = rawQuery.toLowerCase();
    for (const [key, fallbackData] of Object.entries(this.fallbacks)) {
      if (lower.includes(key) || key.includes(lower)) {
        return {
          title: fallbackData.title,
          description: fallbackData.description,
          extract: fallbackData.extract,
          url: fallbackData.content_urls.desktop.page,
          thumbnail: null
        };
      }
    }

    throw new Error(`Could not find a summary on Wikipedia for "${rawQuery}". Please try another topic.`);
  },

  /**
   * Fetches a dynamic random summary from Wikipedia REST API:
   * https://en.wikipedia.org/api/rest_v1/page/random/summary
   * Falls back to a random topic from the curated interesting pool.
   */
  async fetchRandomTopicSummary() {
    // 1. Django SQLite Backend Random Topic API (/api/topic/random/)
    try {
      const apiRes = await fetch('/api/topic/random/');
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.extract && data.extract.trim().length > 0) {
          return {
            title: data.title,
            description: data.description || 'Wikipedia Article Summary',
            extract: data.extract,
            url: data.source_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
            thumbnail: null
          };
        }
      }
    } catch (err) {
      console.warn('Backend /api/topic/random/ fetch failed, falling back to direct Wikipedia...', err);
    }

    const headers = { 'Api-User-Agent': 'TopicTyper/1.0 (typing-practice-app)' };

    // Try Wikipedia's official random summary endpoint
    try {
      const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary', { headers });
      if (res.ok) {
        const data = await res.json();
        const wordCount = (data.extract || '').trim().split(/\s+/).filter(Boolean).length;
        // Make sure it is a standard article with a readable extract
        if (data.type === 'standard' && wordCount >= 35) {
          return {
            title: data.title,
            description: data.description || 'Random Wikipedia Article',
            extract: data.extract,
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
            thumbnail: data.thumbnail?.source || null
          };
        }
      }
    } catch (err) {
      console.warn('Random summary endpoint failed, picking from curated pool...', err);
    }

    // If random summary was a tiny stub or failed, pick from curated topics
    const randomItem = this.curatedTopics[Math.floor(Math.random() * this.curatedTopics.length)];
    return this.fetchTopicSummary(randomItem.title);
  }
};

// ============================================================================
// 3. SOUND SYNTHESIZER SERVICE (Web Audio API)
// ============================================================================
const SoundService = {
  audioCtx: null,
  enabled: true,

  init() {
    if (!this.audioCtx && typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  playKeyClick(isError = false) {
    if (!this.enabled) return;
    try {
      if (!this.audioCtx) this.init();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      if (isError) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      }

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      // Audio autoplay policy or unavailable
    }
  }
};

// ============================================================================
// 4. INTELLIGENT TYPING ANALYTICS & WEAK KEYS DETECTOR
// ============================================================================
const AnalyticsService = {
  SESSIONS_KEY: 'topictyper_sessions',
  KEYSTATS_KEY: 'topictyper_keystats',

  // Safe localStorage helper
  getStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage quota or private browsing restriction
    }
  },

  // --------------------------------------------------------------------------
  // Sessions Management
  // --------------------------------------------------------------------------
  getSessions() {
    const sessions = this.getStorage(this.SESSIONS_KEY);
    return Array.isArray(sessions) ? sessions : [];
  },

  saveSession(sessionData) {
    const sessions = this.getSessions();
    sessions.unshift(sessionData);
    if (sessions.length > 50) {
      sessions.length = 50;
    }
    this.setStorage(this.SESSIONS_KEY, sessions);
    return sessions;
  },

  async saveSessionToServer(sessionData, keyStats = {}) {
    const payload = {
      topic_title: sessionData.topic || 'Unknown Topic',
      mode: sessionData.mode || 'paragraph',
      duration_seconds: sessionData.elapsedSeconds || sessionData.duration || 0,
      wpm: sessionData.wpm || 0,
      raw_wpm: sessionData.rawWpm || 0,
      accuracy: sessionData.accuracy || 100,
      errors_count: sessionData.errorCount || sessionData.errors || 0,
      characters_typed: sessionData.charactersTyped || sessionData.characters || 0,
      key_stats: keyStats
    };

    try {
      const res = await fetch('/api/session/save/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (err) {
      console.warn('POST /api/session/save/ failed, saved to localStorage fallback:', err);
    }
    return null;
  },

  clearSessions() {
    try {
      localStorage.removeItem(this.SESSIONS_KEY);
    } catch (e) {}
  },

  // --------------------------------------------------------------------------
  // Keystroke Accuracy Tracking
  // --------------------------------------------------------------------------
  getKeyStats() {
    let stats = this.getStorage(this.KEYSTATS_KEY);
    if (!stats || typeof stats !== 'object') {
      stats = {};
    }
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    letters.push(' ');
    letters.forEach(char => {
      if (!stats[char]) {
        stats[char] = { attempts: 0, errors: 0 };
      }
    });
    return stats;
  },

  recordKey(rawChar, isCorrect) {
    if (!rawChar) return;
    const char = (rawChar === ' ') ? ' ' : rawChar.toLowerCase();
    // Only track alphabet keys and spacebar
    if (!/^[a-z ]$/.test(char)) return;

    const stats = this.getKeyStats();
    if (!stats[char]) {
      stats[char] = { attempts: 0, errors: 0 };
    }
    stats[char].attempts = (stats[char].attempts || 0) + 1;
    if (!isCorrect) {
      stats[char].errors = (stats[char].errors || 0) + 1;
    }
    this.setStorage(this.KEYSTATS_KEY, stats);
  },

  clearKeyStats() {
    try {
      localStorage.removeItem(this.KEYSTATS_KEY);
    } catch (e) {}
  },

  getWeakKeys(limit = 5) {
    const stats = this.getKeyStats();
    const evaluated = [];

    for (const [key, data] of Object.entries(stats)) {
      if (data.attempts > 0) {
        const errorRate = (data.errors / data.attempts) * 100;
        const accuracy = 100 - errorRate;
        evaluated.push({
          key,
          attempts: data.attempts,
          errors: data.errors,
          errorRate: Math.round(errorRate * 10) / 10,
          accuracy: Math.round(accuracy * 10) / 10
        });
      }
    }

    if (evaluated.length === 0) {
      return [];
    }

    // Sort: keys with errors first (highest error rate, then error count), then lowest accuracy
    evaluated.sort((a, b) => {
      if (a.errors > 0 && b.errors === 0) return -1;
      if (b.errors > 0 && a.errors === 0) return 1;
      if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
      if (b.errors !== a.errors) return b.errors - a.errors;
      return b.attempts - a.attempts;
    });

    return evaluated.slice(0, limit).map(item => {
      let colorClass = 'emerald';
      if (item.errorRate > 15) {
        colorClass = 'coral';
      } else if (item.errorRate >= 5) {
        colorClass = 'amber';
      }
      return {
        ...item,
        colorClass,
        displayKey: item.key === ' ' ? 'SPACE' : item.key.toUpperCase()
      };
    });
  },

  // --------------------------------------------------------------------------
  // Custom 40-Word Weak Keys Drill Generator
  // --------------------------------------------------------------------------
    generateWeakDrillWithKeys(targetLetters = ['e', 'r', 't'], targetWordCount = 40) {
    if (!targetLetters || targetLetters.length === 0) {
      targetLetters = ['e', 'r', 't'];
    }
    const dictionary = [
      'quantum', 'puzzle', 'breeze', 'galaxy', 'explore', 'oxygen', 'matrix', 'zenith',
      'sphinx', 'crystal', 'hazard', 'velvet', 'balance', 'dynamic', 'vortex', 'quartz',
      'subtle', 'symbol', 'copper', 'liquid', 'knight', 'trophy', 'memory', 'binary',
      'beacon', 'anchor', 'sphere', 'mystic', 'frozen', 'canyon', 'silver', 'cosmic',
      'jungle', 'dragon', 'mirror', 'horizon', 'shield', 'voyage', 'summit', 'kernel',
      'temple', 'orbit', 'spark', 'weapon', 'cipher', 'stream', 'rocket', 'vector',
      'forest', 'marble', 'island', 'falcon', 'engine', 'plasma', 'shadow', 'planet',
      'system', 'wisdom', 'energy', 'bridge', 'method', 'nature', 'public', 'aspect',
      'packet', 'bypass', 'zebra', 'plaza', 'boxing', 'problem', 'project', 'syntax',
      'sample', 'complex', 'expert', 'prefix', 'blaze', 'bronze', 'pixel', 'flight',
      'impact', 'volume', 'fabric', 'vibrant', 'quick', 'yellow', 'brave', 'climb',
      'depth', 'flame', 'globe', 'heavy', 'ivory', 'jewel', 'kneel', 'lemon', 'magic',
      'noble', 'ocean', 'pride', 'quest', 'river', 'stone', 'tiger', 'unity', 'valor',
      'wheel', 'youth', 'zebra', 'amber', 'bloom', 'charm', 'drift', 'eagle', 'frost',
      'glory', 'haven', 'inlet', 'jolly', 'karma', 'lunar', 'merit', 'nexus', 'oasis',
      'pulse', 'realm', 'solar', 'track', 'urban', 'vigor', 'wave', 'yield', 'zone'
    ];

    const scoredWords = dictionary.map(word => {
      let score = 0;
      for (const char of word) {
        if (targetLetters.includes(char)) score += 3;
      }
      return { word, score };
    });

    scoredWords.sort((a, b) => b.score - a.score || Math.random() - 0.5);
    const chosen = [];
    let idx = 0;
    while (chosen.length < targetWordCount) {
      if (idx < scoredWords.length) {
        chosen.push(scoredWords[idx].word);
        idx++;
      } else {
        idx = 0;
        chosen.push(scoredWords[Math.floor(Math.random() * Math.min(25, scoredWords.length))].word);
      }
    }
    const shuffledWords = chosen.sort(() => 0.5 - Math.random());
    return {
      weakKeys: targetLetters,
      wordsText: shuffledWords.join(' '),
      wordCount: targetWordCount
    };
  },

  generateWeakDrill(targetWordCount = 40) {
    const topWeak = this.getWeakKeys(5);
    let targetLetters = [];

    if (topWeak.length > 0 && topWeak.some(k => k.errors > 0)) {
      targetLetters = topWeak.filter(k => k.key !== ' ' && k.errors > 0).map(k => k.key);
    }

    // If fewer than 3 target letters, add common agility/finger-coordination letters
    const defaultAgilityLetters = ['p', 'b', 'q', 'z', 'x', 'v', 'k', 'j'];
    for (const letter of defaultAgilityLetters) {
      if (targetLetters.length >= 4) break;
      if (!targetLetters.includes(letter)) {
        targetLetters.push(letter);
      }
    }

    // Curated rich vocabulary of engaging English words
    const dictionary = [
      'quantum', 'puzzle', 'breeze', 'galaxy', 'explore', 'oxygen', 'matrix', 'zenith',
      'sphinx', 'crystal', 'hazard', 'velvet', 'balance', 'dynamic', 'vortex', 'quartz',
      'subtle', 'symbol', 'copper', 'liquid', 'knight', 'trophy', 'memory', 'binary',
      'beacon', 'anchor', 'sphere', 'mystic', 'frozen', 'canyon', 'silver', 'cosmic',
      'jungle', 'dragon', 'mirror', 'horizon', 'shield', 'voyage', 'summit', 'kernel',
      'temple', 'orbit', 'spark', 'weapon', 'cipher', 'stream', 'rocket', 'vector',
      'forest', 'marble', 'island', 'falcon', 'engine', 'plasma', 'shadow', 'planet',
      'system', 'wisdom', 'energy', 'bridge', 'method', 'nature', 'public', 'aspect',
      'packet', 'bypass', 'zebra', 'plaza', 'boxing', 'problem', 'project', 'syntax',
      'sample', 'complex', 'expert', 'prefix', 'blaze', 'bronze', 'pixel', 'flight',
      'impact', 'volume', 'fabric', 'vibrant', 'quick', 'yellow', 'brave', 'climb',
      'depth', 'flame', 'globe', 'heavy', 'ivory', 'jewel', 'kneel', 'lemon', 'magic',
      'noble', 'ocean', 'pride', 'quest', 'river', 'stone', 'tiger', 'unity', 'valor',
      'wheel', 'youth', 'zebra', 'amber', 'bloom', 'charm', 'drift', 'eagle', 'frost',
      'glory', 'haven', 'inlet', 'jolly', 'karma', 'lunar', 'merit', 'nexus', 'oasis',
      'pulse', 'realm', 'solar', 'track', 'urban', 'vigor', 'wave', 'yield', 'zone'
    ];

    // Score dictionary words based on presence and count of targetLetters
    const scoredWords = dictionary.map(word => {
      let score = 0;
      for (const char of word) {
        if (targetLetters.includes(char)) {
          score += 3;
        }
      }
      return { word, score };
    });

    // Sort by weak key density
    scoredWords.sort((a, b) => b.score - a.score || Math.random() - 0.5);

    const chosen = [];
    let idx = 0;
    while (chosen.length < targetWordCount) {
      if (idx < scoredWords.length) {
        chosen.push(scoredWords[idx].word);
        idx++;
      } else {
        idx = 0;
        chosen.push(scoredWords[Math.floor(Math.random() * Math.min(25, scoredWords.length))].word);
      }
    }

    // Shuffle slightly for natural rhythmic typing
    const shuffledWords = chosen.sort(() => 0.5 - Math.random());

    return {
      weakKeys: targetLetters,
      wordsText: shuffledWords.join(' '),
      wordCount: targetWordCount
    };
  },

  // --------------------------------------------------------------------------
  // Canvas Chart Renderer (Bezier Curve + Area Gradient + Moving Average)
  // --------------------------------------------------------------------------
  renderWpmChart(canvasEl, tooltipEl, sessions, options = {}) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    // Filter to last 15 completed sessions (display in chronological order: oldest -> latest)
    const recentSessions = options.isChronological ? [...sessions].slice(-15) : [...sessions].reverse().slice(-15);
    const count = recentSessions.length;

    // High-DPI Canvas scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    const width = rect.width || canvasEl.parentElement?.clientWidth || (options.isModal ? 540 : 600);
    const height = rect.height || (options.isModal ? 130 : 200);

    canvasEl.width = width * dpr;
    canvasEl.height = height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (count === 0) {
      // Draw subtle placeholder grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 35) {
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
      }
      return;
    }

    // Chart margins
    const padLeft = options.isModal ? 34 : 44;
    const padRight = options.isModal ? 16 : 24;
    const padTop = options.isModal ? 18 : 24;
    const padBottom = options.isModal ? 26 : 32;

    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

    // Determine scale (min 60 WPM max ceiling for pleasant headroom)
    const maxDataWpm = Math.max(...recentSessions.map(s => s.wpm || 0), 0);
    const yMax = Math.max(60, Math.ceil((maxDataWpm * 1.2) / 10) * 10);
    const yMin = 0;

    const valToY = (val) => padTop + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
    const idxToX = (i) => {
      if (count === 1) return padLeft + plotW / 2;
      return padLeft + (i / (count - 1)) * plotW;
    };

    // 1. Draw horizontal grid lines & Y-axis labels
    const gridSteps = options.isModal ? 3 : 4;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px Inter, system-ui, sans-serif';

    for (let s = 0; s <= gridSteps; s++) {
      const stepVal = Math.round(yMin + (s / gridSteps) * (yMax - yMin));
      const gy = valToY(stepVal);

      // Grid line
      ctx.strokeStyle = (s === 0) ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(width - padRight, gy);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${stepVal}`, padLeft - 6, gy);
    }

    // 2. Prepare Point coordinates
    const points = recentSessions.map((s, idx) => ({
      x: idxToX(idx),
      y: valToY(s.wpm || 0),
      session: s,
      index: idx
    }));

    // 3. Draw Moving Average Line (3-session MA) in Emerald
    if (count > 1) {
      const maPoints = [];
      for (let i = 0; i < count; i++) {
        const windowStart = Math.max(0, i - 2);
        const windowSlice = recentSessions.slice(windowStart, i + 1);
        const avg = windowSlice.reduce((sum, item) => sum + (item.wpm || 0), 0) / windowSlice.length;
        maPoints.push({ x: idxToX(i), y: valToY(avg) });
      }

      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(maPoints[0].x, maPoints[0].y);
      for (let i = 1; i < maPoints.length; i++) {
        ctx.lineTo(maPoints[i].x, maPoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Smooth Cubic Spline Line & Gradient Fill
    if (count === 1) {
      // Single point: draw glowing indicator
      const pt = points[0];
      const grad = ctx.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, 26);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();

      // Path for area fill
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      // Close area path for linear gradient
      const lastPt = points[points.length - 1];
      const bottomY = padTop + plotH;
      ctx.lineTo(lastPt.x, bottomY);
      ctx.lineTo(points[0].x, bottomY);
      ctx.closePath();

      const areaGrad = ctx.createLinearGradient(0, padTop, 0, bottomY);
      areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.30)');
      areaGrad.addColorStop(1, 'rgba(56, 189, 248, 0.01)');
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Re-trace stroke
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw data points & X-axis session labels
    const hoveredIdx = canvasEl._hoveredPointIndex ?? -1;

    points.forEach((pt, i) => {
      const isHovered = (i === hoveredIdx);

      // X-Axis labels
      if (!options.isModal || i === 0 || i === count - 1 || count <= 6) {
        ctx.fillStyle = isHovered ? '#38BDF8' : '#64748b';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`#${i + 1}`, pt.x, padTop + plotH + 7);
      }

      // Outer glow on hovered point
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fill();
      }

      // Point circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isHovered ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0B1120';
      ctx.fill();
      ctx.lineWidth = isHovered ? 2.5 : 2;
      ctx.strokeStyle = '#38BDF8';
      ctx.stroke();
    });

    // 6. Interactive Tooltip & Hover Tracking
    if (!canvasEl._hasChartListeners && tooltipEl) {
      canvasEl._hasChartListeners = true;

      const handleMove = (e) => {
        const cRect = canvasEl.getBoundingClientRect();
        const mouseX = e.clientX - cRect.left;
        const mouseY = e.clientY - cRect.top;

        const currentPoints = canvasEl._points || [];
        let closest = null;
        let closestDist = Infinity;

        currentPoints.forEach((pt) => {
          const dx = pt.x - mouseX;
          const dy = pt.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist && Math.abs(dx) < 32) {
            closestDist = dist;
            closest = pt;
          }
        });

        if (closest && closestDist < 40) {
          if (canvasEl._hoveredPointIndex !== closest.index) {
            canvasEl._hoveredPointIndex = closest.index;
            AnalyticsService.renderWpmChart(canvasEl, tooltipEl, sessions, options);
          }

          const s = closest.session;
          tooltipEl.innerHTML = `
            <div class="tip-topic">${s.topic || 'Unknown'}</div>
            <div class="tip-stats">
              <span class="tip-wpm"><strong>${s.wpm || 0}</strong> WPM</span>
              <span class="tip-acc"><strong>${s.accuracy ?? 100}%</strong> Acc</span>
            </div>
            <div class="tip-meta">Part ${s.chunkIndex || 1} • ${s.timestamp || ''}</div>
          `;

          tooltipEl.style.left = `${closest.x}px`;
          tooltipEl.style.top = `${closest.y - 10}px`;
          tooltipEl.classList.remove('hidden');
        } else if (canvasEl._hoveredPointIndex !== -1) {
          canvasEl._hoveredPointIndex = -1;
          tooltipEl.classList.add('hidden');
          AnalyticsService.renderWpmChart(canvasEl, tooltipEl, sessions, options);
        }
      };

      const handleLeave = () => {
        canvasEl._hoveredPointIndex = -1;
        tooltipEl.classList.add('hidden');
        AnalyticsService.renderWpmChart(canvasEl, tooltipEl, sessions, options);
      };

      canvasEl.addEventListener('mousemove', handleMove);
      canvasEl.addEventListener('mouseleave', handleLeave);
    }

    // Cache current points for tooltip lookup
    canvasEl._points = points;
  },

  // --------------------------------------------------------------------------
  // Keyboard Heatmap & Weak Keys UI Renderer
  // --------------------------------------------------------------------------
  renderHeatmap(containerEl, customStats = null) {
    if (!containerEl) return;
    const stats = (customStats && typeof customStats === 'object' && Object.keys(customStats).length > 0)
      ? customStats
      : this.getKeyStats();

    const keyboardRows = [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
      [' ']
    ];

    containerEl.innerHTML = '';

    keyboardRows.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'heatmap-row';

      row.forEach(key => {
        const keyEl = document.createElement('div');
        const keyData = stats[key] || { attempts: 0, errors: 0 };
        const isSpace = (key === ' ');

        let statusClass = 'heat-untested';
        let tooltipText = `Key: ${isSpace ? 'SPACE' : key.toUpperCase()} | Untested`;

        if (keyData.attempts > 0) {
          const errRate = (keyData.errors / keyData.attempts) * 100;
          const acc = 100 - errRate;

          if (errRate > 15) {
            statusClass = 'heat-bad';
          } else if (errRate >= 5) {
            statusClass = 'heat-warn';
          } else {
            statusClass = 'heat-good';
          }

          tooltipText = `Key: ${isSpace ? 'SPACE' : key.toUpperCase()} | Error Rate: ${errRate.toFixed(1)}% | Accuracy: ${acc.toFixed(1)}% (${keyData.attempts - keyData.errors}/${keyData.attempts})`;
        }

        keyEl.className = `heat-key ${statusClass} ${isSpace ? 'heat-key-space' : ''}`;
        keyEl.textContent = isSpace ? 'SPACE' : key.toUpperCase();
        keyEl.title = tooltipText;
        keyEl.setAttribute('aria-label', tooltipText);

        rowDiv.appendChild(keyEl);
      });

      containerEl.appendChild(rowDiv);
    });
  },

  renderWeakKeysSummary(containerEl, customWeakKeys = null) {
    if (!containerEl) return;
    const weakKeys = (customWeakKeys && Array.isArray(customWeakKeys) && customWeakKeys.length > 0)
      ? customWeakKeys
      : this.getWeakKeys(5);

    containerEl.innerHTML = '';

    if (weakKeys.length === 0) {
      containerEl.innerHTML = `<span class="weak-pill-empty">No keys tested yet. Start typing to analyze your accuracy!</span>`;
      return;
    }

    const hasErrors = weakKeys.some(k => k.errors > 0);
    if (!hasErrors) {
      containerEl.innerHTML = `
        <span class="weak-pill emerald" title="All typed keys have 100% accuracy so far!">
          ✨ 100% Accuracy on all ${weakKeys.length} tested keys!
        </span>
      `;
      return;
    }

    weakKeys.forEach((item, idx) => {
      const pill = document.createElement('div');
      const colorClass = item.colorClass || (item.errorRate > 15 ? 'coral' : (item.errorRate >= 5 ? 'amber' : 'emerald'));
      pill.className = `weak-pill ${colorClass}`;
      pill.title = `${item.displayKey}: ${item.errorRate}% error rate (${item.errors} errors / ${item.attempts} attempts)`;
      pill.innerHTML = `
        <span>#${idx + 1} <strong>${item.displayKey}</strong></span>
        <span>${item.errorRate}% err</span>
      `;
      containerEl.appendChild(pill);
    });
  }
};

// ============================================================================
// 5. TYPING ENGINE (REFACTORED WITH PRECISION CARET TRACKING & KEY ANALYTICS)
// ============================================================================
class TypingEngine {
  constructor(options = {}) {
    this.wordsContainer = options.wordsContainer;
    this.caret = options.caret;
    this.hiddenInput = options.hiddenInput;
    this.onMetricsUpdate = options.onMetricsUpdate || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onChunkComplete = options.onChunkComplete || null;
    this.onPauseStateChange = options.onPauseStateChange || (() => {});

    // Practice Mode: 'paragraph' (default), 'timed', or 'drill'
    this.mode = options.mode || 'paragraph';
    this.timeLimit = options.timeLimit || 60; // in seconds for timed mode

    // Target text and flat list of character spans
    this.targetText = '';
    this.charSpans = [];
    this.activeCharIndex = 0;

    // Accurate Active Typing & Idle Pause Engine
    this.startTime = null;
    this.timerInterval = null;
    this.samplerInterval = null;
    this.idleTimeout = null;
    this.activeElapsedMs = 0;
    this.lastActiveTime = null;
    this.isPaused = false;
    this.cumulativeCorrectChars = 0;
    this.instantaneousSamples = [];

    // Metrics State
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.errorCount = 0;
    this.isCompleted = false;
    this.isModalOpen = false;
    this.sessionKeyStats = {};

    this.bindEvents();
  }

  recordSessionKey(rawChar, isCorrect) {
    if (!rawChar) return;
    const char = (rawChar === ' ') ? ' ' : rawChar.toLowerCase();
    if (!/^[a-z ]$/.test(char)) return;
    if (!this.sessionKeyStats[char]) {
      this.sessionKeyStats[char] = { attempts: 0, errors: 0 };
    }
    this.sessionKeyStats[char].attempts++;
    if (!isCorrect) {
      this.sessionKeyStats[char].errors++;
    }
    AnalyticsService.recordKey(char, isCorrect);
  }

  get currentIndex() {
    return this.activeCharIndex;
  }

  set currentIndex(val) {
    this.activeCharIndex = val;
  }

  bindEvents() {
    if (this.hiddenInput) {
      this.hiddenInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
      this.hiddenInput.addEventListener('input', (e) => this.handleInput(e));
    }
    window.addEventListener('resize', () => this.updateCaretPosition());
  }

  loadChunk(chunkText) {
    this.reset();
    this.targetText = chunkText.trim();
    this.renderDOM();
    this.updateMetrics();
    requestAnimationFrame(() => {
      this.updateCaretPosition();
    });
  }

  /**
   * Seamlessly loads the next paragraph in Timed Mode without stopping the active countdown!
   * Keeps active timer, elapsed time accumulation, and cumulative keystrokes intact.
   */
  loadNextChunkSeamlessly(chunkText) {
    if (this.wordsContainer) {
      const finishedCorrect = this.wordsContainer.querySelectorAll('.char.correct').length;
      this.cumulativeCorrectChars += finishedCorrect;
    }
    this.targetText = chunkText.trim();
    this.activeCharIndex = 0;
    this.renderDOM();
    if (this.hiddenInput) {
      this.hiddenInput.value = '';
    }
    requestAnimationFrame(() => {
      this.updateCaretPosition();
    });
    this.updateMetrics();
  }

  reset() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.samplerInterval) {
      clearInterval(this.samplerInterval);
      this.samplerInterval = null;
    }
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    this.startTime = null;
    this.activeElapsedMs = 0;
    this.lastActiveTime = null;
    this.isPaused = false;
    this.cumulativeCorrectChars = 0;
    this.instantaneousSamples = [];
    this.activeCharIndex = 0;
    this.charSpans = [];
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.errorCount = 0;
    this.isCompleted = false;
    this.isModalOpen = false;
    if (this.hiddenInput) {
      this.hiddenInput.value = '';
    }
    this.onPauseStateChange(false);
    if (this.caret) {
      this.caret.classList.remove('typing');
    }
  }

  /**
   * Renders target text with 1 span per character (and space).
   * Words are grouped into <span class="word"> with NO position:relative
   * so offsetLeft and offsetTop are relative to wordsContainer.
   */
  renderDOM() {
    if (!this.wordsContainer) return;
    this.wordsContainer.innerHTML = '';
    if (this.caret) {
      this.wordsContainer.appendChild(this.caret);
    }

    this.charSpans = [];
    const words = this.targetText.split(' ');

    words.forEach((wordStr, wIdx) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';

      // Character spans in word
      for (let i = 0; i < wordStr.length; i++) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char untyped';
        charSpan.textContent = wordStr[i];
        charSpan.dataset.charIndex = this.charSpans.length;
        wordSpan.appendChild(charSpan);
        this.charSpans.push(charSpan);
      }

      // Space span following the word (except after the final word)
      if (wIdx < words.length - 1) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char untyped char-space';
        spaceSpan.innerHTML = '&nbsp;';
        spaceSpan.dataset.charIndex = this.charSpans.length;
        wordSpan.appendChild(spaceSpan);
        this.charSpans.push(spaceSpan);
      }

      this.wordsContainer.appendChild(wordSpan);
    });
  }

  /**
   * Keystroke activity tracker & auto-pause idle detector (3s threshold).
   * Accumulates active typing time so pauses don't distort WPM.
   */
  recordKeystrokeActivity() {
    if (this.isCompleted) return;

    const now = performance.now();

    // 1. Start timer on first keystroke of session
    if (!this.startTime) {
      this.startTime = now;
      this.lastActiveTime = now;
      this.activeElapsedMs = 0;
      this.timerInterval = setInterval(() => {
        if (!this.isCompleted) {
          this.updateMetrics();
        }
      }, 100);

      // Track instantaneous WPM every 2 seconds during active typing
      this.samplerInterval = setInterval(() => {
        if (!this.isCompleted && !this.isPaused) {
          this.recordInstantaneousSample();
        }
      }, 2000);
    }

    // 2. If resuming from idle pause, clear paused state immediately
    if (this.isPaused) {
      this.isPaused = false;
      this.lastActiveTime = now;
      this.onPauseStateChange(false);
    } else if (this.lastActiveTime) {
      // Accumulate active typing elapsed time
      this.activeElapsedMs += (now - this.lastActiveTime);
      this.lastActiveTime = now;
    }

    // 3. Reset 3-second idle timer
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      this.handleIdlePause();
    }, 3000);
  }

  handleIdlePause() {
    if (this.isCompleted || this.isPaused || !this.startTime) return;
    const now = performance.now();
    if (this.lastActiveTime) {
      this.activeElapsedMs += Math.min(now - this.lastActiveTime, 3000);
      this.lastActiveTime = null;
    }
    this.isPaused = true;
    this.onPauseStateChange(true);
    this.updateMetrics();
  }

  recordInstantaneousSample() {
    if (this.isCompleted || !this.startTime) return;
    let totalActiveMs = this.activeElapsedMs;
    if (!this.isPaused && this.lastActiveTime) {
      totalActiveMs += (performance.now() - this.lastActiveTime);
    }
    const elapsedSeconds = Math.max(totalActiveMs / 1000, 0.5);
    const elapsedMinutes = elapsedSeconds / 60;
    const currentChunkCorrect = this.wordsContainer ? this.wordsContainer.querySelectorAll('.char.correct').length : 0;
    const totalCorrect = this.cumulativeCorrectChars + currentChunkCorrect;
    const instWpm = Math.max(0, Math.round((totalCorrect / 5) / elapsedMinutes));
    this.instantaneousSamples.push({
      time: Math.round(elapsedSeconds),
      wpm: instWpm
    });
  }

  handleKeyDown(e) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;

    // Allow browser shortcuts
    if (['Tab', 'Escape', 'F5', 'F12', 'Alt', 'Control', 'Meta'].includes(e.key)) {
      return;
    }

    this.recordKeystrokeActivity();

    // Handle Backspace
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.handleBackspace();
      return;
    }

    // Handle Spacebar
    if (e.key === ' ') {
      e.preventDefault();
      this.handleSpace();
      return;
    }

    // Ignore non-printable keys
    if (e.key.length !== 1) return;

    // Handle single printable character
    e.preventDefault();
    this.processChar(e.key);
  }

  handleInput(e) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;
    this.recordKeystrokeActivity();

    if (e.data) {
      for (const char of e.data) {
        if (char === ' ') {
          this.handleSpace();
        } else {
          this.processChar(char);
        }
      }
    } else if (e.inputType === 'deleteContentBackward') {
      this.handleBackspace();
    }
    if (this.hiddenInput) {
      this.hiddenInput.value = '';
    }
  }

  handleBackspace() {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;
    if (this.activeCharIndex > 0) {
      this.activeCharIndex--;
      const span = this.charSpans[this.activeCharIndex];
      if (span) {
        const isSpace = span.classList.contains('char-space');
        span.className = isSpace ? 'char untyped char-space' : 'char untyped';
      }
      SoundService.playKeyClick(false);
      this.updateCaretPosition();
      this.updateMetrics();
    }
  }

  handleSpace() {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;
    if (this.currentIndex >= this.targetText.length) {
      if (this.mode === 'timed') {
        if (typeof this.onChunkComplete === 'function') {
          this.onChunkComplete();
        }
      } else {
        this.finishTest();
      }
      return;
    }

    const targetChar = this.targetText[this.activeCharIndex];

    // Case 1: Target character is a space
    if (targetChar === ' ') {
      this.totalKeystrokes++;
      this.correctKeystrokes++;
      const span = this.charSpans[this.activeCharIndex];
      if (span) {
        span.className = 'char correct char-space';
      }
      SoundService.playKeyClick(false);
      this.recordSessionKey(' ', true);
      this.activeCharIndex++;
      this.updateCaretPosition();
      this.updateMetrics();
      if (this.targetText && this.targetText.length > 0 && this.currentIndex >= this.targetText.length) {
        if (this.mode === 'timed') {
          if (typeof this.onChunkComplete === 'function') {
            this.onChunkComplete();
          }
        } else {
          this.finishTest();
        }
      }
      return;
    }

    // Case 2: User pressed space inside a word to skip to next word
    const nextSpaceIdx = this.targetText.indexOf(' ', this.activeCharIndex);
    if (nextSpaceIdx !== -1) {
      this.totalKeystrokes++;
      for (let i = this.activeCharIndex; i <= nextSpaceIdx; i++) {
        const span = this.charSpans[i];
        if (span) {
          const isSpace = span.classList.contains('char-space');
          span.className = isSpace ? 'char incorrect char-space' : 'char incorrect';
        }
        this.errorCount++;
        this.recordSessionKey(this.targetText[i], false);
      }
      SoundService.playKeyClick(true);
      this.activeCharIndex = nextSpaceIdx + 1;
      this.updateCaretPosition();
      this.updateMetrics();
      if (this.targetText && this.targetText.length > 0 && this.currentIndex >= this.targetText.length) {
        if (this.mode === 'timed') {
          if (typeof this.onChunkComplete === 'function') {
            this.onChunkComplete();
          }
        } else {
          this.finishTest();
        }
      }
    } else {
      this.processChar(' ');
    }
  }

  processChar(typedChar) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;
    if (this.currentIndex >= this.targetText.length) {
      if (this.mode === 'timed') {
        if (typeof this.onChunkComplete === 'function') {
          this.onChunkComplete();
        }
      } else {
        this.finishTest();
      }
      return;
    }

    const targetChar = this.targetText[this.activeCharIndex];
    const span = this.charSpans[this.activeCharIndex];
    const isSpace = span?.classList.contains('char-space');

    this.totalKeystrokes++;
    const isMatch = (typedChar === targetChar);

    if (isMatch) {
      this.correctKeystrokes++;
      if (span) {
        span.className = isSpace ? 'char correct char-space' : 'char correct';
      }
      SoundService.playKeyClick(false);
      this.recordSessionKey(targetChar, true);
    } else {
      this.errorCount++;
      if (span) {
        span.className = isSpace ? 'char incorrect char-space' : 'char incorrect';
      }
      SoundService.playKeyClick(true);
      this.recordSessionKey(targetChar, false);
    }

    this.activeCharIndex++;
    this.updateCaretPosition();
    this.updateMetrics();

    if (this.targetText && this.targetText.length > 0 && this.currentIndex >= this.targetText.length) {
      if (this.mode === 'timed') {
        if (typeof this.onChunkComplete === 'function') {
          this.onChunkComplete();
        }
      } else {
        this.finishTest();
      }
    }
  }

  /**
   * Translates the sharp glowing vertical I-beam caret (2px wide).
   * Positioned cleanly before the active character with NO letter covering.
   * Tracks seamlessly across word wraps and window resizing.
   */
  updateCaretPosition() {
    if (!this.caret || !this.wordsContainer) return;

    this.caret.classList.add('typing');

    if (this.activeCharIndex < this.charSpans.length) {
      const activeSpan = this.charSpans[this.activeCharIndex];
      if (activeSpan) {
        const left = activeSpan.offsetLeft;
        const top = activeSpan.offsetTop;
        const h = activeSpan.offsetHeight || 26;
        this.caret.style.width = '2px';
        this.caret.style.height = `${h}px`;
        this.caret.style.transform = `translate(${left}px, ${top}px)`;
      }
    } else if (this.charSpans.length > 0) {
      const lastSpan = this.charSpans[this.charSpans.length - 1];
      if (lastSpan) {
        const left = lastSpan.offsetLeft + lastSpan.offsetWidth;
        const top = lastSpan.offsetTop;
        const h = lastSpan.offsetHeight || 26;
        this.caret.style.width = '2px';
        this.caret.style.height = `${h}px`;
        this.caret.style.transform = `translate(${left}px, ${top}px)`;
      }
    } else {
      this.caret.style.transform = `translate(0px, 0px)`;
    }
  }

  computeMetrics() {
    let totalActiveMs = this.activeElapsedMs;
    if (!this.isPaused && this.lastActiveTime) {
      totalActiveMs += (performance.now() - this.lastActiveTime);
    }
    const elapsedSeconds = this.startTime ? Math.max(totalActiveMs / 1000, 0) : 0;

    let remainingSeconds = 0;
    if (this.mode === 'timed') {
      remainingSeconds = Math.max(0, this.timeLimit - Math.floor(elapsedSeconds));
      if (this.startTime && remainingSeconds <= 0 && !this.isCompleted) {
        setTimeout(() => this.finishTest(), 0);
      }
    }

    const effectiveSeconds = (this.mode === 'timed' && this.isCompleted) 
      ? this.timeLimit 
      : Math.max(elapsedSeconds, 0.5);
    const elapsedMinutes = effectiveSeconds / 60;

    const currentChunkCorrect = this.wordsContainer ? this.wordsContainer.querySelectorAll('.char.correct').length : 0;
    const totalCorrectChars = this.cumulativeCorrectChars + currentChunkCorrect;
    const totalTargetChars = this.targetText.length;

    const wpm = (this.startTime && elapsedMinutes > 0) ? Math.round((totalCorrectChars / 5) / elapsedMinutes) : 0;
    const rawWpm = (this.startTime && elapsedMinutes > 0) ? Math.round((this.totalKeystrokes / 5) / elapsedMinutes) : 0;

    const accuracy = this.totalKeystrokes > 0 
      ? Math.max(0, Math.min(100, Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100))) 
      : 100;

    const progressPercent = totalTargetChars > 0 
      ? Math.min(100, Math.round((this.activeCharIndex / totalTargetChars) * 100)) 
      : 0;

    return {
      wpm: Math.max(0, wpm),
      rawWpm: Math.max(0, rawWpm),
      accuracy,
      elapsedSeconds: Math.floor(elapsedSeconds),
      remainingSeconds: this.mode === 'timed' ? remainingSeconds : 0,
      isPaused: this.isPaused,
      mode: this.mode,
      timeLimit: this.timeLimit,
      correctChars: totalCorrectChars,
      totalTargetChars,
      totalKeystrokes: this.totalKeystrokes,
      errorCount: this.errorCount,
      progressPercent,
      samples: [...this.instantaneousSamples]
    };
  }

  updateMetrics() {
    const metrics = this.computeMetrics();
    this.onMetricsUpdate(metrics);
  }

  finishTest() {
    if (this.isCompleted) return;
    // Guard: ONLY trigger when targetText.length > 0
    if (!this.targetText || this.targetText.length === 0) return;
    if (this.mode !== 'timed' && this.currentIndex < this.targetText.length) return;

    this.isCompleted = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.samplerInterval) {
      clearInterval(this.samplerInterval);
      this.samplerInterval = null;
    }
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    if (!this.isPaused && this.lastActiveTime) {
      this.activeElapsedMs += (performance.now() - this.lastActiveTime);
      this.lastActiveTime = null;
    }
    this.isPaused = false;
    this.onPauseStateChange(false);
    this.recordInstantaneousSample();

    if (this.caret) {
      this.caret.classList.remove('typing');
    }
    const finalMetrics = this.computeMetrics();
    this.onComplete(finalMetrics);
  }
}

// ============================================================================
// 5. HEADER CONTROLLER (Shared across all pages)
// ============================================================================
class HeaderController {
  constructor() {
    this.searchForm = document.getElementById('header-search-form');
    this.searchInput = document.getElementById('header-search-input');
    this.searchBtn = document.getElementById('header-search-btn');
    this.randomBtn = document.getElementById('header-random-btn');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.clockEl = document.getElementById('hud-clock');

    this.init();
  }

  init() {
    this.initSearch();
    this.initSound();
    this.initClock();
    this.initKeyboardShortcuts();
  }

  initSearch() {
    if (this.searchForm) {
      this.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = this.searchInput?.value.trim();
        if (!query) return;

        // If currently on the practice arena page, load the topic directly
        if (window.practiceApp && typeof window.practiceApp.loadTopic === 'function') {
          this.searchInput.value = '';
          window.practiceApp.loadTopic(query);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('topic', query);
            window.history.replaceState({}, '', url.toString());
          } catch (err) {}
        } else {
          // Navigate to practice page with topic query and active mode/time
          const pBase = this.searchForm?.dataset?.practiceUrl || '/practice/';
          const storedMode = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_mode') : null;
          const storedTime = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_time') : null;
          let targetUrl = `${pBase}?topic=${encodeURIComponent(query)}`;
          if (storedMode) targetUrl += `&mode=${encodeURIComponent(storedMode)}`;
          if (storedMode === 'timed' && storedTime) targetUrl += `&time=${encodeURIComponent(storedTime)}`;
          window.location.href = targetUrl;
        }
      });
    }

    if (this.randomBtn) {
      this.randomBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.practiceApp && typeof window.practiceApp.loadRandomTopic === 'function') {
          if (this.searchInput) this.searchInput.value = '';
          window.practiceApp.loadRandomTopic();
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('topic', 'random');
            window.history.replaceState({}, '', url.toString());
          } catch (err) {}
        } else {
          const pBase = this.searchForm?.dataset?.practiceUrl || '/practice/';
          const storedMode = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_mode') : null;
          const storedTime = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_time') : null;
          let targetUrl = `${pBase}?topic=random`;
          if (storedMode) targetUrl += `&mode=${encodeURIComponent(storedMode)}`;
          if (storedMode === 'timed' && storedTime) targetUrl += `&time=${encodeURIComponent(storedTime)}`;
          window.location.href = targetUrl;
        }
      });
    }
  }

  initSound() {
    if (!this.soundToggleBtn) return;
    this.updateSoundBtn();
    this.soundToggleBtn.addEventListener('click', () => {
      SoundService.toggle();
      this.updateSoundBtn();
    });
  }

  updateSoundBtn() {
    if (!this.soundToggleBtn) return;
    const enabled = SoundService.enabled;
    this.soundToggleBtn.classList.toggle('muted', !enabled);
    const iconSpan = this.soundToggleBtn.querySelector('.btn-icon');
    const labelSpan = this.soundToggleBtn.querySelector('.btn-label');
    if (iconSpan) iconSpan.textContent = enabled ? '🔊' : '🔇';
    if (labelSpan) labelSpan.textContent = enabled ? 'Sound: On' : 'Sound: Off';
  }

  initClock() {
    if (!this.clockEl) return;
    const update = () => {
      const now = new Date();
      this.clockEl.textContent = now.toTimeString().split(' ')[0];
    };
    update();
    setInterval(update, 1000);
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Shortcut "/" focuses the header search input unless user is already typing in an input
      if (e.key === '/' && this.searchInput) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          const modalEl = document.getElementById('results-modal');
          const isModalOpen = window.practiceApp?.isModalOpen || (modalEl && !modalEl.classList.contains('hidden'));
          if (!isModalOpen) {
            e.preventDefault();
            this.searchInput.focus();
            this.searchInput.select();
          }
        }
      }
    });
  }
}

// ============================================================================
// 6. HOME PAGE SETUP CONTROLLER (index.html)
// ============================================================================
class HomePageController {
  constructor() {
    const storedMode = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_mode') : null;
    const storedTime = (typeof sessionStorage !== 'undefined') ? parseInt(sessionStorage.getItem('typer_time'), 10) : null;

    this.selectedMode = (storedMode === 'timed' || storedMode === 'paragraph') ? storedMode : 'paragraph';
    this.selectedDuration = (storedTime && [15, 30, 60, 120].includes(storedTime)) ? storedTime : 60;
    this.selectedTopic = 'Quantum Mechanics';
    this.showMovingAvg = true;
    this.sessionLogs = AnalyticsService.getSessions();

    this.initDOMElements();
    this.restoreStoredState();
    this.bindEvents();
    this.loadAnalytics();
  }

  async loadAnalytics() {
    this.renderAnalytics();
    try {
      const res = await fetch('/api/analytics/');
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          this.sessionLogs = data.sessions;
          AnalyticsService.setStorage(AnalyticsService.SESSIONS_KEY, data.sessions);
        }
        if (data.all_key_stats && typeof data.all_key_stats === 'object') {
          AnalyticsService.setStorage(AnalyticsService.KEYSTATS_KEY, data.all_key_stats);
        }
        this.renderAnalytics(data);
      }
    } catch (err) {
      console.warn('Failed to load live backend analytics, keeping local cache:', err);
    }
  }

  initDOMElements() {
    this.modeParagraphCard = document.getElementById('mode-card-paragraph');
    this.modeTimedCard = document.getElementById('mode-card-timed');
    this.timedDurationSelector = document.getElementById('timed-duration-selector');
    this.durationPills = document.querySelectorAll('.duration-pill');
    this.topicCards = document.querySelectorAll('.topic-card');
    this.customTopicInput = document.getElementById('custom-topic-input');
    this.startPracticeBtn = document.getElementById('start-practice-btn');

    // Analytics elements
    this.wpmTrendCanvas = document.getElementById('wpm-trend-canvas');
    this.chartTooltip = document.getElementById('chart-tooltip');
    this.chartEmptyState = document.getElementById('chart-empty-state');
    this.topWeakKeysList = document.getElementById('top-weak-keys-list');
    this.keyboardHeatmap = document.getElementById('keyboard-heatmap');
    this.practiceWeakKeysBtn = document.getElementById('practice-weak-keys-btn');
    this.clearLogsBtn = document.getElementById('clear-logs-btn');
    this.sessionLogsList = document.getElementById('session-logs-list');
    this.sessionLogCount = document.getElementById('session-log-count');
    this.practiceWeakKeysTopBtn = document.getElementById('practice-weak-keys-top-btn');
    this.quickWeakChips = document.getElementById('quick-weak-chips');
  }

  restoreStoredState() {
    if (this.selectedMode === 'timed') {
      this.modeParagraphCard?.classList.remove('selected');
      this.modeTimedCard?.classList.add('selected');
      this.timedDurationSelector?.classList.remove('hidden');
    } else {
      this.modeTimedCard?.classList.remove('selected');
      this.modeParagraphCard?.classList.add('selected');
      this.timedDurationSelector?.classList.add('hidden');
    }

    this.durationPills.forEach(pill => {
      const dur = parseInt(pill.dataset.duration, 10);
      pill.classList.toggle('selected', dur === this.selectedDuration);
    });

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('typer_mode', this.selectedMode);
      sessionStorage.setItem('typer_time', this.selectedDuration);
    }
  }

  bindEvents() {
    // Mode Selection
    if (this.modeParagraphCard && this.modeTimedCard) {
      this.modeParagraphCard.addEventListener('click', () => this.selectMode('paragraph'));
      this.modeTimedCard.addEventListener('click', () => this.selectMode('timed'));
    }

    // Duration Selection
    this.durationPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.durationPills.forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        this.selectedDuration = parseInt(pill.dataset.duration, 10) || 60;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('typer_time', this.selectedDuration);
        }
        this.updateStartUrl();
      });
    });

    // Topic Cards Selection
    this.topicCards.forEach(card => {
      card.addEventListener('click', () => {
        this.topicCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTopic = card.dataset.topic || 'random';
        if (this.customTopicInput) {
          this.customTopicInput.value = '';
        }
        this.updateStartUrl();
      });
    });

    // Custom Topic Input
    if (this.customTopicInput) {
      this.customTopicInput.addEventListener('input', () => {
        const val = this.customTopicInput.value.trim();
        if (val) {
          this.topicCards.forEach(c => c.classList.remove('selected'));
          this.selectedTopic = val;
        } else {
          const firstCard = this.topicCards[0];
          if (firstCard) {
            firstCard.classList.add('selected');
            this.selectedTopic = firstCard.dataset.topic || 'random';
          }
        }
        this.updateStartUrl();
      });
    }

    // Start Practice Button Click
    if (this.startPracticeBtn) {
      this.startPracticeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = this.buildPracticeUrl();
        window.location.href = url;
      });
    }

    // Practice Weak Keys CTA
    if (this.practiceWeakKeysBtn) {
      this.practiceWeakKeysBtn.addEventListener('click', () => {
        window.location.href = '/practice/?mode=drill';
      });
    }
    if (this.practiceWeakKeysTopBtn) {
      this.practiceWeakKeysTopBtn.addEventListener('click', () => {
        window.location.href = '/practice/?mode=drill';
      });
    }

    // Clear History & Analytics
    if (this.clearLogsBtn) {
      this.clearLogsBtn.addEventListener('click', () => {
        if (confirm('Clear your practice history and reset weak keys analytics?')) {
          AnalyticsService.clearSessions();
          AnalyticsService.clearKeyStats();
          this.sessionLogs = [];
          this.renderAnalytics();
        }
      });
    }

    // Window Resize Chart Redraw
    window.addEventListener('resize', () => {
      if (this.wpmTrendCanvas) {
        AnalyticsService.renderWpmChart(this.wpmTrendCanvas, this.chartTooltip, this.sessionLogs, {
          showMovingAvg: this.showMovingAvg
        });
      }
    });

    this.updateStartUrl();
  }

  selectMode(mode) {
    this.selectedMode = mode;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('typer_mode', mode);
    }

    if (mode === 'timed') {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('typer_time', this.selectedDuration);
      }
      this.modeParagraphCard?.classList.remove('selected');
      this.modeTimedCard?.classList.add('selected');
      if (this.timedDurationSelector) {
        this.timedDurationSelector.classList.remove('hidden');
      }
    } else {
      this.modeTimedCard?.classList.remove('selected');
      this.modeParagraphCard?.classList.add('selected');
      if (this.timedDurationSelector) {
        this.timedDurationSelector.classList.add('hidden');
      }
    }
    this.updateStartUrl();
  }

  buildPracticeUrl() {
    const params = new URLSearchParams();
    if (this.selectedTopic) {
      params.set('topic', this.selectedTopic);
    }
    params.set('mode', this.selectedMode);
    if (this.selectedMode === 'timed') {
      params.set('time', this.selectedDuration);
      params.set('duration', this.selectedDuration);
    }
    const base = this.startPracticeBtn?.getAttribute('href')?.split('?')[0] || '/practice/';
    return `${base}?${params.toString()}`;
  }

  updateStartUrl() {
    if (this.startPracticeBtn) {
      this.startPracticeBtn.href = this.buildPracticeUrl();
    }
  }

  renderAnalytics() {
    this.sessionLogs = AnalyticsService.getSessions();

    // 1. WPM Progress Chart
    if (this.wpmTrendCanvas) {
      if (this.sessionLogs.length === 0) {
        this.chartEmptyState?.classList.remove('hidden');
      } else {
        this.chartEmptyState?.classList.add('hidden');
      }
      AnalyticsService.renderWpmChart(this.wpmTrendCanvas, this.chartTooltip, this.sessionLogs, {
        showMovingAvg: this.showMovingAvg
      });
    }

    // 2. Heatmap & Weak Keys Summary
    if (this.keyboardHeatmap) {
      AnalyticsService.renderHeatmap(this.keyboardHeatmap);
    }
    if (this.topWeakKeysList) {
      AnalyticsService.renderWeakKeysSummary(this.topWeakKeysList);
    }

    // 3. Session Logs List
    this.renderSessionLogs();

    // 4. Quick Weak Chips
    this.updateQuickWeakChips(liveData?.top_weak_keys);
  }

  updateQuickWeakChips(weakKeysList) {
    if (!this.quickWeakChips) return;
    let keys = [];
    if (weakKeysList && Array.isArray(weakKeysList) && weakKeysList.length > 0) {
      keys = weakKeysList.slice(0, 3).map(k => k.character?.toUpperCase()).filter(Boolean);
    } else {
      keys = AnalyticsService.getWeakKeys(3).map(k => k.key?.toUpperCase()).filter(k => k && k !== ' ');
    }
    if (!keys || keys.length === 0) {
      keys = ['E', 'R', 'T'];
    }
    this.quickWeakChips.innerHTML = keys.slice(0, 3).map(c => `<span class="chip-key">${c}</span>`).join('');
  }

  renderSessionLogs() {
    if (!this.sessionLogsList) return;
    if (this.sessionLogCount) {
      this.sessionLogCount.textContent = `${this.sessionLogs.length} session${this.sessionLogs.length === 1 ? '' : 's'} recorded`;
    }
    if (this.sessionLogs.length === 0) {
      this.sessionLogsList.innerHTML = `
        <div class="empty-log-state">
          <span class="empty-icon">📝</span> No practice runs recorded yet. Start a practice session above to track your progress!
        </div>
      `;
      return;
    }

    this.sessionLogsList.innerHTML = '';
    this.sessionLogs.forEach((log) => {
      const row = document.createElement('div');
      row.className = 'session-log-row';
      const modeLabel = log.mode === 'drill' 
        ? 'Weak Keys Drill' 
        : (log.mode === 'timed' ? `Timed Sprint (${log.timeLimit || 60}s)` : (log.totalChunks > 1 ? `Part ${log.chunkIndex} of ${log.totalChunks}` : 'Paragraph'));
      row.innerHTML = `
        <div class="log-meta">
          <span class="log-topic-name">${log.topic}</span>
          <span class="log-chunk-badge">${modeLabel}</span>
          <span class="log-timestamp">${log.timestamp || ''}</span>
        </div>
        <div class="log-stats">
          <span class="log-stat-wpm">${log.wpm} <span class="stat-unit-tiny">WPM</span></span>
          <span class="log-stat-acc">${log.accuracy}% <span class="stat-unit-tiny">Acc</span></span>
        </div>
      `;
      this.sessionLogsList.appendChild(row);
    });
  }
}

// ============================================================================
// 7. DISTRACTION-FREE TYPING ARENA CONTROLLER (practice.html)
// ============================================================================
class PracticePageController {
  constructor() {
    this.chunks = [];
    this.currentChunkIndex = 0;
    this.currentTopicData = null;
    this.sessionLogs = AnalyticsService.getSessions();
    this.isModalOpen = false;

    this.urlParams = new URLSearchParams(window.location.search);
    const urlMode = this.urlParams.get('mode');
    const storageMode = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_mode') : null;
    this.mode = urlMode || storageMode || 'paragraph'; // 'paragraph' | 'timed' | 'drill'

    const rawTime = this.urlParams.get('time') || this.urlParams.get('duration') || ((typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_time') : null);
    this.timeLimit = parseInt(rawTime, 10) || 60;
    if (isNaN(this.timeLimit) || this.timeLimit <= 0) {
      this.timeLimit = 60;
    }

    this.requestedTopic = this.urlParams.get('topic') || '';

    this.initDOMElements();
    this.hideResultsModal();
    this.initTypingEngine();
    this.bindUIEvents();

    this.startSession();
  }

  initDOMElements() {
    // Arena Meta
    this.articleTitle = document.getElementById('arena-article-title');
    this.articleDescription = document.getElementById('arena-article-desc');
    this.wikiExternalLink = document.getElementById('arena-wiki-link');
    this.arenaModePill = document.getElementById('arena-mode-pill');
    this.paragraphCounterPill = document.getElementById('paragraph-counter-pill');

    if (this.arenaModePill) {
      if (this.mode === 'timed') {
        this.arenaModePill.textContent = `Timed Sprint (${this.timeLimit}s)`;
      } else if (this.mode === 'drill') {
        this.arenaModePill.textContent = 'Weak Keys Drill';
      } else {
        this.arenaModePill.textContent = 'Complete Paragraph';
      }
    }

    // Arena HUD
    this.statWpm = document.getElementById('stat-wpm');
    this.statAccuracy = document.getElementById('stat-accuracy');
    this.statTime = document.getElementById('stat-time');
    this.statProgress = document.getElementById('stat-progress');
    this.hudTimeLabel = document.getElementById('hud-time-label');
    this.idleBadge = document.getElementById('idle-status-badge');

    // Initialize immediate clean time display (never NaN:NaN)
    if (this.hudTimeLabel) {
      this.hudTimeLabel.textContent = (this.mode === 'timed') ? 'Remaining' : 'Time';
    }
    if (this.statTime) {
      this.statTime.textContent = (this.mode === 'timed') ? this.formatTime(this.timeLimit) : '00:00';
    }

    // Status Banner / Loading
    this.statusBanner = document.getElementById('status-banner');
    this.bannerMessage = document.getElementById('banner-message');
    this.bannerSpinner = document.getElementById('banner-spinner');

    // Typing Practice Arena
    this.typingSection = document.getElementById('typing-section');
    this.wordsContainer = document.getElementById('words-container');
    this.caret = document.getElementById('caret');
    this.hiddenInput = document.getElementById('hidden-input');
    this.focusOverlay = document.getElementById('focus-overlay');

    // Action Controls
    this.restartChunkBtn = document.getElementById('restart-chunk-btn');
    this.nextChunkBtn = document.getElementById('next-chunk-btn');

    // Results Modal & Mini Trend Chart
    this.resultsModal = document.getElementById('results-modal');
    this.modalBackdrop = document.getElementById('modal-backdrop');
    this.modalCard = document.getElementById('modal-card');
    this.resWpm = document.getElementById('res-wpm');
    this.resAccuracy = document.getElementById('res-accuracy');
    this.resTime = document.getElementById('res-time');
    this.resRawWpm = document.getElementById('res-raw-wpm');
    this.resErrors = document.getElementById('res-errors');
    this.resChars = document.getElementById('res-chars');
    this.modalWpmCanvas = document.getElementById('modal-wpm-canvas');
    this.modalChartTooltip = document.getElementById('modal-chart-tooltip');
    this.modalNextBtn = document.getElementById('modal-next-btn');
    this.modalRetryBtn = document.getElementById('modal-retry-btn');
    this.modalWikiLink = document.getElementById('modal-wiki-link');
  }

  initTypingEngine() {
    this.engine = new TypingEngine({
      wordsContainer: this.wordsContainer,
      caret: this.caret,
      hiddenInput: this.hiddenInput,
      mode: this.mode === 'timed' ? 'timed' : 'paragraph',
      timeLimit: this.timeLimit,
      onMetricsUpdate: (metrics) => this.renderHUD(metrics),
      onComplete: (finalMetrics) => this.showResultsModal(finalMetrics),
      onChunkComplete: () => this.handleTimedChunkAdvance(),
      onPauseStateChange: (isPaused) => {
        if (this.idleBadge) {
          this.idleBadge.classList.toggle('hidden', !isPaused);
        }
      }
    });
  }

  handleTimedChunkAdvance() {
    if (this.mode !== 'timed' || this.engine.isCompleted) return;
    this.currentChunkIndex = (this.currentChunkIndex + 1) % this.chunks.length;
    const nextChunk = this.chunks[this.currentChunkIndex];
    if (this.paragraphCounterPill) {
      this.paragraphCounterPill.textContent = `Paragraph ${this.currentChunkIndex + 1} of ${this.chunks.length}`;
    }
    this.engine.loadNextChunkSeamlessly(nextChunk);
  }

  bindUIEvents() {
    // Focus Management
    if (this.typingSection) {
      this.typingSection.addEventListener('click', () => {
        if (!this.isModalOpen) this.focusTypingArea();
      });
    }
    if (this.focusOverlay) {
      this.focusOverlay.addEventListener('click', () => {
        if (!this.isModalOpen) this.focusTypingArea();
      });
    }

    if (this.hiddenInput) {
      this.hiddenInput.addEventListener('focus', () => {
        if (this.isModalOpen || !this.resultsModal?.classList.contains('hidden')) {
          this.hiddenInput.blur();
          return;
        }
        this.typingSection?.classList.add('focused');
        this.focusOverlay?.classList.add('hidden');
      });

      this.hiddenInput.addEventListener('blur', () => {
        const headerInput = document.getElementById('header-search-input');
        if (document.activeElement === headerInput || this.isModalOpen || !this.resultsModal?.classList.contains('hidden')) {
          return;
        }
        this.typingSection?.classList.remove('focused');
        this.focusOverlay?.classList.remove('hidden');
      });
    }

    // Action Buttons
    if (this.restartChunkBtn) {
      this.restartChunkBtn.addEventListener('click', () => this.restartCurrentChunk());
    }
    if (this.nextChunkBtn) {
      this.nextChunkBtn.addEventListener('click', () => this.changeChunk(1));
    }

    // Modal Actions
    if (this.modalNextBtn) {
      this.modalNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.advanceFromModal();
      });
    }
    if (this.modalRetryBtn) {
      this.modalRetryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.retryFromModal();
      });
    }

    // Modal Dismiss Backdrop
    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener('click', (e) => {
        e.preventDefault();
        this.dismissModal();
      });
    }
    if (this.resultsModal) {
      this.resultsModal.addEventListener('click', (e) => {
        if (e.target === this.resultsModal) {
          e.preventDefault();
          this.dismissModal();
        }
      });
    }
    if (this.modalCard) {
      this.modalCard.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Window Resize Chart Redraw
    window.addEventListener('resize', () => {
      if (this.isModalOpen && this.modalWpmCanvas) {
        AnalyticsService.renderWpmChart(this.modalWpmCanvas, this.modalChartTooltip, this.sessionLogs, { isModal: true });
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // While modal is open
      if (this.isModalOpen || !this.resultsModal?.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.retryFromModal();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (document.activeElement === this.modalRetryBtn) {
            this.retryFromModal();
          } else if (document.activeElement === this.modalWikiLink && e.key === 'Enter') {
            this.modalWikiLink.click();
          } else {
            this.advanceFromModal();
          }
          return;
        }
        if (e.key === 'Tab') {
          const focusable = [this.modalNextBtn, this.modalRetryBtn, this.modalWikiLink].filter(Boolean);
          if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first || !focusable.includes(document.activeElement)) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last || !focusable.includes(document.activeElement)) {
                e.preventDefault();
                first.focus();
              }
            }
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Escape to restart current chunk / timed sprint
      if (e.key === 'Escape') {
        const headerInput = document.getElementById('header-search-input');
        if (document.activeElement !== headerInput) {
          this.restartCurrentChunk();
        }
        return;
      }

      // Tab to advance to next chunk
      if (e.key === 'Tab') {
        const headerInput = document.getElementById('header-search-input');
        if (document.activeElement !== headerInput) {
          e.preventDefault();
          this.changeChunk(1);
        }
        return;
      }

      // Printable character typing while not in an input
      const headerInput = document.getElementById('header-search-input');
      if (document.activeElement !== headerInput &&
          document.activeElement !== this.hiddenInput &&
          !this.isModalOpen &&
          this.resultsModal?.classList.contains('hidden') &&
          e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.focusTypingArea();
      }
    });
  }

  startSession() {
    if (this.mode === 'drill') {
      this.loadWeakKeysDrill();
    } else if (this.requestedTopic && this.requestedTopic !== 'random') {
      this.loadTopic(this.requestedTopic);
    } else {
      this.loadRandomTopic();
    }
  }

  showStatus(msg, type = 'info') {
    if (!this.statusBanner) return;
    this.statusBanner.className = `status-banner banner-${type}`;
    if (this.bannerMessage) this.bannerMessage.textContent = msg;
    if (this.bannerSpinner) this.bannerSpinner.classList.toggle('hidden', type !== 'loading');
    this.statusBanner.classList.remove('hidden');
  }

  hideStatus() {
    if (this.statusBanner) {
      this.statusBanner.classList.add('hidden');
    }
  }

  async loadRandomTopic() {
    this.showStatus('Finding an interesting Wikipedia topic...', 'loading');
    try {
      const data = await WikipediaService.fetchRandomTopicSummary();
      this.processLoadedTopic(data);
    } catch (err) {
      console.error(err);
      this.showStatus('Could not load random topic. Loading featured article...', 'error');
      const fallbackItem = WikipediaService.curatedTopics[Math.floor(Math.random() * WikipediaService.curatedTopics.length)];
      try {
        const fbData = await WikipediaService.fetchTopicSummary(fallbackItem.title);
        this.processLoadedTopic(fbData);
      } catch (e2) {
        this.loadTopic(fallbackItem.title);
      }
    }
  }

  async loadTopic(topicQuery) {
    this.showStatus(`Loading "${topicQuery}" from Wikipedia...`, 'loading');
    try {
      const data = await WikipediaService.fetchTopicSummary(topicQuery);
      this.processLoadedTopic(data);
    } catch (err) {
      console.error(err);
      this.showStatus(err.message || 'Failed to fetch topic summary.', 'error');
    }
  }

  loadWeakKeysDrill() {
    const drill = AnalyticsService.generateWeakDrill(40);
    const focusKeysStr = drill.weakKeys.map(k => k.toUpperCase()).join(', ');

    this.currentTopicData = {
      title: `🎯 Weak Keys Drill [${focusKeysStr}]`,
      description: `Targeted 40-word accuracy drill designed to strengthen finger dexterity for keys: ${focusKeysStr}.`,
      url: '#'
    };

    this.chunks = [drill.wordsText];
    this.currentChunkIndex = 0;
    this.updateArticleMetaUI();
    if (this.wikiExternalLink) {
      this.wikiExternalLink.style.display = 'none';
    }
    this.loadActiveChunk();
    this.hideStatus();
    this.focusTypingArea();
  }

  processLoadedTopic(data) {
    this.currentTopicData = data;
    this.chunks = TextSanitizer.chunkText(data.extract, 50, 70);

    if (this.chunks.length === 0) {
      throw new Error('No readable text found for this topic.');
    }

    this.currentChunkIndex = 0;
    this.updateArticleMetaUI();
    this.loadActiveChunk();
    this.hideStatus();
    this.focusTypingArea();
  }

  updateArticleMetaUI() {
    if (!this.currentTopicData) return;

    if (this.articleTitle) this.articleTitle.textContent = this.currentTopicData.title;
    if (this.articleDescription) this.articleDescription.textContent = this.currentTopicData.description || 'Wikipedia Extract';

    if (this.wikiExternalLink) {
      if (this.currentTopicData.url && this.currentTopicData.url !== '#') {
        this.wikiExternalLink.href = this.currentTopicData.url;
        this.wikiExternalLink.style.display = 'inline-flex';
      } else {
        this.wikiExternalLink.style.display = 'none';
      }
    }

    if (this.modalWikiLink) {
      if (this.currentTopicData.url && this.currentTopicData.url !== '#') {
        this.modalWikiLink.href = this.currentTopicData.url;
        this.modalWikiLink.style.display = 'inline-flex';
      } else {
        this.modalWikiLink.style.display = 'none';
      }
    }

    if (this.arenaModePill) {
      if (this.mode === 'drill') {
        this.arenaModePill.textContent = 'Weak Keys Drill';
      } else if (this.mode === 'timed') {
        this.arenaModePill.textContent = `Timed Sprint (${this.timeLimit}s)`;
      } else {
        this.arenaModePill.textContent = 'Complete Paragraph';
      }
    }

    if (this.hudTimeLabel) {
      this.hudTimeLabel.textContent = (this.mode === 'timed') ? 'Remaining' : 'Time';
    }

    if (this.statTime) {
      this.statTime.textContent = (this.mode === 'timed') ? this.formatTime(this.timeLimit) : '00:00';
    }
  }

  loadActiveChunk() {
    if (this.chunks.length === 0) return;

    const chunkText = this.chunks[this.currentChunkIndex];
    if (this.paragraphCounterPill) {
      this.paragraphCounterPill.textContent = `Paragraph ${this.currentChunkIndex + 1} of ${this.chunks.length}`;
    }

    if (this.nextChunkBtn) {
      const isLast = (this.currentChunkIndex === this.chunks.length - 1);
      this.nextChunkBtn.querySelector('span').textContent = isLast ? '↺ Practice Again [Tab]' : 'Next Paragraph [Tab] ➔';
    }

    this.engine.loadChunk(chunkText);
    this.focusTypingArea();
  }

  changeChunk(delta) {
    const nextIdx = this.currentChunkIndex + delta;
    if (nextIdx >= 0 && nextIdx < this.chunks.length) {
      this.currentChunkIndex = nextIdx;
      this.loadActiveChunk();
    } else if (nextIdx >= this.chunks.length) {
      this.currentChunkIndex = 0;
      this.loadActiveChunk();
    }
  }

  restartCurrentChunk() {
    this.loadActiveChunk();
  }

  focusTypingArea() {
    if (this.isModalOpen || !this.resultsModal?.classList.contains('hidden')) return;
    if (this.hiddenInput) {
      this.hiddenInput.value = '';
      this.hiddenInput.focus();
    }
    this.typingSection?.classList.add('focused');
    this.focusOverlay?.classList.add('hidden');
    this.engine?.updateCaretPosition();
  }

  formatTime(seconds) {
    const safeSeconds = (typeof seconds === 'number' && !isNaN(seconds)) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  renderHUD(metrics) {
    if (this.statWpm) this.statWpm.textContent = metrics.wpm;
    if (this.statAccuracy) this.statAccuracy.textContent = `${metrics.accuracy}%`;

    if (this.statTime) {
      if (this.mode === 'timed') {
        const remaining = (this.engine && !this.engine.startTime)
          ? this.timeLimit
          : (typeof metrics.remainingSeconds === 'number' && !isNaN(metrics.remainingSeconds) ? metrics.remainingSeconds : this.timeLimit);
        this.statTime.textContent = this.formatTime(remaining);
      } else {
        this.statTime.textContent = this.formatTime(metrics.elapsedSeconds);
      }
    }

    if (this.statProgress) {
      this.statProgress.textContent = `${metrics.progressPercent}%`;
    }
  }

  showResultsModal(finalMetrics) {
    const targetText = this.engine?.targetText || '';
    const currentIndex = this.engine?.currentIndex ?? this.engine?.activeCharIndex ?? 0;
    if (!targetText || targetText.length === 0) return;
    if (this.mode !== 'timed' && currentIndex < targetText.length) return;

    this.isModalOpen = true;
    if (this.engine) this.engine.isModalOpen = true;

    if (this.hiddenInput) this.hiddenInput.blur();
    if (this.typingSection) this.typingSection.classList.remove('focused');

    finalMetrics = finalMetrics || this.engine.computeMetrics();

    if (this.resWpm) this.resWpm.textContent = finalMetrics.wpm;
    if (this.resAccuracy) this.resAccuracy.textContent = `${finalMetrics.accuracy}%`;
    if (this.resTime) {
      const displaySeconds = (this.mode === 'timed') ? this.timeLimit : finalMetrics.elapsedSeconds;
      this.resTime.textContent = this.formatTime(displaySeconds);
    }
    if (this.resRawWpm) this.resRawWpm.textContent = finalMetrics.rawWpm;
    if (this.resErrors) this.resErrors.textContent = finalMetrics.errorCount;
    if (this.resChars) this.resChars.textContent = `${finalMetrics.correctChars} / ${finalMetrics.totalTargetChars}`;

    // 1. Update Circular SVG Gauges
    const gaugeWpmBar = document.getElementById('gauge-wpm-bar');
    const gaugeAccBar = document.getElementById('gauge-acc-bar');

    if (gaugeWpmBar) {
      const wpmFrac = Math.min(finalMetrics.wpm / 120, 1);
      const wpmOffset = 314.16 * (1 - wpmFrac);
      gaugeWpmBar.style.strokeDashoffset = wpmOffset;
    }

    if (gaugeAccBar) {
      const accFrac = Math.min(finalMetrics.accuracy / 100, 1);
      const accOffset = 314.16 * (1 - accFrac);
      gaugeAccBar.style.strokeDashoffset = accOffset;
    }

    // 2. Rank & Streak Badge Logic
    const rankBadge = document.getElementById('modal-rank-badge');
    const rankIcon = document.getElementById('modal-rank-icon');
    const rankText = document.getElementById('modal-rank-text');

    let rankLabel = 'Solid Rhythm';
    let rankEmoji = '✨';
    let rankCls = 'rank-rhythm';

    const activeTheme = document.documentElement.getAttribute('data-theme') || 'midnight';

    if (activeTheme === 'funny') {
      if (finalMetrics.wpm >= 75 && finalMetrics.accuracy >= 95) {
        rankLabel = 'COMBO KING! 👑'; rankEmoji = '🕹️'; rankCls = 'rank-hyperspeed';
      } else if (finalMetrics.wpm >= 55) {
        rankLabel = 'TURBO FLOW! 🚀'; rankEmoji = '🎉'; rankCls = 'rank-swift';
      } else if (finalMetrics.accuracy >= 98) {
        rankLabel = 'BULLSEYE! 🎯'; rankEmoji = '⭐'; rankCls = 'rank-precision';
      } else {
        rankLabel = 'GROOVY! 🌈'; rankEmoji = '🍌'; rankCls = 'rank-momentum';
      }
    } else if (activeTheme === 'hacking') {
      if (finalMetrics.wpm >= 75 && finalMetrics.accuracy >= 95) {
        rankLabel = 'ROOT ACCESS GRANTED'; rankEmoji = '⚡'; rankCls = 'rank-hyperspeed';
      } else if (finalMetrics.wpm >= 55) {
        rankLabel = 'CIPHER STREAM ACTIVE'; rankEmoji = '📟'; rankCls = 'rank-swift';
      } else if (finalMetrics.accuracy >= 98) {
        rankLabel = 'PARITY VERIFIED 100%'; rankEmoji = '🎯'; rankCls = 'rank-precision';
      } else {
        rankLabel = 'BUFFER STABLE'; rankEmoji = '🔥'; rankCls = 'rank-momentum';
      }
    } else {
      if (finalMetrics.wpm >= 80 && finalMetrics.accuracy >= 95) {
        rankLabel = 'Hyperspeed Master'; rankEmoji = '⚡'; rankCls = 'rank-hyperspeed';
      } else if (finalMetrics.wpm >= 60 && finalMetrics.accuracy >= 94) {
        rankLabel = 'Swift Flow'; rankEmoji = '🚀'; rankCls = 'rank-swift';
      } else if (finalMetrics.accuracy >= 98) {
        rankLabel = 'Laser Precision'; rankEmoji = '🎯'; rankCls = 'rank-precision';
      } else if (finalMetrics.wpm >= 45) {
        rankLabel = 'Steady Momentum'; rankEmoji = '🔥'; rankCls = 'rank-momentum';
      }
    }

    if (rankBadge) {
      rankBadge.className = `modal-rank-badge ${rankCls}`;
      if (rankIcon) rankIcon.textContent = rankEmoji;
      if (rankText) rankText.textContent = rankLabel;
    }

    // 3. Meta topic and time
    const metaTopicEl = document.getElementById('modal-meta-topic');
    const metaTimeEl = document.getElementById('modal-meta-time');
    const rawWpmPill = document.getElementById('res-raw-wpm-pill');

    if (metaTopicEl) metaTopicEl.textContent = this.currentTopicData?.title || 'Practice Session';
    if (metaTimeEl) {
      const displaySeconds = (this.mode === 'timed') ? this.timeLimit : finalMetrics.elapsedSeconds;
      metaTimeEl.textContent = this.formatTime(displaySeconds);
    }
    if (rawWpmPill) rawWpmPill.textContent = `Gross: ${finalMetrics.rawWpm} WPM`;

    // 4. Session Missed Keys Strip & 1-Click Drill
    const missedChipsContainer = document.getElementById('modal-missed-chips');
    const drillKeysBtn = document.getElementById('modal-drill-keys-btn');
    const sessionKeys = (this.engine && this.engine.sessionKeyStats) ? this.engine.sessionKeyStats : {};

    const missedKeys = [];
    for (const [char, stats] of Object.entries(sessionKeys)) {
      if (stats.errors > 0 && char !== ' ') {
        missedKeys.push({ char, errors: stats.errors });
      }
    }
    missedKeys.sort((a, b) => b.errors - a.errors);
    const topMissed = missedKeys.slice(0, 3);

    if (missedChipsContainer) {
      if (topMissed.length === 0) {
        missedChipsContainer.innerHTML = `<span class="clean-run-badge">✨ 100% Clean Run — Zero Misses!</span>`;
        if (drillKeysBtn) drillKeysBtn.style.display = 'none';
      } else {
        missedChipsContainer.innerHTML = topMissed.map(item => `
          <span class="missed-chip">
            ${item.char.toUpperCase()} <span>(${item.errors})</span>
          </span>
        `).join('');
        if (drillKeysBtn) {
          drillKeysBtn.style.display = 'inline-flex';
          drillKeysBtn.onclick = () => {
            this.hideResultsModal();
            this.loadCustomWeakKeysDrill(topMissed.map(m => m.char));
          };
        }
      }
    }

    if (this.modalNextBtn) {
      const isLast = (this.currentChunkIndex >= this.chunks.length - 1);
      const span = this.modalNextBtn.querySelector('span');
      if (span) {
        span.textContent = isLast ? 'Practice Again [↵]' : 'Next Paragraph [↵]';
      }
    }

    this.recordSessionLog(finalMetrics);
    this.resultsModal?.classList.remove('hidden');

    requestAnimationFrame(() => {
      if (this.modalWpmCanvas) {
        AnalyticsService.renderWpmChart(this.modalWpmCanvas, this.modalChartTooltip, this.sessionLogs, { isModal: true });
      }
    });

    setTimeout(() => {
      if (this.isModalOpen && this.modalNextBtn) {
        this.modalNextBtn.focus();
      }
    }, 20);
  }

  loadCustomWeakKeysDrill(targetLetters = ['e', 'r', 't']) {
    const drill = AnalyticsService.generateWeakDrillWithKeys(targetLetters, 40);
    const focusKeysStr = targetLetters.map(k => k.toUpperCase()).join(', ');

    this.currentTopicData = {
      title: `🎯 Weak Keys Drill [${focusKeysStr}]`,
      description: `Targeted 40-word accuracy drill for keys: ${focusKeysStr}.`,
      url: '#'
    };

    this.chunks = [drill.wordsText];
    this.currentChunkIndex = 0;
    this.updateArticleMetaUI();
    if (this.wikiExternalLink) {
      this.wikiExternalLink.style.display = 'none';
    }
    this.loadActiveChunk();
    this.hideStatus();
    this.focusTypingArea();
  }

  advanceFromModal() {
    this.hideResultsModal();
    this.changeChunk(1);
    this.focusTypingArea();
  }

  retryFromModal() {
    this.hideResultsModal();
    this.restartCurrentChunk();
    this.focusTypingArea();
  }

  dismissModal() {
    this.advanceFromModal();
  }

  hideResultsModal() {
    this.isModalOpen = false;
    if (this.engine) this.engine.isModalOpen = false;
    this.resultsModal?.classList.add('hidden');
  }

  recordSessionLog(metrics) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const logItem = {
      id: `sess_${Date.now()}`,
      topic: this.currentTopicData?.title || 'Unknown Topic',
      chunkIndex: this.currentChunkIndex + 1,
      totalChunks: this.chunks.length,
      wpm: metrics.wpm,
      rawWpm: metrics.rawWpm,
      accuracy: metrics.accuracy,
      elapsedSeconds: (this.mode === 'timed') ? this.timeLimit : metrics.elapsedSeconds,
      errorCount: metrics.errorCount,
      timestamp: timeStr,
      date: dateStr,
      mode: this.mode,
      timeLimit: this.timeLimit,
      samples: metrics.samples || []
    };

    logItem.charactersTyped = metrics.correctChars || (this.engine ? this.engine.activeCharIndex : 0);
    this.sessionLogs = AnalyticsService.saveSession(logItem);

    // Save to SQLite backend asynchronously
    const sessionKeys = (this.engine && this.engine.sessionKeyStats) ? this.engine.sessionKeyStats : {};
    AnalyticsService.saveSessionToServer(logItem, sessionKeys).catch(console.warn);
  }
}

// ============================================================================
// 8. ABOUT PAGE CONTROLLER (about.html)
// ============================================================================
class AboutPageController {
  constructor() {
    const aboutBtn = document.querySelector('.nav-btn-about');
    if (aboutBtn) {
      aboutBtn.classList.add('active');
    }
  }
}

// Backwards compatibility alias
class TopicTyperApp extends PracticePageController {}

// Expose services on window/globalThis
if (typeof window !== 'undefined') {
  window.TextSanitizer = TextSanitizer;
  window.WikipediaService = WikipediaService;
  window.SoundService = SoundService;
  window.AnalyticsService = AnalyticsService;
  window.TypingEngine = TypingEngine;
  window.HeaderController = HeaderController;
  window.HomePageController = HomePageController;
  window.PracticePageController = PracticePageController;
  window.AboutPageController = AboutPageController;
  window.TopicTyperApp = TopicTyperApp;
}

// Universal DOM router
document.addEventListener('DOMContentLoaded', () => {
  ThemeService.init();
  AmbientEngine.init();
  window.themeService = ThemeService;
  window.ambientEngine = AmbientEngine;
  window.headerController = new HeaderController();

  if (document.getElementById('home-setup-dashboard')) {
    window.homeApp = new HomePageController();
  }

  if (document.getElementById('practice-arena') || document.getElementById('typing-section')) {
    window.practiceApp = new PracticePageController();
    window.topicTyperApp = window.practiceApp;
  }

  if (document.getElementById('about-shell')) {
    window.aboutApp = new AboutPageController();
  }
});
