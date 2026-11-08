# Shell Shockers Aimbot & ESP (LM v2.8)

A modern, high-performance userscript for [Shell Shockers](https://shellshock.io/) built for Violentmonkey and Tampermonkey.

## 🚀 Features
- **Auto-Fire:** Pure triggerbot with FOV cone gating, delay pacing, and watchdog protection. Automatically fires when an enemy enters your sights.
- **Auto Escape & Safe Points:**
  - `Auto Escape`: When HP drops below threshold, raycasts 12 candidate points around the player, picks the spot blocking line-of-sight to the most enemies, and relocates to cover.
  - `Manual Safe Points`: Save safe positions (`KeyG`) to `localStorage` and teleport back (`KeyH`) with directional input velocity assist.
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
- **Visuals:** Custom FOV aim circle and camera zoom / wide-angle FOV adjuster (`camFov`).
- **Weapon & Health:** Infinite ammo toggle, custom ammo count, and client health lock.
- **Modern Tabbed Menu:** Clean in-game UI with categorized tabs (`Combat`, `Escape`, `Enemies`, `Visuals`, `Misc`, `Config`), drag-and-drop, and close button.

## 📥 Installation & Updating

### 1-Click Install / Update
If you have **Violentmonkey** or **Tampermonkey** installed, open this link in your browser:
👉 **[Install LM v2.8](https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js)**

The extension will pop up with an **Install** or **Update** button. Click it, then refresh Shell Shockers.

### Manual Update
1. Open your browser's **Violentmonkey** or **Tampermonkey** dashboard.
2. Click **Edit** on your existing Shell Shockers userscript.
3. Replace the entire code with the contents of [lm.user.js](https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js).
4. Save and reload `https://shellshock.io/`.

## 🎮 Controls
- **Open / Close Menu:** `~` (Tilde / Backquote) or `Insert` (or click the bottom-left `LM` button)
- **Aim Key:** Hold `Right Mouse Button` (Mouse2)
- **Save Safe Point:** `G`
- **Teleport to Nearest Safe Point:** `H`

## Author
- **hasithx**

## License
GPL-3.0


