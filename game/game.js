'use strict';
/* ENCORE! — a match-3 world tour. Pure canvas + WebAudio, no dependencies. */

// ============================================================ constants & helpers
const COLORS = [
  { name: 'Guitar',  emoji: '🎸', c1: '#ff5a7a', c2: '#b3123d' },
  { name: 'Drums',   emoji: '🥁', c1: '#ffab45', c2: '#c45800' },
  { name: 'Keys',    emoji: '🎹', c1: '#5fd8ff', c2: '#1567c4' },
  { name: 'Mic',     emoji: '🎤', c1: '#c07bff', c2: '#5b1fbf' },
  { name: 'Trumpet', emoji: '🎺', c1: '#fff07a', c2: '#c79600' },
  { name: 'Sax',     emoji: '🎷', c1: '#52f5b0', c2: '#0a8f58' },
];
const SPECIAL_ICON = { line: '🔦', lineH: '🔦', lineV: '🔦', bomb: '💥', rocket: '🚀', disco: '🪩' };
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const DPR = Math.min(2, window.devicePixelRatio || 1);
const $ = s => document.querySelector(s);
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const K = (x, y) => y * 32 + x;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const shuffleArr = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => Math.round(n).toLocaleString('en-US');

// ============================================================ save data
const Save = {
  data: { stars: {}, best: {}, boosters: { hammer: 3, pyro: 2, shuffle: 2, moves: 2 }, muted: false, jamBest: 0, daily: {} },
  load() {
    try {
      const raw = window.__ENCORE_SAVE || localStorage.getItem('encore-save');
      if (raw) {
        const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
        Object.assign(this.data, d);
        this.data.boosters = Object.assign({ hammer: 0, pyro: 0, shuffle: 0, moves: 0 }, d.boosters);
      }
    } catch (e) { /* fresh start */ }
  },
  write() {
    const s = JSON.stringify(this.data);
    try { localStorage.setItem('encore-save', s); } catch (e) {}
    try { window.webkit.messageHandlers.save.postMessage(s); } catch (e) {}
  },
  highest() { let n = 0; for (const k in this.data.stars) if (this.data.stars[k] > 0) n = Math.max(n, +k); return n; },
};

// ============================================================ audio (all synthesized)
const Sfx = {
  ctx: null, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.32; this.master.connect(this.ctx.destination);
  },
  on() { return this.ctx && !Save.data.muted; },
  tone(freq, dur = 0.2, type = 'triangle', vol = 0.4, when = 0, slide = 0) {
    if (!this.on()) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur = 0.4, vol = 0.5, freq = 800) {
    if (!this.on()) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  },
  note(i) { const s = [0, 2, 4, 7, 9]; return 261.63 * Math.pow(2, (s[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12); },
  click() { this.tone(880, 0.05, 'sine', 0.15); },
  swap() { this.tone(500, 0.08, 'sine', 0.18, 0, 1.6); },
  bad() { this.tone(180, 0.16, 'square', 0.1, 0, 0.7); },
  match(c) { const n = this.note(Math.min(c, 9) + 3); this.tone(n, 0.28, 'triangle', 0.35); this.tone(n * 2, 0.18, 'sine', 0.1, 0.02); },
  create() { [0, 2, 4].forEach((k, i) => this.tone(this.note(k + 8), 0.35, 'triangle', 0.22, i * 0.04)); },
  laser() { this.tone(1600, 0.32, 'sawtooth', 0.09, 0, 0.12); this.tone(800, 0.25, 'square', 0.05, 0, 0.3); },
  boom() { this.noise(0.55, 0.9, 700); this.tone(85, 0.45, 'sine', 0.6, 0, 0.45); },
  rocket() { this.tone(260, 0.45, 'square', 0.06, 0, 3.2); this.noise(0.3, 0.25, 2500); },
  disco() { [0, 2, 4, 5, 7, 9, 10].forEach((k, i) => this.tone(this.note(k + 6), 0.3, 'triangle', 0.22, i * 0.05)); },
  thud() { this.tone(120, 0.18, 'sine', 0.5, 0, 0.6); this.noise(0.12, 0.4, 400); },
  crate() { this.noise(0.25, 0.6, 1500); this.tone(160, 0.2, 'square', 0.12, 0, 0.5); },
  zap() { this.tone(2200, 0.12, 'sawtooth', 0.08, 0, 0.3); },
  unlock() { this.tone(1200, 0.08, 'square', 0.08); this.tone(1800, 0.1, 'square', 0.06, 0.05); },
  tick() { this.tone(1400, 0.05, 'sine', 0.12); },
  remix() { [7, 4, 2, 9, 5].forEach((k, i) => this.tone(this.note(k + 4), 0.12, 'square', 0.07, i * 0.05)); },
  collect() { [0, 4, 7, 12].forEach((k, i) => this.tone(this.note(k + 4), 0.2, 'sine', 0.25, i * 0.06)); },
  encore() { [0, 2, 4, 5, 7, 9, 10, 12].forEach((k, i) => this.tone(this.note(k + 4), 0.25, 'sawtooth', 0.08, i * 0.045)); this.noise(0.8, 0.3, 3000); },
  win() { [[0, 0], [4, 0.15], [7, 0.3], [12, 0.45], [9, 0.65], [12, 0.8]].forEach(([k, w]) => { this.tone(this.note(k + 5), 0.4, 'triangle', 0.3, w); this.tone(this.note(k + 5) / 2, 0.4, 'sine', 0.2, w); }); },
  lose() { [7, 5, 4, 0].forEach((k, i) => this.tone(this.note(k + 3), 0.35, 'triangle', 0.25, i * 0.18)); },
  star(i) { this.tone(this.note(7 + i * 2), 0.4, 'triangle', 0.3); this.tone(this.note(12 + i * 2), 0.3, 'sine', 0.15, 0.05); },
};

// ============================================================ state
let G = null;                 // the running gig
let canvas, ctx, VW = 0, VH = 0;
const view = { ts: 48, bx: 0, by: 0 };
const waiters = [];
let clock = 0, lastT = performance.now();
const input = { down: null, sel: null, booster: null, idle: 0, hint: null };
const FX = { parts: [], beams: [], rings: [], zaps: [], rockets: [], texts: [], dying: [], callout: null, shake: 0, flash: 0, flashColor: '#fff' };

const sleep = s => new Promise(r => waiters.push({ t: s, r }));
const settle = () => new Promise(r => waiters.push({ cond: () => !anyAnimating(), r }));

// ============================================================ tiles
let TID = 1;
function makeTile(x, y, color, special = null, kind = 'n') {
  return { id: TID++, x, y, rx: x, ry: y, color, special, kind, lock: 0, ad: 0, at: 0, ax: 0, ay: 0, bx: 0, by: 0, ease: 'out', squash: 0, pop: 0, fresh: false };
}
const EASE = {
  out: p => 1 - (1 - p) * (1 - p),
  fall: p => p * p,
  back: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
};
function moveTo(t, x, y, dur, ease = 'out') { t.ax = t.rx; t.ay = t.ry; t.bx = x; t.by = y; t.at = 0; t.ad = dur; t.ease = ease; }
function eachTile(fn) { for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) { const t = G.grid[y][x]; if (t) fn(t, x, y); } }
function anyAnimating() { if (!G) return false; for (const row of G.grid) for (const t of row) if (t && t.ad > 0) return true; return false; }
const matchable = t => t && t.kind === 'n' && t.special !== 'disco';
const colorAt = (x, y) => { const t = G.grid[y] && G.grid[y][x]; return matchable(t) ? t.color : -1; };
const open = (x, y) => { const c = G.cells[y] && G.cells[y][x]; return !!c && !c.hole && !c.block; };

// ============================================================ building a gig
function buildGame(def, mode) {
  const rows = def.map, H = rows.length, W = Math.max(...rows.map(r => r.length));
  const g = {
    def, mode, W, H, cells: [], grid: [], moves: def.moves || 0, score: 0, hype: 0, encore: 0,
    busy: true, over: false, paused: false, started: false, queue: [], cascade: 0, staticHit: false,
    movesMade: 0, lastDropMove: -9, colors: def.colors || 5, timeLeft: def.time || 0, claimed: new Set(),
    goals: (def.goals || []).map(x => ({ type: x.type, color: x.color, special: x.special, need: x.n || 0, have: 0 })),
  };
  const s = def.stars || [def.moves * 260, def.moves * 560, def.moves * 900];
  g.stars = s.map(v => Math.round(v / 100) * 100);
  for (let y = 0; y < H; y++) {
    g.cells[y] = []; g.grid[y] = [];
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x] || '#';
      const cell = { hole: ch === '#' || ch === 'W', wall: ch === 'W', jelly: 0, block: null, ch };
      if (ch === 'j' || ch === 'l' || ch === 'x') cell.jelly = 1;
      if (ch === 'J') cell.jelly = 2;
      if (ch === 'c' || ch === 'x') cell.block = { type: 'crate', hp: 1, hit: 0 };
      if (ch === 'C') cell.block = { type: 'crate', hp: 2, hit: 0 };
      if (ch === 's') cell.block = { type: 'static', hp: 1, hit: 0 };
      g.cells[y][x] = cell; g.grid[y][x] = null;
    }
  }
  return g;
}

function fillBoard() {
  const { W, H } = G;
  for (let attempt = 0; attempt < 30; attempt++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = G.cells[y][x]; G.grid[y][x] = null;
      if (c.hole || c.block) continue;
      if (c.ch === 'd') { G.grid[y][x] = makeTile(x, y, -1, null, 'drop'); continue; }
      let col = rnd(G.colors);
      for (let tries = 0; tries < 20; tries++) {
        col = rnd(G.colors);
        if (colorAt(x - 1, y) === col && colorAt(x - 2, y) === col) continue;
        if (colorAt(x, y - 1) === col && colorAt(x, y - 2) === col) continue;
        if (colorAt(x - 1, y) === col && colorAt(x, y - 1) === col && colorAt(x - 1, y - 1) === col) continue;
        break;
      }
      const t = makeTile(x, y, col);
      if (c.ch === 'L' || c.ch === 'l') t.lock = 1;
      G.grid[y][x] = t;
    }
    if (!findMatches().length && findMove()) break;
  }
  // entrance: everything drops in from above
  eachTile((t, x, y) => { t.ry = y - G.H - 1; moveTo(t, x, y, 0.55 + x * 0.025 + (G.H - y) * 0.035, 'fall'); });
}

