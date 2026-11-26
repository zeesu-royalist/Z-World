# 📦 3D Models (.glb) Integration Guide

Jab tumhare paas naye `.glb` models aayein, unhe use karne ka simple guide:

### 1. 🚗 Cars (`public/cars/`)
- Apni car file ko `public/cars/` me save karo, jaise `public/cars/car.glb`.
- Car model me separate wheels hon to wheels rotate aur steer ho sakte hain.

### 2. 🏍️ Bikes (`public/bikes/`)
- Apni motorcycle/bike file ko `public/bikes/` me save karo, jaise `public/bikes/bike.glb`.

### 3. 🚁 Helicopters & ✈️ Planes (`public/aircraft/`)
- `public/aircraft/chopper.glb` ya `public/aircraft/plane.glb`.
- Rotors ya propellers separate meshes hon to code unhe automatically spin karwayega.

### 4. 🚤 Boats (`public/boats/`)
- Speedboat ya yacht file ko `public/boats/boat.glb` me daalo.

### 5. 🧍 Character Models (`public/characters/`)
- Rigged humanoid character with skeleton daalne ke liye: `public/characters/player.glb`.
- Agar model me animations hain (Idle, Walk, Run), to game ka `AnimationMixer` automatically unhe play karega.

### 6. 🔫 Weapons (`public/weapons/`)
- Guns jaise `pistol.glb`, `ak47.glb`, `shotgun.glb`, `sniper.glb` ko `public/weapons/` me daalo.
