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
    state.engine = !!value;
    renderEngine();
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

function renderEngine() {
    if (!ready || state.engine === null) return;
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
    elements.rev.classList.toggle('on', state.rpm * CONFIG.rpmFull >= CONFIG.redline);
}

// ---- Busur RPM ----
function colorAt(t) { // cyan -> hijau -> kuning -> merah
    const stops = [[0, [23, 212, 255]], [.35, [40, 255, 120]], [.62, [255, 230, 60]], [.8, [255, 120, 40]], [1, [255, 40, 70]]];
    for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
            const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0);
            return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(',')})`;
        }
    }
    return 'rgb(255,40,70)';
}

function buildGauge() {
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
    const hex = (cx, cy, r) => {
        let d = '';
        for (let k = 0; k < 6; k++) {
            const a = rad(60 * k + 30);
            d += (k ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
        }
        return d + 'Z';
    };
    const addHex = (parent, cx, cy, r) => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', hex(cx, cy, r)); parent.appendChild(p);
    };
    [[62, 100], [78, 92], [62, 114], [78, 126], [94, 100], [94, 114]].forEach(([x, y]) => addHex(elements.hexL, x, y, 9));
    [[160, 170], [176, 162], [160, 184], [176, 194], [192, 170], [192, 184]].forEach(([x, y]) => addHex(elements.hexC, x, y, 10));
}

function animate() {
    const target = state.rpm * CONFIG.rpmFull;
    shownRpm += (target - shownRpm) * 0.35;
    if (Math.abs(target - shownRpm) < 1) shownRpm = target;
    const t = clamp01(shownRpm / CONFIG.gaugeMax);
    const lit = Math.round(t * SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) segEls[i].classList.toggle('on', i < lit);
    const ang = START + t * SWEEP;
    const [x1, y1] = pt(100, ang), [x2, y2] = pt(R_OUT + 6, ang);
    elements.needle.setAttribute('x1', x1); elements.needle.setAttribute('y1', y1);
    elements.needle.setAttribute('x2', x2); elements.needle.setAttribute('y2', y2);
    requestAnimationFrame(animate);
}

// Skala otomatis bila area tampil (iframe) lebih kecil dari HUD
function fit() {
    const m = CONFIG.margin * 2;
    const s = Math.min(1, (window.innerWidth - m) / 500, (window.innerHeight - m) / 330);
    elements.hud.style.transform = `scale(${Math.max(0.2, s)})`;
}

// ---------------- Inisialisasi ----------------
function init() {
    const ids = ['hud', 'seg', 'labels', 'hexL', 'hexC', 'needle', 'rev', 'unit', 'redlineTxt',
        's1', 's2', 's3', 'engine', 'speed', 'rpm', 'fuel', 'health', 'gear',
        'headlights', 'seatbelts', 'odometer'];
    ids.forEach(id => { elements[id] = document.getElementById(id); });
    elements.left = document.getElementById('indicator-left');
    elements.right = document.getElementById('indicator-right');

    elements.hud.style.right = elements.hud.style.bottom = `${CONFIG.margin}px`;
    elements.redlineTxt.textContent = `REDLINE ${CONFIG.redline}`;

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
