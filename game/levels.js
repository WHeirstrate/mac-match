'use strict';
/*
  Map legend
    '.' normal tile          '#' off-board (empty)       'W' speaker stack wall (unbreakable)
    'j' glitter (1 layer)    'J' glitter (2 layers)
    'c' flight case (1 hit)  'C' reinforced case (2 hits) 'x' flight case sitting on glitter
    'L' cabled tile          'l' cabled tile on glitter
    's' static (spreads!)    'd' golden record (bring it down)

  Goal types: score, collect (color), jelly, crate, lock, static, drop, make (special)
  Colors: 0 🎸  1 🥁  2 🎹  3 🎤  4 🎺  5 🎷
*/

const VENUES = [
  { name: 'The Garage',      city: 'Where it all began',       emoji: '🏚️', hue: 280 },
  { name: 'Neon Club',       city: 'Downtown, 2 AM',            emoji: '🪩', hue: 320 },
  { name: 'Festival Fields', city: 'Mud, sun & 40,000 fans',    emoji: '🎪', hue: 140 },
  { name: 'Harbor Pier',     city: 'Sunset set by the sea',     emoji: '⚓', hue: 195 },
  { name: 'Mega Arena',      city: 'Sold out, three nights',    emoji: '🏟️', hue: 210 },
  { name: 'Desert Rave',     city: 'Bass under the stars',      emoji: '🌵', hue: 30 },
  { name: 'Tokyo Dome',      city: 'Glowsticks everywhere',     emoji: '🗼', hue: 350 },
  { name: 'Glacier Hall',    city: 'Ice-cold riffs',            emoji: '🧊', hue: 185 },
  { name: 'Volcano Stage',   city: 'Literally on fire',         emoji: '🌋', hue: 12 },
  { name: 'Moon Stadium',    city: 'One small step for rock',   emoji: '🌕', hue: 50 },
  { name: 'Orbit Station',   city: 'Zero-G mosh pit',           emoji: '🛰️', hue: 260 },
  { name: 'The Multiverse',  city: 'Every encore, at once',     emoji: '🌌', hue: 300 },
];

const LEVELS_PER_VENUE = 10;
const venueOf = n => VENUES[Math.floor((n - 1) / LEVELS_PER_VENUE) % VENUES.length];

// ---------------------------------------------------------------- hand-made tutorial gigs
const HANDMADE = {
  1: { name: 'First Riff', moves: 20, colors: 5, goals: [{ type: 'score', n: 2500 }],
       tip: 'Swap two neighbours to line up 3 of a kind. Line up <b>4</b> for a <b>LASER</b> that clears a whole line!',
       map: ['........', '........', '........', '........', '........', '........', '........', '........'] },
  2: { name: 'Sound Check', moves: 22, colors: 5, goals: [{ type: 'collect', color: 0, n: 20 }, { type: 'collect', color: 2, n: 20 }],
       tip: 'Make a <b>2×2 square</b> to build a <b>ROCKET</b> 🚀. It flies straight to whatever you still need.',
       map: ['........', '........', '........', '........', '........', '........', '........', '........'] },
  3: { name: 'Glitter Floor', moves: 25, colors: 5, goals: [{ type: 'jelly' }],
       tip: 'Clear tiles on top of ✨ <b>glitter</b> to sweep it up. Bright glitter takes two hits.',
       map: ['........', '.jjjjjj.', '.jJJJJj.', '.jJ..Jj.', '.jJ..Jj.', '.jJJJJj.', '.jjjjjj.', '........'] },
  4: { name: 'Gear Cases', moves: 25, colors: 5, goals: [{ type: 'crate' }],
       tip: 'Match <b>next to</b> flight cases to smash them. An <b>L or T shape</b> makes a <b>PYRO</b> 💥 bomb!',
       map: ['........', '........', '........', '..c..c..', '.cc..cc.', '........', 'ccc..ccc', 'cccccccc'] },
  5: { name: 'Disco Inferno', moves: 25, colors: 5, goals: [{ type: 'make', special: 'disco', n: 2 }, { type: 'score', n: 6000 }],
       tip: 'Line up <b>5</b> for a <b>DISCO BALL</b> 🪩. Swap it with a tile to blast every tile of that colour. Tap a special twice to fire it in place.',
       map: ['#......#', '........', '........', '........', '........', '........', '........', '#......#'] },
  6: { name: 'Golden Records', moves: 25, colors: 5, goals: [{ type: 'drop', n: 3 }],
       tip: 'Bring the 📀 <b>golden records</b> all the way down to the bottom.',
       map: ['d......d', '........', '........', '........', '........', '........', '#......#', '##....##'] },
  7: { name: 'Tangled Cables', moves: 22, colors: 5, goals: [{ type: 'lock' }],
       tip: 'Cabled tiles can\'t be moved. Match them or blast them to cut them loose.',
       map: ['........', '........', 'LLL..LLL', '........', '........', '..LLLL..', '........', 'L......L'] },
  8: { name: 'Feedback Loop', moves: 24, colors: 5, goals: [{ type: 'static' }],
       tip: '⚡ <b>Static</b> spreads every turn you don\'t zap some. 🔈 Speaker stacks can\'t be broken, so play around them. From here on, every gig is generated from its number.',
       map: ['........', '........', '..W..W..', '........', '........', '...ss...', '..ssss..', '.ssssss.'] },
};

