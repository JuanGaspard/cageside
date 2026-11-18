// Fight-cam film strip: watch an animation frame by frame. Load in the game page with
//   const C = await import('/tests/camtest.js?v=' + Date.now()); await C.setup(); C.hit('jab', 'a'); C.sheet(16, 30)
// The fight is paused and the picture is driven on its own clock, so frames are exact even when the
// browser isn't painting.
let clock = 0;
const FVX = () => MMA.fightview;

// the picture as it shows: in 3D, the octagon with the canvas of bursts and the map over it
const comp = document.createElement('canvas');
export function grab() {
  const cv = document.querySelector('#fvcanvas'), c3 = document.querySelector('.fcam canvas.fc3d');
  if (!c3) return cv;
  comp.width = cv.width; comp.height = cv.height;
  const g = comp.getContext('2d');
  g.drawImage(c3, 0, 0, cv.width, cv.height); g.drawImage(cv, 0, 0);
  return comp;
}
export async function setup(bout = 0, fig2 = MMA.fightview.fig2 && MMA.fightview.fig2(), fig3 = MMA.fightview.fig3 && MMA.fightview.fig3()) {
  const W = MMA.world;
  if (MMA.fightview.fig2) MMA.fightview.fig2(fig2);
  if (MMA.fightview.fig3) MMA.fightview.fig3(fig3);
  W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  W.state().settings.tips = false;
  MMA.ui.home();
  const ev = W.eventsFor(W.state().week)[0];
  FVX().spectate(ev.bouts[bout].id);
  FVX().actions.fvbell();
  FVX().actions.fvpause();
  FVX().camLive(true); // paused for the engine, live for the picture
  clock = performance.now();
  // The page keeps painting while we drive it, and its own animation frames read the real clock. Two clocks on
  // one picture means the frame time jumps between them — a real timestamp sets `cam.last` forwards, then our
  // much smaller synthetic one arrives and the gap is negative. Measurements came out different every run, and
  // one standing situation scored 10^68. From here there is one clock, ours: a frame the page starts sees the
  // same time ours does and simply does nothing. (play/record take a copy before they patch, so they restore
  // this one, not the real one.)
  if (!performance.now.synthetic) { const fake = () => clock; fake.synthetic = true; performance.now = fake; }
  const f = FVX().current();
  f.range = 'pocket';
  run(1500);
  // three.js loads in the background: until it has, the picture is the side view
  for (let i = 0; fig3 && FVX().three && !FVX().three().gl && !FVX().three().failed && i < 100; i++) { run(16); await new Promise((r) => setTimeout(r, 100)); }
  return f;
}
export function fight() { return FVX().current(); }
export function run(ms) { for (let t = 0; t < ms; t += 15) { clock += 15; FVX().camFrame(clock); } }
// the picture's clock (to start a measurement at the same moment of what runs on it: contact.js align())
export const now = () => clock;
// fire strikes (or shots) as if the engine had just thrown them: [{ key, by, land, blocked, target, dmg, lead }]
export function moves(list) {
  const real = performance.now;
  performance.now = () => clock;
  try { FVX().camMotion(list.map((m) => Object.assign({ lead: null, land: true, target: 'head', dmg: 6, blocked: false }, m))); } finally { performance.now = real; }
}
export function hit(key, by, extra) { moves([Object.assign({ key, by }, extra || {})]); }
// n frames, `every` ms apart, laid out `cols` across, cropped to the middle of the picture
export function sheet(n, every, cols = 4, tw = 400, crop = [0.1, 0.12, 0.8, 0.86]) {
  const cv = document.querySelector('#fvcanvas');
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2]));
  const out = document.createElement('canvas');
  out.width = tw * cols; out.height = th * Math.ceil(n / cols);
  const o = out.getContext('2d');
  for (let i = 0; i < n; i++) {
    run(every);
    o.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    o.fillStyle = '#ff0'; o.font = '14px sans-serif'; o.fillText(String(i), (i % cols) * tw + 4, Math.floor(i / cols) * th + 16);
  }
  let el = document.getElementById('camsheet');
  if (!el) { el = document.createElement('img'); el.id = 'camsheet'; el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:100vw;background:#000'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.src = out.toDataURL();
  return [out.width, out.height];
}
// The real engine, a moment at a time, filmed: `frames` frames per moment at the speed chosen (2x = 1.5 s a
// moment), for `n` moments.
export function live(n, frames = 6, cols = 6, tw = 260, speed = 2) {
  const f = fight();
  const per = 3000 / speed / frames;
  const cv = document.querySelector('#fvcanvas');
  const crop = [0.08, 0.1, 0.84, 0.88];
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2]));
  const out = document.createElement('canvas');
  out.width = tw * cols; out.height = th * Math.ceil(n * frames / cols);
  const o = out.getContext('2d');
  const log = [];
  let k = 0;
  for (let i = 0; i < n && !f.over; i++) {
    if (f.betweenRounds) break;
    f.step();
    log.push(i + ': ' + f.pos + ' ' + (f.motion || []).map((m) => m.by + ':' + m.key + (m.land ? '!' : m.blocked ? '#' : '-')).join(' '));
    moves(f.motion || []);
    for (let j = 0; j < frames; j++, k++) {
      run(per);
      o.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], (k % cols) * tw, Math.floor(k / cols) * th, tw, th);
      o.fillStyle = '#ff0'; o.font = '12px sans-serif'; o.fillText(i + '.' + j, (k % cols) * tw + 3, Math.floor(k / cols) * th + 13);
    }
  }
  let el = document.getElementById('camsheet');
  if (!el) { el = document.createElement('img'); el.id = 'camsheet'; el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:100vw;background:#000'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.src = out.toDataURL();
  return log;
}
// Play the fight itself on the picture's own clock, as if the window were drawing at 60 fps: `ms` of real
// time at the fight's speed. Returns what happened: when each moment ran, and how long the picture held
// back (hit-stops and slow motion).
export function play(ms, speed = 2) {
  const real = performance.now;
  performance.now = () => clock;
  const out = { moments: [], warp: 0, shakes: 0 };
  try {
    FVX().setSpeed && FVX().setSpeed(speed);
    const f = fight();
    if (!FVX().camStats().running) FVX().actions.fvpause(); // resume
    let lastTick = f.tick, last = f.round;
    for (let t = 0; t < ms; t += 16) {
      clock += 16;
      FVX().camFrame(clock);
      if (f.tick !== lastTick || f.round !== last) { out.moments.push([Math.round(t), f.round + ':' + f.tick, f.pos]); lastTick = f.tick; last = f.round; }
      if (FVX().cam().shake) out.shakes++;
      if (f.over) break;
    }
    out.warp = Math.round(FVX().cam().warp || 0);
  } finally { performance.now = real; }
  return out;
}
// The fight running as it does on screen (at `speed`), filmed: n frames `every` ms apart.
export function film(n, every, cols = 6, tw = 300, crop = [0, 0, 1, 1], speed = 2) {
  const real = performance.now;
  performance.now = () => clock;
  const cv = document.querySelector('#fvcanvas');
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2]));
  const out = document.createElement('canvas');
  out.width = tw * cols; out.height = th * Math.ceil(n / cols);
  const o = out.getContext('2d');
  try {
    FVX().setSpeed(speed);
    if (!FVX().camStats().running) FVX().actions.fvpause();
    for (let i = 0; i < n && !fight().over; i++) {
      run(every);
      o.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
      o.fillStyle = '#ff0'; o.font = '12px sans-serif'; o.fillText(String(Math.round((i + 1) * every)), (i % cols) * tw + 3, Math.floor(i / cols) * th + 13);
    }
  } finally { performance.now = real; }
  return out;
}
export function hide() { const el = document.getElementById('camsheet'); if (el) el.remove(); }

