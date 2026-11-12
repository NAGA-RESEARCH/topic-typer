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
const WikipediaService = {
  // Curated diverse categories & topics for shuffling and fallback
  curatedTopics: [
    { title: 'Computer Science', icon: '💻' },
    { title: 'Space Exploration', icon: '🚀' },
    { title: 'Linux', icon: '🐧' },
    { title: 'History', icon: '📜' },
    { title: 'Cinema', icon: '🎬' },
    { title: 'Quantum Computing', icon: '⚡' },
    { title: 'Neuroscience', icon: '🧠' },
    { title: 'Ancient Rome', icon: '🏛️' },
    { title: 'Artificial Intelligence', icon: '🤖' },
    { title: 'Cybersecurity', icon: '🛡️' },
    { title: 'Black Hole', icon: '🌌' },
    { title: 'Philosophy', icon: '📚' },
    { title: 'James Webb Space Telescope', icon: '🔭' },
    { title: 'Alan Turing', icon: '🔢' },
    { title: 'Voyager Program', icon: '🛰️' },
    { title: 'Solar System', icon: '☀️' },
    { title: 'Cryptography', icon: '🔐' },
    { title: 'Machine Learning', icon: '⚙️' },
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

    const headers = { 'Api-User-Agent': 'TopicTyper/1.0 (typing-practice-app)' };
    const formattedTitle = rawQuery.replace(/\s+/g, '_');

    // 1. Direct REST Summary Request
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
// 4. TYPING ENGINE (REFACTORED WITH PRECISION CARET TRACKING)
// ============================================================================
class TypingEngine {
  constructor(options = {}) {
    this.wordsContainer = options.wordsContainer;
    this.caret = options.caret;
    this.hiddenInput = options.hiddenInput;
    this.onMetricsUpdate = options.onMetricsUpdate || (() => {});
    this.onComplete = options.onComplete || (() => {});

    // Target text and flat list of character spans
    this.targetText = '';
    this.charSpans = [];
    this.activeCharIndex = 0;

    // Metrics State
    this.startTime = null;
    this.timerInterval = null;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.errorCount = 0;
    this.isCompleted = false;
    this.isModalOpen = false;

    this.bindEvents();
  }

  get currentIndex() {
    return this.activeCharIndex;
  }

  set currentIndex(val) {
    this.activeCharIndex = val;
  }

  bindEvents() {
    this.hiddenInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.hiddenInput.addEventListener('input', (e) => this.handleInput(e));
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

  reset() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.startTime = null;
    this.activeCharIndex = 0;
    this.charSpans = [];
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.errorCount = 0;
    this.isCompleted = false;
    this.isModalOpen = false;
    this.hiddenInput.value = '';
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
    this.wordsContainer.innerHTML = '';
    this.wordsContainer.appendChild(this.caret);

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

  startTimerIfNeeded() {
    if (!this.startTime) {
      this.startTime = performance.now();
      this.timerInterval = setInterval(() => {
        if (!this.isCompleted) {
          this.updateMetrics();
        }
      }, 100);
    }
  }

  handleKeyDown(e) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;

    // Allow browser shortcuts
    if (['Tab', 'Escape', 'F5', 'F12', 'Alt', 'Control', 'Meta'].includes(e.key)) {
      return;
    }

    this.startTimerIfNeeded();

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
    this.startTimerIfNeeded();

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
    this.hiddenInput.value = '';
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
      this.finishTest();
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
      this.activeCharIndex++;
      this.updateCaretPosition();
      this.updateMetrics();
      if (this.targetText && this.targetText.length > 0 && this.currentIndex >= this.targetText.length) {
        this.finishTest();
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
      }
      SoundService.playKeyClick(true);
      this.activeCharIndex = nextSpaceIdx + 1;
      this.updateCaretPosition();
      this.updateMetrics();
      if (this.targetText && this.targetText.length > 0 && this.currentIndex >= this.targetText.length) {
        this.finishTest();
      }
    } else {
      this.processChar(' ');
    }
  }

  processChar(typedChar) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;
    if (this.currentIndex >= this.targetText.length) {
      this.finishTest();
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
    } else {
      this.errorCount++;
      if (span) {
        span.className = isSpace ? 'char incorrect char-space' : 'char incorrect';
      }
      SoundService.playKeyClick(true);
    }

    this.activeCharIndex++;
    this.updateCaretPosition();
    this.updateMetrics();

    if (this.targetText && this.targetText.length > 0 && this.currentIndex >= this.targetText.length) {
      this.finishTest();
    }
  }

  /**
   * Translates the blinking block caret using exact offsetLeft & offsetTop.
   * Dynamically sizes the block cursor to cover the active character with surgical precision.
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
        if (activeSpan.offsetWidth > 0) {
          this.caret.style.width = `${activeSpan.offsetWidth}px`;
        }
        if (activeSpan.offsetHeight > 0) {
          this.caret.style.height = `${activeSpan.offsetHeight}px`;
          this.caret.style.transform = `translate(${left}px, ${top}px)`;
        } else {
          const cy = activeSpan.offsetTop + (activeSpan.offsetHeight - this.caret.offsetHeight) / 2;
          this.caret.style.transform = `translate(${left}px, ${cy}px)`;
        }
      }
    } else if (this.charSpans.length > 0) {
      const lastSpan = this.charSpans[this.charSpans.length - 1];
      if (lastSpan) {
        const left = lastSpan.offsetLeft + lastSpan.offsetWidth;
        const top = lastSpan.offsetTop;
        if (lastSpan.offsetWidth > 0) {
          this.caret.style.width = `${lastSpan.offsetWidth}px`;
        }
        if (lastSpan.offsetHeight > 0) {
          this.caret.style.height = `${lastSpan.offsetHeight}px`;
          this.caret.style.transform = `translate(${left}px, ${top}px)`;
        } else {
          const cy = lastSpan.offsetTop + (lastSpan.offsetHeight - this.caret.offsetHeight) / 2;
          this.caret.style.transform = `translate(${left}px, ${cy}px)`;
        }
      }
    } else {
      this.caret.style.transform = `translate(0px, 0px)`;
    }
  }

  computeMetrics() {
    const elapsedSeconds = this.startTime ? Math.max((performance.now() - this.startTime) / 1000, 0.5) : 0;
    const elapsedMinutes = elapsedSeconds / 60;

    const correctChars = this.wordsContainer.querySelectorAll('.char.correct').length;
    const totalTargetChars = this.targetText.length;

    const wpm = elapsedMinutes > 0 ? Math.round((correctChars / 5) / elapsedMinutes) : 0;
    const rawWpm = elapsedMinutes > 0 ? Math.round((this.totalKeystrokes / 5) / elapsedMinutes) : 0;

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
      correctChars,
      totalTargetChars,
      totalKeystrokes: this.totalKeystrokes,
      errorCount: this.errorCount,
      progressPercent
    };
  }

  updateMetrics() {
    const metrics = this.computeMetrics();
    this.onMetricsUpdate(metrics);
  }

  finishTest() {
    if (this.isCompleted) return;
    // Guard: ONLY trigger when targetText.length > 0 and currentIndex >= targetText.length
    // Never trigger on empty 0 / 0 state during initial load or API fetch
    if (!this.targetText || this.targetText.length === 0) return;
    if (this.currentIndex < this.targetText.length) return;

    this.isCompleted = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.caret) {
      this.caret.classList.remove('typing');
    }
    const finalMetrics = this.computeMetrics();
    this.onComplete(finalMetrics);
  }
}

// ============================================================================
// 5. UI CONTROLLER & APPLICATION INITIALIZATION
// ============================================================================
class TopicTyperApp {
  constructor() {
    this.chunks = [];
    this.currentChunkIndex = 0;
    this.currentTopicData = null;
    this.sessionLogs = [];
    this.isModalOpen = false;

    this.initDOMElements();
    this.hideResultsModal();
    this.initClock();
    this.initSessionLogs();
    this.initTypingEngine();
    this.bindUIEvents();
    this.renderPresetTags();

    // On startup: load a dynamic random topic from Wikipedia!
    this.loadRandomTopic();
  }

  initDOMElements() {
    // Header & Controls
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.topicForm = document.getElementById('topic-form');
    this.topicInput = document.getElementById('topic-input');
    this.searchSubmitBtn = document.getElementById('search-submit-btn');
    this.randomTopicBtn = document.getElementById('random-topic-btn');
    this.quickTagsContainer = document.getElementById('quick-tags-container');
    this.shufflePresetLink = document.getElementById('shuffle-preset-link');
    this.statusBanner = document.getElementById('status-banner');
    this.bannerSpinner = document.getElementById('banner-spinner');
    this.bannerMessage = document.getElementById('banner-message');

    // Article Meta
    this.articleTitle = document.getElementById('article-title');
    this.wikiExternalLink = document.getElementById('wiki-external-link');
    this.articleDescription = document.getElementById('article-description');
    this.chunkCounter = document.getElementById('chunk-counter');
    this.chunkWordCount = document.getElementById('chunk-word-count');
    this.prevChunkBtn = document.getElementById('prev-chunk-btn');
    this.nextChunkBtn = document.getElementById('next-chunk-btn');

    // HUD Dashboard
    this.statWpm = document.getElementById('stat-wpm');
    this.statAccuracy = document.getElementById('stat-accuracy');
    this.statTime = document.getElementById('stat-time');
    this.statProgressText = document.getElementById('stat-progress-text');
    this.progressPercent = document.getElementById('progress-percent');
    this.progressBarFill = document.getElementById('progress-bar-fill');
    this.streamStatusBadge = document.getElementById('stream-status-badge');

    // Typing Practice Area
    this.typingSection = document.getElementById('typing-section');
    this.wordsContainer = document.getElementById('words-container');
    this.caret = document.getElementById('caret');
    this.hiddenInput = document.getElementById('hidden-input');
    this.focusOverlay = document.getElementById('focus-overlay');

    // Action Bar
    this.restartChunkBtn = document.getElementById('restart-chunk-btn');
    this.skipChunkBtn = document.getElementById('skip-chunk-btn');

    // Session Logs
    this.sessionLogsList = document.getElementById('session-logs-list');
    this.sessionLogCount = document.getElementById('session-log-count');
    this.clearLogsBtn = document.getElementById('clear-logs-btn');

    // Modal
    this.resultsModal = document.getElementById('results-modal');
    this.modalBackdrop = document.getElementById('modal-backdrop');
    this.modalCard = document.getElementById('modal-card');
    this.resWpm = document.getElementById('res-wpm');
    this.resAccuracy = document.getElementById('res-accuracy');
    this.resTime = document.getElementById('res-time');
    this.resRawWpm = document.getElementById('res-raw-wpm');
    this.resErrors = document.getElementById('res-errors');
    this.resChars = document.getElementById('res-chars');
    this.modalNextBtn = document.getElementById('modal-next-btn');
    this.modalRetryBtn = document.getElementById('modal-retry-btn');
    this.modalWikiLink = document.getElementById('modal-wiki-link');
  }

  initTypingEngine() {
    this.engine = new TypingEngine({
      wordsContainer: this.wordsContainer,
      caret: this.caret,
      hiddenInput: this.hiddenInput,
      onMetricsUpdate: (metrics) => this.renderHUD(metrics),
      onComplete: (finalMetrics) => this.showResultsModal(finalMetrics)
    });
  }

  /**
   * Shuffles and renders preset tags with diverse categories
   */
  renderPresetTags() {
    if (!this.quickTagsContainer) return;
    this.quickTagsContainer.innerHTML = '';

    // Pick 8 random distinct topics from curated pool
    const pool = [...WikipediaService.curatedTopics];
    const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 8);

    shuffled.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-tag-btn';
      btn.dataset.topic = item.title;
      btn.textContent = `${item.icon} ${item.title}`;
      btn.addEventListener('click', () => {
        this.topicInput.value = item.title;
        this.loadTopic(item.title);
      });
      this.quickTagsContainer.appendChild(btn);
    });

    // Add Shuffle button
    const shuffleBtn = document.createElement('button');
    shuffleBtn.type = 'button';
    shuffleBtn.className = 'quick-tag-btn shuffle-btn';
    shuffleBtn.id = 'shuffle-tags-btn';
    shuffleBtn.title = 'Shuffle Preset Categories';
    shuffleBtn.textContent = '🔀 Shuffle';
    shuffleBtn.addEventListener('click', () => this.renderPresetTags());
    this.quickTagsContainer.appendChild(shuffleBtn);
  }

  bindUIEvents() {
    // Topic Form Submit
    this.topicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const topic = this.topicInput.value.trim();
      if (topic) {
        this.loadTopic(topic);
      }
    });

    // Random Topic Button
    this.randomTopicBtn.addEventListener('click', () => {
      this.loadRandomTopic();
    });

    // Shuffle Preset Header Link
    if (this.shufflePresetLink) {
      this.shufflePresetLink.addEventListener('click', () => {
        this.renderPresetTags();
      });
    }

    // Clear Session History Logs Button
    if (this.clearLogsBtn) {
      this.clearLogsBtn.addEventListener('click', () => {
        this.sessionLogs = [];
        this.renderSessionLogs();
      });
    }

    // Sound Toggle
    this.soundToggleBtn.addEventListener('click', () => {
      const enabled = SoundService.toggle();
      this.soundToggleBtn.classList.toggle('muted', !enabled);
      this.soundToggleBtn.querySelector('.btn-icon').textContent = enabled ? '🔊' : '🔇';
      this.soundToggleBtn.querySelector('.btn-label').textContent = enabled ? 'SOUND: ON' : 'SOUND: OFF';
    });

    // Focus Management
    this.typingSection.addEventListener('click', () => {
      if (!this.isModalOpen) this.focusTypingArea();
    });
    this.focusOverlay.addEventListener('click', () => {
      if (!this.isModalOpen) this.focusTypingArea();
    });

    this.hiddenInput.addEventListener('focus', () => {
      if (this.isModalOpen || !this.resultsModal.classList.contains('hidden')) {
        this.hiddenInput.blur();
        return;
      }
      this.typingSection.classList.add('focused');
      this.focusOverlay.classList.add('hidden');
    });

    this.hiddenInput.addEventListener('blur', () => {
      if (document.activeElement === this.topicInput || this.isModalOpen || !this.resultsModal.classList.contains('hidden')) {
        return;
      }
      this.typingSection.classList.remove('focused');
      this.focusOverlay.classList.remove('hidden');
    });

    // Chunk Navigation Buttons
    this.prevChunkBtn.addEventListener('click', () => this.changeChunk(-1));
    this.nextChunkBtn.addEventListener('click', () => this.changeChunk(1));
    this.skipChunkBtn.addEventListener('click', () => this.changeChunk(1));
    this.restartChunkBtn.addEventListener('click', () => this.restartCurrentChunk());

    // Modal Actions & Outside Click Handling
    this.modalNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.advanceFromModal();
    });

    this.modalRetryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.retryFromModal();
    });

    // Clicking backdrop / anywhere outside modal-card dismisses cleanly
    this.modalBackdrop.addEventListener('click', (e) => {
      e.preventDefault();
      this.dismissModal();
    });

    this.resultsModal.addEventListener('click', (e) => {
      if (e.target === this.resultsModal) {
        e.preventDefault();
        this.dismissModal();
      }
    });

    if (this.modalCard) {
      this.modalCard.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // While isModalOpen is true:
      // - Enter or Space triggers "Next Chunk", hides modal, resets isModalOpen = false, re-focuses typing input
      // - Escape triggers "Retry Chunk", hides modal, re-focuses typing input
      // - Background keystrokes are completely ignored
      if (this.isModalOpen || !this.resultsModal.classList.contains('hidden')) {
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
        // Allow Tab to cycle focus between modal controls
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
        // Intercept keys so they don't bleed into typing area
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Shortcut: "/" to focus topic search input
      if (e.key === '/' && document.activeElement !== this.topicInput) {
        e.preventDefault();
        this.topicInput.focus();
        this.topicInput.select();
        return;
      }

      // Shortcut: Escape to restart current chunk
      if (e.key === 'Escape') {
        this.restartCurrentChunk();
        return;
      }

      // Shortcut: Tab to jump to next chunk
      if (e.key === 'Tab' && document.activeElement !== this.topicInput) {
        e.preventDefault();
        this.changeChunk(1);
        return;
      }

      // Focus typing area if pressing printable keys while not in an input
      if (document.activeElement !== this.topicInput && 
          document.activeElement !== this.hiddenInput && 
          !this.isModalOpen &&
          this.resultsModal.classList.contains('hidden') &&
          e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.focusTypingArea();
      }
    });
  }

  focusTypingArea() {
    if (this.isModalOpen || !this.resultsModal.classList.contains('hidden')) return;
    this.hiddenInput.value = '';
    this.hiddenInput.focus();
    this.typingSection.classList.add('focused');
    this.focusOverlay.classList.add('hidden');
    this.engine.updateCaretPosition();
  }

  showStatus(msg, type = 'info') {
    this.statusBanner.className = `status-banner banner-${type}`;
    this.bannerMessage.textContent = msg;
    this.bannerSpinner.classList.toggle('hidden', type !== 'loading');
    this.statusBanner.classList.remove('hidden');
  }

  hideStatus() {
    this.statusBanner.classList.add('hidden');
  }

  async loadRandomTopic() {
    this.showStatus('Rolling random topic from Wikipedia...', 'loading');
    this.searchSubmitBtn.disabled = true;
    this.randomTopicBtn.disabled = true;

    try {
      const data = await WikipediaService.fetchRandomTopicSummary();
      this.topicInput.value = data.title;
      this.processLoadedTopic(data);
    } catch (err) {
      console.error(err);
      this.showStatus('Failed to load random topic. Loading fallback...', 'error');
      // Curated fallback
      const fallbackItem = WikipediaService.curatedTopics[Math.floor(Math.random() * WikipediaService.curatedTopics.length)];
      this.loadTopic(fallbackItem.title);
    } finally {
      this.searchSubmitBtn.disabled = false;
      this.randomTopicBtn.disabled = false;
    }
  }

  async loadTopic(topicQuery) {
    this.showStatus(`Fetching summary for "${topicQuery}" from Wikipedia REST API...`, 'loading');
    this.searchSubmitBtn.disabled = true;
    this.randomTopicBtn.disabled = true;

    try {
      const data = await WikipediaService.fetchTopicSummary(topicQuery);
      this.processLoadedTopic(data);
    } catch (err) {
      console.error(err);
      this.showStatus(err.message || 'Failed to fetch topic summary.', 'error');
    } finally {
      this.searchSubmitBtn.disabled = false;
      this.randomTopicBtn.disabled = false;
    }
  }

  processLoadedTopic(data) {
    this.currentTopicData = data;

    // Sanitize & Chunk into 50-70 word typing chunks
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

    this.articleTitle.textContent = this.currentTopicData.title;
    this.articleDescription.textContent = this.currentTopicData.description || 'Wikipedia Summary';
    this.wikiExternalLink.href = this.currentTopicData.url;
    this.modalWikiLink.href = this.currentTopicData.url;
  }

  loadActiveChunk() {
    if (this.chunks.length === 0) return;

    const chunkText = this.chunks[this.currentChunkIndex];
    const wordCount = chunkText.split(/\s+/).filter(Boolean).length;

    // Update chunk badges
    this.chunkCounter.textContent = `CHUNK ${this.currentChunkIndex + 1} / ${this.chunks.length}`;
    this.chunkWordCount.textContent = `${wordCount} words`;

    // Update navigation buttons
    this.prevChunkBtn.disabled = (this.currentChunkIndex === 0);
    this.nextChunkBtn.disabled = (this.currentChunkIndex === this.chunks.length - 1);
    this.skipChunkBtn.querySelector('span').textContent = 
      (this.currentChunkIndex === this.chunks.length - 1) ? '↻ REPLAY [Tab]' : '➔ NEXT CHUNK [Tab]';

    // Load chunk into engine
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

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  renderHUD(metrics) {
    this.statWpm.textContent = metrics.wpm;
    this.statAccuracy.textContent = `${metrics.accuracy}%`;
    this.statTime.textContent = this.formatTime(metrics.elapsedSeconds);
    this.statProgressText.textContent = `${metrics.correctChars} / ${metrics.totalTargetChars}`;
    this.progressPercent.textContent = `${metrics.progressPercent}%`;
    this.progressBarFill.style.width = `${metrics.progressPercent}%`;

    // Update Live Stream Status Badge
    if (this.streamStatusBadge) {
      if (metrics.progressPercent === 100) {
        this.streamStatusBadge.textContent = '[STATUS: BUFFER_COMPLETE]';
        this.streamStatusBadge.className = 'progress-status status-complete';
      } else if (metrics.progressPercent > 0) {
        this.streamStatusBadge.textContent = `[STATUS: DECRYPTING ${metrics.progressPercent}%]`;
        this.streamStatusBadge.className = 'progress-status status-active';
      } else {
        this.streamStatusBadge.textContent = '[STATUS: READY]';
        this.streamStatusBadge.className = 'progress-status';
      }
    }
  }

  showResultsModal(finalMetrics) {
    // Guard: ONLY trigger when targetText.length > 0 and currentIndex >= targetText.length
    // Never trigger on empty 0 / 0 state during initial load or API fetch
    const targetText = this.engine?.targetText || '';
    const currentIndex = this.engine?.currentIndex ?? this.engine?.activeCharIndex ?? 0;
    if (!targetText || targetText.length === 0 || currentIndex < targetText.length) {
      return;
    }

    this.isModalOpen = true;
    if (this.engine) {
      this.engine.isModalOpen = true;
    }

    // Immediately blur hidden input and remove arena focus
    if (this.hiddenInput) {
      this.hiddenInput.blur();
    }
    if (this.typingSection) {
      this.typingSection.classList.remove('focused');
    }

    finalMetrics = finalMetrics || this.engine.computeMetrics();

    this.resWpm.textContent = finalMetrics.wpm;
    this.resAccuracy.textContent = `${finalMetrics.accuracy}%`;
    this.resTime.textContent = this.formatTime(finalMetrics.elapsedSeconds);
    this.resRawWpm.textContent = finalMetrics.rawWpm;
    this.resErrors.textContent = finalMetrics.errorCount;
    this.resChars.textContent = `${finalMetrics.correctChars} / ${finalMetrics.totalTargetChars}`;

    if (this.currentChunkIndex < this.chunks.length - 1) {
      this.modalNextBtn.querySelector('span').textContent = 'NEXT CHUNK [Enter / Space] ↵';
    } else {
      this.modalNextBtn.querySelector('span').textContent = 'RESTART TOPIC [Enter / Space] ↵';
    }

    // Record completed run to Session Logs
    this.recordSessionLog(finalMetrics);

    this.resultsModal.classList.remove('hidden');

    // Automatically focus primary modal action button
    setTimeout(() => {
      if (this.isModalOpen && this.modalNextBtn) {
        this.modalNextBtn.focus();
      }
    }, 20);
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
    if (this.engine) {
      this.engine.isModalOpen = false;
    }
    this.resultsModal.classList.add('hidden');
  }

  // ==========================================================================
  // Tactical HUD Additions: Real-Time Clock & Session Logging
  // ==========================================================================

  initClock() {
    const clockEl = document.getElementById('hud-clock');
    if (!clockEl) return;
    const update = () => {
      const now = new Date();
      clockEl.textContent = now.toTimeString().split(' ')[0];
    };
    update();
    setInterval(update, 1000);
  }

  initSessionLogs() {
    this.renderSessionLogs();
  }

  recordSessionLog(metrics) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const logItem = {
      topic: this.currentTopicData?.title || 'Unknown Target',
      chunkIndex: this.currentChunkIndex + 1,
      totalChunks: this.chunks.length,
      wpm: metrics.wpm,
      accuracy: metrics.accuracy,
      elapsedSeconds: metrics.elapsedSeconds,
      timestamp: timeStr
    };
    this.sessionLogs.unshift(logItem);
    if (this.sessionLogs.length > 8) {
      this.sessionLogs.pop();
    }
    this.renderSessionLogs();
  }

  renderSessionLogs() {
    if (!this.sessionLogsList) return;
    if (this.sessionLogCount) {
      this.sessionLogCount.textContent = `${this.sessionLogs.length} RUN${this.sessionLogs.length === 1 ? '' : 'S'} LOGGED`;
    }
    if (this.sessionLogs.length === 0) {
      this.sessionLogsList.innerHTML = `
        <div class="empty-log-state">
          <span class="terminal-dim">[LOG_DAEMON // STANDBY]</span> Telemetry stream initialized. Complete a chunk payload to log performance metrics.
        </div>
      `;
      return;
    }

    this.sessionLogsList.innerHTML = '';
    this.sessionLogs.forEach((log) => {
      const row = document.createElement('div');
      row.className = 'session-log-row';
      row.innerHTML = `
        <div class="log-meta">
          <span class="log-timestamp">[${log.timestamp}]</span>
          <span class="log-topic-name">${log.topic}</span>
          <span class="log-chunk-badge">CHUNK ${log.chunkIndex}/${log.totalChunks}</span>
        </div>
        <div class="log-stats">
          <span class="log-stat-wpm">${log.wpm} <span class="stat-unit-tiny">WPM</span></span>
          <span class="log-stat-acc">${log.accuracy}% <span class="stat-unit-tiny">ACC</span></span>
          <span class="log-badge-ok">[EXEC_OK]</span>
        </div>
      `;
      this.sessionLogsList.appendChild(row);
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.topicTyperApp = new TopicTyperApp();
});
