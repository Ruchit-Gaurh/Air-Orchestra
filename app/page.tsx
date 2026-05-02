'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRings } from '@/hooks/useRings';
import { SoundEngine, GuitarChord } from '@/lib/sound-engine';
import type { GestureEvent } from '@/lib/gesture-engine';
import type { DrumPiece } from '@/lib/sound-engine';
import { LatencyMeter } from '@/app/components/LatencyMeter';
import { DrumGuide } from '@/app/components/DrumGuide';
import dynamic from 'next/dynamic';

const DrumstickSceneDynamic = dynamic(
  () => import('@/app/components/DrumstickScene').then(m => ({ default: m.DrumstickScene })),
  { ssr: false, loading: () => <div style={{ width: '100%', height: '100%', background: '#06060f' }} /> }
);
const DrumstickSceneIdleDynamic = dynamic(
  () => import('@/app/components/DrumstickScene').then(m => ({ default: m.DrumstickSceneIdle })),
  { ssr: false, loading: () => <div style={{ width: '100%', height: '100%', background: '#06060f' }} /> }
);

const CHORD_CYCLE: GuitarChord[] = ['C', 'G', 'Am', 'F', 'Em', 'D'];

const DRUM_COLORS: Record<DrumPiece, string> = {
  kick: '#fb923c', snare: '#22d3ee', hihat: '#facc15', crash: '#f87171',
  tabla_bayan: '#bb9977', tabla_dayan: '#ffddbb',
};
const DRUM_LABELS: Record<DrumPiece, string> = {
  kick: 'KICK', snare: 'SNARE', hihat: 'HI-HAT', crash: '💥 CRASH!',
  tabla_bayan: 'BAYAN (L)', tabla_dayan: 'DAYAN (R)',
};

type Mode = 'drum' | 'guitar' | 'tabla';
interface HitState { piece: DrumPiece | null; version: number; intensity: number; label: string }
const noHit: HitState = { piece: null, version: 0, intensity: 0, label: '' };

// Glass panel style helper
const glass = (extra = '') =>
  `backdrop-blur-md bg-black/50 border border-white/10 rounded-xl ${extra}`;

