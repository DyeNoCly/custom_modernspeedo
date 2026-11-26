/*
 * Cyber Speedometer — mengikuti API template jgvrp-speedometer-template.
 * Semua fungsi bersifat global dan dipanggil oleh host (tanpa NUI message / dependensi eksternal).
 *
 *   setEngine(bool)        setSpeed(m/s)          setRPM(0..1)
 *   setFuel(0..1)          setHealth(0..1)        setGear(string|number, 0 = netral/mundur)
 *   setHeadlights(0|1|2)   setLeftIndicator(bool) setRightIndicator(bool)
 *   setSeatbelts(bool)     setSpeedMode(0|1|2)    setOdometer(mil)
 */

// ---- Pengaturan tampilan (boleh diubah) ----
const CONFIG = {
    rpmFull: 9000,    // RPM yang ditampilkan saat setRPM(1)
    redline: 8500,    // lampu REV menyala mulai nilai ini
    gaugeMax: 12000,  // angka paling kanan pada busur gauge
    margin: 15,       // jarak HUD dari tepi (px), sama seperti template
    scale: 0.6,       // ukuran HUD: 1 = 520x380 px, 0.6 = kompak di pojok kanan bawah (bisa diganti lewat ?scale=0.5 di URL)
    engineAnim: true, // animasi saat mesin mati / hidup (false = langsung ganti tanpa animasi)
    bootMs: 900,      // durasi sapuan jarum (self-test) saat mesin hidup
};

// 0: KMH, 1: MPH, 2: Knots (sesuai template)
const UNITS = [
    { label: 'km/h',  speed: 3.6,      dist: 1.609344, distLabel: 'KM' },
    { label: 'mph',   speed: 2.236936, dist: 1,        distLabel: 'MI' },
    { label: 'knots', speed: 1.943844, dist: 0.868976, distLabel: 'NM' },
];

// ---- State (nilai mentah sesuai satuan template) ----
let speedMode = 0;
const state = {
    engine: null,       // boolean | null (belum diketahui)
    speed: 0,           // m/s
    rpm: 0,             // 0..1
    fuel: 0,            // 0..1
    health: null,       // 0..1 | null
    gear: 0,
    headlights: 0,      // 0 mati, 1 nyala, 2 lampu jauh
    left: false,
    right: false,
    seatbelts: null,    // boolean | null
    odometer: 0,        // mil
};

let elements = {};
let ready = false;
let shownRpm = 0;

const NS = 'http://www.w3.org/2000/svg';
const CX = 250, CY = 215, R_OUT = 168, R_IN = 150, R_LBL = 134;
const START = 170, SWEEP = 200, SEGMENTS = 72, LABEL_MAX = 12;
const segEls = [];

const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const clamp01 = v => Math.max(0, Math.min(1, v));
const rad = d => d * Math.PI / 180;
const pt = (r, deg) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];

// ---------------- API publik ----------------

/** @param {boolean} state true = mesin menyala */
function setEngine(value) {
    const next = !!value, prev = state.engine;
    state.engine = next;
    if (prev !== null && prev !== next) playEngineAnim(next);
    renderEngine();
    renderRevLight();
}

/** @param {number} speed kecepatan dalam meter/detik (m/s) */
function setSpeed(speed) {
    state.speed = Math.max(0, num(speed));
    renderSpeed();
}

/** @param {number} rpm 0..1 */
function setRPM(rpm) {
    state.rpm = clamp01(num(rpm));
    renderRevLight();
}

/** @param {number} fuel 0..1 */
function setFuel(fuel) {
    state.fuel = clamp01(num(fuel));
    renderFuel();
}

/** @param {number} health 0..1 */
function setHealth(health) {
    state.health = clamp01(num(health));
    renderHealth();
}

/** @param {string|number} gear 0 = netral/mundur */
function setGear(gear) {
    state.gear = gear;
    renderGear();
}

/** @param {number} state 0: Mati, 1: Nyala, 2: Lampu jauh */
function setHeadlights(value) {
    state.headlights = num(value);
    renderHeadlights();
}