// ============================================================ match finding
function findMatches() {
  const { W, H } = G, runs = [], squares = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    const c = colorAt(x, y); let e = x + 1;
    if (c >= 0) while (e < W && colorAt(e, y) === c) e++;
    if (c >= 0 && e - x >= 3) { const cells = []; for (let i = x; i < e; i++) cells.push([i, y]); runs.push({ dir: 'h', cells, c }); }
    x = e;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H;) {
    const c = colorAt(x, y); let e = y + 1;
    if (c >= 0) while (e < H && colorAt(x, e) === c) e++;
    if (c >= 0 && e - y >= 3) { const cells = []; for (let i = y; i < e; i++) cells.push([x, i]); runs.push({ dir: 'v', cells, c }); }
    y = e;
  }
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const c = colorAt(x, y);
    if (c >= 0 && colorAt(x + 1, y) === c && colorAt(x, y + 1) === c && colorAt(x + 1, y + 1) === c)
      squares.push({ cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], c });
  }
  if (!runs.length && !squares.length) return [];
  const parent = new Map();
  const find = k => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (const s of [...runs, ...squares]) {
    const ks = s.cells.map(([x, y]) => K(x, y));
    ks.forEach(k => { if (!parent.has(k)) parent.set(k, k); });
    for (let i = 1; i < ks.length; i++) { const a = find(ks[0]), b = find(ks[i]); if (a !== b) parent.set(a, b); }
  }
  const groups = new Map();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, { keys: new Set(), runs: [], square: null, color: -1 });
    groups.get(r).keys.add(k);
  }
  for (const r of runs) { const g = groups.get(find(K(...r.cells[0]))); g.runs.push(r); g.color = r.c; }
  for (const s of squares) { const g = groups.get(find(K(...s.cells[0]))); if (!g.square) g.square = s.cells; g.color = s.c; }
  return [...groups.values()].map(g => ({ ...g, cells: [...g.keys].map(k => [k % 32, Math.floor(k / 32)]) }));
}

function specialFor(g) {
  let mh = 0, mv = 0;
  for (const r of g.runs) { if (r.dir === 'h') mh = Math.max(mh, r.cells.length); else mv = Math.max(mv, r.cells.length); }
  const m = Math.max(mh, mv);
  if (m >= 5) return 'disco';
  if (mh >= 3 && mv >= 3) return 'bomb';
  if (m === 4) return mh === 4 ? 'lineV' : 'lineH';
  if (g.square) return 'rocket';
  return null;
}

function matchAt(x, y) {
  const c = colorAt(x, y); if (c < 0) return false;
  let h = 1, v = 1;
  for (let i = x - 1; colorAt(i, y) === c; i--) h++;
  for (let i = x + 1; colorAt(i, y) === c; i++) h++;
  if (h >= 3) return true;
  for (let i = y - 1; colorAt(x, i) === c; i--) v++;
  for (let i = y + 1; colorAt(x, i) === c; i++) v++;
  if (v >= 3) return true;
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const sx = x + dx, sy = y + dy;
    if (colorAt(sx, sy) === c && colorAt(sx + 1, sy) === c && colorAt(sx, sy + 1) === c && colorAt(sx + 1, sy + 1) === c) return true;
  }
  return false;
}

function findMove() {
  const { W, H, grid } = G;
  const ok = t => t && !t.lock;
  let special = null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = grid[y][x]; if (!ok(t)) continue;
    if (t.special && !special) special = { a: t, b: null };
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy, u = grid[ny] && grid[ny][nx];
      if (!ok(u)) continue;
      if (t.special === 'disco' || u.special === 'disco' || (t.special && u.special)) return { a: t, b: u };
      grid[y][x] = u; grid[ny][nx] = t;
      const hit = matchAt(x, y) || matchAt(nx, ny);
      grid[y][x] = t; grid[ny][nx] = u;
      if (hit) return { a: t, b: u };
    }
  }
  return special;
}

// ============================================================ scoring & goals
function addScore(pts, x, y, show = true) {
  if (!pts) return;
  if (G.encore > 0) pts *= 2;
  G.score += pts;
  if (show && x != null) floatText(x, y, '+' + fmt(pts), G.encore > 0 ? '#ff7cf0' : '#fff');
}
function goalTick(type, color) {
  for (const g of G.goals) if (g.type === type && (g.color == null || g.color === color) && g.have < g.need) g.have++;
}
function goalRemaining(g) {
  let n = 0;
  switch (g.type) {
    case 'score': return Math.max(0, g.need - G.score);
    case 'collect': case 'drop': case 'make': return Math.max(0, g.need - g.have);
    case 'jelly': for (const r of G.cells) for (const c of r) n += c.jelly; return n;
    case 'crate': for (const r of G.cells) for (const c of r) if (c.block && c.block.type === 'crate') n++; return n;
    case 'static': for (const r of G.cells) for (const c of r) if (c.block && c.block.type === 'static') n++; return n;
    case 'lock': eachTile(t => { if (t.lock) n++; }); return n;
  }
  return 0;
}
const goalsMet = () => G.goals.length > 0 && G.goals.every(g => goalRemaining(g) === 0);
const goalActive = (type, color) => G.goals.some(g => g.type === type && (color == null || g.color == null || g.color === color) && goalRemaining(g) > 0);

// ============================================================ destruction
function hitCell(x, y, wave, toward) {
  if (x < 0 || y < 0 || x >= G.W || y >= G.H) return 0;
  const k = K(x, y);
  if (wave) { if (wave.has(k)) return 0; wave.add(k); }
  const cell = G.cells[y][x];
  if (cell.hole) return 0;
  if (cell.block) { damageBlock(x, y); return 0; }
  const t = G.grid[y][x];
  let pts = 0;
  if (t) {
    if (t.fresh) return 0;
    if (t.lock) { t.lock = 0; t.pop = 0.6; burst(x, y, '#9ff', 10, 4); Sfx.unlock(); return 40; }
    if (t.kind === 'drop') return 0;
    G.grid[y][x] = null;
    FX.dying.push({ t, life: 0.24, max: 0.24, tx: toward ? toward[0] : null, ty: toward ? toward[1] : null });
    burst(x, y, t.special === 'disco' ? '#ffffff' : COLORS[t.color].c1, toward ? 4 : 8, 4.5);
    if (t.color >= 0) goalTick('collect', t.color);
    pts = 30 * Math.max(1, G.cascade);
    G.hype = Math.min(100, G.hype + 0.6 * Math.max(1, G.cascade * 0.8));
    if (t.special) G.queue.push({ sp: t.special, x, y, color: t.color });
  }
  if (cell.jelly > 0) { cell.jelly--; sparkle(x, y, '#ffb3f5', 8); pts += 60; }
  return pts;
}

function damageBlock(x, y) {
  const c = G.cells[y][x], b = c.block; if (!b) return;
  b.hp--; b.hit = 1;
  if (b.type === 'static') { G.staticHit = true; }
  if (b.hp <= 0) {
    c.block = null;
    if (b.type === 'crate') { burst(x, y, '#c9a26b', 12, 6); burst(x, y, '#e8e8f0', 6, 5); Sfx.crate(); }
    else { burst(x, y, '#b9b9ff', 14, 6); Sfx.zap(); }
    addScore(120, x, y);
  } else { burst(x, y, '#c9a26b', 6, 3); Sfx.thud(); addScore(40, x, y, false); }
}

