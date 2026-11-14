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
// 9. COMMUNITY & FEEDBACK HUB CONTROLLER (/community/)
// ============================================================================
class CommunityController {
  constructor() {
    this.hubEl = document.getElementById('community-hub');
    this.toggleComposerBtn = document.getElementById('toggle-post-composer-btn');
    this.guestComposeBtn = document.getElementById('guest-compose-btn');
    this.composerCard = document.getElementById('community-composer-card');
    this.closeComposerBtn = document.getElementById('close-composer-btn');
    this.cancelComposerBtn = document.getElementById('cancel-composer-btn');
    this.postTitleInput = document.getElementById('post-title');

    this.init();
  }

  showGuestLockModal(featureName) {
    const modal = document.getElementById('guest-lock-modal');
    if (!modal) return;
    const descEl = document.getElementById('lock-modal-desc');
    if (descEl && featureName) {
      descEl.textContent = `${featureName} requires an account. Sign in or create a free account to join discussions and share your suggestions.`;
    }
    modal.classList.remove('hidden');
  }

  init() {
    // 1. Composer Card Toggle
    if (this.toggleComposerBtn && this.composerCard) {
      this.toggleComposerBtn.addEventListener('click', () => {
        SoundService.playUITick();
        const isHidden = this.composerCard.classList.contains('hidden');
        this.composerCard.classList.toggle('hidden', !isHidden);
        if (isHidden && this.postTitleInput) {
          this.postTitleInput.focus();
        }
      });
    }

    if (this.guestComposeBtn) {
      this.guestComposeBtn.addEventListener('click', () => {
        this.showGuestLockModal('Creating a Discussion');
      });
    }

    if (this.closeComposerBtn && this.composerCard) {
      this.closeComposerBtn.addEventListener('click', () => {
        this.composerCard.classList.add('hidden');
      });
    }

    if (this.cancelComposerBtn && this.composerCard) {
      this.cancelComposerBtn.addEventListener('click', () => {
        this.composerCard.classList.add('hidden');
      });
    }

    // 2. Upvote Buttons (Async POST)
    document.querySelectorAll('.post-upvote-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        SoundService.playUITick();
        const isAuth = document.documentElement.getAttribute('data-authenticated') === 'true';
        if (!isAuth || btn.classList.contains('auth-locked-btn')) {
          this.showGuestLockModal('Upvoting Ideas');
          return;
        }

        const postId = btn.dataset.postId;
        if (!postId) return;

        try {
          const res = await fetch(`/community/post/${postId}/upvote/`, {
            method: 'POST',
            headers: {
              'X-CSRFToken': getCsrfToken(),
              'X-Requested-With': 'XMLHttpRequest'
            }
          });

          if (res.ok) {
            const data = await res.json();
            btn.classList.toggle('is-upvoted', data.upvoted);
            const countEl = document.getElementById(`upvote-count-${postId}`);
            if (countEl) countEl.textContent = data.upvote_count;
          }
        } catch (err) {
          console.warn('Upvote request failed:', err);
        }
      });
    });

    // 3. Comments Accordion Toggle
    document.querySelectorAll('.post-comment-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundService.playUITick();
        const targetId = btn.dataset.target;
        if (targetId) {
          const panel = document.getElementById(targetId);
          if (panel) {
            panel.classList.toggle('hidden');
          }
        }
      });
    });

    // 4. Async Comment Form Submission
    document.querySelectorAll('.comment-composer-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('.comment-input');
        const bodyText = input ? input.value.trim() : '';
        if (!bodyText) return;

        const postId = form.dataset.postId;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
          const formData = new FormData(form);
          const res = await fetch(form.action, {
            method: 'POST',
            headers: {
              'X-CSRFToken': getCsrfToken(),
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            if (data.comment) {
              const list = document.getElementById(`comments-list-${postId}`);
              const emptyHint = document.getElementById(`no-comments-hint-${postId}`);
              if (emptyHint) emptyHint.style.display = 'none';

              if (list) {
                const bubble = document.createElement('div');
                bubble.className = 'comment-bubble';
                bubble.innerHTML = `
                  <div class="comment-meta">
                    <span class="comment-author">@${data.comment.username}</span>
                    <span class="comment-time">just now</span>
                  </div>
                  <p class="comment-text">${data.comment.body}</p>
                `;
                list.appendChild(bubble);
              }

              if (input) input.value = '';

              const countPill = document.getElementById(`comment-count-pill-${postId}`);
              if (countPill && data.comment_count !== undefined) {
                countPill.textContent = `${data.comment_count} repl${data.comment_count === 1 ? 'y' : 'ies'}`;
              }
            }
          } else {
            form.submit();
          }
        } catch (err) {
          form.submit();
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    });
  }
}

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

// ============================================================================
// 1.4 VECTOR SVG ICON REGISTRY (100% Vector SVG Icons — Zero Emojis)
// ============================================================================
function getVectorIcon(iconKey) {
  const icons = {
    space: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"></path></svg>`,
    code: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    terminal: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
    shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    brain: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z"></path></svg>`,
    history: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>`,
    atom: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)"></ellipse><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)"></ellipse><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(150 12 12)"></ellipse></svg>`,
    dna: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 15 2-2 4 4-2 2zM18 7l2-2 4 4-2 2zM9 18l3-3M12 15l3-3M15 12l3-3M6 21l3-3M14 9l3-3"></path></svg>`,
    compass: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
    gear: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    dice: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 8h.01M8 8h.01M8 16h.01M16 16h.01M12 12h.01"></path></svg>`,
    number: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>`,
    sparkle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    bolt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    target: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
    trophy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"></path><path d="M6 4h12v7a6 6 0 0 1-12 0V4z"></path></svg>`,
    clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>`,
    book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    python: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    cpp: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline><line x1="12" y1="2" x2="12" y2="22"></line></svg>`,
    javascript: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    sql: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
    bash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
    html_css: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    volume_on: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    volume_off: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
  };
  return icons[iconKey] || icons.code;
}

