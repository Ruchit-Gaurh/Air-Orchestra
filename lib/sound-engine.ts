// ─────────────────────────────────────────────────────────────────
// Sound Engine — Tone.js 15 compatible
// Drums: MembraneSynth, NoiseSynth, MetalSynth
// Guitar: PolySynth with strum stagger
// Routing: synths → limiter → destination  (reverb as parallel send)
// ─────────────────────────────────────────────────────────────────

import type { HitDirection, StrumDirection } from './gesture-engine';

export type DrumPiece = 'kick' | 'snare' | 'hihat' | 'crash' | 'tabla_bayan' | 'tabla_dayan';
export type GuitarChord = 'C' | 'G' | 'Am' | 'F' | 'Em' | 'D';

const CHORD_NOTES: Record<GuitarChord, string[]> = {
  C:  ['C3', 'E3', 'G3', 'C4', 'E4'],
  G:  ['G2', 'B2', 'D3', 'G3', 'B3'],
  Am: ['A2', 'E3', 'A3', 'C4', 'E4'],
  F:  ['F2', 'A2', 'C3', 'F3', 'A3'],
  Em: ['E2', 'B2', 'E3', 'G3', 'B3'],
  D:  ['D3', 'A3', 'D4', 'F#4'],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToneAny = any;

export class SoundEngine {
  private kick!:   ToneAny;
  private snare!:  ToneAny;
  private hihat!:  ToneAny;
  private crash!:  ToneAny;
  private guitar!: ToneAny;
  private reverb!: ToneAny;
  private limiter!: ToneAny;
  private tablaBayan!: ToneAny;
  private tablaDayan!: ToneAny;
  private Tone!:   typeof import('tone');
  private ready = false;

  async init(): Promise<void> {
    this.Tone = await import('tone');

    // ── Unlock AudioContext (must happen first, before creating nodes) ──
    await this.Tone.start();
    console.log('[SoundEngine] AudioContext state:', this.Tone.getContext().state);

    // ── Master chain: limiter → destination ──────────────────────
    // Limiter prevents clipping on hard hits; connect everything here.
    this.limiter = new this.Tone.Limiter(-3).toDestination();

    // ── Reverb as a parallel send (NOT an insert) ─────────────────
    // Synths go directly to limiter for guaranteed dry signal,
    // AND a copy goes into reverb for the wet tail.
    this.reverb = new this.Tone.Reverb({ decay: 1.6 }).connect(this.limiter);
    await this.reverb.ready;

    // ── Kick drum ─────────────────────────────────────────────────
    this.kick = new this.Tone.MembraneSynth({
      pitchDecay:  0.05,
      octaves:     10,
      oscillator:  { type: 'sine' },
      envelope: {
        attack:  0.001,
        decay:   0.4,
        sustain: 0.01,
        release: 1.4,
      },
      volume: 18,
    }).connect(this.limiter);
    this.kick.connect(this.reverb); // parallel reverb send

    // ── Snare drum ────────────────────────────────────────────────
    this.snare = new this.Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack:  0.001,
        decay:   0.15,
        sustain: 0.0,
        release: 0.08,
      },
      volume: 16,
    }).connect(this.limiter);
    this.snare.connect(this.reverb);

    // ── Tabla ──────────────────────────────────────────────────────
    this.tablaBayan = new this.Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 2.5,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.8, sustain: 0.01, release: 1.4, attackCurve: "exponential" },
      volume: 20,
    }).connect(this.limiter);
    this.tablaBayan.connect(this.reverb);

    this.tablaDayan = new this.Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 1.2,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.8 },
      volume: 16,
    }).connect(this.limiter);
    this.tablaDayan.connect(this.reverb);

    // ── Hi-hat ────────────────────────────────────────────────────
    // MetalSynth in Tone 15: set frequency after construction
    this.hihat = new this.Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.10, release: 0.04 },
      harmonicity:     5.1,
      modulationIndex: 32,
      resonance:       4000,
      octaves:         1.5,
      volume:          18,
    }).connect(this.limiter);
    this.hihat.frequency.value = 400; // set after construction for v15 compat
    this.hihat.connect(this.reverb);

    // ── Crash cymbal ──────────────────────────────────────────────
    this.crash = new this.Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 1.2, release: 0.6 },
      harmonicity:     5.1,
      modulationIndex: 32,
      resonance:       2000,
      octaves:         2.0,
      volume:          10,
    }).connect(this.limiter);
    this.crash.frequency.value = 200;
    this.crash.connect(this.reverb);

    // ── Guitar (PolySynth) ────────────────────────────────────────
    this.guitar = new this.Tone.PolySynth(this.Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack:  0.005,
        decay:   0.2,
        sustain: 0.5,
        release: 1.8,
      },
      volume: 12,
    }).connect(this.limiter);
    this.guitar.connect(this.reverb);

    this.ready = true;
    console.log('[SoundEngine] Initialised successfully');
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Quick sanity-check beep — call this to verify audio chain works */
  testBeep(): void {
    if (!this.ready) return;
    const osc = new this.Tone.Synth({
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
      volume:     -6,
    }).connect(this.limiter);
    osc.triggerAttackRelease('A4', '8n', this.Tone.now());
    // auto-dispose after sound finishes
    setTimeout(() => osc.dispose(), 2000);
  }

  // HitDirection from gesture-engine now maps directly to DrumPiece.
  // 'kick' | 'snare' | 'hihat' | 'crash' — no translation needed.
  hitDirectionToDrum(direction: HitDirection | undefined): DrumPiece {
    if (!direction) return 'snare';
    return direction; // 1:1 mapping now that HitDirection === DrumPiece names
  }

  triggerDrum(piece: DrumPiece, intensity: number): void {
    if (!this.ready) return;
    const velocity = Math.max(0.1, Math.min(intensity, 1.0));
    const now      = this.Tone.now();

    switch (piece) {
      case 'kick':
        this.kick.triggerAttackRelease('C1', '8n', now, velocity);
        break;
      case 'snare':
        this.snare.triggerAttackRelease('8n', now, velocity);
        break;
      case 'hihat':
        this.hihat.triggerAttackRelease('16n', now, velocity);
        break;
      case 'crash':
        this.crash.triggerAttackRelease('16n', now, velocity);
        break;
    }
  }

  triggerTabla(hand: 'left' | 'right', intensity: number = 1.0) {
    if (!this.ready) return;
    const velocity = Math.min(Math.max(intensity, 0.1), 1.0);
    const now = this.Tone.now();

    if (hand === 'left') {
      const pitch = 80 + (velocity * 30); // Higher pitch for audibility
      this.tablaBayan.triggerAttackRelease(pitch, '4n', now, velocity);
    } else {
      this.tablaDayan.triggerAttackRelease('D4', '8n', now, velocity);
    }
  }

  triggerGuitar(chord: GuitarChord, dir: StrumDirection, intensity: number): void {
    if (!this.ready) return;
    const notes    = CHORD_NOTES[chord];
    const velocity = Math.max(0.15, Math.min(intensity, 1.0));
    const now      = this.Tone.now();
    const ordered  = dir === 'down' ? notes : [...notes].reverse();

    ordered.forEach((note, i) => {
      this.guitar.triggerAttackRelease(note, '2n', now + i * 0.018, velocity);
    });
  }

  releaseGuitar(): void {
    if (this.ready) this.guitar.releaseAll();
  }
}
