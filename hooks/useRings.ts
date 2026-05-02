'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GestureEngine, GestureEvent, IMUPacket } from '@/lib/gesture-engine';

export interface RingStatus {
  id: 1 | 2;
  connected: boolean;
  latencyMs: number;
  latencyHistory: number[];   // rolling 60-sample history for sparkline
  packetRate: number;         // packets per second
  lastMagnitude: number;      // for live graph
  magnitudeHistory: number[]; // circular buffer, last 200 values
  lastGyro: { gx: number; gy: number; gz: number };
}

export type RingEventCallback = (ringId: 1 | 2, event: GestureEvent) => void;
export type RingPacketCallback = (ringId: 1 | 2, packet: IMUPacket) => void;

const HISTORY_LEN = 200;
const LATENCY_LEN = 60;

function makeDefaultStatus(id: 1 | 2): RingStatus {
  return {
    id,
    connected: false,
    latencyMs: 0,
    latencyHistory: new Array(LATENCY_LEN).fill(0),
    packetRate: 0,
    lastMagnitude: 0,
    magnitudeHistory: new Array(HISTORY_LEN).fill(0),
    lastGyro: { gx: 0, gy: 0, gz: 0 },
  };
}

export function useRings() {
  const [ring1, setRing1] = useState<RingStatus>(makeDefaultStatus(1));
  const [ring2, setRing2] = useState<RingStatus>(makeDefaultStatus(2));

  // Refs for WS and engines so they don't trigger re-renders
  const ws1   = useRef<WebSocket | null>(null);
  const ws2   = useRef<WebSocket | null>(null);
  const url1  = useRef<string>('');
  const url2  = useRef<string>('');

  const gestureCallback = useRef<RingEventCallback | null>(null);
  const packetCallback  = useRef<RingPacketCallback | null>(null);

  const engine1 = useRef(new GestureEngine(e => gestureCallback.current?.(1, e)));
  const engine2 = useRef(new GestureEngine(e => gestureCallback.current?.(2, e)));

  // Packet counters (reset every second)
  const pktCount1 = useRef(0);
  const pktCount2 = useRef(0);

  // Last packet receive timestamps for inter-packet latency
  // (We can't use Date.now() - packet.t because ESP32 millis() and
  //  the browser's Unix epoch are in completely different time domains.)
  const lastRecv1 = useRef(0);
  const lastRecv2 = useRef(0);

  // ── Packet rate sampling ──────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setRing1(p => ({ ...p, packetRate: pktCount1.current }));
      setRing2(p => ({ ...p, packetRate: pktCount2.current }));
      pktCount1.current = 0;
      pktCount2.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Connect a ring ────────────────────────────────────────────
  const connect = useCallback((ringId: 1 | 2, wsUrl: string) => {
    const wsRef      = ringId === 1 ? ws1 : ws2;
    const urlRef     = ringId === 1 ? url1 : url2;
    const setStatus  = ringId === 1 ? setRing1 : setRing2;
    const engine     = ringId === 1 ? engine1.current : engine2.current;
    const pktCount   = ringId === 1 ? pktCount1 : pktCount2;

    // Close existing connection
    wsRef.current?.close();
    urlRef.current = wsUrl;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[Ring ${ringId}] Connected to ${wsUrl}`);
      setStatus(p => ({ ...p, connected: true }));
    };

    ws.onclose = () => {
      console.log(`[Ring ${ringId}] Disconnected`);
      setStatus(p => ({ ...p, connected: false, packetRate: 0 }));
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws && urlRef.current === wsUrl) {
          connect(ringId, wsUrl);
        }
      }, 3000);
    };

    ws.onerror = () => {
      // onerror always followed by onclose, no need to handle separately
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string);

        // Skip non-IMU event messages
        if (typeof data.ax !== 'number') return;

        const packet = data as IMUPacket;
        const now = Date.now();
        const lastRecv = ringId === 1 ? lastRecv1 : lastRecv2;
        // Inter-packet time: how long since the previous packet arrived.
        // For a 100 Hz stream this should be ~10 ms when healthy.
        const interPacketMs = lastRecv.current > 0 ? now - lastRecv.current : 0;
        lastRecv.current = now;

        const mag = Math.max(0,
          Math.sqrt(packet.ax ** 2 + packet.ay ** 2 + packet.az ** 2) - 1
        );

        pktCount.current++;

        setStatus(prev => {
          const magnitudeHistory = [...prev.magnitudeHistory.slice(1), mag];
          const latencyHistory   = [...prev.latencyHistory.slice(1), interPacketMs];
          return {
            ...prev,
            latencyMs: interPacketMs,
            latencyHistory,
            lastMagnitude: mag,
            magnitudeHistory,
            lastGyro: { gx: packet.gx, gy: packet.gy, gz: packet.gz },
          };
        });

        // Fire raw packet callback for 3D scene (continuous gyro data)
        packetCallback.current?.(ringId, packet);

        engine.process(packet);
      } catch {
        // non-JSON or malformed packet — ignore
      }
    };
  }, []);

  const disconnect = useCallback((ringId: 1 | 2) => {
    const wsRef   = ringId === 1 ? ws1 : ws2;
    const urlRef  = ringId === 1 ? url1 : url2;
    urlRef.current = '';
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const sendCommand = useCallback((ringId: 1 | 2, cmd: string) => {
    const wsRef = ringId === 1 ? ws1 : ws2;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd);
    }
  }, []);

  const onGesture = useCallback((cb: RingEventCallback) => {
    gestureCallback.current = cb;
  }, []);

  // Register a callback that fires on every raw packet (for 3D gyro rotation)
  const onPacket = useCallback((cb: RingPacketCallback) => {
    packetCallback.current = cb;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ws1.current?.close();
      ws2.current?.close();
    };
  }, []);

  return { ring1, ring2, connect, disconnect, sendCommand, onGesture, onPacket };
}