// ---------------------------------------------------------------- measuring the motion
// (ANIMATION_PLAN.md, section 7.) record() plays the fight like play() and keeps every frame's joints;
// qa() turns that into the numbers the plan holds the animation to.
const lerp = (a, b, t) => a + (b - a) * t;
const copyJ = (J) => { if (!J) return null; const o = {}; for (const k in J) o[k] = J[k].slice(); return o; };
// one fighter's frame: joints, which feet are planted, and what's playing (for tracking down a glitch)
const handCh = (g, k) => { const A = MMA.fightview.anim; return g.v2 && g.v2.out && A ? Array.from(g.v2.out.subarray(A.AT[k], A.AT[k] + 3)) : null; };
const snap = (g) => ({ fam: g.fam, blend: !!g.blend, J: copyJ(g.J), dir: g.dir, pl: g.planted && g.planted.slice(), base: g.v2 && g.v2.base, m: g.v2 && g.v2.m,
  vt: g.v2 && g.v2.now, hL: handCh(g, 'handL'), hR: handCh(g, 'handR'),
  acts: (g.acts || []).map((a) => (a.C ? a.C.id : a.react || (a.mv && a.mv.key)) + (a.feint ? '~' : '') + '@' + Math.round(a.lt || 0)).join(' ') });
export function record(ms, speed = 2) {
  const real = performance.now, now = () => real.call(performance);
  performance.now = () => clock;
  const rec = { dt: 16, frames: [], cost: [] };
  try {
    FVX().setSpeed(speed);
    const f = fight();
    if (!FVX().camStats().running) FVX().actions.fvpause();
    let sparks = 0, impacts = 0;
    for (let t = 0; t < ms && !f.over; t += 16) {
      clock += 16;
      const t0 = now();
      FVX().camFrame(clock);
      rec.cost.push(now() - t0);
      const cam = FVX().cam();
      // a blow arriving (the new figure counts the slipped and blocked ones too)
      const hitNow = cam.sparks.length > sparks || (cam.impacts || 0) > impacts;
      sparks = cam.sparks.length; impacts = cam.impacts || 0;
      rec.frames.push({ t, pos: cam.shown && cam.shown.pos, hit: hitNow,
        a: snap(cam.a), b: snap(cam.b) });
    }
  } finally { performance.now = real; }
  return rec;
}
// The bones each skeleton should keep at their length, and its feet, fists and body joints.
const SKELETONS = {
  v1: { bones: [['H', 'S', 0.52], ['H', 'lk', 0.46], ['lk', 'lf', 0.45], ['H', 'rk', 0.46], ['rk', 'rf', 0.45], ['S', 'le', 0.3], ['le', 'lg', 0.31], ['S', 're', 0.3], ['re', 'rg', 0.31]],
    feet: ['lf', 'rf'], ends: ['lg', 'rg', 'lf', 'rf'], body: ['H', 'S', 'N', 'C'], ankle: 0.07,
    strikers: ['lg', 'rg', 'lf', 'rf', 'lk', 'rk', 'le', 're'], trunk: ['H', 'S'],
    com: [['H', 0.3], ['S', 0.25], ['C', 0.08], ['lk', 0.1], ['rk', 0.1], ['lf', 0.03], ['rf', 0.03], ['le', 0.03], ['re', 0.03], ['lg', 0.025], ['rg', 0.025]] },
  // the new figure (planted: as its player says, recorded with each frame)
  v2: { bones: null, feet: ['toL', 'toR'], ends: ['fiL', 'fiR', 'toL', 'toR', 'anL', 'anR'], body: ['P', 'Ch', 'N', 'Hd'], ankle: 0.03,
    strikers: ['fiL', 'fiR', 'toL', 'toR', 'knL', 'knR', 'elL', 'elR'], trunk: ['P', 'N'], ball: { toL: ['anL'], toR: ['anR'] },
    com: [['P', 0.3], ['Ch', 0.25], ['Hd', 0.08], ['knL', 0.1], ['knR', 0.1], ['anL', 0.03], ['anR', 0.03], ['elL', 0.03], ['elR', 0.03], ['fiL', 0.025], ['fiR', 0.025]] },
};
export function qa(rec, skel = 'v1') {
  const K = Object.assign({}, SKELETONS[skel]), dt = rec.dt / 1000, F = rec.frames;
  // (the new figure's bones are solved in 3D at their length, and the picture foreshortens them, so
  // there's nothing to measure on the flat picture)
  if (!K.bones) K.bones = [];
  const out = { seconds: +(F.length * dt).toFixed(1), slide: { contacts: 0, meanCm: 0, maxCm: 0, over1cm: 0 }, pops: 0, popsBy: {}, worstPop: null, fast: 0,
    jerkSpikes: 0, stretch: { frames: 0, maxPct: 0 }, through: 0, offBalance: 0, cost: {} };
  const near = (i, w) => { for (let j = Math.max(0, i - w); j <= Math.min(F.length - 1, i + w); j++) if (F[j].hit) return true; return false; };
  const planted = (g, fi, k) => (g.pl ? g.pl[fi] : g.fam === 'rig' && g.J[k][1] < K.ankle + 0.012);
  // a change of stance swaps which side leads (L is the lead side): a frame from before one is read with
  // its sides swapped, so each limb is compared with itself
  const other = (k) => (/[LR]$/.test(k) ? k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L') : k);
  const asOf = (g, m) => {
    if (!g || g.m == null || m == null || g.m === m || !g.J) return g;
    const J = {};
    for (const k in g.J) J[other(k)] = g.J[k];
    return Object.assign({}, g, { J, pl: g.pl && [g.pl[1], g.pl[0]] });
  };
  let slideSum = 0;
  for (const side of ['a', 'b']) {
    const run = {};
    for (let i = 0; i < F.length; i++) {
      const fr = F[i], g = fr[side], J = g.J, P = i > 0 ? asOf(F[i - 1][side], g.m) : null;
      if (P && P !== F[i - 1][side]) for (const k of Object.keys(run)) { run[other(k)] = run[k]; delete run[k]; }
      if (!J) continue;
      // feet: sliding over the floor while planted (a contact is a run of frames on the floor). The new
      // figure pivots on the ball of the foot, so that's where it's measured.
      const at = (J, k) => { const p = J[k], a = K.ball ? J[K.ball[k][0]] : p; return [lerp(a[0], p[0], K.ball ? 0.8 : 1), lerp(a[2] || 0, p[2] || 0, K.ball ? 0.8 : 1)]; };
      for (const [fi, k] of K.feet.entries()) {
        const down = planted(g, fi, k);
        if (down && P && P.J && planted(P, fi, k)) {
          const p = at(J, k), q = at(P.J, k);
          run[k] = (run[k] || 0) + Math.hypot(p[0] - q[0], p[1] - q[1]);
        } else if (run[k] != null) {
          const cm = run[k] * 100; out.slide.contacts++; slideSum += cm; out.slide.maxCm = Math.max(out.slide.maxCm, cm); if (cm > 1) out.slide.over1cm++;
          delete run[k];
        }
        if (down && run[k] == null) run[k] = 0;
      }
      if (!P || !P.J || i < 2 || !F[i - 2][side].J) continue;
      const Q = asOf(F[i - 2][side], g.m).J;
      // pops: a joint jumping, alone in its frame (over 3 cm, and over 2.5 times what it moved both the
      // frame before and the frame after: a punch's fist is fast for several frames running, a glitch
      // isn't); fast: moving quicker than a body can (7 m/s, 20 for fists and feet); jerk: the
      // acceleration changing abruptly with no blow landing to explain it
      const N = i + 1 < F.length ? asOf(F[i + 1][side], g.m).J : null;
      for (const k in J) {
        if (!P.J[k] || !Q[k]) continue;
        const dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
        const d = dd(J[k], P.J[k]), d0 = dd(P.J[k], Q[k]), d1 = N && N[k] ? dd(N[k], J[k]) : 0;
        const v = d / dt, lim = K.ends.includes(k) ? 20 : 7;
        if (v > lim) out.fast++;
        if (d > 0.03 && d > 2.5 * Math.max(d0, d1, 0.004) && !near(i, 2)) { out.pops++; out.popsBy[k] = (out.popsBy[k] || 0) + 1; if (!out.worstPop || d > out.worstPop.cm / 100) out.worstPop = { cm: +(d * 100).toFixed(1), before: +(d0 * 100).toFixed(1), joint: side + '.' + k, ms: fr.t }; }
        if (K.body.includes(k) && !near(i, 4)) {
          const a = Math.hypot(J[k][0] - 2 * P.J[k][0] + Q[k][0], J[k][1] - 2 * P.J[k][1] + Q[k][1]) / (dt * dt);
          if (a > 120) out.jerkSpikes++;
        }
      }
      // bones keeping their length (cross-fades between poses shorten them)
      let worst = 0;
      for (const [p, q, L] of K.bones) if (J[p] && J[q]) worst = Math.max(worst, Math.abs(Math.hypot(J[p][0] - J[q][0], J[p][1] - J[q][1]) - L) / L);
      if (worst > 0.05) out.stretch.frames++;
      out.stretch.maxPct = Math.max(out.stretch.maxPct, Math.round(worst * 100));
      // standing: a fist, foot or knee inside the other man's trunk, and the body's weight off its feet
      if (fr.pos === 'stand' && g.fam === 'rig') {
        const O = fr[side === 'a' ? 'b' : 'a'].J;
        if (O) for (const k of K.strikers) if (J[k] && segDist(J[k], O[K.trunk[0]], O[K.trunk[1]]) < 0.11) { out.through++; break; }
        let cx = 0, cw = 0;
        for (const [k, w] of K.com) if (J[k]) { cx += J[k][0] * w; cw += w; }
        cx /= cw;
        // (only with both feet down: mid-step, a body falls forward into the step)
        const fx = K.feet.filter((k, fi) => planted(g, fi, k)).map((k) => J[k][0]);
        if (fx.length === K.feet.length) {
          const lo = Math.min(...fx) - (g.dir > 0 ? 0.06 : 0.17), hi = Math.max(...fx) + (g.dir > 0 ? 0.17 : 0.06);
          if (cx < lo - 0.03 || cx > hi + 0.03) out.offBalance++;
        }
      }
    }
  }
  out.slide.meanCm = out.slide.contacts ? +(slideSum / out.slide.contacts).toFixed(2) : 0;
  out.slide.maxCm = +out.slide.maxCm.toFixed(1);
  const c = rec.cost.slice().sort((x, y) => x - y);
  out.cost = { medianMs: +c[Math.floor(c.length / 2)].toFixed(2), p95Ms: +c[Math.floor(c.length * 0.95)].toFixed(2) };
  return out;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

// A reel: one row per move, `frames` frames across it, each row filmed from the same idle start.
//   rows: [{ label, ms, go: () => hit('jab', 'a') }]
export function reel(rows, frames = 8, tw = 190, crop = [0.2, 0.1, 0.6, 0.82]) {
  const cv = document.querySelector('#fvcanvas');
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2])), lw = 92;
  const out = document.createElement('canvas');
  out.width = lw + tw * frames; out.height = th * rows.length;
  const o = out.getContext('2d');
  o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
  const cam = FVX().cam();
  for (let r = 0; r < rows.length; r++) {
    cam.a.nextFeint = cam.b.nextFeint = Infinity; // no feints: every row starts the same way
    run(900);
    rows[r].go();
    const every = (rows[r].ms + 160) / frames;
    for (let i = 0; i < frames; i++) {
      run(every);
      o.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], lw + i * tw, r * th, tw, th);
    }
    o.fillStyle = '#ff0'; o.font = 'bold 13px sans-serif'; o.fillText(rows[r].label, 6, r * th + 18);
    o.fillStyle = '#999'; o.font = '11px sans-serif'; o.fillText(Math.round(every) + ' ms/frame', 6, r * th + 34);
  }
  cam.a.nextFeint = cam.b.nextFeint = 0;
  let el = document.getElementById('camsheet');
  if (!el) { el = document.createElement('img'); el.id = 'camsheet'; el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:100vw;background:#000'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.src = out.toDataURL();
  return out;
}
// ---------------------------------------------------------------- the new figure, posed
// (ANIMATION_PLAN.md, Phase 1.) A grid: one build (or stance) a row, one pose a column.
export const BUILDS = { light: { height: 66, reach: 67, weight: 140 }, average: { height: 71, reach: 73, weight: 185 }, heavy: { height: 76, reach: 80, weight: 255 } };
const SHIFT = { sprawl: 0.4, shot: -0.12, flat: 0.1, mount: -0.1, chamber: -0.48, headKick: -0.52, kick: -0.5, knee: -0.45 };
export function gallery(opts = {}) {
  const FG = MMA.fightview.figure;
  const cols = opts.cols || ['guard', 'jab', 'cross', 'chamber', 'headKick', 'shot', 'mount', 'flat'];
  const rows = opts.rows || [
    { label: 'light', f: BUILDS.light, side: 'a', dir: 1 },
    { label: 'average', f: BUILDS.average, side: 'a', dir: 1 },
    { label: 'heavy', f: BUILDS.heavy, side: 'a', dir: 1 },
    { label: 'southpaw', f: BUILDS.average, side: 'b', dir: -1, southpaw: true },
  ];
  const cw = opts.cw || 240, ch = opts.ch || 300, lw = 78, top = 24, ppm = opts.ppm || 112;
  const out = document.createElement('canvas');
  out.width = lw + cw * cols.length; out.height = top + ch * rows.length;
  const o = out.getContext('2d');
  o.fillStyle = '#05070a'; o.fillRect(0, 0, out.width, out.height);
  o.font = 'bold 13px sans-serif'; o.fillStyle = '#ff0';
  cols.forEach((c, i) => o.fillText(typeof c === 'string' ? c : c.label, lw + i * cw + 8, 16));
  rows.forEach((r, j) => {
    const b = FG.body(r.f);
    o.fillStyle = '#ff0'; o.font = 'bold 13px sans-serif'; o.fillText(r.label, 8, top + j * ch + 20);
    cols.forEach((c, i) => {
      const name = typeof c === 'string' ? c : c.pose;
      const x = lw + i * cw, y = top + j * ch, floorY = y + ch - 26;
      const bg = o.createLinearGradient(0, y, 0, floorY);
      bg.addColorStop(0, '#0b0f15'); bg.addColorStop(1, '#1b222d');
      o.fillStyle = bg; o.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      o.fillStyle = '#2b313c'; o.fillRect(x + 1, floorY, cw - 2, y + ch - 1 - floorY);
      const X = (m) => x + cw / 2 + m * ppm, Y = (m) => floorY - m * ppm;
      const x0 = (SHIFT[name] != null ? SHIFT[name] : -0.3) * r.dir;
      const figs = [FG.figure(name, b, x0, r.dir, r.southpaw, r.side)];
      figs[0].hurt = false;
      if (name === 'mount') {
        const under = FG.figure('flat', FG.body(BUILDS.average), x0, -r.dir, false, r.side === 'a' ? 'b' : 'a');
        figs[0].bias = 0.001; figs.unshift(under);
      }
      o.save(); o.beginPath(); o.rect(x + 1, y + 1, cw - 2, ch - 2); o.clip();
      for (const g of figs) { o.beginPath(); o.ellipse(X(g.pt.P[0]), floorY + 2, 0.42 * ppm, 0.05 * ppm, 0, 0, Math.PI * 2); o.fillStyle = 'rgba(0,0,0,0.45)'; o.fill(); }
      FG.draw(o, figs, X, Y, ppm, 0);
      o.restore();
    });
  });
  let el = document.getElementById('camsheet');
  if (!el) { el = document.createElement('img'); el.id = 'camsheet'; el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:100vw;background:#000'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.src = out.toDataURL();
  return out;
}
// Two fighters at fight-cam size, a panel a moment: [{ label, a: pose, b: pose, gap }]
export function faceoff(panels, opts = {}) {
  const FG = MMA.fightview.figure;
  const pw = opts.pw || 520, ph = opts.ph || 400, ppm = opts.ppm || 165, cols = opts.cols || 2;
  const A = FG.body(opts.fa || BUILDS.average), B = FG.body(opts.fb || BUILDS.heavy);
  const out = document.createElement('canvas');
  out.width = pw * cols; out.height = ph * Math.ceil(panels.length / cols);
  const o = out.getContext('2d');
  panels.forEach((p, i) => {
    const x = (i % cols) * pw, y = Math.floor(i / cols) * ph, floorY = y + ph - 40;
    const bg = o.createLinearGradient(0, y, 0, floorY);
    bg.addColorStop(0, '#05070a'); bg.addColorStop(1, '#151b24');
    o.fillStyle = bg; o.fillRect(x, y, pw, ph);
    const mat = o.createLinearGradient(0, floorY, 0, y + ph);
    mat.addColorStop(0, '#1c212a'); mat.addColorStop(1, '#2b313c');
    o.fillStyle = mat; o.fillRect(x, floorY, pw, y + ph - floorY);
    const X = (m) => x + pw / 2 + m * ppm, Y = (m) => floorY - m * ppm, gap = p.gap != null ? p.gap : 1.0;
    const figs = [FG.figure(p.a, A, -gap / 2, 1, false, 'a'), FG.figure(p.b, B, gap / 2, -1, !!p.bSouthpaw, 'b')];
    if (p.over === 'a') figs[0].bias = 0.001; else if (p.over === 'b') figs[1].bias = 0.001;
    o.save(); o.beginPath(); o.rect(x, y, pw, ph); o.clip();
    for (const g of figs) { o.beginPath(); o.ellipse(X(g.pt.P[0]), floorY + 4, 0.42 * ppm, 0.05 * ppm, 0, 0, Math.PI * 2); o.fillStyle = 'rgba(0,0,0,0.45)'; o.fill(); }
    FG.draw(o, figs, X, Y, ppm, 0);
    o.restore();
    o.fillStyle = '#ff0'; o.font = 'bold 14px sans-serif'; o.fillText(p.label, x + 10, y + 20);
    o.strokeStyle = '#000'; o.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
  });
  let el = document.getElementById('camsheet');
  if (!el) { el = document.createElement('img'); el.id = 'camsheet'; el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:100vw;background:#000'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.src = out.toDataURL();
  return out;
}
export const FACEOFF = [
  { label: 'guard vs guard (southpaw)', a: 'guard', b: 'guard', gap: 1.15, bSouthpaw: true },
  { label: 'jab', a: 'jab', b: 'guard', gap: 1.15 },
  { label: 'cross', a: 'cross', b: 'guard', gap: 1.1 },
  { label: 'head kick', a: 'headKick', b: 'guard', gap: 1.25 },
];
// ---------------------------------------------------------------- on the mat
// Put them in a position on the mat: gpos 'guard' | 'half' | 'side' | 'mount' | 'back', `top` 'a' or 'b'; or
// standing ('stand', 'clinch'); `sub` the engine's name for a submission, put on by `att`.
export function pos(gpos, top = 'a', sub = null, att = top) {
  const f = fight();
  if (gpos === 'stand' || gpos === 'clinch') { f.pos = gpos; f.top = null; f.gpos = null; f.subLock = null; return; }
  f.pos = 'ground'; f.gpos = gpos; f.top = top;
  f.subLock = sub ? { att: { side: att }, type: sub } : null;
}
// How far the two bodies are into each other now: for each man, his limbs (ten points along each) and his
// trunk and head against the other's shapes. { a: { worst, sum, where }, b: ... } in metres.
export function overlap() {
  const cam = FVX().cam(), BODY = FVX().anim.BODY, id = (p) => p;
  const out = {};
  for (const [k, me, opp] of [['a', cam.a, cam.b], ['b', cam.b, cam.a]]) {
    const S = BODY.shapes(opp, id, id), P = me.v2 && me.v2.pts;
    if (!S || !P) continue;
    const s = me.v2.body.s, mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    let worst = 0, sum = 0, where = '';
    const test = (p, r, name) => { const v = BODY.pen(S, p, r, [0, 1, 0], true), d = v ? Math.hypot(v[0], v[1], v[2]) : 0; sum += d; if (d > worst) { worst = d; where = name; } };
    for (const [a, b, r] of [['shL', 'elL', 0.05], ['elL', 'fiL', 0.04], ['shR', 'elR', 0.05], ['elR', 'fiR', 0.04], ['hpL', 'knL', 0.07], ['knL', 'anL', 0.05], ['hpR', 'knR', 0.07], ['knR', 'anR', 0.05]])
      for (let i = 0; i <= 9; i++) test(mix(P[a], P[b], i / 9), r * s, a + '-' + b);
    for (const j of ['P', 'W', 'Ch']) test(P[j], 0.1 * s, j);
    test(P.Hd, 0.1 * s, 'Hd');
    out[k] = { worst: +worst.toFixed(3), sum: +sum.toFixed(3), where };
  }
  return out;
}
// Each position held for a while, the overlap measured over it: [{ label, worst, mean }]
export const POSITIONS = [
  ['closed guard', 'guard'], ['half guard', 'half'], ['side control', 'side'], ['mount', 'mount'], ['back', 'back'],
  ['rear-naked choke', 'back', 'rear-naked choke'], ['guillotine', 'guard', 'guillotine', 'b'], ['armbar', 'guard', 'armbar', 'b'],
  ['triangle', 'guard', 'triangle', 'b'], ['kimura', 'guard', 'kimura', 'b'], ['arm-triangle', 'side', 'arm-triangle choke'],
];
export function overlaps(ms = 2500, list = POSITIONS) {
  const out = [];
  for (const [label, g, sub, att] of list) {
    pos(g, 'a', sub || null, att || 'a');
    run(1600); // into it
    let worst = 0, sum = 0, n = 0, where = '';
    for (let t = 0; t < ms; t += 60) {
      run(60);
      const o = overlap();
      for (const k of ['a', 'b']) if (o[k]) { if (o[k].worst > worst) { worst = o[k].worst; where = k + ' ' + o[k].where; } sum += o[k].worst; n++; }
    }
    out.push({ label, worst: +worst.toFixed(3), mean: +(sum / Math.max(1, n)).toFixed(3), where });
  }
  return out;
}
// A bout recorded and measured with the picture's chance seeded, so two versions (keeping out of each other
// on or off, `off`) can be compared on the same fight: what qa() makes of `ms` of it at 2x.
const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export async function trial(bout, off = false, ms = 20000, seed = 5) {
  const R = Math.random, B = FVX().anim.BODY;
  Math.random = seeded(seed);
  try {
    B.off = off;
    await setup(bout, true, true);
    const rec = record(ms, 2), q = qa(rec, 'v2'), pos = {};
    for (const fr of rec.frames) pos[fr.pos] = (pos[fr.pos] || 0) + 1;
    return { bout, off, pos, pops: q.pops, popsBy: q.popsBy, worst: q.worstPop, jerk: q.jerkSpikes, slide: q.slide.maxCm };
  } finally { Math.random = R; B.off = false; }
}
// Scripted, so it's the same each time: in the clinch, eight strikes traded (knees, elbows, hooks), the
// picture's chance seeded; the pops counted (as qa() does, but with no frames left out round the blows) by
// joint, and the overlap at the end. `off`: without keeping out of each other.
export async function clinchTest(off = false, seed = 3) {
  const R = Math.random, B = FVX().anim.BODY, cam = () => FVX().cam();
  Math.random = seeded(seed);
  try {
    B.off = off;
    await setup(2, true, true);
    pos('clinch'); run(2000);
    const seq = [['knee', 'a', { target: 'body' }], ['hook', 'b'], ['elbow', 'a'], ['uppercut', 'b'], ['knee', 'b', { target: 'body' }], ['bodyPunch', 'a', { target: 'body' }], ['elbow', 'b'], ['hook', 'a']];
    const frames = [], snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
    for (let i = 0; i < seq.length * 45; i++) {
      if (i % 45 === 0) { const [k, by, x] = seq[i / 45]; hit(k, by, x); }
      run(16);
      frames.push({ a: snap(cam().a), b: snap(cam().b) });
    }
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), by = {};
    let pops = 0, worst = 0, where = '';
    for (const s of ['a', 'b']) for (let i = 2; i + 1 < frames.length; i++) {
      const J = frames[i][s], P = frames[i - 1][s], Q = frames[i - 2][s], N = frames[i + 1][s];
      for (const k in J) {
        const d = dd(J[k], P[k]);
        if (d > 0.03 && d > 2.5 * Math.max(dd(P[k], Q[k]), dd(N[k], J[k]), 0.004)) { pops++; by[s + '.' + k] = (by[s + '.' + k] || 0) + 1; if (d > worst) { worst = d; where = s + '.' + k; } }
      }
    }
    return { off, pops, by, worst: +(worst * 100).toFixed(1), where, overlap: overlap() };
  } finally { Math.random = R; B.off = false; }
}
// The changes of position in order, for reel() and video(): from the feet to the choke, and the guard's
// sweep, a submission and the stand-up.
export const GRAPPLE1 = [
  { label: 'double-leg, to the guard', ms: 2700, go: () => { pos('guard', 'a'); hit('shoot', 'a'); } },
  { label: 'pass to half guard', ms: 2300, go: () => pos('half', 'a') },
  { label: 'pass to side control', ms: 2300, go: () => pos('side', 'a') },
  { label: 'side control to mount', ms: 2300, go: () => pos('mount', 'a') },
  { label: 'mount to the back', ms: 2300, go: () => pos('back', 'a') },
  { label: 'rear-naked choke', ms: 2300, go: () => pos('back', 'a', 'rear-naked choke', 'a') },
];
export const GRAPPLE2 = [
  { label: 'into the guard', ms: 2300, go: () => pos('guard', 'a') },
  { label: 'sweep', ms: 2600, go: () => pos('guard', 'b') },
  { label: 'triangle', ms: 2300, go: () => pos('guard', 'b', 'triangle', 'a') },
  { label: 'stand-up', ms: 2400, go: () => pos('stand') },
];
// Scripted: every change of position in GRAPPLE1 and GRAPPLE2 in turn, frame by frame; the pops counted (as
// clinchTest) with the change each was in. `off`: without keeping out of each other.
export async function groundTest(off = false) {
  const B = FVX().anim.BODY, cam = () => FVX().cam();
  B.off = off;
  try {
    await setup(0, true, true);
    pos('stand'); run(1500);
    const frames = [], snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
    for (const r of [...GRAPPLE1, ...GRAPPLE2]) { r.go(); for (let t = 0; t < r.ms; t += 16) { run(16); frames.push({ a: snap(cam().a), b: snap(cam().b), l: r.label }); } }
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), list = [], by = {};
    let pops = 0, worst = 0, where = '';
    for (const s of ['a', 'b']) for (let i = 2; i + 1 < frames.length; i++) {
      const J = frames[i][s], P = frames[i - 1][s], Q = frames[i - 2][s], N = frames[i + 1][s];
      for (const k in J) {
        if (!P[k] || !Q[k] || !N[k]) continue;
        const d = dd(J[k], P[k]);
        if (d > 0.03 && d > 2.5 * Math.max(dd(P[k], Q[k]), dd(N[k], J[k]), 0.004)) {
          pops++; by[frames[i].l] = (by[frames[i].l] || 0) + 1; list.push(frames[i].l + ' ' + s + '.' + k + ' ' + (d * 100).toFixed(1));
          if (d > worst) { worst = d; where = s + '.' + k + ' ' + frames[i].l; }
        }
      }
    }
    return { off, frames: frames.length, pops, by, worst: +(worst * 100).toFixed(1), where, list };
  } finally { B.off = false; }
}
// A technique (as steps(): `from()` sets up, `go()` starts it) measured frame by frame for `ms`: the bodies'
// overlap (the worst, and the mean of each frame's worst), and the pops (as clinchTest), with when.
export function techTest(from, go, ms = 2200) {
  const cam = () => FVX().cam(), snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
  from(); run(2500); go();
  const frames = [];
  let worst = 0, sum = 0, where = '';
  for (let t = 0; t < ms; t += 15) {
    run(15);
    frames.push({ t, a: snap(cam().a), b: snap(cam().b) });
    const o = overlap(), w = Math.max(o.a ? o.a.worst : 0, o.b ? o.b.worst : 0);
    sum += w;
    if (w > worst) { worst = w; where = t + ' ' + (o.a && o.a.worst === w ? 'a ' + o.a.where : 'b ' + o.b.where); }
  }
  const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), pops = [];
  // (a man's stance mirrored, his left and right trade names where they are: the same picture, not a pop)
  const other = (k) => (/[LR]$/.test(k) ? k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L') : k);
  for (const s of ['a', 'b']) for (let i = 2; i + 1 < frames.length; i++) {
    const J = frames[i][s], P = frames[i - 1][s], Q = frames[i - 2][s], N = frames[i + 1][s];
    for (const k in J) {
      const d = dd(J[k], P[k]);
      if (d > 0.03 && d > 2.5 * Math.max(dd(P[k], Q[k]), dd(N[k], J[k]), 0.004) && !(P[other(k)] && dd(J[k], P[other(k)]) < Math.max(0.03, 0.5 * d))) pops.push(frames[i].t + ' ' + s + '.' + k + ' ' + (d * 100).toFixed(1));
    }
  }
  return { worst: +worst.toFixed(3), mean: +(sum / frames.length).toFixed(3), where, pops };
}
// How far one placed figure (fig.v2: world points and frames) is bent past what a body does, each joint in
// radians over its range (0 = within it): the spine twisted, bent sideways, folded or arched; the neck the
// same; each knee pointing backwards (its bend away from the front of the leg) or splayed out sideways; each
// elbow bent the wrong way (its point forward and in, where the forearm can't fold); each hip past the knee
// to the chest or the leg behind. { worst, where, by: { joint: radians over } }.
const v3 = { dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  unit: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
export const RANGE = { twist: 0.9, side: 0.6, flex: 1.3, arch: 0.55, neckTwist: 1.3, neckSide: 0.7, neckFlex: 1.0, neckArch: 0.9,
  kneeOut: 1.25, elbowWrong: 0.6, hipFlex: 2.45, hipBack: 0.5, ankle: 1.1, shoulderBack: 1.0, hipOut: 0.95, armBend: 0.2 };
// How high a man on the mat is held up with nothing under him: of the parts that can carry him (feet, knees,
// hands, the backside, the back, the head), the one nearest the mat or the other man, and how far it is from
// both (metres; 0 when something's on one or the other).
export function unsupported(g, opp) {
  const P = g.pts, s = g.body.s, BODY = FVX().anim.BODY, S = BODY.shapes(opp, (p) => p, (v) => v);
  if (!P || !S) return 0;
  const parts = [['anL', 0.05], ['anR', 0.05], ['knL', 0.06], ['knR', 0.06], ['toL', 0.02], ['toR', 0.02], ['heL', 0.03], ['heR', 0.03],
    ['fiL', 0.05], ['fiR', 0.05], ['P', 0.13], ['W', 0.12], ['Ch', 0.13], ['Hd', 0.1]];
  let best = Infinity;
  for (const [k, r] of parts) {
    const p = P[k], floor = p[1] - r * s;
    // (on the other man: within 3 cm of his surface)
    const v = BODY.pen(S, p, (r + 0.03) * s, [0, 1, 0], true);
    best = Math.min(best, v ? 0 : Math.max(0, floor));
  }
  return best;
}
export function posture(g) {
  const P = g.pts, F = g.fr, { dot, sub, cross, unit } = v3, by = {};
  if (!P || !F) return null;
  const over = (k, v, lim) => { const o = Math.abs(v) - lim; if (o > 0) by[k] = Math.max(by[k] || 0, o); };
  // one frame seen from another: its forward and up in the other's [forward, up, side]
  const rel = (A, B) => [B[0], B[1]].map((v) => [dot(v, A[0]), dot(v, A[1]), dot(v, A[2])]);
  const joint = (A, B, pre) => {
    const [f, u] = rel(A, B);
    over(pre + 'twist', Math.atan2(f[2], f[0]), RANGE[pre ? 'neckTwist' : 'twist']);
    over(pre + 'side', Math.atan2(u[2], u[1]), RANGE[pre ? 'neckSide' : 'side']);
    const fl = Math.atan2(u[0], u[1]);
    if (fl > 0) over(pre + 'flex', fl, RANGE[pre ? 'neckFlex' : 'flex']); else over(pre + 'arch', fl, RANGE[pre ? 'neckArch' : 'arch']);
  };
  joint(F.Rp, F.Rc, '');
  joint(F.Rc, F.Rh, 'neck ');
  const Rp = F.Rp, Rc = F.Rc;
  for (const k of ['L', 'R']) {
    // the knee: its bend direction against the front of the leg (the pelvis's forward, square to the leg)
    const H = P['hp' + k], K = P['kn' + k], A = P['an' + k], ax = unit(sub(A, H)), d = sub(K, H), b0 = sub(d, ax.map((x) => x * dot(d, ax)));
    if (Math.hypot(...b0) > 0.03) {
      // (the front of the leg as the solver takes it: the pelvis's forward turned up with the hip's bend,
      // square to the leg; measured against anything else a raised leg reads as turned)
      const b = unit(b0), hb = Math.atan2(dot(ax, Rp[0]), -dot(ax, Rp[1]));
      const fw1 = [0, 1, 2].map((i) => Rp[0][i] * Math.cos(hb) + Rp[1][i] * Math.sin(hb));
      const fr0 = sub(fw1, ax.map((x) => x * dot(fw1, ax))), side0 = cross(ax, fr0);
      // (turned out or in past what the hip turns, up to pointing straight backwards at pi)
      if (Math.hypot(...fr0) > 0.2) over('knee' + k + ' turned', Math.abs(Math.atan2(dot(b, unit(side0)), dot(b, unit(fr0)))), RANGE.kneeOut);
      // the ankle: the foot (heel to toes, square to the shin) pointing the way the knee does, give or take
      // (both square to the shin, and only a foot well off the shin's line: one along it has no twist to see)
      // (the knee's front as the thigh's direction square to the shin, as the figure takes it: taken from the
      // line from hip to ankle it swings round when the leg is folded tight, the heel by the hip, and a man
      // sitting on his heels read as having his feet on backwards)
      const sh = unit(sub(A, K)), ft = unit(sub(P['to' + k], P['he' + k])), f0 = sub(ft, sh.map((x) => x * dot(ft, sh))), th0 = unit(sub(K, H)), kb = sub(th0, sh.map((x) => x * dot(th0, sh)));
      // (only a foot more square to its shin than along it: one pointed along the shin and turned 30 degrees in
      // or out, kneeling, is an ankle rolled, not twisted)
      if (Math.hypot(...f0) > 0.8 && Math.hypot(...kb) > 0.28) over('ankle' + k + ' twisted', Math.acos(Math.max(-1, Math.min(1, dot(unit(f0), unit(kb))))), RANGE.ankle);
    }
    // the shoulder: the upper arm no further back behind him than a shoulder goes (unless it's out to the side)
    {
      // (down is 0, forward up to overhead is flexion; behind is only between straight down and straight back:
      // past that, round towards overhead, it's an arm raised, not one wrenched behind)
      const S = P['sh' + k], ua = unit(sub(P['el' + k], S)), fl = Math.atan2(dot(ua, Rc[0]), -dot(ua, Rc[1])), out = Math.abs(dot(ua, Rc[2]));
      if (out < 0.6 && fl < 0 && fl > -Math.PI / 2 - 0.3) over('shoulder' + k + ' behind', fl, RANGE.shoulderBack);
    }
    // The hip: the thigh against the TORSO, in the plane the leg swings in (the torso's own up, hips to chest,
    // and the pelvis's forward square to it). Down the body is 0, forward and up to the chest is flexion, behind
    // is extension. Measured against the pelvis's own axes instead, a man lying back read his thigh as folded a
    // whole turn the wrong way: the pelvis tips with him, the measure turned over, and every armbar, triangle and
    // guard underneath came out 1 to 2 rad past what a hip does while the bodies were fine.
    const th = unit(sub(K, H)), tors = sub(P.Ch, P.P), tl = Math.hypot(...tors);
    const up = tl > 1e-4 ? tors.map((v) => v / tl) : [0, 1, 0];
    // (spread out to the side: past what a hip opens, the legs splayed. A hip opens further the more it's
    // folded up — knees by the ribs in the mount, or sitting cross-legged, is 70 to 80 degrees, where a leg
    // straight down manages 55: the limit goes with the fold)
    const fold0 = Math.acos(Math.max(-1, Math.min(1, -dot(th, up))));
    over('hip' + k + ' splayed', Math.asin(Math.min(1, Math.abs(dot(th, Rp[2])))), RANGE.hipOut + 0.45 * Math.min(1, fold0 / 2.2));
    // (an arm held dead straight that isn't punching: locked out like a mannequin's)
    {
      const S2 = P['sh' + k], E2 = P['el' + k], W2 = P['fi' + k], u1 = unit(sub(E2, S2)), u2 = unit(sub(W2, E2));
      const straight = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2))));
      if (straight < RANGE.armBend) by['arm' + k + ' locked'] = Math.max(by['arm' + k + ' locked'] || 0, RANGE.armBend - straight);
    }
    // (0 is the thigh straight down the body, pi folded flat against the chest: it can't wrap, so there's no
    // "past the chest" case any more. Which side of him it's on only decides flexion from extension, and only
    // while the leg is near enough to straight down for behind to mean anything; the chest's own forward says
    // which way he faces, the pelvis's can be twisted off it)
    const hf = fold0;
    if (hf > 0.9 || dot(th, Rc[0]) >= 0) over('hip' + k + ' flex', hf, RANGE.hipFlex);
    else over('hip' + k + ' back', hf, RANGE.hipBack);
    // the elbow: its point (bend direction) shouldn't be forward and in, toward the body's front middle
    const S = P['sh' + k], E = P['el' + k], W = P['fi' + k], ea = unit(sub(W, S)), de = sub(E, S), e0 = sub(de, ea.map((x) => x * dot(de, ea)));
    if (Math.hypot(...e0) > 0.03) {
      const e = unit(e0), inward = unit(sub(P.Ch, S)), bad = unit([Rc[0][0] * 0.7 + inward[0] * 0.7, Rc[0][1] * 0.7 + inward[1] * 0.7, Rc[0][2] * 0.7 + inward[2] * 0.7]);
      // (its point within elbowWrong of straight forward-and-in: over by how much nearer than that)
      const near = Math.acos(Math.max(-1, Math.min(1, dot(e, bad))));
      if (near < RANGE.elbowWrong) by['elbow' + k + ' wrong way'] = Math.max(by['elbow' + k + ' wrong way'] || 0, RANGE.elbowWrong - near);
    }
  }
  let worst = 0, where = '';
  for (const k in by) if (by[k] > worst) { worst = by[k]; where = k; }
  return { worst: +worst.toFixed(2), where, by };
}
// A technique (or anything `go()` starts) checked for posture through `ms`: each man's worst moments.
export function postureTest(from, go, ms = 2000) {
  const cam = () => FVX().cam();
  from(); run(2500); go();
  const worst = { a: { v: 0 }, b: { v: 0 } }, list = [];
  for (let t = 0; t < ms; t += 15) {
    run(15);
    for (const s of ['a', 'b']) {
      const p = posture(cam()[s].v2);
      if (!p) continue;
      // (held up with nothing under him, more than 4 cm, on the mat)
      const fl = cam()[s].v2.base && !/^(guard|hurt|clinch)$/.test(cam()[s].v2.base) ? unsupported(cam()[s].v2, cam()[s === 'a' ? 'b' : 'a']) : 0;
      if (fl > 0.04) p.by.floating = fl;
      for (const k in p.by) list.push([p.by[k], t, s, k]);
      if (p.worst > worst[s].v) worst[s] = { v: p.worst, t, where: p.where };
    }
  }
  // the distinct troubles, worst first (each joint once per man)
  const seen = {}, top = [];
  for (const [v, t, s, k] of list.sort((x, y) => y[0] - x[0])) { if (seen[s + k]) continue; seen[s + k] = 1; top.push(s + ' ' + k + ' ' + v.toFixed(2) + ' @' + t); }
  return { worst, top: top.slice(0, 8) };
}
// Every technique for two (anim/pairs), each as where it starts and what starts it, and how long to watch.
export const TECHNIQUES = [
  { label: 'double-leg', ms: 2400, from: () => pos('stand'), go: () => { pos('guard', 'a'); hit('shoot', 'a'); } },
  { label: 'body-lock trip', ms: 2000, from: () => pos('clinch'), go: () => pos('guard', 'a') },
  { label: 'knee-cut pass to half guard', ms: 2000, from: () => pos('guard', 'a'), go: () => pos('half', 'a') },
  { label: 'half guard to side control', ms: 2000, from: () => pos('half', 'a'), go: () => pos('side', 'a') },
  { label: 'knee across to the mount', ms: 2000, from: () => pos('side', 'a'), go: () => pos('mount', 'a') },
  { label: 'taking the back from the mount', ms: 2200, from: () => pos('mount', 'a'), go: () => pos('back', 'a') },
  { label: 'hip-bump sweep', ms: 2000, from: () => pos('guard', 'a'), go: () => pos('guard', 'b') },
  { label: 'bridge and roll from the mount', ms: 2000, from: () => pos('mount', 'a'), go: () => pos('guard', 'b') },
  { label: 'guard back from side control', ms: 2000, from: () => pos('side', 'a'), go: () => pos('guard', 'a') },
  { label: 'technical stand-up', ms: 2300, from: () => pos('guard', 'a'), go: () => pos('stand') },
  { label: 'wall walk to the clinch', ms: 2100, from: () => pos('half', 'a'), go: () => pos('clinch') },
];
// The engine's attempts on the mat as the picture acts them out: a pass (or a sweep) stopped and taken back,
// one turned round partway into a reversal, and a major transition (a position skipped) going through the
// two techniques it skips over. `att`: the engine's word on it, as camMotion gets it.
const att = (by, from, to, out, x) => hit('pass', by, Object.assign({ from, to, out }, x || {}));
export const ATTEMPTS = [
  { label: 'knee cut denied', ms: 2300, from: () => pos('guard', 'a'), go: () => att('a', 'guard', 'half', 'deny') },
  { label: 'leg freed denied', ms: 2300, from: () => pos('half', 'a'), go: () => att('a', 'half', 'side', 'deny') },
  { label: 'knee across denied', ms: 2300, from: () => pos('side', 'a'), go: () => att('a', 'side', 'mount', 'deny') },
  { label: 'back take denied', ms: 2300, from: () => pos('mount', 'a'), go: () => att('a', 'mount', 'back', 'deny') },
  { label: 'hip bump denied', ms: 2300, from: () => pos('guard', 'a'), go: () => att('b', 'guard', 'guard', 'deny', { sweep: true }) },
  { label: 'bridge denied', ms: 2300, from: () => pos('mount', 'a'), go: () => att('b', 'mount', 'guard', 'deny', { sweep: true }) },
  { label: 'knee cut reversed', ms: 2400, from: () => pos('guard', 'a'), go: () => { att('a', 'guard', 'half', 'rev'); pos('guard', 'b'); } },
  { label: 'leg freed reversed', ms: 2400, from: () => pos('half', 'a'), go: () => { att('a', 'half', 'side', 'rev'); pos('half', 'b'); } },
  { label: 'knee across reversed', ms: 2400, from: () => pos('side', 'a'), go: () => { att('a', 'side', 'mount', 'rev'); pos('guard', 'b'); } },
  { label: 'back take reversed', ms: 2400, from: () => pos('mount', 'a'), go: () => { att('a', 'mount', 'back', 'rev'); pos('guard', 'b'); } },
  { label: 'guard straight to side control', ms: 3200, from: () => pos('guard', 'a'), go: () => { att('a', 'guard', 'side', 'land', { major: true }); pos('side', 'a'); } },
  { label: 'half guard straight to the mount', ms: 3200, from: () => pos('half', 'a'), go: () => { att('a', 'half', 'mount', 'land', { major: true }); pos('mount', 'a'); } },
];
// The engine's own grappling, live: on the mat from the guard, the man on top always passing and the man
// underneath sweeping or holding on, no getting up, stand-ups or submissions (the engine patched for it),
// `ms` of it at 2x on the picture's own clock (as record()). What the engine tried (`marks`, with when) and
// the pops, with when: { marks, pops, secs }. (`watch(t, cam)`: called each frame, to look closer.)
export async function liveGround(ms = 60000, bout = 1, watch = null) {
  const FP = MMA.engine.Fight.prototype, keep = { ch: FP.choose, gu: FP.attemptGetUp, sc: FP.groundStallCheck, sub: FP.attemptSub, mp: FP.movedPass };
  const marks = [], real = performance.now;
  let t = 0, started = false;
  FP.choose = function (s, phase, role) { if (phase === 'ground') return role === 'att' ? 'pass' : (this.rng.chance(0.5) ? 'attack' : 'retain'); return keep.ch.apply(this, arguments); };
  FP.attemptGetUp = function () {}; FP.groundStallCheck = function () {}; FP.attemptSub = function () {};
  FP.movedPass = function (s, from, to, out, major, sweep) { marks.push(t + ' ' + s.side + ' ' + from + '>' + to + ' ' + out + (major ? ' major' : '') + (sweep ? ' sweep' : '')); return keep.mp.apply(this, arguments); };
  try {
    await setup(bout, true, true);
    const f = fight();
    // (on the mat where a takedown would have put them: together, not each still in his corner, or the first
    // reversal has the engine bring them together and the picture slides the pair metres across the mat)
    f.place(f.B, f.A.x + 0.07 * Math.sign(f.B.x - f.A.x || 1), f.A.y);
    pos('guard', 'a'); run(3000);
    FVX().setSpeed(2);
    performance.now = () => clock;
    FVX().camFrame(clock);
    if (!FVX().camStats().running) { FVX().actions.fvpause(); started = true; }
    const cam = () => FVX().cam(), snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
    const frames = [];
    let lastG = null;
    for (t = 0; t < ms && f.pos === 'ground' && !f.over && !f.betweenRounds; t += 16) {
      f.A.plan.top = f.B.plan.top = 'control';
      clock += 16; FVX().camFrame(clock);
      const g = f.top + ':' + f.gpos;
      if (g !== lastG) { marks.push(t + ' now ' + g); lastG = g; }
      frames.push({ t, a: snap(cam().a), b: snap(cam().b) });
      if (watch) watch(t, cam());
    }
    // (and `fast`: anything moving quicker than 6 m/s on the mat, where nothing is thrown that fast: a run of
    // fast frames is one entry, with its top speed)
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), pops = [], fast = [], streak = {};
    for (const s of ['a', 'b']) for (let i = 2; i + 1 < frames.length; i++) {
      const J = frames[i][s], P = frames[i - 1][s], Q = frames[i - 2][s], N = frames[i + 1][s];
      for (const k in J) {
        const d = dd(J[k], P[k]), key = s + '.' + k;
        if (d > 0.03 && d > 2.5 * Math.max(dd(P[k], Q[k]), dd(N[k], J[k]), 0.004)) pops.push(frames[i].t + ' ' + key + ' ' + (d * 100).toFixed(1));
        if (d / 0.016 > 6) { if (!streak[key]) fast.push(streak[key] = { at: frames[i].t, what: key, ms: 0 }); streak[key].ms += 16; streak[key].top = Math.max(streak[key].top || 0, +(d / 0.016).toFixed(1)); }
        else streak[key] = null;
      }
    }
    return { secs: +(frames.length * 0.016).toFixed(1), marks, pops, fast: fast.map((r) => r.at + ' ' + r.what + ' ' + r.top + ' m/s ' + r.ms + 'ms') };
  } finally {
    performance.now = real; Object.assign(FP, { choose: keep.ch, attemptGetUp: keep.gu, groundStallCheck: keep.sc, attemptSub: keep.sub, movedPass: keep.mp });
    // (and the fight paused again at real speed, as setup() leaves it: left running at 2x, whatever was
    // filmed next went at double speed with the fight carrying on under it)
    FVX().setSpeed(1);
    if (started && FVX().camStats().running) FVX().actions.fvpause();
  }
}
// The picture drawn again at the same moment (the camera moved, say), nothing moving on.
export function still() { FVX().camFrame(clock); }
// A technique stepped through: `from()` sets up where they start, `go()` starts it; a frame at each of
// `times` (ms after go) from round each of `orbits`, beside the matching moment of a reference clip when
// there is one (`ref`: { id, at, rate }: review/footage/<id>.mp4, its time in seconds at go, and its seconds
// to the technique's). One row a moment. Saved as review/<name>.png.
export async function steps(name, { from, go, times, orbits = [0.4, 1.9], near = 2.8, ref = null, tw = 300, crop = [0.24, 0.16, 0.52, 0.72] }) {
  const T3 = FVX().three(), cv = document.querySelector('#fvcanvas');
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2])), cols = orbits.length + (ref ? 1 : 0), lw = 60;
  const out = document.createElement('canvas');
  out.width = lw + tw * cols; out.height = th * times.length;
  const o = out.getContext('2d');
  o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
  let v = null;
  if (ref) {
    v = document.createElement('video'); v.muted = true; v.src = '/review/footage/' + ref.id + '.mp4';
    await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error('no ' + ref.id)); });
  }
  const cam = FVX().cam();
  cam.a.nextFeint = cam.b.nextFeint = Infinity;
  T3.near = near; T3.orbit = orbits[0];
  from(); run(2500);
  go();
  let at = 0;
  for (let r = 0; r < times.length; r++) {
    run(times[r] - at); at = times[r];
    for (let c = 0; c < orbits.length; c++) {
      T3.orbit = orbits[c]; still();
      o.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], lw + c * tw, r * th, tw, th);
    }
    if (v) {
      v.currentTime = ref.at + times[r] / 1000 * (ref.rate || 1);
      await new Promise((res) => { v.onseeked = res; });
      const k = Math.min(tw / v.videoWidth, th / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k;
      o.drawImage(v, lw + orbits.length * tw + (tw - w) / 2, r * th + (th - h) / 2, w, h);
    }
    o.fillStyle = '#ff0'; o.font = 'bold 13px sans-serif'; o.fillText(times[r] + '', 6, r * th + 18);
    o.strokeStyle = '#222'; o.strokeRect(lw, r * th, tw * cols, th);
  }
  T3.near = null; T3.orbit = null;
  cam.a.nextFeint = cam.b.nextFeint = 0;
  return save(out, name);
}
// Stills of positions, each from round several sides (`orbits`, radians round from the fight cam's own
// angle), the camera `near` metres off, with the overlap measured on each; saved as review/<name>.png.
export async function views(name, list = POSITIONS, orbits = [0.4, 2.2], near = 2.8, tw = 400, crop = [0.22, 0.18, 0.56, 0.72]) {
  const T3 = FVX().three(), cv = document.querySelector('#fvcanvas');
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2])), cols = orbits.length <= 2 ? orbits.length * 2 : orbits.length;
  const out = document.createElement('canvas');
  out.width = tw * cols; out.height = th * Math.ceil(list.length * orbits.length / cols);
  const o = out.getContext('2d');
  o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
  let k = 0;
  for (const [label, g, sub, att] of list) {
    pos(g, 'a', sub || null, att || 'a'); T3.orbit = null; T3.near = near; run(2400);
    const ov = overlap(), txt = (s) => (ov[s] ? s + ' ' + ov[s].worst + ' ' + ov[s].where : '');
    for (const orb of orbits) {
      T3.orbit = orb; run(30);
      const x = (k % cols) * tw, y = Math.floor(k / cols) * th;
      o.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], x, y, tw, th);
      o.fillStyle = '#ff0'; o.font = 'bold 13px sans-serif'; o.fillText(label, x + 6, y + 16);
      o.font = '11px sans-serif'; o.fillText('overlap ' + txt('a') + ' / ' + txt('b'), x + 6, y + 30);
      k++;
    }
  }
  T3.orbit = null; T3.near = null;
  return save(out, name);
}
// Save a canvas into review/ (needs tools/devserver.py).
// A video of moves (WebM, made in the browser): rows as for reel(), each played at every speed asked for
// (1 = real time, 0.25 = a quarter speed), at 60 frames a second with a caption. Frames are handed to the
// recorder one at a time on an even clock, so the timing is true whatever the machine is doing.
const chan = new MessageChannel(), turns = [];
chan.port1.onmessage = () => { const r = turns.shift(); if (r) r(); };
const turn = () => new Promise((r) => { turns.push(r); chan.port2.postMessage(0); });
export async function video(rows, speeds = [1, 0.25], o = {}) {
  // (o.fps: 30 where the page can't draw 60 a second, in a hidden pane: frames slower than their time stretch
  // the video, real speed playing slow)
  const W = o.w || 960, H = o.h || 540, fps = o.fps || 60, cv = document.querySelector('#fvcanvas'), rc = document.createElement('canvas');
  // (the middle of the picture, cut to the video's shape)
  const zh = o.zoom || 0.86, zw = Math.min(1, zh * cv.height / cv.width * W / H), crop = o.crop || [(1 - zw) / 2, 0.04, zw, zh];
  rc.width = W; rc.height = H;
  const g = rc.getContext('2d'), stream = rc.captureStream(0), track = stream.getVideoTracks()[0];
  const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: o.bps || 5e6 }), chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  let next = performance.now();
  const shoot = (label) => {
    const sw = cv.width * crop[2], sh = cv.height * crop[3], k = Math.min(W / sw, H / sh);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.drawImage(grab(), cv.width * crop[0], cv.height * crop[1], sw, sh, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, 34);
    g.fillStyle = '#fff'; g.font = '600 18px sans-serif'; g.fillText(label, 12, 23);
    while (performance.now() < next) { /* hold the frame to its time */ }
    track.requestFrame();
    next += 1000 / fps;
  };
  const cam = FVX().cam();
  for (const sp of speeds) for (const r of rows) {
    cam.a.nextFeint = cam.b.nextFeint = Infinity;
    run(700);
    r.go();
    const n = Math.round((r.ms + 250) / (1000 / fps) / sp), label = r.label + (sp === 1 ? '' : '   (' + sp + 'x)');
    // (the recorder needs the page to breathe between frames; a message-channel turn does that without the
    // second-long wait a timer can be in a hidden tab, which would squeeze the frames after it together)
    next = performance.now();
    for (let i = 0; i < n; i++) {
      clock += 1000 / fps * sp; FVX().camFrame(clock); shoot(label);
      await turn();
      if (performance.now() > next + 40) next = performance.now();
    }
  }
  cam.a.nextFeint = cam.b.nextFeint = 0;
  await new Promise((res) => { rec.onstop = res; rec.stop(); });
  return new Blob(chunks, { type: 'video/webm' });
}
export async function save(canvas, name) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const r = await fetch('/review/' + name + '.png', { method: 'PUT', body: blob });
  return r.status;
}
export const STRIKES = [
  { label: 'jab', ms: 300, go: () => hit('jab', 'a') },
  { label: 'cross', ms: 360, go: () => hit('cross', 'a') },
  { label: 'hook', ms: 430, go: () => hit('hook', 'a') },
  { label: 'uppercut', ms: 400, go: () => hit('uppercut', 'a', { target: 'head' }) },
  { label: 'overhand', ms: 480, go: () => hit('overhand', 'a', { dmg: 10 }) },
  { label: 'body punch', ms: 400, go: () => hit('bodyPunch', 'a', { target: 'body' }) },
  { label: 'elbow', ms: 380, go: () => hit('elbow', 'a') },
  { label: 'knee', ms: 500, go: () => hit('knee', 'a', { target: 'body' }) },
];
export const KICKS_DEF = [
  { label: 'leg kick', ms: 560, go: () => hit('legKick', 'a', { target: 'legs' }) },
  { label: 'body kick', ms: 640, go: () => hit('bodyKick', 'a', { target: 'body' }) },
  { label: 'head kick', ms: 740, go: () => hit('headKick', 'a', { dmg: 12 }) },
  { label: 'jab, blocked', ms: 300, go: () => hit('jab', 'a', { land: false, blocked: true }) },
  { label: 'cross, slipped', ms: 360, go: () => hit('cross', 'a', { land: false }) },
  { label: 'shot, sprawled', ms: 820, go: () => hit('shoot', 'a', { land: false }) },
  { label: '1-2-hook', ms: 900, go: () => moves([{ key: 'jab', by: 'a' }, { key: 'cross', by: 'a' }, { key: 'hook', by: 'a', dmg: 9 }]) },
  { label: 'jab, counter', ms: 700, go: () => moves([{ key: 'jab', by: 'a', land: false }, { key: 'cross', by: 'b', dmg: 9 }]) },
];
