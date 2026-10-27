/* =========================================================
   八千里路明月照 · 纯代码水墨 MV
   Canvas 2D engine + Web Audio. No images anywhere.
   ========================================================= */
(() => {
'use strict';

/* ---------------------------------------------- basics */

const W = 1920, H = 1080;
const DURATION = 173.134625;
const ENV = window.ENV || { b64: {}, duration: DURATION, hop: 0.2, m: 865 };
const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const $ = (id) => document.getElementById(id);

const clamp = (v, a = 0, b = 1) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeInOut = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const TAU = Math.PI * 2;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFile = location.protocol === 'file:';

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash1(n, seed = 0) {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i, seed), hash1(i + 1, seed), u);
}
function fbm1(x, seed = 0, oct = 4) {
  let v = 0, amp = .55, f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * (noise1(x * f, seed + i * 7.3) * 2 - 1);
    f *= 2.03; amp *= .5;
  }
  return v;
}
function mixRGB(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a)})`;

/* ---------------------------------------------- audio & envelope */

const bands = {};
for (const key of ['rms', 'low', 'mid', 'high']) {
  const src = ENV.b64 && ENV.b64[key];
  if (!src) { bands[key] = new Uint8Array(ENV.m || 865); continue; }
  const bin = atob(src);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  bands[key] = arr;
}
const ENV_M = Math.min(bands.rms.length || ENV.m || 865, ENV.m || 865);
function envVal(key, t) {
  const a = bands[key] || bands.rms;
  if (!a || !a.length) return .5;
  const p = clamp(t / (ENV.hop || .2), 0, a.length - 1.001);
  const i = Math.floor(p), f = p - i;
  return lerp(a[i] / 255, a[Math.min(i + 1, a.length - 1)] / 255, f);
}

const audio = new Audio();
audio.preload = 'auto';
audio.src = 'audio/song.mp3';
audio.volume = .9;
audio.setAttribute('playsinline', '');

let audioCtx = null, analyser = null, freqData = null, analyserReady = false;
async function initAnalyser() {
  if (isFile) return;
  if (analyserReady || audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    const src = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = .82;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyserReady = true;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
  } catch (e) {
    console.warn('Web Audio analyser unavailable:', e);
    analyserReady = false;
  }
}
function audioBands(t) {
  let low = envVal('low', t), mid = envVal('mid', t), high = envVal('high', t), rms = envVal('rms', t);
  if (analyserReady && freqData) {
    analyser.getByteFrequencyData(freqData);
    let a = 0, b = 0, c = 0;
    const n = freqData.length;
    for (let i = 1; i < 12; i++) a += freqData[i];
    for (let i = 12; i < 80; i++) b += freqData[i];
    for (let i = 80; i < 260; i++) c += freqData[i];
    const al = a / (11 * 255), bl = b / (68 * 255), cl = c / (180 * 255);
    low = Math.max(low * .7, al * 1.15);
    mid = Math.max(mid * .72, bl * 1.05);
    high = Math.max(high * .65, cl * 1.1);
    rms = Math.max(rms * .8, (low + mid + high) / 3);
  }
  return { low, mid, high, rms };
}

/* ---------------------------------------------- timed score */

const CUES = [];
function cue(t, props) { CUES.push(Object.assign({ t }, props)); }

cue(0, {
  zoom: 1.03, fx: 960, fy: 540,
  moonX: 1268, moonY: 352, moonR: 148, glow: .54, star: .82, fog: .52, dawn: 0,
  hut: 1, fig: 0, figX: 560, walk: 0, raise: 0, face: 1,
  gold: 0, palace: 0, path: .08, plum: .25, petal: .08, ember: .05,
  snow: .15, wind: .22, crane: 0, veil: 0
});
/* the moon's slow arc across the night */
cue(0, { moonX: 1352, moonY: 430, moonR: 146 });
cue(17.4, { moonX: 1320, moonY: 404 });
cue(28.08, { moonX: 1292, moonY: 372, moonR: 152 });
cue(46.27, { moonX: 1274, moonY: 338 });
cue(61.56, { moonX: 1256, moonY: 322 });
cue(86.8, { moonX: 1252, moonY: 330, moonR: 156 });
cue(107.85, { moonX: 1234, moonY: 342 });
cue(123.41, { moonX: 1232, moonY: 356 });
cue(160, { moonX: 1240, moonY: 372, moonR: 148 });

cue(2.68, { glow: .66, wind: .38 });
cue(5.30, { zoom: 1.10, fx: 1240, fy: 585, glow: .61, snow: .24, wind: .3 });
cue(7.59, { zoom: 1.13, fx: 1300, fy: 600 });
cue(10.28, { zoom: 1.16, fx: 1350, fy: 618, snow: .4, wind: .45 });
cue(14.92, { zoom: 1.21, fx: 1400, fy: 650, snow: .5, wind: .35 });
cue(17.40, {
  zoom: 1.04, fx: 1080, fy: 560, hut: .55, fig: 1, figX: 430,
  walk: 1, raise: 0, snow: .45, path: .15, wind: .35
});
cue(20.57, { zoom: 1.06, fx: 1120, fy: 545, palace: .13, gold: .08, ember: .15 });
cue(25.66, {
  zoom: 1.12, fx: 1000, fy: 600, hut: 0, figX: 760, walk: 1, raise: 0,
  gold: .22, ember: .3, fog: .42, path: .25, plum: .45, crane: .12,
  snow: .22, petal: .18
});
cue(26.50, { raise: 1, glow: .86, zoom: 1.14 });
cue(28.08, {
  zoom: 1.20, fx: 1000, fy: 600, glow: .95, moonR: 153, palace: .22,
  crane: .5, wind: .5, snow: .08, petal: .22
});
cue(30.74, {
  zoom: 1.24, fx: 1000, fy: 600, wind: .66, gold: .36, ember: .42,
  snow: 0, petal: .25
});
cue(35.26, { palace: .5, zoom: 1.20, fx: 1040, fy: 580, crane: .82, petal: .3 });
cue(38.16, { zoom: 1.30, fx: 1550, fy: 340, plum: .95, petal: .6, snow: 0, glow: .9 });
cue(40.95, { zoom: 1.06, fx: 1080, fy: 540, wind: .9, gold: .3, path: .45, plum: .7, snow: 0, petal: .35 });
cue(46.27, {
  zoom: .965, fx: 960, fy: 540, glow: .85, path: 1, palace: .28,
  fig: .95, walk: 0, raise: .35, petal: .25, crane: .9, wind: .5, star: .95, snow: 0
});
cue(51.35, { zoom: 1.01, fx: 1000, fy: 540, figX: 880, petal: .2 });
cue(56.48, { zoom: 1.07, fx: 1060, fy: 500, crane: 1, glow: .9, petal: .3 });
cue(61.56, {
  zoom: .98, fx: 960, fy: 550, wind: 1.25, veil: .45, gold: .15,
  raise: 0, walk: 1, figX: 940, petal: .15, snow: .05
});
cue(66, { veil: .2, snow: .25, petal: .25, fog: .6 });
cue(70, { zoom: 1.05, fx: 1000, fy: 520, palace: .35, gold: .3, path: .85, figX: 1000, snow: .05, petal: .3 });
cue(76, { zoom: 1.12, fx: 1070, fy: 490, palace: .62, gold: .5, star: 1, snow: 0, petal: .4, wind: .5 });
cue(82, { zoom: 1.18, fx: 1130, fy: 465, palace: .9, gold: .7, ember: .5, raise: .5 });
cue(86.8, { zoom: 1.20, fx: 1120, fy: 470, palace: 1, gold: .8, ember: .6 });
cue(87.56, { zoom: 1.16, glow: 1, wind: .35, veil: 0, raise: 1, figX: 1000, walk: .2 });
cue(92.45, { wind: .65, gold: .88, ember: .65 });
cue(96.92, { zoom: 1.22, fx: 1170, fy: 470, palace: 1 });
cue(99.88, { petal: .85, plum: 1, glow: 1 });
cue(102.66, { zoom: 1.12, fx: 1070, fy: 500, gold: .95 });
cue(107.85, { zoom: .995, fx: 960, fy: 540, path: 1, star: 1, glow: .9, raise: .5, walk: 0, figX: 1010 });
cue(112.97, { zoom: 1.05, fx: 1020, fy: 520, glow: .9 });
cue(118.05, { zoom: 1.10, fx: 1080, fy: 485, crane: 1, glow: .95, raise: .85 });
cue(121.0, { face: 1 });
cue(123.41, {
  zoom: .98, fx: 960, fy: 550, gold: .4, palace: .45, wind: 1.15,
  dawn: .12, walk: 1, raise: 0, figX: 1000, path: .65
});
cue(124.5, { face: -1 });
cue(128.47, { zoom: 1.0, fx: 980, fy: 540, wind: .7, glow: .78, petal: .7, figX: 970 });
cue(133.56, { zoom: 1.045, fx: 1020, fy: 540, dawn: .2, figX: 930, crane: .75 });
cue(138.72, {
  zoom: 1.08, fx: 1070, fy: 520, dawn: .28, crane: .65, petal: .6,
  gold: .2, glow: .62, figX: 900
});
cue(143.85, { zoom: 1.0, fx: 980, fy: 550, wind: 1.35, dawn: .34, path: .35, figX: 880, petal: .3, snow: 0 });
cue(148, { zoom: .97, fx: 960, fy: 550, fig: .55, walk: .6, wind: .7, snow: .12, glow: .52, dawn: .4, petal: .2 });
cue(152, { fig: 0, wind: .4, fog: .65, dawn: .46, glow: .44, snow: .05, petal: .16 });
cue(160, { zoom: .99, moonY: 365, glow: .36, star: .9, dawn: .5, path: .18, crane: .2, snow: 0, petal: .12 });
cue(166, { glow: .24, star: .6, fog: .82, dawn: .42, wind: .2, snow: 0, petal: 0 });
cue(173.13, { glow: .18, star: .35, dawn: .35, fog: .9, wind: .1 });

const CUES_SORTED = CUES.slice().sort((a, b) => a.t - b.t);

function sampleCue(prop, t) {
  let prev = null, next = null;
  for (let i = 0; i < CUES_SORTED.length; i++) {
    const c = CUES_SORTED[i];
    if (c[prop] === undefined) continue;
    if (c.t <= t) prev = c;
    if (c.t >= t) { next = c; break; }
  }
  if (!prev) prev = next || CUES_SORTED[0];
  if (!next) next = prev;
  if (prev === next) return prev[prop];
  const span = next.t - prev.t;
  const p = span <= 0 ? 1 : smooth((t - prev.t) / span);
  const a = prev[prop], b = next[prop];
  return typeof a === 'number' ? lerp(a, b, p) : (p < .5 ? a : b);
}
function makeDirector(t) {
  const d = {};
  const props = [
    'zoom', 'fx', 'fy', 'moonX', 'moonY', 'moonR', 'glow', 'star', 'fog', 'dawn',
    'hut', 'fig', 'figX', 'walk', 'raise', 'face', 'gold', 'palace', 'path',
    'plum', 'petal', 'ember', 'snow', 'wind', 'crane', 'veil'
  ];
  for (const p of props) d[p] = sampleCue(p, t);
  return d;
}

/* lyric line starts: used as visual breaths, never printed as full lyrics */
const BREATHS = [
  2.68, 5.30, 7.59, 10.28, 14.92, 17.40, 20.57, 25.66, 28.08, 30.74,
  35.26, 38.16, 40.95, 46.27, 51.35, 56.48, 61.56, 87.56, 89.73,
  92.45, 96.92, 99.88, 102.66, 107.85, 112.97, 118.05, 123.41,
  128.47, 133.56, 138.72, 143.85
];

const CHAPTERS = [
  { t0: .25, t1: 4.6, idx: '序', title: '月出', en: 'THE MOON RISES' },
  { t0: 5.30, t1: 16.9, idx: '卷一', title: '寒窗', en: 'TEN YEARS BY LAMPLIGHT' },
  { t0: 17.40, t1: 25.2, idx: '卷二', title: '赶考', en: 'THE ROAD ALONE' },
  { t0: 25.66, t1: 40.2, idx: '卷三', title: '问月', en: 'ASK THE MOON' },
  { t0: 61.56, t1: 73.0, idx: '卷四', title: '行路', en: 'EIGHT THOUSAND LI' },
  { t0: 87.56, t1: 104.0, idx: '卷五', title: '凌云', en: 'BEYOND THE NINE HEAVENS' },
  { t0: 123.41, t1: 128.0, idx: '终章', title: '回首', en: 'LOOKING BACK' }
];

const KEYLINES = [
  { t0: 46.75, t1: 53.9, main: '八千里路明月照', sub: 'EIGHT THOUSAND LI UNDER THE MOON' },
  { t0: 128.95, t1: 136.6, main: '八千里路明月照', sub: 'THE MOON STILL SHINES ON THE WAY HOME' }
];

const MARKS = [5.30, 17.40, 25.66, 46.27, 61.56, 87.56, 123.41, 143.85];

/* ---------------------------------------------- canvas sizing */

let drawScale = 1, cssW = 1920, cssH = 1080;
function resize() {
  const r = stage.getBoundingClientRect();
  cssW = r.width || W; cssH = r.height || H;
  const unit = cssW / W;
  stage.style.setProperty('--u', unit + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25, 2400 / Math.max(1, cssW));
  canvas.width = Math.max(2, Math.round(cssW * dpr));
  canvas.height = Math.max(2, Math.round(cssH * dpr));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawScale = canvas.width / W;
}
window.addEventListener('resize', resize, { passive: true });

/* ---------------------------------------------- procedural scenery data */

const rng = mulberry32(20261024);

/* stars */
const STARS = [];
for (let i = 0; i < 330; i++) {
  const r = Math.pow(rng(), 2.2);
  STARS.push({
    x: rng() * W,
    y: Math.pow(rng(), 1.45) * 780,
    r: .35 + r * 1.55,
    a: .18 + rng() * .75,
    ph: rng() * TAU,
    sp: .08 + rng() * .28,
    flare: rng() < .055
  });
}
/* milky-way band */
for (let i = 0; i < 190; i++) {
  const t = rng();
  const x = lerp(160, 1780, t) + (rng() - .5) * 420;
  const y = lerp(120, 660, t) + (rng() - .5) * 280;
  STARS.push({
    x, y, r: .3 + rng() * .9, a: .06 + rng() * .22,
    ph: rng() * TAU, sp: .15 + rng() * .5, flare: false
  });
}

/* moon craters */
const CRATERS = [];
{
  const cr = mulberry32(88);
  for (let i = 0; i < 16; i++) {
    const a = cr() * TAU, rr = Math.sqrt(cr()) * .82;
    CRATERS.push({
      x: Math.cos(a) * rr, y: Math.sin(a) * rr,
      rx: .04 + cr() * .12, ry: .03 + cr() * .09,
      a: .015 + cr() * .04, rot: cr() * TAU
    });
  }
}

/* foreground ridge */
const FG_POINTS = [
  [-280, 1140], [-280, 690], [-140, 678], [-20, 700], [90, 726], [190, 765],
  [300, 814], [420, 872], [540, 910], [660, 928], [790, 932], [920, 925],
  [1040, 912], [1150, 892], [1250, 862], [1340, 832], [1420, 816], [1500, 813],
  [1580, 816], [1660, 830], [1740, 858], [1820, 900], [1910, 945], [2020, 975],
  [2140, 1005], [2270, 1018], [2400, 1032], [2510, 1042], [2510, 1140]
];
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}
const RIDGE_LINE = [];
{
  const pts = FG_POINTS.map(([x, y]) => ({ x, y }));
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const steps = 22;
    for (let s = 0; s < steps; s++) RIDGE_LINE.push(catmullRom(p0, p1, p2, p3, s / steps));
  }
  RIDGE_LINE.push(pts[pts.length - 1]);
}
const RIDGE_MAP = new Float32Array(3000);
RIDGE_MAP.fill(900);
for (let i = 0; i < RIDGE_LINE.length - 1; i++) {
  const a = RIDGE_LINE[i], b = RIDGE_LINE[i + 1];
  const x0 = Math.max(-300, Math.min(2699, Math.round(a.x + 300)));
  const x1 = Math.max(-300, Math.min(2699, Math.round(b.x + 300)));
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  for (let x = lo; x <= hi; x++) {
    const f = hi === lo ? 0 : (x - lo) / (hi - lo);
    RIDGE_MAP[x] = lerp(a.y, b.y, f);
  }
}
function ridgeYAt(x) {
  const i = Math.round(clamp(x + 300, 0, 2999));
  return RIDGE_MAP[i];
}

/* fog sprites */
function makeFog(seed, tint) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 420;
  const g = c.getContext('2d');
  const r = mulberry32(seed);
  const col = (a) => `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`;

  /* soft elongated cloud blobs make the body of the mist */
  for (let i = 0; i < 38; i++) {
    const x = -80 + r() * 1360;
    const y = 34 + r() * 350;
    const h = 16 + r() * 58;
    const w = 90 + r() * 360;
    const a = .02 + r() * .052;
    g.save();
    g.translate(x, y);
    g.scale(w / h, 1);
    const mg = g.createRadialGradient(0, 0, 0, 0, 0, h);
    mg.addColorStop(0, col(a));
    mg.addColorStop(.55, col(a * .55));
    mg.addColorStop(1, col(0));
    g.fillStyle = mg;
    g.beginPath();
    g.arc(0, 0, h, 0, TAU);
    g.fill();
    g.restore();
  }
  /* a few light streaks to carry the drift */
  for (let i = 0; i < 54; i++) {
    const y = 40 + r() * 340;
    const h = 1 + r() * 7;
    const x = -140 + r() * 1340;
    const w = 100 + r() * 520;
    const a = .012 + r() * .04;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, col(0));
    gr.addColorStop(.3, col(a * .5));
    gr.addColorStop(.55, col(a));
    gr.addColorStop(.82, col(a * .42));
    gr.addColorStop(1, col(0));
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }

  /* feather every edge so tiled strips leave no seams */
  g.globalCompositeOperation = 'destination-in';
  let lg = g.createLinearGradient(0, 0, c.width, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(.16, 'rgba(0,0,0,1)');
  lg.addColorStop(.84, 'rgba(0,0,0,1)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
  lg = g.createLinearGradient(0, 0, 0, c.height);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(.2, 'rgba(0,0,0,1)');
  lg.addColorStop(.78, 'rgba(0,0,0,1)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}
const FOG_A = makeFog(101, [174, 195, 201]);
const FOG_B = makeFog(202, [133, 160, 172]);
const FOG_C = makeFog(303, [206, 198, 177]);

/* moon glow sprite */
const GLOW = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  gr.addColorStop(0, 'rgba(255,249,231,.92)');
  gr.addColorStop(.10, 'rgba(255,247,226,.42)');
  gr.addColorStop(.26, 'rgba(242,238,217,.115)');
  gr.addColorStop(.52, 'rgba(205,220,215,.03)');
  gr.addColorStop(1, 'rgba(160,190,196,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  return c;
})();

/* ink-cloud sprite, baked for cheap drift */
function makeCloud(seed, dark, light) {
  const c = document.createElement('canvas'); c.width = 1700; c.height = 560;
  const g = c.getContext('2d');
  const r = mulberry32(seed);
  const col = (tint, a) => `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`;
  const base = 292;
  /* a bank of lobes along a slow wave, with torn edges */
  for (let i = 0; i < 12; i++) {
    const x = 40 + i * 142 + (r() - .5) * 60;
    const y = base + Math.sin(i * .82 + seed * .7) * 48 + (r() - .5) * 30;
    const rx = 130 + r() * 190, ry = 26 + r() * 38;
    const a = .09 + r() * .085;
    g.save();
    g.translate(x, y);
    g.scale(rx / ry, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    gr.addColorStop(0, col(dark, a));
    gr.addColorStop(.5, col(dark, a * .62));
    gr.addColorStop(1, col(dark, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fill();
    g.restore();
  }
  /* softer puffs above and below, breaking the band */
  for (let i = 0; i < 9; i++) {
    const x = 180 + r() * 1340;
    const y = base - 62 - r() * 80 + (r() - .5) * 30;
    const rx = 80 + r() * 160, ry = 14 + r() * 26;
    const a = .045 + r() * .062;
    g.save();
    g.translate(x, y);
    g.scale(rx / ry, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    gr.addColorStop(0, col(dark, a));
    gr.addColorStop(1, col(dark, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fill();
    g.restore();
  }
  /* silver lining on the upper edge */
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 12; i++) {
    const x = 100 + i * 138 + (r() - .5) * 70;
    const y = base - 22 + Math.sin(i * .82 + seed * .7) * 44 - r() * 22;
    const rx = 90 + r() * 150, ry = 7 + r() * 15;
    const a = .04 + r() * .07;
    g.save();
    g.translate(x, y);
    g.scale(rx / ry, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    gr.addColorStop(0, col(light, a));
    gr.addColorStop(.55, col(light, a * .45));
    gr.addColorStop(1, col(light, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fill();
    g.restore();
  }
  /* dry wisps at the tails */
  for (let i = 0; i < 6; i++) {
    const y = base + 8 + r() * 60;
    const x = 80 + r() * 1350;
    const w = 80 + r() * 180;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, col(light, 0));
    gr.addColorStop(.4, col(light, .018 + r() * .022));
    gr.addColorStop(.7, col(light, .012 + r() * .015));
    gr.addColorStop(1, col(light, 0));
    g.fillStyle = gr;
    g.fillRect(x, y, w, .8 + r() * 1.4);
  }
  g.globalCompositeOperation = 'source-over';
  g.globalCompositeOperation = 'destination-in';
  let lg = g.createLinearGradient(0, 0, c.width, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(.1, 'rgba(0,0,0,1)');
  lg.addColorStop(.9, 'rgba(0,0,0,1)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
  lg = g.createLinearGradient(0, 0, 0, c.height);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(.12, 'rgba(0,0,0,1)');
  lg.addColorStop(.86, 'rgba(0,0,0,1)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}
const CLOUD_A = makeCloud(611, [10, 16, 23], [196, 205, 199]);
const CLOUD_B = makeCloud(612, [7, 12, 18], [166, 184, 183]);

/* small warm glow sprite for lanterns, fireflies, boat light */
const FIRE_GLOW = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,232,177,.95)');
  gr.addColorStop(.12, 'rgba(250,207,134,.52)');
  gr.addColorStop(.34, 'rgba(236,176,92,.16)');
  gr.addColorStop(.7, 'rgba(214,146,70,.035)');
  gr.addColorStop(1, 'rgba(200,130,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
})();

/* film grain tile */
const GRAIN = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 220;
  const g = c.getContext('2d');
  const img = g.createImageData(220, 220);
  const r = mulberry32(707);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + r() * 100;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 15 + r() * 40;
  }
  g.putImageData(img, 0, 0);
  return c;
})();
/* rice-paper tooth, tiled seamlessly */
const PAPER = (() => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const r = mulberry32(9182);
  function makeGrid(G) {
    const a = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) a[i] = r();
    return a;
  }
  const g1 = makeGrid(8), g2 = makeGrid(24), g3 = makeGrid(72);
  function at(a, G, x, y) {
    x = ((x % G) + G) % G; y = ((y % G) + G) % G;
    return a[y * G + x];
  }
  function samp(a, G, x, y) {
    const fx = x / S * G, fy = y / S * G;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    return (
      at(a, G, x0, y0) * (1 - u) * (1 - v) +
      at(a, G, x0 + 1, y0) * u * (1 - v) +
      at(a, G, x0, y0 + 1) * (1 - u) * v +
      at(a, G, x0 + 1, y0 + 1) * u * v
    );
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = samp(g1, 8, x, y) * .5 + samp(g2, 24, x, y) * .32 + samp(g3, 72, x, y) * .18;
      v = 128 + (v - .5) * 34 + (r() - .5) * 10;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
})();
let paperPattern = null;
function getPaper(ctx) {
  if (!paperPattern) paperPattern = ctx.createPattern(PAPER, 'repeat');
  return paperPattern;
}
let grainPattern = null;

/* ---------------------------------------------- mountains */

function ridgeHeight(x, opts) {
  const s = opts.seed;
  let y = opts.base - fbm1(x * opts.freq + s * 3.7, s, 4) * opts.amp * .35;
  y -= (noise1(x * .0022 + s, s + 4) * 2 - 1) * 18;
  for (const p of opts.peaks) {
    const d = (x - p.x) / p.w;
    y -= p.h * Math.exp(-d * d * 1.65);
  }
  y += fbm1(x * .018 + s * 9, s + 9, 3) * 7;
  y -= Math.abs(fbm1(x * .0075 + s * 2.1, s + 12, 3)) * 12;
  y -= (noise1(x * .055 + s, s + 18) - .5) * 4;
  return y;
}

function drawPine(g, x, y, h, color, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  /* leaning trunk */
  const lean = (hash1(x * .37 + y * .11) - .5) * h * .16;
  g.lineWidth = Math.max(.65, h * .045);
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x + lean * .25, y - h * .36, x + lean * .75, y - h * .7, x + lean, y - h * .97);
  g.stroke();

  /* five ragged tiers of horizontal branches */
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const q = i / (tiers - 1);
    const ty = y - h * (.19 + q * .71);
    const half = h * (.40 * (1 - q * .68));
    const bx = x + lean * (.18 + q * .75);
    const bias = (i % 2 ? 1 : -1);
    for (const sd of [-1, 1]) {
      const reach = half * (sd === bias ? 1.12 : .88) * (1 + (hash1(i * 3 + sd + x) - .5) * .25);
      const tipX = bx + sd * reach;
      const tipY = ty + h * .035 + (sd === bias ? h * .012 : 0);
      g.lineWidth = Math.max(.45, h * .017 * (1 - q * .3));
      g.beginPath();
      g.moveTo(bx, ty);
      g.quadraticCurveTo(bx + sd * reach * .45, ty - h * .028, tipX, tipY);
      g.stroke();
      /* needle pad with a torn lower edge */
      g.beginPath();
      g.moveTo(bx, ty - h * .032);
      g.quadraticCurveTo(bx + sd * reach * .42, ty - h * .082, tipX, tipY - h * .016);
      const seg = 4;
      for (let k = 1; k <= seg; k++) {
        const u = k / seg;
        const px = lerp(tipX, bx, u);
        const py = lerp(tipY - h * .016, ty + h * .03, u) + (k % 2 ? h * .024 : -h * .004);
        g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    }
  }
  /* top spire */
  g.beginPath();
  g.moveTo(x + lean, y - h * .985);
  g.lineTo(x + lean + h * .016, y - h * .86);
  g.lineTo(x + lean - h * .02, y - h * .88);
  g.closePath();
  g.fill();
  g.restore();
}

function drawBareTree(g, x, y, h, color, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  function limb(x1, y1, ang, len, wid, d) {
    const x2 = x1 + Math.cos(ang) * len;
    const y2 = y1 + Math.sin(ang) * len;
    const bend = (hash1(x1 * .8 + y1 * .3 + d * 7) - .5) * len * .34;
    g.lineWidth = Math.max(.28, wid);
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo((x1 + x2) / 2 + bend, (y1 + y2) / 2 - bend * .4, x2, y2);
    g.stroke();
    if (d >= 4 || wid < .3) return;
    const n = d === 0 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const na = ang + (hash1(x2 * .9 + y2 * .7 + i * 5) - .5) * 1.3 + (i === 0 ? -.22 : i === 2 ? .24 : 0);
      limb(x2, y2, na, len * (.56 + hash1(i + x2) * .14), wid * .55, d + 1);
    }
  }
  limb(x, y, -Math.PI / 2 + (hash1(x * .51) - .5) * .26, h * .5, Math.max(.8, h * .055), 0);
  g.restore();
}

function makeMountain(opts) {
  const c = document.createElement('canvas');
  c.width = 2800; c.height = 1080;
  const g = c.getContext('2d');
  g.translate(290, 0);

  /* a ragged, hand-torn skyline: fine tooth plus occasional cliff bites */
  const step = 3;
  const pts = [];
  for (let x = -290; x <= 2510; x += step) {
    let y = ridgeHeight(x, opts);
    y += (noise1(x * .58 + opts.seed * 7, 5) - .5) * 3.2;
    y += (noise1(x * .17 + opts.seed, 6) - .5) * 2.4;
    y += (noise1(x * 2.15 + opts.seed, 9) - .5) * 1.1;
    const bite = noise1(x * .011 + opts.seed * 3, 17);
    if (bite > .72) y += (bite - .72) * 30;
    pts.push([x, y]);
  }

  const trace = () => {
    g.beginPath();
    g.moveTo(pts[0][0], 1080);
    g.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineTo(2510, 1080);
    g.closePath();
  };

  /* opaque pigment body: no sky leaking through the wash */
  const grad = g.createLinearGradient(0, opts.base - 390, 0, 1080);
  grad.addColorStop(0, rgba(opts.top, 1));
  grad.addColorStop(.30, rgba(mixRGB(opts.top, opts.mid, .55), 1));
  grad.addColorStop(.62, rgba(opts.mid, 1));
  grad.addColorStop(1, rgba(opts.bottom, 1));
  trace();
  g.fillStyle = grad;
  g.fill();

  g.save();
  trace();
  g.clip();

  /* rice-paper tooth across the whole body */
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = .6;
  const ptn = getPaper(g);
  const ox = (opts.seed * 137) % 512, oy = (opts.seed * 89) % 512;
  g.translate(-ox, -oy);
  g.fillStyle = ptn;
  g.fillRect(-290, -520, 2900, 2160);
  g.globalCompositeOperation = 'source-over';
  g.restore();

  /* 1. broad, soft pools of wash — radial so edges never show */
  for (let i = 0; i < 22; i++) {
    const px = -260 + noise1(i * 3.1 + opts.seed, 2) * 2720;
    const topY = ridgeHeight(px, opts) + 26 + noise1(i, 8) * 140;
    const w = 180 + noise1(i * 1.7, 3) * 520;
    const h = 80 + noise1(i * 2.3, 4) * 260;
    const light = i % 3 !== 0;
    const rr = Math.max(w, h);
    const a = light
      ? .028 + noise1(i, 5) * .05
      : .025 + noise1(i, 6) * .035;
    const col = light
      ? `${opts.texture[0]},${opts.texture[1]},${opts.texture[2]}`
      : `${Math.round(opts.bottom[0] * .6)},${Math.round(opts.bottom[1] * .65)},${Math.round(opts.bottom[2] * .7)}`;
    const mg = g.createRadialGradient(px, topY + h * .3, 0, px, topY + h * .3, rr);
    mg.addColorStop(0, `rgba(${col},${a})`);
    mg.addColorStop(.55, `rgba(${col},${a * .5})`);
    mg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = mg;
    g.fillRect(px - rr, topY + h * .3 - rr, rr * 2, rr * 2);
  }

  const r = mulberry32(opts.seed * 17 + 5);
  function taper(x1, y1, x2, y2, w1, w2, col, alp) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    g.save();
    g.globalAlpha = alp;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x1 + nx * w1 * .5, y1 + ny * w1 * .5);
    g.lineTo(x2 + nx * w2 * .5, y2 + ny * w2 * .5);
    g.lineTo(x2 - nx * w2 * .5, y2 - ny * w2 * .5);
    g.lineTo(x1 - nx * w1 * .5, y1 - ny * w1 * .5);
    g.closePath();
    g.fill();
    g.restore();
  }

  /* 2. long axe-cut strokes down the steep faces */
  for (let i = 0; i < 26; i++) {
    const pk = opts.peaks[Math.floor(r() * opts.peaks.length)];
    const side = r() < .5 ? -1 : 1;
    const px = pk.x + side * (16 + r() * pk.w * .9);
    const py = ridgeHeight(px, opts) + 12 + r() * 34;
    const len = 26 + r() * 92;
    const ang = side > 0 ? (.62 + r() * .38) : (Math.PI - .62 - r() * .38);
    const x2 = px + Math.cos(ang) * len;
    const y2 = py + Math.sin(ang) * len;
    const light = r() < .5;
    const col = light
      ? `rgb(${opts.texture[0]},${opts.texture[1]},${opts.texture[2]})`
      : `rgb(${Math.max(0, opts.bottom[0] - 2)},${Math.max(0, opts.bottom[1] - 2)},${Math.max(0, opts.bottom[2] - 1)})`;
    taper(px, py, x2, y2, 1.6 + r() * 3.0, .3 + r() * .9, col, (light ? .035 : .045) + r() * .04);
  }

  /* 3. dry-brush tooth, clustered nearer the crest */
  for (let i = 0; i < 1500; i++) {
    const x = -280 + r() * 2780;
    const ry = ridgeHeight(x, opts);
    const y = ry + 6 + Math.pow(r(), 1.55) * (1080 - ry - 10);
    const len = 3.5 + r() * 18;
    const slope = ridgeHeight(x + 12, opts) - ridgeHeight(x - 12, opts);
    const ang = 1.18 + (r() - .5) * .7 + (slope > 0 ? .16 : -.16);
    const light = r() < .45;
    g.strokeStyle = light
      ? `rgba(${opts.texture[0]},${opts.texture[1]},${opts.texture[2]},${.04 + r() * .085})`
      : `rgba(${Math.max(0, opts.bottom[0])},${Math.max(0, opts.bottom[1])},${Math.max(0, opts.bottom[2])},${.045 + r() * .085})`;
    g.lineWidth = .45 + r() * 1.35;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang) * len * .55, y + Math.sin(ang) * len * .55 + (r() - .5) * 3,
      x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }

  /* 3b. dark creases hugging the ridge */
  for (let i = 0; i < 240; i++) {
    const x = -280 + r() * 2780;
    const ry = ridgeHeight(x, opts);
    const y = ry + 3 + Math.pow(r(), 1.9) * 150;
    const len = 5 + r() * 26;
    const dir = ridgeHeight(x + 10, opts) - ridgeHeight(x - 10, opts);
    const ang = 1.35 + (r() - .5) * .8 + (dir > 0 ? .2 : -.2);
    g.strokeStyle = `rgba(1,3,6,${.05 + r() * .08})`;
    g.lineWidth = .5 + r() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang) * len * .5, y + Math.sin(ang) * len * .5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }

  /* 4. sparse strata, short and broken */
  for (let i = 0; i < 34; i++) {
    const x = -240 + r() * 2700;
    const ry = ridgeHeight(x, opts);
    const y = ry + 30 + r() * (1080 - ry - 40);
    const len = 10 + r() * 58;
    g.strokeStyle = `rgba(${opts.texture[0]},${opts.texture[1]},${opts.texture[2]},${.014 + r() * .035})`;
    g.lineWidth = .4 + r() * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * .5, y + (r() - .5) * 5, x + len, y + (r() - .5) * 2.5);
    g.stroke();
  }

  /* 5. paper granulation */
  for (let i = 0; i < 900; i++) {
    const x = -280 + r() * 2780;
    const ry = ridgeHeight(x, opts);
    const y = ry + 4 + Math.pow(r(), .8) * (1080 - ry);
    const light = r() < .55;
    g.fillStyle = light
      ? `rgba(${opts.texture[0]},${opts.texture[1]},${opts.texture[2]},${.008 + r() * .026})`
      : `rgba(2,5,8,${.01 + r() * .03})`;
    g.fillRect(x, y, .6 + r() * 1.5, .6 + r() * 1.5);
  }

  /* 6. deep ink pooling in the folds */
  for (let i = 0; i < 6; i++) {
    const x = 200 + r() * 2400;
    const y = ridgeHeight(x, opts) + 60 + r() * 220;
    const rr = 90 + r() * 190;
    const a = .05 + r() * .06;
    const mg = g.createRadialGradient(x, y, 0, x, y, rr);
    mg.addColorStop(0, `rgba(1,3,6,${a})`);
    mg.addColorStop(.6, `rgba(1,3,6,${a * .5})`);
    mg.addColorStop(1, 'rgba(1,3,6,0)');
    g.fillStyle = mg;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  g.restore();

  /* 7. inked ridge: uneven, broken, and never a wire */
  g.save();
  trace();
  g.clip();
  for (let i = 0; i < pts.length - 2; i += 2) {
    const x = pts[i][0];
    const a = .10 + noise1(x * .021 + opts.seed, 23) * .22;
    g.strokeStyle = `rgba(1,4,7,${a})`;
    g.lineWidth = 1.6 + noise1(x * .06, 24) * 2.6;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(x, pts[i][1]);
    g.lineTo(pts[i + 2][0], pts[i + 2][1]);
    g.stroke();
  }
  g.restore();

  /* moonlit rim, strongest where the moon sits, fading at the edges */
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < pts.length - 2; i += 2) {
    const x = pts[i][0];
    const light = .18 + .82 * Math.exp(-Math.pow((x - 1268) / 620, 2));
    const gate = noise1(x * .037 + opts.seed * 2, 31);
    if (gate < .34) continue;
    const a = opts.rim * light * (.34 + gate * .95);
    g.strokeStyle = rgba(opts.rimColor, a);
    g.lineWidth = .75 + noise1(x * .08, 32) * .7;
    g.beginPath();
    g.moveTo(x, pts[i][1] + .4);
    g.lineTo(pts[i + 2][0], pts[i + 2][1] + .4);
    g.stroke();
  }
  g.restore();

  /* pines and winter trees, clustered, some bare */
  if (opts.trees) {
    const tr = mulberry32(opts.seed * 53 + 7);
    for (let i = 0; i < opts.trees; i++) {
      const x = -180 + tr() * 2550;
      if (opts.pagoda && Math.abs(x - opts.pagoda.x) < 74) continue;
      const y = ridgeHeight(x, opts) + 2;
      const hh = (opts.treeH || 22) * (.42 + tr() * .95);
      if (tr() < .34) {
        drawBareTree(g, x, y, hh * 1.08, rgba(opts.treeColor || [3, 6, 9], .82), .5 + tr() * .3);
      } else {
        drawPine(g, x, y, hh, rgba(opts.treeColor || [3, 6, 9], .86), .45 + tr() * .35);
      }
    }
  }

  /* far pagoda */
  if (opts.pagoda) {
    const px = opts.pagoda.x;
    const py = ridgeHeight(px, opts) + 3;
    const ph = opts.pagoda.h;
    g.save();
    g.translate(px, py);
    g.fillStyle = rgba(opts.pagoda.color, .85);
    g.strokeStyle = rgba(opts.pagoda.color, .85);
    for (let k = 0; k < 3; k++) {
      const w = ph * (.55 - k * .12), y = -k * ph * .23;
      g.beginPath();
      g.moveTo(-w, y);
      g.quadraticCurveTo(-w * .55, y - ph * .12, 0, y - ph * .13);
      g.quadraticCurveTo(w * .55, y - ph * .12, w, y);
      g.lineTo(w * .7, y + ph * .035);
      g.lineTo(-w * .7, y + ph * .035);
      g.closePath(); g.fill();
      g.fillRect(-w * .25, y + ph * .035, w * .5, ph * .09);
    }
    g.fillRect(-ph * .02, -ph * .9, ph * .04, ph * .95);
    g.restore();
  }

  return c;
}

const FAR2_MOUNT = makeMountain({
  seed: 1.4, base: 690, amp: 130, freq: .0016,
  peaks: [
    { x: 240, h: 120, w: 300 }, { x: 700, h: 180, w: 240 }, { x: 1120, h: 95, w: 210 },
    { x: 1580, h: 150, w: 230 }, { x: 2060, h: 130, w: 260 }, { x: 2380, h: 90, w: 200 }
  ],
  top: [34, 47, 58], mid: [24, 36, 46], bottom: [16, 26, 35], alpha: 1,
  texture: [116, 136, 142], wash: [140, 160, 163], washA: .08,
  rimColor: [168, 188, 190], rim: .26, veins: false,
  trees: 16, treeH: 20, treeColor: [5, 10, 15]
});

const FAR_MOUNT = makeMountain({
  seed: 3.2, base: 720, amp: 150, freq: .002,
  peaks: [
    { x: 120, h: 150, w: 260 }, { x: 370, h: 250, w: 170 }, { x: 610, h: 145, w: 190 },
    { x: 800, h: 80, w: 140 }, { x: 960, h: 270, w: 200 }, { x: 1140, h: 110, w: 120 },
    { x: 1360, h: 185, w: 150 }, { x: 1530, h: 320, w: 150 }, { x: 1760, h: 205, w: 190 },
    { x: 1970, h: 300, w: 170 }, { x: 2200, h: 200, w: 210 }, { x: 2410, h: 160, w: 220 }
  ],
  top: [23, 36, 47], mid: [13, 24, 33], bottom: [7, 15, 22], alpha: 1,
  texture: [124, 145, 150], wash: [150, 170, 173], washA: .1,
  rimColor: [182, 202, 203], rim: .38, veins: false,
  trees: 22, treeH: 26, treeColor: [8, 14, 19],
  pagoda: { x: 445, h: 46, color: [8, 14, 19] }
});

const MID_MOUNT = makeMountain({
  seed: 8.6, base: 800, amp: 140, freq: .0024,
  peaks: [
    { x: 40, h: 100, w: 220 }, { x: 280, h: 210, w: 190 }, { x: 540, h: 140, w: 170 },
    { x: 780, h: 90, w: 140 }, { x: 950, h: 205, w: 180 }, { x: 1150, h: 110, w: 130 },
    { x: 1330, h: 225, w: 170 }, { x: 1540, h: 150, w: 150 }, { x: 1750, h: 240, w: 200 },
    { x: 1980, h: 150, w: 170 }, { x: 2200, h: 200, w: 200 }, { x: 2400, h: 130, w: 170 }
  ],
  top: [14, 24, 33], mid: [7, 14, 20], bottom: [3, 6, 10], alpha: 1,
  texture: [98, 118, 124], wash: [128, 148, 152], washA: .085,
  rimColor: [152, 176, 178], rim: .26, veins: false,
  trees: 17, treeH: 27, treeColor: [2, 4, 7]
});

const NEAR_MOUNT = makeMountain({
  seed: 15.1, base: 890, amp: 80, freq: .0029,
  peaks: [
    { x: 200, h: 60, w: 300 }, { x: 420, h: 105, w: 210 }, { x: 680, h: 45, w: 180 },
    { x: 900, h: 75, w: 200 }, { x: 1160, h: 55, w: 180 }, { x: 1380, h: 95, w: 210 },
    { x: 1600, h: 50, w: 190 }, { x: 1820, h: 85, w: 220 }, { x: 2040, h: 60, w: 200 },
    { x: 2260, h: 70, w: 210 }, { x: 2460, h: 50, w: 190 }
  ],
  top: [5, 9, 14], mid: [2, 5, 8], bottom: [1, 2, 4], alpha: 1,
  texture: [64, 82, 88], wash: [86, 105, 110], washA: .05,
  rimColor: [120, 144, 148], rim: .16, veins: false,
  trees: 11, treeH: 20, treeColor: [1, 2, 4]
});

/* foreground ridge canvas */
function makeForeground() {
  const c = document.createElement('canvas');
  c.width = 2800; c.height = 1080;
  const g = c.getContext('2d');
  g.translate(290, 0);
  const line = RIDGE_LINE.filter(p => p.x >= -290 && p.x <= 2510).map(p => [
    p.x,
    p.y + (noise1(p.x * .42 + 3.1, 41) - .5) * 2.2 + (noise1(p.x * 1.7, 43) - .5) * .9
  ]);
  g.beginPath();
  g.moveTo(line[0].x, 1080);
  g.lineTo(line[0].x, line[0].y);
  for (let i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y);
  g.lineTo(2510, 1080);
  g.closePath();
  const grad = g.createLinearGradient(0, 650, 0, 1080);
  grad.addColorStop(0, 'rgba(7,11,14,.99)');
  grad.addColorStop(.42, 'rgba(4,7,10,1)');
  grad.addColorStop(1, 'rgba(1,2,4,1)');
  g.fillStyle = grad;
  g.fill();

  g.save();
  g.clip();
  const r = mulberry32(4242);

  /* rice-paper tooth */
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = .6;
  g.fillStyle = getPaper(g);
  g.fillRect(-290, -60, 2900, 1200);
  g.restore();

  /* broad soft ink breaths on the slope */
  for (let i = 0; i < 10; i++) {
    const x = -220 + r() * 2700;
    const top = ridgeYAt(x) + 36;
    const cy = top + 90 + r() * 160;
    const rr = 150 + r() * 260;
    const light = i % 2 === 1;
    const a = light ? .026 + r() * .035 : .04 + r() * .05;
    const col = light ? '96,118,120' : '1,2,4';
    const mg = g.createRadialGradient(x, cy, 0, x, cy, rr);
    mg.addColorStop(0, `rgba(${col},${a})`);
    mg.addColorStop(.55, `rgba(${col},${a * .5})`);
    mg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = mg;
    g.fillRect(x - rr, cy - rr, rr * 2, rr * 2);
  }

  /* cliff striations */
  for (let i = 0; i < 170; i++) {
    const x = -280 + r() * 2760;
    const y = ridgeYAt(x) + 8 + Math.pow(r(), .7) * 360;
    g.strokeStyle = `rgba(104,126,128,${.008 + r() * .03})`;
    g.lineWidth = .5 + r() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 18 + r() * 44, y + 7, x + 42 + r() * 140, y + (r() - .5) * 16);
    g.stroke();
  }
  /* folds on the big left cliff */
  for (let i = 0; i < 26; i++) {
    const x = -240 + r() * 620;
    const top = ridgeYAt(x) + 16;
    g.strokeStyle = `rgba(92,114,117,${.012 + r() * .03})`;
    g.lineWidth = .8 + r() * 3.6;
    g.beginPath();
    g.moveTo(x, top);
    g.bezierCurveTo(x + 28, top + 80, x - 18, top + 170, x + 22, top + 300);
    g.stroke();
  }
  /* three quiet ledges, not wire contours */
  for (let i = 0; i < 3; i++) {
    const off = 34 + r() * 120;
    g.strokeStyle = `rgba(122,144,144,${.006 + r() * .012})`;
    g.lineWidth = .8 + r() * 1.2;
    g.beginPath();
    for (let x = 80; x < 2250; x += 16) {
      const y = ridgeYAt(x) + off + Math.sin(x * .009 + i) * 7 + Math.sin(x * .031 + i * 2) * 2;
      if (x === 80) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  /* granulation */
  for (let i = 0; i < 750; i++) {
    const x = -280 + r() * 2760;
    const y = ridgeYAt(x) + 4 + r() * 420;
    g.fillStyle = r() < .5 ? `rgba(112,132,134,${.006 + r() * .02})` : `rgba(0,1,3,${.02 + r() * .04})`;
    g.fillRect(x, y, .6 + r() * 1.4, .6 + r() * 1.4);
  }
  g.restore();

  /* broken moonlit rim, strongest under the moon */
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < line.length - 2; i += 2) {
    const x = line[i].x;
    const light = .2 + .8 * Math.exp(-Math.pow((x - 1268) / 560, 2));
    const gate = noise1(x * .05 + 9.1, 47);
    if (gate < .42) continue;
    g.strokeStyle = `rgba(160,184,184,${(.075 + gate * .12) * light})`;
    g.lineWidth = .5 + gate * .8;
    g.beginPath();
    g.moveTo(x, line[i].y);
    g.lineTo(line[i + 2].x, line[i + 2].y);
    g.stroke();
  }
  g.restore();

  /* a faint trail */
  g.beginPath();
  for (let x = 220; x <= 1740; x += 6) {
    const y = ridgeYAt(x) + 9 + Math.sin(x * .012) * 3;
    if (x === 220) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokeStyle = 'rgba(176,188,180,.05)';
  g.lineWidth = 2.2;
  g.setLineDash([3, 13]);
  g.stroke();
  g.setLineDash([]);

  /* grass tufts and small rocks */
  const rr = mulberry32(999);
  for (let x = 40; x < 2450; x += 18 + rr() * 30) {
    const y = ridgeYAt(x) + 2;
    if (rr() < .42) {
      g.strokeStyle = `rgba(104,126,125,${.03 + rr() * .06})`;
      g.lineWidth = .7 + rr() * .7;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x + k * 2, y);
        g.quadraticCurveTo(x + (rr() - .5) * 18, y - 7 - rr() * 12, x + (rr() - .5) * 24, y - 12 - rr() * 18);
        g.stroke();
      }
    }
    if (rr() < .16) {
      const w = 8 + rr() * 26, h = 4 + rr() * 13;
      g.fillStyle = 'rgba(2,4,6,.9)';
      g.beginPath();
      g.ellipse(x, y + 1, w, h, 0, Math.PI, TAU);
      g.fill();
      g.strokeStyle = 'rgba(118,142,144,.05)';
      g.lineWidth = .8;
      g.stroke();
    }
  }

  /* two foreground pines */
  drawPine(g, 92, ridgeYAt(92) + 1, 142, 'rgba(2,4,7,.94)', .94);
  drawPine(g, 1876, ridgeYAt(1876) + 1, 104, 'rgba(2,4,7,.92)', .82);
  return c;
}

const FOREGROUND = makeForeground();

/* ---------------------------------------------- plum branch */

const PLUM = { segs: [], blossoms: [], buds: [] };
{
  const pr = mulberry32(2025);
  function pushSeg(x1, y1, mx, my, x2, y2, w1, w2) {
    PLUM.segs.push({ x1, y1, mx, my, x2, y2, w1, w2, w: Math.max(w1, w2) });
  }
  function addBlossom(x, y, sx, sy, s, delay, red) {
    PLUM.blossoms.push({ x, y, sx, sy, s, delay, rot: pr() * TAU, red });
  }
  function addBud(x, y, sx, sy, s, delay, red) {
    PLUM.buds.push({ x, y, sx, sy, s, delay, rot: pr() * TAU, red });
  }
  function twig(x, y, ang, len, w, d) {
    if (PLUM.segs.length > 112) return;
    const bend = (pr() - .5) * .8;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len + Math.abs(bend) * 7;
    const mx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * bend * len * .5;
    const my = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * bend * len * .5;
    const w2 = Math.max(.4, w * .52);
    pushSeg(x, y, mx, my, x2, y2, w, w2);
    if (d >= 2) {
      const n = 3 + Math.floor(pr() * 3);
      for (let i = 0; i < n; i++) {
        const a = pr() * TAU, rr = 4 + pr() * 13;
        addBlossom(
          x2 + Math.cos(a) * rr, y2 + Math.sin(a) * rr * .85,
          x2, y2, .6 + pr() * .5, pr() * .55, pr() < .26
        );
      }
      if (pr() < .85) addBud(x2 + (pr() - .5) * 16, y2 + (pr() - .5) * 14, x2, y2, .5 + pr() * .4, pr() * .6, pr() < .4);
      return;
    }
    const n = d === 0 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const na = ang + (pr() - .5) * 1.2 + (i === 0 ? -.3 : i === 2 ? .32 : .02);
      twig(x2, y2, na, len * (.52 + pr() * .18), w2 * .9, d + 1);
    }
    if (d >= 1 && pr() < .72) {
      const a2 = pr() * TAU, r2 = 4 + pr() * 10;
      addBlossom(x2 + Math.cos(a2) * r2, y2 + Math.sin(a2) * r2, x2, y2, .62 + pr() * .42, pr() * .5, pr() < .25);
      if (pr() < .5) addBlossom(x2 + (pr() - .5) * 14, y2 + (pr() - .5) * 12, x2, y2, .58 + pr() * .36, pr() * .5, pr() < .22);
    }
  }

  /* a thick, S-curved trunk entering from beyond the top-right corner */
  pushSeg(2600, -420, 2320, -80, 2110, 120, 25, 16);
  pushSeg(2110, 120, 1996, 190, 1900, 262, 16, 9);

  /* sweeping limbs: one toward the moon, one dropping, one filling the corner */
  pushSeg(2020, 148, 1840, 118, 1652, 188, 9.5, 4.2);
  pushSeg(1945, 220, 1830, 288, 1704, 366, 7.6, 3.2);
  pushSeg(2300, -90, 2120, -150, 1930, -172, 8.2, 3.8);
  pushSeg(2160, 22, 2040, -58, 1888, -112, 7.6, 3);
  pushSeg(2110, 120, 2062, 52, 1990, 6, 5.4, 2.6);

  /* curved twigs off the limbs */
  twig(1836, 182, 3.72, 108, 5.2, 1);
  twig(1810, 205, 2.95, 92, 4.6, 1);
  twig(1652, 188, 3.38, 98, 4.2, 1);
  twig(1730, 232, 2.5, 104, 4.6, 1);
  twig(1704, 366, 3.66, 62, 3.1, 2);
  twig(1748, 292, 3.06, 70, 3.2, 2);
  twig(1930, -168, 3.55, 96, 4.4, 1);
  twig(1972, -128, 2.95, 110, 4.8, 1);
  twig(1888, -112, 3.3, 88, 3.8, 2);
  twig(1996, -6, 2.7, 96, 4.0, 2);

  /* composed accents near the moonward tips */
  addBlossom(1642, 160, 1660, 170, 1.02, .12, false);
  addBlossom(1608, 132, 1636, 152, .84, .3, true);
  addBlossom(1666, 198, 1664, 188, .94, .2, false);
  addBlossom(1600, 236, 1644, 198, .78, .42, false);
  addBlossom(1586, 284, 1648, 258, .86, .34, false);
  addBlossom(1640, 350, 1660, 328, .82, .46, true);
  addBlossom(1752, 116, 1788, 118, .9, .26, false);
  addBlossom(1846, 46, 1870, 52, .8, .16, true);
  addBlossom(1722, 270, 1712, 258, .84, .38, false);
  addBlossom(1858, -108, 1882, -110, .9, .22, false);
  addBlossom(1918, -58, 1934, -70, .82, .34, true);
  addBlossom(2024, 62, 2046, 40, .88, .26, false);
  addBud(1612, 190, 1634, 176, .8, .5, false);
  addBud(1684, 266, 1678, 252, .72, .55, true);
  addBud(1724, 150, 1742, 160, .66, .45, false);
  addBud(1976, -104, 1990, -92, .74, .48, false);
}

/* ---------------------------------------------- particles (deterministic) */

function makeField(n, seed, fn) {
  const r = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(fn(r, i));
  return out;
}
const MOTES = makeField(84, 31, (r) => ({
  x: r() * W, y: 300 + r() * 700, r: .6 + r() * 1.8,
  ph: r() * TAU, sp: .15 + r() * .5, drift: 10 + r() * 26,
  a: .08 + r() * .35
}));
const SNOW = makeField(120, 44, (r) => ({
  x: r() * W, y: r() * H, r: .7 + r() * 2.1,
  sp: 10 + r() * 22, ph: r() * TAU, sway: 12 + r() * 28, a: .15 + r() * .45
}));
const PETALS = makeField(84, 55, (r) => ({
  x: 680 + r() * 1360, y: -80 + r() * 820,
  sp: 12 + r() * 26, ph: r() * TAU, sway: 16 + r() * 52,
  rot: r() * TAU, vr: (r() - .5) * .9, s: .8 + r() * 1.0,
  red: r() < .26, a: .26 + r() * .38
}));
const NEAR_PETALS = makeField(10, 200, (r) => ({
  x: -100 + r() * 2120, y: -120 + r() * 980,
  sp: 14 + r() * 22, ph: r() * TAU, sway: 30 + r() * 60,
  rot: r() * TAU, vr: (r() - .5) * .5, s: 1.7 + r() * 1.2,
  red: r() < .32, a: .16 + r() * .2
}));
const EMBERS = makeField(54, 66, (r) => ({
  x: 220 + r() * 1580, y: 460 + r() * 520,
  sp: 8 + r() * 28, ph: r() * TAU, drift: 10 + r() * 40,
  r: .5 + r() * 1.6, a: .2 + r() * .5
}));

const LANTERNS = makeField(4, 73, (r) => ({
  x: 1020 + r() * 700, sp: 17 + r() * 10,
  ph: r() * TAU, sway: 12 + r() * 24,
  s: 1.5 + r() * .5, a: .42 + r() * .18
}));

const FIREFLIES = makeField(18, 91, (r) => ({
  x: 220 + r() * 1480, y: 730 + r() * 220,
  ax: 12 + r() * 34, ay: 8 + r() * 22,
  sp: .14 + r() * .28, ph: r() * TAU,
  s: .65 + r() * .9, a: .3 + r() * .4
}));

const REEDS = makeField(82, 122, (r) => {
  const left = r() < .5;
  return {
    x: left ? -40 + r() * 380 : 1600 + r() * 350,
    y: 1000 + r() * 78, h: 82 + r() * 132,
    lean: (r() - .5) * .9, ph: r() * TAU,
    sp: .3 + r() * .42, w: 1.1 + r() * 1.25,
    a: .66 + r() * .3, seed: r() < .52
  };
});

const GRASS = makeField(54, 140, (r) => ({
  x: -40 + r() * 2000, h: 9 + r() * 28,
  lean: (r() - .5) * .7, ph: r() * TAU,
  sp: .4 + r() * .5, w: .8 + r() * .8,
  a: .28 + r() * .34
}));

const WATER_LIGHTS = makeField(2, 177, (r) => ({
  x: 300 + r() * 1200, ph: r() * TAU, drift: 26 + r() * 34,
  sp: .04 + r() * .035, s: .9 + r() * .45, a: .5 + r() * .24
}));

const bursts = [];
function spawnBurst(x, y, n, color = 'gold', power = 1) {
  if (reduceMotion) n = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const v = (25 + Math.random() * 90) * power;
    bursts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25,
      life: .5 + Math.random() * 1.1, age: 0,
      r: .8 + Math.random() * 2.4, color,
      rot: Math.random() * TAU
    });
  }
}

/* shooting stars */
const METEORS = [
  { t0: 21.1, dur: 1.8, x: 1210, y: 125, dx: -420, dy: 230 },
  { t0: 64.8, dur: 1.6, x: 1500, y: 90, dx: -560, dy: 260 },
  { t0: 84.4, dur: 1.5, x: 1120, y: 150, dx: 470, dy: 220 }
];

/* ---------------------------------------------- state */

const DBG = { glow: true, air: true, fog: true, vignette: true, grain: true, wash: true, sky: true, stars: true, moon: true, palace: true, far2: true, maria: true, craters: true, mgrain: true, limb: true, lower: true, landscape: true, far: true, mid: true, near: true, swash: true, enso: true, cranes: true, foreground: true, trail: true, hut: true, figure: true, plum: true, wind: true, particles: true, post: true, clouds: true, geese: true, water: true, boat: true, reeds: true, lanterns: true, fireflies: true };
const state = {
  started: false,
  paused: true,
  ended: false,
  uiIdle: false,
  startedAt: 0,
  lastFrame: performance.now(),
  forcedTime: null,
  previewStart: performance.now(),
  lastEnvStep: -1,
  lastBeat: -10,
  pulse: 0,
  voicePulse: 0,
  lastBreathIdx: -1,
  simMode: false, simT0: 0, simBase: 0,
  silent: false, silentBase: 0, silentT0: 0,
  chapterIdx: -1,
  keylineIdx: -1,
  endShown: false,
  dragging: false,
  wasPlayingBeforeDrag: false
};

const els = {
  intro: $('intro'), enter: $('enter'), hud: $('hud'), chapter: $('chapter'),
  chIndex: $('chIndex'), chTitle: $('chTitle'), chEn: $('chEn'),
  keyline: $('keyline'), keylineMain: $('keylineMain'), keylineSub: $('keylineSub'),
  endcard: $('endcard'), again: $('again'),
  btnPlay: $('btnPlay'), iconPlay: $('iconPlay'), iconPause: $('iconPause'),
  btnMute: $('btnMute'), btnFs: $('btnFs'), volume: $('volume'),
  progress: $('progress'), progressFill: $('progressFill'), progressHead: $('progressHead'),
  ticks: $('ticks'), curTime: $('curTime'), durTime: $('durTime'),
  toast: $('toast'), sr: $('srStatus'), wave1: $('wave1'), wave2: $('wave2'),
  muteSlash: $('muteSlash')
};

function fmt(t) {
  t = Math.max(0, Math.min(DURATION, t || 0));
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/* ---------------------------------------------- UI helpers */

function showToast(msg, ms = 5200) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add('is-on');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('is-on'), ms);
}

function setMuteIcon() {
  const muted = audio.muted || audio.volume === 0;
  els.muteSlash.style.display = muted ? '' : 'none';
  els.wave1.style.display = muted ? 'none' : '';
  els.wave2.style.display = muted ? 'none' : '';
  els.btnMute.setAttribute('aria-label', muted ? '取消静音' : '静音');
}
function setPlayIcon() {
  const paused = state.paused || state.ended;
  els.iconPlay.style.display = paused ? '' : 'none';
  els.iconPause.style.display = paused ? 'none' : '';
  els.btnPlay.setAttribute('aria-label', paused ? '播放' : '暂停');
}

function buildTicks() {
  els.ticks.innerHTML = '';
  for (const t of MARKS) {
    const i = document.createElement('i');
    i.className = 'tick is-major';
    i.style.left = (t / DURATION * 100) + '%';
    els.ticks.appendChild(i);
  }
}

function updateTimeUI(t) {
  const p = clamp(t / DURATION);
  els.progressFill.style.width = (p * 100) + '%';
  els.progressHead.style.left = (p * 100) + '%';
  els.curTime.textContent = fmt(t);
  els.progress.setAttribute('aria-valuenow', String(Math.floor(t)));
}

function updateOverlays(t) {
  let active = -1;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (t >= CHAPTERS[i].t0 && t < CHAPTERS[i].t1) { active = i; break; }
  }
  if (active !== state.chapterIdx) {
    state.chapterIdx = active;
    if (active >= 0) {
      const c = CHAPTERS[active];
      els.chIndex.textContent = c.idx;
      els.chTitle.textContent = c.title;
      els.chEn.textContent = c.en;
      els.chapter.classList.add('is-on');
      els.sr.textContent = c.idx + '，' + c.title;
    } else {
      els.chapter.classList.remove('is-on');
    }
  }

  let kl = -1;
  for (let i = 0; i < KEYLINES.length; i++) {
    if (t >= KEYLINES[i].t0 && t < KEYLINES[i].t1) { kl = i; break; }
  }
  if (kl !== state.keylineIdx) {
    state.keylineIdx = kl;
    if (kl >= 0) {
      els.keylineMain.textContent = KEYLINES[kl].main;
      els.keylineSub.textContent = KEYLINES[kl].sub;
      els.keyline.classList.add('is-on');
    } else {
      els.keyline.classList.remove('is-on');
    }
  }
}

function revealEnd(force) {
  if (force === false) {
    els.endcard.classList.remove('is-on');
    state.endShown = false;
    return;
  }
  if (state.endShown) return;
  state.endShown = true;
  els.endcard.classList.add('is-on');
  stage.classList.remove('is-idle');
  els.sr.textContent = '影片结束';
}

/* ---------------------------------------------- playback */

let idleTimer = null, lastTimeText = -1;
function markActivity(keepVisible = false) {
  stage.classList.remove('is-idle');
  state.uiIdle = false;
  clearTimeout(idleTimer);
  if (state.paused || state.ended || state.forcedTime !== null || keepVisible) return;
  idleTimer = setTimeout(() => {
    if (!state.paused && !state.ended) {
      stage.classList.add('is-idle');
      state.uiIdle = true;
    }
  }, 3200);
}

function hideIntro() {
  els.intro.classList.add('is-hidden');
  stage.classList.add('is-started');
}

async function startExperience() {
  if (state.started) return;
  state.started = true;
  state.paused = false;
  state.ended = false;
  state.forcedTime = null;
  hideIntro();
  els.enter.blur();
  setPlayIcon();
  markActivity();
  try {
    await initAnalyser();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    audio.currentTime = 0;
    await audio.play();
  } catch (e) {
    console.warn('play failed; entering silent demo', e);
    state.silent = true;
    state.paused = false;
    state.silentBase = 0;
    state.silentT0 = performance.now();
    setPlayIcon();
    showToast('音源未包含或无法播放：已进入静音演示。将你有权使用的音源保存为 audio/song.mp3 后刷新，即可带声播放。', 9000);
  }
  ensureLoop();
}

function togglePlay() {
  if (!state.started) { startExperience(); return; }
  if (state.ended) { replay(); return; }
  if (state.silent) {
    if (state.paused) {
      state.paused = false;
      state.silentT0 = performance.now();
      setPlayIcon();
      markActivity();
      ensureLoop();
    } else {
      state.silentBase = currentSceneTime();
      state.paused = true;
      setPlayIcon();
      markActivity(true);
    }
    return;
  }
  if (audio.paused) {
    state.paused = false;
    initAnalyser().then(() => audioCtx && audioCtx.resume()).catch(() => {});
    audio.play().catch(() => {});
    setPlayIcon();
    markActivity();
  } else {
    state.paused = true;
    audio.pause();
    stage.classList.remove('is-idle');
    setPlayIcon();
    markActivity(true);
  }
}

function replay() {
  state.ended = false;
  state.paused = false;
  state.forcedTime = null;
  revealEnd(false);
  if (state.silent) {
    state.silentBase = 0;
    state.silentT0 = performance.now();
    setPlayIcon();
    markActivity();
    ensureLoop();
    return;
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
  setPlayIcon();
  markActivity();
  ensureLoop();
}

function seekTo(t) {
  t = clamp(t, 0, DURATION - .05);
  state.ended = false;
  state.lastBreathIdx = -1;
  if (t < 166.4) revealEnd(false);
  if (state.silent) {
    state.silentBase = t;
    state.silentT0 = performance.now();
  }
  try { audio.currentTime = t; } catch (e) {}
  if (state.forcedTime !== null) state.forcedTime = t;
  updateTimeUI(t);
  updateOverlays(t);
  if (!state.started) return;
  if (state.paused || state.ended) renderAt(currentSceneTime());
}

function audioSeekFromPointer(ev) {
  const r = els.progress.getBoundingClientRect();
  const x = clamp((ev.clientX - r.left) / r.width);
  const t = x * DURATION;
  updateTimeUI(t);
  updateOverlays(t);
  return t;
}

/* progress interactions */
els.progress.addEventListener('pointerdown', (e) => {
  if (!state.started) return;
  state.dragging = true;
  els.progress.setPointerCapture && els.progress.setPointerCapture(e.pointerId);
  seekTo(audioSeekFromPointer(e));
  markActivity(true);
});
els.progress.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  seekTo(audioSeekFromPointer(e));
});
els.progress.addEventListener('pointerup', (e) => {
  if (!state.dragging) return;
  state.dragging = false;
  seekTo(audioSeekFromPointer(e));
  markActivity();
});
els.progress.addEventListener('pointercancel', () => { state.dragging = false; });
els.progress.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    seekTo((audio.currentTime || 0) + dir * 5);
    markActivity(true);
  } else if (e.key === 'Home') { e.preventDefault(); seekTo(0); }
  else if (e.key === 'End') { e.preventDefault(); seekTo(DURATION - 1); }
});

/* audio events */
audio.addEventListener('loadedmetadata', () => {
  if (isFinite(audio.duration) && audio.duration > 20) {
    els.durTime.textContent = fmt(audio.duration);
  }
});
audio.addEventListener('play', () => {
  state.paused = false; state.ended = false; setPlayIcon();
  ensureLoop();
});
audio.addEventListener('pause', () => {
  if (state.ended) return;
  state.paused = true; setPlayIcon(); markActivity(true);
});
audio.addEventListener('ended', () => {
  state.ended = true; state.paused = true;
  setPlayIcon();
  revealEnd(true);
  updateTimeUI(DURATION);
});
audio.addEventListener('error', () => {
  showToast('音源加载失败：请确认 audio/song.mp3 所在目录正确，或使用「播放MV.bat」启动本地服务器后观看。', 9000);
});

/* controls */
els.enter.addEventListener('click', (e) => { e.stopPropagation(); startExperience(); });
els.btnPlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
els.again.addEventListener('click', (e) => { e.stopPropagation(); replay(); });
els.btnMute.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.muted = !audio.muted;
  setMuteIcon();
});
els.volume.addEventListener('input', () => {
  audio.volume = clamp(parseFloat(els.volume.value));
  if (audio.volume > 0 && audio.muted) audio.muted = false;
  setMuteIcon();
});
els.btnFs.addEventListener('click', async (e) => {
  e.stopPropagation();
  try {
    if (!document.fullscreenElement) {
      await viewport.requestFullscreen();
      els.btnFs.setAttribute('aria-label', '退出全屏');
    } else {
      await document.exitFullscreen();
      els.btnFs.setAttribute('aria-label', '进入全屏');
    }
  } catch (err) {
    showToast('当前浏览器不允许全屏，可直接按 F11。', 3000);
  }
});
document.addEventListener('fullscreenchange', () => {
  els.btnFs.setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
  setTimeout(resize, 60);
});
canvas.addEventListener('click', () => { if (state.started) togglePlay(); });
window.addEventListener('pointermove', () => markActivity(), { passive: true });
window.addEventListener('touchstart', () => markActivity(), { passive: true });

document.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')) {
    if (e.code === 'Space') return;
  }
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); markActivity(); }
  else if (e.code === 'ArrowLeft' && state.started) { e.preventDefault(); seekTo(audio.currentTime - 5); markActivity(); }
  else if (e.code === 'ArrowRight' && state.started) { e.preventDefault(); seekTo(audio.currentTime + 5); markActivity(); }
  else if (e.key === 'f' || e.key === 'F') { els.btnFs.click(); }
  else if (e.key === 'm' || e.key === 'M') { els.btnMute.click(); }
});

/* ---------------------------------------------- scene time & beats */

function currentSceneTime() {
  if (state.forcedTime !== null) return state.forcedTime;
  if (state.simMode) return clamp(state.simBase + (performance.now() - state.simT0) / 1000, 0, DURATION);
  if (!state.started) {
    const sec = (performance.now() - state.previewStart) / 1000;
    return Math.min(4.4, 1.25 + sec * .055);
  }
  if (state.ended) return DURATION;
  if (state.silent) {
    const base = state.paused ? state.silentBase : state.silentBase + (performance.now() - state.silentT0) / 1000;
    return clamp(base, 0, DURATION);
  }
  return clamp(audio.currentTime || 0, 0, DURATION);
}

let lastBreathTime = -10;
function handleBreaths(t, d) {
  let idx = -1;
  for (let i = 0; i < BREATHS.length; i++) {
    if (t >= BREATHS[i] - .02) idx = i; else break;
  }
  if (idx !== state.lastBreathIdx) {
    state.lastBreathIdx = idx;
    if (idx >= 0 && t - BREATHS[idx] < .26) {
      state.voicePulse = 1;
      lastBreathTime = t;
      if (d && d.gold > .35) spawnBurst(d.moonX + (Math.random() - .5) * 260, d.moonY + 100 + Math.random() * 120, 2, 'gold', .5);
    }
  }
}

function detectBeat(t) {
  const low = envVal('low', t);
  const prev = envVal('low', Math.max(0, t - .4));
  const step = Math.floor(t / (ENV.hop || .2));
  const nearBeat = low > .62 && (low - prev) > .08;
  if (nearBeat && t - state.lastBeat > .34 && step !== state.lastEnvStep) {
    state.lastBeat = t;
    state.pulse = 1;
    if (t > 25 && t < 148 && Math.random() < .22) {
      const fig = makeDirector(t);
      spawnBurst(fig.moonX + (Math.random() - .5) * 90, fig.moonY + 70 + Math.random() * 50, 1, 'gold', .35);
    }
  }
  state.lastEnvStep = step;
}

/* ---------------------------------------------- debug / QA */

window.MV = {
  version: '1.0',
  seek(t) { if (!state.started) { state.started = true; state.paused = true; hideIntro(); state.forcedTime = t; } else { seekTo(t); } renderAt(t); },
  previewAt(t) {
    state.started = true;
    state.paused = true;
    hideIntro();
    els.intro.style.display = 'none';
    stage.classList.add('is-started');
    state.forcedTime = clamp(t, 0, DURATION);
    state.chapterIdx = -2; state.keylineIdx = -2;
    updateOverlays(state.forcedTime);
    updateTimeUI(state.forcedTime);
    revealEnd(state.forcedTime >= 166.5);
    setPlayIcon();
    markActivity(true);
    renderAt(state.forcedTime);
  },
  resumePreview() { state.forcedTime = null; },
  renderAt(t) { renderAt(t); },
  debug: DBG,
  state() { return { t: currentSceneTime(), paused: state.paused, ended: state.ended, duration: DURATION, analyser: analyserReady }; }
};

/* =========================================================
   DRAWING ENGINE
   ========================================================= */

function screenMoon(d) {
  return {
    x: (d.moonX - d.fx) * d.zoom + W / 2,
    y: (d.moonY - d.fy) * d.zoom + H / 2,
    r: d.moonR * d.zoom
  };
}

function applyCamera(t, d) {
  const driftX = reduceMotion ? 0 : (Math.sin(t * .075 + 1.1) * 6.0 + Math.sin(t * .028 + .4) * 2.5);
  const driftY = reduceMotion ? 0 : (Math.sin(t * .055 + .8) * 3.0 + Math.sin(t * .017) * 1.4);
  const z = d.zoom * (reduceMotion ? 1 : 1 + Math.sin(t * .037 + 2.2) * .005);
  ctx.translate(W / 2 + driftX, H / 2 + driftY);
  ctx.scale(z, z);
  ctx.translate(-d.fx, -d.fy);
}

/* ---------------------------------------------- sky */

function drawSky(t, d) {
  const dawn = clamp(d.dawn);
  const top = mixRGB([3, 6, 12], [12, 20, 34], dawn);
  const mid = mixRGB([9, 15, 23], [34, 44, 53], dawn);
  const low = mixRGB([18, 29, 37], [112, 86, 64], dawn * .95);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(top, 1));
  g.addColorStop(.48, rgba(mid, 1));
  g.addColorStop(.78, rgba(low, 1));
  g.addColorStop(1, rgba(mixRGB(low, [3, 5, 8], .45), 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* faint warm air near the horizon */
  if (DBG.air) {
    const m = screenMoon(d);
    const air = ctx.createRadialGradient(m.x, m.y + m.r * 1.45, m.r * .3, m.x, m.y + m.r * 1.4, m.r * 5.8);
    air.addColorStop(0, `rgba(208,205,182,${.08 + d.glow * .08})`);
    air.addColorStop(.5, `rgba(150,170,170,${.028 + d.glow * .03})`);
    air.addColorStop(1, 'rgba(80,110,120,0)');
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, W, H);
  }

  const hz = ctx.createRadialGradient(W * .56, 790, 0, W * .56, 790, W * .8);
  hz.addColorStop(0, `rgba(94,84,68,${dawn * .17})`);
  hz.addColorStop(.42, `rgba(60,59,54,${dawn * .055})`);
  hz.addColorStop(1, 'rgba(20,25,30,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, 0, W, H);

  /* a low breath of warm daybreak */
  if (dawn > .16) {
    const dg = ctx.createLinearGradient(0, H * .62, 0, H);
    const da = smooth((dawn - .16) / .4) * .46;
    dg.addColorStop(0, 'rgba(126,88,62,0)');
    dg.addColorStop(.55, `rgba(158,110,74,${da * .5})`);
    dg.addColorStop(1, `rgba(190,138,94,${da})`);
    ctx.fillStyle = dg;
    ctx.fillRect(0, H * .62, W, H * .38);
  }

  /* faint paper tooth so the night sky never reads as a flat ramp */
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = .34;
  ctx.fillStyle = getPaper(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawClouds(t, d) {
  if (!DBG.clouds) return;
  const bobA = Math.sin(t * .055 + .8) * 8;
  const driftA = (t * 14) % 1700;
  const xA = 760 - driftA;
  const bobB = Math.cos(t * .043 + 1.7) * 10;
  const driftB = (t * 21 + 520) % 1700;
  const xB = 150 - driftB;
  const blit = (img, x, y, w, h) => {
    if (x > W || x + w < 0) return;
    ctx.drawImage(img, x, y, w, h);
  };
  ctx.save();
  ctx.globalAlpha = .68;
  blit(CLOUD_A, xA, 50 + bobA, 1700, 560);
  blit(CLOUD_A, xA + 1700, 50 + bobA, 1700, 560);
  ctx.globalAlpha = .46;
  blit(CLOUD_B, xB, 210 + bobB, 1600, 527);
  blit(CLOUD_B, xB + 1700, 210 + bobB, 1600, 527);
  /* a faster silver veil, so moonlight visibly moves through cloud */
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = .26;
  const bobC = Math.sin(t * .071 + 2.4) * 9;
  const driftC = (t * 30 + 250) % 1700;
  const xC = 1120 - driftC;
  blit(CLOUD_B, xC, 92 + bobC, 1600, 527);
  blit(CLOUD_B, xC + 1700, 92 + bobC, 1600, 527);
  ctx.restore();
}

function drawStars(t, d) {
  if (d.star < .015) return;
  const m = screenMoon(d);
  ctx.save();
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    if (s.y > 850) continue;
    const dx = s.x - m.x, dy = s.y - m.y;
    if (dx * dx + dy * dy < (m.r * 1.14) * (m.r * 1.14)) continue;
    const tw = .86 + .14 * Math.sin(t * s.sp + s.ph);
    const a = s.a * tw * d.star;
    if (a < .012) continue;
    ctx.fillStyle = `rgba(226,231,220,${a})`;
    if (s.flare) {
      ctx.fillRect(s.x - 2.2, s.y - .4, 4.4, .8);
      ctx.fillRect(s.x - .4, s.y - 2.2, .8, 4.4);
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawMeteors(t, d) {
  for (const m of METEORS) {
    if (t < m.t0 || t > m.t0 + m.dur + .4) continue;
    const p = clamp((t - m.t0) / m.dur);
    const e = easeOut(p);
    const fade = Math.sin(Math.PI * clamp(p)) * .9;
    if (fade <= 0) continue;
    const x = m.x + m.dx * e;
    const y = m.y + m.dy * e;
    const tail = 170 + 90 * e;
    const ang = Math.atan2(m.dy, m.dx);
    const g = ctx.createLinearGradient(x, y, x - Math.cos(ang) * tail, y - Math.sin(ang) * tail);
    g.addColorStop(0, `rgba(235,236,220,${.75 * fade})`);
    g.addColorStop(.18, `rgba(200,210,205,${.3 * fade})`);
    g.addColorStop(1, 'rgba(150,180,190,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(ang) * tail, y - Math.sin(ang) * tail);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,250,235,${fade})`;
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/* ---------------------------------------------- moon */

