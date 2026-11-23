// The upper arm's turn about its own length: what a kimura cranks, and what the figure was doing to itself.
//
//   import * as S from './tests/shoulder.js';
//   await S.positions()          // the clinch and every position on the mat, each man, each arm: the worst turn
//   await S.live(60)             // a minute of real fights, the same, by position
//
// How it's read (swing and twist). From the arm hanging straight down with the forearm pointing forward — the
// rest the turn is counted from — the upper arm is swung the shortest way round to where it actually points,
// carrying the forward and the outward-to-his-side directions with it. The forearm's direction square to the
// upper arm, against those, is the turn: towards his middle is turning in (internal rotation; a kimura is that
// cranked), away from it turning out (external; the americana). A man can turn the arm in a long way with it
// down by his side — the hand behind the small of his back is about 110 degrees — and less the higher the arm
// is lifted, about 70 with it out level; out, about 90 anywhere. Past those is the arm the user saw: the elbow
// up and out and the hand gone round behind him, a man in a kimura of his own making. Only an arm bent enough
// for the forearm to have a direction is read (bent 20 degrees or more), and not one raised straight overhead,
// where the swing has no one way round.
import * as C from './camtest.js';
const FV = () => MMA.fightview;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const flat = (v, u) => sub(v, mul(u, dot(v, u)));
const turn = (v, u, a) => add(add(mul(v, Math.cos(a)), mul(cross(u, v), Math.sin(a))), mul(u, dot(u, v) * (1 - Math.cos(a))));

// the limits, by how high the arm is lifted (0 hanging, pi/2 level): turned in, turned out — the solve's own
// (FIG.ROM, shoulderTwist), so the two can't drift apart
const ROM = () => (FV().figure && FV().figure.ROM) || {};
export const LIM = { get inDown() { return ROM().twInDown || 1.95; }, get inLevel() { return ROM().twInLevel || 1.25; }, get out() { return ROM().twOut || 1.6; } };
export const limIn = (elev) => LIM.inDown + (LIM.inLevel - LIM.inDown) * Math.min(1, elev / (Math.PI / 2));

// { tw: + in / - out (rad), elev, over: rad past the limit (0 inside) } or null
export function twist(P, Rc, k) {
  const S = P['sh' + k], E = P['el' + k], W = P['fi' + k];
  if (!S || !E || !W) return null;
  const up = unit(Rc[1]), fw = unit(flat(Rc[0], up)), out = unit(flat(sub(S, P.Ch), up));
  const u = unit(sub(E, S)), fa = unit(sub(W, E)), p = flat(fa, u);
  if (len(p) < 0.34) return null;                       // (straight: no forearm direction to read)
  const d0 = mul(up, -1), th = Math.acos(Math.max(-1, Math.min(1, dot(d0, u))));
  if (th > 2.75) return null;                           // (overhead)
  const ax = cross(d0, u), al = len(ax);
  const f1 = al > 1e-6 ? turn(fw, mul(ax, 1 / al), th) : fw, o1 = al > 1e-6 ? turn(out, mul(ax, 1 / al), th) : out;
  const pu = unit(p), tw = Math.atan2(-dot(pu, o1), dot(pu, f1));
  const over = tw > 0 ? Math.max(0, tw - limIn(th)) : Math.max(0, -tw - LIM.out);
  return { tw, elev: th, over };
}

