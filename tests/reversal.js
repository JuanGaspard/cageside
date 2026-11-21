// A reversal in the clinch: the man on the fence turns the other one onto it.
//
//   import * as R from './tests/reversal.js';
//   await R.setup()          // a fight, in the clinch, settled
//   R.once()                 // one reversal, measured
//   R.ab(5)                  // five each way, the old swap (cam.noTurn) against the turn, alternating
//
// The engine does a reversal by swapping the two men's spots. What this measures is what the picture does
// with that: how long the facing takes to come round, how fast it turns at its quickest, how close the two
// trunks come on the way (a pair walking through one another measures near zero), and the snaps — a joint
// of the trunk, arms or head moving more than 3 cm in one 15 ms frame (2 m/s; a clinch left alone has
// none), or a foot or knee moving more than 8 cm in one (5 m/s, faster than a step swings a foot).
import * as C from './camtest.js';
const FV = () => MMA.fightview;

export async function setup() {
  await C.setup(0, true, true);
  const f = C.fight();
  f.pos = 'clinch'; f.clinchCtrl = 'a'; f.top = null; f.gpos = null;
  for (const g of [FV().cam().a, FV().cam().b]) g.nextFeint = Infinity;
  C.run(4000);
}

const ang = (g) => (g.fw && g.fw.th != null ? g.fw.th : g.thShown || 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const LEG = /^(an|he|to|kn|ft|hp)/;

export function once(ms = 2600) {
  const f = C.fight(), cam = FV().cam(), A = f.A, B = f.B;
  for (const g of [cam.a, cam.b]) g.nextFeint = Infinity;
  // (the engine's own reversal, done by hand: swap the spots, hand over control)
  const was = f.clinchCtrl, tx = A.x, ty = A.y;
  A.x = B.x; A.y = B.y; B.x = tx; B.y = ty;
  f.clinchCtrl = was === 'a' ? 'b' : 'a';
  f.revs = (f.revs || 0) + 1;
  const th0 = ang(cam.a);
  let prev = null, lastTh = th0, maxW = 0, minGap = 9, upper = 0, upperBig = 0, worst = 0, worstAt = '', legs = 0, done = null;
  for (let t = 0; t < ms; t += 15) {
    C.run(15);
    const pa = cam.a.v2 && cam.a.v2.pts, pb = cam.b.v2 && cam.b.v2.pts;
    if (!pa || !pb) continue;
    const th = ang(cam.a), w = Math.abs(wrap(th - lastTh)) / 0.015;
    lastTh = th;
    if (w > maxW) maxW = w;
    if (done == null && Math.abs(wrap(th - th0)) > Math.PI * 0.92) done = t;
    minGap = Math.min(minGap, Math.hypot(pa.Ch[0] - pb.Ch[0], pa.Ch[2] - pb.Ch[2]));
    const now = { a: pa, b: pb };
    if (prev) for (const s of ['a', 'b']) for (const k in now[s]) {
      const p = now[s][k], q = prev[s][k];
      if (!q) continue;
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (LEG.test(k)) { if (d > 0.08) legs++; } else { if (d > 0.03) upper++; if (d > 0.06) upperBig++; if (d > worst) { worst = d; worstAt = s + k + '@' + t; } }
    }
    prev = { a: {}, b: {} };
    for (const s of ['a', 'b']) for (const k in now[s]) prev[s][k] = now[s][k].slice();
  }
  return { turnedIn: done, fastestTurnDegPerSec: Math.round(maxW * 180 / Math.PI), closestChests: +minGap.toFixed(3), upperSnaps: upper, upperOver6cm: upperBig, worstUpper: +worst.toFixed(3), worstAt, legSnaps: legs };
}

const median = (out) => {
  const med = (k) => { const v = out.map((o) => o[k]).filter((x) => x != null).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
  return { turnedIn: med('turnedIn'), fastestTurnDegPerSec: med('fastestTurnDegPerSec'), closestChests: med('closestChests'), upperSnaps: med('upperSnaps'), upperOver6cm: med('upperOver6cm'), worstUpper: med('worstUpper'), legSnaps: med('legSnaps'), worstAt: out.map((o) => o.worstAt) };
};

export function many(n = 6) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(once());
  return { runs: out, median: median(out) };
}

// the old swap against the turn, alternating so nothing drifts between them
export function ab(n = 5) {
  const cam = FV().cam(), off = [], on = [];
  for (let i = 0; i < n; i++) {
    cam.noTurn = true; off.push(once());
    cam.noTurn = false; on.push(once());
  }
  cam.noTurn = false;
  return { swap: median(off), turn: median(on) };
}
