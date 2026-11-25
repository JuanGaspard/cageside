// Step 4: the hooks, overhands, uppercuts and elbows, filmed frame by frame (review/<name>.png), and the ground
// elbows from each position on top.
//   import * as S from './tests/strikes4.js';  await S.film('s4a', 0.3)   (orbit: the camera's angle round them)
import * as C from './camtest.js';
const FVX = () => MMA.fightview;
export const ROWS = [
  { label: 'hook', ms: 430, go: () => C.hit('hook', 'a') },
  { label: 'overhand', ms: 480, go: () => C.hit('overhand', 'a', { dmg: 10 }) },
  { label: 'uppercut', ms: 400, go: () => C.hit('uppercut', 'a') },
  { label: 'elbow', ms: 380, go: () => C.hit('elbow', 'a') },
];
export async function film(name = 's4', orbit = 0.3, frames = 9, rows = ROWS, tw = 200) {
  await C.setup(1, true, true);
  const T3 = FVX().three(); T3.near = 2.7; T3.orbit = orbit;
  C.run(1200);
  const out = C.reel(rows, frames, tw, [0.18, 0.08, 0.64, 0.86]);
  T3.orbit = null; T3.near = null;
  return C.save(out, name);
}
// Each strike measured on the figures, `reps` times from the stance (or `g`, a position on top):
//   hit:   fist (or the elbow, for an elbow) to the middle of his head at the impact, metres
//   bend:  the elbow's inside angle at the impact, degrees (180 straight; a hook ~90, an uppercut ~80-100)
//   path:  which way the fist was travelling over the 60 ms before it, in his own frame — fwd (towards the other
//          man), up, across (towards his rear side); a hook comes across, an overhand down, an uppercut up
//   over:  the most the upper arm turned past what a shoulder turns, over the whole strike (FIG.armOver)
//   snap:  the biggest one-frame jump of any of his points, cm at 60 fps
export async function measure(key, opts = {}) {
  const { reps = 3, g = null, extra = {} } = opts;
  await C.setup(1, true, true);
  const cam = FVX().cam(), FG = FVX().figure, A = cam.a;
  const out = [];
  for (let r = 0; r < reps; r++) {
    if (g) C.pos(g, 'a'); else C.pos('stand');
    A.nextFeint = cam.b.nextFeint = Infinity;
    C.run(1500);
    C.hit(key, 'a', Object.assign(g ? { target: 'head' } : {}, extra));
    const act = A.acts[A.acts.length - 1];
    const sd = act && act.C && act.C.aim ? (act.C.aim.hand || act.C.aim.elbow) : 'R', isElbow = act && act.C && act.C.aim && act.C.aim.elbow;
    let prev = null, snap = 0, over = 0, at = null;
    const trail = [];
    for (let t = 0; t < 900; t += 16) {
      C.run(16);
      const P = A.v2.pts, Q = cam.b.v2.pts;
      if (prev) for (const k in P) { const d = Math.hypot(P[k][0] - prev[k][0], P[k][1] - prev[k][1], P[k][2] - prev[k][2]); if (d > snap) snap = d; }
      prev = {}; for (const k in P) prev[k] = P[k].slice();
      const dir = (p, q) => { const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...d) || 1; return d.map((v) => v / l); };
      if (A.v2.fr && A.v2.fr.Rc) over = Math.max(over, FG.armOver(dir(P['sh' + sd], P['el' + sd]), dir(P['el' + sd], P['fi' + sd]), A.v2.fr.Rc, sd === 'L' ? -1 : 1));
      // (the fist against his own chest: the punch's shape, not the step he takes with it)
      trail.push([P['fi' + sd][0] - P.Ch[0], P['fi' + sd][1] - P.Ch[1], P['fi' + sd][2] - P.Ch[2]]);
      if (!at && act && act.lt != null && act.C && act.lt >= act.C.impact) {
        const f0 = trail[Math.max(0, trail.length - 5)], f1 = trail[trail.length - 1];
        let lx = P.hpR[0] - P.hpL[0], lz = P.hpR[2] - P.hpL[2]; const ll = Math.hypot(lx, lz); lx /= ll; lz /= ll;
        let fx = Q.P[0] - P.P[0], fz = Q.P[2] - P.P[2]; const fl = Math.hypot(fx, fz); fx /= fl; fz /= fl;
        const v = [f1[0] - f0[0], f1[1] - f0[1], f1[2] - f0[2]], vl = Math.hypot(...v) || 1;
        // (+ : across the front of him, towards the other hand's side — which side is which read off where the
        // shoulders are, since a southpaw's figure is mirrored)
        const other = P['sh' + (sd === 'L' ? 'R' : 'L')], mine = P['sh' + sd], sx = other[0] - mine[0], sz = other[2] - mine[2], sl = Math.hypot(sx, sz) || 1;
        const across = (v[0] * sx + v[2] * sz) / sl / vl;
        const u = dir(P['el' + sd], P['sh' + sd]), w = dir(P['el' + sd], P['fi' + sd]);
        // (an elbow lands with its point and the top of the forearm: a quarter of the way to the fist)
        const hitPt = isElbow ? [0, 1, 2].map((i) => P['el' + sd][i] + 0.25 * (P['fi' + sd][i] - P['el' + sd][i])) : P['fi' + sd];
        at = { hit: +Math.hypot(hitPt[0] - Q.Hd[0], hitPt[1] - Q.Hd[1], hitPt[2] - Q.Hd[2]).toFixed(2),
          bend: Math.round(Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1] + u[2] * w[2]))) * 180 / Math.PI),
          path: { fwd: +((v[0] * fx + v[2] * fz) / vl).toFixed(2), up: +(v[1] / vl).toFixed(2), across: +across.toFixed(2) } };
      }
    }
    out.push(Object.assign({ clip: act && act.C && act.C.id }, at || { hit: null }, { over: Math.round(over * 180 / Math.PI), snapCm: Math.round(snap * 100) }));
  }
  return out;
}
// on the mat: a ground elbow and a ground punch from each position on top
export async function ground(name = 's4g', orbit = 0.9, frames = 8, tw = 200) {
  await C.setup(1, true, true);
  const T3 = FVX().three(); T3.near = 2.6; T3.orbit = orbit;
  const rows = [];
  for (const g of ['guard', 'half', 'side', 'mount', 'fence']) {
    rows.push({ label: 'elbow ' + g, ms: 420, go: () => { C.pos(g, 'a'); C.run(1600); C.hit('gnpElbow', 'a'); } });
  }
  const out = C.reel(rows, frames, tw, [0.15, 0.15, 0.7, 0.8]);
  T3.orbit = null; T3.near = null;
  return C.save(out, name);
}
