// Does what lands, land? Where each blow is at the frame it's scored, and how far that is from what it hit.
//
//   import * as X from './tests/reach.js';
//   await X.run(40)                 // 40 s of real fights through the view, every blow that lands measured
//   X.report(X.last)                // again, from what was collected
//
// The view logs every blow at the frame it lands (cam.landLog, in landed2): the striker's joints and the
// other man's. The gap is from the part that lands — the fist, the elbow, the knee, the shin for a kick —
// to the surface of what it was scored against: his head (0.105 of his size, the same ball the contact
// pass uses), his trunk (between waist and chest), his thigh or calf. Under 5 cm is a blow landing; past
// that you can see daylight between them.
import * as C from './camtest.js';
const FV = () => MMA.fightview;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
// from point p to the segment a-b
const toSeg = (p, a, b) => { const ab = sub(b, a), ap = sub(p, a), l = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1, u = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l)); return len(sub(ap, [ab[0] * u, ab[1] * u, ab[2] * u])); };
// between two segments (sampled: plenty for a gap of centimetres)
const segSeg = (a, b, c, d) => { let m = 9; for (let i = 0; i <= 10; i++) { const u = i / 10, p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; m = Math.min(m, toSeg(p, c, d)); } return m; };

export function gapOf(r) {
  const M = r.me, O = r.op, s = r.s, t = r.t || 1, sd = r.sd;
  const head = (p, rad) => len(sub(p, O.Hd)) - 0.105 * s - rad;
  const trunk = (p, rad) => toSeg(p, O.W, O.Ch) - 0.13 * s * t - rad;
  const leg = (p, rad) => Math.min(toSeg(p, O.hpL, O.knL), toSeg(p, O.hpR, O.knR)) - 0.08 * s * t - rad;
  const calf = (p, rad) => Math.min(toSeg(p, O.knL, O.anL), toSeg(p, O.knR, O.anR)) - 0.052 * s * t - rad;
  const where = r.at === 'head' || r.at === 'chin' ? 'head' : r.at === 'thigh' ? 'thigh' : r.at === 'calf' ? 'calf' : 'trunk';
  const fn = { head, trunk, thigh: leg, calf }[where];
  if (r.limb === 'foot') {
    // a kick lands with whatever of the shin and foot is nearest
    const a = M['kn' + sd], b = M['an' + sd];
    let best = 9;
    for (let i = 0; i <= 10; i++) { const u = i / 10, p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; best = Math.min(best, fn(p, 0.05)); }
    return best;
  }
  const p = M[(r.limb === 'hand' ? 'fi' : r.limb === 'knee' ? 'kn' : 'el') + sd];
  return fn(p, r.limb === 'hand' ? 0.045 : 0.06);
}

export let last = null;
export async function run(secs = 40, bouts = [0, 1, 2, 3, 4], speed = 2) {
  const log = [];
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
    await C.setup(bouts[i % bouts.length], true, true);
    FV().cam().landLog = log;
    for (let k = 0; k < 8 && !C.fight().over && Date.now() - t0 < secs * 1000; k++) C.play(6000, speed);
  }
  FV().cam().landLog = null;
  last = log;
  return report(log);
}

// One position on the mat, from a fresh page (the scene drifts over a long session, so one position a load):
// the man on top throws each ground strike n times, and each is measured where it lands.
export async function ground(g, n = 5, keys = ['gnpPunch', 'gnpElbow', 'gnpBody']) {
  await C.setup(0, true, true);
  C.pos(g, 'a'); C.run(6000);
  const log = [], cam = FV().cam();
  cam.landLog = log;
  for (const key of keys) for (let i = 0; i < n; i++) { C.hit(key, 'a', { target: key === 'gnpBody' ? 'body' : 'head' }); C.run(900); }
  cam.landLog = null;
  const out = {};
  for (const r of log) { const k = r.key; (out[k] = out[k] || []).push(+gapOf(r).toFixed(3)); }
  for (const k in out) { const a = out[k].sort((x, y) => x - y); out[k] = { median: a[a.length >> 1], worst: a[a.length - 1], all: a }; }
  return { base: log[0] && log[0].base, ...out };
}

// The striking limb's right of way in the contact pass (ANIM.CONTACT.hitOff brings the old way back), the
// same blows alternately with it off and on, in one page so nothing drifts between them.
export async function groundAB(g, n = 6, key = 'gnpPunch') {
  await C.setup(0, true, true);
  C.pos(g, 'a'); C.run(6000);
  const cam = FV().cam(), CT = FV().anim.CONTACT, off = [], on = [];
  for (let i = 0; i < n; i++) for (const k of [true, false]) {
    const log = []; cam.landLog = log; CT.hitOff = k;
    C.hit(key, 'a', { target: key === 'gnpBody' ? 'body' : 'head' }); C.run(900);
    for (const r of log) (k ? off : on).push(+gapOf(r).toFixed(3));
  }
  CT.hitOff = false; cam.landLog = null;
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  return { base: g, key, off: { median: med(off), worst: Math.max(...off) }, on: { median: med(on), worst: Math.max(...on) } };
}

export function report(log) {
  const rows = {}, out = { blows: 0, landed: 0 };
  for (const r of log) {
    if (!r.land) continue;
    out.landed++;
    const g = gapOf(r), k = (/^gnp/.test(r.key) ? 'ground ' : '') + r.limb + ' to ' + (r.at === 'chin' ? 'head' : r.at);
    (rows[k] = rows[k] || []).push(g);
  }
  out.blows = log.length;
  const pct = (a, x) => { const s = [...a].sort((p, q) => p - q); return s[Math.min(s.length - 1, Math.floor(s.length * x))]; };
  out.byKind = {};
  for (const k in rows) {
    const a = rows[k];
    out.byKind[k] = { n: a.length, median: +pct(a, 0.5).toFixed(3), p90: +pct(a, 0.9).toFixed(3), worst: +Math.max(...a).toFixed(3), short5cm: Math.round(100 * a.filter((x) => x > 0.05).length / a.length) + '%', short15cm: Math.round(100 * a.filter((x) => x > 0.15).length / a.length) + '%' };
  }
  const all = Object.values(rows).flat();
  out.all = { n: all.length, short5cm: Math.round(100 * all.filter((x) => x > 0.05).length / Math.max(1, all.length)) + '%', short15cm: Math.round(100 * all.filter((x) => x > 0.15).length / Math.max(1, all.length)) + '%' };
  return out;
}