const ThemeService = {
  THEMES: ['midnight', 'coding', 'hacking', 'funny', 'zen_matcha', 'warm_amber'],
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
        funny: 'Arcade',
        zen_matcha: 'Zen Matcha',
        warm_amber: 'Warm Amber'
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
        this.stop();
      } else {
        this.start();
      }
    });

    window.addEventListener('pagehide', () => this.stop());
    window.addEventListener('pageshow', () => this.start());

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
      // 100% Vector Arcade geometric confetti (circles, diamonds, triangles, stars)
      const shapes = ['circle', 'diamond', 'triangle', 'star'];
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
          size: 6 + Math.random() * 6,
          alpha: 0.25 + Math.random() * 0.35
        });
      }
    } else if (this.theme === 'zen_matcha') {
      // Calm Mint Fireflies softly floating and breathing
      const count = Math.min(28, Math.floor(this.width / 45));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -0.15 - Math.random() * 0.3,
          radius: 1.8 + Math.random() * 2.5,
          baseAlpha: 0.25 + Math.random() * 0.35,
          alphaPhase: Math.random() * Math.PI * 2,
          alphaSpeed: 0.02 + Math.random() * 0.02
        });
      }
    } else if (this.theme === 'warm_amber') {
      // Golden Amber rising embers
      const count = Math.min(30, Math.floor(this.width / 42));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.3 - Math.random() * 0.5,
          radius: 1.5 + Math.random() * 2.2,
          alpha: 0.25 + Math.random() * 0.45
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
    if (this.animId || document.hidden) return;
    const loop = () => {
      if (document.hidden) {
        this.animId = null;
        return;
      }
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  },

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
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
    } else if (this.theme === 'zen_matcha') {
      this.drawFireflies();
    } else if (this.theme === 'warm_amber') {
      this.drawEmbers();
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

      const s = p.size;
      this.ctx.beginPath();
      if (p.shape === 'circle') {
        this.ctx.arc(0, 0, s, 0, Math.PI * 2);
      } else if (p.shape === 'diamond') {
        this.ctx.moveTo(0, -s);
        this.ctx.lineTo(s, 0);
        this.ctx.lineTo(0, s);
        this.ctx.lineTo(-s, 0);
        this.ctx.closePath();
      } else if (p.shape === 'triangle') {
        this.ctx.moveTo(0, -s);
        this.ctx.lineTo(s, s);
        this.ctx.lineTo(-s, s);
        this.ctx.closePath();
      } else {
        // 4-point geometric star
        this.ctx.moveTo(0, -s);
        this.ctx.lineTo(s * 0.3, -s * 0.3);
        this.ctx.lineTo(s, 0);
        this.ctx.lineTo(s * 0.3, s * 0.3);
        this.ctx.lineTo(0, s);
        this.ctx.lineTo(-s * 0.3, s * 0.3);
        this.ctx.lineTo(-s, 0);
        this.ctx.lineTo(-s * 0.3, -s * 0.3);
        this.ctx.closePath();
      }
      this.ctx.fill();
      this.ctx.restore();
    }
  },

  drawFireflies() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.alphaPhase += p.alphaSpeed;

      if (p.y < -20) p.y = this.height + 10;
      if (p.x < -20) p.x = this.width + 10;
      if (p.x > this.width + 20) p.x = -10;

      const alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.alphaPhase));
      this.ctx.fillStyle = `rgba(110, 231, 183, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  },

  drawEmbers() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -20) p.y = this.height + 10;
      if (p.x < -20) p.x = this.width + 10;
      if (p.x > this.width + 20) p.x = -10;

      this.ctx.fillStyle = `rgba(251, 191, 36, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
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

// ============================================================================
// 1.8 CURATED TOPICS POOL (40+ TOPICS ACROSS 10 DIVERSE DOMAINS)
// ============================================================================
const CURATED_TOPICS_POOL = [
  // 1. Space & Cosmology
  { title: 'James Webb Space Telescope', displayTitle: 'James Webb', category: 'Cosmology', icon: 'space' },
  { title: 'Black Hole', displayTitle: 'Black Holes', category: 'Cosmology', icon: 'space' },
  { title: 'General Relativity', displayTitle: 'Relativity', category: 'Cosmology', icon: 'space' },
  { title: 'Voyager 1', displayTitle: 'Voyager 1', category: 'Spaceflight', icon: 'space' },
  { title: 'Dark Matter', displayTitle: 'Dark Matter', category: 'Cosmology', icon: 'sparkle' },

  // 2. Computer Science & AI
  { title: 'Artificial Intelligence', displayTitle: 'AI & Neural Nets', category: 'Computing', icon: 'code' },
  { title: 'Turing Machine', displayTitle: 'Turing Machine', category: 'Computer Science', icon: 'terminal' },
  { title: 'Deep Learning', displayTitle: 'Deep Learning', category: 'Machine Learning', icon: 'code' },
  { title: 'Algorithm', displayTitle: 'Algorithms', category: 'Computer Science', icon: 'number' },
  { title: 'Computer Architecture', displayTitle: 'Chip Architecture', category: 'Computing', icon: 'terminal' },

  // 3. Cybersecurity & Cryptography
  { title: 'Public-Key Cryptography', displayTitle: 'Cryptography', category: 'Security', icon: 'shield' },
  { title: 'Zero-Day Vulnerability', displayTitle: 'Zero-Day Exploits', category: 'Cybersecurity', icon: 'shield' },
  { title: 'RSA Cryptosystem', displayTitle: 'RSA Cipher', category: 'Cryptography', icon: 'shield' },
  { title: 'Quantum Cryptography', displayTitle: 'Quantum Crypto', category: 'Security', icon: 'shield' },

  // 4. Neuroscience & Psychology
  { title: 'Neuroplasticity', displayTitle: 'Neuroplasticity', category: 'Neuroscience', icon: 'brain' },
  { title: 'Cognitive Science', displayTitle: 'Cognitive Science', category: 'Mind', icon: 'brain' },
  { title: 'Dopamine', displayTitle: 'Dopamine & Drive', category: 'Neuroscience', icon: 'bolt' },
  { title: 'Consciousness', displayTitle: 'Consciousness', category: 'Psychology', icon: 'brain' },

  // 5. Ancient History
  { title: 'Ancient Rome', displayTitle: 'Ancient Rome', category: 'History', icon: 'history' },
  { title: 'Library of Alexandria', displayTitle: 'Alexandria Library', category: 'History', icon: 'history' },
  { title: 'Indus Valley Civilisation', displayTitle: 'Indus Valley', category: 'Archaeology', icon: 'history' },
  { title: 'Pyramids of Giza', displayTitle: 'Great Pyramids', category: 'History', icon: 'history' },
  { title: 'Renaissance', displayTitle: 'Renaissance', category: 'Art & History', icon: 'history' },

  // 6. Quantum Physics
  { title: 'Quantum Mechanics', displayTitle: 'Quantum Physics', category: 'Physics', icon: 'atom' },
  { title: 'Quantum Entanglement', displayTitle: 'Entanglement', category: 'Quantum', icon: 'atom' },
  { title: 'Schrodinger Equation', displayTitle: 'Wave Mechanics', category: 'Physics', icon: 'atom' },
  { title: 'Higgs Boson', displayTitle: 'Higgs Boson', category: 'Particle Physics', icon: 'atom' },

  // 7. Biology & Evolution
  { title: 'CRISPR Gene Editing', displayTitle: 'CRISPR Genetics', category: 'Genetics', icon: 'dna' },
  { title: 'Cambrian Explosion', displayTitle: 'Cambrian Era', category: 'Evolution', icon: 'dna' },
  { title: 'Biodiversity', displayTitle: 'Biodiversity', category: 'Nature', icon: 'dna' },
  { title: 'Origin of Life', displayTitle: 'Abiogenesis', category: 'Biology', icon: 'dna' },

  // 8. Philosophy
  { title: 'Stoicism', displayTitle: 'Stoicism', category: 'Philosophy', icon: 'history' },
  { title: 'Existentialism', displayTitle: 'Existentialism', category: 'Philosophy', icon: 'compass' },
  { title: 'Epistemology', displayTitle: 'Epistemology', category: 'Philosophy', icon: 'book' },
  { title: 'Philosophy of Mind', displayTitle: 'Mind & Dualism', category: 'Philosophy', icon: 'brain' },

  // 9. Engineering
  { title: 'Large Hadron Collider', displayTitle: 'Hadron Collider', category: 'Engineering', icon: 'gear' },
  { title: 'Semiconductor Device Fabrication', displayTitle: 'Silicon Chips', category: 'Hardware', icon: 'gear' },
  { title: 'Nuclear Fusion', displayTitle: 'Fusion Energy', category: 'Energy', icon: 'gear' },
  { title: 'Space Shuttle', displayTitle: 'Orbital Flight', category: 'Aerospace', icon: 'space' },

  // 10. Earth & Oceans
  { title: 'Mariana Trench', displayTitle: 'Mariana Trench', category: 'Deep Sea', icon: 'globe' },
  { title: 'Plate Tectonics', displayTitle: 'Plate Tectonics', category: 'Earth Science', icon: 'globe' },
  { title: 'Atmosphere of Earth', displayTitle: 'Atmosphere', category: 'Climate', icon: 'globe' },
  { title: 'Bioluminescence', displayTitle: 'Bioluminescence', category: 'Oceans', icon: 'sparkle' }
];

const WikipediaService = {
  // Curated diverse categories & topics for shuffling and fallback
  curatedTopics: CURATED_TOPICS_POOL,

  async fetchCatalog() {
    try {
      const res = await fetch('/api/topics/catalog/');
      if (res.ok) {
        const data = await res.json();
        if (data.topics && Array.isArray(data.topics) && data.topics.length > 0) {
          this.curatedTopics = data.topics;
          return data.topics;
        }
      }
    } catch (err) {
      console.warn('Could not fetch backend topic catalog, using local fallbacks:', err);
    }
    return this.curatedTopics;
  },

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
// 3. SOUND SYNTHESIZER SERVICE (Web Audio API Engine in sound.js)
// ============================================================================
const SoundService = window.SoundService || {
  audioCtx: null,
  enabled: true,
  profile: 'creamy',
  init() {},
  toggle() { return true; },
  setProfile(p) { return p; },
  playKeyClick(isError = false, keyType = 'char') {},
  playKeystroke(keyType = 'char', isError = false) {},
  playUITick() {},
  playCompletion(isNewPB = false) {}
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
          100% Accuracy on all ${weakKeys.length} tested keys!
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
// 4.5 CURATED DEVELOPER CODE SNIPPETS (PYTHON, C++, JS, SQL, BASH, HTML/CSS)
// 36+ realistic snippets across 6 languages & 3 difficulty tiers
// ============================================================================
const CodeSnippets = {
  python: [
    {
      id: 'py-metrics',
      title: 'List Comprehension & Metrics',
      filename: 'sales_metrics.py',
      lang: 'python',
      difficulty: 'Beginner',
      icon: 'python',
      description: 'Clean Python list comprehensions, conditionals, and dictionary aggregation.',
      code: `def calculate_metrics(transactions):
  valid_amounts = [t["amount"] for t in transactions if t["status"] == "completed"]
  total_revenue = sum(valid_amounts)
  avg_order = total_revenue / len(valid_amounts) if valid_amounts else 0.0
  return {"total": round(total_revenue, 2), "average": round(avg_order, 2)}`
    },
    {
      id: 'py-config',
      title: 'Context Manager File Parser',
      filename: 'config_parser.py',
      lang: 'python',
      difficulty: 'Beginner',
      icon: 'python',
      description: 'Safe file parsing using with context manager and string splitting.',
      code: `def load_server_config(filepath):
  config = {}
  with open(filepath, "r", encoding="utf-8") as file:
    for line in file:
      clean_line = line.strip()
      if clean_line and not clean_line.startswith("#"):
        key, val = clean_line.split("=", 1)
        config[key.strip()] = val.strip()
  return config`
    },
    {
      id: 'py-decorator',
      title: 'Timing & Retry Decorator',
      filename: 'retry_decorator.py',
      lang: 'python',
      difficulty: 'Intermediate',
      icon: 'python',
      description: 'Python function decorator with arguments, wraps, and error handling.',
      code: `import time
from functools import wraps

def retry(max_attempts=3, delay=1.0):
  def decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
      for attempt in range(1, max_attempts + 1):
        try:
          return func(*args, **kwargs)
        except Exception as exc:
          if attempt == max_attempts:
            raise exc
          time.sleep(delay)
    return wrapper
  return decorator`
    },
    {
      id: 'py-django-view',
      title: 'Django Class-Based API View',
      filename: 'user_api_view.py',
      lang: 'python',
      difficulty: 'Intermediate',
      icon: 'python',
      description: 'Idiomatic Django class-based view with JSON response handling.',
      code: `from django.http import JsonResponse
from django.views import View

class UserProfileView(View):
  def get(self, request, user_id):
    profile = {"id": user_id, "username": "dev_alex", "tier": "Pro"}
    return JsonResponse({"status": "success", "data": profile})

  def post(self, request, user_id):
    return JsonResponse({"message": "Profile updated successfully"})`
    },
    {
      id: 'py-lru-cache',
      title: 'LRU Cache Implementation',
      filename: 'lru_cache.py',
      lang: 'python',
      difficulty: 'DSA & Algorithms',
      icon: 'python',
      description: 'Double linked list and hash map implementation of an LRU cache.',
      code: `class Node:
  def __init__(self, key=0, val=0):
    self.key, self.val = key, val
    self.prev = self.next = None

class LRUCache:
  def __init__(self, capacity: int):
    self.cap = capacity
    self.cache = {}
    self.head, self.tail = Node(), Node()
    self.head.next, self.tail.prev = self.tail, self.head

  def get(self, key: int) -> int:
    if key in self.cache:
      node = self.cache[key]
      return node.val
    return -1`
    },
    {
      id: 'py-bin-search',
      title: 'Binary Search & Bounds',
      filename: 'binary_search.py',
      lang: 'python',
      difficulty: 'DSA & Algorithms',
      icon: 'python',
      description: 'Classic binary search algorithm in Python.',
      code: `def binary_search(nums, target):
  left, right = 0, len(nums) - 1
  while left <= right:
    mid = (left + right) // 2
    if nums[mid] == target:
      return mid
    elif nums[mid] < target:
      left = mid + 1
    else:
      right = mid - 1
  return -1`
    }
  ],
  cpp: [
    {
      id: 'cpp-vector-ops',
      title: 'Vector Transformations',
      filename: 'vector_ops.cpp',
      lang: 'cpp',
      difficulty: 'Beginner',
      icon: 'gear',
      description: 'C++ STL std::vector iterations and calculations.',
      code: `#include <iostream>
#include <vector>

int main() {
  std::vector<int> numbers = {10, 25, 30, 45, 50, 65};
  int total = 0;
  for (const int& val : numbers) {
    if (val > 25) {
      total += val * 2;
    }
  }
  std::cout << "Computed total: " << total << std::endl;
  return 0;
}`
    },
    {
      id: 'cpp-string-split',
      title: 'String Tokenizer & Stream',
      filename: 'string_parser.cpp',
      lang: 'cpp',
      difficulty: 'Beginner',
      icon: 'gear',
      description: 'String splitting with std::stringstream and std::vector.',
      code: `#include <iostream>
#include <sstream>
#include <vector>

std::vector<std::string> split(const std::string& text, char delimiter) {
  std::vector<std::string> tokens;
  std::stringstream stream(text);
  std::string token;
  while (std::getline(stream, token, delimiter)) {
    if (!token.empty()) {
      tokens.push_back(token);
    }
  }
  return tokens;
}`
    },
    {
      id: 'cpp-smart-pointer',
      title: 'Smart Pointers & Unique Ptr',
      filename: 'smart_pointer.cpp',
      lang: 'cpp',
      difficulty: 'Intermediate',
      icon: 'gear',
      description: 'Modern C++ memory management with std::make_unique.',
      code: `#include <memory>
#include <string>
#include <iostream>

class ConnectionPool {
public:
  std::string endpoint;
  explicit ConnectionPool(std::string ep) : endpoint(std::move(ep)) {}
  void connect() {
    std::cout << "Connected to: " << endpoint << std::endl;
  }
};

std::unique_ptr<ConnectionPool> createPool(const std::string& host) {
  return std::make_unique<ConnectionPool>(host);
}`
    },
    {
      id: 'cpp-thread-queue',
      title: 'Thread-Safe Queue Template',
      filename: 'thread_queue.cpp',
      lang: 'cpp',
      difficulty: 'Intermediate',
      icon: 'gear',
      description: 'C++ template queue with std::mutex and std::lock_guard.',
      code: `#include <queue>
#include <mutex>

template <typename T>
class SafeQueue {
private:
  std::queue<T> buffer;
  std::mutex lock;
public:
  void push(T value) {
    std::lock_guard<std::mutex> guard(lock);
    buffer.push(std::move(value));
  }
  bool empty() {
    std::lock_guard<std::mutex> guard(lock);
    return buffer.empty();
  }
};`
    },
    {
      id: 'cpp-lower-bound',
      title: 'Fast Lower Bound Search',
      filename: 'lower_bound.cpp',
      lang: 'cpp',
      difficulty: 'DSA & Algorithms',
      icon: 'gear',
      description: 'Iterative lower-bound algorithm for sorted vectors.',
      code: `#include <vector>

int lowerBound(const std::vector<int>& arr, int target) {
  int low = 0;
  int high = static_cast<int>(arr.size());
  while (low < high) {
    int mid = low + (high - low) / 2;
    if (arr[mid] >= target) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}`
    },
    {
      id: 'cpp-dfs-cycle',
      title: 'DFS Graph Cycle Detection',
      filename: 'dfs_graph.cpp',
      lang: 'cpp',
      difficulty: 'DSA & Algorithms',
      icon: 'gear',
      description: 'Graph cycle detection using 3-state depth-first search.',
      code: `#include <vector>

bool hasCycle(int node, const std::vector<std::vector<int>>& adj, std::vector<int>& visited) {
  visited[node] = 1;
  for (int next : adj[node]) {
    if (visited[next] == 1) return true;
    if (visited[next] == 0 && hasCycle(next, adj, visited)) return true;
  }
  visited[node] = 2;
  return false;
}`
    }
  ],
  javascript: [
    {
      id: 'js-pipeline',
      title: 'Array Pipeline & Reduce',
      filename: 'array_pipeline.js',
      lang: 'javascript',
      difficulty: 'Beginner',
      icon: 'bolt',
      description: 'Functional data transformation using filter, map, and reduce.',
      code: `const inventory = [
  { item: "Keyboard", price: 89, inStock: true },
  { item: "Mouse", price: 49, inStock: false },
  { item: "Monitor", price: 299, inStock: true }
];

const totalValue = inventory
  .filter(product => product.inStock)
  .map(product => product.price)
  .reduce((acc, curr) => acc + curr, 0);`
    },
    {
      id: 'js-debounce',
      title: 'Debounce Function Utility',
      filename: 'debounce.js',
      lang: 'javascript',
      difficulty: 'Beginner',
      icon: 'bolt',
      description: 'Standard closure-based debounce function for event handling.',
      code: `function debounce(callback, delay = 300) {
  let timerId = null;
  return function(...args) {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      callback.apply(this, args);
    }, delay);
  };
}`
    },
    {
      id: 'js-fetch-retry',
      title: 'Async Fetch with Backoff',
      filename: 'fetch_retry.js',
      lang: 'javascript',
      difficulty: 'Intermediate',
      icon: 'bolt',
      description: 'Async/await network request pipeline with exponential backoff.',
      code: `async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      return await response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }
}`
    },
    {
      id: 'js-event-bus',
      title: 'Typed Event Emitter',
      filename: 'event_bus.js',
      lang: 'javascript',
      difficulty: 'Intermediate',
      icon: 'bolt',
      description: 'Clean pub/sub event bus pattern using JavaScript Maps and Sets.',
      code: `class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(eventName, listener) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName).add(listener);
    return () => this.handlers.get(eventName).delete(listener);
  }

  emit(eventName, payload) {
    const list = this.handlers.get(eventName);
    if (list) list.forEach(cb => cb(payload));
  }
}`
    },
    {
      id: 'js-min-heap',
      title: 'Min-Heap Priority Queue',
      filename: 'min_heap.js',
      lang: 'javascript',
      difficulty: 'DSA & Algorithms',
      icon: 'bolt',
      description: 'Binary min-heap implementation with bubble-up reorganization.',
      code: `class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx] >= this.heap[parentIdx]) break;
      [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
      idx = parentIdx;
    }
  }
}`
    },
    {
      id: 'js-topo-sort',
      title: 'Topological Sort for DAGs',
      filename: 'topo_sort.js',
      lang: 'javascript',
      difficulty: 'DSA & Algorithms',
      icon: 'bolt',
      description: 'Kahn algorithm for topological sorting of directed graphs.',
      code: `function topologicalSort(numNodes, edges) {
  const inDegree = new Array(numNodes).fill(0);
  const graph = Array.from({ length: numNodes }, () => []);
  edges.forEach(([u, v]) => {
    graph[u].push(v);
    inDegree[v]++;
  });
  const queue = [];
  for (let i = 0; i < numNodes; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }
  return queue;
}`
    }
  ],
  sql: [
    {
      id: 'sql-revenue-agg',
      title: 'Customer Revenue Aggregations',
      filename: 'customer_revenue.sql',
      lang: 'sql',
      difficulty: 'Beginner',
      icon: 'sql',
      description: 'SQL GROUP BY, HAVING, and aggregate metrics.',
      code: `SELECT
  customer_id,
  COUNT(order_id) AS total_orders,
  SUM(order_total) AS total_spent,
  ROUND(AVG(order_total), 2) AS avg_basket_size
FROM orders
WHERE status = 'shipped'
GROUP BY customer_id
HAVING SUM(order_total) >= 500
ORDER BY total_spent DESC;`
    },
    {
      id: 'sql-table-joins',
      title: 'Multi-Table Inner & Left Joins',
      filename: 'orders_catalog_join.sql',
      lang: 'sql',
      difficulty: 'Beginner',
      icon: 'sql',
      description: 'Multi-table relational joins with filtering.',
      code: `SELECT
  u.username,
  o.order_id,
  p.product_name,
  oi.quantity,
  oi.unit_price
FROM users u
INNER JOIN orders o ON u.id = o.user_id
INNER JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.created_at >= '2026-01-01';`
    },
    {
      id: 'sql-window-rank',
      title: 'Window Functions & Partitioning',
      filename: 'window_ranking.sql',
      lang: 'sql',
      difficulty: 'Intermediate',
      icon: 'sql',
      description: 'DENSE_RANK() and AVG() window functions partitioned by department.',
      code: `SELECT
  department_id,
  employee_id,
  salary,
  DENSE_RANK() OVER (
    PARTITION BY department_id
    ORDER BY salary DESC
  ) AS dept_rank,
  AVG(salary) OVER (
    PARTITION BY department_id
  ) AS dept_avg_salary
FROM employees;`
    },
    {
      id: 'sql-monthly-cte',
      title: 'Monthly Cohort Revenue CTE',
      filename: 'monthly_revenue_cte.sql',
      lang: 'sql',
      difficulty: 'Intermediate',
      icon: 'sql',
      description: 'Common Table Expression (CTE) for monthly revenue trends.',
      code: `WITH monthly_metrics AS (
  SELECT
    DATE_TRUNC('month', order_date) AS sales_month,
    COUNT(DISTINCT customer_id) AS active_buyers,
    SUM(total_amount) AS gross_sales
  FROM sales
  GROUP BY sales_month
)
SELECT sales_month, active_buyers, gross_sales
FROM monthly_metrics
ORDER BY sales_month DESC;`
    },
    {
      id: 'sql-recursive-org',
      title: 'Recursive CTE Org Hierarchy',
      filename: 'org_hierarchy.sql',
      lang: 'sql',
      difficulty: 'DSA & Algorithms',
      icon: 'sql',
      description: 'Recursive common table expression navigating hierarchical employee trees.',
      code: `WITH RECURSIVE org_tree AS (
  SELECT id, manager_id, full_name, 1 AS depth
  FROM team_members
  WHERE manager_id IS NULL
  UNION ALL
  SELECT m.id, m.manager_id, m.full_name, t.depth + 1
  FROM team_members m
  INNER JOIN org_tree t ON m.manager_id = t.id
)
SELECT id, full_name, depth FROM org_tree ORDER BY depth;`
    },
    {
      id: 'sql-running-avg',
      title: 'Cumulative Rolling Average',
      filename: 'moving_average.sql',
      lang: 'sql',
      difficulty: 'DSA & Algorithms',
      icon: 'sql',
      description: '7-day moving window sum and average using window frames.',
      code: `SELECT
  recorded_date,
  daily_volume,
  SUM(daily_volume) OVER (
    ORDER BY recorded_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7day_sum,
  AVG(daily_volume) OVER (
    ORDER BY recorded_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7day_avg
FROM sensor_telemetry;`
    }
  ],
  bash: [
    {
      id: 'bash-log-filter',
      title: 'Log Analyzer & Grep Pipeline',
      filename: 'log_analyzer.sh',
      lang: 'bash',
      difficulty: 'Beginner',
      icon: 'terminal',
      description: 'Awk, grep, sort, and uniq pipelines for web server log analysis.',
      code: `#!/bin/bash
set -euo pipefail
LOG_FILE="/var/log/nginx/access.log"
echo "--- Top 10 IP Addresses by Request Count ---"
awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -nr | head -n 10
echo "--- HTTP 500 Errors ---"
grep " 500 " "$LOG_FILE" | tail -n 20`
    },
    {
      id: 'bash-sys-health',
      title: 'System Resources Health Check',
      filename: 'sys_health.sh',
      lang: 'bash',
      difficulty: 'Beginner',
      icon: 'terminal',
      description: 'Live server health snapshot checking uptime, memory, and disk.',
      code: `#!/bin/bash
echo "=== System Health Snapshot ==="
echo "Uptime: $(uptime -p)"
echo "Memory Usage:"
free -h | awk 'NR==2{printf "Used: %s / Total: %s (%.2f%%)\\n", $3, $2, $3/$2*100}'
echo "Disk Utilization:"
df -h / | awk 'NR==2{print "Root FS: " $5 " used (" $4 " available)"}'`
    },
    {
      id: 'bash-docker-clean',
      title: 'Docker Container Manager',
      filename: 'docker_cleanup.sh',
      lang: 'bash',
      difficulty: 'Intermediate',
      icon: 'terminal',
      description: 'Automated docker pruning and service cluster restart.',
      code: `#!/bin/bash
PROJECT_NAME="topic-typer"
echo "Cleaning dangling docker images and containers..."
docker ps -a --filter "status=exited" -q | xargs -r docker rm -v
docker images -f "dangling=true" -q | xargs -r docker rmi
echo "Restarting service cluster for $PROJECT_NAME..."
docker compose restart web worker`
    },
    {
      id: 'bash-git-worktree',
      title: 'Git Worktree Branch Setup',
      filename: 'git_worktree.sh',
      lang: 'bash',
      difficulty: 'Intermediate',
      icon: 'terminal',
      description: 'Git CLI automation for spinning up isolated worktree workspaces.',
      code: `#!/bin/bash
FEATURE_BRANCH="$1"
TARGET_DIR="../branches/$FEATURE_BRANCH"
if [ -z "$FEATURE_BRANCH" ]; then
  echo "Usage: $0 <branch-name>"
  exit 1
fi
git fetch origin main
git worktree add -b "$FEATURE_BRANCH" "$TARGET_DIR" origin/main
echo "Worktree active at $TARGET_DIR"`
    },
    {
      id: 'bash-batch-convert',
      title: 'Parallel File Conversion',
      filename: 'batch_convert.sh',
      lang: 'bash',
      difficulty: 'DSA & Algorithms',
      icon: 'terminal',
      description: 'Multiprocess image conversion utilizing find, xargs, and parallel workers.',
      code: `#!/bin/bash
SOURCE_DIR="./raw_assets"
DEST_DIR="./optimized"
mkdir -p "$DEST_DIR"
find "$SOURCE_DIR" -type f -name "*.png" -print0 | xargs -0 -P 4 -I {} bash -c '
  base=$(basename "{}" .png)
  cwebp -q 85 "{}" -o "'"$DEST_DIR"'/\${base}.webp"
'
echo "Batch compression finished."`
    },
    {
      id: 'bash-rate-monitor',
      title: 'Nginx DoS Traffic Monitor',
      filename: 'rate_monitor.sh',
      lang: 'bash',
      difficulty: 'DSA & Algorithms',
      icon: 'terminal',
      description: 'Automated request rate monitoring and threshold checking script.',
      code: `#!/bin/bash
THRESHOLD=50
tail -n 1000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | while read -r count ip; do
  if [ "$count" -gt "$THRESHOLD" ]; then
    echo "[ALERT] Potential DoS from $ip: $count requests"
    iptables -A INPUT -s "$ip" -j DROP
  fi
done`
    }
  ],
  html_css: [
    {
      id: 'web-navbar',
      title: 'Responsive Flexbox Header',
      filename: 'navbar.html',
      lang: 'html_css',
      difficulty: 'Beginner',
      icon: 'html_css',
      description: 'Clean semantic HTML header with modern navigation links.',
      code: `<header class="navbar">
  <div class="nav-brand">
    <img src="logo.svg" alt="App Logo" class="brand-img" />
    <span class="brand-title">TopicTyper</span>
  </div>
  <nav class="nav-links">
    <a href="/arena" class="nav-item active">Practice</a>
    <a href="/stats" class="nav-item">Analytics</a>
  </nav>
</header>`
    },
    {
      id: 'web-grid-cards',
      title: 'Responsive CSS Grid Cards',
      filename: 'card_grid.css',
      lang: 'html_css',
      difficulty: 'Beginner',
      icon: 'html_css',
      description: 'Auto-fit CSS grid layout with subtle hover elevation transitions.',
      code: `.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}
.card {
  border-radius: 12px;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-4px);
}`
    },
    {
      id: 'web-theme-toggle',
      title: 'Modern Animated Toggle Switch',
      filename: 'toggle_switch.html',
      lang: 'html_css',
      difficulty: 'Intermediate',
      icon: 'html_css',
      description: 'Accessible toggle switch component with smooth CSS transitions.',
      code: `<label class="theme-switch" aria-label="Toggle dark mode">
  <input type="checkbox" id="theme-toggle" class="switch-checkbox" />
  <span class="slider round">
    <span class="icon sun">&#9728;</span>
    <span class="icon moon">&#9790;</span>
  </span>
</label>
<style>
  .theme-switch { position: relative; width: 60px; height: 32px; }
  .slider { position: absolute; inset: 0; background: #334155; border-radius: 34px; }
</style>`
    },
    {
      id: 'web-modal-dialog',
      title: 'Glassmorphic Modal Dialog',
      filename: 'modal_backdrop.css',
      lang: 'html_css',
      difficulty: 'Intermediate',
      icon: 'html_css',
      description: 'Modern dialog overlay with backdrop blur and depth drop-shadows.',
      code: `.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1000;
}
.modal-dialog {
  max-width: 520px;
  width: 90%;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
}`
    },
    {
      id: 'web-shimmer-loader',
      title: 'Skeleton Shimmer Loading Card',
      filename: 'skeleton_shimmer.css',
      lang: 'html_css',
      difficulty: 'DSA & Algorithms',
      icon: 'html_css',
      description: 'Hardware-accelerated CSS gradient keyframe shimmer animation.',
      code: `.skeleton-box {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s infinite;
  border-radius: 6px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}`
    },
    {
      id: 'web-accordion',
      title: 'Accessible Details Accordion',
      filename: 'accordion.html',
      lang: 'html_css',
      difficulty: 'DSA & Algorithms',
      icon: 'html_css',
      description: 'Pure semantic HTML details and summary interactive accordion.',
      code: `<details class="accordion-item">
  <summary class="accordion-header">
    <span>Data Structures & Algorithms</span>
    <span class="chevron">&#9662;</span>
  </summary>
  <div class="accordion-content">
    <p>Practice tree traversals, dynamic programming, and binary search.</p>
  </div>
</details>`
    }
  ]
};

// Specialized Drills (Requirement 4)
const SPECIALIZED_DRILLS = [
  {
    id: 'symbols-gauntlet',
    title: 'Symbols & Brackets Gauntlet',
    category: 'Drill',
    tag: 'Developer Syntax',
    icon: 'bolt',
    difficulty: 'Pro',
    description: 'Heavy practice on {} [] () <> => != && || ; : for programmers.',
    text: 'if (key >= 0 && arr[i] != null) { return { id: items[key], valid: (x > 0 || y < 10) }; } const fn = (a, b) => (a <= b ? [a, b] : [b, a]); if (status === 200 && (user.role === "admin" || user.id === 1)) { config[type] = { active: true, flags: [1, 2, 4] }; }',
  },
  {
    id: 'linux-git-cli',
    title: 'Linux & Git Command Line',
    category: 'Drill',
    tag: 'Terminal Mastery',
    icon: 'terminal',
    difficulty: 'Intermediate',
    description: 'Real terminal commands: git, grep, awk, docker, chmod, and ssh.',
    text: 'git checkout -b feature/auth-upgrade && git commit -m "feat: user profile engine" && git push origin HEAD. docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:16. grep -rn "TODO" src/ | awk -F: \'{print $1, $2}\' | sort | uniq -c. chmod 755 deploy.sh && ssh -i ~/.ssh/id_rsa user@192.168.1.100 "systemctl restart nginx".',
  },
  {
    id: 'numbers-data-sprint',
    title: 'Numbers & Data Sprint',
    category: 'Drill',
    tag: 'Precision Alphanumeric',
    icon: 'number',
    difficulty: 'Beginner',
    description: 'Alphanumeric codes, IP addresses, dates, and financial figures.',
    text: 'Invoice #98214: billed $14,750.80 on 2026-11-13 via wire transfer. Server node-04 IP: 192.168.10.45 port: 8443 latency: 12.4ms packet loss: 0.02%. Order ID: 489-320-8199 quantity: 1,250 unit price: $42.50 discount: 15% subtotal: $45,156.25.',
  },
];

// ============================================================================
// 4.8 LIVE TACTILE VISUALIZERS: KEYCAP VISUALIZER & RHYTHM SPEED WAVEFORM
// ============================================================================

class KeycapVisualizer {
  constructor(options = {}) {
    this.container = options.container;
    this.boardEl = options.boardEl;
    this.nextCharEl = options.nextCharEl;
    this.toggleBtn = options.toggleBtn;
    this.toggleText = options.toggleText;
    this.storageKey = options.storageKey || 'topictyper_keycap_viz';

    this.keyElements = new Map();
    this.targetKeyElements = [];
    this.shiftKeyElements = [];
    this.currentTargetChar = null;

    if (!this.container || !this.boardEl) return;

    this.initLayout();
    this.bindEvents();
    this.loadState();
  }

  static get KEY_ROWS() {
    return [
      [
        { code: 'Backquote', label: '`', shift: '~' },
        { code: 'Digit1', label: '1', shift: '!' },
        { code: 'Digit2', label: '2', shift: '@' },
        { code: 'Digit3', label: '3', shift: '#' },
        { code: 'Digit4', label: '4', shift: '$' },
        { code: 'Digit5', label: '5', shift: '%' },
        { code: 'Digit6', label: '6', shift: '^' },
        { code: 'Digit7', label: '7', shift: '&' },
        { code: 'Digit8', label: '8', shift: '*' },
        { code: 'Digit9', label: '9', shift: '(' },
        { code: 'Digit0', label: '0', shift: ')' },
        { code: 'Minus', label: '-', shift: '_' },
        { code: 'Equal', label: '=', shift: '+' },
        { code: 'Backspace', label: 'Bksp', flex: 1.6 }
      ],
      [
        { code: 'Tab', label: 'Tab', flex: 1.4 },
        { code: 'KeyQ', label: 'Q', char: 'q' },
        { code: 'KeyW', label: 'W', char: 'w' },
        { code: 'KeyE', label: 'E', char: 'e' },
        { code: 'KeyR', label: 'R', char: 'r' },
        { code: 'KeyT', label: 'T', char: 't' },
        { code: 'KeyY', label: 'Y', char: 'y' },
        { code: 'KeyU', label: 'U', char: 'u' },
        { code: 'KeyI', label: 'I', char: 'i' },
        { code: 'KeyO', label: 'O', char: 'o' },
        { code: 'KeyP', label: 'P', char: 'p' },
        { code: 'BracketLeft', label: '[', shift: '{' },
        { code: 'BracketRight', label: ']', shift: '}' },
        { code: 'Backslash', label: '\\', shift: '|', flex: 1.2 }
      ],
      [
        { code: 'CapsLock', label: 'Caps', flex: 1.7 },
        { code: 'KeyA', label: 'A', char: 'a' },
        { code: 'KeyS', label: 'S', char: 's' },
        { code: 'KeyD', label: 'D', char: 'd' },
        { code: 'KeyF', label: 'F', char: 'f', homing: true },
        { code: 'KeyG', label: 'G', char: 'g' },
        { code: 'KeyH', label: 'H', char: 'h' },
        { code: 'KeyJ', label: 'J', char: 'j', homing: true },
        { code: 'KeyK', label: 'K', char: 'k' },
        { code: 'KeyL', label: 'L', char: 'l' },
        { code: 'Semicolon', label: ';', shift: ':' },
        { code: 'Quote', label: "'", shift: '"' },
        { code: 'Enter', label: 'Enter ↵', flex: 1.9 }
      ],
      [
        { code: 'ShiftLeft', label: 'Shift', flex: 2.1, isShift: true },
        { code: 'KeyZ', label: 'Z', char: 'z' },
        { code: 'KeyX', label: 'X', char: 'x' },
        { code: 'KeyC', label: 'C', char: 'c' },
        { code: 'KeyV', label: 'V', char: 'v' },
        { code: 'KeyB', label: 'B', char: 'b' },
        { code: 'KeyN', label: 'N', char: 'n' },
        { code: 'KeyM', label: 'M', char: 'm' },
        { code: 'Comma', label: ',', shift: '<' },
        { code: 'Period', label: '.', shift: '>' },
        { code: 'Slash', label: '/', shift: '?' },
        { code: 'ShiftRight', label: 'Shift', flex: 2.4, isShift: true }
      ],
      [
        { code: 'Space', label: 'Space', char: ' ', flex: 6.5, isSpace: true }
      ]
    ];
  }

  initLayout() {
    this.boardEl.innerHTML = '';
    this.keyElements.clear();
    this.shiftKeyElements = [];

    KeycapVisualizer.KEY_ROWS.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'keycap-row';

      row.forEach(keyDef => {
        const keyEl = document.createElement('div');
        keyEl.className = 'keycap';
        keyEl.dataset.code = keyDef.code;
        if (keyDef.flex) {
          keyEl.style.flex = `${keyDef.flex} 1 0px`;
        } else {
          keyEl.style.flex = '1 1 0px';
        }
        if (keyDef.homing) keyEl.classList.add('keycap-homing');
        if (keyDef.isSpace) keyEl.classList.add('keycap-space');
        keyEl.textContent = keyDef.label;

        rowEl.appendChild(keyEl);
        this.keyElements.set(keyDef.code, keyEl);
        if (keyDef.char) this.keyElements.set(keyDef.char, keyEl);
        if (keyDef.label) this.keyElements.set(keyDef.label.toLowerCase(), keyEl);
        if (keyDef.shift) this.keyElements.set(keyDef.shift, keyEl);
        if (keyDef.isShift) this.shiftKeyElements.push(keyEl);
      });

      this.boardEl.appendChild(rowEl);
    });
  }

  bindEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        if (typeof SoundService !== 'undefined') SoundService.playUITick();
        this.toggleVisibility();
      });
    }
  }

  loadState() {
    const saved = localStorage.getItem(this.storageKey);
    const isHidden = (saved === '0');
    if (isHidden) {
      this.container.classList.add('is-collapsed');
      if (this.toggleText) this.toggleText.textContent = 'Show Keys';
    } else {
      this.container.classList.remove('is-collapsed');
      if (this.toggleText) this.toggleText.textContent = 'Hide Keys';
    }
  }

  toggleVisibility() {
    const isCollapsed = this.container.classList.toggle('is-collapsed');
    localStorage.setItem(this.storageKey, isCollapsed ? '0' : '1');
    if (this.toggleText) {
      this.toggleText.textContent = isCollapsed ? 'Show Keys' : 'Hide Keys';
    }
  }

  updateTargetKey(targetChar) {
    this.currentTargetChar = targetChar;

    // Clear previous highlights
    this.targetKeyElements.forEach(el => el.classList.remove('key-target'));
    this.targetKeyElements = [];
    this.shiftKeyElements.forEach(el => el.classList.remove('key-shift-active'));

    if (!targetChar) {
      if (this.nextCharEl) this.nextCharEl.textContent = 'Done!';
      return;
    }

    let displayHint = targetChar;
    let targetCode = null;
    let needsShift = false;

    if (targetChar === ' ') {
      displayHint = 'Space';
      targetCode = 'Space';
    } else if (targetChar === '\n') {
      displayHint = 'Enter ↵';
      targetCode = 'Enter';
    } else if (targetChar === '\t') {
      displayHint = 'Tab ⇥';
      targetCode = 'Tab';
    } else if (/[A-Z]/.test(targetChar)) {
      needsShift = true;
      displayHint = `${targetChar} (Shift+${targetChar.toLowerCase()})`;
      targetCode = `Key${targetChar}`;
    } else if (/[a-z]/.test(targetChar)) {
      targetCode = `Key${targetChar.toUpperCase()}`;
    } else if (/[0-9]/.test(targetChar)) {
      targetCode = `Digit${targetChar}`;
    } else {
      const shiftedMap = {
        '~': { code: 'Backquote', base: '`' },
        '!': { code: 'Digit1', base: '1' },
        '@': { code: 'Digit2', base: '2' },
        '#': { code: 'Digit3', base: '3' },
        '$': { code: 'Digit4', base: '4' },
        '%': { code: 'Digit5', base: '5' },
        '^': { code: 'Digit6', base: '6' },
        '&': { code: 'Digit7', base: '7' },
        '*': { code: 'Digit8', base: '8' },
        '(': { code: 'Digit9', base: '9' },
        ')': { code: 'Digit0', base: '0' },
        '_': { code: 'Minus', base: '-' },
        '+': { code: 'Equal', base: '=' },
        '{': { code: 'BracketLeft', base: '[' },
        '}': { code: 'BracketRight', base: ']' },
        '|': { code: 'Backslash', base: '\\' },
        ':': { code: 'Semicolon', base: ';' },
        '"': { code: 'Quote', base: "'" },
        '<': { code: 'Comma', base: ',' },
        '>': { code: 'Period', base: '.' },
        '?': { code: 'Slash', base: '/' }
      };

      const unshiftedMap = {
        '`': 'Backquote',
        '-': 'Minus',
        '=': 'Equal',
        '[': 'BracketLeft',
        ']': 'BracketRight',
        '\\': 'Backslash',
        ';': 'Semicolon',
        "'": 'Quote',
        ',': 'Comma',
        '.': 'Period',
        '/': 'Slash'
      };

      if (shiftedMap[targetChar]) {
        needsShift = true;
        targetCode = shiftedMap[targetChar].code;
        displayHint = `${targetChar} (Shift+${shiftedMap[targetChar].base})`;
      } else if (unshiftedMap[targetChar]) {
        targetCode = unshiftedMap[targetChar];
      }
    }

    if (this.nextCharEl) {
      this.nextCharEl.textContent = displayHint;
    }

    if (needsShift) {
      this.shiftKeyElements.forEach(el => el.classList.add('key-shift-active'));
    }

    if (targetCode && this.keyElements.has(targetCode)) {
      const el = this.keyElements.get(targetCode);
      el.classList.add('key-target');
      this.targetKeyElements.push(el);
    }
  }

  flashKey(typedChar, isCorrect) {
    if (!typedChar) return;

    let el = null;
    if (typedChar === ' ') el = this.keyElements.get('Space');
    else if (typedChar === '\n') el = this.keyElements.get('Enter');
    else if (typedChar === '\t') el = this.keyElements.get('Tab');
    else if (typedChar === 'Backspace') el = this.keyElements.get('Backspace');
    else if (/[a-zA-Z]/.test(typedChar)) el = this.keyElements.get(`Key${typedChar.toUpperCase()}`);
    else if (/[0-9]/.test(typedChar)) el = this.keyElements.get(`Digit${typedChar}`);
    else if (this.keyElements.has(typedChar)) el = this.keyElements.get(typedChar);

    if (el) {
      const flashCls = isCorrect ? 'key-flash-correct' : 'key-flash-error';
      el.classList.remove('key-flash-correct', 'key-flash-error');
      void el.offsetWidth;
      el.classList.add(flashCls);
      setTimeout(() => {
        el.classList.remove(flashCls);
      }, 160);
    }
  }
}

