// Into the clinch: how far apart they were when it started, and how they got together.
//
//   import * as E from './tests/entry.js';
//   await E.run(60)            // a minute of real fights through the view, every clinch that starts measured
//   E.report(E.last)
//
// Two sides of it. The engine's: where the two men stood (in metres) when one went for the tie-up, how far
// he got with his burst, and whether it took. The picture's: from the frame it shows them tied up, the
// distance between the two chests at that frame, how long until they're at clinch distance (within 8 cm of
// where they settle), and how far their feet slid on the way ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a foot on the floor (ankle under 9 cm up)
// moving across it faster than 0.6 m/s with no step lifting it is a foot being dragged, which is what
// floating looks like. A real entry is steps: the feet lift, and nothing slides.
import * as C from './camtest.js';
const FV = () => MMA.fightview;
const UNIT_M = 4.6;

const flat = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);

export let last = null, tries = null;
function hookEngine(log) {
  const P = MMA.engine.Fight.prototype;
  if (P.tryClinch.wrapped) P.tryClinch = P.tryClinch.wrapped;
  const orig = P.tryClinch;
  P.tryClinch = function (s, reactive) {
    const o = s.opp, d0 = Math.hypot(o.x - s.x, o.y - s.y);
    const r = orig.call(this, s, reactive);
    const d1 = Math.hypot(o.x - s.x, o.y - s.y);
    log.push({ d0: +(d0 * UNIT_M).toFixed(2), after: +(d1 * UNIT_M).toFixed(2), took: this.pos === 'clinch', reactive: !!reactive });
    return r;
  };
  P.tryClinch.wrapped = orig;
  return () => { P.tryClinch = orig; };
}

// one frame-by-frame look at an entry, from the frame the picture shows the clinch
function track(cam, out, dt = 0.016) {
  const pa = cam.a.v2 && cam.a.v2.pts, pb = cam.b.v2 && cam.b.v2.pts;
  if (!pa || !pb) return;
  const e = out.cur;
  const gap = flat(pa.Ch, pb.Ch);
  if (e.gap0 == null) e.gap0 = +gap.toFixed(3);
  e.gaps.push(gap);
  // how far each man's hips travel over the floor in the first 750 ms: the one who tied up should do it all
  e.trav = e.trav || { a: 0, b: 0 }; e.hip = e.hip || {};
  // (where he stands, his anchor: the hips sway as the pose changes from the guard to the clinch, which
  // isn't travelling)
  for (const s of ['a', 'b']) {
    const p = cam[s].ancShown, q = e.hip[s];
    if (!p) continue;
    if (q && e.gaps.length * dt < 0.75) e.trav[s] += Math.hypot(p[0] - q[0], p[1] - q[1]);
    e.hip[s] = p.slice();
  }
  // floating: both of a man's feet travelling across the floor at once (over 0.3 m/s each). Stepping, one
  // foot is always planted while the other moves; gliding, they go together. What's counted is the slower
  // foot's travel â€” the ground the whole man covered without a foot under him
  for (const [s, P] of [['a', pa], ['b', pb]]) {
    const d = {};
    for (const sd of ['L', 'R']) {
      const k = s + sd, p = P['an' + sd], q = e.prev[k];
      d[sd] = q ? flat(p, q) : 0;
      if (q && p[1] > 0.12) e.lifts[k] = true;
      e.prev[k] = p.slice();
    }
    const m = Math.min(d.L, d.R);
    if (m / dt > 0.3) { e.slide += m; if (e.gaps.length * dt < 0.75) e.slideIn = (e.slideIn || 0) + m; }
  }
}
function finish(e) {
  const end = e.gaps.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, e.gaps.length);
  const i = e.gaps.findIndex((g) => g < end + 0.08);
  return { gap0: e.gap0, settled: +end.toFixed(3), closingMs: Math.max(0, i) * (e.dt || 16), slideCm: +(e.slide * 100).toFixed(1), slideInCm: +((e.slideIn || 0) * 100).toFixed(1),
    closerCm: e.by ? Math.round(e.trav[e.by] * 100) : null, otherCm: e.by ? Math.round(e.trav[e.by === 'a' ? 'b' : 'a'] * 100) : null, stepsLifted: Object.keys(e.lifts).length };
}