// ============================================================ effects helpers (board cell units)
function burst(x, y, color, n = 8, speed = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    FX.parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 0.4 + Math.random() * 0.4, max: 0.8, color, size: 0.05 + Math.random() * 0.08, g: 9 });
  }
}
function sparkle(x, y, color, n = 6) {
  for (let i = 0; i < n; i++) FX.parts.push({ x: x + Math.random(), y: y + Math.random(), vx: (Math.random() - 0.5), vy: -1 - Math.random() * 2, life: 0.6 + Math.random() * 0.5, max: 1.1, color, size: 0.06 + Math.random() * 0.06, g: 0, star: true });
}
function confetti(n = 120) {
  const cols = ['#ff4fd8', '#4ff3ff', '#ffd84f', '#7dff7a', '#ff7a4f', '#b07bff'];
  for (let i = 0; i < n; i++) FX.parts.push({ x: -1 + Math.random() * (G.W + 2), y: -2 - Math.random() * 4, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, life: 3 + Math.random() * 2, max: 5, color: pick(cols), size: 0.12, g: 2.5, conf: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
}
function floatText(x, y, text, color = '#fff', size = 0.42) { FX.texts.push({ x: x + 0.5, y: y + 0.5, text, color, size, life: 1, max: 1 }); }
function callout(text, color = '#ffd84f') { FX.callout = { text, color, life: 1.5, max: 1.5 }; }

// ============================================================ gravity / refill
function dropPathOk(x) {
  let gap = false;
  for (let y = 0; y < G.H; y++) { const c = G.cells[y][x]; if (c.wall) return false; if (c.hole) gap = true; else if (gap) return false; }
  return true;
}
function wantDrop(x) {
  if (!dropPathOk(x)) return false;
  const g = G.goals.find(g => g.type === 'drop'); if (!g) return false;
  let onBoard = 0; eachTile(t => { if (t.kind === 'drop') onBoard++; });
  if (g.have + onBoard >= g.need || onBoard >= 2) return false;
  if (G.movesMade - G.lastDropMove < 3 && onBoard > 0) return false;
  if (Math.random() < (onBoard === 0 ? 0.35 : 0.12)) { G.lastDropMove = G.movesMade; return true; }
  return false;
}

async function gravity() {
  const { W, H, grid } = G;
  const spawned = new Array(W).fill(0);
  let moved = false;
  for (let guard = 0; guard < 400; guard++) {
    let changed = false;
    for (let x = 0; x < W; x++) {
      for (let y = H - 1; y >= 0; y--) {
        if (!open(x, y) || grid[y][x]) continue;
        let yy = y - 1;
        while (yy >= 0 && open(x, yy) && !grid[yy][x]) yy--;
        if (yy >= 0 && open(x, yy)) {
          const t = grid[yy][x];
          if (t && !t.lock) { grid[yy][x] = null; grid[y][x] = t; t.x = x; t.y = y; changed = true; }
        } else if (yy < 0 || G.cells[yy][x].hole) {
          const drop = yy < 0 && wantDrop(x);
          const t = drop ? makeTile(x, y, -1, null, 'drop') : makeTile(x, y, rnd(G.colors));
          t.rx = x; t.ry = yy - spawned[x]; spawned[x]++;
          grid[y][x] = t; changed = true;
        }
      }
    }
    if (!changed) {
      // diagonal slide into cells shadowed by cases / cables / walls
      outer:
      for (let y = H - 1; y > 0; y--) for (let x = 0; x < W; x++) {
        if (!open(x, y) || grid[y][x]) continue;
        for (const dx of shuffleArr([-1, 1])) {
          const sx = x + dx, sy = y - 1;
          if (!open(sx, sy)) continue;
          const t = grid[sy][sx];
          if (!t || t.lock) continue;
          if (open(sx, sy + 1) && !grid[sy + 1][sx]) continue;
          grid[sy][sx] = null; grid[y][x] = t; t.x = x; t.y = y; changed = true;
          break outer;
        }
      }
    }
    if (!changed) break;
    moved = true;
  }
  if (!moved) return false;
  eachTile((t, x, y) => {
    if (Math.abs(t.rx - x) > 0.01 || Math.abs(t.ry - y) > 0.01) {
      const d = Math.hypot(t.rx - x, t.ry - y);
      moveTo(t, x, y, 0.1 + 0.075 * Math.sqrt(d) * 1.6, 'fall');
    }
  });
  await settle();
  return true;
}

function collectDrops() {
  let n = 0;
  eachTile((t, x, y) => {
    if (t.kind !== 'drop') return;
    if (y + 1 >= G.H || (G.cells[y + 1][x].hole && !G.cells[y + 1][x].wall)) {
      G.grid[y][x] = null; n++;
      FX.dying.push({ t, life: 0.5, max: 0.5, tx: x, ty: y + 1.2 });
      sparkle(x, y, '#ffd84f', 16); goalTick('drop');
      floatText(x, y, 'VIP! +500', '#ffd84f', 0.5); addScore(500, null, null, false);
    }
  });
  if (n) { Sfx.collect(); updateHUD(); }
  return n;
}

// ============================================================ resolving a move
async function clearGroups(groups, pref) {
  const wave = new Set(), bwave = new Set();
  for (const g of groups) {
    const type = specialFor(g);
    let place = null;
    if (type) {
      const ok = ([x, y]) => { const t = G.grid[y][x]; return t && !t.lock && !t.special; };
      if (pref) for (const p of pref) if (g.keys.has(K(p.x, p.y)) && ok([p.x, p.y])) { place = [p.x, p.y]; break; }
      if (!place) {
        const src = (g.runs.length ? g.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a)).cells : g.square).filter(ok);
        const any = g.cells.filter(ok);
        place = src.length ? src[Math.floor(src.length / 2)] : any[0] || null;
      }
    }
    let pts = 0, sx = 0, sy = 0;
    for (const [x, y] of g.cells) {
      sx += x; sy += y;
      pts += hitCell(x, y, wave, place);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, c = G.cells[ny] && G.cells[ny][nx];
        if (c && c.block && !bwave.has(K(nx, ny))) { bwave.add(K(nx, ny)); damageBlock(nx, ny); }
      }
    }
    if (place && type) {
      const [x, y] = place;
      const nt = makeTile(x, y, type === 'disco' ? -1 : g.color, type);
      nt.fresh = true; nt.pop = 1;
      G.grid[y][x] = nt;
      sparkle(x, y, '#fff', 12); Sfx.create();
      for (const gl of G.goals) if (gl.type === 'make' && (gl.special === type || (gl.special === 'line' && type.startsWith('line'))) && gl.have < gl.need) gl.have++;
      if (G.mode === 'jam') { G.timeLeft += 1; floatText(x, y - 0.6, '+1s', '#4ff3ff', 0.38); }
      pts += 200;
    }
    addScore(pts, sx / g.cells.length, sy / g.cells.length);
  }
  Sfx.match(G.cascade);
  const words = [null, null, 'Nice!', 'Groovy!', "Rockin'!", 'Electric!', 'Unstoppable!', 'LEGENDARY!'];
  if (G.cascade >= 2) callout(words[Math.min(G.cascade, 7)], G.cascade >= 5 ? '#ff4fd8' : '#ffd84f');
  updateHUD();
  await sleep(0.2);
}

async function runQueue() {
  let n = 0;
  while (G.queue.length) {
    const a = G.queue.shift();
    await activate(a);
    if (++n > 500) { G.queue.length = 0; break; }
  }
  eachTile(t => { t.fresh = false; });
}

function mostCommonColor() {
  const c = new Array(6).fill(0);
  eachTile(t => { if (matchable(t) && !t.fresh) c[t.color]++; });
  return c.indexOf(Math.max(...c));
}

function pickTarget() {
  const tiers = [[], [], [], []];
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
    if (G.claimed.has(K(x, y))) continue;
    const c = G.cells[y][x]; if (c.hole) continue;
    const t = G.grid[y][x];
    if (c.block) { tiers[c.block.type === 'static' || goalActive('crate') ? 0 : 2].push([x, y]); continue; }
    if (!t || t.fresh || t.kind === 'drop') continue;
    const above = G.grid[y - 1] && G.grid[y - 1][x];
    if (c.jelly > 0) tiers[0].push([x, y]);
    else if (t.lock) tiers[goalActive('lock') ? 0 : 2].push([x, y]);
    else if (above && above.kind === 'drop') tiers[0].push([x, y]);
    else if (goalActive('collect', t.color) && G.goals.some(g => g.type === 'collect' && g.color === t.color)) tiers[1].push([x, y]);
    else tiers[3].push([x, y]);
  }
  for (const tier of tiers) if (tier.length) return pick(tier);
  return null;
}

async function flyRocket(x, y, carry) {
  const tgt = pickTarget(); if (!tgt) return;
  const k = K(tgt[0], tgt[1]); G.claimed.add(k);
  const r = { x0: x, y0: y, x1: tgt[0], y1: tgt[1], t: 0, dur: 0.55, carry }; FX.rockets.push(r);
  Sfx.rocket();
  await sleep(r.dur);
  G.claimed.delete(k);
  const pts = hitCell(tgt[0], tgt[1], new Set());
  burst(tgt[0], tgt[1], '#ffcf6b', 14, 6);
  addScore(pts, tgt[0], tgt[1]);
  if (carry) G.queue.unshift({ sp: carry === 'line' ? pick(['lineH', 'lineV']) : carry, x: tgt[0], y: tgt[1], color: -1 });
}

async function discoBlast(x, y, color, convert) {
  Sfx.disco(); FX.flash = 0.35; FX.flashColor = COLORS[color] ? COLORS[color].c1 : '#fff';
  const targets = [];
  eachTile((t, tx, ty) => { if (matchable(t) && t.color === color && !t.fresh) targets.push(t); });
  for (const t of targets) FX.zaps.push({ x0: x + 0.5, y0: y + 0.5, x1: t.x + 0.5, y1: t.y + 0.5, life: 0.5, max: 0.5, color: COLORS[color].c1 });
  if (convert) {
    for (const t of targets) { if (!t.special) t.special = convert === 'line' ? pick(['lineH', 'lineV']) : convert; t.pop = 1; }
    Sfx.create();
    await sleep(0.55);
  } else await sleep(0.3);
  let pts = 0;
  const wave = new Set();
  for (const t of targets) if (G.grid[t.y][t.x] === t) pts += hitCell(t.x, t.y, wave);
  addScore(pts, x, y);
}

function explode(x, y, r, wave) {
  let pts = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if (Math.abs(dx) + Math.abs(dy) <= r + 1) pts += hitCell(x + dx, y + dy, wave);
  FX.rings.push({ x: x + 0.5, y: y + 0.5, r: r + 1, life: 0.45, max: 0.45 });
  FX.shake = Math.min(1.2, FX.shake + 0.35 + r * 0.12);
  Sfx.boom();
  return pts;
}

function laser(x, y, dir, wave, color) {
  let pts = 0;
  FX.beams.push({ x, y, dir, life: 0.4, max: 0.4, color: color >= 0 ? COLORS[color].c1 : '#fff' });
  if (dir === 'h') for (let i = 0; i < G.W; i++) pts += hitCell(i, y, wave);
  else for (let i = 0; i < G.H; i++) pts += hitCell(x, i, wave);
  return pts;
}

async function activate(a) {
  const { sp, x, y } = a;
  const wave = new Set([K(x, y)]);
  let pts = 0;
  G.hype = Math.min(100, G.hype + 2.5);
  switch (sp) {
    case 'lineH': pts += laser(x, y, 'h', wave, a.color); Sfx.laser(); break;
    case 'lineV': pts += laser(x, y, 'v', wave, a.color); Sfx.laser(); break;
    case 'cross': pts += laser(x, y, 'h', wave, a.color) + laser(x, y, 'v', wave, a.color); Sfx.laser(); FX.shake += 0.3; break;
    case 'bigcross':
      for (let d = -1; d <= 1; d++) pts += laser(x + d, y + d, 'h', wave, a.color) + laser(x + d, y + d, 'v', wave, a.color);
      Sfx.laser(); Sfx.boom(); break;
    case 'bomb': pts += explode(x, y, 2, wave); break;
    case 'mega': pts += explode(x, y, 4, wave); FX.flash = 0.5; FX.flashColor = '#ffb347'; break;
    case 'rocket':
      for (const [dx, dy] of DIRS) pts += hitCell(x + dx, y + dy, wave);
      await flyRocket(x, y, a.carry); break;
    case 'multirocket':
      for (const [dx, dy] of DIRS) pts += hitCell(x + dx, y + dy, wave);
      await Promise.all([0, 1, 2].map(i => sleep(i * 0.08).then(() => flyRocket(x, y, null)))); break;
    case 'disco': await discoBlast(x, y, a.target != null ? a.target : mostCommonColor(), a.convert); break;
    case 'clearall':
      FX.flash = 0.8; FX.flashColor = '#ffffff'; Sfx.disco(); Sfx.boom(); FX.shake = 1.5;
      for (let yy = 0; yy < G.H; yy++) { pts += laser(0, yy, 'h', wave, -1); await sleep(0.05); }
      break;
  }
  addScore(pts, x, y);
  updateHUD();
  await sleep(Math.max(0.05, 0.16 - G.queue.length * 0.012));
}