export default function AirOrchestra() {
  const { ring1, ring2, connect, disconnect, sendCommand, onGesture, onPacket } = useRings();
  const soundEngine  = useRef<SoundEngine | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [mode, setMode]             = useState<Mode>('drum');
  const [ring1Url, setRing1Url]     = useState('ws://ring1.local:81');
  const [ring2Url, setRing2Url]     = useState('ws://ring2.local:81');
  const [activeChord, setActiveChord] = useState<GuitarChord>('C');
  const [chordIndex,  setChordIndex]  = useState(0);
  void chordIndex;

  const [r1Hit, setR1Hit] = useState<HitState>(noHit);
  const [r2Hit, setR2Hit] = useState<HitState>(noHit);
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [r1Gyro, setR1Gyro] = useState({ gx: 0, gy: 0, gz: 0 });
  const [r2Gyro, setR2Gyro] = useState({ gx: 0, gy: 0, gz: 0 });
  const [guideOpen, setGuideOpen] = useState(false);

  const initAudio = async () => {
    if (audioReady) return;
    try {
      const e = new SoundEngine(); await e.init();
      soundEngine.current = e; setAudioReady(true);
    } catch (err) { setAudioError(String(err)); }
  };

  useEffect(() => {
    onPacket((id, p) => {
      if (id === 1) setR1Gyro({ gx: p.gx, gy: p.gy, gz: p.gz });
      else          setR2Gyro({ gx: p.gx, gy: p.gy, gz: p.gz });
    });
  }, [onPacket]);

  const handleGesture = useCallback((ringId: 1 | 2, event: GestureEvent) => {
    const eng = soundEngine.current;
    if (!eng?.isReady()) return;

    if (mode === 'drum' && event.type === 'hit') {
      const piece = eng.hitDirectionToDrum(event.direction);
      eng.triggerDrum(piece, event.intensity);
      const setHit = ringId === 1 ? setR1Hit : setR2Hit;
      const timer  = ringId === 1 ? t1 : t2;
      if (timer.current) clearTimeout(timer.current);
      setHit({ piece, version: Date.now(), intensity: event.intensity, label: DRUM_LABELS[piece] });
      timer.current = setTimeout(() => setHit(h => ({ ...h, piece: null, label: '' })), 450);
    }
    if (mode === 'tabla' && event.type === 'hit') {
      // Ring 1 = Bayan (Left hand, bass), Ring 2 = Dayan (Right hand, treble)
      const isLeft = ringId === 1;
      const piece: DrumPiece = isLeft ? 'tabla_bayan' : 'tabla_dayan';
      eng.triggerTabla(isLeft ? 'left' : 'right', event.intensity);

      const setHit = ringId === 1 ? setR1Hit : setR2Hit;
      const timer  = ringId === 1 ? t1 : t2;
      if (timer.current) clearTimeout(timer.current);
      setHit({ piece, version: Date.now(), intensity: event.intensity, label: DRUM_LABELS[piece] });
      timer.current = setTimeout(() => setHit(h => ({ ...h, piece: null, label: '' })), 450);
    }
    if (mode === 'guitar') {
      if (ringId === 2 && event.type === 'tap') {
        setChordIndex(prev => { const n = (prev + 1) % CHORD_CYCLE.length; setActiveChord(CHORD_CYCLE[n]); eng.releaseGuitar(); return n; });
      }
      if (ringId === 1 && event.type === 'strum') {
        setActiveChord(c => { eng.triggerGuitar(c, event.strumDir ?? 'down', event.intensity); return c; });
      }
    }
  }, [mode]);

  useEffect(() => { onGesture(handleGesture); }, [handleGesture, onGesture]);

  const switchMode = (m: Mode) => {
    setMode(m);
    if (ring1.connected) sendCommand(1, `mode:${m}`);
    if (ring2.connected) sendCommand(2, `mode:${m}`);
  };

  const anyConnected = ring1.connected || ring2.connected;
  const activePiece  = r1Hit.piece ?? r2Hit.piece;
  const activeIntensity = r1Hit.piece ? r1Hit.intensity : r2Hit.intensity;

  return (
    /* Full-viewport wrapper */
    <div className="fixed inset-0 bg-[#06060f] overflow-hidden font-mono text-white">

      {/* ── 3D Scene fills everything ── */}
      <div className="absolute inset-0">
        {anyConnected ? (
          <DrumstickSceneDynamic
            mode={mode}
            r1gx={r1Gyro.gx} r1gy={r1Gyro.gy} r1gz={r1Gyro.gz}
            r1HitPiece={r1Hit.piece} r1HitVersion={r1Hit.version} r1Connected={ring1.connected}
            r2gx={r2Gyro.gx} r2gy={r2Gyro.gy} r2gz={r2Gyro.gz}
            r2HitPiece={r2Hit.piece} r2HitVersion={r2Hit.version} r2Connected={ring2.connected}
          />
        ) : (
          <DrumstickSceneIdleDynamic />
        )}
      </div>

      {/* ── HUD overlay (pointer-events managed per element) ── */}

      {/* Top bar */}
      <div className={`absolute top-3 left-3 right-3 flex items-center justify-between px-4 py-2.5 ${glass()}`}
        style={{ pointerEvents: 'auto' }}>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">Air Orchestra</h1>
          <p className="text-gray-500 text-xs mt-0.5">IMU → audio engine</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode buttons */}
          {(['drum', 'tabla', 'guitar'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border
                ${mode === m ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}>
              {m === 'drum' ? '🥁' : m === 'tabla' ? '🪘' : '🎸'} {m}
            </button>
          ))}
          {/* Audio */}
          {!audioReady ? (
            <button onClick={initAudio}
              className="bg-teal-500 hover:bg-teal-400 text-black font-bold px-4 py-1.5 rounded-lg text-xs transition-colors">
              Start Audio
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-teal-400 text-xs">● Live</span>
              <button onClick={() => soundEngine.current?.testBeep()}
                className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 transition-colors">
                Beep
              </button>
            </div>
          )}
        </div>
        {audioError && <p className="text-red-400 text-xs absolute top-full left-4 mt-1">⚠ {audioError}</p>}
      </div>

      {/* Left panel — Ring 1 (Left hand) */}
      <div className={`absolute top-20 left-3 w-60 p-3 space-y-2 ${glass()}`}
        style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-xs font-bold uppercase tracking-widest ${ring1.connected ? 'text-teal-400' : 'text-gray-600'}`}>
              {ring1.connected ? '● Ring 1' : '○ Ring 1'}
            </div>
            <div className="text-gray-500 text-xs">Left hand · L stick</div>
          </div>
          {r1Hit.label && (
            <div className="text-sm font-black" style={{ color: DRUM_COLORS[r1Hit.piece!], textShadow: `0 0 10px ${DRUM_COLORS[r1Hit.piece!]}` }}>
              {r1Hit.label}
            </div>
          )}
        </div>
        <LatencyMeter ringId={1} latencyMs={ring1.latencyMs} latencyHistory={ring1.latencyHistory}
          packetRate={ring1.packetRate} connected={ring1.connected} />
        <div className="flex gap-1.5">
          <input value={ring1Url} onChange={e => setRing1Url(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
            placeholder="ws://ring1.local:81" />
          <button onClick={() => ring1.connected ? disconnect(1) : connect(1, ring1Url)}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors
              ${ring1.connected ? 'bg-red-900/60 text-red-300' : 'bg-teal-700 text-white hover:bg-teal-600'}`}>
            {ring1.connected ? '✕' : 'Go'}
          </button>
        </div>
        {ring1.connected && (
          <button onClick={() => sendCommand(1, 'calibrate')} className="text-xs text-gray-600 hover:text-gray-400 underline">
            Recalibrate
          </button>
        )}
      </div>

      {/* Right panel — Ring 2 (Right hand) */}
      <div className={`absolute top-20 right-3 w-60 p-3 space-y-2 ${glass()}`}
        style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-xs font-bold uppercase tracking-widest ${ring2.connected ? 'text-teal-400' : 'text-gray-600'}`}>
              {ring2.connected ? '● Ring 2' : '○ Ring 2'}
            </div>
            <div className="text-gray-500 text-xs">Right hand · R stick</div>
          </div>
          {r2Hit.label && (
            <div className="text-sm font-black" style={{ color: DRUM_COLORS[r2Hit.piece!], textShadow: `0 0 10px ${DRUM_COLORS[r2Hit.piece!]}` }}>
              {r2Hit.label}
            </div>
          )}
        </div>
        <LatencyMeter ringId={2} latencyMs={ring2.latencyMs} latencyHistory={ring2.latencyHistory}
          packetRate={ring2.packetRate} connected={ring2.connected} />
        <div className="flex gap-1.5">
          <input value={ring2Url} onChange={e => setRing2Url(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-teal-500"
            placeholder="ws://ring2.local:81" />
          <button onClick={() => ring2.connected ? disconnect(2) : connect(2, ring2Url)}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors
              ${ring2.connected ? 'bg-red-900/60 text-red-300' : 'bg-teal-700 text-white hover:bg-teal-600'}`}>
            {ring2.connected ? '✕' : 'Go'}
          </button>
        </div>
        {ring2.connected && (
          <button onClick={() => sendCommand(2, 'calibrate')} className="text-xs text-gray-600 hover:text-gray-400 underline">
            Recalibrate
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className={`absolute bottom-3 left-3 right-3 ${glass('px-4 py-2.5')}`}
        style={{ pointerEvents: 'auto' }}>
        {mode === 'drum' && (
          <div className="flex items-center justify-between gap-4">
            {/* Drum guide toggle */}
            <button onClick={() => setGuideOpen(o => !o)}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
              <span>{guideOpen ? '▾' : '▸'}</span> Gesture Guide
            </button>
            {/* Quick legend */}
            <div className="flex gap-4 text-xs">
              {([
                { p: 'kick',  icon: '⬇', txt: 'Drop arm' },
                { p: 'snare', icon: '↔', txt: 'Wrist snap' },
                { p: 'hihat', icon: '→', txt: 'Punch fwd' },
                { p: 'crash', icon: '⚡', txt: '3.5g+ slam' },
              ] as const).map(({ p, icon, txt }) => (
                <div key={p} className="flex items-center gap-1"
                  style={{ color: activePiece === p ? DRUM_COLORS[p] : '#6b7280' }}>
                  <span>{icon}</span>
                  <span className="hidden sm:inline font-bold uppercase tracking-wider text-xs">{p}</span>
                  <span className="hidden md:inline text-xs opacity-60">· {txt}</span>
                </div>
              ))}
            </div>
            {/* Current hit */}
            <div className="text-xs text-gray-600 w-24 text-right shrink-0">
              {!anyConnected && 'Auto-demo'}
              {anyConnected && !r1Hit.label && !r2Hit.label && 'Waiting…'}
            </div>
          </div>
        )}
        {mode === 'guitar' && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-500 text-xs">Chords:</span>
            {CHORD_CYCLE.map((ch, i) => (
              <button key={ch} onClick={() => { setActiveChord(ch); setChordIndex(i); soundEngine.current?.releaseGuitar(); }}
                className={`w-10 h-10 rounded-lg font-bold transition-all text-sm
                  ${ch === activeChord ? 'bg-teal-500 text-black scale-110' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {ch}
              </button>
            ))}
            <span className="text-gray-600 text-xs ml-2">Ring 2 tap = cycle · Ring 1 strum = play</span>
          </div>
        )}
      </div>

      {/* Drum guide expanded */}
      {guideOpen && mode === 'drum' && (
        <div className={`absolute bottom-16 left-3 w-80 ${glass('p-3')}`} style={{ pointerEvents: 'auto' }}>
          <DrumGuide activePiece={activePiece} lastIntensity={activeIntensity} />
        </div>
      )}

      {/* No-connection hint */}
      {!anyConnected && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center ${glass('px-6 py-4')} pointer-events-none`}
          style={{ marginTop: 60 }}>
          <p className="text-gray-500 text-xs">Connect a ring via the panels above</p>
          <p className="text-gray-700 text-xs mt-1">SSID: AirOrchestra · pw: drums2024</p>
        </div>
      )}
    </div>
  );
}
