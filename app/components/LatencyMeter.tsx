'use client';

import { useEffect, useRef } from 'react';

interface LatencyMeterProps {
  latencyMs: number;
  latencyHistory: number[];
  ringId: 1 | 2;
  packetRate: number;
  connected: boolean;
}

function getLatencyColor(ms: number): string {
  if (ms === 0) return '#6b7280';       // gray — no data
  if (ms < 20)  return '#34d399';       // emerald — excellent
  if (ms < 50)  return '#fbbf24';       // amber — good
  if (ms < 100) return '#f97316';       // orange — degraded
  return '#ef4444';                     // red — bad
}

function getLatencyLabel(ms: number): string {
  if (ms === 0)  return 'No Signal';
  if (ms < 20)   return 'Excellent';
  if (ms < 50)   return 'Good';
  if (ms < 100)  return 'Degraded';
  return 'Bad';
}

export function LatencyMeter({ latencyMs, latencyHistory, packetRate, connected }: LatencyMeterProps) {
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const color = getLatencyColor(connected ? latencyMs : 0);
  const label = getLatencyLabel(connected ? latencyMs : 0);

  // Draw sparkline
  useEffect(() => {
    const canvas = sparkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!connected || latencyHistory.every(v => v === 0)) {
      ctx.fillStyle = 'rgba(100,100,100,0.1)';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // Find max for scaling (min 100ms scale)
    const max = Math.max(...latencyHistory, 100);

    // Gradient fill under the line
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    latencyHistory.forEach((v, i) => {
      const x = (i / (latencyHistory.length - 1)) * w;
      const y = h - (v / max) * h * 0.9;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    // Close the fill path
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw the line on top
    ctx.beginPath();
    latencyHistory.forEach((v, i) => {
      const x = (i / (latencyHistory.length - 1)) * w;
      const y = h - (v / max) * h * 0.9;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw threshold reference lines
    const refs = [20, 50, 100];
    refs.forEach(ref => {
      const y = h - (ref / max) * h * 0.9;
      if (y > 0 && y < h) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [latencyHistory, connected, color]);

  return (
    <div
      className="rounded-xl p-3 space-y-1.5"
      style={{
        background: 'rgba(15,15,20,0.8)',
        border: `1px solid ${connected ? color + '40' : '#1f2937'}`,
        transition: 'border-color 0.3s',
      }}
    >
      {/* Top row: big number + label */}
      <div className="flex items-end justify-between">
        <div>
          <span
            className="text-3xl font-black tabular-nums leading-none"
            style={{ color, transition: 'color 0.4s' }}
          >
            {connected ? latencyMs : '—'}
          </span>
          <span className="text-gray-500 text-xs ml-1">ms</span>
        </div>
        <div className="text-right">
          <div
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color, transition: 'color 0.4s' }}
          >
            {label}
          </div>
          <div className="text-gray-600 text-xs">{packetRate} pkt/s</div>
        </div>
      </div>

      {/* Sparkline */}
      <canvas
        ref={sparkRef}
        width={240}
        height={40}
        className="w-full rounded"
        style={{ background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Threshold legend */}
      <div className="flex gap-3 text-xs text-gray-600">
        <span style={{ color: '#34d399' }}>●</span><span>&lt;20ms</span>
        <span style={{ color: '#fbbf24' }}>●</span><span>20–50ms</span>
        <span style={{ color: '#ef4444' }}>●</span><span>&gt;100ms</span>
      </div>
    </div>
  );
}