async function comboSwap(ta, tb) {
  const [A, B] = tb.special === 'disco' && ta.special !== 'disco' ? [tb, ta] : [ta, tb];
  const x = ta.x, y = ta.y;
  G.cascade = 1;
  const take = t => { G.grid[t.y][t.x] = null; FX.dying.push({ t, life: 0.25, max: 0.25, tx: x, ty: y }); };
  take(A);
  if (A.special === 'disco') {
    if (B.special === 'disco') { take(B); callout('BRING DOWN THE HOUSE!', '#ff4fd8'); G.queue.push({ sp: 'clearall', x, y }); }
    else if (B.special) { take(B); callout('DISCO COMBO!', '#4ff3ff'); G.queue.push({ sp: 'disco', x: A.x, y: A.y, target: B.color, convert: B.special.startsWith('line') ? 'line' : B.special }); }
    else if (B.kind === 'n') { take(B); G.queue.push({ sp: 'disco', x: A.x, y: A.y, target: B.color }); }
    else G.queue.push({ sp: 'disco', x: A.x, y: A.y });
  } else {
    take(B);
    const norm = s => (s.startsWith('line') ? 'line' : s);
    const combo = [norm(A.special), norm(B.special)].sort().join('+');
    const lineOf = [A, B].find(t => t.special.startsWith('line'));
    callout('COMBO!', '#4ff3ff');
    switch (combo) {
      case 'line+line': G.queue.push({ sp: 'cross', x, y, color: A.color }); break;
      case 'bomb+line': G.queue.push({ sp: 'bigcross', x, y, color: A.color }); break;
      case 'bomb+bomb': G.queue.push({ sp: 'mega', x, y }); break;
      case 'rocket+rocket': G.queue.push({ sp: 'multirocket', x, y }); break;
      case 'line+rocket': G.queue.push({ sp: 'rocket', x, y, carry: lineOf.special }); break;
      case 'bomb+rocket': G.queue.push({ sp: 'rocket', x, y, carry: 'bomb' }); break;
    }
  }
  await runQueue();
}

async function resolveBoard(groups = null, pref = null) {
  for (let guard = 0; guard < 80; guard++) {
    await gravity();
    if (collectDrops()) { await sleep(0.25); continue; }
    const gs = groups || findMatches(); groups = null;
    if (!gs.length) break;
    G.cascade++;
    await clearGroups(gs, pref); pref = null;
    await runQueue();
  }
  updateHUD();
}

function spreadStatic() {
  const cands = [];
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
    const c = G.cells[y][x];
    if (!c.block || c.block.type !== 'static') continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, t = G.grid[ny] && G.grid[ny][nx];
      if (t && t.kind === 'n' && !t.special && !t.lock) cands.push([nx, ny]);
    }
  }
  if (!cands.length) return;
  const [x, y] = pick(cands);
  const t = G.grid[y][x]; G.grid[y][x] = null;
  FX.dying.push({ t, life: 0.3, max: 0.3 });
  G.cells[y][x].block = { type: 'static', hp: 1, hit: 1 };
  burst(x, y, '#9a9aff', 10, 3); Sfx.zap();
  floatText(x, y, 'bzzt!', '#b9b9ff', 0.36);
}

async function startEncore() {
  G.hype = 0; G.encore = 3;
  callout('ENCORE!', '#ff4fd8'); Sfx.encore(); FX.flash = 0.6; FX.flashColor = '#ff4fd8';
  if (G.mode === 'jam') G.timeLeft += 5;
  const cands = []; eachTile(t => { if (t.kind === 'n' && !t.special && !t.lock) cands.push(t); });
  shuffleArr(cands).slice(0, 3).forEach(t => { t.special = pick(['lineH', 'lineV', 'bomb', 'rocket']); t.pop = 1; sparkle(t.x, t.y, '#ff9cf0', 14); });
  updateHUD();
  await sleep(0.7);
}

async function shuffleBoard() {
  callout('REMIX!', '#4ff3ff'); Sfx.remix();
  const spots = [], tiles = [];
  eachTile((t, x, y) => { if (t.kind === 'n' && !t.lock) { spots.push([x, y]); tiles.push(t); } });
  for (let attempt = 0; attempt < 120; attempt++) {
    shuffleArr(tiles);
    tiles.forEach((t, i) => { const [x, y] = spots[i]; G.grid[y][x] = t; t.x = x; t.y = y; });
    if (!findMatches().length && findMove()) break;
    if (attempt > 60) tiles.forEach(t => { if (!t.special) t.color = rnd(G.colors); });
  }
  tiles.forEach(t => moveTo(t, t.x, t.y, 0.5, 'back'));
  await settle();
  // if recolouring created matches anyway, let them play out
  if (findMatches().length) { G.cascade = 0; await resolveBoard(); }
}

async function endMove(isMove) {
  if (isMove) {
    if (G.encore > 0) G.encore--;
    if (!G.staticHit) spreadStatic();
    G.staticHit = false;
  }
  if (G.hype >= 100) await startEncore();
  updateHUD();
  if (G.mode !== 'jam' && goalsMet()) { await winGig(); return; }
  if (G.mode !== 'jam' && G.moves <= 0) { loseGig(); return; }
  if (!findMove()) await shuffleBoard();
  G.busy = false; input.idle = 0; input.hint = null;
  if (G.mode === 'jam' && G.timeLeft <= 0) endJam();
}

// ============================================================ player actions
function swapGrid(ax, ay, bx, by) {
  const g = G.grid, t = g[ay][ax]; g[ay][ax] = g[by][bx]; g[by][bx] = t;
  if (g[ay][ax]) { g[ay][ax].x = ax; g[ay][ax].y = ay; }
  if (g[by][bx]) { g[by][bx].x = bx; g[by][bx].y = by; }
}
function useMove() { if (G.mode !== 'jam') G.moves--; G.movesMade++; G.cascade = 0; updateHUD(); }

async function trySwap(ax, ay, bx, by) {
  if (bx < 0 || by < 0 || bx >= G.W || by >= G.H) return;
  const ta = G.grid[ay][ax], tb = G.grid[by][bx];
  if (!ta || !tb || ta.lock || tb.lock) { Sfx.bad(); if (ta) ta.pop = 0.3; return; }
  G.busy = true; input.hint = null; input.sel = null;
  swapGrid(ax, ay, bx, by); moveTo(ta, bx, by, 0.16); moveTo(tb, ax, ay, 0.16); Sfx.swap();
  await settle();
  if (ta.special === 'disco' || tb.special === 'disco' || (ta.special && tb.special)) {
    useMove(); await comboSwap(ta, tb); await resolveBoard(); await endMove(true); return;
  }
  const groups = findMatches();
  if (!groups.length) {
    swapGrid(ax, ay, bx, by); moveTo(ta, ax, ay, 0.16); moveTo(tb, bx, by, 0.16); Sfx.bad();
    await settle(); G.busy = false; return;
  }
  useMove();
  await resolveBoard(groups, [{ x: bx, y: by }, { x: ax, y: ay }]);
  await endMove(true);
}

async function fireSpecial(t) {
  G.busy = true; input.sel = null; useMove(); G.cascade = 1;
  hitCell(t.x, t.y, new Set());
  await runQueue(); await resolveBoard(); await endMove(true);
}

function armBooster(b) {
  if (!G || G.busy || G.over) return;
  if ((Save.data.boosters[b] || 0) <= 0) { Sfx.bad(); return; }
  Sfx.click();
  if (b === 'shuffle') {
    Save.data.boosters.shuffle--; Save.write(); updateBoosterUI();
    G.busy = true; input.booster = null;
    shuffleBoard().then(() => { G.busy = false; input.idle = 0; });
    return;
  }
  input.booster = input.booster === b ? null : b;
  updateBoosterUI();
}

async function applyBooster(x, y) {
  const b = input.booster, c = G.cells[y][x];
  if (c.hole || (!c.block && !G.grid[y][x])) return;
  input.booster = null;
  Save.data.boosters[b]--; Save.write(); updateBoosterUI();
  G.busy = true; G.cascade = 1;
  if (b === 'hammer') {
    Sfx.thud(); FX.shake += 0.5; FX.rings.push({ x: x + 0.5, y: y + 0.5, r: 0.9, life: 0.3, max: 0.3 });
    addScore(hitCell(x, y, new Set()), x, y);
  } else if (b === 'pyro') {
    G.queue.push({ sp: 'bomb', x, y });
    if (G.grid[y][x] && !G.grid[y][x].special) hitCell(x, y, new Set());
  }
  await runQueue(); await resolveBoard(); await endMove(false);
}

// ============================================================ win / lose / finale
async function winGig() {
  G.busy = true; G.over = true;
  if (G.moves > 0) {
    callout('ENCORE FINALE!', '#ff4fd8'); Sfx.encore(); await sleep(1.0);
    while (G.moves > 0) {
      G.moves--;
      const cands = []; eachTile(t => { if (t.kind === 'n' && !t.special && !t.lock) cands.push(t); });
      if (!cands.length) break;
      const t = pick(cands); t.special = pick(['lineH', 'lineV']); t.pop = 1; sparkle(t.x, t.y, '#fff', 6);
      addScore(250, t.x, t.y); Sfx.tick(); updateHUD();
      await sleep(0.08);
    }
    G.cascade = 1;
    for (let round = 0; round < 6; round++) {
      const sp = []; eachTile(t => { if (t.special) sp.push(t); });
      if (!sp.length) break;
      for (const t of sp) if (G.grid[t.y][t.x] === t) hitCell(t.x, t.y, null);
      await runQueue(); await resolveBoard();
    }
  }
  const stars = G.score >= G.stars[2] ? 3 : G.score >= G.stars[1] ? 2 : 1;
  confetti(); Sfx.win();
  const d = G.def, key = d.daily ? null : d.n;
  let reward = null;
  if (key) {
    const prev = Save.data.stars[key] || 0;
    Save.data.stars[key] = Math.max(prev, stars);
    Save.data.best[key] = Math.max(Save.data.best[key] || 0, G.score);
    if (!prev || stars > prev) reward = pick(['hammer', 'pyro', 'shuffle', 'moves']);
  } else if (d.daily) {
    const prev = Save.data.daily[d.daily] || 0;
    Save.data.daily[d.daily] = Math.max(prev, stars);
    if (!prev) reward = pick(['hammer', 'pyro', 'moves']);
  }
  if (reward) Save.data.boosters[reward] = (Save.data.boosters[reward] || 0) + (stars === 3 ? 2 : 1);
  Save.write();
  await sleep(0.8);
  showWin(stars, reward);
}

