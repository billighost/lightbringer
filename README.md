# Lightbringer - Graybox Prototype & Third-Person Controller

Minimal 3D playable graybox prototype built with Vite, TypeScript, Three.js, and Rapier Physics (`@dimforge/rapier3d-compat`).

## Features
- **Kinematic Character Controller**: Built on Rapier's `KinematicCharacterController` featuring smooth autostep for stairs, slope sliding and angle clamping, and edge detection.
- **Responsive Movement**: Camera-relative WASD movement, acceleration and deceleration curves, walk/sprint speed transition, Space jump with coyote time and jump buffer.
- **Third-Person Over-the-Shoulder Camera**: Orbiting camera with pitch/yaw control, customizable shoulder offset, mouse-wheel zoom, damping, and raycast obstacle collision prevention.
- **Modular Visual Rig**: Clean separation between physics capsule body and visual presentation with `setModel(object3d)` for drop-in GLB character replacement. Includes a dark silhouette mesh with facing direction indicator and staff.
- **Test World Graybox**:
  - Procedural grid floor for instant spatial scale verification.
  - Gentle staircase (~0.20m riser).
  - Steeper staircase (~0.30m riser).
  - Smooth ramp / slope.
  - Raised platform with a jumpable gap and drop-off ledge.
  - Obstacle blocks (low curbs, waist-high cover, tall walls, cylinders, spheres).
- **Isolated Lighting Module**: Directional sun with soft shadows tracking player coordinates, bright sky, light fog, and hemisphere ambient light (configured for easy replacement).
- **Debug & Diagnostics Panel (`F1`)**:
  - Real-time FPS & frame time monitor (`stats.js`).
  - Live player diagnostics (coordinates, grounded state, speed).
  - Live tuning sliders for movement, autostep, slopes, camera offsets, and sun angle/intensity/color.
  - Rapier collider wireframe visualizer.
  - World boundary respawn trigger ($Y < -30$).

## Setup & Running

### Requirements
- Node.js 18+ (tested on Node v24)
- Modern desktop browser (Chrome, Edge)

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

## Controls
| Action | Key / Input |
|---|---|
| Enter Viewport | Click anywhere on screen |
| Movement | `W`, `A`, `S`, `D` / Arrow Keys |
| Sprint | Hold `Left Shift` or `Right Shift` |
| Jump | `Space` |
| Camera Orbit | Mouse movement (while pointer locked) |
| Camera Zoom | Mouse wheel |
| Debug Panel | `F1` |
| Release Cursor | `Esc` |