// ---------------------------------------------------------------- seeded RNG
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const NAME_A = ['Electric', 'Midnight', 'Velvet', 'Neon', 'Thunder', 'Cosmic', 'Wild', 'Golden', 'Crimson', 'Silent', 'Feral', 'Lunar', 'Hyper', 'Static', 'Crystal', 'Burning', 'Rebel', 'Funky', 'Dizzy', 'Groovy'];
const NAME_B = ['Avenue', 'Riff', 'Encore', 'Anthem', 'Fever', 'Drop', 'Ballad', 'Overdrive', 'Echo', 'Jam', 'Solo', 'Crowd', 'Spotlight', 'Feedback', 'Groove', 'Chorus', 'Breakdown', 'Pulse', 'Uproar', 'Riot'];

// ---------------------------------------------------------------- procedural gigs
function generateLevel(n, opts = {}) {
  const R = mulberry32(opts.seed != null ? opts.seed : (Math.imul(n, 2654435761) ^ 0x5EED));
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const rp = arr => arr[Math.floor(R() * arr.length)];
  const chance = p => R() < p;

  const tier = Math.min(1, Math.max(0, (n - 8) / 70));           // 0 → 1 over ~70 gigs
  const boss = n % 10 === 0, hard = n % 5 === 0;
  const W = n < 14 ? 8 : rp([7, 8, 8, 9, 9]);
  const H = n < 14 ? 8 : rp([8, 8, 9, 9]);
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const quad = chance(0.3);
  const set = (x, y, ch) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    g[y][x] = ch; g[y][W - 1 - x] = ch;
    if (quad) { g[H - 1 - y][x] = ch; g[H - 1 - y][W - 1 - x] = ch; }
  };
  const get = (x, y) => (g[y] && g[y][x]) || '#';
  const half = Math.ceil(W / 2);

  // 1. board outline
  const shape = rp(['rect', 'corners', 'diamond', 'notch', 'bites', 'hourglass', 'pit', 'cross', 'stairs', 'castle', 'rect', 'corners']);
  switch (shape) {
    case 'corners': { const k = ri(1, 2); for (let y = 0; y < k; y++) for (let x = 0; x < k - y; x++) { set(x, y, '#'); set(x, H - 1 - y, '#'); } break; }
    case 'diamond': { const k = ri(2, 3); for (let y = 0; y < k; y++) for (let x = 0; x < k - y; x++) { set(x, y, '#'); set(x, H - 1 - y, '#'); } break; }
    case 'notch': { const m = Math.floor(W / 2) - 1; set(m, H - 1, '#'); if (chance(0.5)) set(m, 0, '#'); if (chance(0.5)) { set(0, Math.floor(H / 2), '#'); set(0, Math.floor(H / 2) - 1, '#'); } break; }
    case 'bites': for (let i = ri(2, 4); i > 0; i--) { const side = ri(0, 2); if (side === 0) set(0, ri(1, H - 2), '#'); else if (side === 1) set(ri(0, half - 1), H - 1, '#'); else set(ri(0, half - 1), 0, '#'); } break;
    case 'hourglass': { const m = Math.floor(H / 2); for (let y = m - 1; y <= m; y++) { set(0, y, '#'); if (chance(0.6)) set(1, y, '#'); } break; }
    case 'pit': { const cx = Math.floor(W / 2) - 1, cy = Math.floor(H / 2) - 1; set(cx, cy, '#'); set(cx, cy + 1, '#'); if (W % 2) { set(cx + 1, cy, '#'); set(cx + 1, cy + 1, '#'); } break; }
    case 'cross': { const k = W >= 9 ? 3 : 2; for (let y = 0; y < 2; y++) for (let x = 0; x < k; x++) { set(x, y, '#'); set(x, H - 1 - y, '#'); } break; }
    case 'stairs': for (let x = 0; x < half - 1; x++) for (let y = 0; y < half - 1 - x; y++) set(x, H - 1 - y, '#'); break;
    case 'castle': for (let x = 0; x < W; x += 2) set(x, 0, '#'); break;
  }

  // 2. unbreakable speaker-stack walls
  const wallCount = n < 12 ? ri(0, 1) : ri(0, 2 + Math.round(tier * 2));
  const wallPattern = rp(['pillars', 'scatter', 'center', 'shelf']);
  for (let i = 0; i < wallCount; i++) {
    if (wallPattern === 'pillars') { const x = ri(1, half - 1), y = ri(2, H - 3); set(x, y, 'W'); if (chance(0.5)) set(x, y + 1, 'W'); }
    else if (wallPattern === 'center') { const y = ri(2, H - 3); set(Math.floor((W - 1) / 2), y, 'W'); }
    else if (wallPattern === 'shelf') { const y = ri(3, H - 3); const x = ri(0, half - 2); set(x, y, 'W'); set(x + 1, y, 'W'); }
    else set(ri(0, half - 1), ri(1, H - 2), 'W');
  }

  // 3. tidy: remove cells with no playable neighbours
  const playable = (x, y) => !'#W'.includes(get(x, y));
  for (let pass = 0; pass < 2; pass++)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (playable(x, y) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => playable(x + dx, y + dy))) g[y][x] = '#';
  let cellCount = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (playable(x, y)) cellCount++;
  if (cellCount < W * H * 0.6) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y][x] = '.';

  // 4. goals & obstacles
  const unlocked = ['jelly', 'crate', 'collect', 'lock', 'static', 'drop', 'make', 'jelly', 'crate'];
  const goalCount = 1 + (n > 12 && chance(0.55 + tier * 0.3) ? 1 : 0) + (boss && n > 25 ? 1 : 0);
  const types = [];
  while (types.length < goalCount) { const t = rp(unlocked); if (!types.includes(t)) types.push(t); }
  if (opts.force) types.splice(0, types.length, ...opts.force);

  const free = (x, y) => get(x, y) === '.';
  const each = fn => { for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) fn(x, y); };
  const goals = [];
  let work = 0;
  const pDouble = 0.15 + tier * 0.55;

  for (const type of types) {
    if (type === 'jelly') {
      const pat = rp(['fill', 'ring', 'center', 'checker', 'stripes', 'bottom', 'blob', 'frame']);
      const cx = (W - 1) / 2, cy = (H - 1) / 2;
      const want = (x, y) => {
        switch (pat) {
          case 'fill': return true;
          case 'ring': { const d = Math.max(Math.abs(x - cx), Math.abs(y - cy)); return d > 1 && d < 3.2; }
          case 'center': return Math.abs(x - cx) + Math.abs(y - cy) < 3.6;
          case 'checker': return (x + y) % 2 === 0;
          case 'stripes': return y % 3 !== 1;
          case 'bottom': return y >= H / 2 - 1;
          case 'blob': return Math.hypot(x - cx, (y - cy) * 1.2) < 2.8;
          case 'frame': return x === 0 || y === 0 || y === H - 1 || x === 1;
        }
      };
      each((x, y) => { if (want(x, y) && 'Lc.'.includes(get(x, y))) { const ch = get(x, y) === 'L' ? 'l' : get(x, y) === 'c' ? 'x' : (chance(pDouble) ? 'J' : 'j'); set(x, y, ch); } });
      goals.push({ type: 'jelly' });
    } else if (type === 'crate') {
      const pat = rp(['rows', 'clusters', 'pillars', 'bottom', 'zigzag']);
      const hp2 = () => chance(pDouble) ? 'C' : 'c';
      if (pat === 'rows') { const y0 = ri(2, H - 3); for (let x = 0; x < half; x++) if (x !== half - 1 || W % 2) if (free(x, y0) && x % 3 !== 2) set(x, y0, hp2()); if (chance(0.5)) for (let x = 0; x < half - 1; x++) if (free(x, H - 1)) set(x, H - 1, hp2()); }
      else if (pat === 'clusters') for (let i = ri(2, 3); i > 0; i--) { const x = ri(0, half - 2), y = ri(2, H - 2); [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => free(x + dx, y + dy) && set(x + dx, y + dy, hp2())); }
      else if (pat === 'pillars') for (let x = 0; x < half; x += 2) for (let y = H - 1; y > H - 1 - ri(2, 4); y--) free(x, y) && set(x, y, hp2());
      else if (pat === 'bottom') for (let y = H - 2; y < H; y++) for (let x = 0; x < half; x++) free(x, y) && !(y === H - 2 && x === half - 1) && set(x, y, hp2());
      else for (let x = 0; x < half; x++) { const y = 3 + (x % 2) * 2; free(x, y) && set(x, y, hp2()); }
      goals.push({ type: 'crate' });
    } else if (type === 'lock') {
      const pat = rp(['scatter', 'row', 'diag']);
      if (pat === 'row') { const y = ri(2, H - 2); for (let x = 0; x < half; x++) if (chance(0.75)) free(x, y) && set(x, y, 'L'); }
      else if (pat === 'diag') for (let i = 0; i < half; i++) free(i, i + 1) && set(i, i + 1, 'L');
      else for (let i = ri(3, 5); i > 0; i--) { const x = ri(0, half - 1), y = ri(1, H - 1); free(x, y) && set(x, y, 'L'); }
      goals.push({ type: 'lock' });
    } else if (type === 'static') {
      const pat = rp(['bottom', 'corners', 'center', 'pockets']);
      if (pat === 'bottom') for (let x = 0; x < half; x++) for (let y = H - 1; y > H - 1 - ri(1, 2); y--) free(x, y) && set(x, y, 's');
      else if (pat === 'corners') [[0, H - 1], [1, H - 1], [0, H - 2], [0, 0], [1, 0]].forEach(([x, y]) => free(x, y) && set(x, y, 's'));
      else if (pat === 'center') { const cx = Math.floor((W - 1) / 2); for (let y = Math.floor(H / 2) - 1; y <= Math.floor(H / 2) + 1; y++) free(cx, y) && set(cx, y, 's'); free(cx - 1, Math.floor(H / 2)) && set(cx - 1, Math.floor(H / 2), 's'); }
      else for (let i = ri(2, 3); i > 0; i--) { const x = ri(0, half - 1), y = ri(3, H - 1); free(x, y) && set(x, y, 's'); }
      goals.push({ type: 'static' });
    } else if (type === 'drop') {
      const need = ri(2, 3 + Math.round(tier * 2));
      const cols = []; for (let x = 0; x < W; x++) { let ok = free(x, 0), gap = false; for (let y = 1; y < H; y++) { const ch = get(x, y); if (ch === 'W') ok = false; if ('#W'.includes(ch)) gap = true; else if (gap) ok = false; } if (ok) cols.push(x); }
      if (!cols.length) continue;   // no clear path to the bottom on this layout: skip the records goal
      g[0][rp(cols)] = 'd';
      goals.push({ type: 'drop', n: need }); work += need * 2.5;
    } else if (type === 'collect') {
      const c1 = ri(0, 4); let c2 = ri(0, 4); if (c2 === c1) c2 = (c1 + 2) % 5;
      const amt = 15 + Math.round(tier * 20) + ri(0, 5);
      goals.push({ type: 'collect', color: c1, n: amt }); work += amt / 4;
      if (chance(0.5)) { goals.push({ type: 'collect', color: c2, n: amt }); work += amt / 4; }
    } else if (type === 'make') {
      const sp = rp(['disco', 'bomb', 'rocket', 'line']);
      const amt = { disco: ri(1, 2), bomb: ri(2, 4), rocket: ri(3, 5), line: ri(3, 6) }[sp];
      goals.push({ type: 'make', special: sp, n: amt }); work += amt * ({ disco: 4.5, bomb: 2.5, rocket: 1.8, line: 1.5 }[sp]);
    }
  }

  if (!goals.length) { const amt = 20 + Math.round(tier * 15); goals.push({ type: 'collect', color: ri(0, 4), n: amt }); work += amt / 4; }

  // 5. tally workload → moves
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = g[y][x];
    work += { j: 0.32, J: 0.6, c: 0.45, C: 0.85, x: 0.75, L: 0.45, l: 0.75, s: 0.6 }[ch] || 0;
  }
  const mult = (1.15 - tier * 0.25) * (boss ? 0.92 : hard ? 0.96 : 1);
  const moves = Math.round(Math.max(18, Math.min(38, 13 + work * mult)));
  const colors = (types.includes('collect') || types.includes('make')) && chance(tier * 0.6) ? 6 : 5;

  return {
    name: opts.name || `${rp(NAME_A)} ${rp(NAME_B)}`,
    moves, colors, goals,
    map: g.map(r => r.join('')),
    boss, hard, seed: n,
    tip: opts.tip || (boss ? '👑 <b>Headliner gig!</b> Fewer moves, bigger crowd.' : hard ? '🔥 <b>Hard gig.</b> Plan your combos.' : ''),
  };
}

function getLevel(n) {
  const def = HANDMADE[n] ? { ...HANDMADE[n], seed: n } : generateLevel(n);
  def.n = n;
  return def;
}

function dailyLevel(date = new Date()) {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const dayIdx = Math.floor(date.getTime() / 864e5);
  const def = generateLevel(30 + (dayIdx % 50), { seed: key * 7919, name: 'Daily Gig' });
  def.daily = key;
  return def;
}
