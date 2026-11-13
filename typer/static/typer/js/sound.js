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
      icon: '🧈',
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
      icon: '🌰',
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
      icon: '💎',
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
      icon: '📜',
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
      icon: '✨',
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
      } catch (e) {}

      // Get initial theme
      this.activeTheme = document.documentElement.getAttribute('data-theme') || 'midnight';

      // Listen for theme changes to automatically update Theme Sync
      window.addEventListener('topictyper:themechange', (e) => {
        this.activeTheme = e.detail?.theme || 'midnight';
      });

      // Auto-unlock AudioContext on first user gesture
      const unlockAudio = () => {
        this.ensureContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    },

    ensureContext() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        try {
          this.audioCtx = new AudioContextClass();

          // Master Dynamics Compressor: prevents any distortion during 120+ WPM typing bursts
          this.compressor = this.audioCtx.createDynamicsCompressor();
          this.compressor.threshold.setValueAtTime(-18, this.audioCtx.currentTime);
          this.compressor.knee.setValueAtTime(12, this.audioCtx.currentTime);
          this.compressor.ratio.setValueAtTime(8, this.audioCtx.currentTime);
          this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
          this.compressor.release.setValueAtTime(0.08, this.audioCtx.currentTime);

          // Master Gain
          this.masterGain = this.audioCtx.createGain();
          this.masterGain.gain.setValueAtTime(this.enabled ? 0.95 : 0.0, this.audioCtx.currentTime);

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

      // 1. Error Keystroke: Subtle, non-jarring muted low-end thud (~95 Hz)
      if (isError) {
        this.synthesizeErrorThud(ctx, now, dest);
        return;
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

      this.updateUI();
      this.bindEvents();
    },

    updateUI() {
      const profile = SOUND_PROFILES[SoundService.profile] || SOUND_PROFILES.creamy;

      if (this.activeProfileLabel) {
        this.activeProfileLabel.textContent = SoundService.enabled ? profile.shortName : 'Muted';
      }
      if (this.activeIcon) {
        this.activeIcon.textContent = SoundService.enabled ? '🔊' : '🔇';
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