class RhythmWaveformVisualizer {
  constructor(canvasEl, comboPillEl, comboLabelEl) {
    this.canvas = canvasEl;
    this.comboPill = comboPillEl;
    this.comboLabel = comboLabelEl;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.currentWpm = 0;
    this.targetWpm = 0;
    this.combo = 0;
    this.isTyping = false;
    this.energy = 0.15;
    this.animTime = 0;
    this.numBars = 52;

    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);

    this.render = this.render.bind(this);

    // Tab visibility handling: pause canvas animation when tab is hidden, resume when visible
    this.onVisibilityChange = () => {
      if (document.hidden) {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      } else {
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(this.render);
        }
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.rafId = requestAnimationFrame(this.render);
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || this.canvas.offsetWidth || 600;
    this.height = rect.height || 14;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  setSpeed(wpm, combo) {
    this.targetWpm = Math.max(0, wpm || 0);
    if (combo !== undefined) this.setCombo(combo);
  }

  setCombo(combo) {
    this.combo = combo || 0;
    if (this.comboPill && this.comboLabel) {
      if (this.combo >= 5) {
        this.comboLabel.textContent = `${this.combo} Streak`;
        this.comboPill.classList.remove('hidden');
      } else {
        this.comboPill.classList.add('hidden');
      }
    }
  }

  recordKeystroke(isCorrect, wpm, combo) {
    this.targetWpm = Math.max(0, wpm || 0);
    this.setCombo(combo);
    this.energy = Math.min(1.0, this.energy + (isCorrect ? 0.25 : 0.08));
    this.isTyping = true;
  }

  setTypingState(isTyping, wpm) {
    this.isTyping = isTyping;
    if (wpm !== undefined) this.targetWpm = wpm;
    if (!isTyping) {
      this.targetWpm = 0;
    }
  }

  render() {
    if (document.hidden) {
      this.rafId = null;
      return;
    }
    if (!this.ctx) return;
    const w = this.width;
    const h = this.height;

    this.ctx.clearRect(0, 0, w, h);

    // Smooth speed and energy easing
    this.currentWpm += (this.targetWpm - this.currentWpm) * 0.08;
    this.energy = Math.max(0.08, this.energy - 0.008);
    this.animTime += 0.04 + (this.currentWpm / 150) * 0.08;

    const barWidth = Math.max(2, (w / this.numBars) - 2);
    const step = w / this.numBars;
    const speedFactor = Math.min(2.5, Math.max(0.2, this.currentWpm / 35));

    // Dynamic gradient based on WPM and Combo Streak
    let colorStart, colorEnd;
    if (this.combo >= 25 || this.currentWpm >= 80) {
      colorStart = '#f59e0b';
      colorEnd = '#ec4899';
    } else if (this.combo >= 10 || this.currentWpm >= 50) {
      colorStart = '#10b981';
      colorEnd = '#38bdf8';
    } else {
      colorStart = 'rgba(56, 189, 248, 0.4)';
      colorEnd = 'rgba(99, 102, 241, 0.6)';
    }

    const grad = this.ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(0.5, colorEnd);
    grad.addColorStop(1, colorStart);

    this.ctx.fillStyle = grad;

    for (let i = 0; i < this.numBars; i++) {
      const x = i * step + 1;
      const wave = Math.sin(this.animTime + i * 0.28) * Math.cos(this.animTime * 0.5 + i * 0.15);
      const normalizedWave = (wave + 1) * 0.5;
      const barH = Math.max(2, normalizedWave * (h - 2) * this.energy * speedFactor);
      const y = h - barH;

      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(x, y, barWidth, barH, [1, 1, 0, 0]);
      } else {
        this.ctx.rect(x, y, barWidth, barH);
      }
      this.ctx.fill();
    }

    this.rafId = requestAnimationFrame(this.render);
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    if (this.onVisibilityChange) document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

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
    this.onTypingStateChange = options.onTypingStateChange || (() => {});
    this.onKeystroke = options.onKeystroke || null;
    this.onTargetCharChange = options.onTargetCharChange || null;
    this._caretRaf = null;

    // Practice Mode: 'paragraph' (default), 'timed', or 'drill'
    this.mode = options.mode || 'paragraph';
    this.timeLimit = options.timeLimit || 60; // in seconds for timed mode
    this.isCodeMode = options.isCodeMode || (options.mode === 'code');
    this.smartIndent = options.smartIndent !== undefined ? options.smartIndent : this.isCodeMode;
    this.onLineChange = options.onLineChange || null;

    // Target text and flat list of character spans
    this.targetText = '';
    this.charSpans = [];
    this.charElements = this.charSpans;
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

    // Metrics & Combo State
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.currentChunkCorrectChars = 0;
    this.errorCount = 0;
    this.comboStreak = 0;
    this.maxComboStreak = 0;
    this.currentWpm = 0;
    this.isCompleted = false;
    this.isModalOpen = false;
    this.sessionKeyStats = {};
    this.prevActiveSpan = null;

    this.bindEvents();
  }

