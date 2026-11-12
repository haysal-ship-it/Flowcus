/**
 * Playz & Stickk Audio Effects using Web Audio API
 * - Soft tactile page flip whoosh
 * - Crisp jagged paper rip / tear
 * - Mechanical move click
 * - Fanfare sound for match victory
 */

class UwidgetsAudioController {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isGlobalMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const storedMute = localStorage.getItem('uwidgets_sound_muted');
      this.isMuted = storedMute === 'true';
    }
  }

  private initContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setGlobalMuted(muted: boolean) {
    this.isGlobalMuted = muted;
  }

  public getGlobalMuted(): boolean {
    return this.isGlobalMuted;
  }

  public isEffectivelyMuted(): boolean {
    return this.isGlobalMuted || this.isMuted;
  }

  public toggleMuted(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('uwidgets_sound_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  /**
   * Sound 1: Soft Realistic Page Flip
   */
  public playPageFlip() {
    if (this.isEffectivelyMuted()) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const dur = 0.52;
      const buf = this.audioCtx.createBuffer(1, Math.floor(this.audioCtx.sampleRate * dur), this.audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.sin((i / data.length) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * Math.pow(env, 1.4);
      }

      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.linearRampToValueAtTime(320, now + dur);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      src.start(now);
    } catch {}
  }

  /**
   * Sound 2: Crisp Realistic Paper Tear / Rip
   */
  public playPaperTear() {
    if (this.isEffectivelyMuted()) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const dur = 0.44;
      const buf = this.audioCtx.createBuffer(1, Math.floor(this.audioCtx.sampleRate * dur), this.audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const crackle = Math.random() > 0.32 ? (Math.random() * 2 - 1) : 0;
        data[i] = crackle * (1 - i / data.length);
      }

      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2300, now);
      filter.frequency.linearRampToValueAtTime(1200, now + dur);
      filter.Q.value = 2.4;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      src.start(now);
    } catch {}
  }

  /**
   * Sound 3: Mechanical Tile Move Click (Playz)
   */
  public playTileClick(isO: boolean = false) {
    if (this.isEffectivelyMuted()) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isO ? 420 : 640, now);
      osc.frequency.exponentialRampToValueAtTime(isO ? 260 : 420, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  /**
   * Sound 4: Victory Celebration Fanfare
   */
  public playWinFanfare() {
    if (this.isEffectivelyMuted()) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = this.audioCtx!.currentTime + idx * 0.11;
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.start(now);
        osc.stop(now + 0.3);
      });
    } catch {}
  }
}

export const uwidgetsAudio = new UwidgetsAudioController();
