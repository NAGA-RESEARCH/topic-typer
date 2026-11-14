/**
 * TopicTyper Audio Engine (Web Audio API)
 *
 * Professional, zero-dependency, real-time procedural audio synthesis
 * for realistic mechanical keyboard switch acoustics, differentiated key types,
 * micro-randomization, selectable sound profiles, and UI milestone chimes.
 *
 * Built for TopicTyper / Naga Research Lab.
 */

(function (window) {
  'use strict';

  // ==========================================================================
  // 1. SOUND PROFILES SPECIFICATIONS
  // ==========================================================================
  const SOUND_PROFILES = {
    creamy: {
      id: 'creamy',
      name: 'Creamy Thock',
      shortName: 'Creamy',
      icon: 'creamy',
      desc: 'Deep warm PBT switch thock',
      baseFreq: 240,
      endFreq: 110,
      filterType: 'lowpass',
      filterFreq: 620,
      filterQ: 3.2,
      decayMs: 32,
      clickFreq: 1850,
      clickDecayMs: 8,
      clickGain: 0.038,
      bodyGain: 0.065
    },
    brown: {
      id: 'brown',
      name: 'Tactile Brown',
      shortName: 'Brown',
      icon: 'brown',
      desc: 'Balanced mid-range tactile bump',
      baseFreq: 330,
      endFreq: 160,
      filterType: 'bandpass',
      filterFreq: 850,
      filterQ: 2.2,
      decayMs: 26,
      clickFreq: 1400,
      clickDecayMs: 6,
      clickGain: 0.045,
      bodyGain: 0.070
    },
    blue: {
      id: 'blue',
      name: 'Clicky Blue',
      shortName: 'Clicky',
      icon: 'blue',
      desc: 'Sharp high-frequency click-jacket snap',
      baseFreq: 380,
      endFreq: 180,
      filterType: 'lowpass',
      filterFreq: 1300,
      filterQ: 3.5,
      decayMs: 25,
      clickFreq: 2400,
      clickDecayMs: 5,
      clickGain: 0.075,
      bodyGain: 0.055
    },
    typewriter: {
      id: 'typewriter',
      name: 'Retro Typewriter',
      shortName: 'Typewriter',
      icon: 'typewriter',
      desc: 'Vintage mechanical clack & carriage bell',
      baseFreq: 190,
      endFreq: 85,
      filterType: 'lowpass',
      filterFreq: 950,
      filterQ: 2.8,
      decayMs: 38,
      clickFreq: 1500,
      clickDecayMs: 9,
      clickGain: 0.055,
      bodyGain: 0.080
    },
    sync: {
      id: 'sync',
      name: 'Theme Sync (Auto)',
      shortName: 'Theme Sync',
      icon: 'sync',
      desc: 'Adapts dynamically to active visual theme'
    }
  };

  // ==========================================================================
  // 2. SOUND SERVICE CORE
  // ==========================================================================
  const SoundService = {
    audioCtx: null,
    compressor: null,
    masterGain: null,
    enabled: true,
    profile: 'creamy',
    activeTheme: 'midnight',
    comboStreak: 0,
    focusPadEnabled: false,
    focusPadNodes: null,

    init() {
      // Restore persisted preferences
      try {
        const storedEnabled = localStorage.getItem('topictyper_sound_enabled');
        if (storedEnabled !== null) {
          this.enabled = (storedEnabled === '1');
        } else {
          // Backward compatibility check with topictyper_sound
          const legacy = localStorage.getItem('topictyper_sound');
          if (legacy !== null) this.enabled = (legacy === '1');
        }

        const storedProfile = localStorage.getItem('topictyper_sound_profile');
        if (storedProfile && SOUND_PROFILES[storedProfile]) {
          this.profile = storedProfile;
        }

        const storedFocusPad = localStorage.getItem('topictyper_focus_pad');
        if (storedFocusPad !== null) {
          this.focusPadEnabled = (storedFocusPad === '1');
        }
      } catch (e) {}

      // Get initial theme
      this.activeTheme = document.documentElement.getAttribute('data-theme') || 'midnight';

      // Listen for theme changes to automatically update Theme Sync
      window.addEventListener('topictyper:themechange', (e) => {
        this.activeTheme = e.detail?.theme || 'midnight';
      });

      // Auto-unlock AudioContext on first user gesture & resume focus pad if enabled
      const unlockAudio = () => {
        if (this.ensureContext()) {
          if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
          if (this.focusPadEnabled && !this.focusPadNodes) {
            this.startFocusPad();
          }
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('pointerdown', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('pointerdown', unlockAudio, { passive: true });

      // Tab visibility listener: save battery/CPU when inactive
      document.addEventListener('visibilitychange', () => {
        if (!this.audioCtx) return;
        if (document.hidden) {
          if (this.audioCtx.state === 'running') {
            this.audioCtx.suspend().catch(() => {});
          }
        } else {
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
        }
      });
    },

    ensureContext() {
      // 1. Maintain a single window-level singleton instance
      if (!this.audioCtx && window.__topictyper_audio_ctx) {
        this.audioCtx = window.__topictyper_audio_ctx;
        this.compressor = window.__topictyper_audio_compressor || null;
        this.masterGain = window.__topictyper_audio_master_gain || null;
      }

      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        try {
          this.audioCtx = new AudioContextClass();
          window.__topictyper_audio_ctx = this.audioCtx;

          // Master Dynamics Compressor: prevents any distortion during 120+ WPM typing bursts
          this.compressor = this.audioCtx.createDynamicsCompressor();
          this.compressor.threshold.setValueAtTime(-18, this.audioCtx.currentTime);
          this.compressor.knee.setValueAtTime(12, this.audioCtx.currentTime);
          this.compressor.ratio.setValueAtTime(8, this.audioCtx.currentTime);
          this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
          this.compressor.release.setValueAtTime(0.08, this.audioCtx.currentTime);
          window.__topictyper_audio_compressor = this.compressor;

          // Master Gain
          this.masterGain = this.audioCtx.createGain();
          this.masterGain.gain.setValueAtTime(this.enabled ? 0.95 : 0.0, this.audioCtx.currentTime);
          window.__topictyper_audio_master_gain = this.masterGain;

          this.compressor.connect(this.masterGain);
          this.masterGain.connect(this.audioCtx.destination);
        } catch (e) {
          return false;
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      return !!this.audioCtx;
    },

    setProfile(profileId) {
      if (SOUND_PROFILES[profileId]) {
        this.profile = profileId;
        try {
          localStorage.setItem('topictyper_sound_profile', profileId);
        } catch (e) {}
      }
      return this.profile;
    },

    setMasterEnabled(enabled) {
      this.enabled = !!enabled;
      try {
        localStorage.setItem('topictyper_sound_enabled', this.enabled ? '1' : '0');
        localStorage.setItem('topictyper_sound', this.enabled ? '1' : '0');
      } catch (e) {}

      if (this.audioCtx && this.masterGain) {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.setValueAtTime(this.enabled ? 0.95 : 0.0, now);
      }
      return this.enabled;
    },

    toggle() {
      return this.setMasterEnabled(!this.enabled);
    },

    // ------------------------------------------------------------------------
    // Focus Pad Ambient Warm Drone Controller
    // ------------------------------------------------------------------------
    setFocusPadEnabled(enabled) {
      this.focusPadEnabled = !!enabled;
      try {
        localStorage.setItem('topictyper_focus_pad', this.focusPadEnabled ? '1' : '0');
      } catch (e) {}

      if (this.focusPadEnabled) {
        this.startFocusPad();
      } else {
        this.stopFocusPad();
      }
      return this.focusPadEnabled;
    },

    toggleFocusPad() {
      return this.setFocusPadEnabled(!this.focusPadEnabled);
    },

    startFocusPad() {
      if (!this.ensureContext()) return;
      if (this.focusPadNodes) return; // already running

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const dest = this.masterGain || ctx.destination;

      try {
        // Dual warm root + fifth harmonic oscillators (A2 110Hz + E3 164.81Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const oscSub = ctx.createOscillator();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110.0, now); // A2

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(164.81, now); // E3 (fifth)

        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(55.0, now); // A1 deep grounding sub

        // Warm 220Hz low-pass filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, now);
        filter.Q.setValueAtTime(1.2, now);

        // Ultra-soft background gain node
        const padGain = ctx.createGain();
        padGain.gain.setValueAtTime(0.0001, now);
        // Gentle 2.5-second warm swell to subtle ~0.022 volume
        padGain.gain.exponentialRampToValueAtTime(0.022, now + 2.5);

        osc1.connect(filter);
        osc2.connect(filter);
        oscSub.connect(filter);
        filter.connect(padGain);
        padGain.connect(dest);

        osc1.start(now);
        osc2.start(now);
        oscSub.start(now);

        this.focusPadNodes = { osc1, osc2, oscSub, filter, padGain };
      } catch (err) {
        console.warn('Could not start focus pad drone:', err);
      }
    },

    stopFocusPad() {
      if (!this.focusPadNodes) return;
      const { osc1, osc2, oscSub, padGain } = this.focusPadNodes;
      this.focusPadNodes = null;

      if (this.audioCtx) {
        const now = this.audioCtx.currentTime;
        try {
          padGain.gain.linearRampToValueAtTime(0.0001, now + 1.2);
          setTimeout(() => {
            try {
              osc1.stop();
              osc2.stop();
              oscSub.stop();
            } catch (e) {}
          }, 1300);
        } catch (e) {}
      }
    },

    /**
     * Resolves the effective acoustic parameters considering Theme Sync (Auto).
     */
    getEffectiveParams() {
      if (this.profile === 'sync') {
        if (this.activeTheme === 'hacking') {
          return { ...SOUND_PROFILES.creamy, isSynthBlip: true };
        } else if (this.activeTheme === 'coding') {
          return SOUND_PROFILES.brown;
        } else if (this.activeTheme === 'funny') {
          return { ...SOUND_PROFILES.creamy, isArcadePop: true };
        } else if (this.activeTheme === 'zen_matcha') {
          return { ...SOUND_PROFILES.creamy, filterFreq: 520, filterQ: 2.5, bodyGain: 0.055 };
        } else if (this.activeTheme === 'warm_amber') {
          return { ...SOUND_PROFILES.brown, filterFreq: 750, bodyGain: 0.065 };
        }
        return SOUND_PROFILES.creamy;
      }
      return SOUND_PROFILES[this.profile] || SOUND_PROFILES.creamy;
    },

    // ========================================================================
    // 3. KEYSTROKE ACOUSTIC MODELING & SYNTHESIS
    // ========================================================================
    playKeystroke(keyType = 'char', isError = false) {
      if (!this.enabled) return;
      if (!this.ensureContext()) return;

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const dest = this.compressor || this.masterGain || ctx.destination;

      // 1. Error Keystroke: Smooth reset of combo streak & subtle muted low-end thud (~95 Hz)
      if (isError) {
        this.comboStreak = 0;
        this.synthesizeErrorThud(ctx, now, dest);
        return;
      }

      // Track streak and gently layer flow-state harmonic resonance
      this.comboStreak++;
      if (this.comboStreak >= 5) {
        this.synthesizeFlowHarmonic(ctx, now, dest, this.comboStreak);
      }

      // 2. Micro-randomization on every keystroke: ±6% pitch, ±5% gain
      const pitchJitter = 1.0 + (Math.random() * 0.12 - 0.06);
      const gainJitter = 1.0 + (Math.random() * 0.10 - 0.05);

      const params = this.getEffectiveParams();

      // Theme Sync: Special Synth Blip for Hacking Theme
      if (params.isSynthBlip) {
        this.synthesizeCyberBlip(ctx, now, dest, keyType, pitchJitter, gainJitter);
        return;
      }

      // Theme Sync: Special Arcade Pop for Funny Theme
      if (params.isArcadePop) {
        this.synthesizeArcadePop(ctx, now, dest, keyType, pitchJitter, gainJitter);
        return;
      }

      // Differentiate physical switch characteristics by key type
      let baseFreq = params.baseFreq * pitchJitter;
      let endFreq = params.endFreq * pitchJitter;
      let bodyGainVal = params.bodyGain * gainJitter;
      let decaySec = (params.decayMs / 1000);
      let clickFreq = params.clickFreq * pitchJitter;
      let clickGainVal = params.clickGain * gainJitter;

      if (keyType === 'space') {
        // Spacebar: deeper, hollow thump (~115-145 Hz) + subtle stabilizer rumble
        baseFreq = (params.baseFreq * 0.58) * pitchJitter;
        endFreq = (params.endFreq * 0.55) * pitchJitter;
        bodyGainVal = (params.bodyGain * 1.35) * gainJitter;
        decaySec = 0.048;
        clickFreq = 950 * pitchJitter;
        clickGainVal = 0.035 * gainJitter;
        this.synthesizeStabilizerRattle(ctx, now, dest, gainJitter);
      } else if (keyType === 'backspace') {
        // Backspace: slightly softer, higher-cut reverse-feel tap
        baseFreq = (params.baseFreq * 1.15) * pitchJitter;
        endFreq = (params.endFreq * 1.10) * pitchJitter;
        bodyGainVal = (params.bodyGain * 0.85) * gainJitter;
        decaySec = 0.024;
      } else if (keyType === 'enter') {
        // Enter: solid return clack
        baseFreq = (params.baseFreq * 0.88) * pitchJitter;
        endFreq = (params.endFreq * 0.82) * pitchJitter;
        bodyGainVal = (params.bodyGain * 1.25) * gainJitter;
        decaySec = 0.038;
      } else if (keyType === 'tab') {
        // Tab: clean snappy indent tap
        baseFreq = (params.baseFreq * 1.05) * pitchJitter;
        bodyGainVal = (params.bodyGain * 1.05) * gainJitter;
      }

      // Transient click / click-jacket snap (3-8ms)
      const oscClick = ctx.createOscillator();
      const clickGain = ctx.createGain();
      oscClick.type = (params.id === 'typewriter') ? 'sawtooth' : 'triangle';
      oscClick.frequency.setValueAtTime(clickFreq, now);
      oscClick.frequency.exponentialRampToValueAtTime(Math.max(120, clickFreq * 0.22), now + (params.clickDecayMs / 1000));

      clickGain.gain.setValueAtTime(clickGainVal, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + (params.clickDecayMs / 1000));

      oscClick.connect(clickGain);
      clickGain.connect(dest);
      oscClick.start(now);
      oscClick.stop(now + (params.clickDecayMs / 1000) + 0.002);

      // Switch housing & plate bottom-out resonance (20-40ms)
      const oscBody = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = params.filterType || 'lowpass';
      filter.frequency.setValueAtTime(params.filterFreq, now);
      filter.Q.setValueAtTime(params.filterQ, now);

      oscBody.type = (params.id === 'brown') ? 'triangle' : 'sine';
      oscBody.frequency.setValueAtTime(baseFreq, now);
      oscBody.frequency.exponentialRampToValueAtTime(Math.max(45, endFreq), now + decaySec);

      bodyGain.gain.setValueAtTime(bodyGainVal, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);

      oscBody.connect(filter);
      filter.connect(bodyGain);
      bodyGain.connect(dest);
      oscBody.start(now);
      oscBody.stop(now + decaySec + 0.004);
    },

    // Backward-compatible alias for existing TypingEngine calls
    playKeyClick(isError = false, keyType = 'char') {
      this.playKeystroke(keyType, isError);
    },

    // ------------------------------------------------------------------------
    // Auxiliary Synthesis Methods
    // ------------------------------------------------------------------------
    synthesizeErrorThud(ctx, now, dest) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // Low-end dull thud centered around 95 Hz
      osc.frequency.setValueAtTime(105, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.050);

      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.050);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.055);
    },

    synthesizeStabilizerRattle(ctx, now, dest, gainJitter) {
      // Subtle high-cut noise burst simulating metal wire rattle in spacebar stabilizers
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(4.0, now);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2800, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.012);

      gain.gain.setValueAtTime(0.018 * gainJitter, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.016);
    },

    synthesizeCyberBlip(ctx, now, dest, keyType, pitchJitter, gainJitter) {
      // 8-bit cyber matrix pulse for Hacking Theme
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';

      const base = (keyType === 'space') ? 440 : (keyType === 'enter' ? 1050 : 880);
      const freq = base * pitchJitter;

      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.024);

      gain.gain.setValueAtTime(0.040 * gainJitter, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.026);
    },

    synthesizeArcadePop(ctx, now, dest, keyType, pitchJitter, gainJitter) {
      // Playful pop / marimba bubble for Funny Theme
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      const base = (keyType === 'space') ? 260 : (keyType === 'enter' ? 620 : 440);
      const startF = base * pitchJitter;
      const peakF = (base * 1.25) * pitchJitter;

      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.linearRampToValueAtTime(peakF, now + 0.008);
      osc.frequency.exponentialRampToValueAtTime(startF * 0.7, now + 0.035);

      gain.gain.setValueAtTime(0.055 * gainJitter, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.038);
    },

    // ========================================================================
    // 4. SUBTLE UI & MILESTONE SOUND EFFECTS
    // ========================================================================

    /**
     * Ultra-subtle soft UI tick (< 30ms) for topic card select, mode toggle, tab switch
     */
    playUITick() {
      if (!this.enabled) return;
      if (!this.ensureContext()) return;

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const dest = this.masterGain || ctx.destination;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1750, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.018);

      gain.gain.setValueAtTime(0.032, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.020);
    },

    /**
     * Test Complete Chime:
     * - Ascending harmonic 3-note chord chime (C5 - E5 - G5 with gentle decay)
     * - Fanfare sparkle if user achieved a new Personal Best (PB)
     * - Carriage return bell if using Retro Typewriter
     */
    playCompletion(isNewPB = false) {
      if (!this.enabled) return;
      if (!this.ensureContext()) return;

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const dest = this.masterGain || ctx.destination;

      // Special Typewriter Bell Ding (2093 Hz C7)
      if (this.profile === 'typewriter') {
        this.synthesizeTypewriterBell(ctx, now, dest);
      }

      if (isNewPB) {
        // Triumphant 5-note sparkle fanfare (C5 -> E5 -> G5 -> B5 -> C6)
        const fanfareNotes = [523.25, 659.25, 783.99, 987.77, 1046.50];
        fanfareNotes.forEach((freq, idx) => {
          const noteTime = now + (idx * 0.08);
          this.playBellChime(ctx, noteTime, dest, freq, 0.065, 0.45);
        });

        // Harmonic shimmer sparkle bells
        setTimeout(() => {
          if (!this.audioCtx) return;
          const t = this.audioCtx.currentTime;
          this.playBellChime(this.audioCtx, t, dest, 2093.0, 0.040, 0.55);
          this.playBellChime(this.audioCtx, t + 0.07, dest, 2637.0, 0.035, 0.65);
        }, 320);
      } else {
        // Ascending harmonic 3-note chord chime (C5 - E5 - G5)
        const chordNotes = [523.25, 659.25, 783.99];
        chordNotes.forEach((freq, idx) => {
          const noteTime = now + (idx * 0.07);
          this.playBellChime(ctx, noteTime, dest, freq, 0.055, 0.55);
        });
      }
    },

    playBellChime(ctx, startTime, dest, freq, maxGain = 0.05, durationSec = 0.5) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.01);
    },

    synthesizeTypewriterBell(ctx, now, dest) {
      const bellFreq = 2093; // C7
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(bellFreq, now);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(bellFreq * 1.5, now); // 5th harmonic

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.78);
      osc2.stop(now + 0.78);
    },

    /**
     * Pentatonic harmonic resonance that warms up gently during long error-free
     * combo streaks (triggering flow-state feedback without harsh pitch jumps)
     * and resets smoothly on a typo.
     */
    synthesizeFlowHarmonic(ctx, now, dest, streak) {
      const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
      const noteIdx = streak % PENTATONIC.length;
      const freq = PENTATONIC[noteIdx];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Volume is kept very gentle (~0.008 to 0.020) so it supports rather than distracts
      const flowGain = Math.min(0.020, 0.007 + (Math.min(streak, 40) * 0.0003));
      const duration = 0.18;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(flowGain, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
  };

  // ==========================================================================
  // 5. NAVBAR SOUND DROPDOWN UI CONTROLLER
  // ==========================================================================
  const SoundUIController = {
    init() {
      this.soundContainer = document.querySelector('.sound-dropdown-container');
      this.soundBtn = document.getElementById('sound-toggle-btn');
      this.soundMenu = document.getElementById('sound-dropdown-menu');
      this.masterToggle = document.getElementById('sound-master-toggle');
      this.muteLabel = document.getElementById('sound-mute-label');
      this.activeIcon = document.getElementById('sound-active-icon');
      this.activeProfileLabel = document.getElementById('sound-active-profile');
      this.profileOptions = document.querySelectorAll('.sound-option-btn');
      this.focusPadToggle = document.getElementById('focus-pad-toggle');
      this.focusPadLabel = document.getElementById('focus-pad-label');

      this.updateUI();
      this.bindEvents();
    },

    updateUI() {
      const profile = SOUND_PROFILES[SoundService.profile] || SOUND_PROFILES.creamy;

      if (this.activeProfileLabel) {
        this.activeProfileLabel.textContent = SoundService.enabled ? profile.shortName : 'Muted';
      }
      if (this.activeIcon) {
        const volumeOnSvg = '<svg class="header-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
        const volumeOffSvg = '<svg class="header-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
        this.activeIcon.innerHTML = SoundService.enabled ? volumeOnSvg : volumeOffSvg;
      }
      if (this.muteLabel) {
        this.muteLabel.textContent = SoundService.enabled ? 'Enabled' : 'Muted';
      }
      if (this.masterToggle) {
        this.masterToggle.classList.toggle('is-muted', !SoundService.enabled);
      }
      if (this.soundBtn) {
        this.soundBtn.classList.toggle('sound-disabled', !SoundService.enabled);
      }

      this.profileOptions?.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.profile === SoundService.profile);
      });

      if (this.focusPadToggle && this.focusPadLabel) {
        const isActive = SoundService.focusPadEnabled;
        this.focusPadLabel.textContent = isActive ? 'ACTIVE' : 'OFF';
        this.focusPadToggle.classList.toggle('active', isActive);
      }
    },

    bindEvents() {
      if (!this.soundBtn || !this.soundMenu) return;

      // Toggle dropdown open/closed
      this.soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = this.soundMenu.classList.contains('hidden');
        this.soundMenu.classList.toggle('hidden', !isHidden);
        this.soundContainer?.classList.toggle('open', isHidden);
        this.soundBtn.setAttribute('aria-expanded', String(isHidden));
      });

      // Master Mute/Unmute inside dropdown
      if (this.masterToggle) {
        this.masterToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          SoundService.toggle();
          this.updateUI();
          if (SoundService.enabled) {
            SoundService.playKeystroke('char', false);
          }
        });
      }

      // Profile Option buttons: select & instant acoustic preview
      this.profileOptions?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chosenProfile = btn.dataset.profile;
          if (chosenProfile) {
            // Enable sound automatically if user selects a profile while muted
            if (!SoundService.enabled) {
              SoundService.setMasterEnabled(true);
            }
            SoundService.setProfile(chosenProfile);
            this.updateUI();
            // Immediate crisp preview sound of chosen switch!
            SoundService.playKeystroke('char', false);
          }
        });
      });

      // Ambient Focus Pad Toggle
      if (this.focusPadToggle) {
        this.focusPadToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          SoundService.toggleFocusPad();
          this.updateUI();
        });
      }

      // Dismiss dropdown on outside click
      document.addEventListener('click', (e) => {
        if (!this.soundBtn.contains(e.target) && !this.soundMenu.contains(e.target)) {
          this.soundMenu.classList.add('hidden');
          this.soundContainer?.classList.remove('open');
          this.soundBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Dismiss on Escape
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.soundMenu.classList.contains('hidden')) {
          this.soundMenu.classList.add('hidden');
          this.soundContainer?.classList.remove('open');
          this.soundBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
  };

  // Expose to window and initialize
  window.SoundService = SoundService;
  window.SoundUIController = SoundUIController;
  window.SOUND_PROFILES = SOUND_PROFILES;

  // Initialize service immediately
  SoundService.init();

  // Initialize UI controls when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SoundUIController.init());
  } else {
    SoundUIController.init();
  }

})(window);