function drawInkHalo(x, y, r, alpha, seed, t) {
  ctx.save();
  ctx.strokeStyle = `rgba(214,207,183,${alpha})`;
  ctx.lineWidth = 1;
  for (let ring = 0; ring < 2; ring++) {
    ctx.beginPath();
    const rr = r + ring * 6;
    for (let i = 0; i <= 100; i++) {
      const a = i / 100 * TAU;
      const j = noise1(i * .34 + seed + ring * 4.2, seed) * 3.2 + (noise1(i * .9 + t * .02, seed + 8) - .5) * 2;
      const px = x + Math.cos(a) * (rr + j);
      const py = y + Math.sin(a) * (rr * .985 + j);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.globalAlpha = ring === 0 ? .55 : .22;
    ctx.stroke();
  }
  ctx.restore();
}

function sweepRoof(cx, cy, w, h, dark, light) {
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.quadraticCurveTo(cx - w * .74, cy - h * .58, cx - w * .42, cy - h * .8);
  ctx.quadraticCurveTo(cx - w * .12, cy - h * .99, cx, cy - h);
  ctx.quadraticCurveTo(cx + w * .12, cy - h * .99, cx + w * .42, cy - h * .8);
  ctx.quadraticCurveTo(cx + w * .74, cy - h * .58, cx + w, cy);
  ctx.quadraticCurveTo(cx + w * .83, cy - h * .1, cx + w * .62, cy - h * .15);
  ctx.lineTo(cx - w * .62, cy - h * .15);
  ctx.quadraticCurveTo(cx - w * .83, cy - h * .1, cx - w, cy);
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = 1;
  ctx.stroke();
  /* upturned eave tips */
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.quadraticCurveTo(cx - w * 1.07, cy - h * .12, cx - w * 1.02, cy - h * .25);
  ctx.moveTo(cx + w, cy);
  ctx.quadraticCurveTo(cx + w * 1.07, cy - h * .12, cx + w * 1.02, cy - h * .25);
  ctx.stroke();
}

function drawPalace(x, y, r, alpha, t) {
  if (alpha < .012) return;
  const s = r / 150 * .78;
  ctx.save();
  ctx.translate(x, y + r * .30);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(alpha) * .92;
  const ink = 'rgba(45,53,48,.50)';
  const deep = 'rgba(32,40,36,.64)';
  const pale = 'rgba(245,240,220,.30)';
  const flick = .7 + .3 * Math.sin(t * 2.1) * Math.sin(t * .47 + 1.3);

  /* cloud terrace: soft lobes, never a drawn horizon line */
  for (let i = 0; i < 9; i++) {
    const lx = -88 + i * 22 + (i % 2 ? 6 : -4);
    const ly = 38 + (i % 3) * 9;
    const rr = 20 + (i % 3) * 8;
    const a = .11 - (i % 3) * .022;
    const mg = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr);
    mg.addColorStop(0, `rgba(58,64,59,${a})`);
    mg.addColorStop(.55, `rgba(58,64,59,${a * .5})`);
    mg.addColorStop(1, 'rgba(58,64,59,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(lx - rr, ly - rr, rr * 2, rr * 2);
  }

  /* osmanthus tree, left of the hall */
  ctx.save();
  ctx.strokeStyle = 'rgba(43,50,45,.42)';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(-58, 34);
  ctx.bezierCurveTo(-55, 22, -58, 9, -51, -8);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-55 + i * .8, 20 - i * 8);
    ctx.quadraticCurveTo(-64 - i * 3, 12 - i * 7, -70 - i * 3, 6 - i * 8);
    ctx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    const a = i * 2.4, rr = 8 + (i * 5.1 % 19);
    ctx.fillStyle = `rgba(47,55,48,${.10 + (i % 3) * .035})`;
    ctx.beginPath();
    ctx.ellipse(-62 + Math.cos(a) * rr, 2 + Math.sin(a) * rr * .55, 5.2, 2.1, a * .3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  function roof(w, h, y0, tint) {
    ctx.beginPath();
    ctx.moveTo(-w, y0);
    ctx.bezierCurveTo(-w * .74, y0 - h * .46, -w * .42, y0 - h * .86, 0, y0 - h);
    ctx.bezierCurveTo(w * .42, y0 - h * .86, w * .74, y0 - h * .46, w, y0);
    ctx.quadraticCurveTo(w * .68, y0 - h * .22, w * .48, y0 - h * .3);
    ctx.lineTo(-w * .48, y0 - h * .3);
    ctx.quadraticCurveTo(-w * .68, y0 - h * .22, -w, y0);
    ctx.closePath();
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.strokeStyle = pale;
    ctx.lineWidth = .7;
    ctx.stroke();
    /* upturned tips, one stroke each */
    ctx.beginPath();
    ctx.moveTo(-w, y0);
    ctx.quadraticCurveTo(-w * 1.10, y0 - h * .18, -w * 1.07, y0 - h * .38);
    ctx.moveTo(w, y0);
    ctx.quadraticCurveTo(w * 1.10, y0 - h * .18, w * 1.07, y0 - h * .38);
    ctx.strokeStyle = 'rgba(35,42,38,.55)';
    ctx.lineWidth = .9;
    ctx.stroke();
    /* ridge tiles */
    ctx.strokeStyle = 'rgba(240,236,216,.10)';
    ctx.lineWidth = .45;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * w * .2, y0 - h * .54);
      ctx.lineTo(i * w * .28, y0 - h * .08);
      ctx.stroke();
    }
  }

  /* ground storey */
  ctx.fillStyle = 'rgba(49,57,51,.36)';
  ctx.fillRect(-42, 4, 84, 26);
  ctx.strokeStyle = 'rgba(38,45,40,.62)';
  ctx.lineWidth = .9;
  for (const cx of [-36, -18, 0, 18, 36]) {
    ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx, 30); ctx.stroke();
  }
  /* warm bays */
  const warmWin = (wx, wy, ww, wh, a) => {
    const gr = ctx.createLinearGradient(0, wy, 0, wy + wh);
    gr.addColorStop(0, `rgba(250,221,160,${a * flick})`);
    gr.addColorStop(1, `rgba(205,155,88,${a * .45 * flick})`);
    ctx.fillStyle = gr;
    ctx.fillRect(wx, wy, ww, wh);
  };
  warmWin(-8, 12, 16, 14, .55);
  warmWin(-30, 14, 8, 9, .28);
  warmWin(22, 14, 8, 9, .28);
  ctx.strokeStyle = 'rgba(37,44,39,.7)';
  ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 19); ctx.lineTo(8, 19); ctx.stroke();

  /* lower roof */
  roof(50, 19, 4, deep);

  /* upper storey */
  ctx.fillStyle = 'rgba(46,54,48,.40)';
  ctx.fillRect(-20, -28, 40, 15);
  ctx.strokeStyle = 'rgba(38,45,40,.62)';
  for (const cx of [-17, 0, 17]) {
    ctx.beginPath(); ctx.moveTo(cx, -28); ctx.lineTo(cx, -13); ctx.stroke();
  }
  warmWin(-5, -25, 10, 8, .42);
  warmWin(-16, -24, 5, 6, .24);
  warmWin(11, -24, 5, 6, .24);

  /* upper roof and finial */
  roof(35, 18, -28, deep);
  ctx.strokeStyle = 'rgba(32,39,35,.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -46); ctx.lineTo(0, -58);
  ctx.moveTo(-3.6, -53); ctx.lineTo(3.6, -53);
  ctx.moveTo(-2.2, -56); ctx.lineTo(2.2, -56);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -60, 1.4, 0, TAU); ctx.fillStyle = deep; ctx.fill();

  /* lanterns under the lower eaves */
  for (const side of [-1, 1]) {
    const lx = side * 47, ly = 12;
    ctx.strokeStyle = 'rgba(39,45,40,.6)';
    ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(lx, 5); ctx.lineTo(lx, ly - 2); ctx.stroke();
    ctx.fillStyle = `rgba(183,73,48,${.7 * flick})`;
    ctx.beginPath(); ctx.ellipse(lx, ly + 1, 2, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(250,214,150,${.55 * flick})`;
    ctx.beginPath(); ctx.arc(lx, ly + 1, .7, 0, TAU); ctx.fill();
  }

  /* a low stone step, kept small and dark */
  ctx.fillStyle = 'rgba(35,42,38,.5)';
  ctx.fillRect(-24, 30, 48, 2.6);
  ctx.fillStyle = 'rgba(35,42,38,.32)';
  ctx.fillRect(-19, 33, 38, 2.2);

  ctx.restore();
}

function drawMoon(t, d) {
  const x = d.moonX, y = d.moonY, r = d.moonR;
  const warm = clamp(d.dawn * .6 + d.gold * .25);
  const diskTop = mixRGB([248, 244, 231], [250, 228, 191], warm);
  const diskEdge = mixRGB([211, 212, 202], [219, 197, 160], warm);
  const glowA = clamp(.28 + d.glow * .58 + Math.sin(t * .33 + .7) * .018);

  if (DBG.glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gs = r * 5.6;
    ctx.globalAlpha = glowA * .82;
    ctx.drawImage(GLOW, x - gs / 2, y - gs / 2, gs, gs);
    ctx.restore();
  }

  /* disk */
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();

  const disk = ctx.createRadialGradient(x - r * .34, y - r * .42, r * .08, x, y, r * 1.02);
  disk.addColorStop(0, rgba(mixRGB(diskTop, [255, 252, 240], .4), 1));
  disk.addColorStop(.7, rgba(diskTop, 1));
  disk.addColorStop(1, rgba(diskEdge, 1));
  ctx.fillStyle = disk;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  /* soft maria: broad, irregular ink pooling */
  if (DBG.maria) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const maria = [
    [-.34, -.02, .40, .33, .085], [.18, -.30, .23, .18, .05],
    [.30, .22, .25, .20, .055], [-.02, .34, .22, .15, .04],
    [.55, -.06, .14, .12, .045]
  ];
  for (let mi = 0; mi < maria.length; mi++) {
    const [mx, my, mrx, mry, ma] = maria[mi];
    ctx.save();
    ctx.translate(x + mx * r, y + my * r);
    const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, mrx * r);
    mg.addColorStop(0, `rgba(126,126,108,${ma})`);
    mg.addColorStop(.62, `rgba(128,128,111,${ma * .55})`);
    mg.addColorStop(1, 'rgba(130,130,115,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = k / 12 * TAU;
      const wob = 1 + Math.sin(a * 3 + mi * 2.1) * .11 + Math.cos(a * 5 + mi) * .05;
      const px = Math.cos(a) * mrx * r * wob;
      const py = Math.sin(a) * mry * r * wob;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  }
  if (DBG.craters) for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    ctx.save();
    ctx.translate(x + c.x * r, y + c.y * r);
    ctx.rotate(c.rot);
    ctx.fillStyle = `rgba(122,122,106,${c.a * 1.15})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.rx * r, c.ry * r, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,233,.13)';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.ellipse(-.6, -.7, c.rx * r, c.ry * r, 0, Math.PI * 1.05, Math.PI * 1.86);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  /* fine rice-paper grain on the disc */
  if (DBG.mgrain) {
  const mr = mulberry32(404);
  for (let i = 0; i < 260; i++) {
    const a = mr() * TAU, rad = Math.sqrt(mr()) * r;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    ctx.fillStyle = mr() < .55
      ? `rgba(160,158,136,${.010 + mr() * .018})`
      : `rgba(255,252,238,${.012 + mr() * .02})`;
    ctx.fillRect(px, py, .7 + mr() * 1.2, .7 + mr() * 1.2);
  }
  }

  /* limb darkening, so the disc sits in the night */
  if (DBG.limb) {
  const limb = ctx.createRadialGradient(x, y, r * .80, x, y, r * 1.005);
  limb.addColorStop(0, 'rgba(120,118,100,0)');
  limb.addColorStop(.72, 'rgba(130,124,104,.055)');
  limb.addColorStop(1, 'rgba(146,136,112,.17)');
  ctx.fillStyle = limb;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* a breath of warm light near the lower edge */
  if (DBG.lower) {
  const lower = ctx.createRadialGradient(x - r * .18, y + r * .58, r * .06, x - r * .18, y + r * .58, r * .92);
  lower.addColorStop(0, `rgba(244,225,190,${.10 + warm * .14})`);
  lower.addColorStop(.55, `rgba(241,220,184,${.055 + warm * .07})`);
  lower.addColorStop(1, 'rgba(239,214,172,0)');
  ctx.fillStyle = lower;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* paper tooth over the disc, so no gradient ring can band */
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = .42;
  ctx.fillStyle = getPaper(ctx);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  if (DBG.palace) drawPalace(x, y, r, d.palace, t);
  ctx.restore();

  /* crisp limb, then one soft breath of light — no drawn rings */
  ctx.save();
  ctx.strokeStyle = 'rgba(250,245,228,.42)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r - .4, 0, TAU); ctx.stroke();
  ctx.globalCompositeOperation = 'screen';
  const outer = ctx.createRadialGradient(x, y, r * .88, x, y, r * 1.65);
  outer.addColorStop(0, `rgba(236,227,199,${.16 + warm * .1})`);
  outer.addColorStop(.36, 'rgba(226,223,203,.055)');
  outer.addColorStop(1, 'rgba(210,215,200,0)');
  ctx.fillStyle = outer;
  ctx.fillRect(x - r * 1.7, y - r * 1.7, r * 3.4, r * 3.4);
  ctx.restore();
}

/* ---------------------------------------------- mountains & mist */

function drawMountainLayer(img, x = -290, y = 0) {
  ctx.drawImage(img, x, y);
}

function drawFogBand(t, d, tex, x, y, w, h, alpha, speed = 1) {
  const drift = (t * 7 * speed) % (w * .6);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.drawImage(tex, x + drift, y, w, h);
  ctx.drawImage(tex, x + drift - w * 1.02, y, w, h);
  ctx.restore();
}

function drawLandscape(t, d) {
  if (DBG.far2) drawMountainLayer(FAR2_MOUNT);
  if (DBG.far) drawMountainLayer(FAR_MOUNT);
  if (DBG.fog) {
    drawFogBand(t, d, FOG_B, -500, 455, 1880, 720, .5 * d.fog, .55);
    drawFogBand(t, d, FOG_A, 420, 520, 1620, 650, .36 * d.fog, .35);
  }

  if (DBG.mid) drawMountainLayer(MID_MOUNT);
  if (DBG.fog) {
    drawFogBand(t, d, FOG_A, -620, 630, 1980, 760, .58 * d.fog, .7);
    drawFogBand(t, d, FOG_B, 800, 690, 1500, 610, .4 * d.fog, .9);
  }

  if (DBG.near) drawMountainLayer(NEAR_MOUNT);
  if (DBG.fog) {
    drawFogBand(t, d, FOG_A, -260, 750, 1830, 640, .6 * d.fog, .8);
    drawFogBand(t, d, FOG_C, 460, 790, 1580, 540, (.16 + d.dawn * .1) * d.fog, .5);
    const mist = ctx.createLinearGradient(0, 780, 0, 1010);
    mist.addColorStop(0, 'rgba(154,177,178,0)');
    mist.addColorStop(.42, `rgba(152,176,174,${.16 * d.fog + d.glow * .025})`);
    mist.addColorStop(.72, `rgba(126,151,151,${.09 * d.fog})`);
    mist.addColorStop(1, 'rgba(90,110,112,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = mist;
    ctx.fillRect(0, 750, W, 350);
    ctx.restore();
  }

  if (d.veil > .01) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = d.veil * .75;
    const band = ctx.createLinearGradient(0, d.moonY - 80, 0, d.moonY + 160);
    band.addColorStop(0, 'rgba(8,13,18,0)');
    band.addColorStop(.45, 'rgba(10,16,21,.5)');
    band.addColorStop(1, 'rgba(6,10,14,0)');
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(-100, d.moonY + 20);
    ctx.bezierCurveTo(500, d.moonY - 130, 1200, d.moonY + 160, 2020, d.moonY + 20);
    ctx.lineTo(2020, d.moonY + 220);
    ctx.bezierCurveTo(1150, d.moonY + 380, 500, d.moonY + 90, -100, d.moonY + 250);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawLanterns(t, d) {
  if (!DBG.lanterns) return;
  const vis = smooth((t - 8) / 26) * (1 - smooth((t - 166) / 7)) * (.72 + .28 * clamp(d.gold));
  if (vis < .01) return;
  ctx.save();
  for (const p of LANTERNS) {
    const rise = (t * p.sp + p.ph * 120) % 820;
    const y = 840 - rise;
    if (y < 80 || y > 790) continue;
    const edge = smooth((y - 80) / 140) * smooth((820 - y) / 120);
    const a = clamp(p.a * edge * vis);
    if (a < .012) continue;
    const x = p.x + Math.sin(t * .17 + p.ph) * p.sway;
    const s = p.s;
    const sm = screenMoon(d);
    const lsx = (x - d.fx) * d.zoom + W / 2;
    const lsy = (y - d.fy) * d.zoom + H / 2;
    const avoid = smooth((Math.hypot(lsx - sm.x, lsy - sm.y) - sm.r * .95) / 60);
    if (avoid < .02) continue;
    const la = a * avoid;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = la * .48;
    ctx.drawImage(FIRE_GLOW, x - 20 * s, y - 20 * s, 40 * s, 40 * s);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = la;
    const bg = ctx.createLinearGradient(0, y - 8 * s, 0, y + 8 * s);
    bg.addColorStop(0, 'rgba(249,214,154,.95)');
    bg.addColorStop(.55, 'rgba(238,178,101,.92)');
    bg.addColorStop(1, 'rgba(206,128,66,.9)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x - 5.4 * s, y - 7.4 * s);
    ctx.quadraticCurveTo(x, y - 10 * s, x + 5.4 * s, y - 7.4 * s);
    ctx.lineTo(x + 5.8 * s, y + 7 * s);
    ctx.quadraticCurveTo(x, y + 9.8 * s, x - 5.8 * s, y + 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,33,21,.55)';
    ctx.lineWidth = .8;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,72,40,.4)';
    ctx.lineWidth = .5;
    ctx.beginPath(); ctx.moveTo(x, y - 8.6 * s); ctx.lineTo(x, y + 8.2 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3.3 * s, y - 8.2 * s); ctx.lineTo(x - 3.6 * s, y + 7.8 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3.3 * s, y - 8.2 * s); ctx.lineTo(x + 3.6 * s, y + 7.8 * s); ctx.stroke();
    ctx.fillStyle = `rgba(36,26,20,${Math.min(1, la * 1.25)})`;
    ctx.fillRect(x - 6.6 * s, y - 9.7 * s, 13.2 * s, 2.3 * s);
    ctx.fillRect(x - 5.2 * s, y + 7.2 * s, 10.4 * s, 1.6 * s);
    ctx.fillStyle = 'rgba(255,232,170,.75)';
    ctx.beginPath(); ctx.ellipse(x, y + 6.5 * s, 1.7 * s, 1.1 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(233,190,120,.5)';
    ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(x, y + 9 * s); ctx.lineTo(x, y + 13.5 * s); ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------- swash & enso */

function sampleRibbon(pts, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = cubicAt(pts, t);
    const p2 = cubicAt(pts, Math.min(1, t + .002));
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
    out.push({ x: p.x, y: p.y, ang, t });
  }
  return out;
}
function cubicAt(pts, t) {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return {
    x: a * pts[0].x + b * pts[1].x + c * pts[2].x + d * pts[3].x,
    y: a * pts[0].y + b * pts[1].y + c * pts[2].y + d * pts[3].y
  };
}

function drawBrushRibbon(pts, progress, width, color, alpha, seed, t) {
  if (progress <= 0 || alpha <= .002) return;
  const N = 520;
  const sampled = sampleRibbon(pts, N);
  const edgeL = [], edgeR = [];
  const count = Math.max(2, Math.floor(N * clamp(progress)));
  for (let i = 0; i <= count; i++) {
    const s = sampled[Math.min(i, sampled.length - 1)];
    const q = i / count;
    const profile = Math.pow(Math.sin(Math.PI * clamp(q * .98 + .01)), .52) * (1 - q * .18);
    const jitter = (noise1(q * 18 + seed, seed) - .5) * width * .32;
    const w = width * profile + jitter;
    const nx = Math.cos(s.ang + Math.PI / 2);
    const ny = Math.sin(s.ang + Math.PI / 2);
    edgeL.push({ x: s.x + nx * w * .5, y: s.y + ny * w * .5 });
    edgeR.push({ x: s.x - nx * w * .5, y: s.y - ny * w * .5 });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(edgeL[0].x, edgeL[0].y);
  for (let i = 1; i < edgeL.length; i++) ctx.lineTo(edgeL[i].x, edgeL[i].y);
  for (let i = edgeR.length - 1; i >= 0; i--) ctx.lineTo(edgeR[i].x, edgeR[i].y);
  ctx.closePath();
  ctx.fill();

  /* dry-brush streaks */
  ctx.globalAlpha = alpha * .5;
  for (let k = 0; k < 28; k++) {
    const q = clamp((k + .5) / 28);
    if (q > progress) break;
    const s = sampled[Math.floor(q * N)];
    const off = (noise1(k * 4.2 + seed, seed) - .5) * width * .72;
    const len = width * (.6 + noise1(k + seed, 2) * 1.2);
    const nx = Math.cos(s.ang + Math.PI / 2), ny = Math.sin(s.ang + Math.PI / 2);
    ctx.strokeStyle = rgba(color, alpha * (.12 + noise1(k, seed) * .3));
    ctx.lineWidth = .8 + noise1(k + 2, seed) * 1.8;
    ctx.beginPath();
    ctx.moveTo(s.x + nx * off, s.y + ny * off);
    ctx.lineTo(s.x + nx * off + Math.cos(s.ang) * len, s.y + ny * off + Math.sin(s.ang) * len);
    ctx.stroke();
  }
  ctx.restore();

  /* a few flying droplets at the leading edge */
  const lead = sampled[Math.min(count, sampled.length - 1)];
  for (let i = 0; i < 6; i++) {
    const a = lead.ang + (noise1(i * 8 + seed, t) - .5) * .8;
    const dist = width * (.4 + noise1(i + seed, 2) * 1.3);
    ctx.fillStyle = rgba(color, alpha * .5);
    ctx.beginPath();
    ctx.arc(lead.x + Math.cos(a) * dist, lead.y + Math.sin(a) * dist, .7 + noise1(i, seed) * 2, 0, TAU);
    ctx.fill();
  }
}

function envelopeAlpha(t, a, b, c, dtime) {
  if (t < a || t > dtime) return 0;
  if (t < b) return smooth((t - a) / Math.max(.001, b - a));
  if (t < c) return 1;
  return 1 - smooth((t - c) / Math.max(.001, dtime - c));
}

function drawSwash(t, d) {
  /* the night sky keeps clean; the wind lives in the mist and the flecks */
}

/* a hand-pulled enso, baked once */
const ENSO = (() => {
  const S = 512, cx = 256, cy = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = mulberry32(5511);
  const start = -2.62, sweep = TAU * .88;
  const steps = 44;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const radiusAt = (q) => 186 * (1 + Math.sin(q * 2.2 + .5) * .012 + Math.sin(q * 9.1) * .004);
  /* a stroke that lives: thin start, fat belly, hooked tail */
  const widthAt = (q) => {
    const base = .9 + 1.4 * Math.pow(Math.sin(Math.PI * Math.min(1, q * .98 + .012)), .9);
    const belly = 8.6 * Math.exp(-Math.pow((q - .38) / .24, 2));
    const tail = 3.4 * Math.exp(-Math.pow((q - .93) / .1, 2));
    return base + belly + tail;
  };
  const alphaAt = (q) => .1 + .30 * Math.pow(Math.sin(Math.PI * Math.min(1, q * .98 + .012)), .8) + .1 * Math.exp(-Math.pow((q - .38) / .3, 2));
  for (let i = 0; i < steps; i++) {
    const q0 = i / steps, q1 = (i + 1) / steps;
    const a0 = start + q0 * sweep, a1 = start + q1 * sweep;
    const r0 = radiusAt(q0), r1 = radiusAt(q1);
    g.strokeStyle = `rgba(224,199,148,${alphaAt(q0)})`;
    g.lineWidth = widthAt(q0);
    g.beginPath();
    g.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * .975);
    g.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * .975);
    g.stroke();
  }
  /* dry-brush streaks along the belly */
  for (let i = 0; i < 90; i++) {
    const q = .12 + .8 * r();
    const a = start + q * sweep;
    const rr = radiusAt(q);
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * .975;
    const tx = -Math.sin(a), ty = Math.cos(a);
    const len = 6 + r() * 22;
    const off = (r() - .5) * widthAt(q) * .9;
    const dry = r() < .45;
    g.strokeStyle = dry
      ? `rgba(2,10,14,${.16 + r() * .26})`
      : `rgba(250,242,222,${.05 + r() * .13})`;
    g.lineWidth = .6 + r() * 1.5;
    g.beginPath();
    g.moveTo(px + tx * len * .5 + off, py + ty * len * .5);
    g.lineTo(px - tx * len * .5 + off, py - ty * len * .5);
    g.stroke();
  }
  /* dry gaps bitten out of the stroke */
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    const q = .1 + .82 * r();
    const a = start + q * sweep;
    const rr = radiusAt(q);
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * .975;
    const rad = 3 + r() * 10;
    const bg = g.createRadialGradient(px, py, rad * .2, px, py, rad * 1.7);
    bg.addColorStop(0, 'rgba(0,0,0,.9)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath();
    g.arc(px, py, rad * 1.7, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  /* droplets flung at the tail */
  for (let i = 0; i < 7; i++) {
    const aa = start + sweep + (r() - .5) * .5;
    const dist = 8 + r() * 42;
    const px = cx + Math.cos(aa) * (radiusAt(.99) + dist);
    const py = cy + Math.sin(aa) * (radiusAt(.99) + dist) * .975;
    g.fillStyle = `rgba(230,210,166,${.1 + r() * .2})`;
    g.beginPath();
    g.arc(px, py, .8 + r() * 2.4, 0, TAU);
    g.fill();
  }
  return c;
})();

function drawEnso(t, d) {
  const a = envelopeAlpha(t, 86.9, 89.0, 119.0, 125.0);
  if (a < .01) return;
  const scale = (d.moonR + 42) / 186;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a * .82;
  ctx.translate(d.moonX, d.moonY);
  ctx.rotate(-.09);
  ctx.scale(scale, scale * .99);
  ctx.drawImage(ENSO, -256, -256);
  ctx.restore();
}

/* ---------------------------------------------- foreground, trail, hut, traveller */

function drawForeground(t, d) {
  ctx.drawImage(FOREGROUND, -290, 0);
}

const shoreY = (x) => 954 + Math.sin(x * .004 + 1.15) * 6 + Math.sin(x * .011 + .7) * 3;

function drawWater(t, d) {
  if (!DBG.water) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, shoreY(-20));
  for (let x = 0; x <= W + 20; x += 24) ctx.lineTo(x, shoreY(x));
  ctx.lineTo(W + 20, H + 20);
  ctx.lineTo(-20, H + 20);
  ctx.closePath();
  ctx.clip();

  const bath = ctx.createLinearGradient(0, 880, 0, H);
  bath.addColorStop(0, 'rgba(26,42,50,0)');
  bath.addColorStop(.09, 'rgba(17,32,41,.58)');
  bath.addColorStop(.44, 'rgba(9,20,27,.73)');
  bath.addColorStop(1, 'rgba(3,8,12,.9)');
  ctx.fillStyle = bath;
  ctx.fillRect(0, 880, W, H - 880);

  const sheen = ctx.createLinearGradient(0, 900, 0, H);
  sheen.addColorStop(0, 'rgba(130,160,168,.045)');
  sheen.addColorStop(.5, 'rgba(92,120,130,.062)');
  sheen.addColorStop(1, 'rgba(34,54,64,.025)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 880, W, H - 880);

  ctx.globalCompositeOperation = 'screen';
  const mx = d.moonX + Math.sin(t * .12) * 8;
  const glowField = ctx.createRadialGradient(mx, 990, 0, mx, 990, 190);
  glowField.addColorStop(0, `rgba(226,224,192,${.1 * clamp(d.glow)})`);
  glowField.addColorStop(.5, `rgba(206,208,182,${.028 * clamp(d.glow)})`);
  glowField.addColorStop(1, 'rgba(190,198,180,0)');
  ctx.fillStyle = glowField;
  ctx.fillRect(mx - 200, 900, 400, 200);

  for (let i = 0; i < 28; i++) {
    const yy = 932 + hash1(i * 2.3) * 138 + Math.sin(t * .45 + i) * 1.8;
    const x = -260 + ((t * (9 + hash1(i + 2) * 13) + hash1(i) * 2400) % 2400);
    const len = 55 + hash1(i + 5) * 280;
    const edge = smooth((x + 260) / 260) * smooth((W + 260 - x) / 260);
    const a = (.032 + hash1(i + 7) * .055) * edge;
    ctx.strokeStyle = `rgba(186,203,197,${a})`;
    ctx.lineWidth = .9 + hash1(i + 1) * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.quadraticCurveTo(x + len * .5, yy + 2.2, x + len, yy);
    ctx.stroke();
  }

  for (let i = 0; i < 4; i++) {
    const bx = ((t * (14 + i * 5) + i * 520) % (W + 700)) - 350;
    const by = 972 + i * 20 + Math.sin(t * .3 + i * 1.3) * 4;
    const wg = ctx.createLinearGradient(bx, 0, bx + 620, 0);
    wg.addColorStop(0, 'rgba(170,198,198,0)');
    wg.addColorStop(.45, `rgba(170,198,198,${.018 + i * .004})`);
    wg.addColorStop(.62, `rgba(190,211,208,${.012 + i * .003})`);
    wg.addColorStop(1, 'rgba(170,198,198,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(bx, by, 620, 3.6 + i * .8);
  }

  for (let i = 0; i < 18; i++) {
    const yy = 964 + i * 6.8;
    const w = 22 + i * 4.4 + Math.sin(t * .7 + i) * 5;
    const a = (.22 - i * .007) * clamp(d.glow) * (1 - i / 34);
    if (a <= 0) continue;
    const jx = Math.sin(t * .33 + i * 1.7) * 4;
    ctx.strokeStyle = `rgba(244,236,207,${a * .28})`;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(mx - w / 2 + jx, yy);
    ctx.quadraticCurveTo(mx + Math.sin(t * .4 + i) * 8, yy + 1.2, mx + w / 2 + jx, yy);
    ctx.stroke();
    ctx.strokeStyle = `rgba(249,243,219,${a})`;
    ctx.lineWidth = 1.6 + (i % 4 === 0 ? .8 : 0);
    ctx.beginPath();
    ctx.moveTo(mx - w / 2 + jx, yy);
    ctx.quadraticCurveTo(mx + Math.sin(t * .4 + i) * 8, yy + 1.2, mx + w / 2 + jx, yy);
    ctx.stroke();
  }

  for (let i = 0; i < 10; i++) {
    const yy = 960 + i * 7;
    const a = (.065 - i * .0045) * clamp(d.hut);
    if (a <= 0) continue;
    ctx.strokeStyle = `rgba(226,173,98,${a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(1460 + Math.sin(t * .4 + i) * 5, yy);
    ctx.lineTo(1524 + Math.sin(t * .32 + i) * 7, yy);
    ctx.stroke();
  }

  /* slow fish rings */
  const rings = [[930, 1002, 0, 9], [1320, 1038, 3.1, 11], [620, 1048, 6.2, 13]];
  for (const rg of rings) {
    const q = ((t + rg[2]) % rg[3]) / rg[3];
    const rad = 8 + q * 64;
    const a = .07 * (1 - q) * (1 - q);
    ctx.strokeStyle = `rgba(200,215,208,${a})`;
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.ellipse(rg[0], rg[1], rad, rad * .24, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, shoreY(-20));
  for (let x = 0; x <= W + 20; x += 24) ctx.lineTo(x, shoreY(x));
  ctx.strokeStyle = 'rgba(180,198,193,.11)';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.globalCompositeOperation = 'screen';
  const mist = ctx.createLinearGradient(0, 930, 0, 985);
  mist.addColorStop(0, 'rgba(142,166,167,0)');
  mist.addColorStop(.55, 'rgba(142,166,167,.06)');
  mist.addColorStop(1, 'rgba(142,166,167,0)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 926, W, 64);
  ctx.restore();

  drawBoat(t, d);
  drawWaterLights(t, d);
}

function drawWaterLights(t, d) {
  ctx.save();
  for (const p of WATER_LIGHTS) {
    const x = p.x + Math.sin(t * p.sp + p.ph) * p.drift;
    const y = 1013 + Math.sin(t * .37 + p.ph) * 2;
    const pulse = .72 + .28 * Math.sin(t * .43 + p.ph * 2);
    const a = p.a * pulse;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = a * .38;
    ctx.drawImage(FIRE_GLOW, x - 22 * p.s, y - 22 * p.s, 44 * p.s, 44 * p.s);
    ctx.globalAlpha = a * .16;
    ctx.drawImage(FIRE_GLOW, x - 22 * p.s, y + 6, 44 * p.s, 40 * p.s);
    ctx.globalAlpha = a * .12;
    ctx.strokeStyle = 'rgba(239,204,144,.8)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const yy = y + 12 + i * 6;
      ctx.beginPath();
      ctx.moveTo(x - 18 + i * 2 + Math.sin(t * .6 + i) * 2, yy);
      ctx.lineTo(x + 18 - i * 2 + Math.sin(t * .55 + i) * 2, yy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    for (let k = 0; k < 6; k++) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * TAU / 6 + Math.sin(t * .3 + p.ph) * .08);
      const pg = ctx.createLinearGradient(0, -9, 0, 0);
      pg.addColorStop(0, 'rgba(250,214,155,.85)');
      pg.addColorStop(1, 'rgba(214,135,73,.7)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(0, -5.2, 2.3, 5.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,238,186,.95)';
    ctx.beginPath(); ctx.arc(x, y - 1.5, 1.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(82,50,30,.5)';
    ctx.lineWidth = .6;
    ctx.beginPath(); ctx.ellipse(x, y, 6.5, 4, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawBoat(t, d) {
  if (!DBG.boat) return;
  const x = 790 + ((t * 4.2 + 260) % 2000) - 200 + Math.sin(t * .055 + 1.2) * 14;
  const y = 984 + Math.sin(t * .82) * 1.2;
  ctx.save();
  ctx.globalAlpha = .82;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = .1;
  ctx.drawImage(FIRE_GLOW, x + 12 - 34, y + 2, 68, 90);
  ctx.strokeStyle = 'rgba(170,190,185,.08)';
  ctx.lineWidth = .8;
  ctx.beginPath();
  ctx.moveTo(x - 30, y + 8); ctx.lineTo(x + 30, y + 8);
  ctx.moveTo(x - 22, y + 14); ctx.lineTo(x + 24, y + 14);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(188,204,198,.055)';
  ctx.lineWidth = .8;
  ctx.beginPath();
  ctx.moveTo(x - 36, y + 4);
  ctx.quadraticCurveTo(x - 70, y + 14, x - 110, y + 22);
  ctx.moveTo(x + 36, y + 4);
  ctx.quadraticCurveTo(x + 70, y + 14, x + 108, y + 20);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(3,6,8,.98)';
  ctx.beginPath();
  ctx.moveTo(x - 38, y - 3);
  ctx.quadraticCurveTo(x - 26, y + 9, x, y + 9);
  ctx.quadraticCurveTo(x + 26, y + 9, x + 38, y - 3);
  ctx.quadraticCurveTo(x + 24, y + 1, x, y + 1);
  ctx.quadraticCurveTo(x - 24, y + 1, x - 38, y - 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(178,197,189,.18)';
  ctx.lineWidth = .7;
  ctx.beginPath();
  ctx.moveTo(x - 37, y - 3);
  ctx.quadraticCurveTo(x - 22, y + 1, x, y + 1);
  ctx.quadraticCurveTo(x + 22, y + 1, x + 37, y - 3);
  ctx.stroke();

  ctx.fillStyle = 'rgba(4,7,9,.98)';
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 2);
  ctx.quadraticCurveTo(x - 12, y - 23, x + 4, y - 24);
  ctx.quadraticCurveTo(x + 22, y - 24, x + 25, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(164,186,178,.14)';
  ctx.lineWidth = .6;
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 2);
  ctx.quadraticCurveTo(x - 11, y - 22, x + 4, y - 23);
  ctx.quadraticCurveTo(x + 20, y - 23, x + 23, y - 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,130,94,.16)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 6 + i * 8, y - 5);
    ctx.quadraticCurveTo(x - 6 + i * 8, y - 15, x + 2 + i * 8, y - 19);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(3,6,8,.98)';
  ctx.beginPath();
  ctx.arc(x - 25, y - 20, 3.3, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 28, y - 17, 6.5, 17);
  ctx.strokeStyle = 'rgba(3,6,8,.95)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 10);
  ctx.lineTo(x - 55, y + 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(163,184,177,.16)';
  ctx.lineWidth = .55;
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 10);
  ctx.lineTo(x - 55, y + 18);
  ctx.stroke();

  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(FIRE_GLOW, x + 24 - 30, y - 20 - 30, 60, 60);
  ctx.globalCompositeOperation = 'source-over';
  const lg = ctx.createLinearGradient(0, y - 26, 0, y - 13);
  lg.addColorStop(0, 'rgba(250,216,158,.95)');
  lg.addColorStop(1, 'rgba(219,146,82,.9)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.ellipse(x + 24, y - 19, 4.2, 5.8, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,38,25,.5)';
  ctx.lineWidth = .5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,22,17,.7)';
  ctx.fillRect(x + 20.5, y - 26.5, 7, 1.4);
  ctx.strokeStyle = 'rgba(230,184,116,.5)';
  ctx.beginPath();
  ctx.moveTo(x + 24, y - 13);
  ctx.lineTo(x + 24, y - 9);
  ctx.stroke();

  ctx.restore();
}

function drawReeds(t, d) {
  if (!DBG.reeds) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const p of REEDS) {
    const sway = Math.sin(t * p.sp + p.ph) * (6 + p.h * .1) + Math.sin(t * p.sp * .37 + p.ph * 2) * 3.2;
    const tipX = p.x + p.lean * p.h + sway;
    const tipY = p.y - p.h;
    const midX = p.x + p.lean * p.h * .38 + sway * .35;
    const midY = p.y - p.h * .52;
    ctx.strokeStyle = `rgba(3,6,8,${p.a})`;
    ctx.lineWidth = p.w;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = `rgba(196,211,201,${p.a * .18})`;
    ctx.lineWidth = p.w * .34;
    ctx.beginPath();
    ctx.moveTo(p.x - .6, p.y);
    ctx.quadraticCurveTo(midX - 1, midY, tipX - .8, tipY + 4);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const ly = p.y - p.h * (.22 + k * .16);
      const lx = p.x + (k % 2 ? -1 : 1) * (9 + k * 7);
      ctx.strokeStyle = `rgba(3,6,8,${p.a * .82})`;
      ctx.lineWidth = p.w * .55;
      ctx.beginPath();
      ctx.moveTo(p.x + sway * .2, ly);
      ctx.quadraticCurveTo(lx + sway * .5, ly - 14, lx + (k % 2 ? -24 : 27) + sway, ly - 30 - k * 5);
      ctx.stroke();
    }
    if (p.seed) {
      ctx.fillStyle = `rgba(5,9,11,${p.a * .97})`;
      ctx.beginPath();
      ctx.ellipse(tipX, tipY - 5, 2.9, 9, Math.atan2(tipY - midY, tipX - midX) + Math.PI / 2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(190,198,177,${p.a * .16})`;
      ctx.lineWidth = .7;
      ctx.stroke();
    }
  }

  /* low grass on the bank */
  for (const p of GRASS) {
    const by = shoreY(p.x) + 1;
    const sway = Math.sin(t * p.sp + p.ph) * (2 + p.h * .16);
    for (let k = 0; k < 3; k++) {
      const bx = p.x + (k - 1) * 3.2;
      const hh = p.h * (.7 + k * .13);
      ctx.strokeStyle = `rgba(3,6,8,${p.a * (.7 + k * .12)})`;
      ctx.lineWidth = p.w * (.8 + k * .12);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + p.lean * hh * .4 + sway * .4, by - hh * .55, bx + p.lean * hh + sway, by - hh);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTrail(t, d) {
  const a = clamp(d.path);
  if (a < .02) return;
  const x0 = 250, x1 = 1720;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  /* soft bed of light beneath the trail */
  const bed = ctx.createLinearGradient(x0, 0, x1, 0);
  bed.addColorStop(0, 'rgba(200,169,107,0)');
  bed.addColorStop(.3, `rgba(200,169,107,${.022 * a})`);
  bed.addColorStop(.75, `rgba(214,190,141,${.04 * a})`);
  bed.addColorStop(1, 'rgba(200,169,107,0)');
  ctx.strokeStyle = bed;
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 8) {
    const y = ridgeYAt(x) + 11 + Math.sin(x * .012) * 3;
    if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  /* dotted trail */
  ctx.strokeStyle = `rgba(218,192,139,${.26 * a})`;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([2, 17]);
  ctx.lineDashOffset = -t * 9;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 8) {
    const y = ridgeYAt(x) + 11 + Math.sin(x * .012) * 3;
    if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  /* a few lanterns on the long road */
  if (a > .4) {
    const marks = [520, 980, 1380];
    for (let i = 0; i < marks.length; i++) {
      const x = marks[i], y = ridgeYAt(x) + 12;
      const flick = .55 + .45 * Math.sin(t * 1.6 + i * 1.7);
      const gl = ctx.createRadialGradient(x, y - 2, 0, x, y - 2, 11);
      gl.addColorStop(0, `rgba(244,204,133,${.25 * a * flick})`);
      gl.addColorStop(1, 'rgba(216,166,98,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 12, y - 14, 24, 24);
      ctx.fillStyle = `rgba(249,217,158,${.4 * a * flick})`;
      ctx.beginPath(); ctx.arc(x, y - 3, 1, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawHut(t, d) {
  if (d.hut < .012) return;
  const hx = 1490;
  const hy = ridgeYAt(hx) + 2;
  const a = clamp(d.hut);
  const flick = .82 + .18 * Math.sin(t * 2.1) * Math.sin(t * .37 + 2.2);

  ctx.save();
  ctx.globalAlpha = a;

  /* warm pool on the ground */
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const pool = ctx.createRadialGradient(hx + 4, hy - 34, 8, hx + 4, hy - 18, 190);
  pool.addColorStop(0, `rgba(228,172,102,${.11 * flick})`);
  pool.addColorStop(.45, `rgba(203,149,87,${.043 * flick})`);
  pool.addColorStop(1, 'rgba(180,135,80,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(hx - 210, hy - 190, 420, 220);
  ctx.restore();

  /* ground shadow */
  ctx.fillStyle = 'rgba(0,1,3,.58)';
  ctx.beginPath();
  ctx.ellipse(hx + 6, hy + 1, 158, 16, 0, 0, TAU);
  ctx.fill();

  /* smoke from the thatch */
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const sy = hy - 150 - i * 16;
    const sway = Math.sin(t * .36 + i * 1.4) * (8 + i * 5);
    ctx.strokeStyle = `rgba(156,174,172,${.05 - i * .011})`;
    ctx.lineWidth = 6 + i * 4;
    ctx.beginPath();
    ctx.moveTo(hx + 54, sy);
    ctx.bezierCurveTo(hx + 68 + sway, sy - 22, hx + 42 - sway, sy - 46, hx + 62 + sway * .6, sy - 70);
    ctx.stroke();
  }
  ctx.restore();

  /* stone plinth */
  const sr = mulberry32(808);
  for (let i = 0; i < 12; i++) {
    const px = hx - 92 + i * 16 + (sr() - .5) * 4;
    const pw = 12 + sr() * 10, ph = 4 + sr() * 4;
    ctx.fillStyle = `rgba(${26 + sr() * 12},${28 + sr() * 12},${28 + sr() * 10},.98)`;
    ctx.beginPath();
    ctx.ellipse(px, hy - 2 + (sr() - .5) * 2, pw * .5, ph * .5, (sr() - .5) * .2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,158,152,.08)';
    ctx.lineWidth = .6;
    ctx.stroke();
  }

  /* receding side wall */
  ctx.beginPath();
  ctx.moveTo(hx + 74, hy - 94);
  ctx.lineTo(hx + 124, hy - 86);
  ctx.lineTo(hx + 124, hy - 4);
  ctx.lineTo(hx + 74, hy - 1);
  ctx.closePath();
  const side = ctx.createLinearGradient(hx + 74, 0, hx + 124, 0);
  side.addColorStop(0, 'rgba(10,11,11,.99)');
  side.addColorStop(1, 'rgba(18,18,16,.98)');
  ctx.fillStyle = side;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,177,168,.1)';
  ctx.lineWidth = .8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + 84 + i * 10, hy - 90 + i * 2);
    ctx.lineTo(hx + 84 + i * 10, hy - 4 + i * 1);
    ctx.stroke();
  }

  /* front wall: weathered boards and plaster */
  const wall = ctx.createLinearGradient(0, hy - 100, 0, hy);
  wall.addColorStop(0, 'rgba(17,17,15,.99)');
  wall.addColorStop(.55, 'rgba(12,12,11,1)');
  wall.addColorStop(1, 'rgba(6,7,7,1)');
  ctx.fillStyle = wall;
  ctx.fillRect(hx - 78, hy - 98, 152, 96);

  /* plaster texture */
  const wr = mulberry32(616);
  for (let i = 0; i < 160; i++) {
    const px = hx - 76 + wr() * 148;
    const py = hy - 92 + wr() * 86;
    ctx.fillStyle = wr() < .5 ? `rgba(126,132,120,${.012 + wr() * .025})` : `rgba(0,0,0,${.02 + wr() * .04})`;
    ctx.fillRect(px, py, .8 + wr() * 2.2, .6 + wr() * 1.6);
  }

  /* timber frame */
  ctx.fillStyle = 'rgba(5,6,6,.99)';
  for (const px of [hx - 78, hx - 44, hx + 6, hx + 44, hx + 72]) {
    ctx.fillRect(px - 2, hy - 98, 4, 96);
  }
  ctx.fillRect(hx - 78, hy - 98, 152, 4);
  ctx.fillRect(hx - 78, hy - 44, 152, 3);
  ctx.strokeStyle = 'rgba(171,188,180,.1)';
  ctx.lineWidth = .7;
  ctx.strokeRect(hx - 78, hy - 98, 152, 96);

  /* door */
  ctx.fillStyle = 'rgba(4,5,5,.99)';
  ctx.fillRect(hx + 12, hy - 78, 30, 76);
  ctx.strokeStyle = 'rgba(150,126,86,.24)';
  ctx.lineWidth = .7;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + 12 + i * 10, hy - 77);
    ctx.lineTo(hx + 12 + i * 10, hy - 3);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(186,204,193,.15)';
  ctx.strokeRect(hx + 12.5, hy - 78.5, 29, 77);
  ctx.fillStyle = `rgba(233,183,109,${.5 * flick})`;
  ctx.fillRect(hx + 38, hy - 42, 1.4, 3.5);

  /* warm window with lattice */
  const wx = hx - 64, wy = hy - 74, ww = 44, wh = 33;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const wglow = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 2, wx + ww / 2, wy + wh / 2, 105);
  wglow.addColorStop(0, `rgba(246,199,124,${.28 * flick})`);
  wglow.addColorStop(.35, `rgba(231,173,96,${.11 * flick})`);
  wglow.addColorStop(1, 'rgba(207,146,77,0)');
  ctx.fillStyle = wglow;
  ctx.fillRect(wx - 90, wy - 90, ww + 180, wh + 180);
  ctx.restore();

  const winGrad = ctx.createLinearGradient(0, wy, 0, wy + wh);
  winGrad.addColorStop(0, `rgba(246,205,136,${.9 * flick})`);
  winGrad.addColorStop(.55, `rgba(229,174,99,${.8 * flick})`);
  winGrad.addColorStop(1, `rgba(202,142,76,${.62 * flick})`);
  ctx.fillStyle = winGrad;
  ctx.fillRect(wx, wy, ww, wh);

  /* scholar reading, smaller and softer */
  ctx.fillStyle = 'rgba(24,21,16,.92)';
  ctx.beginPath();
  ctx.arc(wx + 25, wy + 12, 4.6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(wx + 19, wy + 16);
  ctx.quadraticCurveTo(wx + 16, wy + 27, wx + 20, wy + 33);
  ctx.lineTo(wx + 38, wy + 33);
  ctx.quadraticCurveTo(wx + 37, wy + 20, wx + 30, wy + 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,24,17,.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wx + 14, wy + 26);
  ctx.quadraticCurveTo(wx + 27, wy + 22, wx + 41, wy + 26);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,224,158,${.85 * flick})`;
  ctx.beginPath(); ctx.arc(wx + 40, wy + 16, 1.5, 0, TAU); ctx.fill();

  /* lattice */
  ctx.strokeStyle = 'rgba(27,21,14,.95)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(wx + i * ww / 3, wy); ctx.lineTo(wx + i * ww / 3, wy + wh); ctx.stroke();
  }
  for (let i = 1; i < 2; i++) {
    ctx.beginPath(); ctx.moveTo(wx, wy + i * wh / 2); ctx.lineTo(wx + ww, wy + i * wh / 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(8,7,5,.98)';
  ctx.lineWidth = 3;
  ctx.strokeRect(wx, wy, ww, wh);

  /* firewood stack at the left wall */
  for (let i = 0; i < 7; i++) {
    const lx = hx - 118 + (i % 3) * 8, ly = hy - 8 - Math.floor(i / 3) * 8;
    ctx.strokeStyle = 'rgba(23,18,13,.98)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 24, ly - 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(186,153,102,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx + 2, ly - 2.4);
    ctx.lineTo(lx + 22, ly - 4);
    ctx.stroke();
  }

  /* thick thatched roof */
  function roofPath() {
    ctx.beginPath();
    ctx.moveTo(hx - 122, hy - 92);
    ctx.bezierCurveTo(hx - 116, hy - 116, hx - 91, hy - 138, hx - 48, hy - 148);
    ctx.quadraticCurveTo(hx - 4, hy - 157, hx + 36, hy - 151);
    ctx.bezierCurveTo(hx + 84, hy - 145, hx + 127, hy - 119, hx + 142, hy - 88);
    /* ragged lower lip */
    ctx.quadraticCurveTo(hx + 118, hy - 101, hx + 92, hy - 104);
    ctx.lineTo(hx + 66, hy - 102);
    ctx.lineTo(hx + 40, hy - 106);
    ctx.lineTo(hx + 8, hy - 103);
    ctx.lineTo(hx - 26, hy - 107);
    ctx.lineTo(hx - 60, hy - 103);
    ctx.quadraticCurveTo(hx - 94, hy - 102, hx - 122, hy - 92);
    ctx.closePath();
  }
  const roofGrad = ctx.createLinearGradient(0, hy - 157, 0, hy - 90);
  roofGrad.addColorStop(0, 'rgba(18,20,18,1)');
  roofGrad.addColorStop(.5, 'rgba(10,12,11,1)');
  roofGrad.addColorStop(1, 'rgba(5,7,7,1)');
  roofPath();
  ctx.fillStyle = roofGrad;
  ctx.fill();

  /* straw texture, clipped to the thatch */
  ctx.save();
  roofPath();
  ctx.clip();
  const th = mulberry32(727);
  for (let i = 0; i < 300; i++) {
    const tx = hx - 130 + th() * 280;
    const ty = hy - 152 + th() * 54;
    const len = 10 + th() * 34;
    ctx.strokeStyle = th() < .6
      ? `rgba(139,126,97,${.028 + th() * .055})`
      : `rgba(0,0,0,${.05 + th() * .07})`;
    ctx.lineWidth = .55 + th() * 1.1;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + 2, ty + len * .5, tx + 4, ty + len);
    ctx.stroke();
  }
  ctx.restore();

  /* ridge, finials, and a straw fringe along the lip */
  ctx.strokeStyle = 'rgba(168,184,173,.18)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hx - 46, hy - 149);
  ctx.quadraticCurveTo(hx - 2, hy - 156, hx + 38, hy - 150);
  ctx.stroke();
  ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(hx - 44, hy - 148);
  ctx.quadraticCurveTo(hx - 50, hy - 157, hx - 47, hy - 163);
  ctx.moveTo(hx + 36, hy - 149);
  ctx.quadraticCurveTo(hx + 41, hy - 157, hx + 39, hy - 162);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(128,140,126,.11)';
  ctx.lineWidth = .8;
  for (let i = 0; i < 26; i++) {
    const fx = hx - 116 + i * 10 + (th() - .5) * 4;
    ctx.beginPath();
    ctx.moveTo(fx, hy - 102);
    ctx.lineTo(fx + (th() - .5) * 3, hy - 98 + th() * 3);
    ctx.stroke();
  }

  /* eave lantern by the door */
  const lx = hx + 2, ly = hy - 86;
  ctx.strokeStyle = 'rgba(8,10,9,.9)';
  ctx.lineWidth = .8;
  ctx.beginPath();
  ctx.moveTo(lx, hy - 102);
  ctx.lineTo(lx, ly - 4);
  ctx.stroke();
  ctx.fillStyle = `rgba(205,97,63,${.85 * flick})`;
  ctx.beginPath(); ctx.ellipse(lx, ly, 3.8, 5.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(252,209,137,${.55 * flick})`;
  ctx.beginPath(); ctx.ellipse(lx, ly, 2.1, 3.4, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26);
  lg.addColorStop(0, `rgba(255,205,133,${.2 * flick})`);
  lg.addColorStop(1, 'rgba(238,170,102,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(lx - 28, ly - 28, 56, 56);
  ctx.restore();

  /* a small bird on the ridge */
  const bx = hx + 78, by = hy - 143;
  ctx.strokeStyle = 'rgba(6,9,11,.95)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(bx, by, 1.5, 0, TAU);
  ctx.moveTo(bx + 1.3, by);
  ctx.lineTo(bx + 4.4, by - .3);
  ctx.moveTo(bx - 1, by + 1);
  ctx.lineTo(bx - 2.6, by + 3);
  ctx.stroke();

  ctx.restore();
}

function drawFigure(t, d) {
  if (d.fig < .012) return;
  const x = d.figX;
  const ground = ridgeYAt(x) + 1;
  const dir = d.face >= 0 ? 1 : -1;
  const turn = .5 + .5 * Math.min(1, Math.abs(d.face));
  const walk = clamp(d.walk);
  const raise = clamp(d.raise);
  const phase = t * 4.35;
  const stride = Math.sin(phase);
  const s = 1.03;
  const bob = -Math.abs(Math.sin(phase)) * 1.9 * walk + Math.sin(t * .9) * .45;
  const wind = clamp(d.wind, 0, 1.6);

  ctx.save();
  ctx.globalAlpha = clamp(d.fig);

  /* shadow and lantern light on the rock */
  ctx.save();
  ctx.translate(x, ground);
  ctx.fillStyle = 'rgba(0,1,3,.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 5.2, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  const pool = ctx.createRadialGradient(16, -2, 0, 16, -2, 42);
  pool.addColorStop(0, 'rgba(236,181,105,.11)');
  pool.addColorStop(1, 'rgba(220,162,90,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(-30, -6, 96, 26);
  ctx.restore();

  ctx.translate(x, ground + bob);
  ctx.scale(dir * s * turn, s);

  /* warm lantern halo */
  const lx = 20, ly = -47;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, 39);
  halo.addColorStop(0, 'rgba(255,218,151,.32)');
  halo.addColorStop(.3, 'rgba(244,190,113,.12)');
  halo.addColorStop(1, 'rgba(224,165,90,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(lx - 42, ly - 42, 84, 84);
  ctx.restore();

  /* staff, behind the body */
  ctx.strokeStyle = 'rgba(5,8,11,.96)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(25, -83);
  ctx.quadraticCurveTo(21, -42, 27, 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(170,190,186,.16)';
  ctx.lineWidth = .7;
  ctx.beginPath();
  ctx.moveTo(26, -82);
  ctx.quadraticCurveTo(22, -42, 28, 0);
  ctx.stroke();

  /* trailing ribbon of the cap */
  ctx.strokeStyle = 'rgba(122,46,38,.82)';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-4, -88);
  ctx.bezierCurveTo(-16 - wind * 3, -86 + Math.sin(t * 1.5) * 2, -26 - wind * 8, -75, -38 - wind * 9, -72 + Math.sin(t * 1.9) * 3);
  ctx.stroke();

  /* feet */
  const step = stride * 4.2 * walk;
  ctx.fillStyle = '#03060a';
  ctx.beginPath();
  ctx.ellipse(-4 + step, -1, 4.6, 2.3, -.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6 - step, -1, 4.4, 2.2, .08, 0, TAU);
  ctx.fill();

  /* robe */
  const hem = 3 + wind * 4;
  ctx.beginPath();
  ctx.moveTo(-4, -78);
  ctx.bezierCurveTo(-13, -68, -17, -50, -19, -32);
  ctx.bezierCurveTo(-24 - hem, -20, -30 - hem, -11, -33 - hem, -5);
  ctx.quadraticCurveTo(-16, -1, 15, -2);
  ctx.bezierCurveTo(18, -16, 16, -35, 12, -52);
  ctx.bezierCurveTo(10, -66, 7, -76, 4, -78);
  ctx.closePath();
  ctx.fillStyle = '#03060a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(183,203,200,.19)';
  ctx.lineWidth = .9;
  ctx.stroke();

  /* robe folds */
  ctx.strokeStyle = 'rgba(88,104,104,.26)';
  ctx.lineWidth = .8;
  ctx.beginPath();
  ctx.moveTo(-8, -63); ctx.quadraticCurveTo(-12, -40, -18, -18);
  ctx.moveTo(4, -60); ctx.quadraticCurveTo(3, -36, 7, -12);
  ctx.moveTo(-1, -70); ctx.quadraticCurveTo(-3, -44, -4, -16);
  ctx.stroke();

  /* back sleeve, blown by wind */
  ctx.beginPath();
  ctx.moveTo(-3, -68);
  ctx.bezierCurveTo(-11 - wind * 2, -64, -23 - wind * 5, -57, -31 - wind * 7, -50);
  ctx.quadraticCurveTo(-25 - wind * 5, -44, -16 - wind * 2, -49);
  ctx.quadraticCurveTo(-10, -54, -1, -58);
  ctx.closePath();
  ctx.fillStyle = 'rgba(3,6,9,.98)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(182,200,197,.12)';
  ctx.stroke();

  /* red sash */
  ctx.strokeStyle = 'rgba(138,50,41,.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-13, -43);
  ctx.quadraticCurveTo(-1, -40, 10, -43);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(138,50,41,.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-16, -38);
  ctx.quadraticCurveTo(-23, -30 - wind * 2, -28 - wind * 3, -25 + Math.sin(t * 2) * 2);
  ctx.stroke();

  /* head, hair, cap */
  ctx.fillStyle = '#03060a';
  ctx.beginPath();
  ctx.arc(0, -84.5, 6.5, 0, TAU);
  ctx.fill();
  /* nose, facing forward */
  ctx.beginPath();
  ctx.moveTo(5.1, -86.4);
  ctx.quadraticCurveTo(8.2, -84.7, 5.5, -82.4);
  ctx.closePath();
  ctx.fill();
  /* topknot */
  ctx.beginPath();
  ctx.arc(-2.5, -92, 3.3, 0, TAU);
  ctx.fill();
  /* soft cap */
  ctx.beginPath();
  ctx.ellipse(-.4, -91.2, 7.1, 2.3, -.1, Math.PI, TAU);
  ctx.fill();
  /* neck */
  ctx.fillRect(-1.8, -80, 4, 5);
  /* collar */
  ctx.strokeStyle = 'rgba(205,206,187,.38)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -77);
  ctx.lineTo(-1, -72.5);
  ctx.lineTo(3, -77);
  ctx.stroke();

  /* front arm: lowered or raised with the brush */
  const handY = lerp(-57, -94, smooth(raise));
  const handX = lerp(13, 17, smooth(raise));
  ctx.strokeStyle = '#03060a';
  ctx.lineWidth = 6.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, -68);
  ctx.quadraticCurveTo(12, lerp(-64, -80, raise), handX, handY);
  ctx.stroke();
  /* wide sleeve at the wrist */
  ctx.beginPath();
  ctx.moveTo(handX - 2, handY + 2);
  ctx.quadraticCurveTo(handX + 4, handY + 8 + wind * 2, handX + 9 + wind * 2, handY + 2);
  ctx.quadraticCurveTo(handX + 5, handY - 1, handX - 2, handY - 1);
  ctx.closePath();
  ctx.fillStyle = '#03060a';
  ctx.fill();

  /* brush when the arm is raised: small, dry, no torch glow */
  if (raise > .04) {
    const bx = handX + 3.2, by = handY - 16;
    ctx.save();
    ctx.globalAlpha *= raise;
    /* handle */
    ctx.strokeStyle = 'rgba(8,11,13,.98)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.quadraticCurveTo(handX + 1.4, handY - 8, bx, by);
    ctx.stroke();
    /* ferrule */
    ctx.strokeStyle = 'rgba(186,176,148,.55)';
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(bx - .6, by);
    ctx.lineTo(bx + 2.4, by - 3.2);
    ctx.stroke();
    /* bristles: a pale wet tuft tapering to a point */
    ctx.beginPath();
    ctx.moveTo(bx + 1.6, by - 2.2);
    ctx.quadraticCurveTo(bx + 3.4, by - 6.2, bx + 4.2, by - 8.8);
    ctx.quadraticCurveTo(bx + 6.2, by - 5.6, bx + 4.6, by - 2.6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(220,211,185,.85)';
    ctx.fill();
    /* a breath of pale ink at the very tip */
    ctx.fillStyle = 'rgba(247,240,218,.9)';
    ctx.beginPath();
    ctx.arc(bx + 4.2, by - 8.8, 1.05, 0, TAU);
    ctx.fill();
    /* a single dry thread caught by the wind */
    ctx.strokeStyle = 'rgba(214,208,188,.16)';
    ctx.lineWidth = .55;
    ctx.beginPath();
    ctx.moveTo(bx + 4.4, by - 8.8);
    ctx.quadraticCurveTo(bx + 9 + wind * 2, by - 9.2, bx + 13 + wind * 3, by - 6.4);
    ctx.stroke();
    ctx.restore();
  }

  /* lantern */
  ctx.strokeStyle = 'rgba(5,8,11,.95)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(24, -59);
  ctx.lineTo(lx, -54);
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,171,92,.94)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(lx - 4.4, ly - 4, 8.8, 10.8, 2.4) : ctx.rect(lx - 4.4, ly - 4, 8.8, 10.8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(55,38,20,.9)';
  ctx.lineWidth = .9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(89,57,27,.9)';
  ctx.beginPath();
  ctx.moveTo(lx - 4.4, ly + .8); ctx.lineTo(lx + 4.4, ly + .8);
  ctx.moveTo(lx, ly - 4); ctx.lineTo(lx, ly + 6.8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(141,54,38,.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx, ly + 7);
  ctx.quadraticCurveTo(lx - 1, ly + 10, lx - 2.4, ly + 12);
  ctx.stroke();

  /* rim light along the moonward silhouette */
  ctx.strokeStyle = 'rgba(190,211,208,.28)';
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(1, -78.5);
  ctx.quadraticCurveTo(10, -68, 11.5, -54);
  ctx.quadraticCurveTo(15, -33, 14, -4);
  ctx.stroke();

  /* a breath of warm light from the lantern */
  ctx.strokeStyle = 'rgba(238,193,121,.24)';
  ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(6, -72);
  ctx.quadraticCurveTo(13, -55, 14, -42);
  ctx.stroke();

  ctx.restore();
}

/* ---------------------------------------------- plum, cranes, wind, particles */

function drawBlossom(x, y, s, red, rot, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  const petal = red ? [163, 71, 57] : [238, 232, 214];
  const petalDeep = red ? [132, 49, 40] : [214, 206, 185];
  const edge = red ? 'rgba(226,151,131,.25)' : 'rgba(255,250,235,.45)';

  /* five round, faintly notched petals */
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate(i * TAU / 5 + .14);
    const ps = .9 + hash1(i + x * .13) * .18;
    ctx.scale(ps, ps);
    ctx.beginPath();
    ctx.moveTo(0, -1.1);
    ctx.bezierCurveTo(-3.5, -2.4, -4.9, -6.5, -2.5, -8.4);
    ctx.quadraticCurveTo(-.8, -9.2, 0, -7.8);
    ctx.quadraticCurveTo(.8, -9.2, 2.5, -8.4);
    ctx.bezierCurveTo(4.9, -6.5, 3.5, -2.4, 0, -1.1);
    const pg = ctx.createLinearGradient(0, -9, 0, 0);
    pg.addColorStop(0, rgba(petal, i === 4 ? .72 : .9));
    pg.addColorStop(1, rgba(petalDeep, .92));
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = .45;
    ctx.stroke();
    ctx.restore();
  }

  /* calyx */
  ctx.fillStyle = red ? 'rgba(91,40,32,.9)' : 'rgba(103,55,42,.78)';
  ctx.beginPath();
  ctx.ellipse(0, 1.1, 2.1, 1.2, 0, 0, TAU);
  ctx.fill();

  /* heart and stamens */
  ctx.fillStyle = 'rgba(206,173,110,.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 1.25, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = red ? 'rgba(94,47,32,.8)' : 'rgba(120,94,48,.78)';
  ctx.lineWidth = .38;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + .35;
    const r1 = 4.2 + hash1(i + x) * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * r1 * .5, Math.sin(a) * r1 * .5, Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(226,195,132,.9)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r1, Math.sin(a) * r1, .46, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBud(x, y, s, red, rot, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  const petal = red ? [156, 66, 52] : [229, 222, 203];
  ctx.fillStyle = 'rgba(93,48,37,.9)';
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 1.8, 1, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i - 1) * .34);
    ctx.beginPath();
    ctx.moveTo(0, 1.4);
    ctx.bezierCurveTo(-2.3, -1.2, -1.6, -4.3, 0, -5.2);
    ctx.bezierCurveTo(1.6, -4.3, 2.3, -1.2, 0, 1.4);
    ctx.fillStyle = rgba(petal, .88);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,230,.32)';
    ctx.lineWidth = .35;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawPlum(t, d) {
  const bloom = clamp(d.plum);
  if (bloom < .01) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(1960, 330);
  ctx.rotate(Math.sin(t * .27 + .4) * .011 + Math.sin(t * .105 + 1.3) * .005);
  ctx.translate(-1960, -330);

  /* tapered ink limbs, with dry bark and a stolen rim of moonlight */
  for (const s of PLUM.segs) {
    const N = 10;
    const L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const q = i / N;
      const mt = 1 - q;
      const px = mt * mt * s.x1 + 2 * mt * q * s.mx + q * q * s.x2;
      const py = mt * mt * s.y1 + 2 * mt * q * s.my + q * q * s.y2;
      const q2 = Math.min(1, q + .02);
      const m2 = 1 - q2;
      const tx = m2 * m2 * s.x1 + 2 * m2 * q2 * s.mx + q2 * q2 * s.x2;
      const ty = m2 * m2 * s.y1 + 2 * m2 * q2 * s.my + q2 * q2 * s.y2;
      const ang = Math.atan2(ty - py, tx - px);
      const w = lerp(s.w1, s.w2, q) * .5;
      const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
      L.push([px + nx * w, py + ny * w]);
      R.push([px - nx * w, py - ny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(3,6,9,.98)';
    ctx.fill();
    /* moonlit edge on the upper side */
    ctx.save();
    ctx.translate(-.9, -1.1);
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    ctx.strokeStyle = 'rgba(198,214,207,.16)';
    ctx.lineWidth = .55;
    ctx.stroke();
    ctx.restore();
    /* bark cracks on the heavy limbs */
    if (s.w1 > 5) {
      ctx.strokeStyle = 'rgba(104,124,120,.2)';
      ctx.lineWidth = .7;
      for (let k = 0; k < 3; k++) {
        const q = .25 + k * .3;
        const p = { x: (1-q)*(1-q)*s.x1 + 2*(1-q)*q*s.mx + q*q*s.x2,
                    y: (1-q)*(1-q)*s.y1 + 2*(1-q)*q*s.my + q*q*s.y2 };
        ctx.beginPath();
        ctx.moveTo(p.x + 1, p.y + 1);
        ctx.quadraticCurveTo(p.x + 8, p.y + 5, p.x + 22 + k * 8, p.y + 3);
        ctx.stroke();
      }
    }
  }

  /* small stems and red calyxes behind the flowers */
  for (const b of PLUM.blossoms) {
    if (bloom < .05) break;
    const local = clamp((bloom - b.delay * .55) / .48);
    if (local <= .01) continue;
    ctx.strokeStyle = 'rgba(48,37,30,.6)';
    ctx.lineWidth = .48;
    ctx.beginPath();
    ctx.moveTo(b.sx, b.sy);
    ctx.quadraticCurveTo((b.sx + b.x) / 2 + 3, (b.sy + b.y) / 2 - 2, b.x, b.y);
    ctx.stroke();
  }

  /* blossoms open with the song */
  for (const b of PLUM.blossoms) {
    const local = clamp((bloom - b.delay * .55) / .48);
    if (local <= .01) continue;
    const sc = b.s * easeOut(local);
    const al = Math.min(1, local * 1.8);
    drawBlossom(b.x, b.y, sc, b.red, b.rot + Math.sin(t * .22 + b.delay * 8) * .03, al * .96);
  }
  for (const b of PLUM.buds) {
    const local = clamp((bloom - b.delay * .55) / .42);
    if (local <= .01) continue;
    const sc = b.s * easeOut(local);
    drawBud(b.x, b.y, sc, b.red, b.rot, Math.min(1, local * 1.8) * .92);
  }
  ctx.restore();

  /* petals that leave the branch */
  const pa = clamp(d.petal);
  if (pa > .015) {
    ctx.save();
    for (let i = 0; i < PETALS.length; i++) {
      const p = PETALS[i];
      const pr = (t * (.018 + p.sp * .0007) + i * .137) % 1;
      const y = -90 + pr * (H + 180);
      const x = p.x + Math.sin(t * .42 + p.ph) * p.sway - pr * 260;
      const edge = smooth((x + 40) / 90) * smooth((W + 40 - x) / 90);
      if (edge < .01) continue;
      const a = p.a * pa * Math.sin(Math.PI * pr) * 1.9 * edge;
      if (a < .015) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + t * p.vr);
      ctx.globalAlpha = clamp(a);
      ctx.fillStyle = p.red ? 'rgba(146,60,48,.78)' : 'rgba(215,208,189,.62)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.45 * p.s, 3.1 * p.s, .35, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  const nearA = .28 + .72 * clamp(d.petal);
  ctx.save();
  for (let i = 0; i < NEAR_PETALS.length; i++) {
    const p = NEAR_PETALS[i];
    const pr = ((t * (.011 + p.sp * .00025) + i * .073) % 1);
    const y = -110 + pr * (H + 220);
    const x = p.x + Math.sin(t * .3 + p.ph) * p.sway - pr * 320;
    const edge = smooth((x + 50) / 120) * smooth((W + 50 - x) / 120);
    if (edge < .01) continue;
    const a = p.a * nearA * Math.sin(Math.PI * pr) * 1.2 * edge;
    if (a < .02) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot + t * p.vr);
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = p.red ? 'rgba(150,62,50,.8)' : 'rgba(228,221,202,.7)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.5 * p.s, 3.4 * p.s, .35, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawCrane(x, y, s, flap, alpha, i) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.06 + Math.sin(flap * 2 + i) * .015);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  const ink = 'rgba(3,7,10,.95)';
  const ink2 = 'rgba(4,9,12,.8)';
  const rim = 'rgba(210,222,214,.3)';
  const up = flap * 4.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  /* long trailing legs, the signature of a crane */
  ctx.strokeStyle = ink2;
  ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(-2, 1);
  ctx.quadraticCurveTo(-11, 5.5, -20, 9 + Math.sin(flap + i) * 1.1);
  ctx.lineTo(-26, 12);
  ctx.moveTo(-1, 1.4);
  ctx.quadraticCurveTo(-8, 8, -14, 12);
  ctx.lineTo(-17, 17);
  ctx.stroke();
  /* feet */
  ctx.lineWidth = .55;
  ctx.beginPath();
  ctx.moveTo(-26, 12); ctx.lineTo(-29, 10.4);
  ctx.moveTo(-17, 17); ctx.lineTo(-19, 19);
  ctx.stroke();

  /* far wing: a narrow blade behind the body */
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.bezierCurveTo(-4, -9 - up * .55, -11, -15 - up * .85, -22, -18 - up);
  ctx.bezierCurveTo(-19, -10 - up * .5, -11, -1.5, -1, 1.6);
  ctx.closePath();
  ctx.fillStyle = ink2;
  ctx.fill();

  /* near wing: broad, arched, with fingered primaries */
  ctx.beginPath();
  ctx.moveTo(2.2, -1.4);
  ctx.bezierCurveTo(-1, -10 - up, -10, -18.5 - up, -27, -21 - up);
  ctx.bezierCurveTo(-24, -15 - up * .78, -20, -10 - up * .5, -16, -7.5 - up * .35);
  /* torn trailing edge */
  ctx.lineTo(-13.5, -3.6 - up * .2);
  ctx.lineTo(-10.4, -7.4 - up * .28);
  ctx.lineTo(-8.2, -2.6);
  ctx.lineTo(-4.4, -5.1);
  ctx.lineTo(-2.4, -.6);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  /* moonlit leading edge */
  ctx.strokeStyle = rim;
  ctx.lineWidth = .55;
  ctx.beginPath();
  ctx.moveTo(2.2, -1.4);
  ctx.bezierCurveTo(-1, -10 - up, -10, -18.5 - up, -27, -21 - up);
  ctx.stroke();
  /* primary feather tips */
  ctx.strokeStyle = ink;
  ctx.lineWidth = .7;
  for (let k = 0; k < 4; k++) {
    const f = .12 + k * .13;
    ctx.beginPath();
    ctx.moveTo(-27 + f * 22, -21 - up + f * 15);
    ctx.lineTo(-31 + f * 21, -18.2 - up + f * 10);
    ctx.stroke();
  }

  /* body */
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.1, 2.5, -.08, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  /* tail fan */
  ctx.beginPath();
  ctx.moveTo(-4.5, -.4);
  ctx.lineTo(-9.5, -2.2);
  ctx.lineTo(-9, 1.4);
  ctx.lineTo(-5, 2.2);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();

  /* long S-neck and head */
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.55;
  ctx.beginPath();
  ctx.moveTo(4.8, -1.2);
  ctx.bezierCurveTo(9.5, -3.2, 12, -8.6, 15.4, -13.2);
  ctx.quadraticCurveTo(17.8, -16.2, 20.2, -15.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(20.4, -15.8, 1.25, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  /* beak */
  ctx.strokeStyle = 'rgba(9,13,16,.9)';
  ctx.lineWidth = .72;
  ctx.beginPath();
  ctx.moveTo(21.4, -16);
  ctx.lineTo(26.6, -15.1);
  ctx.stroke();
  /* red crown */
  ctx.fillStyle = 'rgba(158,58,43,.78)';
  ctx.beginPath();
  ctx.arc(20.5, -17.05, .72, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawCranes(t, d) {
  const a = clamp(d.crane);
  if (a < .012) return;
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const speed = 10.5 + (i % 3) * 2.4;
    const x = ((t * speed + i * 337 + 760) % 2700) - 320;
    let y = 300 + (i * 43 % 170) + Math.sin(t * .27 + i * 1.7) * 9;
    if (t > 50) y -= smooth((t - 50) / 17) * 12;
    if (t > 117) y -= smooth((t - 117) / 17) * 74;
    const s = .62 + (i % 4) * .14;
    const flap = Math.sin(t * 2.4 + i * 1.1);
    const edge = smooth((x + 80) / 160) * smooth((W + 80 - x) / 160);
    if (edge < .01) continue;
    drawCrane(x, y, s, flap, a * (.55 + (i % 3) * .18) * edge, i);
  }
  /* faraway birds: only a breath of ink */
  for (let i = 0; i < 5; i++) {
    const x = 460 + ((i * 257 + t * 4.5) % 1150);
    const y = 255 + (i * 47) % 150;
    const edge = smooth(x / 90) * smooth((W - x) / 90);
    if (edge < .01) continue;
    ctx.strokeStyle = `rgba(7,11,14,${.32 * a * edge})`;
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(x - 3.4, y);
    ctx.quadraticCurveTo(x - 1.6, y - 1.9, x, y);
    ctx.quadraticCurveTo(x + 1.6, y - 1.9, x + 3.4, y);
    ctx.stroke();
  }
  ctx.restore();
}

const FLOCKS = [
  { t0: 7.5, dur: 19, y: 232, dir: -1, n: 7, size: 1.1 },
  { t0: 20, dur: 18, y: 304, dir: 1, n: 5, size: 1.2 },
  { t0: 31, dur: 18, y: 286, dir: 1, n: 5, size: 1.1 },
  { t0: 42, dur: 18, y: 268, dir: -1, n: 7, size: 1.45 },
  { t0: 54, dur: 18, y: 244, dir: -1, n: 6, size: 1.25 },
  { t0: 65, dur: 22, y: 300, dir: 1, n: 6, size: 1.1 },
  { t0: 78, dur: 18, y: 252, dir: -1, n: 5, size: 1.2 },
  { t0: 89, dur: 18, y: 232, dir: -1, n: 6, size: 1.3 },
  { t0: 103, dur: 18, y: 294, dir: 1, n: 5, size: 1.15 },
  { t0: 111, dur: 21, y: 258, dir: -1, n: 5, size: 1.3 },
  { t0: 132, dur: 20, y: 302, dir: 1, n: 5, size: 1.2 },
  { t0: 148, dur: 19, y: 238, dir: -1, n: 8, size: 1.75 },
  { t0: 160, dur: 17, y: 300, dir: 1, n: 5, size: 1.3 }
];

function drawGeese(t, d) {
  if (!DBG.geese) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const f of FLOCKS) {
    const p = (t - f.t0) / f.dur;
    if (p < 0 || p > 1) continue;
    const fade = Math.sin(Math.PI * p) * .62;
    const span = 2500;
    const cx = f.dir < 0 ? 2200 - p * span : -280 + p * span;
    for (let i = 0; i < f.n; i++) {
      const back = i * 14;
      const side = i === 0 ? 0 : ((i % 2) ? 1 : -1) * Math.ceil(i / 2) * 11;
      const bx = cx + f.dir * back;
      const by = f.y + side + Math.sin(t * .6 + i) * 2;
      if (bx < -60 || bx > W + 60) continue;
      const sc = f.size || 1;
      const flap = Math.sin(t * 5.2 + i * 1.7 + f.t0) * 5.5 * sc;
      ctx.strokeStyle = `rgba(8,12,15,${.62 * fade})`;
      ctx.lineWidth = 1.4 * sc;
      ctx.beginPath();
      ctx.moveTo(bx - 7 * sc, by + flap * .8);
      ctx.quadraticCurveTo(bx - 3 * sc, by - 1.2 * sc, bx, by);
      ctx.quadraticCurveTo(bx + 3 * sc, by - 1.2 * sc, bx + 7 * sc, by + flap * .8);
      ctx.stroke();
      ctx.fillStyle = `rgba(8,12,15,${.55 * fade})`;
      ctx.beginPath(); ctx.ellipse(bx, by, 2.2 * sc, 1.05 * sc, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawWind(t, d) {
  const a = clamp(d.wind);
  if (a < .035) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 8; i++) {
    const yy = 250 + hash1(i * 3.7) * 500 + Math.sin(t * .3 + i) * 14;
    const len = 110 + hash1(i + 2.1) * 240;
    const speed = 70 + hash1(i * 1.9) * 90;
    const x = ((t * speed + i * 421 + 900) % 2800) - 400;
    ctx.strokeStyle = `rgba(204,215,206,${(.018 + hash1(i + 7) * .03) * a})`;
    ctx.lineWidth = .5 + hash1(i + 4) * .9;
    ctx.setLineDash([len * .3, len * .9]);
    ctx.lineDashOffset = -t * 28 - i * 70;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.bezierCurveTo(x + len * .3, yy - 12, x + len * .7, yy + 16, x + len, yy - 4);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* flecks caught in the gale */
  for (let i = 0; i < 26; i++) {
    const speed = 160 + hash1(i + 3) * 280;
    const x = ((t * speed + i * 149 + 400) % 2500) - 300;
    const y = 350 + hash1(i * 8) * 460 + Math.sin(t * 1.2 + i) * 22;
    ctx.fillStyle = `rgba(207,204,182,${(.06 + hash1(i + 9) * .16) * a})`;
    ctx.fillRect(x, y, 8 + hash1(i) * 22, .8);
  }
  ctx.restore();
}

function drawParticles(t, d) {
  /* snow / cold ash */
  const snowA = clamp(d.snow);
  if (snowA > .01) {
    ctx.save();
    for (let i = 0; i < SNOW.length; i++) {
      const p = SNOW[i];
      const y = ((p.y + t * p.sp) % (H + 80)) - 40;
      const x = p.x + Math.sin(t * .38 + p.ph) * p.sway;
      const edge = smooth((y + 40) / 70) * smooth((H + 40 - y) / 90);
      ctx.fillStyle = `rgba(218,226,219,${p.a * snowA * .34 * edge})`;
      ctx.beginPath(); ctx.arc(x, y, p.r * .8, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* warm floating motes */
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < MOTES.length; i++) {
    const p = MOTES[i];
    const y = 230 + ((p.y - t * p.sp + 800) % 800);
    const x = p.x + Math.sin(t * .22 + p.ph) * p.drift;
    const edge = smooth((y - 230) / 50) * smooth((1040 - y) / 70);
    const tw = .55 + .45 * Math.sin(t * .9 + p.ph);
    const a = p.a * tw * (.4 + d.glow * .45) * edge;
    const warm = d.gold > .35;
    ctx.fillStyle = warm ? `rgba(228,196,135,${a * .7})` : `rgba(205,217,207,${a * .5})`;
    ctx.beginPath(); ctx.arc(x, y, p.r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  /* rising embers */
  const em = clamp(d.ember);
  if (em > .02) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < EMBERS.length; i++) {
      const p = EMBERS[i];
      const y = 520 + ((p.y - t * p.sp + 620) % 620) - 60;
      const x = p.x + Math.sin(t * .3 + p.ph) * p.drift - (520 - y) * .04;
      const edge = smooth((y - 460) / 60) * smooth((1080 - y) / 70);
      const tw = .5 + .5 * Math.sin(t * 1.3 + p.ph);
      ctx.fillStyle = `rgba(238,199,128,${p.a * em * tw * .8 * edge})`;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, TAU); ctx.fill();
      if (i % 5 === 0) {
        ctx.fillStyle = `rgba(244,211,151,${p.a * em * tw * .15 * edge})`;
        ctx.beginPath(); ctx.arc(x, y, p.r * 5, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* fireflies wandering near the ground */
  if (DBG.fireflies) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of FIREFLIES) {
      const x = p.x + Math.sin(t * p.sp + p.ph) * p.ax + Math.sin(t * .13 + p.ph) * p.ax * .35;
      const y = p.y + Math.cos(t * p.sp * .82 + p.ph * 1.3) * p.ay;
      const pulse = .35 + .65 * Math.pow(.5 + .5 * Math.sin(t * .42 + p.ph * 2), 2);
      const a = p.a * pulse;
      ctx.globalAlpha = a * .7;
      ctx.drawImage(FIRE_GLOW, x - 11 * p.s, y - 11 * p.s, 22 * p.s, 22 * p.s);
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = 'rgba(255,230,168,.9)';
      ctx.beginPath(); ctx.arc(x, y, .9 * p.s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* bursts from the music */
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const b of bursts) {
    const f = 1 - b.age / b.life;
    if (f <= 0) continue;
    ctx.globalAlpha = f * .34;
    ctx.fillStyle = b.color === 'gold' ? 'rgba(235,199,129,.9)' : 'rgba(222,225,211,.75)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (1 + (1 - f) * .6), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = f * .11;
    ctx.strokeStyle = b.color === 'gold' ? 'rgba(236,203,142,.8)' : 'rgba(220,228,217,.7)';
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * .05, b.y - b.vy * .05);
    ctx.stroke();
  }
  ctx.restore();
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    if (b.age >= b.life) { bursts.splice(i, 1); continue; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += 34 * dt;
    b.vx *= (1 - 1.5 * dt);
  }
  if (bursts.length > 180) bursts.splice(0, bursts.length - 180);
}

/* ---------------------------------------------- post */

function drawPost(t, d) {
  /* vignette */
  if (DBG.vignette) {
    const v = ctx.createRadialGradient(W * .5, H * .47, H * .23, W * .5, H * .47, H * .88);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(.68, 'rgba(0,0,0,.13)');
    v.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  /* very soft top and bottom falloff */
  const tg = ctx.createLinearGradient(0, 0, 0, H);
  tg.addColorStop(0, 'rgba(0,0,0,.28)');
  tg.addColorStop(.13, 'rgba(0,0,0,0)');
  tg.addColorStop(.8, 'rgba(0,0,0,0)');
  tg.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, H);

  /* film grain */
  if (!grainPattern) grainPattern = ctx.createPattern(GRAIN, 'repeat');
  if (grainPattern && DBG.grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = .2;
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* slow dim toward the end */
  if (t > 158) {
    const f = smooth((t - 158) / 14) * .28;
    ctx.fillStyle = `rgba(2,3,5,${f})`;
    ctx.fillRect(0, 0, W, H);
  }

  /* a breath of warm sky at first light */
  if (d.dawn > .12) {
    const da = smooth((d.dawn - .12) / .4) * .26;
    const dg = ctx.createLinearGradient(0, 700, 0, H);
    dg.addColorStop(0, 'rgba(86,60,44,0)');
    dg.addColorStop(1, `rgba(104,68,44,${da})`);
    ctx.fillStyle = dg;
    ctx.fillRect(0, 600, W, H - 600);
  }
}

/* ---------------------------------------------- render & loop */

function renderAt(t) {
  const d = makeDirector(t);
  const ambient = (state.forcedTime === null && !state.started)
    ? t + (performance.now() - state.previewStart) / 1000 * .33
    : t;
  ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (DBG.sky) drawSky(ambient, d);
  else { ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H); }
  if (DBG.stars) drawStars(ambient, d);

  ctx.save();
  applyCamera(ambient, d);
  if (DBG.moon) drawMoon(ambient, d);
  if (DBG.moon) drawMeteors(ambient, d);
  if (DBG.clouds) drawClouds(ambient, d);
  if (DBG.landscape) drawLandscape(ambient, d);
  if (DBG.lanterns) drawLanterns(ambient, d);
  if (DBG.swash) drawSwash(ambient, d);
  if (DBG.enso) drawEnso(ambient, d);
  if (DBG.cranes) drawCranes(ambient, d);
  if (DBG.geese) drawGeese(ambient, d);
  if (DBG.foreground) drawForeground(ambient, d);
  if (DBG.water) drawWater(ambient, d);
  if (DBG.trail) drawTrail(ambient, d);
  if (DBG.hut) drawHut(ambient, d);
  if (DBG.figure) drawFigure(ambient, d);
  if (DBG.plum) drawPlum(ambient, d);
  if (DBG.wind) drawWind(ambient, d);
  if (DBG.particles) drawParticles(ambient, d);
  if (DBG.reeds) drawReeds(ambient, d);
  ctx.restore();

  if (DBG.post) drawPost(ambient, d);
}

let rafOn = false;
function ensureLoop() {
  if (rafOn) return;
  rafOn = true;
  requestAnimationFrame(loop);
}

function loop(now) {
  rafOn = false;
  const dt = clamp((now - state.lastFrame) / 1000, 0, .055);
  state.lastFrame = now;
  const t = currentSceneTime();
  if (state.silent && state.started && !state.ended && t >= DURATION - .04) {
    state.ended = true;
    state.paused = true;
    state.silentBase = DURATION;
    revealEnd(true);
    updateTimeUI(DURATION);
    setPlayIcon();
    renderAt(DURATION);
    return;
  }
  const active = state.started && !state.paused && !state.ended;

  /* Idle, paused and ended scenes are painted once and then left alone.
     This keeps the intro from re-rendering the full canvas every frame. */
  if (!active) {
    const sec = Math.floor(t);
    if (sec !== lastTimeText) {
      lastTimeText = sec;
      updateTimeUI(t);
    }
    updateOverlays(t);
    if (state.started && t >= 166.4) revealEnd(true);
    renderAt(t);
    return;
  }

  detectBeat(t);
  handleBreaths(t, null);
  updateBursts(dt);
  state.pulse *= Math.exp(-dt * 1.8);
  state.voicePulse *= Math.exp(-dt * 2.4);
  if (state.voicePulse < .001) state.voicePulse = 0;

  const sec = Math.floor(t);
  if (sec !== lastTimeText) {
    lastTimeText = sec;
    updateTimeUI(t);
  }
  updateOverlays(t);
  if (t >= 166.4) revealEnd(true);
  else if (!state.ended && t < 166.4) revealEnd(false);
  renderAt(t);
  ensureLoop();
}

async function runProbe(t0, n, dt, tag) {
  hideIntro();
  state.started = true;
  state.paused = true;
  state.simMode = false;
  const Wc = canvas.width, Hc = canvas.height;
  const step = 6;
  const means = [], mads = [], bigs = [], maxs = [];
  const meansF = [], madsF = [], bigsF = [], maxsF = [];
  const fTop = Math.round(Hc * .62);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt;
    state.forcedTime = t;
    renderAt(t);
    const d = ctx.getImageData(0, 0, Wc, Hc).data;
    let sum = 0, mad = 0, big = 0, mx = 0, cnt = 0;
    let sumF = 0, madF = 0, bigF = 0, mxF = 0, cntF = 0;
    for (let y = 0; y < Hc; y += step) {
      for (let x = 0; x < Wc; x += step) {
        const k = (y * Wc + x) * 4;
        const l = d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114;
        sum += l; cnt++;
        const pv = prev ? prev[y / step * Math.ceil(Wc / step) + x / step] : null;
        const diff = prev ? Math.abs(l - pv) : 0;
        if (prev) {
          mad += diff;
          if (diff > 24) big++;
          if (diff > mx) mx = diff;
        }
        if (y >= fTop) {
          sumF += l; cntF++;
          if (prev) {
            madF += diff;
            if (diff > 24) bigF++;
            if (diff > mxF) mxF = diff;
          }
        }
      }
    }
    means.push(+(sum / cnt).toFixed(3));
    mads.push(prev ? +(mad / cnt).toFixed(3) : 0);
    bigs.push(prev ? +((big / cnt) * 100).toFixed(3) : 0);
    maxs.push(prev ? mx : 0);
    meansF.push(+(sumF / cntF).toFixed(3));
    madsF.push(prev ? +(madF / cntF).toFixed(3) : 0);
    bigsF.push(prev ? +((bigF / cntF) * 100).toFixed(3) : 0);
    maxsF.push(prev ? mxF : 0);
    prev = new Float32Array(Math.ceil(Wc / step) * Math.ceil(Hc / step));
    let idx = 0;
    for (let y = 0; y < Hc; y += step) for (let x = 0; x < Wc; x += step) {
      const k = (y * Wc + x) * 4;
      prev[idx++] = d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114;
    }
  }
  const out = { tag, t0, n, dt, w: Wc, h: Hc, fTop, means, mads, bigs, maxs, meansF, madsF, bigsF, maxsF };
  try {
    await fetch('/save', { method: 'POST', headers: { 'X-Filename': 'probe-' + tag + '.json', 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
  } catch (e) {}
}

function recordCanvas(secs) {
  if (!canvas.captureStream || !window.MediaRecorder) { showToast('录制不可用', 3000); return; }
  const stream = canvas.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined); }
  catch (e) { showToast('录制失败', 3000); return; }
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    try {
      await fetch('/save', { method: 'POST', headers: { 'X-Filename': 'qa-sim.webm' }, body: blob });
      showToast('录制完成 ' + Math.round(secs) + 's', 3000);
    } catch (e) { showToast('录制保存失败', 3000); }
  };
  rec.start(200);
  setTimeout(() => { try { rec.stop(); } catch (e) {} }, secs * 1000);
}

/* ---------------------------------------------- boot */

function boot() {
  window.MV.assets = { FAR_MOUNT, MID_MOUNT, NEAR_MOUNT, FOREGROUND };
  const params = new URLSearchParams(location.search);
  if (params.get('bare')) stage.classList.add('is-bare');
  const off = params.get('off');
  if (off) for (const k of off.split(',')) if (k in DBG) DBG[k] = false;
  resize();
  buildTicks();
  setMuteIcon();
  setPlayIcon();
  els.durTime.textContent = fmt(ENV.duration || DURATION);
  updateTimeUI(0);
  updateOverlays(0);
  markActivity(true);
  state.lastFrame = performance.now();
  window.addEventListener('resize', () => {
    if (!state.started || state.paused || state.ended) {
      requestAnimationFrame(() => renderAt(currentSceneTime()));
    }
  }, { passive: true });
  ensureLoop();
  const probe = params.get('probe');
  if (probe !== null) {
    const base = parseFloat(probe);
    setTimeout(() => runProbe(isFinite(base) ? base : 20, 45, 1 / 60, (off || 'all').replace(/,/g, '_')), 500);
  }
  if (params.has('sim')) {
    const base = parseFloat(params.get('sim'));
    state.simBase = isFinite(base) ? base : 20;
    state.simT0 = performance.now();
    state.simMode = true;
    state.started = true;
    state.paused = false;
    hideIntro();
    markActivity(true);
    const secs = parseFloat(params.get('record'));
    if (isFinite(secs) && secs > 0) setTimeout(() => recordCanvas(secs), 900);
  }
  if (params.has('t')) {
    const tt = parseFloat(params.get('t'));
    if (isFinite(tt)) setTimeout(() => window.MV.previewAt(tt), 320);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();
