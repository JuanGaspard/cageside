// Through the cage: how far any part of either man goes through the fence, on a takedown against it.
//
//   import * as F from './tests/fence.js';
//   await F.takedowns(6)        // six takedowns with the man taken down pinned on the fence, each watched 4 s
//
// The fence is the octagon's eight panels, the apothem (UNIT_M cos pi/8, 4.25 m) from the middle. Each joint
// is a ball (the head 0.1 of his size, the trunk 0.13, a shoulder or hip 0.08, the rest 0.05) and its depth
// through a panel is how far that ball is past it; the deepest panel counts, as in a corner.
import * as C from './camtest.js';
const FV = () => MMA.fightview;
const UNIT_M = 4.6, APO_M = Math.cos(Math.PI / 8) * UNIT_M;
const RAD = { Hd: 0.1, Ch: 0.13, W: 0.13, P: 0.13, N: 0.08, shL: 0.08, shR: 0.08, hpL: 0.08, hpR: 0.08 };

export function depth(p, r) {
  let worst = -9;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; worst = Math.max(worst, p[0] * Math.cos(a) + p[2] * Math.sin(a) - (APO_M - r)); }
  return worst;
}
// the deepest point of either man through the fence now: { d (m), who }
export function through() {
  const cam = FV().cam();
  let best = { d: 0, who: '' };
  for (const s of ['a', 'b']) {
    const g = cam[s].v2, P = g && g.pts, sc = g && g.body ? g.body.s : 1;
    if (!P) continue;
    for (const k in P) {
      if (!Array.isArray(P[k]) || P[k].length !== 3 || /^(wr|jaw|Nt)/.test(k)) continue;
      const d = depth(P[k], (RAD[k] || 0.05) * sc);
      if (d > best.d) best = { d, who: s + ' ' + k + ' ' + (g.base || '') };
    }
  }
  return best;
}

// One man (`pin`) on the fence at a random spot round the cage, the other in front of him; the other takes
// him down (into `g`), and the two are watched for `ms`.
export function onFence(pin = 'a', g = 'guard', ms = 4000, ang = Math.random() * 2 * Math.PI) {
  const f = C.fight(), P = pin === 'a' ? f.A : f.B, O = P.opp;
  C.pos('stand');
  const R = 0.86 * Math.cos(Math.PI / 8), rr = R - 0.3;
  P.x = Math.cos(ang) * R; P.y = Math.sin(ang) * R; O.x = Math.cos(ang) * rr; O.y = Math.sin(ang) * rr;
  f.updateCage && f.updateCage();
  C.run(3000);
  const by = pin === 'a' ? 'b' : 'a';
  C.pos(g, by); C.hit('shoot', by);
  let worst = { d: 0, who: '' }, frames = 0, n = 0, sum = 0;
  for (let t = 0; t < ms; t += 15) {
    C.run(15); n++;
    const b = through();
    if (b.d > 0.02) frames++;
    sum += Math.max(0, b.d);
    if (b.d > worst.d) worst = { d: b.d, who: b.who, t };
  }
  return { worst: +worst.d.toFixed(3), where: worst.who, at: worst.t, over2cm: +(100 * frames / n).toFixed(1), mean: +(sum / n * 100).toFixed(2) };
}
export async function takedowns(n = 6, list = ['guard', 'half', 'side']) {
  await C.setup(0, true, true);
  const out = [];
  for (let i = 0; i < n; i++) out.push(Object.assign({ g: list[i % list.length] }, onFence(i % 2 ? 'b' : 'a', list[i % list.length], 4000, i * 0.9 + 0.3)));
  const ws = out.map((o) => o.worst).sort((x, y) => x - y);
  return { median: ws[ws.length >> 1], worst: ws[ws.length - 1], runs: out };
}