function loseGig() {
  G.busy = true; G.over = true; Sfx.lose();
  const left = G.goals.filter(g => goalRemaining(g) > 0).map(goalChip).join('');
  const extra = Save.data.boosters.moves || 0;
  const btns = [];
  if (extra > 0) btns.push({ label: `⏱ +5 moves <small>(${extra} left)</small>`, cls: 'primary', fn: () => {
    Save.data.boosters.moves--; Save.write(); hideModal();
    G.moves += 5; G.over = false; G.busy = false; updateHUD();
  } });
  btns.push({ label: '↻ Try again', cls: extra ? '' : 'primary', fn: () => startGig(G.def, G.mode) });
  btns.push({ label: 'Tour map', fn: showMenu });
  modal(`<h2>Out of moves!</h2><p class="sub">The crowd wants more. Still to do:</p><div class="goal-row big">${left}</div>`, btns);
}

function endJam() {
  if (!G || G.over) return;
  G.over = true; G.busy = true;
  const best = Save.data.jamBest || 0, isBest = G.score > best;
  if (isBest) { Save.data.jamBest = G.score; Save.write(); confetti(); Sfx.win(); } else Sfx.lose();
  modal(`<h2>${isBest ? 'NEW RECORD!' : "Time's up!"}</h2><div class="big-score">${fmt(G.score)}</div><p class="sub">Best: ${fmt(Math.max(best, G.score))}</p>`,
    [{ label: '↻ Jam again', cls: 'primary', fn: () => startGig(jamDef(), 'jam') }, { label: 'Tour map', fn: showMenu }]);
}

// ============================================================ rendering
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

const spriteCache = new Map();
function tileSprite(t, ts) {
  const key = `${t.kind}|${t.color}|${t.special}|${ts}`;
  let c = spriteCache.get(key);
  if (c) return c;
  if (spriteCache.size > 400) spriteCache.clear();
  c = document.createElement('canvas');
  c.width = c.height = Math.ceil(ts * DPR);
  const x = c.getContext('2d'); x.scale(DPR, DPR);
  const p = ts * 0.07, w = ts - 2 * p, r = ts * 0.24;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (t.kind === 'drop') {
    const g = x.createRadialGradient(ts / 2, ts / 2, ts * 0.1, ts / 2, ts / 2, ts * 0.5);
    g.addColorStop(0, 'rgba(255,230,120,0.9)'); g.addColorStop(1, 'rgba(255,180,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, ts, ts);
    x.font = `${ts * 0.66}px ${EMOJI_FONT}`; x.fillText('📀', ts / 2, ts * 0.54);
  } else if (t.special === 'disco') {
    const g = x.createRadialGradient(ts * 0.4, ts * 0.35, ts * 0.05, ts / 2, ts / 2, ts * 0.5);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#d9defa'); g.addColorStop(1, '#6a6fa0');
    x.fillStyle = g; roundRect(x, p, p, w, w, r); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = ts * 0.04; x.stroke();
    x.font = `${ts * 0.62}px ${EMOJI_FONT}`; x.fillText('🪩', ts / 2, ts * 0.53);
  } else {
    const col = COLORS[t.color];
    const g = x.createLinearGradient(0, p, 0, ts - p);
    g.addColorStop(0, col.c1); g.addColorStop(1, col.c2);
    x.fillStyle = g; roundRect(x, p, p, w, w, r); x.fill();
    x.save(); roundRect(x, p, p, w, w, r); x.clip();
    if (t.special === 'lineH' || t.special === 'lineV') {
      x.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 3; i++) {
        const o = p + w * (0.2 + i * 0.3) - ts * 0.05;
        if (t.special === 'lineH') x.fillRect(p, o, w, ts * 0.1); else x.fillRect(o, p, ts * 0.1, w);
      }
    }
    if (t.special === 'bomb') {
      const rg = x.createRadialGradient(ts / 2, ts / 2, ts * 0.1, ts / 2, ts / 2, ts * 0.5);
      rg.addColorStop(0, 'rgba(255,255,255,0.65)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.fillRect(0, 0, ts, ts);
    }
    x.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(x, p + w * 0.1, p + w * 0.05, w * 0.8, w * 0.36, r * 0.8); x.fill();
    x.restore();
    x.strokeStyle = t.special ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    x.lineWidth = ts * (t.special ? 0.055 : 0.03); roundRect(x, p, p, w, w, r); x.stroke();
    x.font = `${ts * 0.52}px ${EMOJI_FONT}`;
    x.fillText(col.emoji, ts / 2, ts * 0.54);
    const badge = (emo, bx, by) => {
      x.fillStyle = 'rgba(20,6,40,0.85)'; x.beginPath(); x.arc(bx, by, ts * 0.17, 0, 7); x.fill();
      x.font = `${ts * 0.22}px ${EMOJI_FONT}`; x.fillText(emo, bx, by + ts * 0.01);
    };
    if (t.special === 'lineH' || t.special === 'lineV') {
      x.fillStyle = '#fff';
      const tri = (ax, ay, bx2, by2, cx, cy) => { x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx2, by2); x.lineTo(cx, cy); x.fill(); };
      const m = ts / 2, e = p + ts * 0.02, s = ts * 0.1;
      if (t.special === 'lineH') { tri(e, m, e + s, m - s, e + s, m + s); tri(ts - e, m, ts - e - s, m - s, ts - e - s, m + s); }
      else { tri(m, e, m - s, e + s, m + s, e + s); tri(m, ts - e, m - s, ts - e - s, m + s, ts - e - s); }
    }
    if (t.special === 'bomb') badge('💥', ts * 0.76, ts * 0.76);
    if (t.special === 'rocket') badge('🚀', ts * 0.76, ts * 0.24);
  }
  spriteCache.set(key, c);
  return c;
}

const noiseFrames = [];
function makeNoise() {
  for (let f = 0; f < 4; f++) {
    const c = document.createElement('canvas'); c.width = c.height = 24;
    const x = c.getContext('2d'), img = x.createImageData(24, 24);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 200 + 30; img.data[i] = v * 0.8; img.data[i + 1] = v * 0.8; img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0); noiseFrames.push(c);
  }
}

const CROWD = Array.from({ length: 26 }, (_, i) => ({ x: (i + Math.random() * 0.7) / 26, s: 0.75 + Math.random() * 0.5, ph: Math.random() * 6, row: i % 2, glow: Math.random() < 0.3 }));

function drawBackground() {
  const hue = G ? (G.def.hue != null ? G.def.hue : 280) : 280;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, `hsl(${hue},55%,14%)`); g.addColorStop(0.6, `hsl(${hue + 20},60%,7%)`); g.addColorStop(1, '#040109');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const hot = G && G.encore > 0;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const ox = VW * (i + 0.5) / 4, ang = Math.sin(clock * (0.35 + i * 0.12) * (hot ? 2.5 : 1) + i * 2) * 0.55;
    const h = hot ? (clock * 140 + i * 90) % 360 : [hue, hue + 50, hue - 80, 45][i];
    const len = VH * 1.15, sp = 0.17;
    ctx.beginPath(); ctx.moveTo(ox, -10);
    ctx.lineTo(ox + Math.sin(ang - sp) * len, Math.cos(ang - sp) * len);
    ctx.lineTo(ox + Math.sin(ang + sp) * len, Math.cos(ang + sp) * len); ctx.closePath();
    const lg = ctx.createLinearGradient(ox, 0, ox + Math.sin(ang) * len, Math.cos(ang) * len);
    lg.addColorStop(0, `hsla(${h},100%,70%,${hot ? 0.32 : 0.15})`); lg.addColorStop(1, `hsla(${h},100%,60%,0)`);
    ctx.fillStyle = lg; ctx.fill();
  }
  ctx.restore();
  // the crowd
  const energy = G ? (G.encore > 0 ? 1 : 0.15 + G.hype / 120) : 0.3;
  for (const c of CROWD) {
    const bob = Math.abs(Math.sin(clock * (2.5 + energy * 5) + c.ph)) * (3 + energy * 16) * c.s;
    const x = c.x * VW, r = 12 * c.s, y = VH - 10 * c.s - c.row * 12 - bob;
    ctx.fillStyle = c.row ? '#0c0520' : '#120830';
    if (energy > 0.75) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 5 * c.s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 1.6, y - r * 3); ctx.moveTo(x + r, y); ctx.lineTo(x + r * 1.6, y - r * 3); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y - r, r, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + r * 1.5, r * 1.6, r * 1.8, 0, 0, 7); ctx.fill();
    if (c.glow && energy > 0.4) { ctx.fillStyle = `hsla(${(c.ph * 60 + clock * 50) % 360},100%,65%,0.9)`; ctx.fillRect(x + r * 1.1, y - r * 3.4 - bob * 0.2, 3, 12); }
  }
}