// `alt`: every other entry the old way (the glide, cam.noEntry), reported side by side
export async function run(secs = 60, bouts = [0, 1, 2, 3, 4], speed = 2, alt = false) {
  const t0 = Date.now(), entries = [], log = [];
  const unhook = hookEngine(log);
  try {
    for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
      await C.setup(bouts[i % bouts.length], true, true);
      const f = C.fight(), cam = FV().cam();
      const real = performance.now; let clock = C.now();
      performance.now = () => clock;
      try {
        FV().setSpeed && FV().setSpeed(speed);
        if (!FV().camStats().running) FV().actions.fvpause();
        let was = null, cur = null, left = 0;
        for (let t = 0; t < 48000 && !f.over && Date.now() - t0 < secs * 1000; t += 16) {
          clock += 16; C.setClock(clock);
          FV().camFrame(clock);
          const now = cam.lastSt && cam.lastSt.pos;
          if (now === 'clinch' && was === 'stand' && !cur) { cur = { gaps: [], prev: {}, lifts: {}, slide: 0, old: !!cam.noEntry }; left = 1500 / 16; }
          was = now;
          if (cur) {
            track(cam, { cur });
            if (--left <= 0 || now !== 'clinch') {
              if (left <= 0) entries.push(Object.assign(finish(cur), { old: cur.old }));
              cur = null;
              if (alt) cam.noEntry = !cam.noEntry;
            }
          }
        }
      } finally { performance.now = real; }
    }
  } finally { unhook(); }
  last = entries; tries = log;
  FV().cam().noEntry = false;
  if (alt) return { glide: report(entries.filter((e) => e.old), log).picture, steps: report(entries.filter((e) => !e.old), log).picture, engine: report(entries, log).engine };
  return report(entries, log);
}

// The same, forced, so there are enough of them: the two set apart at `dm` metres on the engine's floor, left
// to settle, then one ties the other up (the engine's own toClinch), alternating who; every other one the old
// way. One page, so nothing drifts between the two.
export async function forced(n = 8, dm = 1.6) {
  await C.setup(0, true, true);
  const f = C.fight(), cam = FV().cam(), out = { glide: [], steps: [] };
  for (const g of [cam.a, cam.b]) g.nextFeint = Infinity;
  for (let i = 0; i < n * 2; i++) {
    f.toStand();
    const r = dm / UNIT_M / 2, a = Math.random() * 6.28, cx = (Math.random() - 0.5) * 0.3, cy = (Math.random() - 0.5) * 0.3;
    f.A.x = cx - Math.cos(a) * r; f.A.y = cy - Math.sin(a) * r; f.B.x = cx + Math.cos(a) * r; f.B.y = cy + Math.sin(a) * r;
    C.run(5000);
    cam.noEntry = i % 2 === 0;
    f.toClinch(i % 4 < 2 ? f.A : f.B);
    const cur = { gaps: [], prev: {}, lifts: {}, slide: 0, dt: 15, by: i % 4 < 2 ? 'a' : 'b' };
    for (let t = 0; t < 1500; t += 15) { C.run(15); track(cam, { cur }, 0.015); }
    (cam.noEntry ? out.glide : out.steps).push(finish(cur));
  }
  cam.noEntry = false;
  const sum = (L) => ({ chestGap: pct(L.map((e) => e.gap0), 0.5), closingMs: pct(L.map((e) => e.closingMs), 0.5), slideCm: pct(L.map((e) => e.slideCm), 0.5), closerCm: pct(L.map((e) => e.closerCm), 0.5), otherCm: pct(L.map((e) => e.otherCm), 0.5), otherWorst: Math.max(...L.map((e) => e.otherCm)), slideInCm: pct(L.map((e) => e.slideInCm), 0.5), slideInWorst: Math.max(...L.map((e) => e.slideInCm)), slideWorst: Math.max(...L.map((e) => e.slideCm)), lifted: pct(L.map((e) => e.stepsLifted), 0.5) });
  return { dm, glide: sum(out.glide), steps: sum(out.steps), all: out };
}

const pct = (a, x) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * x))] : null; };
export function report(entries = last, log = tries) {
  const took = log.filter((r) => r.took), g = entries.map((e) => e.gap0), sl = entries.map((e) => e.slideCm), ms = entries.map((e) => e.closingMs);
  return {
    engine: { tries: log.length, took: took.length, fromMedian: pct(took.map((r) => r.d0), 0.5), fromP90: pct(took.map((r) => r.d0), 0.9), fromWorst: Math.max(...took.map((r) => r.d0)), over2m: took.filter((r) => r.d0 > 2).length },
    picture: { entries: entries.length, chestGapMedian: pct(g, 0.5), chestGapP90: pct(g, 0.9), chestGapWorst: Math.max(...g), closingMsMedian: pct(ms, 0.5), closingMsWorst: Math.max(...ms), slideCmMedian: pct(sl, 0.5), slideCmP90: pct(sl, 0.9), slideCmWorst: Math.max(...sl) },
  };
}