  get charElements() {
    return this.charSpans;
  }

  set charElements(val) {
    this.charSpans = val || [];
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

  getTargetChar() {
    if (!this.targetText || this.activeCharIndex >= this.targetText.length) return null;
    return this.targetText[this.activeCharIndex];
  }

  loadChunk(chunkText) {
    this.reset();
    this.targetText = chunkText.trim();
    this.renderDOM();
    this.updateMetrics();
    this.onTargetCharChange?.(this.getTargetChar());
    requestAnimationFrame(() => {
      this.updateCaretPosition();
    });
  }

  /**
   * Seamlessly loads the next paragraph in Timed Mode without stopping the active countdown!
   * Keeps active timer, elapsed time accumulation, and cumulative keystrokes intact.
   */
  loadNextChunkSeamlessly(chunkText) {
    this.cumulativeCorrectChars += this.currentChunkCorrectChars;
    this.currentChunkCorrectChars = 0;
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
    this.onTargetCharChange?.(this.getTargetChar());
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
    this.charElements = this.charSpans;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.currentChunkCorrectChars = 0;
    this.errorCount = 0;
    this.comboStreak = 0;
    this.isCompleted = false;
    this.isModalOpen = false;
    if (this.prevActiveSpan) {
      this.prevActiveSpan.classList.remove('char-current');
      this.prevActiveSpan = null;
    }
    if (this.hiddenInput) {
      this.hiddenInput.value = '';
    }
    this.onPauseStateChange(false);
    this.onTypingStateChange(false);
    if (this.caret) {
      this.caret.classList.remove('typing');
    }
  }

  getSyntaxClass(token) {
    if (!token) return '';
    const clean = token.replace(/^[^\w]+|[^\w]+$/g, '');
    const keywords = new Set([
      'def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while',
      'try', 'except', 'const', 'let', 'var', 'function', 'async', 'await', 'new',
      'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'JOIN', 'LEFT', 'INNER',
      'WITH', 'AS', 'OVER', 'PARTITION', 'set', 'echo', 'grep', 'awk', 'find',
      'int', 'void', 'bool', 'std', 'vector', 'string', 'header', 'style', 'nav', 'div',
      'public', 'private', 'explicit', 'template', 'typename'
    ]);
    if (keywords.has(clean) || keywords.has(token)) return 'syntax-keyword';
    if (/^\d+(\.\d+)?$/.test(clean || token)) return 'syntax-number';
    if (token.startsWith('"') || token.startsWith("'") || token.endsWith('"') || token.endsWith("'")) return 'syntax-string';
    if (token.startsWith('#') || token.startsWith('//') || token.startsWith('--')) return 'syntax-comment';
    if (/^[{}[\]()=>!&|;:+\-*/%^<>,.]+$/.test(token)) return 'syntax-symbol';
    return '';
  }

  /**
   * Renders target text with 1 span per character (and space).
   * Words are grouped into <span class="word"> with NO position:relative
   * so offsetLeft and offsetTop are relative to wordsContainer.
   * Pre-caches all character spans into this.charElements for 0-lookup typing.
   */
  renderDOM() {
    if (!this.wordsContainer) return;
    this.wordsContainer.innerHTML = '';
    if (this.caret) {
      this.wordsContainer.appendChild(this.caret);
    }

    this.charSpans = [];
    this.charElements = this.charSpans;
    this.currentChunkCorrectChars = 0;

    const lines = this.targetText.split('\n');

    lines.forEach((lineStr, lineIdx) => {
      if (lineIdx > 0) {
        // Linebreak newline indicator for multiline text / code
        const newlineSpan = document.createElement('span');
        newlineSpan.className = 'char untyped char-newline';
        newlineSpan.textContent = '↵';
        newlineSpan.dataset.charIndex = this.charSpans.length;
        this.wordsContainer.appendChild(newlineSpan);
        this.charSpans.push(newlineSpan);
        this.wordsContainer.appendChild(document.createElement('br'));
      }

      let i = 0;
      while (i < lineStr.length) {
        if (lineStr[i] === ' ') {
          const spaceSpan = document.createElement('span');
          spaceSpan.className = 'char untyped char-space';
          spaceSpan.innerHTML = '&nbsp;';
          spaceSpan.dataset.charIndex = this.charSpans.length;
          this.wordsContainer.appendChild(spaceSpan);
          this.charSpans.push(spaceSpan);
          i++;
        } else {
          let wordChars = '';
          while (i < lineStr.length && lineStr[i] !== ' ') {
            wordChars += lineStr[i];
            i++;
          }
          const wordSpan = document.createElement('span');
          wordSpan.className = 'word';
          const syntaxCls = (this.isCodeMode || this.mode === 'code') ? this.getSyntaxClass(wordChars) : '';
          for (let j = 0; j < wordChars.length; j++) {
            const charSpan = document.createElement('span');
            charSpan.className = syntaxCls ? `char untyped ${syntaxCls}` : 'char untyped';
            if (syntaxCls) {
              charSpan.dataset.syntax = syntaxCls;
            }
            charSpan.textContent = wordChars[j];
            charSpan.dataset.charIndex = this.charSpans.length;
            wordSpan.appendChild(charSpan);
            this.charSpans.push(charSpan);
          }
          this.wordsContainer.appendChild(wordSpan);
        }
      }
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

    this.onTypingStateChange(true);
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
    this.onTypingStateChange(false);
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
    const totalCorrect = this.cumulativeCorrectChars + this.currentChunkCorrectChars;
    const instWpm = Math.max(0, Math.round((totalCorrect / 5) / elapsedMinutes));
    this.instantaneousSamples.push({
      time: Math.round(elapsedSeconds),
      wpm: instWpm
    });
  }

  handleKeyDown(e) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;

    // Ignore browser modifier combinations (Ctrl+C, Ctrl+V, Alt+Tab, Cmd+R, etc.)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // Ignore browser navigation and non-typing control keys
    if (['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'PageUp', 'PageDown', 'Home', 'End', 'Insert', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(e.key)) {
      return;
    }

    this.recordKeystrokeActivity();

    // Handle Enter (especially for newlines in code & multiline text)
    if (e.key === 'Enter') {
      e.preventDefault();
      const targetChar = this.targetText[this.activeCharIndex];
      if (targetChar === '\n') {
        this.processChar('\n');
        // Smart Enter Indent: automatically skip leading indentation spaces on the next line
        if (this.smartIndent || this.isCodeMode || this.mode === 'code') {
          while (
            this.activeCharIndex < this.targetText.length &&
            (this.targetText[this.activeCharIndex] === ' ' || this.targetText[this.activeCharIndex] === '\t')
          ) {
            const indentSpan = this.charElements[this.activeCharIndex];
            if (indentSpan && indentSpan.classList) {
              indentSpan.className = 'char correct char-space';
            }
            this.correctKeystrokes++;
            this.currentChunkCorrectChars++;
            this.activeCharIndex++;
          }
          this.updateCaretPosition();
          this.updateMetrics();
          if (this.activeCharIndex >= this.targetText.length) {
            if (this.mode === 'timed') {
              if (typeof this.onChunkComplete === 'function') this.onChunkComplete();
            } else {
              this.finishTest();
            }
          }
        }
      } else {
        // Critical Fix: Pressing Enter mid-line before reaching \n treats it as a
        // single-character error and NEVER skips the rest of the current line.
        this.processChar('\n');
      }
      return;
    }

    // Handle Tab in code or custom mode (indentation helper)
    if (e.key === 'Tab') {
      if (this.mode === 'code' || this.mode === 'custom' || this.isCodeMode) {
        e.preventDefault();
        if (this.targetText[this.activeCharIndex] === ' ') {
          this.processChar(' ');
          if (this.targetText[this.activeCharIndex] === ' ') {
            this.processChar(' ');
          }
        }
      }
      return;
    }

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

    // Ignore any multi-character control keys (ArrowLeft, ArrowUp, etc.)
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
      const span = this.charElements ? this.charElements[this.activeCharIndex] : null;
      if (span && span.classList) {
        if (span.classList.contains('correct')) {
          this.currentChunkCorrectChars = Math.max(0, this.currentChunkCorrectChars - 1);
        }
        const isSpace = span.classList.contains('char-space');
        const isNewline = span.classList.contains('char-newline');
        const syntaxCls = span.dataset?.syntax || '';
        if (isSpace) {
          span.className = 'char untyped char-space';
        } else if (isNewline) {
          span.className = 'char untyped char-newline';
        } else if (syntaxCls) {
          span.className = `char untyped ${syntaxCls}`;
        } else {
          span.className = 'char untyped';
        }
      }
      SoundService?.playKeystroke?.('backspace', false);
      this.updateCaretPosition();
      this.updateMetrics();
      this.onKeystroke?.({ char: 'Backspace', isCorrect: true, combo: this.comboStreak });
      this.onTargetCharChange?.(this.getTargetChar());
    }
  }

  handleSpace() {
    this.processChar(' ');
  }

  processChar(typedChar) {
    if (this.isCompleted || this.isModalOpen || !this.targetText || this.targetText.length === 0) return;
    if (this.activeCharIndex >= this.targetText.length) {
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
    const span = this.charElements ? this.charElements[this.activeCharIndex] : null;
    const isSpace = span?.classList ? span.classList.contains('char-space') : false;
    const isNewline = span?.classList ? span.classList.contains('char-newline') : false;

    this.totalKeystrokes++;
    const isMatch = (typedChar === targetChar);

    // Determine acoustic key profile category
    let keyType = 'char';
    if (typedChar === ' ' || targetChar === ' ') {
      keyType = 'space';
    } else if (typedChar === '\n' || targetChar === '\n') {
      keyType = 'enter';
    } else if (typedChar === '\t') {
      keyType = 'tab';
    }

    if (isMatch) {
      this.correctKeystrokes++;
      this.currentChunkCorrectChars++;
      this.comboStreak = (this.comboStreak || 0) + 1;
      if (this.comboStreak > (this.maxComboStreak || 0)) {
        this.maxComboStreak = this.comboStreak;
      }
      if (span && span.classList) {
        if (isSpace) {
          span.className = 'char correct char-space';
        } else if (isNewline) {
          span.className = 'char correct char-newline';
        } else {
          span.className = 'char correct';
        }
      }
      SoundService?.playKeystroke?.(keyType, false);
      this.recordSessionKey(targetChar, true);
    } else {
      this.errorCount++;
      this.comboStreak = 0;
      if (span && span.classList) {
        if (isSpace) {
          span.className = 'char incorrect char-space';
        } else if (isNewline) {
          span.className = 'char incorrect char-newline';
        } else {
          span.className = 'char incorrect';
        }
      }
      SoundService?.playKeystroke?.(keyType, true);
      this.recordSessionKey(targetChar, false);
    }

    this.onKeystroke?.({ char: typedChar, targetChar, isCorrect: isMatch, combo: this.comboStreak });
    this.activeCharIndex++;
    this.updateCaretPosition();
    this.updateMetrics();
    this.onTargetCharChange?.(this.getTargetChar());

    if (this.targetText && this.targetText.length > 0 && this.activeCharIndex >= this.targetText.length) {
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
   * Translates the high-visibility animated vertical I-beam caret (2.5px wide).
   * Features glowing accent color, hardware-accelerated translate3d, plus subtle
   * translucent highlight box on the current character.
   */
  updateCaretPosition() {
    if (!this.caret || !this.wordsContainer) return;

    this.caret.classList.add('typing');

    // Remove previous character highlight box
    if (this.prevActiveSpan && this.prevActiveSpan !== this.charElements[this.activeCharIndex]) {
      this.prevActiveSpan.classList.remove('char-current');
      this.prevActiveSpan = null;
    }

    if (this.activeCharIndex < this.charElements.length) {
      const activeSpan = this.charElements[this.activeCharIndex];
      if (activeSpan) {
        activeSpan.classList.add('char-current');
        this.prevActiveSpan = activeSpan;

        const left = activeSpan.offsetLeft;
        const top = activeSpan.offsetTop;
        const h = activeSpan.offsetHeight || 26;
        this.caret.style.width = '2.5px';
        this.caret.style.height = `${h}px`;
        this.caret.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        if (typeof activeSpan.scrollIntoView === 'function') {
          activeSpan.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    } else if (this.charElements.length > 0) {
      const lastSpan = this.charElements[this.charElements.length - 1];
      if (lastSpan) {
        const left = lastSpan.offsetLeft + lastSpan.offsetWidth;
        const top = lastSpan.offsetTop;
        const h = lastSpan.offsetHeight || 26;
        this.caret.style.width = '2.5px';
        this.caret.style.height = `${h}px`;
        this.caret.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
    } else {
      this.caret.style.transform = 'translate3d(0px, 0px, 0)';
    }

    if (typeof this.onLineChange === 'function' && this.targetText) {
      const typedBefore = this.targetText.substring(0, this.activeCharIndex);
      const currentLine = (typedBefore.match(/\n/g) || []).length + 1;
      this.onLineChange(currentLine);
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

    const totalCorrectChars = this.cumulativeCorrectChars + this.currentChunkCorrectChars;
    const totalTargetChars = this.targetText.length;

    const wpm = (this.startTime && elapsedMinutes > 0) ? Math.round((totalCorrectChars / 5) / elapsedMinutes) : 0;
    const rawWpm = (this.startTime && elapsedMinutes > 0) ? Math.round((this.totalKeystrokes / 5) / elapsedMinutes) : 0;

    const accuracy = this.totalKeystrokes > 0 
      ? Math.max(0, Math.min(100, Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100))) 
      : 100;

    const progressPercent = totalTargetChars > 0 
      ? Math.min(100, Math.round((this.activeCharIndex / totalTargetChars) * 100)) 
      : 0;

    this.currentWpm = Math.max(0, wpm);

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
      combo: this.comboStreak || 0,
      maxCombo: this.maxComboStreak || 0,
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
    // SoundUIController in sound.js manages the dropdown menu and profiles.
    if (window.SoundUIController) {
      return;
    }
    this.updateSoundBtn();
    this.soundToggleBtn.addEventListener('click', () => {
      SoundService.toggle();
      this.updateSoundBtn();
    });
  }

  updateSoundBtn() {
    if (!this.soundToggleBtn) return;
    if (window.SoundUIController && typeof window.SoundUIController.updateUI === 'function') {
      window.SoundUIController.updateUI();
      return;
    }
    const enabled = SoundService.enabled;
    this.soundToggleBtn.classList.toggle('muted', !enabled);
    const iconSpan = this.soundToggleBtn.querySelector('.btn-icon');
    const labelSpan = this.soundToggleBtn.querySelector('.btn-label');
    if (iconSpan) iconSpan.innerHTML = enabled ? getVectorIcon('volume_on') : getVectorIcon('volume_off');
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
      // Shortcut "/" focuses the header search input (or home custom topic input if on Home)
      if (e.key === '/') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          const modalEl = document.getElementById('results-modal');
          const isModalOpen = window.practiceApp?.isModalOpen || (modalEl && !modalEl.classList.contains('hidden'));
          if (!isModalOpen) {
            if (this.searchInput) {
              e.preventDefault();
              this.searchInput.focus();
              this.searchInput.select();
            } else {
              const homeInput = document.getElementById('custom-topic-input');
              if (homeInput) {
                e.preventDefault();
                homeInput.focus();
                homeInput.select();
              }
            }
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
    
    // Zero default pre-selection on load (user choice first, Quantum NOT pre-selected)
    this.selectedTopic = null;
    this.showMovingAvg = true;
    this.sessionLogs = AnalyticsService.getSessions();

    // Code Snippet Selection State
    this.activeCodeLang = 'python';
    this.activeSnippetIdx = 0;

    this.initDOMElements();
    this.renderDynamicTopicCards();
    this.restoreStoredState();
    this.restorePBAndStreak();
    this.bindEvents();
    this.loadAnalytics();
  }

  restorePBAndStreak() {
    try {
      const pb = localStorage.getItem('topictyper_pb_wpm');
      const streak = localStorage.getItem('topictyper_daily_streak');
      if (this.homePbText) {
        const pbVal = pb ? Math.round(parseFloat(pb)) : 0;
        this.homePbText.textContent = `${pbVal} WPM`;
      }
      if (streak && this.homeStreakText) {
        this.homeStreakText.textContent = `${streak} Day Streak`;
      }
    } catch (e) {}
  }

  updatePBAndStreak(pbWpm, dailyStreak) {
    const pbVal = Math.round(pbWpm || 0);
    if (this.homePbText) {
      this.homePbText.textContent = `${pbVal} WPM`;
    }
    if (this.homeStreakText) {
      const streak = dailyStreak || 0;
      this.homeStreakText.textContent = `${streak} Day Streak`;
    }
    try {
      localStorage.setItem('topictyper_pb_wpm', String(pbVal));
      localStorage.setItem('topictyper_daily_streak', String(dailyStreak || 0));
    } catch (e) {}
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
        this.updatePBAndStreak(data.personal_best_wpm, data.daily_streak);
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
    
    // Topic Grid & Inline Prompt
    this.curatedTopicGrid = document.getElementById('curated-topic-grid');
    this.topicPromptPill = document.getElementById('topic-prompt-pill');
    this.topicCards = document.querySelectorAll('.topic-card');
    this.customTopicInput = document.getElementById('custom-topic-input');
    this.startPracticeBtn = document.getElementById('start-practice-btn');

    // Header PB & Streak Badges
    this.homePbText = document.getElementById('home-pb-text');
    this.homeStreakText = document.getElementById('home-streak-text');

    // Source Tabs (Wikipedia vs Specialized Drills vs Custom / Code)
    this.tabSourceWiki = document.getElementById('tab-source-wiki');
    this.tabSourceDrills = document.getElementById('tab-source-drills');
    this.tabSourceCustom = document.getElementById('tab-source-custom');
    this.panelSourceWiki = document.getElementById('panel-source-wiki');
    this.panelSourceDrills = document.getElementById('panel-source-drills');
    this.panelSourceCustom = document.getElementById('panel-source-custom');

    // Custom Subtabs (Paste Text vs Code Snippets)
    this.subtabBtnText = document.getElementById('subtab-btn-text');
    this.subtabBtnCode = document.getElementById('subtab-btn-code');
    this.subpaneText = document.getElementById('subpane-text');
    this.subpaneCode = document.getElementById('subpane-code');

    // Custom Textarea Elements
    this.customTextInput = document.getElementById('custom-text-input');
    this.customWordsCount = document.getElementById('custom-words-count');
    this.customCharsCount = document.getElementById('custom-chars-count');
    this.startCustomTextBtn = document.getElementById('start-custom-text-btn');

    // Code Snippet Elements
    this.langPills = document.querySelectorAll('.lang-pill');
    this.snippetChipsContainer = document.getElementById('snippet-chips-container');
    this.codeLangIcon = document.getElementById('code-lang-icon');
    this.codeFileTitle = document.getElementById('code-file-title');
    this.codePreviewContent = document.getElementById('code-preview-content');
    this.startCodePracticeBtn = document.getElementById('start-code-practice-btn');

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

  /**
   * Randomly shuffles the 40+ topic pool and picks 7 fresh topics on every page load/refresh,
   * rendered alongside the 8th "Surprise Me (Random)" card with ZERO default pre-selection.
   */
  showGuestLockModal(featureName) {
    const modal = document.getElementById('guest-lock-modal');
    if (!modal) return;
    const descEl = document.getElementById('lock-modal-desc');
    if (descEl && featureName) {
      descEl.textContent = `${featureName} is reserved for registered members. Sign in or create a free account to track your progress and unlock customized drills.`;
    }
    modal.classList.remove('hidden');
  }

  async renderDynamicTopicCards() {
    if (!this.curatedTopicGrid) return;

    // Attempt to load live catalog from backend REST endpoint
    let pool = WikipediaService.curatedTopics || CURATED_TOPICS_POOL;
    try {
      const backendTopics = await WikipediaService.fetchCatalog();
      if (backendTopics && backendTopics.length > 0) {
        pool = backendTopics;
      }
    } catch (e) {}

    // Fisher-Yates shuffle on curated pool
    const poolCopy = [...pool];
    for (let i = poolCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
    }

    const selected7 = poolCopy.slice(0, 7);

    // Build elevated visual cards with category accent strip, geometric SVG pattern, and estimated time badge
    const cardsHtml = selected7.map((item, idx) => {
      const cat = item.category || 'Topic';
      const catSlug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `
      <div class="topic-card category-${catSlug}" data-topic="${item.title}" data-category="${cat}" title="${item.title}">
        <div class="topic-card-accent-strip"></div>
        <div class="topic-card-pattern" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="card-geo-dyn-${idx}" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="currentColor" opacity="0.08"/>
                <path d="M0 22L22 0M11 22L22 11M0 11L11 0" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.04"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#card-geo-dyn-${idx})" />
          </svg>
        </div>
        <div class="topic-card-header">
          <span class="topic-card-icon">${getVectorIcon(item.icon || 'book')}</span>
          <span class="topic-time-badge" title="Estimated reading and typing duration">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>~45s</span>
          </span>
        </div>
        <div class="topic-card-body">
          <span class="topic-card-title">${item.displayTitle || item.title}</span>
          <span class="topic-card-tag">${cat}</span>
        </div>
      </div>
    `;
    }).join('');

    const surpriseCardHtml = `
      <div class="topic-card topic-card-random category-random" data-topic="random" title="Surprise Me (Random Topic)">
        <div class="topic-card-accent-strip"></div>
        <div class="topic-card-pattern" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="card-geo-dyn-rand" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1.5" fill="currentColor" opacity="0.08"/>
                <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.08"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#card-geo-dyn-rand)" />
          </svg>
        </div>
        <div class="topic-card-header">
          <span class="topic-card-icon">${getVectorIcon('dice')}</span>
          <span class="topic-time-badge badge-surprise" title="Random topic selection">
            <span>✦ Surprise</span>
          </span>
        </div>
        <div class="topic-card-body">
          <span class="topic-card-title">Surprise Me</span>
          <span class="topic-card-tag">Random</span>
        </div>
      </div>
    `;

    this.curatedTopicGrid.innerHTML = cardsHtml + surpriseCardHtml;
    this.topicCards = this.curatedTopicGrid.querySelectorAll('.topic-card');
    this.bindTopicCardClicks();
  }

  bindTopicCardClicks() {
    if (!this.topicCards) return;
    this.topicCards.forEach(card => {
      card.addEventListener('click', () => {
        SoundService.playUITick();
        // Toggle active selection exclusively to this card
        this.topicCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTopic = card.dataset.topic || 'random';
        if (this.customTopicInput) {
          this.customTopicInput.value = '';
        }
        this.clearTopicPrompt();
        this.updateStartUrl();
      });
    });
  }

  promptTopicSelection() {
    if (this.topicPromptPill) {
      this.topicPromptPill.classList.remove('hidden');
    }
    if (this.curatedTopicGrid) {
      this.curatedTopicGrid.classList.remove('grid-shake');
      void this.curatedTopicGrid.offsetWidth; // Force reflow to re-trigger CSS keyframe
      this.curatedTopicGrid.classList.add('grid-shake');
      setTimeout(() => {
        this.curatedTopicGrid?.classList.remove('grid-shake');
      }, 500);
    }
  }

  clearTopicPrompt() {
    if (this.topicPromptPill) {
      this.topicPromptPill.classList.add('hidden');
    }
    if (this.curatedTopicGrid) {
      this.curatedTopicGrid.classList.remove('grid-shake');
    }
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
        SoundService.playUITick();
        this.durationPills.forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        this.selectedDuration = parseInt(pill.dataset.duration, 10) || 60;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('typer_time', this.selectedDuration);
        }
        this.updateStartUrl();
      });
    });

    // Custom Topic Search Input: Clears card highlight and updates selectedTopic
    if (this.customTopicInput) {
      this.customTopicInput.addEventListener('input', () => {
        const val = this.customTopicInput.value.trim();
        this.topicCards.forEach(c => c.classList.remove('selected'));
        this.selectedTopic = val ? val : null;
        this.clearTopicPrompt();
        this.updateStartUrl();
      });

      this.customTopicInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = this.customTopicInput.value.trim();
          if (val) {
            this.selectedTopic = val;
            window.location.href = this.buildPracticeUrl(val);
          } else {
            this.promptTopicSelection();
          }
        }
      });
    }

    // Start Practice Button Click (Validates user topic choice first)
    if (this.startPracticeBtn) {
      this.startPracticeBtn.addEventListener('click', (e) => {
        const customVal = this.customTopicInput?.value.trim();
        const effectiveTopic = customVal || this.selectedTopic;

        // If no topic selected, prompt user with shake and inline alert
        if (!effectiveTopic) {
          e.preventDefault();
          this.promptTopicSelection();
          return;
        }

        e.preventDefault();
        const url = this.buildPracticeUrl(effectiveTopic);
        window.location.href = url;
      });
    }

    // Content Source Tabs (Wikipedia Topics vs Specialized Drills vs Custom / Code)
    const switchSourceTab = (activeTab, activePanel) => {
      SoundService.playUITick();
      [this.tabSourceWiki, this.tabSourceDrills, this.tabSourceCustom].forEach(t => {
        if (t) {
          t.classList.toggle('active', t === activeTab);
          t.setAttribute('aria-selected', t === activeTab ? 'true' : 'false');
        }
      });
      [this.panelSourceWiki, this.panelSourceDrills, this.panelSourceCustom].forEach(p => {
        if (p) {
          p.classList.toggle('hidden', p !== activePanel);
        }
      });

      if (activeTab === this.tabSourceCustom) {
        this.topicCards.forEach(c => c.classList.remove('selected'));
        this.selectedTopic = null;
        this.clearTopicPrompt();
        this.updateStartUrl();
        this.renderCodeSnippetsUI();
      }
    };

    const isAuth = document.documentElement.getAttribute('data-authenticated') === 'true';

    if (this.tabSourceWiki) {
      this.tabSourceWiki.addEventListener('click', () => switchSourceTab(this.tabSourceWiki, this.panelSourceWiki));
    }
    if (this.tabSourceDrills) {
      this.tabSourceDrills.addEventListener('click', () => {
        if (!isAuth) {
          this.showGuestLockModal('Specialized Drills');
          return;
        }
        switchSourceTab(this.tabSourceDrills, this.panelSourceDrills);
      });
    }
    if (this.tabSourceCustom) {
      this.tabSourceCustom.addEventListener('click', () => {
        if (!isAuth) {
          this.showGuestLockModal('Custom Text & Code Arena');
          return;
        }
        switchSourceTab(this.tabSourceCustom, this.panelSourceCustom);
      });
    }

    if (this.practiceWeakKeysTopBtn) {
      this.practiceWeakKeysTopBtn.addEventListener('click', (e) => {
        if (!isAuth) {
          e.preventDefault();
          this.showGuestLockModal('Weak Keys Drill');
          return;
        }
      });
    }

    if (this.practiceWeakKeysBtn) {
      this.practiceWeakKeysBtn.addEventListener('click', (e) => {
        if (!isAuth) {
          e.preventDefault();
          this.showGuestLockModal('Weak Keys Drill');
          return;
        }
      });
    }

    // Specialized Drills Launch Triggers
    const drillActionBtns = document.querySelectorAll('.drill-launch-action');
    drillActionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isAuth) {
          this.showGuestLockModal('Specialized Drills');
          return;
        }
        const idx = parseInt(btn.dataset.drillIndex, 10);
        this.launchSpecializedDrill(idx);
      });
    });

    const recDrillBtns = document.querySelectorAll('.drill-launch-trigger');
    recDrillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isAuth) {
          this.showGuestLockModal('Specialized Drills');
          return;
        }
        const drillId = btn.dataset.drillId;
        this.launchSpecializedDrill(drillId);
      });
    });

    // Custom Subtabs (Paste Text vs Code Snippets)
    if (this.subtabBtnText && this.subtabBtnCode) {
      this.subtabBtnText.addEventListener('click', () => {
        SoundService.playUITick();
        this.subtabBtnText.classList.add('active');
        this.subtabBtnCode.classList.remove('active');
        this.subpaneText?.classList.remove('hidden');
        this.subpaneCode?.classList.add('hidden');
      });

      this.subtabBtnCode.addEventListener('click', () => {
        SoundService.playUITick();
        this.subtabBtnCode.classList.add('active');
        this.subtabBtnText.classList.remove('active');
        this.subpaneCode?.classList.remove('hidden');
        this.subpaneText?.classList.add('hidden');
        this.renderCodeSnippetsUI();
      });
    }

    // Paste Custom Text: Character & Word Counter
    if (this.customTextInput) {
      this.customTextInput.addEventListener('input', () => {
        const val = this.customTextInput.value || '';
        const charCount = val.length;
        const words = val.trim() ? val.trim().split(/\s+/).length : 0;

        if (this.customCharsCount) {
          this.customCharsCount.textContent = `${charCount} character${charCount === 1 ? '' : 's'}`;
        }
        if (this.customWordsCount) {
          this.customWordsCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
        }
        if (this.startCustomTextBtn) {
          this.startCustomTextBtn.disabled = (charCount < 10);
        }
      });
    }

    // Start Custom Text Practice Button
    if (this.startCustomTextBtn) {
      this.startCustomTextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = this.customTextInput?.value.trim();
        if (!text || text.length < 10) return;

        try {
          sessionStorage.setItem('typer_custom_text', text);
          sessionStorage.setItem('typer_custom_title', 'Custom Study Notes');
          sessionStorage.setItem('typer_custom_desc', 'User-provided custom text practice.');
          sessionStorage.setItem('typer_mode', 'custom');
        } catch (err) {}

        window.location.href = '/practice/?mode=custom';
      });
    }

    // Code Snippets: Language Pills
    if (this.langPills && this.langPills.length > 0) {
      this.langPills.forEach(pill => {
        pill.addEventListener('click', () => {
          SoundService.playUITick();
          this.langPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeCodeLang = pill.dataset.lang || 'python';
          this.activeSnippetIdx = 0;
          this.renderCodeSnippetsUI();
        });
      });
    }

    // Start Code Snippet Practice Button
    if (this.startCodePracticeBtn) {
      this.startCodePracticeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const snippets = CodeSnippets[this.activeCodeLang] || CodeSnippets.python;
        const snippet = snippets[this.activeSnippetIdx] || snippets[0];
        if (!snippet) return;

        try {
          sessionStorage.setItem('typer_custom_text', snippet.code);
          sessionStorage.setItem('typer_custom_title', `${snippet.title} (${snippet.filename})`);
          sessionStorage.setItem('typer_custom_desc', `${snippet.filename} — Clean developer code snippet for typing practice.`);
          sessionStorage.setItem('typer_mode', 'code');
        } catch (err) {}

        window.location.href = `/practice/?mode=code&lang=${encodeURIComponent(this.activeCodeLang)}`;
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
          AnalyticsService.clearAll();
          this.sessionLogs = [];
          this.renderAnalytics();
          this.updateQuickWeakChips();
        }
      });
    }
  }

  launchSpecializedDrill(target) {
    let drill = null;
    if (typeof target === 'number') {
      drill = SPECIALIZED_DRILLS[target];
    } else {
      drill = SPECIALIZED_DRILLS.find(d => d.id === target) || SPECIALIZED_DRILLS[0];
    }
    if (!drill) return;
    try {
      sessionStorage.setItem('typer_custom_text', drill.text);
      sessionStorage.setItem('typer_custom_title', drill.title);
      sessionStorage.setItem('typer_custom_desc', drill.description);
      sessionStorage.setItem('typer_mode', 'drill');
    } catch (err) {}
    window.location.href = '/practice/?mode=drill';
  }

  renderCodeSnippetsUI() {
    const snippets = CodeSnippets[this.activeCodeLang] || CodeSnippets.python;
    if (this.snippetChipsContainer) {
      this.snippetChipsContainer.innerHTML = snippets.map((s, idx) => `
        <button type="button" class="snippet-chip ${idx === this.activeSnippetIdx ? 'active' : ''}" data-idx="${idx}">
          ${s.title}
        </button>
      `).join('');

      this.snippetChipsContainer.querySelectorAll('.snippet-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          SoundService.playUITick();
          this.activeSnippetIdx = parseInt(btn.dataset.idx, 10) || 0;
          this.renderCodeSnippetsUI();
        });
      });
    }

    const currentSnippet = snippets[this.activeSnippetIdx] || snippets[0];
    if (currentSnippet) {
      if (this.codeFileTitle) this.codeFileTitle.textContent = currentSnippet.filename;
      if (this.codeLangIcon) this.codeLangIcon.innerHTML = getVectorIcon(currentSnippet.icon || currentSnippet.lang || 'code');
      if (this.codePreviewContent) this.codePreviewContent.textContent = currentSnippet.code;
    }
  }

  selectMode(mode) {
    SoundService.playUITick();
    this.selectedMode = mode;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('typer_mode', mode);
    }
    if (mode === 'timed') {
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

  buildPracticeUrl(topicOverride = null) {
    const params = new URLSearchParams();
    const topic = topicOverride || this.selectedTopic;
    if (topic) {
      params.set('topic', topic);
    }
    params.set('mode', this.selectedMode);
    if (this.selectedMode === 'timed') {
      params.set('time', this.selectedDuration);
      params.set('duration', this.selectedDuration);
    }
    const base = this.startPracticeBtn?.getAttribute('href')?.split('?')[0] || '/practice/';
    return topic ? `${base}?${params.toString()}` : base;
  }

  updateStartUrl() {
    if (this.startPracticeBtn) {
      this.startPracticeBtn.href = this.buildPracticeUrl();
    }
  }

  renderAnalytics(liveData = null) {
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

  formatJournalTimestamp(ts) {
    if (!ts) return 'Recent';
    let dateObj = null;
    if (typeof ts === 'number') {
      dateObj = new Date(ts);
    } else if (typeof ts === 'string') {
      if (/^\d{10,}$/.test(ts.trim())) {
        dateObj = new Date(parseInt(ts.trim(), 10));
      } else {
        dateObj = new Date(ts);
      }
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
      return String(ts);
    }

    const now = new Date();
    const isToday = now.toDateString() === dateObj.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = yesterday.toDateString() === dateObj.toDateString();

    const timeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) {
      return `Today, ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    } else {
      const monthStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${monthStr}, ${timeStr}`;
    }
  }

  renderSessionLogs() {
    if (!this.sessionLogsList) return;
    if (this.sessionLogCount) {
      this.sessionLogCount.textContent = `${this.sessionLogs.length} session${this.sessionLogs.length === 1 ? '' : 's'} recorded`;
    }
    if (this.sessionLogs.length === 0) {
      this.sessionLogsList.innerHTML = `
        <div class="empty-log-state">
          <span>${getVectorIcon('book')}</span>
          <p>No practice logs yet. Complete a paragraph or sprint to log your results!</p>
        </div>
      `;
      return;
    }

    this.sessionLogsList.innerHTML = '';
    const recentLogs = [...this.sessionLogs].reverse().slice(0, 10);
    const escapeText = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    recentLogs.forEach(log => {
      const row = document.createElement('div');
      row.className = 'session-log-card';

      const modeLabels = {
        timed: 'Timed Sprint',
        code: 'Code Snippet',
        custom: 'Custom Text',
        drill: 'Specialized Drill',
        paragraph: 'Paragraph'
      };
      const modeKey = log.mode || 'paragraph';
      const modeBadge = modeLabels[modeKey] || 'Paragraph';
      const formattedDate = this.formatJournalTimestamp(log.timestamp || log.date);
      const acc = Math.round(log.accuracy !== undefined ? log.accuracy : 100);
      const errCount = log.errors !== undefined ? log.errors : (log.errors_count || 0);
      const wpmVal = Math.round(log.wpm || 0);
      const topicTitle = log.topic || log.topic_title || 'Practice Session';

      row.innerHTML = `
        <div class="log-col-left">
          <div class="log-title-row">
            <span class="log-topic-title" title="${escapeText(topicTitle)}">${escapeText(topicTitle)}</span>
            <span class="log-mode-tag mode-${modeKey}">${modeBadge}</span>
          </div>
          <span class="log-timestamp"><span class="log-clock-icon" aria-hidden="true">${getVectorIcon('clock')}</span> ${formattedDate}</span>
        </div>
        <div class="log-col-center">
          <div class="log-acc-container">
            <div class="log-acc-text-row">
              <span class="log-acc-title">Accuracy</span>
              <span class="log-acc-percent color-emerald">${acc}%</span>
            </div>
            <div class="log-acc-track" aria-hidden="true">
              <div class="log-acc-fill" style="width: ${acc}%;"></div>
            </div>
          </div>
          <span class="log-error-pill ${errCount === 0 ? 'zero-err' : 'has-err'}">
            ${errCount} ${errCount === 1 ? 'error' : 'errors'}
          </span>
        </div>
        <div class="log-col-right">
          <div class="log-wpm-pill">
            <span class="log-wpm-number">${wpmVal}</span>
            <span class="log-wpm-unit">WPM</span>
          </div>
          <button type="button" class="btn-log-retry" title="Retry this practice topic">
            <span>Retry ↻</span>
          </button>
        </div>
      `;

      const retryBtn = row.querySelector('.btn-log-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.SoundService) window.SoundService.playUITick();
          if (modeKey === 'code') {
            window.location.href = '/code/';
          } else {
            window.location.href = `/practice/?topic=${encodeURIComponent(topicTitle)}&mode=${encodeURIComponent(modeKey)}`;
          }
        });
      }

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
      } else if (this.mode === 'custom') {
        this.arenaModePill.textContent = 'Custom Text';
      } else if (this.mode === 'code') {
        const lang = (this.urlParams.get('lang') || 'Code').toUpperCase();
        this.arenaModePill.textContent = `${lang} Snippet`;
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
    this.statPbDelta = document.getElementById('stat-pb-delta');
    this.zenToggleBtn = document.getElementById('zen-mode-toggle');
    this.zenIndicatorLabel = document.getElementById('zen-indicator-label');
    this.isZenMode = (localStorage.getItem('topictyper_zen_mode') === 'true');
    if (this.zenToggleBtn) {
      this.zenToggleBtn.classList.toggle('active', this.isZenMode);
      if (this.zenIndicatorLabel) this.zenIndicatorLabel.textContent = this.isZenMode ? 'ON' : 'OFF';
    }

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

    // Live Rhythm Waveform & Mechanical Keycap Visualizer
    this.waveformCanvas = document.getElementById('rhythm-waveform-canvas');
    this.waveformComboPill = document.getElementById('waveform-combo-pill');
    this.waveformComboLabel = document.getElementById('waveform-combo-label');
    if (this.waveformCanvas) {
      this.waveformVisualizer = new RhythmWaveformVisualizer(
        this.waveformCanvas,
        this.waveformComboPill,
        this.waveformComboLabel
      );
    }

    this.keycapSection = document.getElementById('keycap-visualizer-section');
    this.keycapBoard = document.getElementById('keycap-board');
    this.keycapNextChar = document.getElementById('keycap-next-char');
    this.keycapToggleBtn = document.getElementById('keycap-toggle-btn');
    this.keycapToggleText = document.getElementById('keycap-toggle-text');
    if (this.keycapSection && this.keycapBoard) {
      this.keycapVisualizer = new KeycapVisualizer({
        container: this.keycapSection,
        boardEl: this.keycapBoard,
        nextCharEl: this.keycapNextChar,
        toggleBtn: this.keycapToggleBtn,
        toggleText: this.keycapToggleText,
        storageKey: 'topictyper_keycap_viz'
      });
    }
  }

  handleTypingActivity(isTyping) {
    if (this.typingActivityTimeout) {
      clearTimeout(this.typingActivityTimeout);
      this.typingActivityTimeout = null;
    }

    if (isTyping) {
      if (this.isZenMode) {
        document.body.classList.add('zen-typing-active');
        if (typeof SoundService !== 'undefined' && SoundService.focusPadEnabled) {
          SoundService.startFocusPad?.();
        }
      }
      this.waveformVisualizer?.setTypingState(true, this.engine?.currentWpm || 0);

      // Auto-reset Zen dimming and idle state on pause (after 2.5s of inactivity)
      this.typingActivityTimeout = setTimeout(() => {
        if (this.isZenMode) {
          document.body.classList.remove('zen-typing-active');
        }
        this.waveformVisualizer?.setTypingState(false, 0);
      }, 2500);
    } else {
      if (this.isZenMode) {
        document.body.classList.remove('zen-typing-active');
      }
      this.waveformVisualizer?.setTypingState(false, 0);
    }
  }

  initTypingEngine() {
    this.engine = new TypingEngine({
      wordsContainer: this.wordsContainer,
      caret: this.caret,
      hiddenInput: this.hiddenInput,
      mode: this.mode === 'timed' ? 'timed' : 'paragraph',
      timeLimit: this.timeLimit,
      onMetricsUpdate: (metrics) => {
        this.renderHUD(metrics);
        this.waveformVisualizer?.setSpeed(metrics.wpm, metrics.combo);
      },
      onComplete: (finalMetrics) => {
        this.handleTypingActivity(false);
        this.showResultsModal(finalMetrics);
      },
      onChunkComplete: () => this.handleTimedChunkAdvance(),
      onPauseStateChange: (isPaused) => {
        if (this.idleBadge) {
          this.idleBadge.classList.toggle('hidden', !isPaused);
        }
        if (isPaused) {
          this.handleTypingActivity(false);
        }
      },
      onTypingStateChange: (isTyping) => this.handleTypingActivity(isTyping),
      onKeystroke: (info) => {
        this.keycapVisualizer?.flashKey(info.char, info.isCorrect);
        this.waveformVisualizer?.recordKeystroke(info.isCorrect, this.engine?.currentWpm || 0, info.combo);
      },
      onTargetCharChange: (targetChar) => {
        this.keycapVisualizer?.updateTargetKey(targetChar);
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

    // Zen Mode Toggle
    if (this.zenToggleBtn) {
      this.zenToggleBtn.addEventListener('click', () => {
        SoundService.playUITick();
        this.isZenMode = !this.isZenMode;
        localStorage.setItem('topictyper_zen_mode', this.isZenMode ? 'true' : 'false');
        this.zenToggleBtn.classList.toggle('active', this.isZenMode);
        if (this.zenIndicatorLabel) {
          this.zenIndicatorLabel.textContent = this.isZenMode ? 'ON' : 'OFF';
        }
        if (!this.isZenMode) {
          document.body.classList.remove('zen-typing-active');
          SoundService.stopFocusPad?.();
        }
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
    } else if (this.mode === 'custom') {
      this.loadCustomTextSession();
    } else if (this.mode === 'code') {
      this.loadCodeSnippetSession();
    } else if (this.requestedTopic && this.requestedTopic !== 'random') {
      this.loadTopic(this.requestedTopic);
    } else {
      this.loadRandomTopic();
    }
  }

  loadCustomTextSession() {
    const rawText = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_text') : null;
    const customTitle = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_title') : 'Custom Study Notes';
    const customDesc = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_desc') : 'User-provided custom text practice.';

    const text = (rawText && rawText.trim().length >= 5) 
      ? rawText.trim() 
      : 'Knowledge is power. Learning to type with precision and velocity unlocks greater cognitive flow and unlocks the universe of possibilities.';

    this.currentTopicData = {
      title: customTitle,
      description: customDesc,
      url: '#'
    };

    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    this.chunks = (paragraphs.length > 0) ? paragraphs : [text];
    this.currentChunkIndex = 0;

    this.updateArticleMetaUI();
    if (this.wikiExternalLink) {
      this.wikiExternalLink.style.display = 'none';
    }
    this.loadActiveChunk();
    this.hideStatus();
    this.focusTypingArea();
  }

  loadCodeSnippetSession() {
    const rawCode = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_text') : null;
    const codeTitle = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_title') : 'Python: Fibonacci Generator';
    const lang = (this.urlParams.get('lang') || 'Python').toUpperCase();

    const defaultCode = `def fibonacci(limit):\n  a, b = 0, 1\n  while a < limit:\n    yield a\n    a, b = b, a + b\n\nsquares = [x ** 2 for x in fibonacci(30)]\nprint("Computed squares:", squares)`;
    const code = (rawCode && rawCode.trim().length >= 5) ? rawCode : defaultCode;

    this.currentTopicData = {
      title: codeTitle,
      description: `${lang} Developer Code Snippet — precision syntax & indentation practice.`,
      url: '#'
    };

    this.chunks = [code];
    this.currentChunkIndex = 0;

    this.updateArticleMetaUI();
    if (this.wikiExternalLink) {
      this.wikiExternalLink.style.display = 'none';
    }
    this.loadActiveChunk();
    this.hideStatus();
    this.focusTypingArea();
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
      console.warn('Could not load random topic. Loading featured article...', err);
      const pool = WikipediaService.curatedTopics || [];
      const fallbackItem = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : WikipediaService.fallbacks['computer science'];
      try {
        const fbData = await WikipediaService.fetchTopicSummary(fallbackItem.title || 'Computer science');
        this.processLoadedTopic(fbData);
      } catch (e2) {
        this.processLoadedTopic(WikipediaService.fallbacks['computer science']);
      }
    }
  }

  async loadTopic(topicQuery) {
    this.showStatus(`Loading "${topicQuery}" from Wikipedia...`, 'loading');
    try {
      const data = await WikipediaService.fetchTopicSummary(topicQuery);
      this.processLoadedTopic(data);
    } catch (err) {
      console.warn('loadTopic failed, falling back to reliable article:', err);
      this.showStatus(`"${topicQuery}" summary not available offline. Loaded fallback topic.`, 'info');
      const fallbackItem = WikipediaService.fallbacks['computer science'] || {
        title: 'Computer science',
        description: 'Study of computation, information, and automation',
        extract: 'Computer science is the study of computation, information, and automation. Computer science spans theoretical disciplines such as algorithms, theory of computation, and information theory to applied disciplines including the design and implementation of hardware and software.'
      };
      this.processLoadedTopic(fallbackItem);
    }
  }

  loadWeakKeysDrill() {
    const drillParam = this.urlParams.get('drill') || this.urlParams.get('id');
    let customText = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_text') : null;
    let customTitle = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_title') : null;
    let customDesc = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('typer_custom_desc') : null;

    if (drillParam && (!customText || customText.length < 5)) {
      const matched = SPECIALIZED_DRILLS.find(d => d.id === drillParam);
      if (matched) {
        customText = matched.text;
        customTitle = matched.title;
        customDesc = matched.description;
      }
    }

    if (customText && customText.trim().length >= 5) {
      this.currentTopicData = {
        title: customTitle || 'Specialized Drill',
        description: customDesc || 'Targeted drill practice.',
        url: '#'
      };
      this.chunks = [customText.trim()];
    } else {
      const drill = AnalyticsService.generateWeakDrill(40);
      const focusKeysStr = (drill.weakKeys && drill.weakKeys.length > 0)
        ? drill.weakKeys.map(k => k.toUpperCase()).join(', ')
        : 'E, R, T';

      this.currentTopicData = {
        title: `Weak Keys Drill [${focusKeysStr}]`,
        description: `Targeted 40-word accuracy drill designed to strengthen finger dexterity for keys: ${focusKeysStr}.`,
        url: '#'
      };

      this.chunks = [drill.wordsText || 'the quick brown fox jumps over the lazy dog'];
    }

    this.currentChunkIndex = 0;
    try {
      this.updateArticleMetaUI();
    } catch (uiErr) {
      console.warn('updateArticleMetaUI error in loadWeakKeysDrill:', uiErr);
    }
    if (this.wikiExternalLink) {
      this.wikiExternalLink.style.display = 'none';
    }
    this.loadActiveChunk();
    this.hideStatus();
    this.focusTypingArea();
  }

  processLoadedTopic(data) {
    if (!data) data = {};
    const fallbackText = 'Knowledge is power. Learning to type with precision and velocity unlocks greater cognitive flow and unlocks the universe of possibilities.';
    const rawExtract = (data.extract && data.extract.trim().length > 0)
      ? data.extract.trim()
      : (WikipediaService.fallbacks['computer science']?.extract || fallbackText);

    this.currentTopicData = {
      title: data.title || 'Featured Article',
      description: data.description || 'Wikipedia Extract',
      url: data.url || '#'
    };

    let chunks = TextSanitizer.chunkText(rawExtract, 50, 70);
    if (!chunks || chunks.length === 0) {
      chunks = [rawExtract];
    }

    this.chunks = chunks;
    this.currentChunkIndex = 0;
    try {
      this.updateArticleMetaUI();
    } catch (uiErr) {
      console.warn('updateArticleMetaUI error in processLoadedTopic:', uiErr);
    }
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
    if (!this.chunks || this.chunks.length === 0) {
      this.chunks = ['Focus on precision and rhythm to master the keyboard.'];
    }

    if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.chunks.length) {
      this.currentChunkIndex = 0;
    }

    const chunkText = this.chunks[this.currentChunkIndex];

    // Load chunk into typing engine FIRST so arena is never blank
    try {
      this.engine?.loadChunk(chunkText);
    } catch (engineErr) {
      console.error('engine.loadChunk failed:', engineErr);
    }

    // Optional UI updates wrapped safely
    try {
      if (this.paragraphCounterPill) {
        this.paragraphCounterPill.textContent = `Paragraph ${this.currentChunkIndex + 1} of ${this.chunks.length}`;
      }
      if (this.nextChunkBtn) {
        const span = this.nextChunkBtn.querySelector('span');
        const isLast = (this.currentChunkIndex === this.chunks.length - 1);
        const text = isLast ? 'Practice Again [Tab]' : 'Next Paragraph [Tab]';
        if (span) {
          span.textContent = text;
        } else {
          this.nextChunkBtn.textContent = text;
        }
      }
    } catch (uiErr) {
      console.warn('Optional UI helper failed in loadActiveChunk:', uiErr);
    }

    // Update target key on Keycap Visualizer
    try {
      this.keycapVisualizer?.updateTargetKey(this.engine?.getTargetChar?.());
    } catch (e) {}

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

    if (this.statPbDelta) {
      let pbWpm = 0;
      try {
        const storedPb = localStorage.getItem('topictyper_pb_wpm');
        if (storedPb) pbWpm = parseFloat(storedPb);
      } catch (e) {}

      if (pbWpm > 0 && metrics.wpm > 0) {
        const diff = metrics.wpm - Math.round(pbWpm);
        if (diff > 0) {
          this.statPbDelta.textContent = `+${diff} WPM`;
          this.statPbDelta.className = 'hud-pill-val pace-ahead';
        } else if (diff < 0) {
          this.statPbDelta.textContent = `${diff} WPM`;
          this.statPbDelta.className = 'hud-pill-val pace-behind';
        } else {
          this.statPbDelta.textContent = `+0 WPM`;
          this.statPbDelta.className = 'hud-pill-val pace-even';
        }
      } else {
        this.statPbDelta.textContent = '--';
        this.statPbDelta.className = 'hud-pill-val pace-even';
      }
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
    let rankIconKey = 'sparkle';
    let rankCls = 'rank-rhythm';

    const activeTheme = document.documentElement.getAttribute('data-theme') || 'midnight';

    if (activeTheme === 'funny') {
      if (finalMetrics.wpm >= 75 && finalMetrics.accuracy >= 95) {
        rankLabel = 'COMBO MASTER'; rankIconKey = 'trophy'; rankCls = 'rank-hyperspeed';
      } else if (finalMetrics.wpm >= 55) {
        rankLabel = 'TURBO FLOW'; rankIconKey = 'bolt'; rankCls = 'rank-swift';
      } else if (finalMetrics.accuracy >= 98) {
        rankLabel = 'BULLSEYE PRECISION'; rankIconKey = 'target'; rankCls = 'rank-precision';
      } else {
        rankLabel = 'GROOVY RHYTHM'; rankIconKey = 'sparkle'; rankCls = 'rank-momentum';
      }
    } else if (activeTheme === 'hacking') {
      if (finalMetrics.wpm >= 75 && finalMetrics.accuracy >= 95) {
        rankLabel = 'ROOT ACCESS GRANTED'; rankIconKey = 'bolt'; rankCls = 'rank-hyperspeed';
      } else if (finalMetrics.wpm >= 55) {
        rankLabel = 'CIPHER STREAM ACTIVE'; rankIconKey = 'terminal'; rankCls = 'rank-swift';
      } else if (finalMetrics.accuracy >= 98) {
        rankLabel = 'PARITY VERIFIED 100%'; rankIconKey = 'shield'; rankCls = 'rank-precision';
      } else {
        rankLabel = 'BUFFER STABLE'; rankIconKey = 'gear'; rankCls = 'rank-momentum';
      }
    } else {
      if (finalMetrics.wpm >= 80 && finalMetrics.accuracy >= 95) {
        rankLabel = 'Hyperspeed Master'; rankIconKey = 'trophy'; rankCls = 'rank-hyperspeed';
      } else if (finalMetrics.wpm >= 60 && finalMetrics.accuracy >= 94) {
        rankLabel = 'Swift Flow'; rankIconKey = 'bolt'; rankCls = 'rank-swift';
      } else if (finalMetrics.accuracy >= 98) {
        rankLabel = 'Laser Precision'; rankIconKey = 'target'; rankCls = 'rank-precision';
      } else if (finalMetrics.wpm >= 45) {
        rankLabel = 'Steady Momentum'; rankIconKey = 'sparkle'; rankCls = 'rank-momentum';
      }
    }

    if (rankBadge) {
      rankBadge.className = `modal-rank-badge ${rankCls}`;
      if (rankIcon) rankIcon.innerHTML = getVectorIcon(rankIconKey);
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
        missedChipsContainer.innerHTML = `<span class="clean-run-badge">${getVectorIcon('sparkle')} 100% Clean Run — Zero Misses!</span>`;
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

    // Milestone Sound Effect: Ascending harmonic chime or 5-note sparkle fanfare if PB
    let isNewPB = false;
    try {
      const prevPbStr = localStorage.getItem('topictyper_pb_wpm');
      const prevPb = prevPbStr ? parseFloat(prevPbStr) : 0;
      if (finalMetrics.wpm > prevPb && prevPb > 0) {
        isNewPB = true;
      }
      if (finalMetrics.wpm > prevPb) {
        localStorage.setItem('topictyper_pb_wpm', String(Math.round(finalMetrics.wpm)));
      }
    } catch (e) {}

    SoundService.playCompletion(isNewPB);

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
      title: `Weak Keys Drill [${focusKeysStr}]`,
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
// 7.5 DEDICATED CODE ARENA CONTROLLER (/code/)
// ============================================================================
class CodeArenaController {
  constructor() {
    this.snippetsData = window.TOPIC_TYPER_CODE_DATA || CodeSnippets;
    this.urlParams = new URLSearchParams(window.location.search);
    this.activeLang = this.urlParams.get('lang') || window.TOPIC_TYPER_INITIAL_LANG || 'python';
    if (!this.snippetsData[this.activeLang]) {
      this.activeLang = 'python';
    }
    this.activeDifficulty = this.urlParams.get('diff') || 'All';
    this.requestedId = this.urlParams.get('id');

    this.activeSnippetIndex = 0;
    this.currentSnippet = null;
    this.isModalOpen = false;

    // DOM Elements
    this.langTabs = document.querySelectorAll('.code-lang-tab');
    this.diffPills = document.querySelectorAll('.diff-filter-pill');
    this.chipsBar = document.getElementById('snippet-chips-bar');

    this.arenaSnippetPill = document.getElementById('arena-snippet-pill');
    this.arenaDiffPill = document.getElementById('arena-diff-pill');
    this.arenaTitle = document.getElementById('arena-title');
    this.arenaDesc = document.getElementById('arena-desc');

    this.ideActiveIcon = document.getElementById('ide-active-icon');
    this.ideActiveFilename = document.getElementById('ide-active-filename');
    this.ideActiveLangBadge = document.getElementById('ide-active-lang-badge');
    this.ideSnippetDesc = document.getElementById('ide-snippet-description');

    this.ideWorkspace = document.getElementById('ide-workspace');
    this.ideGutter = document.getElementById('ide-gutter');
    this.codeWordsContainer = document.getElementById('code-words-container');
    this.codeCaret = document.getElementById('code-caret');
    this.codeHiddenInput = document.getElementById('code-hidden-input');
    this.focusOverlay = document.getElementById('code-focus-overlay');

    this.codeStatWpm = document.getElementById('code-stat-wpm');
    this.codeStatAccuracy = document.getElementById('code-stat-accuracy');
    this.codeStatTime = document.getElementById('code-stat-time');
    this.codeStatProgress = document.getElementById('code-stat-progress');
    this.codeStatErrors = document.getElementById('code-stat-errors');

    this.codeRestartBtn = document.getElementById('code-restart-btn');
    this.codeNextBtn = document.getElementById('code-next-btn');

    // Modal elements
    this.codeResultsModal = document.getElementById('code-results-modal');
    this.codeModalBackdrop = document.getElementById('code-modal-backdrop');
    this.codeModalRankText = document.getElementById('code-modal-rank-text');
    this.codeModalMetaTitle = document.getElementById('code-modal-meta-title');
    this.codeModalMetaTime = document.getElementById('code-modal-meta-time');
    this.codeGaugeWpmBar = document.getElementById('code-gauge-wpm-bar');
    this.codeGaugeAccBar = document.getElementById('code-gauge-acc-bar');
    this.codeResWpm = document.getElementById('code-res-wpm');
    this.codeResAcc = document.getElementById('code-res-acc');
    this.codeResRawWpm = document.getElementById('code-res-raw-wpm');
    this.codeResErrors = document.getElementById('code-res-errors');
    this.codeResChars = document.getElementById('code-res-chars');
    this.codeModalRetryBtn = document.getElementById('code-modal-retry-btn');
    this.codeModalNextBtn = document.getElementById('code-modal-next-btn');

    // Live Rhythm Waveform & Mechanical Keycap Visualizer
    this.waveformCanvas = document.getElementById('code-rhythm-waveform-canvas');
    this.waveformComboPill = document.getElementById('code-waveform-combo-pill');
    this.waveformComboLabel = document.getElementById('code-waveform-combo-label');
    if (this.waveformCanvas) {
      this.waveformVisualizer = new RhythmWaveformVisualizer(
        this.waveformCanvas,
        this.waveformComboPill,
        this.waveformComboLabel
      );
    }

    this.keycapSection = document.getElementById('code-keycap-visualizer-section');
    this.keycapBoard = document.getElementById('code-keycap-board');
    this.keycapNextChar = document.getElementById('code-keycap-next-char');
    this.keycapToggleBtn = document.getElementById('code-keycap-toggle-btn');
    this.keycapToggleText = document.getElementById('code-keycap-toggle-text');
    if (this.keycapSection && this.keycapBoard) {
      this.keycapVisualizer = new KeycapVisualizer({
        container: this.keycapSection,
        boardEl: this.keycapBoard,
        nextCharEl: this.keycapNextChar,
        toggleBtn: this.keycapToggleBtn,
        toggleText: this.keycapToggleText,
        storageKey: 'topictyper_code_keycap_viz'
      });
    }

    this.initEngine();
    this.bindEvents();
    this.renderLanguageTabs();
    this.renderDifficultyPills();
    this.renderSnippetChips();
  }

  handleTypingActivity(isTyping) {
    if (this.typingActivityTimeout) {
      clearTimeout(this.typingActivityTimeout);
      this.typingActivityTimeout = null;
    }
    if (isTyping) {
      this.waveformVisualizer?.setTypingState(true, this.engine?.currentWpm || 0);
      this.typingActivityTimeout = setTimeout(() => {
        this.waveformVisualizer?.setTypingState(false, 0);
      }, 2500);
    } else {
      this.waveformVisualizer?.setTypingState(false, 0);
    }
  }

  initEngine() {
    this.engine = new TypingEngine({
      wordsContainer: this.codeWordsContainer,
      caret: this.codeCaret,
      hiddenInput: this.codeHiddenInput,
      mode: 'code',
      isCodeMode: true,
      smartIndent: true,
      onMetricsUpdate: (metrics) => {
        this.renderHUD(metrics);
        this.waveformVisualizer?.setSpeed(metrics.wpm, metrics.combo);
      },
      onComplete: (metrics) => {
        this.handleTypingActivity(false);
        this.showResultsModal(metrics);
      },
      onLineChange: (lineNum) => this.updateActiveGutterLine(lineNum),
      onTypingStateChange: (isTyping) => this.handleTypingActivity(isTyping),
      onKeystroke: (info) => {
        this.keycapVisualizer?.flashKey(info.char, info.isCorrect);
        this.waveformVisualizer?.recordKeystroke(info.isCorrect, this.engine?.currentWpm || 0, info.combo);
      },
      onTargetCharChange: (targetChar) => {
        this.keycapVisualizer?.updateTargetKey(targetChar);
      }
    });
  }

  getFilteredSnippets() {
    const list = this.snippetsData[this.activeLang] || this.snippetsData.python || [];
    if (this.activeDifficulty && this.activeDifficulty !== 'All') {
      return list.filter(s => s.difficulty.toLowerCase() === this.activeDifficulty.toLowerCase());
    }
    return list;
  }

  renderLanguageTabs() {
    if (!this.langTabs) return;
    this.langTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.lang === this.activeLang);
      tab.setAttribute('aria-selected', tab.dataset.lang === this.activeLang ? 'true' : 'false');
    });
  }

  renderDifficultyPills() {
    if (!this.diffPills) return;
    this.diffPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.difficulty === this.activeDifficulty);
    });
  }

  renderSnippetChips() {
    if (!this.chipsBar) return;
    const snippets = this.getFilteredSnippets();
    if (snippets.length === 0) {
      this.chipsBar.innerHTML = `<span class="text-muted" style="font-size:0.8rem;">No snippets for this filter.</span>`;
      return;
    }

    if (this.requestedId) {
      const foundIdx = snippets.findIndex(s => s.id === this.requestedId);
      if (foundIdx !== -1) {
        this.activeSnippetIndex = foundIdx;
      }
      this.requestedId = null;
    }

    if (this.activeSnippetIndex >= snippets.length) {
      this.activeSnippetIndex = 0;
    }

    this.chipsBar.innerHTML = snippets.map((s, idx) => `
      <button type="button" class="snippet-chip-btn ${idx === this.activeSnippetIndex ? 'active' : ''}" data-idx="${idx}">
        ${s.title}
      </button>
    `).join('');

    this.chipsBar.querySelectorAll('.snippet-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundService.playUITick();
        this.activeSnippetIndex = parseInt(btn.dataset.idx, 10) || 0;
        this.chipsBar.querySelectorAll('.snippet-chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadCurrentSnippet();
      });
    });

    this.loadCurrentSnippet();
  }

  loadCurrentSnippet() {
    const snippets = this.getFilteredSnippets();
    if (snippets.length === 0) return;
    const snippet = snippets[this.activeSnippetIndex] || snippets[0];
    this.currentSnippet = snippet;

    try {
      if (this.arenaSnippetPill) this.arenaSnippetPill.textContent = `Snippet ${this.activeSnippetIndex + 1} of ${snippets.length}`;
      if (this.arenaDiffPill) this.arenaDiffPill.textContent = snippet.difficulty;
      if (this.arenaTitle) this.arenaTitle.textContent = snippet.title;
      if (this.arenaDesc) this.arenaDesc.textContent = snippet.description;

      if (this.ideActiveIcon) this.ideActiveIcon.innerHTML = getVectorIcon(snippet.icon || snippet.lang || 'code');
      if (this.ideActiveFilename) this.ideActiveFilename.textContent = snippet.filename;
      if (this.ideActiveLangBadge) this.ideActiveLangBadge.textContent = (snippet.lang || this.activeLang).toUpperCase();
      if (this.ideSnippetDesc) this.ideSnippetDesc.textContent = snippet.description;

      const lines = snippet.code.split('\n');
      this.renderGutterLines(lines.length);
    } catch (uiErr) {
      console.warn('Optional UI helper failed in loadCurrentSnippet:', uiErr);
    }

    try {
      this.engine?.loadChunk(snippet.code);
    } catch (e) {
      console.error('engine.loadChunk failed in CodeArena:', e);
    }

    try {
      this.keycapVisualizer?.updateTargetKey(this.engine?.getTargetChar?.());
    } catch (e) {}

    this.updateActiveGutterLine(1);
    this.resetHUD();
    this.focusEditor();
  }

  renderGutterLines(lineCount) {
    if (!this.ideGutter) return;
    let html = '';
    for (let i = 1; i <= lineCount; i++) {
      html += `<div class="gutter-line-num ${i === 1 ? 'active-line' : ''}" data-line="${i}">${i}</div>`;
    }
    this.ideGutter.innerHTML = html;
  }

  updateActiveGutterLine(lineNum) {
    if (!this.ideGutter) return;
    const nums = this.ideGutter.querySelectorAll('.gutter-line-num');
    nums.forEach(n => {
      n.classList.toggle('active-line', parseInt(n.dataset.line, 10) === lineNum);
    });
  }

  resetHUD() {
    if (this.codeStatWpm) this.codeStatWpm.textContent = '0';
    if (this.codeStatAccuracy) this.codeStatAccuracy.textContent = '100%';
    if (this.codeStatTime) this.codeStatTime.textContent = '00:00';
    if (this.codeStatProgress) this.codeStatProgress.textContent = '0%';
    if (this.codeStatErrors) this.codeStatErrors.textContent = '0';
  }

  renderHUD(metrics) {
    if (this.codeStatWpm) this.codeStatWpm.textContent = metrics.wpm;
    if (this.codeStatAccuracy) this.codeStatAccuracy.textContent = `${metrics.accuracy}%`;
    if (this.codeStatTime) this.codeStatTime.textContent = this.formatTime(metrics.elapsedSeconds);
    if (this.codeStatProgress) this.codeStatProgress.textContent = `${metrics.progressPercent}%`;
    if (this.codeStatErrors) this.codeStatErrors.textContent = metrics.errorCount;
  }

  formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  focusEditor() {
    if (this.codeHiddenInput && !this.isModalOpen) {
      this.codeHiddenInput.focus();
      this.ideWorkspace?.classList.add('focused');
      this.focusOverlay?.classList.add('hidden');
    }
  }

  bindEvents() {
    if (this.langTabs) {
      this.langTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          SoundService.playUITick();
          this.activeLang = tab.dataset.lang || 'python';
          this.activeSnippetIndex = 0;
          this.renderLanguageTabs();
          this.renderSnippetChips();
        });
      });
    }

    if (this.diffPills) {
      this.diffPills.forEach(pill => {
        pill.addEventListener('click', () => {
          SoundService.playUITick();
          this.activeDifficulty = pill.dataset.difficulty || 'All';
          this.activeSnippetIndex = 0;
          this.renderDifficultyPills();
          this.renderSnippetChips();
        });
      });
    }

    if (this.ideWorkspace) {
      this.ideWorkspace.addEventListener('click', () => this.focusEditor());
    }

    if (this.codeRestartBtn) {
      this.codeRestartBtn.addEventListener('click', () => {
        SoundService.playUITick();
        this.loadCurrentSnippet();
      });
    }

    if (this.codeNextBtn) {
      this.codeNextBtn.addEventListener('click', () => this.advanceSnippet());
    }

    if (this.codeModalRetryBtn) {
      this.codeModalRetryBtn.addEventListener('click', () => {
        this.dismissModal();
        this.loadCurrentSnippet();
      });
    }

    if (this.codeModalNextBtn) {
      this.codeModalNextBtn.addEventListener('click', () => {
        this.dismissModal();
        this.advanceSnippet();
      });
    }

    if (this.codeModalBackdrop) {
      this.codeModalBackdrop.addEventListener('click', () => this.dismissModal());
    }

    window.addEventListener('keydown', (e) => {
      if (this.isModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.dismissModal();
          this.loadCurrentSnippet();
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          this.dismissModal();
          this.advanceSnippet();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this.loadCurrentSnippet();
        return;
      }

      if (e.key === 'Tab' && document.activeElement === this.codeHiddenInput) {
        e.preventDefault();
        this.advanceSnippet();
        return;
      }

      if (document.activeElement !== this.codeHiddenInput && !this.isModalOpen && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.focusEditor();
      }
    });
  }

  advanceSnippet() {
    SoundService.playUITick();
    const snippets = this.getFilteredSnippets();
    if (snippets.length === 0) return;
    this.activeSnippetIndex = (this.activeSnippetIndex + 1) % snippets.length;
    this.renderSnippetChips();
  }

  showResultsModal(metrics) {
    this.isModalOpen = true;
    this.engine.isModalOpen = true;
    SoundService.playSuccessChime();

    if (this.codeModalMetaTitle) this.codeModalMetaTitle.textContent = this.currentSnippet ? this.currentSnippet.filename : 'code.py';
    if (this.codeModalMetaTime) this.codeModalMetaTime.textContent = this.formatTime(metrics.elapsedSeconds);

    if (this.codeResWpm) this.codeResWpm.textContent = metrics.wpm;
    if (this.codeResAcc) this.codeResAcc.textContent = `${metrics.accuracy}%`;
    if (this.codeResRawWpm) this.codeResRawWpm.textContent = `${metrics.rawWpm} WPM`;
    if (this.codeResErrors) this.codeResErrors.textContent = metrics.errorCount;
    if (this.codeResChars) this.codeResChars.textContent = metrics.totalKeystrokes;

    let rankText = 'Clean Code Specialist';
    if (metrics.wpm >= 80 && metrics.accuracy >= 97) {
      rankText = '10x Systems Architect';
    } else if (metrics.wpm >= 60 && metrics.accuracy >= 95) {
      rankText = 'Senior Code Artisan';
    } else if (metrics.wpm < 35 || metrics.accuracy < 85) {
      rankText = 'Syntax Apprentice';
    }
    if (this.codeModalRankText) this.codeModalRankText.textContent = rankText;

    const circumference = 2 * Math.PI * 50;
    if (this.codeGaugeWpmBar) {
      const wpmPercent = Math.min(100, (metrics.wpm / 120) * 100);
      const wpmOffset = circumference - (wpmPercent / 100) * circumference;
      this.codeGaugeWpmBar.style.strokeDasharray = `${circumference}`;
      this.codeGaugeWpmBar.style.strokeDashoffset = `${wpmOffset}`;
    }
    if (this.codeGaugeAccBar) {
      const accOffset = circumference - (metrics.accuracy / 100) * circumference;
      this.codeGaugeAccBar.style.strokeDasharray = `${circumference}`;
      this.codeGaugeAccBar.style.strokeDashoffset = `${accOffset}`;
    }

    if (this.codeResultsModal) {
      this.codeResultsModal.classList.remove('hidden');
    }

    const payload = {
      topic_title: `${this.currentSnippet?.title || 'Code Snippet'} (${this.currentSnippet?.filename || 'code'})`,
      mode: 'code',
      duration_seconds: metrics.elapsedSeconds,
      wpm: metrics.wpm,
      raw_wpm: metrics.rawWpm,
      accuracy: metrics.accuracy,
      errors_count: metrics.errorCount,
      characters_typed: metrics.totalKeystrokes,
      key_stats: this.engine.sessionKeyStats || {}
    };

    fetch('/api/session/save/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('Could not save code session:', err));
  }

  dismissModal() {
    this.isModalOpen = false;
    this.engine.isModalOpen = false;
    if (this.codeResultsModal) {
      this.codeResultsModal.classList.add('hidden');
    }
    this.focusEditor();
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
  window.SoundService = window.SoundService || SoundService;
  window.AnalyticsService = AnalyticsService;
  window.TypingEngine = TypingEngine;
  window.HeaderController = HeaderController;
  window.HomePageController = HomePageController;
  window.PracticePageController = PracticePageController;
  window.CodeArenaController = CodeArenaController;
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

  if (document.getElementById('code-arena-shell')) {
    window.codeArenaApp = new CodeArenaController();
  }

  if (document.getElementById('about-shell')) {
    window.aboutApp = new AboutPageController();
  }

  if (document.getElementById('community-hub')) {
    window.communityApp = new CommunityController();
  }

  // Global Guest Lock Modal Dismiss Listeners
  const lockModal = document.getElementById('guest-lock-modal');
  const lockClose = document.getElementById('guest-lock-close-icon');
  const lockBackdrop = document.getElementById('guest-lock-backdrop');

  const closeLockModal = () => {
    if (lockModal) lockModal.classList.add('hidden');
  };

  if (lockClose) lockClose.addEventListener('click', closeLockModal);
  if (lockBackdrop) lockBackdrop.addEventListener('click', closeLockModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lockModal && !lockModal.classList.contains('hidden')) {
      closeLockModal();
    }
  });

  document.querySelectorAll('.auth-locked-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (lockModal) lockModal.classList.remove('hidden');
    });
  });
});
