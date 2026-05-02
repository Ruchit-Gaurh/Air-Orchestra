# Air Orchestra 🎶

Air Orchestra is a high-fidelity, gestural musical instrument that allows you to play a full 3D drum kit, a classical tabla, or strum a virtual guitar completely in the air using ESP32-powered wearable rings.

## Features

- **Full 3D Stage**: An immersive, full-screen 3D performance stage built with `react-three-fiber`.
- **Multiple Instruments**: 
  - **Drums**: Play a 4-piece kit (Kick, Snare, Hi-hat, Crash). The physics engine intelligently maps your arm motions (downward drop, wrist snap, forward jab) to the correct drum.
  - **Tabla**: A custom 3D classical Indian Tabla set. Your left hand controls the bass (Bayan) and right hand controls the treble (Dayan).
  - **Guitar**: A fully modeled 3D acoustic guitar. Cycle chords with your left hand and strum with your right.
- **Ultra-Low Latency Audio**: Synthesized entirely in the browser using `Tone.js`. No audio samples to download; everything is generated in real-time.
- **Live Hardware Tracking**: Real-time HUD displaying packet rates and sub-20ms latency metrics for the ESP32 rings.

## Hardware Setup (The Rings)

The system requires two wearable rings, each equipped with an **ESP32** microcontroller and an **MPU6050** IMU (accelerometer + gyroscope).

1. Upload the firmware located in the `arduino_files` directory to your ESP32 boards.
   - `air_orchestra.ino` is for **Ring 1** (Right Hand). This acts as the WiFi Access Point and WebSocket server.
   - `ring2_air_orchestra.ino` is for **Ring 2** (Left Hand). This acts as a client that connects to Ring 1's hotspot.
2. The sensors sample motion data at 100Hz and stream it to the browser via WebSockets.

## Software Setup (The Interface)

The dashboard is built with Next.js, TailwindCSS, and Three.js.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
4. Click "Start Audio" and connect your rings to begin playing!

## Tech Stack
- **Frontend**: Next.js 14, React, TailwindCSS, Framer Motion
- **3D Engine**: Three.js, React Three Fiber, React Three Drei
- **Audio Engine**: Tone.js (Web Audio API)
- **Hardware**: C++ (Arduino Core), WebSockets, ESP32, MPU6050
