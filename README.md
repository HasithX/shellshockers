# Shell Shockers Aimbot & ESP (ST v3.0)

A modern, high-performance userscript for [Shell Shockers](https://shellshock.io/) built for Violentmonkey and Tampermonkey.

## 🚀 Features
- **Cyber Blue Modern Menu (v3.0 Upgrade):**
  - Rebranded from legacy LM to **ST v3.0**.
  - Complete overhaul to a futuristic **Cyber Blue / Azure Neon** glassmorphic interface with vibrant gradients, custom tabs, interactive buttons, and high-visibility status indicators.
  - Floating circular **ST** quick-access badge with hover animations.
- **Advanced Shoot Point & Tactical HUD:**
  - `Center Shoot Point Reticle`: High-precision glowing crosshair dot and focus reticle that never disappears or goes missing.
  - `Reticle Styles`: Choose between **Cyber HUD**, **Crosshair**, **Glowing Dot**, or **Circle Reticle**.
  - `Dynamic Tactical Shifting`: Reticle and FOV circle dynamically shift colors in real time:
    - *Cyan Neon / Chosen Color*: Idle / Scanning state.
    - *Electric Gold*: Instant visual lock when an enemy enters your aimbot FOV cone.
    - *Crimson Red*: Locked in auto-fire cone or shooting with subtle pulse animation.
  - `Enhanced FOV Ring`: Neon glowing border with 4 tactical quadrant tick marks and drop-shadow contrast, preventing it from vanishing on bright sky or white egg textures.
- **Auto-Fire:** Pure triggerbot with FOV cone gating, delay pacing, and watchdog protection. Automatically fires when an enemy enters your sights.
- **Auto Escape & Safe Points:**
  - `Sustained Position & Mirror Sync`: Overwrites coordinates (`H.x`, `H.y`, `H.z`), Wasm physics vectors (`H.coords`), mesh transform, and lerp targets continuously over a configurable window (`teleportMs`, default 800 ms).
  - `Smart Point Navigation`: `G` saves current position; `H` teleports back to nearest saved point without accidentally targeting the spot you are currently standing on.
  - `Auto Escape`: When HP drops below threshold, raycasts 12 candidate spots around player with non-pickable floor detection, evaluates line-of-sight against all enemies within 45m, and escapes to safety.
  - `Test & Diagnostics`: One-click `TP +10m X` and `TP +10m Z` buttons in the Escape tab to test displacement.
  - `Live Status Bar Telemetry`: Real-time `esc` state readout (`hp ok`, `recover`, `no enemy`, `cooldown`, `airborne`, or blocked LOS ratio).
- **Enemy Position Manipulation:**
  - `Hold position`: Freezes enemies in their current tracks client-side.
  - `Pull to front`: Relocates living enemies into a lateral arc in front of your crosshair.
  - `Aim Server`: Visual freeze while the aimbot tracks the true server hitbox for guaranteed hit registration.
- **Upgraded Aimbot & Target Tracking:**
  - **Lead Prediction:** Distance and velocity-based lead calculation to lock onto fast-moving and jumping targets.
  - **Aim Height Offset:** Configurable vertical aim level (defaults to upper chest/head instead of ground level).
  - **Sub-Pixel Precision:** Fixed negative movement truncation for smooth, reliable tracking in all directions.
  - **Target Stickiness:** Smooth lock without jitter between multiple close targets.
- **Auto Bunny-Hop:** Automatic continuous hopping (`Auto jump`) to maintain maximum speed across maps.
- **ESP & Tracers:** 3D enemy bounding boxes, line tracers, player name labels, distance readout, and health indicators.
- **Visuals:** Custom FOV aim circle, Shoot Point reticle, and camera zoom / wide-angle FOV adjuster (`camFov`).
- **Weapon & Health:** Infinite ammo toggle, custom ammo count, and client health lock.
- **Modern Tabbed Menu:** Clean in-game UI with categorized tabs (`Combat`, `Escape`, `Enemies`, `Visuals`, `Misc`, `Config`), drag-and-drop, and close button.

## 📥 Installation & Updating

### 1-Click Install / Update
If you have **Violentmonkey** or **Tampermonkey** installed, open this link in your browser:
👉 **[Install ST v3.0](https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js)**

The extension will pop up with an **Install** or **Update** button. Click it, then refresh Shell Shockers.

### Manual Update
1. Open your browser's **Violentmonkey** or **Tampermonkey** dashboard.
2. Click **Edit** on your existing Shell Shockers userscript.
3. Replace the entire code with the contents of [lm.user.js](https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js).
4. Save and reload `https://shellshock.io/`.

## 🎮 Controls
- **Open / Close Menu:** `~` (Tilde / Backquote) or `Insert` (or click the bottom-left `ST` button)
- **Aim Key:** Hold `Right Mouse Button` (Mouse2)
- **Save Safe Point:** `G`
- **Teleport to Nearest Safe Point:** `H`

## Author
- **hasithx**

## License
GPL-3.0
