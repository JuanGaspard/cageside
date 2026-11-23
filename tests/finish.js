// Does the blow come before the fall? Real fights through the view, watched frame by frame: each time a man is
// shown hurt (the 'hurt' stance), dropped ('down', a knockdown's fall) or finished ('down'/'flat' at the end),
// how long before that the other man's last landed blow reached him in the picture (an act of his passing its
// clip's impact). Negative or missing is the complaint: hurt, dropped or out with no blow yet, or none at all.
//
//   import * as X from './tests/finish.js';
//   await X.run(90)
import * as C from './camtest.js';
const FV = () => MMA.fightview;

// (`shock`: the engine's TUNE.shock while it runs, how hard a clean blow hits him: at three times the game's,
// ordinary punches rock, drop and finish men often — a minute of ordinary fights has a knockdown in it now and
// then; this has dozens)
export async function run(secs = 90, bouts = [1, 3, 4, 2, 0], speed = 4, shock = 3) {
  const out = { reactions: [], finishes: 0 };
  const t0 = Date.now(), T = MMA.engine.TUNE, shock0 = T.shock;
  T.shock = shock0 * shock;
  try {
  for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
    await C.setup(bouts[i % bouts.length], true, true);
    const f = C.fight(), cam = FV().cam();
    const lastHit = { a: -1e9, b: -1e9 }, was = { a: null, b: null };
    const real = performance.now, realST = window.setTimeout; let clock = C.now();
    performance.now = () => clock;
    // (the game shows each moment's outcome with a timer, set for when its blow lands; on this clock, not the
    // wall's, or none of them would fire until the run was over)
    const timers = [];
    window.setTimeout = (fn, ms) => { timers.push({ fn, at: clock + (ms || 0) }); return 0; };
    try {
      FV().setSpeed && FV().setSpeed(speed);
      if (!FV().camStats().running) FV().actions.fvpause();
      let endT = null;
      for (let t = 0; t < 400000 && Date.now() - t0 < secs * 1000; t += 16) {
        clock += 16; C.setClock(clock);
        for (let k = 0; k < timers.length; k++) if (timers[k].at <= clock) { const x = timers.splice(k--, 1)[0]; try { x.fn(); } catch (e) { /* the result screen, mid-test */ } }
        FV().camFrame(clock);
        if (f.over && endT == null) endT = t;
        if (endT != null && t > endT + 4000) break;
        // (both men's blows first, then both men's reactions: a blow and the fall it causes in the same frame)
        for (const s of ['a', 'b']) for (const a of cam[s].acts) if (a.m && a.m.land && a.C && a.C.impact != null && a.lt != null && a.lt >= a.C.impact && !a.seenHit) { a.seenHit = true; lastHit[s] = t; }
        for (const s of ['a', 'b']) {
          const fig = cam[s];
          const base = fig.v2 && fig.v2.base, o = s === 'a' ? 'b' : 'a';
          const bad = base === 'hurt' || base === 'down' || base === 'flat';
          if (bad && was[s] !== base) {
            const gap = t - lastHit[o];
            out.reactions.push({ what: base + (f.over ? ' (end)' : ''), gapMs: gap > 3000 ? null : gap,
              why: gap > 3000 && f.over ? { result: f.result && f.result.method + ' ' + f.result.detail,
                winnerActs: cam[o].acts.map((a) => (a.m ? a.m.key + (a.m.land ? '!' : '') : a.react || (a.walk ? 'walk' : a.trans ? 'trans' : '?')) + ' t0-now ' + Math.round(a.t0 - (performance.now() - (cam.warp || 0))) + ' lt ' + (a.lt != null ? Math.round(a.lt) : '-') + '/' + (a.C && a.C.impact)).join(' | '),
                keyAct: cam.keyAct ? Math.round(cam.keyAct.at - (performance.now() - (cam.warp || 0))) : null, bases: cam.a.v2.base + '/' + cam.b.v2.base, motion: (f.motion || []).map((m) => m.key + (m.land ? '!' : '') + '/' + m.by).join(' '), last: (f.events || []).slice(-4).map((e) => e.kind + ':' + (e.what || '')).join(' ') } : undefined });
            if (f.over && base !== 'hurt') out.finishes++;
          }
          was[s] = base;
        }
      }
    } finally { performance.now = real; window.setTimeout = realST; }
  }
  } finally { T.shock = shock0; }
  const r = out.reactions, by = {};
  for (const x of r) { const k = x.what; (by[k] = by[k] || []).push(x.gapMs); }
  const sum = {};
  for (const k in by) {
    const g = by[k], ok = g.filter((x) => x != null).sort((p, q) => p - q);
    sum[k] = { n: g.length, noBlow: g.filter((x) => x == null).length, beforeBlow: ok.filter((x) => x < 0).length, medianAfterMs: ok.length ? ok[ok.length >> 1] : null };
  }
  return { finishes: out.finishes, byKind: sum, unexplained: r.filter((x) => x.why).map((x) => x.why) };
}
