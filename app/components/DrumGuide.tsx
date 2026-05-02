'use client';

import type { DrumPiece } from '@/lib/sound-engine';

interface DrumGuideProps {
  activePiece: DrumPiece | null;
  lastIntensity: number;
}

const DRUM_INFO: Array<{
  piece: DrumPiece;
  emoji: string;
  motion: string;
  axis: string;
  color: string;
  bg: string;
  border: string;
  sound: string;
}> = [
  {
    piece:  'kick',
    emoji:  '⬇',
    motion: 'Drop arm straight down',
    axis:   'Z-axis dominant',
    color:  '#fb923c',   // orange
    bg:     'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.3)',
    sound:  'Deep bass boom',
  },
  {
    piece:  'snare',
    emoji:  '↔',
    motion: 'Wrist snap / side flick',
    axis:   'Y-axis dominant',
    color:  '#22d3ee',   // cyan
    bg:     'rgba(34,211,238,0.08)',
    border: 'rgba(34,211,238,0.3)',
    sound:  'Crisp crack',
  },
  {
    piece:  'hihat',
    emoji:  '→',
    motion: 'Forward punch / jab',
    axis:   'X-axis dominant',
    color:  '#facc15',   // yellow
    bg:     'rgba(250,204,21,0.08)',
    border: 'rgba(250,204,21,0.3)',
    sound:  'Metallic tick',
  },
  {
    piece:  'crash',
    emoji:  '⚡',
    motion: 'Any HARD slam (> 5g)',
    axis:   'Any axis, high force',
    color:  '#f87171',   // red
    bg:     'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.35)',
    sound:  'Loud cymbal crash',
  },
];

export function DrumGuide({ activePiece, lastIntensity }: DrumGuideProps) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: 'rgba(10,10,15,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3">
        Drum Gesture Guide
      </div>

      {DRUM_INFO.map(info => {
        const isActive = activePiece === info.piece;
        return (
          <div
            key={info.piece}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150"
            style={{
              background: isActive ? info.bg : 'transparent',
              border: `1px solid ${isActive ? info.border : 'rgba(255,255,255,0.04)'}`,
              transform: isActive ? 'scale(1.01)' : 'scale(1)',
              boxShadow: isActive ? `0 0 12px ${info.color}22` : 'none',
            }}
          >
            {/* Emoji / direction indicator */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 transition-all duration-150"
              style={{
                background: isActive ? info.bg : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? info.border : 'rgba(255,255,255,0.06)'}`,
                color: isActive ? info.color : '#6b7280',
              }}
            >
              {info.emoji}
            </div>

            {/* Label column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="font-bold text-sm uppercase tracking-wide"
                  style={{ color: isActive ? info.color : '#9ca3af' }}
                >
                  {info.piece}
                </span>
                {isActive && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-semibold"
                    style={{
                      background: info.color + '22',
                      color: info.color,
                    }}
                  >
                    ● HIT
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{info.motion}</div>
              <div className="text-xs text-gray-700 truncate">{info.axis} · {info.sound}</div>
            </div>

            {/* Intensity bar (only when active) */}
            {isActive && (
              <div className="w-16 flex-shrink-0">
                <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-75"
                    style={{
                      width: `${lastIntensity * 100}%`,
                      background: info.color,
                    }}
                  />
                </div>
                <div
                  className="text-xs text-center mt-0.5"
                  style={{ color: info.color }}
                >
                  {(lastIntensity * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-1 text-gray-700 text-xs border-t border-gray-800 mt-2">
        Tip: Threshold is 1.8g. Hit harder for more intensity. Crash needs 5g+ (wild swing).
      </div>
    </div>
  );
}