const deg = (r) => Math.round(r * 180 / Math.PI);
function sampleInto(acc, label) {
  const cam = FV().cam();
  for (const s of ['a', 'b']) {
    const g = cam[s].v2;
    if (!g || !g.pts || !g.fr) continue;
    for (const k of ['L', 'R']) {
      const r = twist(g.pts, g.fr.Rc, k);
      if (!r) continue;
      const A = acc[label] || (acc[label] = { n: 0, over: 0, worstIn: 0, worstOut: 0, worstOver: 0, where: '' });
      A.n++;
      if (r.tw > A.worstIn) A.worstIn = r.tw;
      if (-r.tw > A.worstOut) A.worstOut = -r.tw;
      if (r.over > 0) { A.over++; if (r.over > A.worstOver) { A.worstOver = r.over; A.where = s + k + ' ' + (g.base || '') + ' ' + (r.tw > 0 ? 'in ' : 'out ') + deg(Math.abs(r.tw)) + ' at ' + deg(r.elev) + ' up'; } }
    }
  }
}
const fmt = (acc) => {
  const out = {};
  for (const k in acc) { const A = acc[k]; out[k] = { overPct: +(100 * A.over / Math.max(1, A.n)).toFixed(1), worstInDeg: deg(A.worstIn), worstOutDeg: deg(A.worstOut), worstOverDeg: deg(A.worstOver), where: A.where }; }
  return out;
};