/** @param {boolean} state */
function setLeftIndicator(value) {
    state.left = !!value;
    renderIndicators();
}

/** @param {boolean} state */
function setRightIndicator(value) {
    state.right = !!value;
    renderIndicators();
}

/** @param {boolean} state true = sabuk pengaman terpasang */
function setSeatbelts(value) {
    state.seatbelts = !!value;
    renderSeatbelts();
}

/** @param {number} mode 0: KMH, 1: MPH, 2: Knots */
function setSpeedMode(mode) {
    const m = Math.trunc(num(mode));
    speedMode = UNITS[m] ? m : 0;
    renderSpeed();
    renderOdometer();
}

/** @param {number} distance jarak dalam mil (otomatis dikonversi sesuai mode kecepatan) */
function setOdometer(distance) {
    state.odometer = Math.max(0, num(distance));
    renderOdometer();
}

// ---------------- Render ----------------

let bootStart = -Infinity;
let animTimer = 0;

// Animasi mesin: mati = kedip + meredup + jarum turun pelan; hidup = kedip + jarum menyapu (self-test)
function playEngineAnim(on) {
    if (!ready || !CONFIG.engineAnim) return;
    const hud = elements.hud;
    hud.classList.remove('shutdown', 'boot');
    void hud.offsetWidth; // restart animasi CSS
    hud.classList.add(on ? 'boot' : 'shutdown');
    if (on) bootStart = performance.now();
    clearTimeout(animTimer);
    animTimer = setTimeout(() => hud.classList.remove('shutdown', 'boot'), 1000);
}

function renderEngine() {
    if (!ready) return;
    elements.hud.classList.toggle('off', state.engine === false);
    if (state.engine === null) return;
    elements.engine.textContent = state.engine ? 'ON' : 'OFF';
    elements.engine.setAttribute('fill', state.engine ? '#38ff6b' : '#ff2d55');
}

function renderSpeed() {
    if (!ready) return;
    const u = UNITS[speedMode];
    const v = Math.min(999, Math.round(state.speed * u.speed));
    const s = String(v).padStart(3, ' ');
    ['s1', 's2', 's3'].forEach((id, i) => {
        elements[id].textContent = s[i] === ' ' ? ' ' : s[i];
    });
    elements.unit.textContent = u.label;
}

function renderFuel() {
    if (!ready) return;
    elements.fuel.textContent = `${Math.round(state.fuel * 100)}%`;
    elements.fuel.style.fill = state.fuel < 0.15 ? '#ff2d55' : '';
}

function renderHealth() {
    if (!ready || state.health === null) return;
    const h = state.health;
    elements.health.textContent = `${Math.round(h * 100)}%`;
    elements.health.setAttribute('fill', h > 0.6 ? '#38ff6b' : h > 0.3 ? '#ffb347' : '#ff2d55');
}

function gearLabel(g) {
    if (typeof g === 'string' && g.trim() !== '' && Number.isNaN(Number(g))) return g.trim().toUpperCase();
    const n = Math.trunc(num(g));
    if (n === 0) return 'N/R';
    if (n < 0) return 'R';
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' };
    return n + (suffix[n] || 'th');
}

function renderGear() {
    if (!ready) return;
    const text = gearLabel(state.gear);
    elements.gear.textContent = text;
    elements.gear.style.fontSize = text.length > 3 ? '20px' : text === 'N/R' ? '22px' : '';
}

function renderHeadlights() {
    if (!ready) return;
    elements.headlights.classList.toggle('low', state.headlights === 1);
    elements.headlights.classList.toggle('high', state.headlights === 2);
}

function renderIndicators() {
    if (!ready) return;
    elements.left.classList.toggle('on', state.left);
    elements.right.classList.toggle('on', state.right);
}

function renderSeatbelts() {
    if (!ready || state.seatbelts === null) return;
    elements.seatbelts.classList.toggle('ok', state.seatbelts);
    elements.seatbelts.classList.toggle('warn', !state.seatbelts);
}

