// ==UserScript==
// @name         Shell Shockers Aimbot + ESP (ST v3.1)
// @namespace    https://github.com/hasithx/shellshockers/
// @license      GPL-3.0
// @version      3.1.0
// @author       hasithx
// @description  ESP, tracers, auto-fire, FOV aimbot, advance shoot point, tactical HUD, auto-escape, safe points, enemy freeze/pull, infinite ammo, grenade trajectory, sniper zoom, stats HUD, modern cyber blue GUI
// @match        https://shellshock.io/*
// @match        https://shellshockers.io/*
// @match        https://geometry.best/*
// @match        https://www.shellshock.io/*
// @grant        unsafeWindow
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/babylonjs@7.15.0/babylon.min.js
// @downloadURL  https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js
// @updateURL    https://raw.githubusercontent.com/HasithX/shellshockers/main/lm.user.js
// ==/UserScript==

(function () {
    const DEG = Math.PI / 180;

    const oldConsoleLog = console.log;
    const log = function (...args) {
        oldConsoleLog.apply(console, [
            "%c%s",
            `color: #ffffff; font-weight: bold; background: linear-gradient(90deg, #0077b6, #00b4d8); padding: 2px 8px; border-radius: 4px; margin-right: 6px;`,
            `ST`,
            ...args
        ]);
    };

    // ================= SETTINGS =================
    const DEF = {
        enabled: true,
        aimMode: 'hold',
        aimKeys: ['Mouse2'],
        aimToggleKey: 'KeyX',
        aimFov: 70,
        smooth: 1.0,
        targetMode: 'crosshair',
        teamCheck: true,
        autoFire: false,
        autoFireOnlyAiming: false,
        autoFireDelay: 30,
        autoFireFov: 3.5,
        autoFireWhenMenuOpen: false,
        freezeEnemies: false,
        freezeMode: 'hold',
        pullDistance: 8,
        autoEscape: false,
        escapeHp: 35,
        escapeRadius: 7,
        teleportMs: 800,
        savePointKey: 'KeyG',
        gotoPointKey: 'KeyH',
        prediction: true,
        aimHeight: 0.35,
        autoJump: false,
        espBox: true,
        espTracer: true,
        espName: true,
        espHealth: true,
        espDistance: true,
        espTeammates: false,
        highlightClosest: true,
        boxColor: '#ffffff',
        tracerColor: '#ffffff',
        closestColor: '#ff2222',
        camFov: 0,
        fovCircle: true,
        shootPoint: true,
        shootPointStyle: 'cyber',
        fovColor: '#00f0ff',
        fovDynamicColor: true,
        grenadeTrajectory: true,
        sniperZoom: true,
        zoomKey: 'KeyC',
        zoomFov: 25,
        statsHud: true,
        hideOwnBody: false,
        hideOwnGun: false,
        infiniteAmmo: false,
        holdHealth: false,
        ammoValue: 999,
        panelKeys: ['Insert', 'Backquote'],
        activeTab: 'combat'
    };
    const S = Object.assign({}, DEF, (() => {
        try {
            return JSON.parse(localStorage.getItem('st_cfg_v3') || localStorage.getItem('lm_cfg_v2') || '{}');
        } catch (e) { return {}; }
    })());
    if (!Array.isArray(S.panelKeys)) S.panelKeys = DEF.panelKeys.slice();
    const save = () => {
        try {
            localStorage.setItem('st_cfg_v3', JSON.stringify(S));
            localStorage.setItem('lm_cfg_v2', JSON.stringify(S));
        } catch (e) { }
    };

    // ================= INPUT =================
    const keys = new Set();
    let mouse2 = false, aimToggled = false, firing = false;
    let lastShotAt = 0, burstStartAt = 0;
    let statusEl = null;

    const isTyping = () => {
        const a = document.activeElement;
        return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    };

    const onMouseDownUI = e => { if (e.button === 2) mouse2 = true; };
    const onMouseUpUI = e => { if (e.button === 2) mouse2 = false; };
    const onMouseMoveUI = e => {
        if (typeof e.buttons === 'number' && (e.buttons & 2) === 0) mouse2 = false;
    };
    onMouseDownUI.__lmUI = true; onMouseUpUI.__lmUI = true; onMouseMoveUI.__lmUI = true;
    document.addEventListener('mousedown', onMouseDownUI, true);
    document.addEventListener('mouseup', onMouseUpUI, true);
    document.addEventListener('mousemove', onMouseMoveUI, true);
    document.addEventListener('pointermove', onMouseMoveUI, true);

    const onKeyDownUI = e => {
        const panelKey = S.panelKeys.includes(e.code) || (e.ctrlKey && e.shiftKey && e.code === 'KeyL');
        if (panelKey) {
            e.preventDefault(); e.stopPropagation();
            if (isTyping()) document.activeElement.blur();
            togglePanel();
            return;
        }
        if (isTyping()) return;
        if (e.code === (S.savePointKey || 'KeyG')) {
            saveCurrentPoint();
            return;
        }
        if (e.code === (S.gotoPointKey || 'KeyH')) {
            gotoNearestPoint();
            return;
        }
        keys.add(e.code);
        if (e.code === S.aimToggleKey && S.aimMode === 'toggle') aimToggled = !aimToggled;
    };
    onKeyDownUI.__lmUI = true;
    document.addEventListener('keydown', onKeyDownUI, true);

    const onKeyUpUI = e => keys.delete(e.code);
    onKeyUpUI.__lmUI = true;
    document.addEventListener('keyup', onKeyUpUI, true);

    const onBlurUI = () => { keys.clear(); mouse2 = false; };
    onBlurUI.__lmUI = true;
    window.addEventListener('blur', onBlurUI);

    const aiming = () => {
        if (!S.enabled) return false;
        if (S.aimMode === 'always') return true;
        if (S.aimMode === 'toggle') return aimToggled;
        return mouse2 || S.aimKeys.some(k => keys.has(k));
    };

    // ================= FIRE =================
    const fireDown = [];
    const fireUp = [];

    function makeFakeEvent(type, down, extra = {}) {
        const base = Object.assign({
            type, button: 0, buttons: down ? 1 : 0,
            clientX: Math.round(innerWidth / 2), clientY: Math.round(innerHeight / 2),
            movementX: 0, movementY: 0, pointerId: 1, pointerType: 'mouse',
            isPrimary: true, isTrusted: true, bubbles: true, cancelable: true,
            defaultPrevented: false, timeStamp: performance.now(),
            pressure: down ? 0.5 : 0, width: 1, height: 1, detail: down ? 1 : 0, which: 1,
            altKey: false, ctrlKey: false, shiftKey: false, metaKey: false
        }, extra);
        return new Proxy(base, {
            get(t, k) {
                if (k in t) return t[k];
                if (k === 'preventDefault' || k === 'stopPropagation' || k === 'stopImmediatePropagation') return () => { };
                if (k === 'getModifierState') return () => false;
                if (k === 'composedPath') return () => [];
                return undefined;
            }
        });
    }

    let resolvedShootingKey = null;
    function getShootingKey(me) {
        if (resolvedShootingKey) return resolvedShootingKey;
        if (me) {
            if ('triggerPulled' in me) {
                resolvedShootingKey = 'triggerPulled';
            } else if (H && H.shooting && (H.shooting in me)) {
                resolvedShootingKey = H.shooting;
            } else if ('shooting' in me) {
                resolvedShootingKey = 'shooting';
            } else {
                resolvedShootingKey = 'triggerPulled';
            }
        }
        return resolvedShootingKey;
    }

    function dispatchCanvasPointer(down) {
        const canvas = document.getElementById('canvas') || document.querySelector('canvas');
        const el = canvas || document.body || document.documentElement;
        const pType = down ? 'pointerdown' : 'pointerup';
        const mType = down ? 'mousedown' : 'mouseup';
        const cx = Math.round(window.innerWidth / 2);
        const cy = Math.round(window.innerHeight / 2);
        const opts = {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            detail: down ? 1 : 0,
            button: 0,
            buttons: down ? 1 : 0,
            clientX: cx,
            clientY: cy,
            screenX: cx,
            screenY: cy,
            pageX: cx,
            pageY: cy,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            pressure: down ? 0.5 : 0,
            which: 1
        };

        try {
            const pe = new PointerEvent(pType, opts);
            pe.__lmUI = true;
            el.dispatchEvent(pe);
        } catch (e) { }
        try {
            const me = new MouseEvent(mType, opts);
            me.__lmUI = true;
            el.dispatchEvent(me);
        } catch (e) { }
    }

    let releaseFramesRemaining = 0;
    let shotsFiredCount = 0;

    function isBadListener(target, fn) {
        if (!fn || fn.__lmUI) return true;
        if (!target) return true;
        if (isUIElement(target)) return true;
        return false;
    }

    function fireEvent(down) {
        try {
            if (down) {
                lastShotAt = Date.now();
                shotsFiredCount++;
                let fieldChanged = false;
                if (typeof ss !== 'undefined' && ss.MYPLAYER) {
                    const me = ss.MYPLAYER;
                    const sk = getShootingKey(me);
                    if (sk) {
                        const prev = me[sk];
                        me[sk] = true;
                        fieldChanged = prev !== true;
                    }
                    if ('shooting' in me) me.shooting = true;
                }
                dispatchCanvasPointer(true);
                let called = 0, thrown = 0;
                if (fireDown.length) {
                    const seen = new Set();
                    for (const { target, fn, type } of fireDown) {
                        if (seen.has(fn) || isBadListener(target, fn)) continue;
                        seen.add(fn);
                        try {
                            called++;
                            const ev = makeFakeEvent(type || 'pointerdown', true);
                            fn.call(target, ev);
                        } catch (e) {
                            thrown++;
                        }
                    }
                }
                log(`[AUTO-FIRE] Shot attempt: called=${called}, threw=${thrown}, fieldChanged=${fieldChanged}`);
            } else {
                if (fireUp.length) {
                    const seen = new Set();
                    for (const { target, fn, type } of fireUp) {
                        if (seen.has(fn) || isBadListener(target, fn)) continue;
                        seen.add(fn);
                        try {
                            const ev = makeFakeEvent(type || 'pointerup', false);
                            fn.call(target, ev);
                        } catch (e) { }
                    }
                }
                dispatchCanvasPointer(false);
                if (typeof ss !== 'undefined' && ss.MYPLAYER) {
                    const me = ss.MYPLAYER;
                    const sk = getShootingKey(me);
                    if (sk) me[sk] = false;
                    if ('shooting' in me) me.shooting = false;
                    if (typeof me.releaseTrigger === 'function') {
                        try { me.releaseTrigger(); } catch (e) { }
                    }
                }
            }
        } catch (e) { }
    }

    // ================= HOOKS =================
    let originalReplace = String.prototype.replace;
    String.prototype.originalReplace = function () { return originalReplace.apply(this, arguments); };

    let _apc = HTMLElement.prototype.appendChild;
    let shellshock_og = null;

    HTMLElement.prototype.appendChild = function (node) {
        if (node.tagName === 'SCRIPT' && node.innerHTML && node.innerHTML.startsWith('(()=>{')) {
            shellshock_og = node.innerHTML;
            try { window.shellshock_og = shellshock_og; unsafeWindow.shellshock_og = shellshock_og; } catch (e) { }
            try { node.innerHTML = applyLibertyMutual(node.innerHTML); } catch (e) { log('inject error', e); }
        }
        return _apc.call(this, node);
    };

    const proto = unsafeWindow.HTMLScriptElement.prototype;
    const existing = Object.getOwnPropertyDescriptor(proto, "textContent");
    const original = existing || Object.getOwnPropertyDescriptor(unsafeWindow.Node.prototype, "textContent");
    Object.defineProperty(proto, "textContent", {
        get: function () {
            const tc = original.get.call(this);
            if (tc && tc.startsWith('(()=>{') && shellshock_og) return shellshock_og;
            return tc;
        },
        set: original.set, configurable: true, enumerable: true
    });

    let gameLoaded = false;
    window.addEventListener('load', () => { gameLoaded = true; }, { once: true });

    function isUIElement(target) {
        if (!target) return false;
        if (target === badge || target === panel || target === overlay) return true;
        if (badge && badge.contains && badge.contains(target)) return true;
        if (panel && panel.contains && panel.contains(target)) return true;
        if (overlay && overlay.contains && overlay.contains(target)) return true;
        if (typeof target.closest === 'function') {
            if (target.closest('#lm-badge, #lm-panel, #lm-overlay')) return true;
        }
        return false;
    }

    let origCanvasRequestPointerLock = HTMLCanvasElement.prototype.requestPointerLock;

    function hookPointerLock() {
        if (HTMLCanvasElement.prototype.requestPointerLock && !HTMLCanvasElement.prototype.requestPointerLock.__lmHooked) {
            origCanvasRequestPointerLock = HTMLCanvasElement.prototype.requestPointerLock;
            HTMLCanvasElement.prototype.requestPointerLock = function (...args) {
                if (panel) return Promise.resolve ? Promise.resolve() : undefined;
                return origCanvasRequestPointerLock.apply(this, args);
            };
            HTMLCanvasElement.prototype.requestPointerLock.__lmHooked = true;
        }
    }

    function restorePointerLock() {
        if (HTMLCanvasElement.prototype.requestPointerLock && HTMLCanvasElement.prototype.requestPointerLock.__lmHooked) {
            HTMLCanvasElement.prototype.requestPointerLock = origCanvasRequestPointerLock;
        }
    }

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        try {
            if (listener && typeof listener === 'function' && !listener.__lmUI && !isUIElement(this)) {
                const isCanvas = this && (this.tagName === 'CANVAS' || this.nodeName === 'CANVAS' || this.id === 'canvas');
                const isGameTarget = isCanvas || (this === document) || (this === window) || (this === document.body) || (this && (this.id === 'game' || this.id === 'canvas'));
                if (type === "pointermove" && isGameTarget) {
                    if (listener.name === "real") {
                        yawpitch.realListener = listener;
                        yawpitch.realTarget = this;
                    }
                    if (!yawpitch.listener) {
                        yawpitch.listener = listener;
                        yawpitch.listenerTarget = this;
                    }
                    const ol = listener;
                    listener = function (ev) { return yawpitch.listenerHook(ev, ol); };
                    listener.__lmUI = true;
                } else if (isGameTarget) {
                    if (type === 'pointerdown' || type === 'mousedown') {
                        if (!fireDown.some(x => x.target === this && x.fn === listener)) fireDown.push({ target: this, fn: listener, type });
                    }
                    if (type === 'pointerup' || type === 'mouseup') {
                        if (!fireUp.some(x => x.target === this && x.fn === listener)) fireUp.push({ target: this, fn: listener, type });
                    }
                }
            }
        } catch (e) { }
        return originalAddEventListener.call(this, type, listener, options);
    };

    const yawpitch = {
        magicValue: 0.0025,
        listener: null,
        listenerTarget: null,
        realListener: null,
        realTarget: null,
        listenerHook: (ev, ol) => ol.call(yawpitch.listenerTarget || window, ev),
        movePointer: (mx = 0, my = 0) => {
            try { yawpitch.setMouseParams(); } catch (e) { }
            const ev = makeFakeEvent('pointermove', false, {
                movementX: Math.ceil(mx),
                movementY: Math.ceil(my),
                x: 1,
                isTrusted: true
            });
            const fn = yawpitch.realListener || yawpitch.listener;
            const tgt = yawpitch.realTarget || yawpitch.listenerTarget || window;
            if (fn) {
                try { fn.call(tgt, ev); } catch (e) { }
            }
            try { yawpitch.getAndSetYawPitch(); } catch (e) { }
        },
        getAndSetYawPitch: (viaWasm = true) => {
            if (viaWasm && typeof unsafeWindow.get_yaw_pitch === 'function') {
                const r = unsafeWindow.get_yaw_pitch();
                if (r && ss.MYPLAYER) {
                    if (H.yaw) ss.MYPLAYER[H.yaw] = r.yaw;
                    if (H.pitch) ss.MYPLAYER[H.pitch] = r.pitch;
                    if (H.coords) ss.MYPLAYER[H.coords] = r.coords;
                }
                return r;
            }
            return ss.MYPLAYER ? { yaw: ss.MYPLAYER[H.yaw], pitch: ss.MYPLAYER[H.pitch], coords: ss.MYPLAYER[H.coords] } : null;
        },
        setMouseParams: (sp = 50, inv = 0, sf = 0.9, sc = false, id = (ss.MYPLAYER && ss.MYPLAYER[H.uniqueId])) => {
            if (typeof unsafeWindow.set_mouse_params === 'function') {
                unsafeWindow.set_mouse_params(sp, inv, sf, sc, id);
            }
        },
        changeByMovement: (x = 0, y = 0) => { yawpitch.setMouseParams(); yawpitch.movePointer(x, y); },
        changeByYawPitchDiff: (y = 0, p = 0) => yawpitch.changeByMovement(y / yawpitch.magicValue, p / yawpitch.magicValue),
        radianAngleDiff: (a1 = 0, a2 = 0) => {
            const fc = 2 * Math.PI;
            a1 = (a1 % fc + fc) % fc; a2 = (a2 % fc + fc) % fc;
            let d = Math.abs(a1 - a2);
            d = Math.min(d, fc - d);
            return ((a1 - a2 + fc) % fc > Math.PI) ? -d : d;
        },
        accX: 0,
        accY: 0,
        setToYawPitch: (yaw = 0, pitch = 0) => {
            if (!ss.MYPLAYER) return;
            const curYaw = ss.MYPLAYER[H.yaw] || 0;
            const curPitch = ss.MYPLAYER[H.pitch] || 0;
            const yd = yawpitch.radianAngleDiff(curYaw, yaw);
            const pd = yawpitch.radianAngleDiff(curPitch, pitch);
            const mx = yd / yawpitch.magicValue;
            const my = pd / yawpitch.magicValue;

            yawpitch.accX += mx;
            yawpitch.accY += my;
            let moveX = Math.round(yawpitch.accX);
            let moveY = Math.round(yawpitch.accY);
            if (moveX !== 0) yawpitch.accX -= moveX;
            if (moveY !== 0) yawpitch.accY -= moveY;
            if (moveX === 0 && Math.abs(mx) > 0.05) moveX = mx > 0 ? 1 : -1;
            if (moveY === 0 && Math.abs(my) > 0.05) moveY = my > 0 ? 1 : -1;

            if (yawpitch.realListener) {
                try {
                    const ev = makeFakeEvent('pointermove', false, {
                        movementX: moveX,
                        movementY: moveY,
                        x: 1,
                        isTrusted: true
                    });
                    yawpitch.realListener.call(yawpitch.realTarget || window, ev);
                    try { yawpitch.getAndSetYawPitch(); } catch (e) { }
                    return;
                } catch (e) { }
            }

            if (yawpitch.listener) {
                try {
                    yawpitch.setMouseParams();
                    const ev = makeFakeEvent('pointermove', false, {
                        movementX: moveX,
                        movementY: moveY,
                        x: 1,
                        isTrusted: true
                    });
                    yawpitch.listener.call(yawpitch.listenerTarget || window, ev);
                    try { yawpitch.getAndSetYawPitch(); } catch (e) { }
                    return;
                } catch (e) { }
            }

            try {
                if (H.yaw) ss.MYPLAYER[H.yaw] = yaw;
                if (H.pitch) ss.MYPLAYER[H.pitch] = pitch;
            } catch (e) { }
        }
    };

    let F = [], H = {}, functionNames = [], ESPArray = [], ss = {};

    const getScrambled = () => Array.from({ length: 10 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
    const createAnonFunction = (name, func) => {
        const fn = getScrambled();
        unsafeWindow[fn] = func; F[name] = func; functionNames[name] = fn;
    };
    const findKeyWithProperty = (obj, prop) => {
        for (const k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            if (k === prop) return [k];
            if (typeof obj[k] === 'object' && obj[k] !== null && obj[k].hasOwnProperty(prop)) return k;
        }
        return null;
    };
    const fetchText = url => {
        const x = new XMLHttpRequest();
        x.open('GET', url, false); x.send();
        return x.status === 200 ? x.responseText : null;
    };

    const applyLibertyMutual = function (js) {
        let ck;
        const online = fetchText("https://raw.githubusercontent.com/StateFarmNetwork/client-keys/main/libertymutual_latest.json");
        if (online == "value_undefined" || online == null) {
            const u = prompt('Keys fetch failed. Paste keys if you have them (Discord: discord.gg/HYJG3jXVJF):', '');
            if (u) { ck = JSON.parse(u); } else { alert('No keys — game will run unmodified.'); return js; }
        } else ck = JSON.parse(online);

        H = ck.vars;
        let inj = "";
        const modifyJS = (find, rep) => {
            const before = js;
            js = js.originalReplace(find, rep);
            if (before !== js) log("%cok: " + String(rep).slice(0, 80), 'color:green');
            else log("%cFAIL: " + find, 'color:red');
        };
        for (const n in H) inj += `${n}: (()=>{try{return ${H[n]};}catch(e){return "value_undefined";}})(),`;

        modifyJS(H.SCENE + '.render', `window["${functionNames.retrieveFunctions}"]({${inj}},true)||${H.SCENE}.render`);
        modifyJS(`{if(${H.CULL})`, `{if(true)`);
        modifyJS("Not playing in iframe", "LIBERTYMUTUAL ACTIVE!");
        return js;
    };

    createAnonFunction("retrieveFunctions", vars => {
        Object.assign(ss, vars);
        try { window.ss = ss; unsafeWindow.ss = ss; window.H = H; unsafeWindow.H = H; } catch (e) { }
        F.LIBERTYMUTUAL();
    });
    createAnonFunction("setPrecision", v => Math.floor(v * 8192) / 8192);
    createAnonFunction("calculateYaw", p => F.setPrecision(Math.mod(Math.atan2(p[H.x], p[H.z]), Math.PI2)));
    createAnonFunction("calculatePitch", p => F.setPrecision(-Math.atan2(p[H.y], Math.hypot(p[H.x], p[H.z])) % 1.5));

    // ================= PHASE 0: INSTRUMENTATION =================
    function getCleanProps(obj) {
        if (!obj || typeof obj !== 'object') return {};
        const res = {};
        for (const k of Object.keys(obj)) {
            try {
                const val = obj[k];
                const t = typeof val;
                if (t === 'number' || t === 'boolean' || t === 'string') {
                    res[k] = val;
                }
            } catch (e) { }
        }
        return res;
    }

    let lastSnapshot = null;

    function ST_DUMP(targetPlayer) {
        if (targetPlayer && typeof targetPlayer === 'object') {
            console.group('%c[ST_DUMP] Player Inspection', 'color:#00e5ff;font-weight:bold');
            const P = targetPlayer;
            const actor = (H.actor && P[H.actor]) ? P[H.actor] : (P.ba || null);
            const mesh = actor ? (actor[H.mesh] || actor.mesh) : null;
            const meshPos = mesh && mesh.position ? { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z } : null;

            console.log('Player Mesh Position:', meshPos);
            console.log('P[H.coords]:', H.coords ? P[H.coords] : '(no H.coords)');

            console.group('P numeric properties (-2000 to 2000)');
            const pNums = {};
            for (const k of Object.keys(P)) {
                try {
                    const v = P[k];
                    if (typeof v === 'number' && v >= -2000 && v <= 2000 && !isNaN(v)) {
                        pNums[k] = v;
                    }
                } catch (e) { }
            }
            console.table(Object.entries(pNums).map(([key, value]) => ({ key, value })));
            console.groupEnd();

            if (actor) {
                console.group('P[H.actor] numeric properties (-2000 to 2000)');
                const aNums = {};
                for (const k of Object.keys(actor)) {
                    try {
                        const v = actor[k];
                        if (typeof v === 'number' && v >= -2000 && v <= 2000 && !isNaN(v)) {
                            aNums[k] = v;
                        }
                    } catch (e) { }
                }
                console.table(Object.entries(aNums).map(([key, value]) => ({ key, value })));
                console.groupEnd();
            }

            if (mesh) {
                console.group('Mesh numeric properties');
                const mNums = {};
                for (const k of Object.keys(mesh)) {
                    try {
                        const v = mesh[k];
                        if (typeof v === 'number' && v >= -2000 && v <= 2000 && !isNaN(v)) {
                            mNums[k] = v;
                        }
                    } catch (e) { }
                }
                console.table(Object.entries(mNums).map(([key, value]) => ({ key, value })));
                console.groupEnd();
            }

            console.group('Interpolation & Position Candidates');
            if (meshPos) {
                const candidates = [];
                const checkObj = (obj, name) => {
                    if (!obj) return;
                    for (const k of Object.keys(obj)) {
                        try {
                            const val = obj[k];
                            if (typeof val === 'number') {
                                const diffX = Math.abs(val - meshPos.x);
                                const diffY = Math.abs(val - meshPos.y);
                                const diffZ = Math.abs(val - meshPos.z);
                                if (diffX < 5 || diffY < 5 || diffZ < 5) {
                                    candidates.push({ object: name, property: k, value: val, note: `close to axis (diffs: x=${diffX.toFixed(2)}, y=${diffY.toFixed(2)}, z=${diffZ.toFixed(2)})` });
                                }
                            } else if (val && typeof val === 'object' && typeof val.x === 'number') {
                                const dist = Math.hypot(val.x - meshPos.x, (val.y || 0) - meshPos.y, (val.z || 0) - meshPos.z);
                                candidates.push({ object: name, property: k, value: `{x:${val.x.toFixed(2)}, y:${val.y?.toFixed(2)}, z:${val.z?.toFixed(2)}}`, note: `Vector3 (dist to mesh: ${dist.toFixed(2)})` });
                            }
                        } catch (e) { }
                    }
                };
                checkObj(P, 'P');
                checkObj(actor, 'P[H.actor]');
                console.table(candidates);
            }
            console.groupEnd();

            console.groupEnd();
            return;
        }

        console.group('%c[ST_DUMP] Game State Snapshot', 'color:#00e5ff;font-weight:bold');

        console.group('ss.MYPLAYER properties');
        if (typeof ss !== 'undefined' && ss.MYPLAYER) {
            const me = ss.MYPLAYER;
            const actor = (H.actor && me[H.actor]) ? me[H.actor] : (me.ba || null);
            const mesh = actor ? (actor[H.mesh] || actor.mesh) : null;
            const meshPos = mesh && mesh.position ? { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z } : null;
            console.log('ss.MYPLAYER Mesh Position:', meshPos);
            console.log('ss.MYPLAYER[H.coords]:', H.coords ? me[H.coords] : '(no H.coords)');

            const filteredProps = {};
            for (const k of Object.keys(me)) {
                try {
                    const v = me[k];
                    if (typeof v === 'boolean') {
                        filteredProps[k] = v;
                    } else if (typeof v === 'number' && v >= -2000 && v <= 2000 && !isNaN(v)) {
                        filteredProps[k] = v;
                    }
                } catch (e) { }
            }
            console.table(Object.entries(filteredProps).map(([key, value]) => ({
                key, type: typeof value, value
            })));
        } else {
            console.warn('ss.MYPLAYER is null or undefined (not in match?)');
        }
        console.groupEnd();

        console.group('ss.MYPLAYER[H.weapon] properties');
        const weaponObj = (typeof ss !== 'undefined' && ss.MYPLAYER && H.weapon && ss.MYPLAYER[H.weapon] && typeof ss.MYPLAYER[H.weapon] === 'object')
            ? ss.MYPLAYER[H.weapon] : null;
        if (weaponObj) {
            const weaponProps = getCleanProps(weaponObj);
            console.table(Object.entries(weaponProps).map(([key, value]) => ({
                key, type: typeof value, value
            })));
        } else {
            console.warn('ss.MYPLAYER[H.weapon] is not an object or not found');
        }
        console.groupEnd();

        const ammoObj = (weaponObj && weaponObj.ammo && typeof weaponObj.ammo === 'object')
            ? weaponObj.ammo
            : (typeof ss !== 'undefined' && ss.MYPLAYER && ss.MYPLAYER.weapons && ss.MYPLAYER.weapons[0] && ss.MYPLAYER.weapons[0].ammo
                ? ss.MYPLAYER.weapons[0].ammo
                : null);
        console.group('ss.MYPLAYER[H.weapon].ammo properties');
        if (ammoObj) {
            const ammoProps = getCleanProps(ammoObj);
            console.table(Object.entries(ammoProps).map(([key, value]) => ({
                key, type: typeof value, value
            })));
        } else {
            console.warn('ammo object not found on weapon');
        }
        console.groupEnd();

        console.group(`H Map Entries (Total keys: ${Object.keys(H || {}).length})`);
        const hRegex = /ammo|clip|mag|bullet|round|reserve|health|hp|life|reload|shoot|fire|weapon|scoped/i;
        const matchingH = {};
        if (H && typeof H === 'object') {
            for (const [k, v] of Object.entries(H)) {
                if (hRegex.test(k)) {
                    matchingH[k] = v;
                    console.log(`%c${k} %c-> %c${v}`, 'color:#8fd18f', 'color:#aaa', 'color:#00e5ff;font-weight:bold');
                }
            }
        }
        console.groupEnd();

        console.group(`Captured Listeners (fireDown: ${fireDown.length}, fireUp: ${fireUp.length})`);
        console.log('fireDown:', fireDown.map(e => ({
            target: (e.target && (e.target.nodeName || e.target.tagName)) || (e.target === window ? 'window' : (e.target === document ? 'document' : String(e.target))),
            type: e.type || 'pointerdown',
            fn: (e.fn && e.fn.name) || 'anonymous'
        })));
        console.log('fireUp:', fireUp.map(e => ({
            target: (e.target && (e.target.nodeName || e.target.tagName)) || (e.target === window ? 'window' : (e.target === document ? 'document' : String(e.target))),
            type: e.type || 'pointerup',
            fn: (e.fn && e.fn.name) || 'anonymous'
        })));
        console.groupEnd();

        console.groupEnd();

        lastSnapshot = {
            player: (typeof ss !== 'undefined' && ss.MYPLAYER) ? getCleanProps(ss.MYPLAYER) : {},
            weapon: weaponObj ? getCleanProps(weaponObj) : {},
            ammo: ammoObj ? getCleanProps(ammoObj) : {}
        };

        return {
            player: lastSnapshot.player,
            weapon: lastSnapshot.weapon,
            ammo: lastSnapshot.ammo,
            matchingH,
            fireDownCount: fireDown.length,
            fireUpCount: fireUp.length
        };
    }

    function ST_DUMPDIFF() {
        if (!lastSnapshot) {
            console.warn('[ST_DUMPDIFF] No baseline snapshot stored. Running LM_DUMP() first to establish baseline.');
            return LM_DUMP();
        }

        console.group('%c[ST_DUMPDIFF] State Changes Since Last Dump', 'color:#00e5ff;font-weight:bold');
        const curPlayer = (typeof ss !== 'undefined' && ss.MYPLAYER) ? getCleanProps(ss.MYPLAYER) : {};
        const weaponObj = (typeof ss !== 'undefined' && ss.MYPLAYER && H.weapon && ss.MYPLAYER[H.weapon] && typeof ss.MYPLAYER[H.weapon] === 'object')
            ? ss.MYPLAYER[H.weapon] : null;
        const curWeapon = weaponObj ? getCleanProps(weaponObj) : {};
        const ammoObj = (weaponObj && weaponObj.ammo && typeof weaponObj.ammo === 'object')
            ? weaponObj.ammo
            : (typeof ss !== 'undefined' && ss.MYPLAYER && ss.MYPLAYER.weapons && ss.MYPLAYER.weapons[0] && ss.MYPLAYER.weapons[0].ammo
                ? ss.MYPLAYER.weapons[0].ammo
                : null);
        const curAmmo = ammoObj ? getCleanProps(ammoObj) : {};

        const diffs = [];

        const allPlayerKeys = new Set([...Object.keys(lastSnapshot.player || {}), ...Object.keys(curPlayer)]);
        for (const k of allPlayerKeys) {
            const oldV = (lastSnapshot.player || {})[k];
            const newV = curPlayer[k];
            if (oldV !== newV) {
                const change = (typeof oldV === 'number' && typeof newV === 'number')
                    ? (newV > oldV ? `+${newV - oldV} (increased)` : `${newV - oldV} (decreased)`)
                    : `${oldV} -> ${newV}`;
                diffs.push({ scope: 'MYPLAYER', key: k, old: oldV, new: newV, change });
            }
        }

        const allWeaponKeys = new Set([...Object.keys(lastSnapshot.weapon || {}), ...Object.keys(curWeapon)]);
        for (const k of allWeaponKeys) {
            const oldV = (lastSnapshot.weapon || {})[k];
            const newV = curWeapon[k];
            if (oldV !== newV) {
                const change = (typeof oldV === 'number' && typeof newV === 'number')
                    ? (newV > oldV ? `+${newV - oldV} (increased)` : `${newV - oldV} (decreased)`)
                    : `${oldV} -> ${newV}`;
                diffs.push({ scope: 'WEAPON', key: k, old: oldV, new: newV, change });
            }
        }

        const allAmmoKeys = new Set([...Object.keys(lastSnapshot.ammo || {}), ...Object.keys(curAmmo)]);
        for (const k of allAmmoKeys) {
            const oldV = (lastSnapshot.ammo || {})[k];
            const newV = curAmmo[k];
            if (oldV !== newV) {
                const change = (typeof oldV === 'number' && typeof newV === 'number')
                    ? (newV > oldV ? `+${newV - oldV} (increased)` : `${newV - oldV} (decreased)`)
                    : `${oldV} -> ${newV}`;
                diffs.push({ scope: 'AMMO', key: k, old: oldV, new: newV, change });
            }
        }

        if (diffs.length > 0) {
            console.table(diffs);
        } else {
            console.log('No numeric, boolean, or string properties changed.');
        }
        console.groupEnd();

        lastSnapshot = { player: curPlayer, weapon: curWeapon, ammo: curAmmo };
        return diffs;
    }

    window.ST_DUMP = ST_DUMP;
    window.ST_DUMPDIFF = ST_DUMPDIFF;
    window.LM_DUMP = ST_DUMP;
    window.LM_DUMPDIFF = ST_DUMPDIFF;
    try {
        unsafeWindow.ST_DUMP = ST_DUMP;
        unsafeWindow.ST_DUMPDIFF = ST_DUMPDIFF;
        unsafeWindow.LM_DUMP = ST_DUMP;
        unsafeWindow.LM_DUMPDIFF = ST_DUMPDIFF;
    } catch (e) { }

    // ================= AMMO & HEALTH RESOLUTION =================
    let resolvedAmmoTarget = null;
    let resolvedAmmoKey = null;
    let resolvedReserveTarget = null;
    let resolvedReserveKey = null;
    let resolvedHealthTarget = null;
    let resolvedHealthKey = null;
    let resolvedReloadTarget = null;
    let resolvedReloadKey = null;

    let lastWeaponRef = null;
    let lastPlayerRef = null;

    let ammoStatusStr = 'ammo unresolved';
    let healthStatusStr = '-';

    let ammoFallbackSnapshot = null;
    let allKeysFetched = false;

    function ensureAllKeys() {
        if (allKeysFetched) return;
        allKeysFetched = true;
        try {
            const txt = fetchText("https://raw.githubusercontent.com/StateFarmNetwork/client-keys/main/all_latest.json");
            if (txt && txt !== "value_undefined") {
                const parsed = JSON.parse(txt);
                if (parsed && parsed.vars) {
                    for (const [k, v] of Object.entries(parsed.vars)) {
                        if (typeof v === 'string' && /^[a-zA-Z0-9_$]+$/.test(v) && !(k in H)) {
                            H[k] = v;
                        }
                    }
                }
            }
        } catch (e) { }
        if (!H.hp) H.hp = 'kb';
        if (!H.rounds) H.rounds = 'fa';
        if (!H.storeMax) H.storeMax = 'Ua';
        if (!H.capacity) H.capacity = 'F$';
        if (!H.cc_reload) H.cc_reload = 'i$';
        if (!H.weapon) H.weapon = 'Ha';
        if (!H.name_) H.name_ = 'ga';
        if (!H.store) H.store = 'store';
        if (!H.reloading) H.reloading = 'reloading';
        if (!H.triggerPulled) H.triggerPulled = 'triggerPulled';
    }

    function resolveAmmoAndHealth(me) {
        if (!me) return;
        ensureAllKeys();

        lastPlayerRef = me;
        const curWeapon = (H.weapon && me[H.weapon] && typeof me[H.weapon] === 'object')
            ? me[H.weapon]
            : (me.Ha && typeof me.Ha === 'object' ? me.Ha : (me.weapon && typeof me.weapon === 'object' ? me.weapon : null));
        lastWeaponRef = curWeapon;

        const ammoObj = (curWeapon && curWeapon.ammo && typeof curWeapon.ammo === 'object')
            ? curWeapon.ammo
            : (me.weapons && me.weapons[0] && me.weapons[0].ammo && typeof me.weapons[0].ammo === 'object'
                ? me.weapons[0].ammo
                : null);

        resolvedAmmoTarget = null;
        resolvedAmmoKey = null;
        if (ammoObj && typeof ammoObj.fa === 'number') {
            resolvedAmmoTarget = ammoObj;
            resolvedAmmoKey = 'fa';
        } else if (ammoObj && H.rounds && typeof ammoObj[H.rounds] === 'number') {
            resolvedAmmoTarget = ammoObj;
            resolvedAmmoKey = H.rounds;
        } else if (curWeapon && typeof curWeapon.fa === 'number') {
            resolvedAmmoTarget = curWeapon;
            resolvedAmmoKey = 'fa';
        }

        resolvedReserveTarget = null;
        resolvedReserveKey = null;
        if (ammoObj && typeof ammoObj.store === 'number') {
            resolvedReserveTarget = ammoObj;
            resolvedReserveKey = 'store';
        } else if (ammoObj && typeof ammoObj.Ua === 'number') {
            resolvedReserveTarget = ammoObj;
            resolvedReserveKey = 'Ua';
        }

        resolvedHealthTarget = null;
        resolvedHealthKey = null;
        if (typeof me.kb === 'number') {
            resolvedHealthTarget = me;
            resolvedHealthKey = 'kb';
        } else if (H.hp && typeof me[H.hp] === 'number') {
            resolvedHealthTarget = me;
            resolvedHealthKey = H.hp;
        }

        resolvedReloadTarget = me;
        resolvedReloadKey = 'reloading';
    }

    function applyAmmoAndHealth(me) {
        if (!me) return;

        const curWeapon = (H.weapon && me[H.weapon] && typeof me[H.weapon] === 'object')
            ? me[H.weapon]
            : (me.Ha && typeof me.Ha === 'object' ? me.Ha : (me.weapon && typeof me.weapon === 'object' ? me.weapon : null));

        const ammoObj = (curWeapon && curWeapon.ammo && typeof curWeapon.ammo === 'object')
            ? curWeapon.ammo
            : (me.weapons && me.weapons[0] && me.weapons[0].ammo && typeof me.weapons[0].ammo === 'object'
                ? me.weapons[0].ammo
                : null);

        const needsReResolve = (me !== lastPlayerRef) ||
            (curWeapon !== lastWeaponRef) ||
            !resolvedAmmoTarget ||
            !resolvedHealthTarget;

        if (needsReResolve) {
            resolveAmmoAndHealth(me);
        }

        if (S.infiniteAmmo) {
            const val = typeof S.ammoValue === 'number' ? S.ammoValue : 999;
            if (ammoObj) {
                ammoObj.fa = val;
                ammoObj.store = val;
                if (typeof ammoObj.F$ === 'number' && ammoObj.F$ < val) ammoObj.F$ = val;
                if (typeof ammoObj.Ua === 'number' && ammoObj.Ua < val) ammoObj.Ua = val;
            }
            if (me.weapons && Array.isArray(me.weapons)) {
                for (const w of me.weapons) {
                    if (w && w.ammo) {
                        w.ammo.fa = val;
                        w.ammo.store = val;
                        if (typeof w.ammo.F$ === 'number' && w.ammo.F$ < val) w.ammo.F$ = val;
                        if (typeof w.ammo.Ua === 'number' && w.ammo.Ua < val) w.ammo.Ua = val;
                    }
                }
            }
            me.reloading = false;
            me.roundsToReload = 0;
            me.reloadCountdown = 0;
            try {
                const ammoDom = document.getElementById('ammo');
                if (ammoDom) {
                    ammoDom.innerHTML = val + '/' + val;
                    ammoDom.style.color = '#fff';
                }
            } catch (e) { }
        }

        if (S.holdHealth) {
            me.kb = 100;
            if (H.hp && H.hp in me) me[H.hp] = 100;
        }

        if (ammoObj && typeof ammoObj.fa === 'number') {
            const resStr = typeof ammoObj.store === 'number' ? `+${ammoObj.store}` : '';
            ammoStatusStr = `ammo fa:${ammoObj.fa}${resStr}`;
        } else if (resolvedAmmoTarget && resolvedAmmoKey && typeof resolvedAmmoTarget[resolvedAmmoKey] === 'number') {
            const resStr = (resolvedReserveTarget && resolvedReserveKey && typeof resolvedReserveTarget[resolvedReserveKey] === 'number')
                ? `+${resolvedReserveTarget[resolvedReserveKey]}` : '';
            ammoStatusStr = `ammo ${resolvedAmmoKey}:${resolvedAmmoTarget[resolvedAmmoKey]}${resStr}`;
        } else {
            ammoStatusStr = 'ammo ?';
        }

        const curHp = (H.hp && typeof me[H.hp] === 'number') ? me[H.hp] : (typeof me.kb === 'number' ? me.kb : null);
        if (curHp !== null) {
            healthStatusStr = `hp kb:${Math.round(curHp)}`;
        } else {
            healthStatusStr = 'hp ?';
        }
    }

    // ================= ADVANCE SHOOT POINT & RETICLE HUD =================
    function getShootPointSvg(style) {
        switch (style) {
            case 'dot':
                return '<svg viewBox="0 0 28 28" style="width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 0 5px currentColor)">' +
                    '<circle cx="14" cy="14" r="3.2" fill="currentColor" />' +
                    '<circle cx="14" cy="14" r="1.3" fill="#ffffff" opacity="0.9" />' +
                '</svg>';
            case 'crosshair':
                return '<svg viewBox="0 0 28 28" style="width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 0 2px rgba(0,0,0,0.9)) drop-shadow(0 0 4px currentColor)">' +
                    '<circle cx="14" cy="14" r="2.0" fill="currentColor" />' +
                    '<line x1="14" y1="2" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' +
                    '<line x1="14" y1="20" x2="14" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' +
                    '<line x1="2" y1="14" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' +
                    '<line x1="20" y1="14" x2="26" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' +
                '</svg>';
            case 'circle':
                return '<svg viewBox="0 0 28 28" style="width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 0 5px currentColor)">' +
                    '<circle cx="14" cy="14" r="2.5" fill="currentColor" />' +
                    '<circle cx="14" cy="14" r="8" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.85" />' +
                '</svg>';
            case 'cyber':
            default:
                return '<svg viewBox="0 0 28 28" style="width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 0 6px currentColor)">' +
                    '<circle cx="14" cy="14" r="2.4" fill="currentColor" />' +
                    '<circle cx="14" cy="14" r="1.0" fill="#ffffff" opacity="0.95" />' +
                    '<circle cx="14" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.75" />' +
                    '<line x1="14" y1="1" x2="14" y2="5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
                    '<line x1="14" y1="23" x2="14" y2="27" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
                    '<line x1="1" y1="14" x2="5" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
                    '<line x1="23" y1="14" x2="27" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
                '</svg>';
        }
    }

    // ================= LABEL & HUD OVERLAY =================
    let overlay = null, labels = new Map(), lastRenderedStyle = null;
    function ensureOverlay() {
        if (overlay && document.body && document.body.contains(overlay)) return overlay;
        if (overlay) { try { overlay.remove(); } catch (e) { } }
        overlay = document.createElement('div');
        overlay.id = 'lm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden';

        // Outer FOV Ring with 4 tactical quadrant ticks
        const ring = document.createElement('div');
        ring.id = 'lm-fovring';
        ring.style.cssText = 'position:absolute;left:50%;top:50%;border:1.5px solid #00f0ff;border-radius:50%;transform:translate(-50%,-50%);display:none;box-sizing:border-box;pointer-events:none;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8));transition:border-color 0.15s ease, box-shadow 0.15s ease';

        const ticks = ['top', 'right', 'bottom', 'left'];
        for (const t of ticks) {
            const tick = document.createElement('div');
            tick.className = 'lm-fovtick lm-fovtick-' + t;
            let tickCss = 'position:absolute;background:currentColor;box-shadow:0 0 4px currentColor;pointer-events:none;border-radius:1px;';
            if (t === 'top') tickCss += 'width:2px;height:10px;left:50%;top:-5px;transform:translateX(-50%);';
            else if (t === 'bottom') tickCss += 'width:2px;height:10px;left:50%;bottom:-5px;transform:translateX(-50%);';
            else if (t === 'left') tickCss += 'height:2px;width:10px;top:50%;left:-5px;transform:translateY(-50%);';
            else if (t === 'right') tickCss += 'height:2px;width:10px;top:50%;right:-5px;transform:translateY(-50%);';
            tick.style.cssText = tickCss;
            ring.appendChild(tick);
        }
        overlay.appendChild(ring);

        // Center Advanced Shoot Point Reticle
        const sp = document.createElement('div');
        sp.id = 'lm-shootpoint';
        sp.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:28px;height:28px;display:none;pointer-events:none;color:#00f0ff;transition:transform 0.12s ease, color 0.15s ease';
        overlay.appendChild(sp);

        lastRenderedStyle = null;
        document.body.appendChild(overlay);
        return overlay;
    }

    function labelFor(P) {
        let l = labels.get(P);
        if (l) return l;
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;transform:translate(-50%,-100%);font:11px/1.2 monospace;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;text-align:center';
        const nm = document.createElement('div');
        const bar = document.createElement('div');
        bar.style.cssText = 'width:52px;height:3px;background:rgba(0,0,0,.55);margin:2px auto 0;border-radius:2px;overflow:hidden';
        const fill = document.createElement('div');
        fill.style.cssText = 'height:100%;width:100%;background:#3dff6e';
        bar.appendChild(fill);
        const dist = document.createElement('div');
        dist.style.cssText = 'opacity:.8';
        d.append(nm, bar, dist);
        ensureOverlay().appendChild(d);
        l = { d, nm, bar, fill, dist };
        labels.set(P, l);
        return l;
    }

    function killLabel(P) {
        const l = labels.get(P);
        if (l) { l.d.remove(); labels.delete(P); }
    }

    // ================= BADGE =================
    let badge = null;
    function ensureBadge() {
        if (badge || document.getElementById('st-badge')) return;
        badge = document.createElement('div');
        badge.id = 'st-badge';
        badge.textContent = 'ST';
        badge.title = 'ST menu — click to open (~ or Insert)';
        badge.style.cssText = 'position:fixed;left:12px;bottom:12px;width:38px;height:38px;border-radius:50%;background:rgba(10,18,30,.94);border:1.5px solid #00b4d8;color:#00e5ff;font:bold 13px monospace;display:flex;align-items:center;justify-content:center;z-index:2147483600;cursor:pointer;user-select:none;box-shadow:0 0 12px rgba(0,180,216,0.45);transition:transform .15s ease, box-shadow .15s ease';
        badge.onmouseenter = () => { badge.style.boxShadow = '0 0 18px rgba(0,229,255,0.85)'; badge.style.transform = 'scale(1.08)'; };
        badge.onmouseleave = () => { badge.style.boxShadow = '0 0 12px rgba(0,180,216,0.45)'; badge.style.transform = 'scale(1)'; };

        let downX = 0, downY = 0, moved = false;

        const badgeMv = ev => {
            if (Math.abs(ev.clientX - downX) > 4 || Math.abs(ev.clientY - downY) > 4) {
                moved = true;
                badge.style.left = (ev.clientX - 18) + 'px';
                badge.style.top = (ev.clientY - 18) + 'px';
                badge.style.bottom = 'auto';
            }
        };
        badgeMv.__lmUI = true;

        const badgeUp = () => {
            document.removeEventListener('mousemove', badgeMv, true);
            document.removeEventListener('mouseup', badgeUp, true);
            if (!moved) togglePanel();
        };
        badgeUp.__lmUI = true;

        const badgeDown = e => {
            e.stopPropagation();
            downX = e.clientX; downY = e.clientY; moved = false;
            document.addEventListener('mousemove', badgeMv, true);
            document.addEventListener('mouseup', badgeUp, true);
        };
        badgeDown.__lmUI = true;
        badge.addEventListener('mousedown', badgeDown, true);

        document.body.appendChild(badge);
    }

    // ================= MAIN LOOP =================
    const tracersKey = getScrambled();
    let lastFovApplied = 0;

    function makeTracer(P, cross) {
        const points = [P[H.actor][H.mesh].position.clone(), cross.clone()];
        points[0].y += 0.4;
        if (!P[tracersKey]) {
            P[tracersKey] = BABYLON.MeshBuilder.CreateLines(getScrambled(), { points, updatable: true }, ss.SCENE);
            P[tracersKey].isPickable = false;
            P[tracersKey].alwaysSelectAsActiveMesh = true;
            P[tracersKey].doNotSyncBoundingInfo = true;
            P[tracersKey][H.renderingGroupId] = 1;
        } else {
            BABYLON.MeshBuilder.CreateLines(undefined, { points, instance: P[tracersKey], updatable: true });
        }
        P[tracersKey].visibility = S.espTracer && P[H.playing];
        return P[tracersKey];
    }

    // ================= TOAST NOTIFICATION =================
    let toastTimeout = null;
    function showToast(msg) {
        try {
            let t = document.getElementById('lm-toast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'lm-toast';
                t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(10,18,30,0.96);color:#00e5ff;font:bold 12px monospace;padding:7px 16px;border:1px solid #00b4d8;border-radius:8px;z-index:2147483600;box-shadow:0 6px 20px rgba(0,180,216,0.35);pointer-events:none;transition:opacity 0.25s;opacity:0';
                document.body.appendChild(t);
            }
            t.textContent = msg;
            t.style.opacity = '1';
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                if (t) t.style.opacity = '0';
            }, 2000);
        } catch (e) { }
    }

    // ================= MANUAL SAFE POINTS =================
    function getSavedPoints() {
        try {
            return JSON.parse(localStorage.getItem('lm_points_v1') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveCurrentPoint() {
        if (!ss.MYPLAYER) {
            showToast('Cannot save point: not in match');
            return;
        }
        try {
            const me = ss.MYPLAYER;
            const pts = getSavedPoints();
            const newPt = {
                x: me[H.x],
                y: me[H.y],
                z: me[H.z],
                name: `Point ${pts.length + 1}`,
                time: Date.now()
            };
            pts.push(newPt);
            while (pts.length > 10) pts.shift();
            localStorage.setItem('lm_points_v1', JSON.stringify(pts));
            showToast(`Point #${pts.length} saved (${newPt.x.toFixed(1)}, ${newPt.y.toFixed(1)}, ${newPt.z.toFixed(1)})`);
        } catch (e) {
            showToast('Failed to save point');
        }
    }

    // ================= TELEPORT (sustained write, all mirrors) =================
    let tpTarget = null;
    let tpUntil = 0;
    let tpStartDist = Infinity;
    let tpLogged = false;
    let teleportTargetPos = null;
    let teleportDriveUntil = 0;

    function getCoordsRef(me) {
        if (!me) return null;
        let c = (H.coords && me[H.coords]) ? me[H.coords] : (me.coords || null);
        if (!c) {
            for (const k of ['coords', 'pos', 'position', 'origin']) {
                if (me[k]) { c = me[k]; break; }
            }
        }
        if (!c) return null;
        if (Array.isArray(c)) return { kind: 'array', ref: c };
        if (typeof c === 'object' && typeof c.x === 'number') return { kind: 'obj', ref: c };
        return null;
    }

    // Writes every known position mirror at once so nothing fights the others
    function writePos(me, x, y, z) {
        try {
            if (H.x) me[H.x] = x;
            if (H.y) me[H.y] = y;
            if (H.z) me[H.z] = z;

            const c = getCoordsRef(me);
            if (c) {
                if (c.kind === 'array') { c.ref[0] = x; c.ref[1] = y; c.ref[2] = z; }
                else { c.ref.x = x; c.ref.y = y; c.ref.z = z; }
            }

            const actor = (H.actor && me[H.actor]) ? me[H.actor] : (me.ba || null);
            if (actor) {
                const m = actor[H.mesh] || actor.mesh;
                if (m && m.position) {
                    m.position.x = x; m.position.y = y; m.position.z = z;
                }
                if (actor.lerpTargetPosition && actor.lerpTargetPosition.copyFromFloats) {
                    actor.lerpTargetPosition.copyFromFloats(x, y, z);
                }
                if (actor.lerpToPosition && actor.lerpToPosition.copyFromFloats) {
                    actor.lerpToPosition.copyFromFloats(x, y, z);
                }
            }
        } catch (e) { }
    }

    function startTeleport(x, y, z) {
        const me = ss.MYPLAYER;
        if (!me) return;
        tpTarget = { x, y, z };
        teleportTargetPos = { x, y, z };
        teleportDriveUntil = Date.now() + (S.teleportMs || 800);
        tpUntil = Date.now() + (S.teleportMs || 800);
        tpStartDist = Math.hypot(x - me[H.x], y - me[H.y], z - me[H.z]);
        tpLogged = false;
        lastTargetPlayer = null;
    }

    function applyTeleport(me) {
        if (!tpTarget) return;
        const now = Date.now();
        if (now > tpUntil) {
            const d = Math.hypot(tpTarget.x - me[H.x], tpTarget.y - me[H.y], tpTarget.z - me[H.z]);
            log(`teleport finished: moved ${(tpStartDist - d).toFixed(1)}m of ${tpStartDist.toFixed(1)}m`);
            tpTarget = null;
            return;
        }
        writePos(me, tpTarget.x, tpTarget.y, tpTarget.z);

        if (!tpLogged && now > tpUntil - (S.teleportMs || 800) + 250) {
            tpLogged = true;
            const d = Math.hypot(tpTarget.x - me[H.x], tpTarget.y - me[H.y], tpTarget.z - me[H.z]);
            if (d > tpStartDist - 0.5) {
                log('teleport: NO EFFECT — position write is being overwritten');
            }
        }
    }

    function gotoNearestPoint() {
        if (!ss.MYPLAYER) {
            showToast('Cannot teleport: not in match');
            return;
        }
        try {
            const me = ss.MYPLAYER;
            const pts = getSavedPoints();
            if (pts.length === 0) {
                showToast('No saved safe points found');
                return;
            }
            let nearest = null;
            let nearestDist = Infinity;
            let nearestIdx = -1;
            // Prefer points further than 1.5m so we do not teleport to where we are already standing
            let candidatePts = pts.filter(pt => Math.hypot(pt.x - me[H.x], pt.y - me[H.y], pt.z - me[H.z]) > 1.5);
            if (candidatePts.length === 0) candidatePts = pts;
            candidatePts.forEach((pt) => {
                const idx = pts.indexOf(pt);
                const dist = Math.hypot(pt.x - me[H.x], pt.y - me[H.y], pt.z - me[H.z]);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = pt;
                    nearestIdx = idx + 1;
                }
            });
            if (nearest) {
                startTeleport(nearest.x, nearest.y, nearest.z);
                showToast(`Teleporting to Point #${nearestIdx} (${nearestDist.toFixed(1)}m)`);
            }
        } catch (e) {
            showToast('Teleport failed');
        }
    }

    // ================= AUTO COVER SEARCH & ESCAPE =================
    let lastEscapeTime = 0;
    let escapeTriggeredHp = 0;
    let waitingForHpRecovery = false;
    let lastEscapeSpot = null;
    let escReason = '-';

    function checkAutoEscape(me) {
        if (!S.autoEscape || !me || !ss.SCENE) { escReason = 'off'; return; }
        escReason = '-';

        const myHp = (H.hp && typeof me[H.hp] === 'number') ? me[H.hp] : (typeof me.kb === 'number' ? me.kb : 100);
        const escapeThreshold = S.escapeHp || 35;

        if (waitingForHpRecovery) {
            if (myHp >= escapeTriggeredHp + 10) {
                waitingForHpRecovery = false;
            } else {
                escReason = 'recover';
                return;
            }
        }

        if (myHp > escapeThreshold) { escReason = 'hp ok'; return; }

        const now = Date.now();
        if (now - lastEscapeTime < 3000) { escReason = 'cooldown'; return; }

        // Never escape while airborne (number OR boolean flag)
        let grounded = true;
        if (typeof me.onGround === 'number') grounded = me.onGround > 0;
        else if (typeof me.onGround === 'boolean') grounded = me.onGround;
        else if (H.onGround && typeof me[H.onGround] === 'number') grounded = me[H.onGround] > 0;
        if (!grounded) { escReason = 'airborne'; return; }

        const enemiesWithin45m = [];
        for (const P of ss.PLAYERS) {
            if (!P || P === me || !P[H.playing]) continue;
            if (me.team !== 0 && P.team === me.team) continue;
            const pHp = (H.hp && typeof P[H.hp] === 'number') ? P[H.hp] : (typeof P.kb === 'number' ? P.kb : 100);
            if (pHp <= 0) continue;

            const dist = Math.hypot(P[H.x] - me[H.x], P[H.y] - me[H.y], P[H.z] - me[H.z]);
            if (dist <= 45) {
                enemiesWithin45m.push({ P, dist });
                if (enemiesWithin45m.length >= 8) break;
            }
        }

        if (enemiesWithin45m.length === 0) { escReason = 'no enemy'; return; }

        try {
            const ignoredMeshes = new Set();
            for (const P of ss.PLAYERS) {
                if (!P) continue;
                try {
                    const actor = (H.actor && P[H.actor]) || P.ba;
                    if (actor) {
                        if (actor.mesh) ignoredMeshes.add(actor.mesh);
                        if (typeof actor.getChildMeshes === 'function') {
                            actor.getChildMeshes().forEach(m => ignoredMeshes.add(m));
                        }
                    }
                    if (P.box) ignoredMeshes.add(P.box);
                    if (P[tracersKey]) ignoredMeshes.add(P[tracersKey]);
                } catch (e) { }
            }

            const isEspMesh = mesh => !!(mesh.name && (mesh.name.includes('esp') || mesh.name.includes('box') || mesh.name.includes('tracer')));

            // LoS predicate: only meshes that can block
            const predicate = mesh => {
                if (!mesh) return false;
                if (ignoredMeshes.has(mesh)) return false;
                if (isEspMesh(mesh)) return false;
                return true;
            };

            // Floor predicate: no isPickable requirement
            const floorPredicate = mesh => {
                if (!mesh) return false;
                if (ignoredMeshes.has(mesh)) return false;
                if (isEspMesh(mesh)) return false;
                return true;
            };

            const radius = Math.max(3, Math.min(15, S.escapeRadius || 7));
            const myX = me[H.x];
            const myY = me[H.y];
            const myZ = me[H.z];

            const survivingCandidates = [];
            const downDir = new BABYLON.Vector3(0, -1, 0);
            let rawFloorHits = 0;

            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const candX = myX + Math.cos(angle) * radius;
                const candZ = myZ + Math.sin(angle) * radius;

                const downOrigin = new BABYLON.Vector3(candX, myY + 2.0, candZ);
                const downRay = new BABYLON.Ray(downOrigin, downDir, 8.0);
                const floorHit = ss.SCENE.pickWithRay(downRay, floorPredicate);
                if (floorHit && floorHit.hit) rawFloorHits++;

                if (!floorHit || !floorHit.hit || !floorHit.pickedPoint) continue;
                if (floorHit.distance > 6.0) continue;

                const candY = floorHit.pickedPoint.y;
                survivingCandidates.push({ x: candX, y: candY, z: candZ });
            }

            if (survivingCandidates.length === 0) {
                escReason = `no floor (${rawFloorHits} hits)`;
                return;
            }

            let bestCand = null;
            let bestBlocked = -1;
            let bestDist = Infinity;
            let maxDistCandidate = null;
            let maxDist = -1;

            for (const cand of survivingCandidates) {
                if (lastEscapeSpot && Math.hypot(cand.x - lastEscapeSpot.x, cand.z - lastEscapeSpot.z) < 1.5) {
                    continue;
                }

                const candEye = new BABYLON.Vector3(cand.x, cand.y + 0.4, cand.z);
                let blockedCount = 0;

                for (const { P } of enemiesWithin45m) {
                    const enemyEye = new BABYLON.Vector3(P[H.x], P[H.y] + 0.4, P[H.z]);
                    const distToEnemy = BABYLON.Vector3.Distance(candEye, enemyEye);
                    const dirToEnemy = enemyEye.subtract(candEye).normalize();
                    const losRay = new BABYLON.Ray(candEye, dirToEnemy, distToEnemy);
                    const hit = ss.SCENE.pickWithRay(losRay, predicate);

                    if (hit && hit.hit && hit.distance < distToEnemy - 0.5) {
                        blockedCount++;
                    }
                }

                const distFromPlayer = Math.hypot(cand.x - myX, cand.z - myZ);
                if (distFromPlayer > maxDist) {
                    maxDist = distFromPlayer;
                    maxDistCandidate = cand;
                }

                if (blockedCount > bestBlocked) {
                    bestBlocked = blockedCount;
                    bestDist = distFromPlayer;
                    bestCand = cand;
                } else if (blockedCount === bestBlocked && distFromPlayer < bestDist) {
                    bestDist = distFromPlayer;
                    bestCand = cand;
                }
            }

            const targetSpot = (bestBlocked > 0 && bestCand) ? bestCand : (maxDistCandidate || survivingCandidates[0]);

            if (targetSpot) {
                lastEscapeSpot = { x: targetSpot.x, y: targetSpot.y, z: targetSpot.z };
                lastEscapeTime = now;
                escapeTriggeredHp = myHp;
                waitingForHpRecovery = true;
                escReason = `ok ${bestBlocked}/${enemiesWithin45m.length}`;

                startTeleport(targetSpot.x, targetSpot.y, targetSpot.z);
                showToast(`Auto Escape: cover (${bestBlocked}/${enemiesWithin45m.length} LoS blocked)`);
            }
        } catch (err) {
            console.error('[ST Auto-Escape Error]', err);
            escReason = 'error';
            S.autoEscape = false;
            save();
            showToast('Auto-escape error - disabled');
        }
    }

    // ================= ENEMY POSITION MANIPULATION =================
    const enemySnapshots = new Map();
    let lastFreezeState = false;
    const failedFreezePlayers = new WeakSet();

    function updateEnemyManipulation(me) {
        try {
            if (!S.freezeEnemies) {
                if (lastFreezeState) {
                    enemySnapshots.clear();
                    for (const P of ss.PLAYERS) {
                        if (!P || P === me) continue;
                        try {
                            delete P._serverPos;
                            const actor = (H.actor && P[H.actor]) || P.ba;
                            if (actor && typeof actor.resetLerp === 'function') {
                                actor.resetLerp();
                            }
                        } catch (e) { }
                    }
                    lastFreezeState = false;
                }
                return;
            }

            lastFreezeState = true;

            for (const [P] of enemySnapshots) {
                const pHp = (H.hp && typeof P[H.hp] === 'number') ? P[H.hp] : (typeof P.kb === 'number' ? P.kb : 100);
                if (!P[H.playing] || pHp <= 0 || !ss.PLAYERS.includes(P)) {
                    enemySnapshots.delete(P);
                    try { delete P._serverPos; } catch (e) { }
                }
            }

            const activeEnemies = [];
            for (const P of ss.PLAYERS) {
                if (!P || P === me || failedFreezePlayers.has(P)) continue;
                if (me.team !== 0 && P.team === me.team) continue;
                const pHp = (H.hp && typeof P[H.hp] === 'number') ? P[H.hp] : (typeof P.kb === 'number' ? P.kb : 100);
                if (!P[H.playing] || pHp <= 0) continue;

                if (!P._serverPos) {
                    P._serverPos = { x: P[H.x], y: P[H.y], z: P[H.z] };
                }
                activeEnemies.push(P);
            }

            if (S.freezeMode === 'pull') {
                const eyeX = me[H.x];
                const eyeY = me[H.y] + 0.4;
                const eyeZ = me[H.z];
                const yaw = me[H.yaw];
                const pitch = -me[H.pitch];
                const pullDist = Math.max(3, Math.min(25, S.pullDistance || 8));

                const fwdX = -Math.sin(yaw) * Math.cos(pitch);
                const fwdY = -Math.sin(pitch);
                const fwdZ = -Math.cos(yaw) * Math.cos(pitch);
                const rightX = Math.cos(yaw);
                const rightZ = -Math.sin(yaw);

                activeEnemies.sort((a, b) => {
                    const distA = Math.hypot((a._serverPos?.x || a[H.x]) - eyeX, (a._serverPos?.z || a[H.z]) - eyeZ);
                    const distB = Math.hypot((b._serverPos?.x || b[H.x]) - eyeX, (b._serverPos?.z || b[H.z]) - eyeZ);
                    return distA - distB;
                });

                const count = activeEnemies.length;
                activeEnemies.forEach((P, idx) => {
                    try {
                        const lateralOffset = (idx - (count - 1) / 2) * 0.8;
                        const posX = eyeX + fwdX * pullDist + rightX * lateralOffset;
                        const posY = eyeY + fwdY * pullDist - 0.4;
                        const posZ = eyeZ + fwdZ * pullDist + rightZ * lateralOffset;

                        P[H.x] = posX;
                        P[H.y] = posY;
                        P[H.z] = posZ;

                        const actor = (H.actor && P[H.actor]) || P.ba;
                        if (actor) {
                            const m = actor[H.mesh] || actor.mesh;
                            if (m && m.position) {
                                m.position.x = posX;
                                m.position.y = posY;
                                m.position.z = posZ;
                            }
                            if (actor.lerpTargetPosition) actor.lerpTargetPosition.copyFromFloats(posX, posY, posZ);
                            if (actor.lerpToPosition) actor.lerpToPosition.copyFromFloats(posX, posY, posZ);
                            if (actor.lerpFromPosition) actor.lerpFromPosition.copyFromFloats(posX, posY, posZ);
                        }
                    } catch (err) {
                        failedFreezePlayers.add(P);
                    }
                });
            } else {
                for (const P of activeEnemies) {
                    try {
                        if (!enemySnapshots.has(P)) {
                            const actor = (H.actor && P[H.actor]) || P.ba;
                            const m = actor ? (actor[H.mesh] || actor.mesh) : null;
                            const snap = (m && m.position)
                                ? { x: m.position.x, y: m.position.y, z: m.position.z }
                                : { x: P[H.x], y: P[H.y], z: P[H.z] };
                            enemySnapshots.set(P, snap);
                        }

                        const snap = enemySnapshots.get(P);
                        if (snap) {
                            P[H.x] = snap.x;
                            P[H.y] = snap.y;
                            P[H.z] = snap.z;

                            const actor = (H.actor && P[H.actor]) || P.ba;
                            if (actor) {
                                const m = actor[H.mesh] || actor.mesh;
                                if (m && m.position) {
                                    m.position.x = snap.x;
                                    m.position.y = snap.y;
                                    m.position.z = snap.z;
                                }
                                if (actor.lerpTargetPosition) actor.lerpTargetPosition.copyFromFloats(snap.x, snap.y, snap.z);
                                if (actor.lerpToPosition) actor.lerpToPosition.copyFromFloats(snap.x, snap.y, snap.z);
                                if (actor.lerpFromPosition) actor.lerpFromPosition.copyFromFloats(snap.x, snap.y, snap.z);
                            }
                        }
                    } catch (err) {
                        failedFreezePlayers.add(P);
                    }
                }
            }
        } catch (e) { }
    }

    // ================= GRENADE TRAJECTORY PREDICTOR =================
    let grenadeMesh = null;
    function updateGrenadeTrajectory(me) {
        if (!S.grenadeTrajectory || !me || !ss.SCENE) {
            if (grenadeMesh) grenadeMesh.setEnabled(false);
            return;
        }

        const actor = (H.actor && me[H.actor]) ? me[H.actor] : (me.ba || null);
        const m = actor ? (actor[H.mesh] || actor.mesh) : null;
        if (!m || !m.position) {
            if (grenadeMesh) grenadeMesh.setEnabled(false);
            return;
        }

        const yaw = me[H.yaw];
        const pitch = -me[H.pitch];
        const fwdX = -Math.sin(yaw) * Math.cos(pitch);
        const fwdY = -Math.sin(pitch);
        const fwdZ = -Math.cos(yaw) * Math.cos(pitch);

        let curX = m.position.x;
        let curY = m.position.y + 0.4;
        let curZ = m.position.z;

        const v0 = 20.0;
        const gravity = 18.0;
        const dt = 0.045;

        let vx = fwdX * v0;
        let vy = fwdY * v0;
        let vz = fwdZ * v0;

        const points = [new BABYLON.Vector3(curX, curY, curZ)];
        const TOTAL_POINTS = 36;

        for (let i = 0; i < TOTAL_POINTS - 1; i++) {
            const nextX = curX + vx * dt;
            const nextY = curY + vy * dt - 0.5 * gravity * dt * dt;
            const nextZ = curZ + vz * dt;
            vy -= gravity * dt;

            const fromVec = new BABYLON.Vector3(curX, curY, curZ);
            const toVec = new BABYLON.Vector3(nextX, nextY, nextZ);
            const segVec = toVec.subtract(fromVec);
            const dist = segVec.length();

            if (dist > 0.01) {
                const ray = new BABYLON.Ray(fromVec, segVec.normalize(), dist);
                const hit = ss.SCENE.pickWithRay(ray, mesh => {
                    if (!mesh) return false;
                    if (mesh.name && (mesh.name.includes('esp') || mesh.name.includes('box') || mesh.name.includes('tracer') || mesh.name.includes('st_grenade'))) return false;
                    return true;
                });

                if (hit && hit.hit && hit.pickedPoint) {
                    points.push(hit.pickedPoint.clone());
                    break;
                }
            }

            points.push(new BABYLON.Vector3(nextX, nextY, nextZ));
            curX = nextX;
            curY = nextY;
            curZ = nextZ;
            if (curY < -25) break;
        }

        const lastPt = points[points.length - 1];
        while (points.length < TOTAL_POINTS) {
            points.push(lastPt.clone());
        }

        try {
            if (!grenadeMesh) {
                grenadeMesh = BABYLON.MeshBuilder.CreateLines('st_grenade_line', { points, updatable: true }, ss.SCENE);
                grenadeMesh.isPickable = false;
                grenadeMesh.alwaysSelectAsActiveMesh = true;
                grenadeMesh.doNotSyncBoundingInfo = true;
                if (H.renderingGroupId) grenadeMesh[H.renderingGroupId] = 1;
                grenadeMesh.color = BABYLON.Color3.FromHexString('#00f0ff');
            } else {
                grenadeMesh.setEnabled(true);
                BABYLON.MeshBuilder.CreateLines(undefined, { points, instance: grenadeMesh, updatable: true });
            }
        } catch (e) { }
    }

    // ================= ON-SCREEN SESSION STATS HUD =================
    let statsHud = null;
    let fpsFrames = 0, lastFpsUpdate = performance.now(), currentFps = 60;
    let sessionKills = 0, sessionDeaths = 0, currentStreak = 0, maxStreak = 0;
    let wasAlive = false;
    const enemyHpMap = new Map();

    function ensureStatsHud() {
        if (statsHud && document.body && document.body.contains(statsHud)) return statsHud;
        if (statsHud) { try { statsHud.remove(); } catch (e) { } }
        statsHud = document.createElement('div');
        statsHud.id = 'st-stats-widget';
        statsHud.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483500;pointer-events:none;background:rgba(10,18,30,.88);border:1px solid rgba(0,180,216,.45);border-radius:8px;padding:6px 12px;font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;color:#e2e8f0;display:flex;align-items:center;gap:12px;box-shadow:0 4px 18px rgba(0,0,0,.6), 0 0 10px rgba(0,180,216,.2);user-select:none;transition:opacity .2s ease';
        document.body.appendChild(statsHud);
        return statsHud;
    }

    function updateStatsHud(me) {
        const hud = ensureStatsHud();
        if (!S.statsHud || !S.enabled) {
            hud.style.display = 'none';
            return;
        }
        hud.style.display = 'flex';

        fpsFrames++;
        const now = performance.now();
        if (now - lastFpsUpdate >= 500) {
            currentFps = Math.round((fpsFrames * 1000) / (now - lastFpsUpdate));
            fpsFrames = 0;
            lastFpsUpdate = now;
        }

        if (me) {
            const myHp = (H.hp && typeof me[H.hp] === 'number') ? me[H.hp] : (typeof me.kb === 'number' ? me.kb : 100);
            const myPlaying = !!me[H.playing] && myHp > 0;
            if (wasAlive && !myPlaying) {
                sessionDeaths++;
                currentStreak = 0;
                wasAlive = false;
            } else if (!wasAlive && myPlaying) {
                wasAlive = true;
            }
        }

        if (typeof ss !== 'undefined' && Array.isArray(ss.PLAYERS)) {
            for (const P of ss.PLAYERS) {
                if (!P || P === me) continue;
                const pHp = (H.hp && typeof P[H.hp] === 'number') ? P[H.hp] : (typeof P.kb === 'number' ? P.kb : 100);
                const prev = enemyHpMap.get(P);
                if (typeof prev === 'number') {
                    if (prev > 0 && (pHp <= 0 || !P[H.playing])) {
                        if (Date.now() - lastShotAt < 2500) {
                            sessionKills++;
                            currentStreak++;
                            if (currentStreak > maxStreak) maxStreak = currentStreak;
                            showToast(`🎯 KILL CONFIRMED! (+1) Streak: ${currentStreak}`);
                        }
                    }
                }
                enemyHpMap.set(P, pHp);
            }
        }

        const kd = sessionDeaths > 0 ? (sessionKills / sessionDeaths).toFixed(1) : sessionKills;
        const streakColor = currentStreak >= 5 ? '#ff0055' : (currentStreak >= 3 ? '#ffea00' : '#38bdf8');
        const streakFire = currentStreak >= 3 ? ' 🔥' : '';

        hud.innerHTML = `
            <div><span style="color:#00e5ff;font-weight:bold">ST</span></div>
            <div><span style="color:#64748b">FPS:</span> <b style="color:#38bdf8">${currentFps}</b></div>
            <div><span style="color:#64748b">Streak:</span> <b style="color:${streakColor}">${currentStreak}${streakFire}</b></div>
            <div><span style="color:#64748b">Kills:</span> <b style="color:#10b981">${sessionKills}</b></div>
            <div><span style="color:#64748b">Deaths:</span> <b style="color:#ef4444">${sessionDeaths}</b></div>
            <div><span style="color:#64748b">K/D:</span> <b style="color:#c084fc">${kd}</b></div>
        `;
    }


    const playerHistory = new WeakMap();

    function anglesTo(P, me) {
        let targetX = P[H.x];
        let targetY = P[H.y];
        let targetZ = P[H.z];
        if (S.freezeEnemies && S.freezeMode === 'aimserver' && P._serverPos) {
            targetX = P._serverPos.x;
            targetY = P._serverPos.y;
            targetZ = P._serverPos.z;
        }

        let predX = targetX;
        let predY = targetY;
        let predZ = targetZ;

        const nowMs = performance.now();
        const prev = playerHistory.get(P);
        if (prev && prev.time) {
            const dt = Math.max(0.001, (nowMs - prev.time) / 1000);
            if (dt < 0.25) {
                const vx = (targetX - prev.x) / dt;
                const vy = (targetY - prev.y) / dt;
                const vz = (targetZ - prev.z) / dt;

                if (S.prediction) {
                    const dist = Math.hypot(targetX - me[H.x], targetY - me[H.y], targetZ - me[H.z]);
                    const leadTime = Math.min(0.12, Math.max(0.025, (dist / 175) + 0.035));
                    predX += vx * leadTime;
                    predY += vy * leadTime;
                    predZ += vz * leadTime;
                }
            }
        }
        playerHistory.set(P, { x: targetX, y: targetY, z: targetZ, time: nowMs });

        const aimH = (typeof S.aimHeight === 'number') ? S.aimHeight : 0.35;
        const dx = -(predX - me[H.x]);
        const dy = -((predY + aimH) - (me[H.y] + 0.4));
        const dz = -(predZ - me[H.z]);
        const v = { [H.x]: dx, [H.y]: dy, [H.z]: dz };
        const yaw = F.calculateYaw(v), pitch = F.calculatePitch(v);
        return {
            yaw, pitch,
            ang: Math.hypot(
                yawpitch.radianAngleDiff(me[H.yaw], yaw),
                yawpitch.radianAngleDiff(me[H.pitch], pitch)
            )
        };
    }

    const origMeshVisibility = new WeakMap();
    let lastHideOwnBody = null;
    let lastHideOwnGun = null;
    let lastActor = null;

    function applySelfVisibility(me) {
        const actor = me[H.actor];
        if (!actor || !actor.getChildMeshes) return;
        const body = actor[H.mesh];

        if (body && !origMeshVisibility.has(body)) {
            origMeshVisibility.set(body, body.isVisible);
        }
        const children = actor.getChildMeshes();
        for (const m of children) {
            if (!origMeshVisibility.has(m)) {
                origMeshVisibility.set(m, m.isVisible);
            }
        }

        const stateChanged = (S.hideOwnBody !== lastHideOwnBody) ||
                             (S.hideOwnGun !== lastHideOwnGun) ||
                             (actor !== lastActor);
        if (!stateChanged) return;

        lastHideOwnBody = S.hideOwnBody;
        lastHideOwnGun = S.hideOwnGun;
        lastActor = actor;

        for (const m of children) {
            const orig = origMeshVisibility.get(m);
            if (m === body) {
                m.isVisible = S.hideOwnBody ? false : orig;
            } else {
                m.isVisible = S.hideOwnGun ? false : orig;
            }
        }
        if (body) {
            const origBody = origMeshVisibility.get(body);
            body.isVisible = S.hideOwnBody ? false : origBody;
        }
    }

    let frameErrorLogged = false;
    let cachedActorPlayer = null;
    let origCamFov = null;
    let lastTargetPlayer = null;

    createAnonFunction("LIBERTYMUTUAL", function () {
        try {
            gameLoaded = true;
            ss.PLAYERS.forEach(P => { if (P && P.hasOwnProperty("ws")) ss.MYPLAYER = P; });
            if (!ss.MYPLAYER || !ss.SCENE || !ss.SCENE.activeCamera) return;

            if (ss.MYPLAYER !== cachedActorPlayer || !H.actor) {
                H.actor = findKeyWithProperty(ss.MYPLAYER, H.mesh);
                cachedActorPlayer = ss.MYPLAYER;
            }
            if (!H.actor) return;

            const me = ss.MYPLAYER;
            const cam = ss.SCENE.activeCamera;
            const engine = ss.SCENE.getEngine();
            const vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
            const world = BABYLON.Matrix.Identity();
            const xf = ss.SCENE.getTransformMatrix();

            applySelfVisibility(me);
            applyAmmoAndHealth(me);

            if (S.autoJump && me) {
                try {
                    if (typeof me.canJump === 'function' && me.canJump()) {
                        if (typeof me.jump === 'function') me.jump();
                    } else if (typeof me.onGround === 'number' && me.onGround > 0 && typeof me.jump === 'function') {
                        me.jump();
                    }
                } catch (e) { }
            }

            const sk = getShootingKey(me);
            if (sk) {
                if (firing) {
                    me[sk] = true;
                } else if (releaseFramesRemaining > 0) {
                    releaseFramesRemaining--;
                    me[sk] = false;
                    if (typeof me.releaseTrigger === 'function') {
                        try { me.releaseTrigger(); } catch (e) { }
                    }
                }
            }

            yawpitch.magicValue = 0.0025 * Math.max(0.15, S.smooth);

            if (origCamFov === null && typeof cam.fov === 'number') {
                origCamFov = cam.fov;
            }
            const isScoped = !!(me.isScoped || me.scoped || me.zoomed || me.isZoomed ||
                (H.scoped && me[H.scoped]) || (H.isScoped && me[H.isScoped]) ||
                (me[H.weapon] && (me[H.weapon].isScoped || me[H.weapon].scoped)));

            if (!isScoped) {
                let targetFov = S.camFov > 0 ? S.camFov * DEG : (origCamFov !== null ? origCamFov : 0.8);
                const isZooming = S.sniperZoom && keys.has(S.zoomKey || 'KeyC');
                if (isZooming) {
                    targetFov = (S.zoomFov || 25) * DEG;
                }
                if (Math.abs(cam.fov - targetFov) > 0.005) {
                    cam.fov += (targetFov - cam.fov) * 0.35;
                }
            }

            const cross = new BABYLON.Vector3();
            cross.copyFrom(me[H.actor][H.mesh].position);
            cross.y += 0.4;
            const yaw = me[H.yaw], pitch = -me[H.pitch], off = -5;
            cross.x += Math.sin(yaw) * Math.cos(pitch) * off;
            cross.y += Math.sin(pitch) * off;
            cross.z += Math.cos(yaw) * Math.cos(pitch) * off;

            const tc = Date.now();
            const fovRad = S.aimFov * DEG;

            let target = null, best = Infinity;
            let closestP = null, closestDist = Infinity;
            let autoFireEnemy = null, bestFireAng = Infinity;
            const myId = me[H.uniqueId] || me.uniqueId || me.id;

            // sustained teleport write
            applyTeleport(me);

            // velocity drive fallback
            if (Date.now() < teleportDriveUntil && teleportTargetPos && me) {
                try {
                    const toX = teleportTargetPos.x - me[H.x];
                    const toZ = teleportTargetPos.z - me[H.z];
                    const distH = Math.hypot(toX, toZ);
                    if (distH > 0.3) {
                        const dirX = toX / distH;
                        const dirZ = toZ / distH;
                        if (typeof me.dx === 'number') me.dx = dirX * 0.28;
                        if (typeof me.$a === 'number') me.$a = dirZ * 0.28;
                        if (typeof me.Va === 'number') me.Va = dirX * 0.28;
                        if (typeof me.Ya === 'number') me.Ya = dirZ * 0.28;
                        if (typeof me.Ia === 'number') me.Ia |= 1;
                    }
                } catch (e) { }
            }

            checkAutoEscape(me);
            updateEnemyManipulation(me);
            updateGrenadeTrajectory(me);
            updateStatsHud(me);

            for (const P of ss.PLAYERS) {
                if (!P || P === me) continue;
                const pId = P[H.uniqueId] || P.uniqueId || P.id;
                if (pId && myId && pId === myId) continue;

                const isMate = me.team !== 0 && P.team === me.team;
                if (isMate) {
                    killLabel(P);
                    if (P.box) {
                        try { P.box.dispose(); } catch (e) { }
                        P.box = null;
                    }
                    if (P[tracersKey]) {
                        try { P[tracersKey].dispose(); } catch (e) { }
                        P[tracersKey] = null;
                    }
                    P.generatedESP = false;
                    continue;
                }

                const pHp = (H.hp && typeof P[H.hp] === 'number') ? P[H.hp] :
                            (typeof P.kb === 'number' ? P.kb : (typeof P.hp === 'number' ? P.hp : 100));
                const isAlive = !!P[H.playing] && pHp > 0;
                if (!isAlive || !P[H.actor] || !P[H.actor][H.mesh]) {
                    killLabel(P);
                    if (P.box) {
                        try { P.box.dispose(); } catch (e) { }
                        P.box = null;
                    }
                    if (P[tracersKey]) {
                        try { P[tracersKey].dispose(); } catch (e) { }
                        P[tracersKey] = null;
                    }
                    P.generatedESP = false;
                    continue;
                }

                P.timecode = tc;

                if (S.espBox) {
                    if (!P.generatedESP || !P.box) {
                        const bs = { w: 0.4, h: 0.65, d: 0.4 };
                        const v = [
                            new BABYLON.Vector3(-bs.w / 2, 0, -bs.d / 2),
                            new BABYLON.Vector3(bs.w / 2, 0, -bs.d / 2),
                            new BABYLON.Vector3(bs.w / 2, bs.h, -bs.d / 2),
                            new BABYLON.Vector3(-bs.w / 2, bs.h, -bs.d / 2),
                            new BABYLON.Vector3(-bs.w / 2, 0, bs.d / 2),
                            new BABYLON.Vector3(bs.w / 2, 0, bs.d / 2),
                            new BABYLON.Vector3(bs.w / 2, bs.h, bs.d / 2),
                            new BABYLON.Vector3(-bs.w / 2, bs.h, bs.d / 2)
                        ];
                        const lines = [];
                        for (let i = 0; i < 4; i++) {
                            lines.push([v[i], v[(i + 1) % 4]]);
                            lines.push([v[i + 4], v[(i + 1) % 4 + 4]]);
                            lines.push([v[i], v[i + 4]]);
                        }
                        const box = BABYLON.MeshBuilder.CreateLineSystem(getScrambled(), { lines }, ss.SCENE);
                        box[H.renderingGroupId] = 1;
                        box.parent = P[H.actor][H.mesh];
                        box.color = BABYLON.Color3.FromHexString('#ffffff');
                        P.box = box;
                        P.generatedESP = true;
                        ESPArray.push([box, makeTracer(P, cross), P]);
                    }
                    P.box.visibility = true;
                } else if (P.box) {
                    P.box.visibility = false;
                }

                makeTracer(P, cross);

                const pDist = Math.hypot(P[H.x] - me[H.x], P[H.y] - me[H.y], P[H.z] - me[H.z]);
                if (pDist < closestDist) {
                    closestDist = pDist;
                    closestP = P;
                }

                if (S.espName || S.espHealth || S.espDistance) {
                    const l = labelFor(P);
                    const pos = P[H.actor][H.mesh].position.clone();
                    pos.y += 1.0;
                    const pr = BABYLON.Vector3.Project(pos, world, xf, vp);
                    if (pr.z > 0 && pr.z < 1) {
                        l.d.style.display = 'block';
                        l.d.style.left = pr.x + 'px';
                        l.d.style.top = pr.y + 'px';

                        const rawName = (H.name_ && P[H.name_] !== undefined) ? P[H.name_] :
                                        (H.name && P[H.name] !== undefined) ? P[H.name] :
                                        (P.ga !== undefined ? P.ga : P.name);
                        if (S.espName && rawName !== undefined && rawName !== null && rawName !== '') {
                            l.nm.style.display = 'block';
                            l.nm.textContent = String(rawName);
                            l.nm.style.color = '#fff';
                        } else {
                            l.nm.style.display = 'none';
                            l.nm.textContent = '';
                        }

                        if (S.espDistance) {
                            l.dist.style.display = 'block';
                            l.dist.textContent = Math.round(pDist) + 'm';
                            l.dist.style.color = '#fff';
                        } else {
                            l.dist.style.display = 'none';
                            l.dist.textContent = '';
                        }

                        const rawHp = (H.hp && typeof P[H.hp] === 'number') ? P[H.hp] :
                                      (typeof P.kb === 'number') ? P.kb :
                                      (H.health && typeof P[H.health] === 'number') ? P[H.health] :
                                      (typeof P.hp === 'number') ? P.hp :
                                      (typeof P.health === 'number') ? P.health : undefined;
                        if (S.espHealth && typeof rawHp === 'number') {
                            l.bar.style.display = 'block';
                            l.fill.style.width = Math.max(0, Math.min(100, rawHp)) + '%';
                            l.fill.style.background = rawHp > 60 ? '#3dff6e' : rawHp > 30 ? '#ffd23d' : '#ff3d3d';
                        } else {
                            l.bar.style.display = 'none';
                        }
                    } else l.d.style.display = 'none';
                } else killLabel(P);

                if (S.enabled) {
                    const a = anglesTo(P, me);
                    if (typeof a.ang === 'number' && !isNaN(a.ang)) {
                        if (a.ang <= S.autoFireFov * DEG && pDist <= 75 && pDist >= 0.5 && a.ang < bestFireAng) {
                            bestFireAng = a.ang;
                            autoFireEnemy = { P, ...a, dist: pDist };
                        }
                        if (a.ang <= fovRad && pDist >= 0.5) {
                            let score = S.targetMode === 'nearest' ? pDist : a.ang;
                            if (P === lastTargetPlayer) score *= 0.75;
                            if (score < best) { best = score; target = { P, ...a, dist: pDist }; }
                        }
                    }
                }
            }

            const whiteCol = BABYLON.Color3.FromHexString('#ffffff');
            const redCol = BABYLON.Color3.FromHexString('#ff2222');
            for (const P of ss.PLAYERS) {
                if (!P || P === me || !P[H.playing]) continue;
                if (me.team !== 0 && P.team === me.team) continue;
                if (P.box) {
                    P.box.color = (S.highlightClosest && P === closestP) ? redCol : whiteCol;
                }
                if (P[tracersKey]) {
                    P[tracersKey].color = (S.highlightClosest && P === closestP) ? redCol : whiteCol;
                }
            }

            if (aiming() && target) {
                yawpitch.setToYawPitch(target.yaw, target.pitch);
                lastTargetPlayer = target.P;
            } else {
                lastTargetPlayer = null;
            }

            let wantFire = true;
            if (!S.enabled) {
                wantFire = false;
            } else if (!S.autoFire) {
                wantFire = false;
            } else if (panel && !S.autoFireWhenMenuOpen) {
                wantFire = false;
            } else if (!autoFireEnemy) {
                wantFire = false;
            } else if (autoFireEnemy && autoFireEnemy.ang > S.autoFireFov * DEG) {
                wantFire = false;
            }

            const now = Date.now();
            if (wantFire) {
                if (!firing) {
                    if (now - lastShotAt >= (S.autoFireDelay || 0)) {
                        firing = true;
                        burstStartAt = now;
                        fireEvent(true);
                    }
                } else {
                    const delay = Math.max(30, S.autoFireDelay || 0);
                    if (now - lastShotAt >= delay) {
                        fireEvent(false);
                        fireEvent(true);
                        burstStartAt = now;
                    } else if (now - burstStartAt >= 4000) {
                        fireEvent(false);
                        fireEvent(true);
                        burstStartAt = now;
                    }
                }
            } else {
                if (firing) {
                    firing = false;
                    releaseFramesRemaining = 3;
                    fireEvent(false);
                }
            }

            if (statusEl) {
                const activeTgt = autoFireEnemy || target;
                const tgtStr = activeTgt ? (activeTgt.ang / DEG).toFixed(1) + '°' : '-';
                const fireState = !S.autoFire ? 'OFF' : (firing ? 'FIRING' : (autoFireEnemy ? 'LOCKED' : 'READY'));
                statusEl.textContent =
                    `tgt ${tgtStr} | fire ${fireState} | ${ammoStatusStr} | ${healthStatusStr} | esc ${escReason}`;
            }

            for (let i = ESPArray.length - 1; i >= 0; i--) {
                const P = ESPArray[i][2];
                const isMate = P && me.team !== 0 && P.team === me.team;
                if (P && P.timecode === tc && P[H.playing] && !isMate) continue;
                try { ESPArray[i][0].dispose(); } catch (e) { }
                try { ESPArray[i][1].dispose(); } catch (e) { }
                killLabel(P);
                if (P) {
                    P.box = null;
                    P[tracersKey] = null;
                    P.generatedESP = false;
                }
                ESPArray.splice(i, 1);
            }

            ensureOverlay();
            const ring = document.getElementById('lm-fovring');
            const sp = document.getElementById('lm-shootpoint');

            // Dynamic color state: idle -> aim lock -> fire cone
            let activeColor = S.fovColor || '#00f0ff';
            if (S.fovDynamicColor) {
                if (firing || (autoFireEnemy && autoFireEnemy.ang <= (S.autoFireFov || 3.5) * DEG)) {
                    activeColor = '#ff1744'; // Hot red on fire or fire-cone lock
                } else if (target) {
                    activeColor = '#ffea00'; // Electric gold on aimbot target lock
                }
            }

            // Update FOV Ring (with safe boundary fallbacks so it never vanishes)
            if (ring) {
                if (S.fovCircle && S.enabled) {
                    const camFov = (cam && typeof cam.fov === 'number' && cam.fov > 0.05) ? cam.fov : 0.8;
                    let r = (S.aimFov * DEG / (camFov / 2)) * (innerHeight / 2);
                    if (!isFinite(r) || isNaN(r) || r < 4) r = 60;
                    r = Math.min(r, Math.max(innerWidth, innerHeight) * 0.95);

                    ring.style.display = 'block';
                    ring.style.width = (r * 2) + 'px';
                    ring.style.height = (r * 2) + 'px';
                    ring.style.color = activeColor;
                    ring.style.borderColor = activeColor;
                    ring.style.boxShadow = `0 0 10px ${activeColor}88, inset 0 0 8px ${activeColor}33`;
                } else {
                    ring.style.display = 'none';
                }
            }

            // Update Center Advanced Shoot Point Reticle
            if (sp) {
                if (S.shootPoint && S.enabled) {
                    const curStyle = S.shootPointStyle || 'cyber';
                    if (lastRenderedStyle !== curStyle) {
                        lastRenderedStyle = curStyle;
                        sp.innerHTML = getShootPointSvg(curStyle);
                    }
                    sp.style.display = 'block';
                    sp.style.color = activeColor;
                    const scale = firing ? '1.25' : (target ? '1.1' : '1.0');
                    sp.style.transform = `translate(-50%, -50%) scale(${scale})`;
                } else {
                    sp.style.display = 'none';
                }
            }
        } catch (e) {
            if (!frameErrorLogged) {
                frameErrorLogged = true;
                log('Frame callback error:', e);
            }
        }
    });

    // ================= GUI =================
    let panel = null;
    let panelDrag = false, panelOx = 0, panelOy = 0;
    const onPanelMouseMove = e => {
        if (!panelDrag || !panel) return;
        panel.style.left = (e.clientX - panelOx) + 'px';
        panel.style.top = (e.clientY - panelOy) + 'px';
        panel.style.right = 'auto';
    };
    onPanelMouseMove.__lmUI = true;
    document.addEventListener('mousemove', onPanelMouseMove);

    const onPanelMouseUp = () => { panelDrag = false; };
    onPanelMouseUp.__lmUI = true;
    document.addEventListener('mouseup', onPanelMouseUp);

    function row(parent, label) {
        try {
            const d = document.createElement('div');
            d.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0';
            const s = document.createElement('span');
            s.textContent = label;
            d.appendChild(s);
            parent.appendChild(d);
            return d;
        } catch (e) {
            return document.createElement('div');
        }
    }
    function check(parent, label, key) {
        try {
            const d = row(parent, label);
            const c = document.createElement('input');
            c.type = 'checkbox'; c.checked = !!S[key]; c.style.cssText = 'accent-color:#00b4d8;cursor:pointer';
            c.onchange = () => {
                try {
                    S[key] = c.checked;
                    save();
                } catch (e) { }
            };
            d.appendChild(c);
        } catch (e) { }
    }
    function range(parent, label, key, min, max, step) {
        try {
            const val = typeof S[key] === 'number' && !isNaN(S[key]) ? S[key] : min;
            const d = row(parent, label + ': ' + val);
            const i = document.createElement('input');
            i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val;
            i.style.cssText = 'width:110px;accent-color:#00b4d8;cursor:pointer';
            i.oninput = () => {
                try {
                    const num = +i.value;
                    if (!isNaN(num)) {
                        S[key] = num;
                        if (d.firstChild) d.firstChild.textContent = label + ': ' + num;
                        save();
                    }
                } catch (e) { }
            };
            d.appendChild(i);
        } catch (e) { }
    }
    function select(parent, label, key, opts) {
        try {
            const d = row(parent, label);
            const s = document.createElement('select');
            s.style.cssText = 'background:#132337;color:#e0f2fe;border:1px solid #0284c7;border-radius:4px;font:11px monospace;padding:2px 4px';
            opts.forEach(([v, t]) => {
                try {
                    const o = document.createElement('option');
                    o.value = v; o.textContent = t; if (S[key] === v) o.selected = true;
                    s.appendChild(o);
                } catch (e) { }
            });
            s.onchange = () => {
                try {
                    S[key] = s.value;
                    save();
                } catch (e) { }
            };
            d.appendChild(s);
        } catch (e) { }
    }
    function color(parent, label, key) {
        try {
            const d = row(parent, label);
            const i = document.createElement('input');
            i.type = 'color'; i.value = S[key] || '#ffffff'; i.style.cssText = 'width:40px;height:18px;border:none;background:none;cursor:pointer';
            i.oninput = () => {
                try {
                    S[key] = i.value;
                    save();
                } catch (e) { }
            };
            d.appendChild(i);
        } catch (e) { }
    }
    function head(parent, text) {
        try {
            const h = document.createElement('div');
            h.textContent = text;
            h.style.cssText = 'color:#00e5ff;font-weight:bold;margin:8px 0 3px;border-bottom:1px solid rgba(0,180,216,0.3);padding-bottom:3px;letter-spacing:0.3px';
            parent.appendChild(h);
        } catch (e) { }
    }
    function btn(parent, text, fn) {
        try {
            const b = document.createElement('button');
            b.textContent = text;
            b.style.cssText = 'flex:1;background:#132337;color:#bae6fd;border:1px solid #0284c7;border-radius:4px;cursor:pointer;font:11px monospace;padding:4px 6px;transition:all .15s ease';
            b.onmouseenter = () => { b.style.background = '#0284c7'; b.style.color = '#ffffff'; b.style.boxShadow = '0 0 8px rgba(0,180,216,0.4)'; };
            b.onmouseleave = () => { b.style.background = '#132337'; b.style.color = '#bae6fd'; b.style.boxShadow = 'none'; };
            b.onclick = () => {
                try { fn(); } catch (e) { }
            };
            parent.appendChild(b);
            return b;
        } catch (e) {
            return document.createElement('button');
        }
    }

    function bindKey(button, onPick, currentText) {
        try {
            button.textContent = 'press...';
            const h = e => {
                try {
                    e.preventDefault(); e.stopPropagation();
                    onPick(e.code);
                    button.textContent = currentText();
                } catch (err) { }
                document.removeEventListener('keydown', h, true);
            };
            h.__lmUI = true;
            document.addEventListener('keydown', h, true);
        } catch (e) { }
    }

    function applyPreset(name) {
        try {
            if (name === 'legit') {
                Object.assign(S, {
                    aimMode: 'hold', aimFov: 25, smooth: 2.5, targetMode: 'crosshair',
                    autoFire: false, autoFireOnlyAiming: false, autoFireFov: 2, autoFireDelay: 50,
                    prediction: true, aimHeight: 0.35, autoJump: false,
                    espBox: true, espTracer: false, espName: true, espHealth: false, espDistance: false,
                    hideOwnBody: true, hideOwnGun: false, highlightClosest: true, fovCircle: true, camFov: 0
                });
            } else {
                Object.assign(S, {
                    aimMode: 'hold', aimFov: 70, smooth: 0.35, targetMode: 'crosshair',
                    autoFire: true, autoFireOnlyAiming: false, autoFireFov: 4, autoFireDelay: 50,
                    prediction: true, aimHeight: 0.40, autoJump: true,
                    espBox: true, espTracer: true, espName: true, espHealth: true, espDistance: true,
                    hideOwnBody: true, hideOwnGun: true, highlightClosest: true, fovCircle: true, camFov: 90
                });
            }
            save(); if (panel) { panel.remove(); panel = null; } buildPanel();
        } catch (e) { }
    }

    function buildPanel() {
        try {
            panel = document.createElement('div');
            panel.id = 'st-panel';
            panel.style.cssText = 'position:fixed;top:60px;right:16px;width:290px;max-height:470px;display:flex;flex-direction:column;pointer-events:auto;background:rgba(10,18,30,.96);color:#e2e8f0;font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;padding:9px 12px;border:1.5px solid #00b4d8;border-radius:10px;z-index:2147483600;box-shadow:0 8px 32px rgba(0,0,0,.85), 0 0 16px rgba(0,180,216,0.25);user-select:none';

            const stopEv = e => e.stopPropagation();
            stopEv.__lmUI = true;
            panel.addEventListener('pointerdown', stopEv);
            panel.addEventListener('mousedown', stopEv);
            panel.addEventListener('mouseup', stopEv);
            panel.addEventListener('wheel', stopEv);

            const headBar = document.createElement('div');
            headBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;cursor:move;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid rgba(0,180,216,0.3)';

            const title = document.createElement('div');
            title.innerHTML = '<span style="color:#00e5ff;font-weight:bold;font-size:13px;letter-spacing:0.5px;text-shadow:0 0 8px rgba(0,229,255,0.5)">ST v3.1</span> <span style="color:#64748b;font-size:10px">by hasithx</span>';
            headBar.appendChild(title);

            const closeBtn = document.createElement('div');
            closeBtn.textContent = '×';
            closeBtn.title = 'Close menu (Toggle with ~ or Insert)';
            closeBtn.style.cssText = 'cursor:pointer;color:#aaa;font-weight:bold;font-size:16px;line-height:12px;padding:2px 4px;border-radius:3px';
            closeBtn.onmouseenter = () => closeBtn.style.color = '#fff';
            closeBtn.onmouseleave = () => closeBtn.style.color = '#aaa';
            closeBtn.onclick = e => {
                e.stopPropagation();
                togglePanel();
            };
            headBar.appendChild(closeBtn);
            panel.appendChild(headBar);

            statusEl = document.createElement('div');
            statusEl.style.cssText = 'color:#38bdf8;margin-bottom:6px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#09131f;padding:4px 8px;border-radius:5px;border:1px solid rgba(0,180,216,0.25)';
            statusEl.textContent = 'waiting for game...';
            panel.appendChild(statusEl);

            const tabRow = document.createElement('div');
            tabRow.style.cssText = 'display:flex;gap:3px;margin-bottom:8px';
            panel.appendChild(tabRow);

            const tabs = ['combat', 'escape', 'enemies', 'visuals', 'misc', 'config'];
            const tabLabels = { combat: 'Combat', escape: 'Escape', enemies: 'Enemies', visuals: 'Visuals', misc: 'Misc', config: 'Config' };
            const tabButtons = {};
            const tabPages = {};

            const contentArea = document.createElement('div');
            contentArea.style.cssText = 'overflow-y:auto;max-height:340px;padding-right:2px;overscroll-behavior:contain';
            panel.appendChild(contentArea);

            let activeTab = S.activeTab || 'combat';
            if (!tabs.includes(activeTab)) activeTab = 'combat';

            function switchTab(t) {
                activeTab = t;
                S.activeTab = t;
                save();
                tabs.forEach(name => {
                    if (tabPages[name]) tabPages[name].style.display = (name === t) ? 'block' : 'none';
                    if (tabButtons[name]) {
                        tabButtons[name].style.background = (name === t) ? 'linear-gradient(135deg, #00b4d8, #0077b6)' : '#101d2d';
                        tabButtons[name].style.color = (name === t) ? '#ffffff' : '#94a3b8';
                        tabButtons[name].style.boxShadow = (name === t) ? '0 0 10px rgba(0,180,216,0.5)' : 'none';
                        tabButtons[name].style.fontWeight = (name === t) ? 'bold' : 'normal';
                    }
                });
            }

            tabs.forEach(t => {
                const b = document.createElement('button');
                b.textContent = tabLabels[t];
                b.style.cssText = 'flex:1;border:none;border-radius:4px;padding:5px 1px;font:10px monospace;cursor:pointer;transition:all .15s ease;background:#101d2d;color:#94a3b8';
                b.onclick = () => switchTab(t);
                tabRow.appendChild(b);
                tabButtons[t] = b;

                const page = document.createElement('div');
                page.style.display = 'none';
                contentArea.appendChild(page);
                tabPages[t] = page;
            });

            const pageCombat = tabPages.combat;
            check(pageCombat, 'Auto fire', 'autoFire');
            check(pageCombat, 'Lead prediction', 'prediction');
            range(pageCombat, 'Aim height', 'aimHeight', 0.1, 0.55, 0.05);
            range(pageCombat, 'Fire FOV', 'autoFireFov', 0.5, 15, 0.5);
            range(pageCombat, 'Fire delay (ms)', 'autoFireDelay', 0, 300, 5);
            check(pageCombat, 'Fire in menu', 'autoFireWhenMenuOpen');
            const kb = row(pageCombat, 'Aim key');
            const kbBtn = btn(kb, S.aimKeys.join(',') || 'none', () => {
                bindKey(kbBtn, code => {
                    S.aimKeys = [code];
                    save();
                }, () => S.aimKeys.join(','));
            });
            kbBtn.style.flex = '0 0 auto';
            range(pageCombat, 'Aim FOV', 'aimFov', 5, 180, 1);
            range(pageCombat, 'Smoothness', 'smooth', 0.15, 4, 0.05);
            head(pageCombat, 'Sniper Zoom (Binoculars)');
            check(pageCombat, 'Sniper zoom mode', 'sniperZoom');
            const zk = row(pageCombat, 'Zoom key');
            const zkBtn = btn(zk, S.zoomKey || 'KeyC', () => {
                bindKey(zkBtn, code => {
                    S.zoomKey = code;
                    save();
                }, () => S.zoomKey || 'KeyC');
            });
            zkBtn.style.flex = '0 0 auto';
            range(pageCombat, 'Zoom FOV (deg)', 'zoomFov', 10, 50, 5);

            const pageEscape = tabPages.escape;
            check(pageEscape, 'Auto escape', 'autoEscape');
            range(pageEscape, 'Escape HP', 'escapeHp', 10, 90, 5);
            range(pageEscape, 'Search radius (m)', 'escapeRadius', 3, 15, 1);
            range(pageEscape, 'Teleport ms', 'teleportMs', 200, 2000, 50);
            const pBtnRow = row(pageEscape, 'Points');
            btn(pBtnRow, 'Save Point (G)', () => saveCurrentPoint());
            btn(pBtnRow, 'Go To (H)', () => gotoNearestPoint());

            const tRow = row(pageEscape, 'Test');
            btn(tRow, 'TP +10m X', () => {
                const me = ss.MYPLAYER;
                if (!me) { showToast('not in match'); return; }
                startTeleport(me[H.x] + 10, me[H.y], me[H.z]);
                showToast('test teleport +10m X');
            });
            btn(tRow, 'TP +10m Z', () => {
                const me = ss.MYPLAYER;
                if (!me) { showToast('not in match'); return; }
                startTeleport(me[H.x], me[H.y], me[H.z] + 10);
                showToast('test teleport +10m Z');
            });

            const escInfo = document.createElement('div');
            escInfo.style.cssText = 'color:#888;font-size:10px;margin-top:8px;line-height:1.4;border-top:1px solid #282828;padding-top:6px';
            escInfo.innerHTML = '<b>Auto Escape:</b> Relocates player to cover when HP drops.<br>• Raycasts 12 candidate spots.<br>• Teleports &amp; drives velocity into cover.<br>• Keys: <b>[G]</b> Save | <b>[H]</b> Goto<br>• Status shows <b>esc reason</b>';
            pageEscape.appendChild(escInfo);

            const pageEnemies = tabPages.enemies;
            check(pageEnemies, 'Freeze enemies', 'freezeEnemies');
            select(pageEnemies, 'Mode', 'freezeMode', [
                ['hold', 'Hold spot'],
                ['pull', 'Pull front'],
                ['aimserver', 'Aim Server (Hit Reg)']
            ]);
            range(pageEnemies, 'Pull distance', 'pullDistance', 3, 25, 1);
            const enemyNote = document.createElement('div');
            enemyNote.style.cssText = 'color:#888;font-size:10px;margin-top:8px;line-height:1.4;border-top:1px solid #282828;padding-top:6px';
            enemyNote.innerHTML = '<b>Notice:</b> Game is server-authoritative.<br>• <i>Hold/Pull:</i> Overwrites visual meshes.<br>• <i>Aim Server:</i> Aimbot targets actual server position.';
            pageEnemies.appendChild(enemyNote);

            const pageVis = tabPages.visuals;
            check(pageVis, 'ESP boxes', 'espBox');
            check(pageVis, 'ESP tracers', 'espTracer');
            check(pageVis, 'ESP names', 'espName');
            check(pageVis, 'ESP health', 'espHealth');
            check(pageVis, 'ESP distance', 'espDistance');
            check(pageVis, 'Closest red box', 'highlightClosest');
            head(pageVis, 'Aim & Crosshair Reticle');
            check(pageVis, 'FOV ring', 'fovCircle');
            check(pageVis, 'Advance shoot point', 'shootPoint');
            select(pageVis, 'Reticle style', 'shootPointStyle', [
                ['cyber', 'Cyber HUD'],
                ['crosshair', 'Crosshair'],
                ['dot', 'Glowing Dot'],
                ['circle', 'Circle Reticle']
            ]);
            check(pageVis, 'Dynamic lock color', 'fovDynamicColor');
            color(pageVis, 'Reticle color', 'fovColor');
            range(pageVis, 'Camera FOV (0=def)', 'camFov', 0, 130, 5);
            head(pageVis, 'Tactical Predictor & HUD');
            check(pageVis, 'Grenade trajectory arc', 'grenadeTrajectory');
            check(pageVis, 'On-screen stats HUD', 'statsHud');

            const pageMisc = tabPages.misc;
            check(pageMisc, 'Auto jump (B-Hop)', 'autoJump');
            check(pageMisc, 'Infinite ammo', 'infiniteAmmo');
            range(pageMisc, 'Ammo count', 'ammoValue', 50, 9999, 50);
            check(pageMisc, 'Hold max health', 'holdHealth');
            check(pageMisc, 'Hide own body', 'hideOwnBody');
            check(pageMisc, 'Hide own gun', 'hideOwnGun');

            const pageCfg = tabPages.config;
            const pRow = row(pageCfg, 'Presets');
            btn(pRow, 'Legit', () => applyPreset('legit'));
            btn(pRow, 'Rage', () => applyPreset('rage'));

            const aRow = row(pageCfg, 'Actions');
            btn(aRow, 'Reset All', () => {
                Object.assign(S, DEF);
                save();
                if (panel) { panel.remove(); panel = null; }
                buildPanel();
            });
            btn(aRow, 'Dump State', () => {
                if (typeof window.ST_DUMP === 'function') window.ST_DUMP();
            });

            const info = document.createElement('div');
            info.style.cssText = 'color:#777;font-size:10px;margin-top:10px;line-height:1.4;border-top:1px solid #282828;padding-top:6px';
            info.innerHTML = 'Menu toggle: <b>[~]</b> or <b>[Insert]</b><br>Aim: <b>Right-Click (Mouse2)</b>';
            pageCfg.appendChild(info);

            switchTab(activeTab);

            const onDragStart = e => {
                panelDrag = true;
                panelOx = e.clientX - panel.offsetLeft;
                panelOy = e.clientY - panel.offsetTop;
                e.stopPropagation();
            };
            onDragStart.__lmUI = true;
            headBar.addEventListener('mousedown', onDragStart);

            document.body.appendChild(panel);
        } catch (e) { }
    }

    function togglePanel() {
        try {
            if (panel) {
                panel.remove();
                panel = null;
                statusEl = null;
                restorePointerLock();
                document.body.style.cursor = '';
                const c = document.querySelector('canvas');
                try {
                    if (c && c.requestPointerLock && !document.pointerLockElement) c.requestPointerLock();
                } catch (e) { }
                return;
            }
            hookPointerLock();
            try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
            document.body.style.cursor = 'default';
            buildPanel();
        } catch (e) { }
    }

    const boot = () => {
        if (document.body) { ensureOverlay(); ensureBadge(); }
        else setTimeout(boot, 100);
    };
    boot();
    log('ST v3.1 loaded');
})();