function drawCell(x, y, cell) {
  const { ts, bx, by } = view, px = bx + x * ts, py = by + y * ts;
  if (cell.wall) {
    ctx.fillStyle = '#17121f'; roundRect(ctx, px + 2, py + 2, ts - 4, ts - 4, ts * 0.1); ctx.fill();
    ctx.strokeStyle = '#3a3346'; ctx.lineWidth = 2; ctx.stroke();
    for (const [cy, rr] of [[0.32, 0.16], [0.68, 0.22]]) {
      ctx.fillStyle = '#060409'; ctx.beginPath(); ctx.arc(px + ts / 2, py + ts * cy, ts * rr, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a4258'; ctx.lineWidth = ts * 0.03; ctx.stroke();
      ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.arc(px + ts / 2, py + ts * cy, ts * rr * 0.35, 0, 7); ctx.fill();
    }
    return;
  }
  ctx.fillStyle = (x + y) % 2 ? 'rgba(46,26,92,0.82)' : 'rgba(34,18,70,0.82)';
  ctx.fillRect(px, py, ts, ts);
  if (cell.jelly) {
    const a = cell.jelly === 2 ? 0.6 : 0.32, tw = 0.5 + 0.5 * Math.sin(clock * 3 + x + y * 1.7);
    ctx.fillStyle = `rgba(255,120,220,${a})`; roundRect(ctx, px + 2, py + 2, ts - 4, ts - 4, ts * 0.16); ctx.fill();
    ctx.strokeStyle = cell.jelly === 2 ? '#ffd1f6' : 'rgba(255,170,240,0.8)'; ctx.lineWidth = cell.jelly === 2 ? 3 : 1.5; ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.5})`;
    for (let i = 0; i < cell.jelly * 2; i++) { const sx = px + ts * (0.15 + ((i * 37 + x * 13) % 70) / 100), sy = py + ts * (0.15 + ((i * 53 + y * 7) % 70) / 100); ctx.fillRect(sx, sy, 2, 2); }
  }
}

function drawBlock(x, y, b) {
  const { ts, bx, by } = view, px = bx + x * ts, py = by + y * ts, p = ts * 0.06;
  const jig = b.hit > 0 ? (Math.random() - 0.5) * ts * 0.08 * b.hit : 0;
  ctx.save(); ctx.translate(jig, 0);
  if (b.type === 'crate') {
    const g = ctx.createLinearGradient(0, py, 0, py + ts); g.addColorStop(0, '#4a4f63'); g.addColorStop(1, '#262935');
    ctx.fillStyle = g; roundRect(ctx, px + p, py + p, ts - 2 * p, ts - 2 * p, ts * 0.1); ctx.fill();
    ctx.strokeStyle = '#a9b1c7'; ctx.lineWidth = ts * 0.05; ctx.stroke();
    ctx.fillStyle = '#c8cfdf'; const cs = ts * 0.16;
    for (const [cx, cy] of [[px + p, py + p], [px + ts - p - cs, py + p], [px + p, py + ts - p - cs], [px + ts - p - cs, py + ts - p - cs]]) ctx.fillRect(cx, cy, cs, cs);
    if (b.hp >= 2) { ctx.fillStyle = '#ffcc33'; ctx.fillRect(px + p, py + ts * 0.36, ts - 2 * p, ts * 0.1); ctx.fillRect(px + p, py + ts * 0.56, ts - 2 * p, ts * 0.1); }
    ctx.fillStyle = '#e9edf7'; ctx.font = `900 ${ts * 0.17}px ui-rounded, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.hp >= 2 ? '' : 'GEAR', px + ts / 2, py + ts / 2);
  } else {
    ctx.save(); roundRect(ctx, px + p, py + p, ts - 2 * p, ts - 2 * p, ts * 0.12); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseFrames[Math.floor(clock * 14 + x * 3 + y) % 4], px, py, ts, ts);
    ctx.fillStyle = 'rgba(80,40,160,0.35)'; ctx.fillRect(px, py, ts, ts);
    ctx.restore();
    ctx.strokeStyle = '#9d8cff'; ctx.lineWidth = 2; roundRect(ctx, px + p, py + p, ts - 2 * p, ts - 2 * p, ts * 0.12); ctx.stroke();
    ctx.font = `${ts * 0.36}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', px + ts / 2, py + ts / 2);
  }
  ctx.restore();
}

function drawTile(t, alpha = 1, scale = 1) {
  const { ts, bx, by } = view;
  let x = t.rx, y = t.ry, s = scale * (1 + t.pop * 0.35);
  const h = input.hint;
  if (h && input.idle > 5.5 && (t === h.a || t === h.b)) { s *= 1 + Math.sin(clock * 10) * 0.07; }
  if (input.sel && !G.busy && input.sel.x === t.x && input.sel.y === t.y && t.ad === 0) s *= 1.08 + Math.sin(clock * 8) * 0.03;
  if (t.special === 'bomb') s *= 1 + Math.sin(clock * 6 + t.id) * 0.04;
  const sq = t.squash * 0.14;
  const cx = bx + (x + 0.5) * ts, cy = by + (y + 0.5) * ts + sq * ts * 0.4;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy);
  if (t.special === 'disco') {
    ctx.save(); ctx.rotate(clock * 1.5); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.fillStyle = `hsla(${(i * 60 + clock * 120) % 360},100%,70%,0.35)`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ts * 0.75, -ts * 0.08); ctx.lineTo(ts * 0.75, ts * 0.08); ctx.fill(); }
    ctx.restore();
  }
  if (t.special === 'rocket') ctx.rotate(Math.sin(clock * 9 + t.id) * 0.06);
  ctx.scale(s * (1 + sq), s * (1 - sq));
  ctx.drawImage(tileSprite(t, ts), -ts / 2, -ts / 2, ts, ts);
  ctx.restore();
  if (t.lock) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    for (const [w, c] of [[ts * 0.13, '#1b2a33'], [ts * 0.06, '#5ee0ff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      ctx.moveTo(-ts * 0.42, -ts * 0.3); ctx.bezierCurveTo(-ts * 0.1, ts * 0.1, ts * 0.1, -ts * 0.2, ts * 0.42, ts * 0.3);
      ctx.moveTo(-ts * 0.42, ts * 0.3); ctx.bezierCurveTo(-ts * 0.1, -ts * 0.1, ts * 0.1, ts * 0.2, ts * 0.42, -ts * 0.3);
      ctx.stroke();
    }
    ctx.font = `${ts * 0.26}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔌', 0, 0);
    ctx.restore();
  }
}

