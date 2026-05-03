<div align="center">

# 🎶 Air Orchestra

### *Play music in the air — no instrument required.*

**An immersive gestural music platform powered by ESP32 wearable rings and a real-time 3D browser stage.**

<br/>

[![Dev Summit 2026](https://img.shields.io/badge/Dev%20Summit%202026-🏆%204th%20Place-gold?style=for-the-badge&logo=trophy)](https://github.com/Ruchit-Gaurh/Air-Orchestra)
[![Built in 24h](https://img.shields.io/badge/Built%20in-24%20Hours-ff6b6b?style=for-the-badge&logo=clockify&logoColor=white)](https://github.com/Ruchit-Gaurh/Air-Orchestra)
[![Hackathon](https://img.shields.io/badge/Hackathon-2026-blueviolet?style=for-the-badge&logo=devpost&logoColor=white)](https://github.com/Ruchit-Gaurh/Air-Orchestra)

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r184-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tone.js](https://img.shields.io/badge/Tone.js-15-FF4088?style=flat-square)](https://tonejs.github.io/)
[![Arduino](https://img.shields.io/badge/Arduino-ESP32-00979D?style=flat-square&logo=arduino&logoColor=white)](https://www.arduino.cc/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## 🌟 What is Air Orchestra?

Air Orchestra is a high-fidelity, **gestural musical instrument** that lets you play a full 3D drum kit, a classical Indian Tabla, or strum a virtual guitar — **completely in the air**, using two ESP32-powered wearable smart rings. Motion data from the rings is streamed at **100 Hz** to an immersive browser-based 3D stage where your gestures are mapped to real-time synthesised sound with **sub-20ms latency**.

> 🏆 **Built in 24 hours** at the **Dev Summit 2026 Hackathon** — *4th place finish!*

---

## 🖼️ Screenshots

<div align="center">
<table>
  <tr>
    <td align="center"><b>🥁 Drum Kit Mode</b></td>
    <td align="center"><b>🪘 Tabla Mode</b></td>
    <td align="center"><b>🎸 Guitar Mode</b></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/drums.png" alt="Drum Kit Mode" width="280"/></td>
    <td><img src="public/screenshots/tabla.png" alt="Tabla Mode" width="280"/></td>
    <td><img src="public/screenshots/guitar.png" alt="Guitar Mode" width="280"/></td>
  </tr>
</table>
</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎭 **Full 3D Stage** | Immersive full-screen 3D performance stage built with React Three Fiber |
| 🥁 **Drum Kit** | 4-piece kit (Kick, Snare, Hi-Hat, Crash) — mapped to natural arm motions |
| 🪘 **Tabla** | Classical Indian Tabla set; left hand = Bayan (bass), right = Dayan (treble) |
| 🎸 **Guitar** | Fully modelled 3D acoustic guitar; cycle chords with one hand, strum with the other |
| ⚡ **Ultra-Low Latency** | All audio synthesised in the browser via Tone.js — no sample downloads |
| 📡 **Live HUD** | Real-time packet rate & latency metrics per ring displayed on-screen |
| 🔄 **Auto-Demo** | Idle animation plays automatically when no rings are connected |

---

## 🕹️ Gesture Guide

### Drums
| Gesture | Motion | Drum Hit |
|---|---|---|
| ⬇ Drop arm | Downward swing | **Kick** |
| ↔ Wrist snap | Lateral flick | **Snare** |
| → Punch forward | Forward jab | **Hi-Hat** |
| ⚡ 3.5g+ slam | Any high-G impact | **💥 Crash** |

### Guitar
| Hand | Gesture | Action |
|---|---|---|
| Right (Ring 2) | Tap | Cycle through chords (C → G → Am → F → Em → D) |
| Left (Ring 1) | Strum | Play current chord (up or down strum) |

### Tabla
| Hand | Ring | Voice |
|---|---|---|
| Left | Ring 1 | Bayan — deep bass resonance |
| Right | Ring 2 | Dayan — sharp treble strike |

---

## 🔧 Hardware Setup (The Rings)

The system requires **two wearable rings**, each with an **ESP32** microcontroller and an **MPU6050** IMU (6-axis accelerometer + gyroscope).

```
┌─────────────────────────────────────────────────────────┐
│                    RING ARCHITECTURE                    │
│                                                         │
│  Ring 1 (Right Hand)          Ring 2 (Left Hand)        │
│  ┌─────────────────┐          ┌─────────────────┐       │
│  │ ESP32 + MPU6050 │◄────────►│ ESP32 + MPU6050 │       │
│  │ WiFi AP + WS    │  WiFi    │ WiFi Client     │       │
│  │ Server :81      │          │ → Ring 1        │       │
│  └────────┬────────┘          └─────────────────┘       │
│           │ WebSocket                                    │
│           ▼                                             │
│     Browser (Next.js)                                   │
└─────────────────────────────────────────────────────────┘
```

### Firmware Upload

1. Open the `arduino_files/` directory.
2. Flash **`air_orchestra.ino`** to **Ring 1** (Right Hand)
   - Acts as the **WiFi Access Point** and **WebSocket server** on port `81`.
3. Flash **`ring2_air_orchestra.ino`** to **Ring 2** (Left Hand)
   - Acts as a **WiFi client** that connects to Ring 1's hotspot.

> **Sensors sample motion at 100 Hz** and stream packets to the browser via WebSockets.

### Default WiFi Credentials

| Field | Value |
|---|---|
| SSID | `AirOrchestra` |
| Password | `drums2024` |
| Ring 1 WS | `ws://ring1.local:81` |
| Ring 2 WS | `ws://ring2.local:81` |

---

## 💻 Software Setup

### Prerequisites

- Node.js **18+**
- npm **9+**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Ruchit-Gaurh/Air-Orchestra.git
cd Air-Orchestra

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Quick Start

1. Click **"Start Audio"** to initialise the Web Audio engine.
2. Enter the WebSocket URL for each ring in the side panels.
3. Click **"Go"** to connect.
4. Put on your rings and start playing! 🎶

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org/) | 16.x | React framework & SSR |
| [React](https://react.dev/) | 19.x | UI layer |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Type safety |
| [TailwindCSS](https://tailwindcss.com/) | 4.x | Styling |

### 3D Engine
| Technology | Version | Purpose |
|---|---|---|
| [Three.js](https://threejs.org/) | r184 | 3D rendering |
| [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) | 9.x | React bindings for Three.js |
| [React Three Drei](https://github.com/pmndrs/drei) | 10.x | Helper components |
| [React Three Postprocessing](https://github.com/pmndrs/react-postprocessing) | 3.x | Visual effects |

### Audio Engine
| Technology | Version | Purpose |
|---|---|---|
| [Tone.js](https://tonejs.github.io/) | 15.x | Web Audio synthesis |

### Hardware / Firmware
| Technology | Purpose |
|---|---|
| ESP32 | Microcontroller for each ring |
| MPU6050 | 6-axis IMU (accel + gyro) |
| Arduino C++ | Ring firmware |
| WebSockets | Real-time data streaming to browser |

---

## 📁 Project Structure

```
Air-Orchestra/
├── app/
│   ├── components/
│   │   ├── DrumstickScene.tsx   # Full 3D stage (drums, tabla, guitar)
│   │   ├── DrumGuide.tsx        # Gesture guide overlay
│   │   └── LatencyMeter.tsx     # Real-time latency HUD
│   ├── page.tsx                 # Main application entry point
│   ├── layout.tsx               # App layout
│   └── globals.css              # Global styles
├── hooks/
│   └── useRings.ts              # WebSocket ring connection hook
├── lib/
│   ├── gesture-engine.ts        # IMU → gesture classification
│   └── sound-engine.ts          # Tone.js audio synthesis
├── arduino_files/
│   ├── air_orchestra.ino        # Ring 1 firmware (AP + WS server)
│   └── ring2_air_orchestra.ino  # Ring 2 firmware (WiFi client)
└── public/                      # Static assets
```

---

## 🏆 Hackathon

Air Orchestra was built in **24 hours** for the **Dev Summit 2026 Hackathon** and earned **4th place** overall.

The core challenge: design and build a complete hardware-software system — from soldering ESP32 rings to a full real-time 3D audio engine in the browser — in a single day.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ and very little sleep at **Dev Summit 2026**

⭐ Star this repo if you found it interesting!

</div>
