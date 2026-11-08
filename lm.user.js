// ==UserScript==
// @name         Shell Shockers Aimbot + ESP (LM v2.6)
// @namespace    https://github.com/hasithx/shellshockers/
// @license      GPL-3.0
// @version      2.6.0
// @author       hasithx
// @description  ESP, tracers, auto-fire, FOV aimbot, self-hide, closest highlight, infinite ammo, modern tabbed GUI
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
            `color: white; font-weight: bold; background:rgb(212, 212, 0); padding: 2px 6px; border-radius: 5px; margin-right: 5px;`,
            `LM`,
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
        hideOwnBody: false,
        hideOwnGun: false,
        infiniteAmmo: false,
        holdHealth: false,
        ammoValue: 999,
        panelKeys: ['Insert', 'Backquote'],
        activeTab: 'combat'
    };
    const S = Object.assign({}, DEF, (() => {
        try { return JSON.parse(localStorage.getItem('lm_cfg_v2') || '{}'); } catch (e) { return {}; }
    })());
    if (!Array.isArray(S.panelKeys)) S.panelKeys = DEF.panelKeys.slice();
    const save = () => { try { localStorage.setItem('lm_cfg_v2', JSON.stringify(S)); } catch (e) { } };

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

    // Phase 2: getShootingKey resolving to verified runtime triggerPulled property
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

    // Phase 2: fireEvent with call-time filtering, shot logging, and releaseTrigger() support
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
                // 2) Dispatch real PointerEvent and MouseEvent on canvas
                dispatchCanvasPointer(true);
                // 3) Call captured pointerdown/mousedown listeners (filtered at call time)
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
                // On release:
                // 1) Call captured pointerup/mouseup listeners (filtered at call time)
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
                // 2) Dispatch real PointerEvent and MouseEvent on canvas
                dispatchCanvasPointer(false);
                // 3) Set shooting field to false and call releaseTrigger()
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

    // Task 6: While the panel is open, patch HTMLCanvasElement.prototype.requestPointerLock to return early, and restore it on close
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

    // Phase 2: Unconditional capture for document, window, canvas, body, #game (filtered at call time)
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
        setToYawPitch: (yaw = 0, pitch = 0) => {
            if (!ss.MYPLAYER) return;
            const curYaw = ss.MYPLAYER[H.yaw] || 0;
            const curPitch = ss.MYPLAYER[H.pitch] || 0;
            const yd = yawpitch.radianAngleDiff(curYaw, yaw);
            const pd = yawpitch.radianAngleDiff(curPitch, pitch);
            const mx = yd / yawpitch.magicValue;
            const my = pd / yawpitch.magicValue;

            // (a) captured `real` pointermove listener
            if (yawpitch.realListener) {
                try {
                    const ev = makeFakeEvent('pointermove', false, {
                        movementX: Math.ceil(mx),
                        movementY: Math.ceil(my),
                        x: 1,
                        isTrusted: true
                    });
                    yawpitch.realListener.call(yawpitch.realTarget || window, ev);
                    try { yawpitch.getAndSetYawPitch(); } catch (e) { }
                    return;
                } catch (e) { }
            }

            // (b) unsafeWindow.set_mouse_params + the listener
            if (yawpitch.listener) {
                try {
                    yawpitch.setMouseParams();
                    const ev = makeFakeEvent('pointermove', false, {
                        movementX: Math.ceil(mx),
                        movementY: Math.ceil(my),
                        x: 1,
                        isTrusted: true
                    });
                    yawpitch.listener.call(yawpitch.listenerTarget || window, ev);
                    try { yawpitch.getAndSetYawPitch(); } catch (e) { }
                    return;
                } catch (e) { }
            }

            // (c) direct assignment ss.MYPLAYER[H.yaw] = yaw; ss.MYPLAYER[H.pitch] = pitch
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

    function LM_DUMP() {
        console.group('%c[LM_DUMP] Game State Snapshot', 'color:#e8c400;font-weight:bold');

        // 1. ss.MYPLAYER properties
        console.group('ss.MYPLAYER properties');
        if (typeof ss !== 'undefined' && ss.MYPLAYER) {
            const playerProps = getCleanProps(ss.MYPLAYER);
            console.table(Object.entries(playerProps).map(([key, value]) => ({
                key, type: typeof value, value
            })));
        } else {
            console.warn('ss.MYPLAYER is null or undefined (not in match?)');
        }
        console.groupEnd();

        // 2. ss.MYPLAYER[H.weapon] properties
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

        // 2b. ss.MYPLAYER[H.weapon].ammo properties
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

        // 3. H map entries matching target keywords
        console.group(`H Map Entries (Total keys: ${Object.keys(H || {}).length})`);
        const hRegex = /ammo|clip|mag|bullet|round|reserve|health|hp|life|reload|shoot|fire|weapon|scoped/i;
        const matchingH = {};
        if (H && typeof H === 'object') {
            for (const [k, v] of Object.entries(H)) {
                if (hRegex.test(k)) {
                    matchingH[k] = v;
                    console.log(`%c${k} %c-> %c${v}`, 'color:#8fd18f', 'color:#aaa', 'color:#e8c400;font-weight:bold');
                }
            }
        }
        console.groupEnd();

        // 4. fireDown and fireUp listeners
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

        // Update baseline snapshot for LM_DUMPDIFF
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

    function LM_DUMPDIFF() {
        if (!lastSnapshot) {
            console.warn('[LM_DUMPDIFF] No baseline snapshot stored. Running LM_DUMP() first to establish baseline.');
            return LM_DUMP();
        }

        console.group('%c[LM_DUMPDIFF] State Changes Since Last Dump', 'color:#00e5ff;font-weight:bold');
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

        // Diff player
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

        // Diff weapon
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

        // Diff ammo
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

        // Update snapshot to current state
        lastSnapshot = { player: curPlayer, weapon: curWeapon, ammo: curAmmo };
        return diffs;
        return diffs;
    }

    window.LM_DUMP = LM_DUMP;
    window.LM_DUMPDIFF = LM_DUMPDIFF;
    try {
        unsafeWindow.LM_DUMP = LM_DUMP;
        unsafeWindow.LM_DUMPDIFF = LM_DUMPDIFF;
    } catch (e) { }

    // ================= AMMO & HEALTH RESOLUTION (Tasks 4 & 5) =================
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
        // Proven runtime keys from live build inspection
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

    // Phase 3 & 4: Resolve Ammo and Health using proven runtime object paths
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

        // Resolve Magazine Ammo (fa)
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

        // Resolve Reserve Ammo (store)
        resolvedReserveTarget = null;
        resolvedReserveKey = null;
        if (ammoObj && typeof ammoObj.store === 'number') {
            resolvedReserveTarget = ammoObj;
            resolvedReserveKey = 'store';
        } else if (ammoObj && typeof ammoObj.Ua === 'number') {
            resolvedReserveTarget = ammoObj;
            resolvedReserveKey = 'Ua';
        }

        // Resolve Health: kb on MYPLAYER
        resolvedHealthTarget = null;
        resolvedHealthKey = null;
        if (typeof me.kb === 'number') {
            resolvedHealthTarget = me;
            resolvedHealthKey = 'kb';
        } else if (H.hp && typeof me[H.hp] === 'number') {
            resolvedHealthTarget = me;
            resolvedHealthKey = H.hp;
        }

        // Resolve Reload
        resolvedReloadTarget = me;
        resolvedReloadKey = 'reloading';
    }

    // Phase 3 & 4: Apply infinite ammo, hold health, and format live status
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

        // Phase 3: Infinite ammo
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

        // Phase 4: Hold max health (100)
        if (S.holdHealth) {
            me.kb = 100;
            if (H.hp && H.hp in me) me[H.hp] = 100;
        }

        // Live ammo status line
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

        // Live health status line
        const curHp = (H.hp && typeof me[H.hp] === 'number') ? me[H.hp] : (typeof me.kb === 'number' ? me.kb : null);
        if (curHp !== null) {
            healthStatusStr = `hp kb:${Math.round(curHp)}`;
        } else {
            healthStatusStr = 'hp ?';
        }
    }

    // ================= LABEL OVERLAY =================
    let overlay = null, labels = new Map();
    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'lm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden';
        const ring = document.createElement('div');
        ring.id = 'lm-fovring';
        ring.style.cssText = 'position:absolute;left:50%;top:50%;border:1px solid rgba(255,255,255,.35);border-radius:50%;transform:translate(-50%,-50%);display:none';
        overlay.appendChild(ring);
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
        if (badge || document.getElementById('lm-badge')) return;
        badge = document.createElement('div');
        badge.id = 'lm-badge';
        badge.textContent = 'LM';
        badge.title = 'LM menu — click to open';
        badge.style.cssText = 'position:fixed;left:12px;bottom:12px;width:36px;height:36px;border-radius:50%;background:rgba(16,16,16,.92);border:1px solid #e8c400;color:#e8c400;font:bold 12px monospace;display:flex;align-items:center;justify-content:center;z-index:2147483600;cursor:pointer;user-select:none';

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

    function anglesTo(P, me) {
        const dx = -(P[H.x] - me[H.x]);
        const dy = -(P[H.y] - me[H.y] - 0.05);
        const dz = -(P[H.z] - me[H.z]);
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

        // Cache original isVisible once per mesh
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

    // Tasks 1, 4, 6, 7: LIBERTYMUTUAL frame callback
    createAnonFunction("LIBERTYMUTUAL", function () {
        try {
            gameLoaded = true;
            ss.PLAYERS.forEach(P => { if (P && P.hasOwnProperty("ws")) ss.MYPLAYER = P; });
            if (!ss.MYPLAYER || !ss.SCENE || !ss.SCENE.activeCamera) return;

            // Task 7: Cache H.actor per match, invalidate on player identity change
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

            // Phase 2: Re-assert shooting state while firing; force released state for at least 3 frames after release
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

            // Bug 6: Capture cam.fov once, restore pre-hack FOV when camFov is 0, skip while scoped
            if (origCamFov === null && typeof cam.fov === 'number') {
                origCamFov = cam.fov;
            }
            const isScoped = !!(me.isScoped || me.scoped || me.zoomed || me.isZoomed ||
                (H.scoped && me[H.scoped]) || (H.isScoped && me[H.isScoped]) ||
                (me[H.weapon] && (me[H.weapon].isScoped || me[H.weapon].scoped)));

            if (!isScoped) {
                const targetFov = S.camFov > 0 ? S.camFov * DEG : (origCamFov !== null ? origCamFov : 0.8);
                if (Math.abs(cam.fov - targetFov) > 0.005) {
                    cam.fov = targetFov;
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

            // Task 3: Target list recomputed fresh every frame, target = null before loop
            let target = null, best = Infinity;
            let closestP = null, closestDist = Infinity;
            let autoFireEnemy = null, bestFireAng = Infinity;
            const myId = me[H.uniqueId] || me.uniqueId || me.id;

            for (const P of ss.PLAYERS) {
                if (!P || P === me) continue;
                const pId = P[H.uniqueId] || P.uniqueId || P.id;
                if (pId && myId && pId === myId) continue;

                // Task 8: Never draw for teammates; dispose on teammate transition
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

                // Task 8: Dispose on death (check playing flag, health, and mesh existence)
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
                        // Strict Auto-Fire check: enemy must be directly inside autoFireFov cone and within 75m
                        if (a.ang <= S.autoFireFov * DEG && pDist <= 75 && pDist >= 0.5 && a.ang < bestFireAng) {
                            bestFireAng = a.ang;
                            autoFireEnemy = { P, ...a, dist: pDist };
                        }
                        // Aimbot target check
                        if (a.ang <= fovRad && pDist >= 0.5) {
                            const score = S.targetMode === 'nearest' ? pDist : a.ang;
                            if (score < best) { best = score; target = { P, ...a, dist: pDist }; }
                        }
                    }
                }
            }

            // Task 8: Closest enemy box is red, all other enemy boxes white; updates in same frame
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

            if (aiming() && target) yawpitch.setToYawPitch(target.yaw, target.pitch);

            // Phase 2: Strict auto-fire gating in exact veto order
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
                    // Phase 2: Pulse cycling to support semi-auto weapons and enforce per-shot delay
                    const delay = Math.max(30, S.autoFireDelay || 0);
                    if (now - lastShotAt >= delay) {
                        fireEvent(false);
                        fireEvent(true);
                        burstStartAt = now;
                    } else if (now - burstStartAt >= 4000) {
                        // Watchdog: release and repress if held continuously > 4000ms
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

            // Status line shows clear state: OFF, READY, LOCKED, or FIRING
            if (statusEl) {
                const activeTgt = autoFireEnemy || target;
                const tgtStr = activeTgt ? (activeTgt.ang / DEG).toFixed(1) + '°' : '-';
                const fireState = !S.autoFire ? 'OFF' : (firing ? 'FIRING' : (autoFireEnemy ? 'LOCKED' : 'READY'));
                statusEl.textContent =
                    `tgt ${tgtStr} | fire ${fireState} | ${ammoStatusStr} | ${healthStatusStr}`;
            }

            // Task 4: Dispose dead and teammate players
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

            const ring = document.getElementById('lm-fovring');
            if (ring) {
                if (S.fovCircle && S.enabled) {
                    const r = (S.aimFov * DEG / (cam.fov / 2)) * (innerHeight / 2);
                    ring.style.display = 'block';
                    ring.style.width = ring.style.height = (r * 2) + 'px';
                } else ring.style.display = 'none';
            }
        } catch (e) {
            // Task 7: Log first occurrence only
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
            c.type = 'checkbox'; c.checked = !!S[key]; c.style.cssText = 'accent-color:#e8c400;cursor:pointer';
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
            i.style.cssText = 'width:110px;accent-color:#e8c400';
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
            s.style.cssText = 'background:#222;color:#fff;border:1px solid #444;border-radius:3px;font:11px monospace';
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
            h.style.cssText = 'color:#e8c400;font-weight:bold;margin:8px 0 3px;border-bottom:1px solid #333;padding-bottom:2px';
            parent.appendChild(h);
        } catch (e) { }
    }
    function btn(parent, text, fn) {
        try {
            const b = document.createElement('button');
            b.textContent = text;
            b.style.cssText = 'flex:1;background:#333;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;font:11px monospace;padding:3px';
            b.onclick = () => {
                try { fn(); } catch (e) { }
            };
            parent.appendChild(b);
            return b;
        } catch (e) {
            return document.createElement('button');
        }
    }

    // keeps aim key and menu keys from colliding
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
                    espBox: true, espTracer: false, espName: true, espHealth: false, espDistance: false,
                    hideOwnBody: true, hideOwnGun: false, highlightClosest: true, fovCircle: true, camFov: 0
                });
            } else {
                Object.assign(S, {
                    aimMode: 'hold', aimFov: 70, smooth: 0.35, targetMode: 'crosshair',
                    autoFire: true, autoFireOnlyAiming: false, autoFireFov: 4, autoFireDelay: 50,
                    espBox: true, espTracer: true, espName: true, espHealth: true, espDistance: true,
                    hideOwnBody: true, hideOwnGun: true, highlightClosest: true, fovCircle: true, camFov: 90
                });
            }
            save(); if (panel) { panel.remove(); panel = null; } buildPanel();
        } catch (e) { }
    }

    // Modern Tabbed Menu GUI (v2.6 by hasithx)
    function buildPanel() {
        try {
            panel = document.createElement('div');
            panel.id = 'lm-panel';
            panel.style.cssText = 'position:fixed;top:60px;right:16px;width:260px;max-height:380px;display:flex;flex-direction:column;pointer-events:auto;background:rgba(18,18,22,.96);color:#ddd;font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;padding:8px 10px;border:1px solid #e8c400;border-radius:8px;z-index:2147483600;box-shadow:0 8px 30px rgba(0,0,0,.8);user-select:none';

            const stopEv = e => e.stopPropagation();
            stopEv.__lmUI = true;
            panel.addEventListener('pointerdown', stopEv);
            panel.addEventListener('mousedown', stopEv);
            panel.addEventListener('mouseup', stopEv);
            panel.addEventListener('wheel', stopEv);

            // Title bar: drag handle, version, close button
            const headBar = document.createElement('div');
            headBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;cursor:move;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #333';

            const title = document.createElement('div');
            title.innerHTML = '<span style="color:#e8c400;font-weight:bold;font-size:12px">LM v2.6</span> <span style="color:#888;font-size:10px">by hasithx</span>';
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

            // Status bar
            statusEl = document.createElement('div');
            statusEl.style.cssText = 'color:#8fd18f;margin-bottom:6px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#141416;padding:3px 6px;border-radius:4px;border:1px solid #282828';
            statusEl.textContent = 'waiting for game...';
            panel.appendChild(statusEl);

            // Tabs navigation
            const tabRow = document.createElement('div');
            tabRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px';
            panel.appendChild(tabRow);

            const tabs = ['combat', 'visuals', 'misc', 'config'];
            const tabLabels = { combat: 'Combat', visuals: 'Visuals', misc: 'Misc', config: 'Config' };
            const tabButtons = {};
            const tabPages = {};

            const contentArea = document.createElement('div');
            contentArea.style.cssText = 'overflow-y:auto;max-height:260px;padding-right:2px;overscroll-behavior:contain';
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
                        tabButtons[name].style.background = (name === t) ? '#e8c400' : '#282830';
                        tabButtons[name].style.color = (name === t) ? '#111' : '#bbb';
                        tabButtons[name].style.fontWeight = (name === t) ? 'bold' : 'normal';
                    }
                });
            }

            tabs.forEach(t => {
                const b = document.createElement('button');
                b.textContent = tabLabels[t];
                b.style.cssText = 'flex:1;border:none;border-radius:4px;padding:4px 2px;font:10px monospace;cursor:pointer;transition:background .15s';
                b.onclick = () => switchTab(t);
                tabRow.appendChild(b);
                tabButtons[t] = b;

                const page = document.createElement('div');
                page.style.display = 'none';
                contentArea.appendChild(page);
                tabPages[t] = page;
            });

            // ====== TAB 1: COMBAT ======
            const pageCombat = tabPages.combat;
            check(pageCombat, 'Auto fire', 'autoFire');
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

            // ====== TAB 2: VISUALS ======
            const pageVis = tabPages.visuals;
            check(pageVis, 'ESP boxes', 'espBox');
            check(pageVis, 'ESP tracers', 'espTracer');
            check(pageVis, 'ESP names', 'espName');
            check(pageVis, 'ESP health', 'espHealth');
            check(pageVis, 'ESP distance', 'espDistance');
            check(pageVis, 'Closest red box', 'highlightClosest');
            check(pageVis, 'FOV ring', 'fovCircle');
            range(pageVis, 'Camera FOV (0=def)', 'camFov', 0, 130, 5);

            // ====== TAB 3: MISC ======
            const pageMisc = tabPages.misc;
            check(pageMisc, 'Infinite ammo', 'infiniteAmmo');
            range(pageMisc, 'Ammo count', 'ammoValue', 50, 9999, 50);
            check(pageMisc, 'Hold max health', 'holdHealth');
            check(pageMisc, 'Hide own body', 'hideOwnBody');
            check(pageMisc, 'Hide own gun', 'hideOwnGun');

            // ====== TAB 4: CONFIG ======
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
                if (typeof window.LM_DUMP === 'function') window.LM_DUMP();
            });

            const info = document.createElement('div');
            info.style.cssText = 'color:#777;font-size:10px;margin-top:10px;line-height:1.4;border-top:1px solid #282828;padding-top:6px';
            info.innerHTML = 'Menu toggle: <b>[~]</b> or <b>[Insert]</b><br>Aim: <b>Right-Click (Mouse2)</b>';
            pageCfg.appendChild(info);

            switchTab(activeTab);

            // Drag handling
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

    // Task 6: togglePanel with pointer lock management & cursor handling
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
    log('LM v2.5 loaded');
})();