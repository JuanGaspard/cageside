// Measuring a technique for two: whether the two of them are actually on each other, and whether they get
// there like bodies do.
//
//   import * as C from './camtest.js'; import * as P from './pairs.js';
//   await C.setup(); P.med(P.SPRAWL, 5)      // the median of five runs
//
// What it reads, each the worst (or the closest) moment of the whole technique:
//   chest        the two chests' centres at their closest, in metres. Two men in contact through the trunk
//                are about a trunk's thickness apart; half a metre is two men standing near each other.
//   hands        the nearer man's fists to the other's trunk at their closest: on him, or reaching at air.
//   legs         the fists of whichever of them the technique has holding the legs (`holds`) to the other's
//                knees and hips, at their closest: a double-leg is two hands behind the knees, so this is
//                whether he has hold of them at all.
//   over         how far the one man's chest is above the other's, where one of them is meant to be on top.
//   overlap      the deepest either body is inside the other (camtest's own measure), and the mean.
//   pops         joints that moved over 3 cm in a frame and over 2.5 times what they moved either side of
//                it: the jolts (camtest's techTest test).
//   drop, v      the lower man's hips: how far they fall, and the fastest they fall, against what the same
//                fall under gravity alone would reach (`free`). A man throwing himself down beats it; two
//                thirds of it is the float.
//
// Everything here is only worth comparing inside one page load: `setup` burns a varying number of frames
// waiting for the picture, so the same build reads differently on two loads. A/B with the flag, not the
// reload (`MMA.fightview.anim.PAIRS.sprawlStuff` deleted and put back, say).
import * as C from './camtest.js';

const FVX = () => window.MMA.fightview;
const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
const other = (k) => (/[LR]$/.test(k) ? k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L') : k);

// A shot stuffed by a sprawl: `a` shoots and `b` sprawls, so `b` is the man on top of it.
export const SPRAWL = { label: 'shot stuffed by a sprawl', ms: 1700, over: 'b', holds: 'low',
  from: () => { C.pos('stand'); C.run(1800); }, go: () => C.hit('shoot', 'a', { land: false }) };
// A double-leg finished: `a` shoots and ends on top, `b` is taken down.
export const DOUBLE = { label: 'double-leg finished', ms: 2400, over: 'a', holds: 'up',
  from: () => { C.pos('stand'); C.run(2200); }, go: () => { C.pos('guard', 'a'); C.hit('shoot', 'a'); } };

export function one(T) {
  const cam = () => FVX().cam();
  T.from();
  // (no feints while we measure. The picture throws one now and then when a man is idle, at a random
  // moment, and it moves the body 3 to 5 cm a frame: landing on the frames either side of the technique it
  // put 20-odd joints over the jolt test, and whether it happened at all was the run-to-run difference
  // between 0 jolts and 40)
  for (const g of [FVX().cam().a, FVX().cam().b]) g.nextFeint = Infinity;
  T.go();
  const fr = [];
  let worst = 0, where = '', sum = 0, n = 0, chest = 9, hands = 9, legs = 9, over = -9;
  for (let t = 0; t < T.ms; t += 15) {
    C.run(15);
    const A = cam().a.v2, B = cam().b.v2;
    if (!A || !B) continue;
    const up = T.over === 'a' ? A : B, lo = up === A ? B : A;
    fr.push({ t, a: snap(cam().a), b: snap(cam().b), y: lo.pts.P[1], yu: up.pts.P[1] });
    chest = Math.min(chest, d(A.pts.Ch, B.pts.Ch));
    over = Math.max(over, up.pts.Ch[1] - lo.pts.Ch[1]);
    for (const h of ['fiL', 'fiR']) for (const j of ['W', 'Ch']) hands = Math.min(hands, d(up.pts[h], lo.pts[j]));
    const grab = T.holds === 'up' ? up : lo, grabbed = grab === up ? lo : up;
    for (const h of ['fiL', 'fiR']) for (const j of ['knL', 'knR', 'hpL', 'hpR']) legs = Math.min(legs, d(grab.pts[h], grabbed.pts[j]));
    const o = C.overlap(), w = Math.max(o.a ? o.a.worst : 0, o.b ? o.b.worst : 0);
    sum += w; n++;
    if (w > worst) { worst = w; where = t + ' ' + (o.a && o.a.worst === w ? 'a:' + o.a.where : 'b:' + o.b.where); }
  }
  const at = {};
  let pops = 0;
  for (const s of ['a', 'b']) for (let i = 2; i + 1 < fr.length; i++) {
    const J = fr[i][s], P = fr[i - 1][s], Q = fr[i - 2][s], N = fr[i + 1][s];
    for (const k in J) {
      const dv = d(J[k], P[k]);
      if (dv > 0.03 && dv > 2.5 * Math.max(d(P[k], Q[k]), d(N[k], J[k]), 0.004)
        && !(P[other(k)] && d(J[k], P[other(k)]) < Math.max(0.03, 0.5 * dv))) { pops++; at[fr[i].t] = (at[fr[i].t] || 0) + 1; }
    }
  }
  const hips = (key) => {
    let v = 0, y0 = 0, y1 = 9;
    for (let i = 1; i < fr.length; i++) v = Math.min(v, (fr[i][key] - fr[i - 1][key]) / 0.015);
    for (const r of fr) { y0 = Math.max(y0, r[key]); y1 = Math.min(y1, r[key]); }
    return { drop: y0 - y1, v, free: -Math.sqrt(2 * 9.81 * (y0 - y1)) };
  };
  return { chest, hands, legs, over, worst, where, mean: sum / n, pops, at, low: hips('y'), up: hips('yu') };
}

// `k` runs of it, each read's median (and every run's deepest moment and where the jolts fell, which vary)
export function med(T, k = 5) {
  const rs = [];
  for (let i = 0; i < k; i++) rs.push(one(T));
  const m = (f) => { const a = rs.map(f).sort((x, y) => x - y); return +a[a.length >> 1].toFixed(3); };
  const jolts = {};
  for (const r of rs) for (const t in r.at) jolts[t] = (jolts[t] || 0) + r.at[t];
  return { label: T.label, runs: k,
    chest: m((r) => r.chest), hands: m((r) => r.hands), legs: m((r) => r.legs), over: m((r) => r.over),
    overlap: m((r) => r.worst), overlapMean: m((r) => r.mean), deepest: rs.map((r) => r.where),
    pops: m((r) => r.pops), jolts,
    lowHips: { drop: m((r) => r.low.drop), v: m((r) => r.low.v), free: m((r) => r.low.free) },
    upHips: { drop: m((r) => r.up.drop), v: m((r) => r.up.v), free: m((r) => r.up.free) } };
}
