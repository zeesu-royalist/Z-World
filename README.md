# 🌆 Z-WORLD | 3D Open World GTA-Style Game Engine

An open-world action game built with **Three.js**, **WebAssembly Physics (Rapier3D)**, **TypeScript**, and **Vite**.

---

## 🚀 Quick Start

1. **Start Development Server**:
   ```bash
   npm run dev
   ```
2. Open your browser at: `http://localhost:3000`
3. Click **ENTER CITY** to lock mouse controls and explore the open world!

---

## 🎮 Game Controls

| Key / Action | In-Game Action |
| :--- | :--- |
| **W, A, S, D** | Move Character / Steer Vehicle |
| **SHIFT** | Sprint / Aircraft Speed Boost |
| **SPACE** | Jump / Vehicle Handbrake Drift |
| **F** or **E** | **Enter / Exit Vehicle** (Car, Bike, Heli, Plane, Boat) |
| **MOUSE LOOK** | Aim & Rotate Camera |
| **LEFT CLICK** | Fire Weapon / Punch Combo |
| **RIGHT CLICK** | Aim Down Sights (Dynamic FOV Zoom) |
| **1 - 5 / SCROLL** | Switch Weapons (Fists, 9mm Pistol, AK-47, Shotgun, RPG) |
| **R** | Reload Weapon |
| **L** | Toggle Vehicle Headlights |
| **H** | Toggle In-Game Controls Overlay |

---

## 📁 3D Models Folder Structure (`public/`)

Jab bhi tumhare paas nayi `.glb` 3D files aayein, unhe simply neeche diye gaye folders me daal dena. Game unhe auto-detect and mount kar legi:

```
public/
├── city/
│   └── city_3d_model.glb      # ✅ Tumhara 65MB City 3D Model loaded & configured
├── cars/                      # 🚗 Yahan Cars ke .glb models daalo (e.g. sports_car.glb, lambo.glb)
├── bikes/                     # 🏍️ Yahan Motorcycles/Bikes ke .glb models daalo (e.g. bati801.glb)
├── aircraft/                  # 🚁 Yahan Helicopters & Planes ke .glb models daalo
├── boats/                     # 🚤 Yahan Speedboats & Yachts ke .glb models daalo
├── characters/                # 🧍 Yahan Player & NPC characters ke .glb models daalo
├── weapons/                   # 🔫 Yahan Guns & Melee weapons ke .glb models daalo
├── audio/                     # 🎵 Sound effects & Radio stations
└── textures/                  # 🖼️ Custom textures, environment maps, particle textures
```

---

## ⚡ Tech Stack & Architecture

- **Engine**: Three.js (r174) with PBR Materials, ACES Filmic Tone Mapping, Soft Shadow Maps, and Dynamic Sky Dome.
- **Physics**: `@dimforge/rapier3d-compat` (Fast WebAssembly Physics Engine) with Trimesh colliders, Kinematic Character Controllers, and RigidBody vehicle dynamics.
- **Vehicles Included**:
  1. **Sports Car** (4-wheel drive, steering angles, suspension, drift, headlights)
  2. **Motorcycle** (Dynamic banking lean physics, high acceleration)
  3. **Helicopter** (Spinning main & tail rotors, vertical lift/descent, pitch & roll)
  4. **Airplane** (Aerodynamic airspeed, wing lift, pitch & rudder controls)
  5. **Boat** (Water buoyancy simulation, rudder steering)
- **Combat & Weapons**:
  - Raycast shooting with dynamic bullet tracer trails & spark particles on impact
  - Muzzle flashes & recoil
  - Weapon slots: Fists, 9mm Pistol, AK-47 Rifle
- **GTA HUD**:
  - Top-Right: Cash counter (`$250,000`) & Wanted Stars (`★ ★ ★ ★ ★`)
  - Bottom-Left: Circular Radar / Minimap with real-time blips for player and all vehicles
  - Bottom-Center: Health bar, Armor bar, and Speedometer (KM/H)
  - Center: Dynamic Crosshair & Vehicle Interaction Prompts (`[F] Drive Vehicle`)