function renderOdometer() {
    if (!ready) return;
    const u = UNITS[speedMode];
    elements.odometer.textContent = `${(state.odometer * u.dist).toFixed(1)} ${u.distLabel}`;
}

function renderRevLight() {
    if (!ready) return;
    elements.rev.classList.toggle('on', state.engine !== false && state.rpm * CONFIG.rpmFull >= CONFIG.redline);
}

// ---- Busur RPM ----
function colorAt(t) { // cyan -> hijau -> kuning -> merah
    const stops = [[0, [23, 212, 255]], [.2, [40, 255, 170]], [.4, [90, 255, 90]], [.58, [235, 255, 60]], [.68, [255, 150, 40]], [.74, [255, 50, 70]], [1, [200, 20, 60]]];
    for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
            const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0);
            return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(',')})`;
        }
    }
    return 'rgb(255,40,70)';
}

function arcPath(r, a0, a1) {
    const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function svgEl(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
    parent.appendChild(e);
    return e;
}

function buildTicks() {
    const g = elements.ticks, end = START + SWEEP;
    const redA = START + (CONFIG.redline / CONFIG.gaugeMax) * SWEEP;
    // alas gelap di belakang segmen + ring dalam
    svgEl('path', { d: arcPath((R_OUT + R_IN) / 2, START - 2, end + 2), stroke: '#050c17', 'stroke-width': 22, fill: 'none', opacity: .92 }, g);
    svgEl('path', { d: arcPath(R_IN - 6, START, end), stroke: '#17d4ff', 'stroke-opacity': .35, 'stroke-width': 1, fill: 'none' }, g);
    // ring luar: cyan sampai redline, merah setelahnya
    svgEl('path', { d: arcPath(R_OUT + 8, START, redA), stroke: '#17d4ff', 'stroke-opacity': .8, 'stroke-width': 1.4, fill: 'none' }, g);
    svgEl('path', { d: arcPath(R_OUT + 8, redA, end), stroke: '#ff2d55', 'stroke-width': 2, fill: 'none' }, g).setAttribute('filter', 'url(#glow)');
    // tick: besar tiap 1000 RPM, kecil tiap 500
    for (let i = 0; i <= LABEL_MAX * 2; i++) {
        const a = START + (i / (LABEL_MAX * 2)) * SWEEP, major = i % 2 === 0, red = a >= redA;
        const [x0, y0] = pt(R_OUT + 9, a), [x1, y1] = pt(R_OUT + (major ? 15 : 12), a);
        svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: red ? '#ff2d55' : '#17d4ff',
            'stroke-opacity': major ? .9 : .5, 'stroke-width': major ? 1.8 : 1 }, g);
    }
}

function buildGauge() {
    buildTicks();
    const step = SWEEP / SEGMENTS, gap = step * 0.22, rm = (R_OUT + R_IN) / 2;
    for (let i = 0; i < SEGMENTS; i++) {
        const a0 = START + i * step + gap / 2, a1 = START + (i + 1) * step - gap / 2;
        const [x0, y0] = pt(rm, a0), [x1, y1] = pt(rm, a1);
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', `M${x0} ${y0} A${rm} ${rm} 0 0 1 ${x1} ${y1}`);
        p.setAttribute('class', 'seg');
        const c = colorAt(i / (SEGMENTS - 1));
        p.style.stroke = c; p.style.color = c;
        elements.seg.appendChild(p); segEls.push(p);
    }
    for (let i = 0; i <= LABEL_MAX; i++) {
        const [x, y] = pt(R_LBL, START + (i / LABEL_MAX) * SWEEP);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y + 5); t.textContent = i;
        elements.labels.appendChild(t);
    }
    const hexPath = (cx, cy, r) => {
        let d = '';
        for (let k = 0; k < 6; k++) {
            const a = rad(60 * k + 30);
            d += (k ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
        }
        return d + 'Z';
    };
    // honeycomb: sel axial (q, r), isi = warna sel terisi
    const honeycomb = (parent, cx, cy, r, cells, fill) => {
        const d = r * Math.sqrt(3) + 1.5;
        cells.forEach(([q, rr, filled]) => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', hexPath(cx + d * (q + rr / 2), cy + d * 0.8660254 * rr, r));
            if (filled) { p.setAttribute('fill', fill); p.setAttribute('fill-opacity', .3); }
            parent.appendChild(p);
        });
    };
    honeycomb(elements.hexL, 68, 120, 10, [[0, 0, 1], [1, 0], [0, 1], [-1, 1, 1], [-1, 0], [0, -1], [1, -1]], '#c93bff');
    honeycomb(elements.hexC, 158, 188, 9, [[0, 0], [1, 0, 1], [0, 1], [-1, 1], [-1, 0, 1], [0, -1], [1, -1]], '#17d4ff');
}

function animate() {
    let target = state.engine === false ? 0 : state.rpm * CONFIG.rpmFull;
    let ease = state.engine === false && CONFIG.engineAnim ? 0.07 : 0.35; // mesin mati: jarum turun pelan
    const bt = (performance.now() - bootStart) / CONFIG.bootMs;
    if (CONFIG.engineAnim && bt >= 0 && bt < 1) { target = CONFIG.gaugeMax * Math.sin(Math.PI * bt); ease = 0.4; } // self-test
    shownRpm += (target - shownRpm) * ease;
    if (Math.abs(target - shownRpm) < 1) shownRpm = target;
    const t = clamp01(shownRpm / CONFIG.gaugeMax);
    const lit = Math.round(t * SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) segEls[i].classList.toggle('on', i < lit);
    const ang = START + t * SWEEP;
    const [x1, y1] = pt(100, ang), [x2, y2] = pt(R_OUT + 6, ang);
    elements.needle.setAttribute('x1', x1); elements.needle.setAttribute('y1', y1);
    elements.needle.setAttribute('x2', x2); elements.needle.setAttribute('y2', y2);
    elements.needleTip.setAttribute('cx', x2); elements.needleTip.setAttribute('cy', y2);
    requestAnimationFrame(animate);
}

// Skala otomatis bila area tampil (iframe) lebih kecil dari HUD
function fit() {
    const m = CONFIG.margin * 2;
    const q = parseFloat(new URLSearchParams(window.location.search).get('scale'));
    const want = Number.isFinite(q) && q > 0 ? q : CONFIG.scale;
    // tidak pernah lebih besar dari area tampil (iframe kecil tetap muat)
    const s = Math.min(want, (window.innerWidth - m) / 520, (window.innerHeight - m) / 380);
    elements.hud.style.transform = `scale(${Math.max(0.1, s)})`;
}

// ---------------- Inisialisasi ----------------
function init() {
    const ids = ['hud', 'seg', 'labels', 'hexL', 'hexC', 'needle', 'rev', 'unit', 'redlineTxt', 'ticks', 'needleTip', 'offTag',
        's1', 's2', 's3', 'engine', 'speed', 'rpm', 'fuel', 'health', 'gear',
        'headlights', 'seatbelts', 'odometer'];
    ids.forEach(id => { elements[id] = document.getElementById(id); });
    elements.left = document.getElementById('indicator-left');
    elements.right = document.getElementById('indicator-right');

    elements.hud.style.right = elements.hud.style.bottom = `${CONFIG.margin}px`;
    elements.redlineTxt.textContent = `${CONFIG.redline} RPM`;

    buildGauge();
    ready = true;
    renderEngine(); renderSpeed(); renderFuel(); renderHealth(); renderGear();
    renderHeadlights(); renderIndicators(); renderSeatbelts(); renderOdometer(); renderRevLight();
    fit();
    window.addEventListener('resize', fit);
    requestAnimationFrame(animate);
}

// Fungsi boleh dipanggil kapan saja; nilai disimpan dan dirender setelah DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