function drawBoard() {
  const { ts, bx, by } = view;
  ctx.save();
  if (FX.shake > 0) ctx.translate((Math.random() - 0.5) * FX.shake * ts * 0.25, (Math.random() - 0.5) * FX.shake * ts * 0.25);
  // glow behind board
  ctx.save();
  ctx.shadowColor = G.encore > 0 ? `hsl(${(clock * 200) % 360},100%,60%)` : 'rgba(160,80,255,0.6)';
  ctx.shadowBlur = G.encore > 0 ? 36 : 22;
  ctx.fillStyle = 'rgba(20,10,40,0.9)';
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) if (!G.cells[y][x].hole) ctx.fillRect(bx + x * ts - 3, by + y * ts - 3, ts + 6, ts + 6);
  ctx.restore();
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) { const c = G.cells[y][x]; if (!c.hole || c.wall) drawCell(x, y, c); }
  // drop exits
  if (G.goals.some(g => g.type === 'drop')) {
    ctx.fillStyle = `rgba(255,216,79,${0.5 + Math.sin(clock * 5) * 0.3})`; ctx.font = `900 ${ts * 0.3}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) { const c = G.cells[y][x]; if (!c.hole && (y + 1 >= G.H || (G.cells[y + 1][x].hole && !G.cells[y + 1][x].wall))) ctx.fillText('▼', bx + (x + 0.5) * ts, by + (y + 1) * ts + ts * 0.12); }
  }
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, ts * G.W, ts * G.H); ctx.clip();
  eachTile(t => drawTile(t));
  for (const d of FX.dying) { const p = d.life / d.max; drawTile(d.t, p, 0.3 + p * 0.8); }
  ctx.restore();
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) { const b = G.cells[y][x].block; if (b) drawBlock(x, y, b); }
  if (input.sel && !G.busy) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
    roundRect(ctx, bx + input.sel.x * ts + 2, by + input.sel.y * ts + 2, ts - 4, ts - 4, ts * 0.22); ctx.stroke(); ctx.shadowBlur = 0;
  }
  drawFX();
  ctx.restore();
}

function drawFX() {
  const { ts, bx, by } = view;
  const X = v => bx + v * ts, Y = v => by + v * ts;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of FX.beams) {
    const p = b.life / b.max, w = ts * (0.25 + 0.6 * p);
    const g = b.dir === 'h' ? ctx.createLinearGradient(0, Y(b.y + 0.5) - w, 0, Y(b.y + 0.5) + w) : ctx.createLinearGradient(X(b.x + 0.5) - w, 0, X(b.x + 0.5) + w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${p})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    if (b.dir === 'h') ctx.fillRect(X(-0.5), Y(b.y + 0.5) - w, ts * (G.W + 1), w * 2); else ctx.fillRect(X(b.x + 0.5) - w, Y(-0.5), w * 2, ts * (G.H + 1));
    ctx.fillStyle = b.color; ctx.globalAlpha = p * 0.6;
    if (b.dir === 'h') ctx.fillRect(X(0), Y(b.y + 0.5) - w * 0.25, ts * G.W, w * 0.5); else ctx.fillRect(X(b.x + 0.5) - w * 0.25, Y(0), w * 0.5, ts * G.H);
    ctx.globalAlpha = 1;
  }
  for (const r of FX.rings) {
    const p = 1 - r.life / r.max;
    ctx.strokeStyle = `rgba(255,200,120,${1 - p})`; ctx.lineWidth = ts * 0.3 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), ts * r.r * (0.3 + p), 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(255,240,200,${(1 - p) * 0.35})`; ctx.fill();
  }
  for (const z of FX.zaps) {
    const p = z.life / z.max;
    ctx.strokeStyle = z.color; ctx.lineWidth = 3 * p + 1; ctx.globalAlpha = p;
    ctx.beginPath(); ctx.moveTo(X(z.x0), Y(z.y0));
    for (let i = 1; i <= 6; i++) { const f = i / 6, jx = i < 6 ? (Math.random() - 0.5) * 0.4 : 0, jy = i < 6 ? (Math.random() - 0.5) * 0.4 : 0; ctx.lineTo(X(z.x0 + (z.x1 - z.x0) * f + jx), Y(z.y0 + (z.y1 - z.y0) * f + jy)); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const p of FX.parts) {
    const a = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, a * 1.5);
    if (p.conf) { ctx.save(); ctx.translate(X(p.x), Y(p.y)); ctx.rotate(p.rot); ctx.fillRect(-ts * 0.06, -ts * 0.03, ts * 0.12, ts * 0.06); ctx.restore(); }
    else if (p.star) { const s = ts * p.size; ctx.fillRect(X(p.x) - s, Y(p.y) - 1, s * 2, 2); ctx.fillRect(X(p.x) - 1, Y(p.y) - s, 2, s * 2); }
    else { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), ts * p.size, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  for (const r of FX.rockets) {
    const p = Math.min(1, r.t / r.dur), e = p * p * (3 - 2 * p);
    const x = r.x0 + (r.x1 - r.x0) * e, y = r.y0 + (r.y1 - r.y0) * e - Math.sin(p * Math.PI) * 1.4;
    const nx = r.x0 + (r.x1 - r.x0) * Math.min(1, e + 0.05), ny = r.y0 + (r.y1 - r.y0) * Math.min(1, e + 0.05) - Math.sin(Math.min(1, p + 0.05) * Math.PI) * 1.4;
    ctx.save(); ctx.translate(X(x + 0.5), Y(y + 0.5)); ctx.rotate(Math.atan2(ny - y, nx - x) + Math.PI / 4);
    ctx.font = `${ts * 0.6}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🚀', 0, 0);
    if (r.carry) { ctx.font = `${ts * 0.32}px ${EMOJI_FONT}`; ctx.fillText(SPECIAL_ICON[r.carry] || '✨', -ts * 0.3, ts * 0.3); }
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of FX.texts) {
    const a = Math.min(1, t.life * 2.5);
    ctx.globalAlpha = a; ctx.font = `900 ${ts * t.size}px ui-rounded, "SF Pro Rounded", system-ui`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,0,40,0.8)'; ctx.strokeText(t.text, X(t.x), Y(t.y));
    ctx.fillStyle = t.color; ctx.fillText(t.text, X(t.x), Y(t.y));
  }
  ctx.globalAlpha = 1;
  const c = FX.callout;
  if (c) {
    const p = 1 - c.life / c.max, s = p < 0.15 ? EASE.back(p / 0.15) : 1, a = c.life < 0.35 ? c.life / 0.35 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(bx + ts * G.W / 2, by + ts * G.H * 0.42 - p * ts * 0.6); ctx.rotate(-0.06); ctx.scale(s, s);
    const size = Math.min(ts * 1.05, (ts * G.W * 1.6) / Math.max(6, c.text.length));
    ctx.font = `900 ${size}px ui-rounded, "SF Pro Rounded", system-ui`;
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#1a0533'; ctx.lineJoin = 'round'; ctx.strokeText(c.text, 0, 0);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff'); g.addColorStop(1, c.color);
    ctx.fillStyle = g; ctx.shadowColor = c.color; ctx.shadowBlur = 20; ctx.fillText(c.text, 0, 0);
    ctx.restore();
  }
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  if (G) drawBoard();
  if (FX.flash > 0) { ctx.globalAlpha = Math.min(0.6, FX.flash); ctx.fillStyle = FX.flashColor; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
}

function update(dt) {
  clock += dt;
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w.t != null) { w.t -= dt; if (w.t <= 0) { waiters.splice(i, 1); w.r(); } }
    else if (w.cond()) { waiters.splice(i, 1); w.r(); }
  }
  if (G) {
    eachTile(t => {
      if (t.ad > 0) {
        t.at += dt; const p = Math.min(1, t.at / t.ad), e = EASE[t.ease](p);
        t.rx = t.ax + (t.bx - t.ax) * e; t.ry = t.ay + (t.by - t.ay) * e;
        if (p >= 1) { t.ad = 0; t.rx = t.bx; t.ry = t.by; if (t.ease === 'fall') t.squash = 1; }
      }
      if (t.squash > 0) t.squash = Math.max(0, t.squash - dt * 6);
      if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 3);
    });
    for (const r of G.cells) for (const c of r) if (c.block && c.block.hit > 0) c.block.hit = Math.max(0, c.block.hit - dt * 5);
    if (!G.busy && !G.over && !G.paused) {
      input.idle += dt;
      if (input.idle > 5 && !input.hint) input.hint = findMove();
    }
    if (G.mode === 'jam' && G.started && !G.paused && !G.over) {
      G.timeLeft -= dt;
      const el = $('#moves'); const v = String(Math.max(0, Math.ceil(G.timeLeft))); if (el.textContent !== v) el.textContent = v;
      if (G.timeLeft <= 0 && !G.busy) endJam();
    }
  }
  for (const d of FX.dying) { d.life -= dt; if (d.tx != null) { d.t.rx += (d.tx - d.t.rx) * Math.min(1, dt * 14); d.t.ry += (d.ty - d.t.ry) * Math.min(1, dt * 14); } }
  for (const p of FX.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.rot != null) p.rot += p.vr * dt; }
  for (const t of FX.texts) { t.life -= dt; t.y -= dt * 0.9; }
  for (const arr of [FX.beams, FX.rings, FX.zaps]) for (const b of arr) b.life -= dt;
  for (const r of FX.rockets) {
    r.t += dt;
    const p = Math.min(1, r.t / r.dur), e = p * p * (3 - 2 * p);
    FX.parts.push({ x: r.x0 + (r.x1 - r.x0) * e + 0.5, y: r.y0 + (r.y1 - r.y0) * e - Math.sin(p * Math.PI) * 1.4 + 0.5, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 0.35, max: 0.35, color: pick(['#ffcf6b', '#ff7a3d', '#fff']), size: 0.07, g: 0 });
  }
  const alive = o => o.life > 0;
  FX.dying = FX.dying.filter(alive); FX.parts = FX.parts.filter(alive); FX.texts = FX.texts.filter(alive);
  FX.beams = FX.beams.filter(alive); FX.rings = FX.rings.filter(alive); FX.zaps = FX.zaps.filter(alive);
  FX.rockets = FX.rockets.filter(r => r.t < r.dur);
  if (FX.parts.length > 900) FX.parts.splice(0, FX.parts.length - 900);
  if (FX.callout) { FX.callout.life -= dt; if (FX.callout.life <= 0) FX.callout = null; }
  FX.shake = Math.max(0, FX.shake - dt * 3); FX.flash = Math.max(0, FX.flash - dt * 1.5);
  if (G) updateHype();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}

function layout() {
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  if (!G) return;
  const hud = $('#hud').getBoundingClientRect(), bot = $('#boosters').getBoundingClientRect();
  const top = hud.bottom + 10, bottom = bot.top - 22;
  const ts = Math.floor(Math.min((VW - 24) / G.W, (bottom - top) / G.H, 72));
  if (ts !== view.ts) spriteCache.clear();
  view.ts = ts; view.bx = Math.round((VW - ts * G.W) / 2); view.by = Math.round(top + (bottom - top - ts * G.H) / 2);
}

// ============================================================ HUD
function goalIcon(g) {
  switch (g.type) {
    case 'collect': { const c = COLORS[g.color]; return `<span class="gem" style="background:linear-gradient(${c.c1},${c.c2})">${c.emoji}</span>`; }
    case 'jelly': return '<span class="gi glitter">✨</span>';
    case 'crate': return '<span class="gi case">🧳</span>';
    case 'lock': return '<span class="gi">🔌</span>';
    case 'static': return '<span class="gi">⚡</span>';
    case 'drop': return '<span class="gi">📀</span>';
    case 'make': return `<span class="gi">${SPECIAL_ICON[g.special]}</span>`;
    case 'score': return '<span class="gi">🎯</span>';
  }
  return '';
}
function goalChip(g) {
  const rem = G ? goalRemaining(g) : g.need;
  const label = g.type === 'score' ? (rem ? fmt(g.need >= 1000 ? g.need / 1000 : g.need) + (g.need >= 1000 ? 'k' : '') : '') : rem;
  return `<div class="goal ${rem === 0 ? 'done' : ''}">${goalIcon(g)}<span class="gn">${rem === 0 ? '✓' : label}</span></div>`;
}
const GOAL_TEXT = {
  collect: g => `Collect ${g.need} ${COLORS[g.color].emoji}`, jelly: () => 'Sweep up all the ✨ glitter', crate: () => 'Smash every 🧳 flight case',
  lock: () => 'Cut all 🔌 cables', static: () => 'Clear all ⚡ static', drop: g => `Bring down ${g.need} 📀 records`,
  make: g => `Create ${g.need} ${SPECIAL_ICON[g.special]} ${{ disco: 'disco balls', bomb: 'pyro bombs', rocket: 'rockets', line: 'lasers' }[g.special]}`,
  score: g => `Score ${fmt(g.need)} points`,
};

let hudCache = '';
function updateHUD() {
  if (!G) return;
  const jam = G.mode === 'jam';
  $('#moves-lbl').textContent = jam ? 'TIME' : 'MOVES';
  $('#moves').textContent = jam ? Math.max(0, Math.ceil(G.timeLeft)) : G.moves;
  $('.moves').classList.toggle('low', !jam && G.moves <= 5);
  $('#score').textContent = fmt(G.score);
  const [s1, s2, s3] = G.stars;
  $('#star-fill').style.width = Math.min(100, (G.score / s3) * 100) + '%';
  [s1, s2, s3].forEach((s, i) => { const m = $('#m' + (i + 1)); m.style.left = (s / s3) * 100 + '%'; m.classList.toggle('lit', G.score >= s); });
  const html = jam ? '<div class="goal"><span class="gi">🔥</span><span class="gn">Score!</span></div>' : G.goals.map(goalChip).join('');
  if (html !== hudCache) { $('#goals').innerHTML = html; hudCache = html; }
  updateHype();
}
function updateHype() {
  const f = $('#hype-fill'), v = G.encore > 0 ? 100 : G.hype;
  if (f.dataset.v == v) return;
  f.dataset.v = v; f.style.width = v + '%';
  f.classList.toggle('on', G.encore > 0);
  $('#encore-badge').classList.toggle('hidden', !(G.encore > 0));
  $('#encore-badge').textContent = `ENCORE ×2 · ${G.encore}`;
}
function updateBoosterUI() {
  document.querySelectorAll('.booster').forEach(el => {
    const b = el.dataset.b, n = Save.data.boosters[b] || 0;
    el.querySelector('.ct').textContent = n;
    el.classList.toggle('empty', n <= 0);
    el.classList.toggle('armed', input.booster === b);
  });
}

// ============================================================ screens
function modal(html, buttons = []) {
  const card = $('#modal-card');
  card.innerHTML = html + '<div class="btns"></div>';
  const box = card.querySelector('.btns');
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || ''); el.innerHTML = b.label;
    el.onclick = () => { Sfx.init(); Sfx.click(); b.fn(); };
    box.append(el);
  }
  $('#modal').classList.remove('hidden');
  if (G) G.paused = true;
}
function hideModal() { $('#modal').classList.add('hidden'); if (G) G.paused = false; }

function showMenu() {
  hideModal(); G = null; waiters.length = 0;   // abandon any in-flight animation chains of the old gig input.booster = null; input.sel = null;
  FX.parts = []; FX.texts = []; FX.callout = null;
  $('#play').classList.add('hidden'); $('#menu').classList.remove('hidden');
  buildTour();
}

function buildTour() {
  const el = $('#tour'); el.innerHTML = '';
  const highest = Save.highest();
  const lastVenue = Math.floor(highest / LEVELS_PER_VENUE) + 1;
  for (let v = 0; v < Math.max(2, lastVenue + 1); v++) {
    const venue = VENUES[v % VENUES.length], loop = Math.floor(v / VENUES.length);
    const sec = document.createElement('section'); sec.className = 'venue'; sec.style.setProperty('--hue', venue.hue);
    const first = v * LEVELS_PER_VENUE + 1, last = first + LEVELS_PER_VENUE - 1;
    const locked = first > highest + 1;
    sec.innerHTML = `<div class="venue-head"><span class="ve">${venue.emoji}</span><div><b>${venue.name}${loop ? ' ' + 'I'.repeat(loop + 1) : ''}</b><small>${locked ? '🔒 Clear gig ' + (first - 1) + ' to unlock' : venue.city}</small></div><span class="vr">${first}–${last}</span></div><div class="nodes"></div>`;
    const nodes = sec.querySelector('.nodes');
    for (let n = first; n <= last; n++) {
      const st = Save.data.stars[n] || 0, open = n <= highest + 1;
      const b = document.createElement('button');
      b.className = 'node' + (open ? '' : ' locked') + (st ? ' cleared' : '') + (n === highest + 1 ? ' current' : '') + (n % 10 === 0 ? ' boss' : '');
      b.innerHTML = `<span class="n">${open ? n : '🔒'}</span><span class="st">${open ? '★'.repeat(st) + '<i>' + '★'.repeat(3 - st) + '</i>' : ''}</span>`;
      if (open) b.onclick = () => { Sfx.init(); Sfx.click(); openGig(n); };
      nodes.append(b);
    }
    el.append(sec);
  }
  const today = dailyLevel(), ds = Save.data.daily[today.daily] || 0;
  $('#daily-sub').textContent = ds ? `Today: ${'★'.repeat(ds)} — come back tomorrow!` : 'A fresh generated stage, every day';
  $('#jam-sub').textContent = Save.data.jamBest ? `60s blitz · best ${fmt(Save.data.jamBest)}` : '60-second score blitz';
  $('#continue').textContent = `▶ Play gig ${highest + 1}`;
  requestAnimationFrame(() => { const cur = el.querySelector('.current'); if (cur) cur.scrollIntoView({ block: 'center' }); });
}

function introHTML(def, title) {
  const goals = def.goals.map(g => `<li>${goalIcon({ ...g, need: g.n })}<span>${GOAL_TEXT[g.type]({ ...g, need: g.n })}</span></li>`).join('');
  return `<div class="kicker">${title}</div><h2>${def.name}</h2>
    <ul class="goal-list">${goals}</ul>
    <div class="meta"><span>🎵 ${def.moves} moves</span><span>${def.colors === 6 ? '6 instruments' : '5 instruments'}</span>${def.seed != null ? `<span>🌱 seed ${def.seed}</span>` : ''}</div>
    ${def.tip ? `<p class="tip">${def.tip}</p>` : ''}`;
}

function openGig(n) {
  const def = getLevel(n);
  def.hue = venueOf(n).hue;
  const best = Save.data.best[n];
  modal(introHTML(def, `${venueOf(n).emoji} ${venueOf(n).name} · Gig ${n}${def.boss ? ' · 👑 HEADLINER' : ''}`) + (best ? `<p class="sub">Best: ${fmt(best)}</p>` : ''),
    [{ label: '▶ Rock on!', cls: 'primary', fn: () => startGig(def, 'level') }, { label: 'Back', fn: hideModal }]);
}

function openDaily() {
  const def = dailyLevel(); def.hue = 40;
  const d = String(def.daily);
  modal(introHTML(def, `🎲 Daily Gig · ${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`), [{ label: '▶ Play today\'s gig', cls: 'primary', fn: () => startGig(def, 'level') }, { label: 'Back', fn: hideModal }]);
}

function jamDef() {
  return { name: 'Jam Session', moves: 0, time: 60, colors: 5, goals: [], stars: [8000, 16000, 26000], hue: 330, map: Array(8).fill('........') };
}

function startGig(def, mode) {
  hideModal();
  $('#menu').classList.add('hidden'); $('#play').classList.remove('hidden');
  FX.parts = []; FX.texts = []; FX.dying = []; FX.callout = null; FX.beams = []; FX.rockets = [];
  input.sel = null; input.booster = null; input.hint = null; input.idle = 0; hudCache = '';
  waiters.length = 0;   // abandon any in-flight animation chains of the old gig
  G = buildGame(def, mode);
  $('#level-title').textContent = mode === 'jam' ? '⏱ Jam Session' : def.daily ? '🎲 Daily Gig' : `Gig ${def.n} · ${def.name}`;
  layout(); fillBoard(); updateHUD(); updateBoosterUI();
  settle().then(() => {
    if (G.def !== def) return;
    G.busy = false; G.started = true;
    callout(mode === 'jam' ? 'GO GO GO!' : "LET'S ROCK!", '#4ff3ff');
  });
}

function showWin(stars, reward) {
  const d = G.def, next = d.n ? d.n + 1 : null;
  const names = { hammer: '🥁 Drumstick', pyro: '💥 Pyro', shuffle: '🔀 Remix', moves: '⏱ +5 Moves' };
  const html = `<h2 class="win">${['', 'Good show!', 'Great gig!', 'LEGENDARY!'][stars]}</h2>
    <div class="stars">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.25}s">★</span>`).join('')}</div>
    <div class="big-score">${fmt(G.score)}</div>
    ${reward ? `<p class="reward">🎁 Fan gift: <b>${names[reward]}</b>${stars === 3 ? ' ×2' : ''}</p>` : ''}`;
  const btns = [];
  if (next) btns.push({ label: `Next: Gig ${next} ▶`, cls: 'primary', fn: () => { openGig(next); } });
  btns.push({ label: '↻ Replay', cls: next ? '' : 'primary', fn: () => startGig(d, 'level') });
  btns.push({ label: 'Tour map', fn: showMenu });
  modal(html, btns);
  for (let i = 1; i <= stars; i++) setTimeout(() => Sfx.star(i), 250 * i + 150);
}

function pauseMenu() {
  if (!G || G.over) return;
  modal(`<h2>Paused</h2>${HOWTO}`, [
    { label: '▶ Resume', cls: 'primary', fn: hideModal },
    { label: '↻ Restart', fn: () => startGig(G.def, G.mode) },
    { label: 'Tour map', fn: showMenu },
  ]);
}

const HOWTO = `<div class="howto">
  <div><b>Match 4 in a line</b><span>🔦 Laser: clears a row or column (follow the stripes)</span></div>
  <div><b>Match a 2×2 square</b><span>🚀 Rocket: hits around itself, then flies to what you still need</span></div>
  <div><b>Match an L or T</b><span>💥 Pyro: a big blast</span></div>
  <div><b>Match 5 in a line</b><span>🪩 Disco ball: swap it to clear one colour</span></div>
  <div><b>Swap two specials</b><span>🔦+🔦 cross · 🔦+💥 triple cross · 💥+💥 mega blast · 🚀+any: rocket delivers it · 🪩+any: every tile of that colour turns into that special · 🪩+🪩 clears the stage</span></div>
  <div><b>Tap a special twice</b><span>Fires it where it stands (costs a move)</span></div>
  <div><b>HYPE meter</b><span>Fill it with cascades for ENCORE MODE: double points for 3 moves and free specials</span></div>
</div>`;

// ============================================================ input
function cellAt(e) {
  const x = Math.floor((e.clientX - view.bx) / view.ts), y = Math.floor((e.clientY - view.by) / view.ts);
  if (!G || x < 0 || y < 0 || x >= G.W || y >= G.H || G.cells[y][x].hole) return null;
  return [x, y];
}
function bindInput() {
  canvas.addEventListener('pointerdown', e => {
    Sfx.init();
    if (!G || G.busy || G.over || G.paused) return;
    const c = cellAt(e); if (!c) { input.sel = null; return; }
    input.idle = 0; input.hint = null;
    if (input.booster) { applyBooster(c[0], c[1]); return; }
    input.down = { x: c[0], y: c[1], px: e.clientX, py: e.clientY };
  });
  window.addEventListener('pointermove', e => {
    const d = input.down; if (!d || !G || G.busy) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py, th = view.ts * 0.35;
    if (Math.abs(dx) > th || Math.abs(dy) > th) {
      const [ox, oy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      input.down = null; input.sel = null;
      trySwap(d.x, d.y, d.x + ox, d.y + oy);
    }
  });
  window.addEventListener('pointerup', e => {
    const d = input.down; input.down = null;
    if (!d || !G || G.busy) return;
    const c = cellAt(e); if (!c || c[0] !== d.x || c[1] !== d.y) return;
    const s = input.sel;
    if (s && s.x === d.x && s.y === d.y) {
      const t = G.grid[d.y][d.x]; input.sel = null;
      if (t && t.special && !t.lock) fireSpecial(t);
      return;
    }
    if (s && Math.abs(s.x - d.x) + Math.abs(s.y - d.y) === 1) { input.sel = null; trySwap(s.x, s.y, d.x, d.y); return; }
    input.sel = { x: d.x, y: d.y }; Sfx.click();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden') && G && !G.over) hideModal(); else if (G) pauseMenu(); }
    if (e.key === 'm') toggleMute();
  });
  window.addEventListener('resize', layout);
  $('#btn-pause').onclick = () => { Sfx.click(); pauseMenu(); };
  $('#btn-mute').onclick = toggleMute;
  $('#btn-daily').onclick = () => { Sfx.init(); Sfx.click(); openDaily(); };
  $('#btn-jam').onclick = () => { Sfx.init(); Sfx.click(); startGig(jamDef(), 'jam'); };
  $('#continue').onclick = () => { Sfx.init(); Sfx.click(); openGig(Save.highest() + 1); };
  $('#btn-howto').onclick = () => { Sfx.init(); Sfx.click(); modal(`<h2>How to rock</h2>${HOWTO}`, [{ label: 'Got it', cls: 'primary', fn: hideModal }]); };
  document.querySelectorAll('.booster').forEach(el => { el.onclick = () => armBooster(el.dataset.b); });
}
function toggleMute() {
  Save.data.muted = !Save.data.muted; Save.write();
  $('#btn-mute').textContent = Save.data.muted ? '🔇' : '🔊';
}

// ============================================================ boot
function boot() {
  Save.load();
  canvas = $('#game'); ctx = canvas.getContext('2d');
  makeNoise(); bindInput(); layout();
  $('#btn-mute').textContent = Save.data.muted ? '🔇' : '🔊';
  showMenu();
  requestAnimationFrame(frame);
}
boot();
