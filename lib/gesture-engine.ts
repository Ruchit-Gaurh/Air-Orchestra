// ─────────────────────────────────────────────────────────────────
// Gesture Engine
// Converts raw IMU packets into semantic gesture events.
// No ML. Pure threshold + peak detection. Tunable and reliable.
// ─────────────────────────────────────────────────────────────────

export interface IMUPacket {
  t: number;    // ESP32 millis() timestamp
  ax: number;   // acceleration X (g)
  ay: number;   // acceleration Y (g)
  az: number;   // acceleration Z (g)
  gx: number;   // gyroscope X (deg/s)
  gy: number;   // gyroscope Y (deg/s)
  gz: number;   // gyroscope Z (deg/s)
  m: number;    // mode from ring (0=drum, 1=guitar)
}

// HitDirection now maps 1:1 to a drum piece for clarity.
// 'crash' is special — triggered by any ultra-hard hit regardless of axis.
export type HitDirection = 'kick' | 'snare' | 'hihat' | 'crash';
export type StrumDirection = 'down' | 'up';

export interface GestureEvent {
  type: 'hit' | 'strum' | 'tap';
  intensity: number;       // 0.0 → 1.0 normalised
  direction?: HitDirection;
  strumDir?: StrumDirection;
  magnitude: number;       // raw g-force for debugging
  timestamp: number;       // Date.now() at detection
  latency: number;         // ms from ring timestamp to detection
  // Raw gyro snapshot at the moment of the event (for 3D rotation)
  gx: number;
  gy: number;
  gz: number;
}

// ── Tuning constants ─────────────────────────────────────────────
// Raise HIT_THRESHOLD if accidental triggers occur while moving normally.
// Lower it if you need to play softly and hits aren't registering.
const HIT_THRESHOLD   = 1.8;  // g above baseline to count as a drum hit
const CRASH_THRESHOLD = 3.5;  // g above baseline — hard slam = crash (was 5g, wrist rings max ~4-5g)
const TAP_THRESHOLD   = 0.9;  // g for softer chord-select taps
const MAX_MAGNITUDE   = 8.0;  // g — maps to intensity=1.0
const DEBOUNCE_MS     = 100;  // minimum ms between two hits (same hand)
const TAP_DEBOUNCE_MS = 80;
const STRUM_THRESHOLD = 130;  // deg/s on gyro-Y for strum detection
const STRUM_DEBOUNCE  = 140;  // ms between strums
const TAP_WINDOW_MS   = 500;  // ms window for counting multi-taps

export class GestureEngine {
  private prevMag        = 0;
  private lastHitTime    = 0;
  private lastTapTime    = 0;
  private lastStrumTime  = 0;
  private tapTimestamps: number[] = [];
  private readonly callback: (event: GestureEvent) => void;

  constructor(callback: (event: GestureEvent) => void) {
    this.callback = callback;
  }

  process(packet: IMUPacket): void {
    const now = Date.now();
    const latency = now - packet.t;

    // ── Magnitude of acceleration, subtract 1g gravity baseline ──
    const raw = Math.sqrt(packet.ax ** 2 + packet.ay ** 2 + packet.az ** 2);
    const mag = Math.max(0, raw - 1.0);

    // ── Hit detection ─────────────────────────────────────────────
    // A hit is the rising edge of the magnitude signal crossing threshold.
    // The "rising edge" check (prevMag below, current above) ensures we
    // trigger once at the moment of impact, not on every sample above threshold.
    const isRising   = mag > HIT_THRESHOLD && this.prevMag <= HIT_THRESHOLD;
    const hitAllowed = (now - this.lastHitTime) > DEBOUNCE_MS;

    if (isRising && hitAllowed) {
      this.lastHitTime = now;

      const intensity  = Math.min(mag / MAX_MAGNITUDE, 1.0);
      const direction  = this.classifyHitDirection(packet, mag);

      this.callback({
        type: 'hit',
        intensity,
        direction,
        magnitude: mag,
        timestamp: now,
        latency,
        gx: packet.gx,
        gy: packet.gy,
        gz: packet.gz,
      });
    }

    // ── Tap detection (chord select — softer intentional taps) ────
    const isTap     = mag > TAP_THRESHOLD && mag < HIT_THRESHOLD
                      && this.prevMag <= TAP_THRESHOLD;
    const tapAllowed = (now - this.lastTapTime) > TAP_DEBOUNCE_MS;

    if (isTap && tapAllowed) {
      this.lastTapTime = now;
      this.tapTimestamps.push(now);
      // Expire taps outside the window
      this.tapTimestamps = this.tapTimestamps.filter(
        t => now - t <= TAP_WINDOW_MS
      );

      this.callback({
        type: 'tap',
        intensity: mag / HIT_THRESHOLD,
        magnitude: mag,
        timestamp: now,
        latency,
        gx: packet.gx,
        gy: packet.gy,
        gz: packet.gz,
      });
    }

    // ── Strum detection (gyroscope Y angular velocity) ────────────
    // Wrist rotation for strumming a guitar chord.
    // Positive gy = downstroke, negative gy = upstroke.
    const strumAllowed = (now - this.lastStrumTime) > STRUM_DEBOUNCE;

    if (Math.abs(packet.gy) > STRUM_THRESHOLD && strumAllowed) {
      this.lastStrumTime = now;
      const intensity = Math.min(Math.abs(packet.gy) / 500, 1.0);

      this.callback({
        type: 'strum',
        intensity,
        strumDir: packet.gy > 0 ? 'down' : 'up',
        magnitude: Math.abs(packet.gy),
        timestamp: now,
        latency,
        gx: packet.gx,
        gy: packet.gy,
        gz: packet.gz,
      });
    }

    this.prevMag = mag;
  }

  // How many taps have occurred in the last TAP_WINDOW_MS
  getTapCount(): number {
    const now = Date.now();
    return this.tapTimestamps.filter(t => now - t <= TAP_WINDOW_MS).length;
  }

  resetTaps(): void {
    this.tapTimestamps = [];
  }

  // ── Private: classify hit direction from accel vector ────────────
  //
  // Physical mapping (ring worn on back of hand, USB port facing wrist):
  //
  //   CRASH   — any ultra-hard hit (> CRASH_THRESHOLD g) — wild slam
  //   KICK    — dominant az (arm drops straight down fast)
  //             Simulates a bass drum kick: arm held out, dropped hard.
  //   SNARE   — dominant ay (side-to-side wrist snap / flick)
  //             Simulates a snare hit: quick inward or outward wrist crack.
  //   HI-HAT  — dominant ax (forward punch / jab motion)
  //             Simulates hi-hat: short controlled forward stab.
  //
  private classifyHitDirection(p: IMUPacket, mag: number): HitDirection {
    if (mag >= CRASH_THRESHOLD) return 'crash';

    const absX = Math.abs(p.ax);
    const absY = Math.abs(p.ay);
    const absZ = Math.abs(p.az);
    const max = Math.max(absX, absY, absZ);

    if (max === absZ) return 'kick';
    if (max === absY) return 'snare';
    return 'hihat';
  }
}
