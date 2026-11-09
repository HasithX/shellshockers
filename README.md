# Shell Shockers Aimbot & ESP (ST v3.4)

A modern, high-performance userscript for [Shell Shockers](https://shellshock.io/) built for Violentmonkey and Tampermonkey.

## 🚀 Features
- **Instant 7-Gun Switcher (v3.4 Upgrade):**
  - `Mouse Wheel Weapon Cycle`: Scroll your mouse wheel up or down anywhere (on the spawn screen, weapon dialog, or in-game) to cycle smoothly through all 7 weapons.
  - `Number Keys 1 to 7`: Press keys `1` through `7` to instantly equip any specific gun:
    - **1:** EggK-47 (Assault Rifle)
    - **2:** Scrambler (Shotgun)
    - **3:** Free Ranger (Semi-Auto Sniper)
    - **4:** RPEGG (Rocket Launcher)
    - **5:** Whipper (SMG)
    - **6:** Crackshot (Bolt-Action Sniper)
    - **7:** Tri-Hard (3-Burst Rifle)
  - `Menu Dropdown Selector`: Choose your active weapon directly from the Combat tab in the cheat menu.
  - `Synchronized Weapon Selection`: Interacts directly with Shell Shockers' `extern.changeClass` engine API, Vue state, and the "CHANGE YOUR WEAPON?" DOM buttons with real-time selection highlight.
- **Auto-Respawn Cursor Fix & Quality-of-Life:**
  - `Spacious 3D Pill Navbar`: Redesigned 330px wide UI with distinct glowing pill navigation tabs, clear active/hover highlights, and spacious option padding.
  - `Sniper Zoom (Toggle & Hold)`: Upgraded zoom logic that activates instantly on `KeyC` (configurable), supporting both single-click Toggle and Hold actions.
  - `Continuous Auto-Escape`: Fixed recovery lockout hysteresis so auto-escape triggers reliably on every low-HP encounter without getting stuck.
- **Tactical Innovations:**
  - `💣 Grenade Arc Trajectory Predictor`: Real-time 3D physics parabolic curve predicting the exact flight path, gravity drop, and landing/impact spot before throwing grenades.
  - `🔭 Sniper Zoom (Binoculars Mode)`: Smoothly zooms camera FOV down to 25° for high-powered reconnaissance and distant target tracking.
  - `📊 On-Screen Session Stats Widget (HUD)`: Glassmorphic Cyber Blue top-left corner widget displaying real-time **FPS Counter**, **Killstreak (with 🔥 fire aura)**, **Total Kills**, **Deaths**, and **K/D Ratio**, plus instant kill-confirmed notifications.
- **Cyber Blue Modern Menu:**
  - Futuristic **Cyber Blue / Azure Neon** glassmorphic interface with vibrant gradients, custom tabs, interactive buttons, and high-visibility status indicators.
  - Floating circular **ST** quick-access badge with hover animations.
- **Advanced Shoot Point & Tactical HUD:**
  - `Center Shoot Point Reticle`: High-precision glowing crosshair dot and focus reticle that never disappears or goes missing.
  - `Reticle Styles`: Choose between **Cyber HUD**, **Crosshair**, **Glowing Dot**, or **Circle Reticle**.
  - `Dynamic Tactical Shifting`: Reticle and FOV circle dynamically shift colors in real time (Cyan = Idle, Gold = Target locked, Red = In fire cone).
  - `Enhanced FOV Ring`: Neon glowing border with 4 tactical quadrant tick marks and drop-shadow contrast.
- **Auto-Fire:** Pure triggerbot with FOV cone gating, delay pacing, and watchdog protection. Automatically fires when an enemy enters your sights.
- **Auto Escape & Safe Points:**
  - `Sustained Position & Mirror Sync`: Overwrites coordinates (`H.x`, `H.y`, `H.z`), Wasm physics vectors (`H.coords`), mesh transform, and lerp targets continuously over a configurable window (`teleportMs`, default 800 ms).
  - `Smart Point Navigation`: `G` saves current position; `H` teleports back to nearest saved point without accidentally targeting the spot you are currently standing on.
  - `Auto Escape`: When HP drops below threshold, raycasts 12 candidate spots around player with non-pickable floor detection, evaluates line-of-sight against all enemies within 45m, and escapes to safety.
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
👉 **[Install ST v3.4](https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js)**

The extension will pop up with an **Install** or **Update** button. Click it, then refresh Shell Shockers.

### Manual Update
1. Open your browser's **Violentmonkey** or **Tampermonkey** dashboard.
2. Click **Edit** on your existing Shell Shockers userscript.
3. Replace the entire code with the contents of [lm.user.js](https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js).
4. Save and reload `https://shellshock.io/`.

## 🎮 Controls
- **Change Gun:** Scroll **Mouse Wheel** OR press **`1` - `7`**
  - `1`: EggK-47 | `2`: Scrambler | `3`: Free Ranger | `4`: RPEGG | `5`: Whipper | `6`: Crackshot | `7`: Tri-Hard
- **Sniper Zoom (Binoculars):** Click or hold `C` (configurable in Combat tab)
- **Open / Close Menu:** `~` (Tilde / Backquote) or `Insert` (or click the bottom-left `ST` button)
- **Aim Key:** Hold `Right Mouse Button` (Mouse2)
- **Save Safe Point:** `G`
- **Teleport to Nearest Safe Point:** `H`

## Author
- **hasithx**

## License
GPL-3.0