// the clinch, then each position (and lock) on the mat with each man on top, settled and then worked: the
// man on top throws a few ground strikes, standing in the clinch a few knees, so the arms move
export const SITUATIONS = [
  ['clinch', () => C.pos('clinch'), () => { C.hit('knee', 'a', { target: 'body' }); }],
  ['clinch, b on top', () => C.pos('clinch'), () => { C.hit('knee', 'b', { target: 'body' }); }],
  ...C.POSITIONS.map(([label, g, sub, att]) => [label, () => C.pos(g, 'a', sub || null, att || 'a'), sub ? null : () => C.hit('gnpPunch', 'a')]),
  ...['guard', 'half', 'side', 'mount', 'back'].map((g) => [g + ', b on top', () => C.pos(g, 'b'), () => C.hit('gnpPunch', 'b')]),
];
export let last = null;
export async function positions(list = SITUATIONS, ms = 3000) {
  await C.setup(0, true, true);
  const f = C.fight();
  const acc = {};
  for (const [label, at, work] of list) {
    if (label.startsWith('clinch')) { f.clinchCtrl = label.includes('b on top') ? 'b' : 'a'; }
    at(); C.run(1800);
    for (let t = 0; t < ms; t += 15) { if (work && t % 900 === 0) work(); C.run(15); sampleInto(acc, label); }
    C.pos('stand'); C.run(1500);
  }
  return (last = fmt(acc));
}
// Each situation twice in one page, the turn not held (ROM.twOn off) and held, so nothing drifts between them.
// Also counts snaps: an elbow or a hand moving more than 3 cm in one 15 ms frame.
export async function ab(list = SITUATIONS, ms = 3000) {
  await C.setup(0, true, true);
  const f = C.fight(), R = ROM(), res = {};
  for (const [label, at, work] of list) {
    for (const on of [false, true]) {
      R.twOn = on;
      if (label.startsWith('clinch')) f.clinchCtrl = label.includes('b on top') ? 'b' : 'a';
      at(); C.run(1800);
      const acc = {}; let snaps = 0, prev = null;
      for (let t = 0; t < ms; t += 15) {
        if (work && t % 900 === 0) work();
        C.run(15); sampleInto(acc, label);
        const cam = FV().cam(), now = {};
        for (const s of ['a', 'b']) for (const j of ['elL', 'elR', 'fiL', 'fiR']) { const p = cam[s].v2 && cam[s].v2.pts && cam[s].v2.pts[j]; if (p) now[s + j] = p.slice(); }
        if (prev) for (const j in now) if (prev[j] && len(sub(now[j], prev[j])) > 0.03) snaps++;
        prev = now;
      }
      const r = fmt(acc)[label] || {};
      (res[label] = res[label] || {})[on ? 'held' : 'free'] = { overPct: r.overPct, worstOverDeg: r.worstOverDeg, snaps };
      C.pos('stand'); C.run(1500);
    }
  }
  R.twOn = true;
  return (last = res);
}
// The same for the techniques for two and the attempts (camtest's TECHNIQUES, ATTEMPTS), each watched from
// its start, the turn not held and held.
export async function abTech(list = [...C.TECHNIQUES, ...C.ATTEMPTS]) {
  await C.setup(0, true, true);
  const R = ROM(), res = {};
  for (const T of list) for (const on of [false, true]) {
    R.twOn = on;
    T.from(); C.run(2500); T.go();
    const acc = {};
    for (let t = 0; t < T.ms; t += 15) { C.run(15); sampleInto(acc, T.label); }
    const r = fmt(acc)[T.label] || {};
    (res[T.label] = res[T.label] || {})[on ? 'held' : 'free'] = { overPct: r.overPct, worstOverDeg: r.worstOverDeg, where: r.where };
    C.pos('stand'); C.run(1500);
  }
  R.twOn = true;
  return res;
}
// The frame with the worst arm in each situation, filmed close (saved to review/<name>.png), to see whether
// what the numbers flag is what the eye objects to.
export async function snaps(name = 'shoulder', list = SITUATIONS, ms = 3000, orbits = [0.4, 2.2]) {
  await C.setup(0, true, true);
  const f = C.fight(), T3 = FV().three(), cv = document.querySelector('#fvcanvas'), crop = [0.22, 0.14, 0.56, 0.76];
  const tw = 360, th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2]));
  const out = document.createElement('canvas'); out.width = tw * orbits.length * 2; out.height = th * Math.ceil(list.length / 2);
  const o = out.getContext('2d'); o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
  let k = 0;
  for (const [label, at, work] of list) {
    if (label.startsWith('clinch')) f.clinchCtrl = label.includes('b on top') ? 'b' : 'a';
    T3.near = 2.6;
    for (const orb of orbits) {
      T3.orbit = orb;
      at(); C.run(1800);
      let best = 0, txt = 'nothing over';
      const x = (k % (orbits.length * 2)) * tw, y = Math.floor(k / (orbits.length * 2)) * th;
      o.drawImage(C.grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], x, y, tw, th);
      for (let t = 0; t < ms; t += 15) {
        if (work && t % 900 === 0) work();
        C.run(15);
        const cam = FV().cam();
        for (const s of ['a', 'b']) for (const kk of ['L', 'R']) {
          const g = cam[s].v2, r = g && g.pts && g.fr ? twist(g.pts, g.fr.Rc, kk) : null;
          if (r && r.over > best) { best = r.over; txt = s + kk + (r.tw > 0 ? ' in ' : ' out ') + deg(Math.abs(r.tw)) + ' at ' + deg(r.elev) + ' up, t' + t; o.drawImage(C.grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], x, y, tw, th); }
        }
      }
      o.fillStyle = '#ff0'; o.font = 'bold 13px sans-serif'; o.fillText(label, x + 6, y + 16);
      o.font = '12px sans-serif'; o.fillText(txt, x + 6, y + 31);
      k++;
      C.pos('stand'); C.run(1500);
    }
  }
  T3.orbit = null; T3.near = null;
  return C.save(out, name);
}
// the techniques for two (the takedown, the passes, the sweeps, getting up), each watched from its start
export async function techniques(list = C.TECHNIQUES) {
  await C.setup(0, true, true);
  const acc = {};
  for (const T of list) { T.from(); C.run(2500); T.go(); for (let t = 0; t < T.ms; t += 15) { C.run(15); sampleInto(acc, T.label); } C.pos('stand'); C.run(1500); }
  return fmt(acc);
}
// real fights through the view, by what the picture is showing
export async function live(secs = 60, bouts = [0, 1, 2, 3, 4]) {
  const acc = {}, t0 = Date.now();
  for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
    await C.setup(bouts[i % bouts.length], true, true);
    const f = C.fight(), cam = FV().cam();
    for (let k = 0; k < 160 && !f.over && Date.now() - t0 < secs * 1000; k++) {
      C.play(300, 2);
      const b = cam.a.v2 && cam.a.v2.base, where = f.pos === 'ground' ? 'ground ' + (f.gpos || '') + (f.subLock ? ' ' + f.subLock.type : '') : f.pos;
      sampleInto(acc, where);
    }
  }
  return fmt(acc);
}
