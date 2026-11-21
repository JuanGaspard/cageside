// What a man on top throws, and where it goes.
//
//   import * as X from './tests/gnp.js';
//   await X.run(40)                     // 40 seconds of fights
//   await X.ab(30)                      // the same fights with ground body shots on and off
//
// It reads the motion list — the same stream the fight view is fed — so what it counts is exactly what the
// picture is shown. Ground strikes used to be scored to the head without exception, whatever the position
// and whatever the arm could actually reach from it; `body` in MMA.data.GNP is the share of them that goes
// to the body now, and this is what reports where they really went.
const MMA = () => window.MMA;

function makeFight(a, b, seed) {
  const E = MMA().engine, F = MMA().fighter, r = new (MMA().RNG)(seed);
  return new E.Fight({ a, b, planA: F.autoPlan(a, b, r, 0.7), planB: F.autoPlan(b, a, r, 0.7),
    rounds: 3, seed: seed + 7, quiet: false,
    judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
}

const sleep = () => new Promise((r) => setTimeout(r, 0));

export async function run(secs = 30, seed0 = 90210) {
  const W = MMA().world, E = MMA().engine;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const S = { fights: 0, mins: 0, gnp: 0, gnpLand: 0, byKey: {}, byPos: {}, head: 0, body: 0, legs: 0,
    ko: 0, sub: 0, dec: 0, kd: 0, gndFin: 0 };
  const t0 = Date.now();
  let k = 0, seed = seed0;
  while (Date.now() - t0 < secs * 1000) {
    for (let q = 0; q < 3; q++) {
      const d = MMA().data.DIVISIONS[k++ % 8], list = W.rankings(d.id, 'UFC').list;
      const i = (k * 5) % 12, a = list[i], b = list[i + 1];
      if (!a || !b) continue;
      const f = makeFight(a, b, (seed += 7919));
      let guard = 0;
      while (!f.over && guard++ < 3000) {
        if (f.betweenRounds) { f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
        const was = f.gpos;
        f.step();
        for (const m of f.motion || []) {
          if (!/^gnp/.test(m.key)) continue;
          S.gnp++;
          S.byKey[m.key] = (S.byKey[m.key] || 0) + 1;
          if (was) { const p = S.byPos[was] || (S.byPos[was] = { head: 0, body: 0 }); p[m.target === 'body' ? 'body' : 'head']++; }
          if (m.land) S.gnpLand++;
        }
      }
      const r = f.result;
      S.fights++;
      if (r.method === 'DEC' || r.method === 'DRAW') S.dec++; else if (r.method === 'SUB') S.sub++; else S.ko++;
      if (r.method !== 'DEC' && r.method !== 'DRAW' && r.method !== 'SUB' && /pound|Body/i.test(r.detail || '')) S.gndFin++;
      S.mins += (r.method === 'DEC' || r.method === 'DRAW') ? 15 : (r.round - 1) * 5 + (r.time || 0) / 60;
      for (const s of [f.A, f.B]) { S.kd += s.stats.kd; S.head += s.stats.headLand; S.body += s.stats.bodyLand; S.legs += s.stats.legLand; }
    }
    await sleep();
  }
  const pc = (x, n) => (100 * x / Math.max(1, n)).toFixed(1) + '%';
  const pos = {};
  for (const p of ['guard', 'half', 'side', 'mount', 'back']) {
    const v = S.byPos[p];
    if (v) pos[p] = { thrown: v.head + v.body, toBody: pc(v.body, v.head + v.body) };
  }
  return {
    fights: S.fights,
    groundStrikesPerMin: (S.gnp / S.mins / 2).toFixed(2), accuracy: pc(S.gnpLand, S.gnp),
    ofGroundStrikes: Object.fromEntries(Object.entries(S.byKey).map(([x, n]) => [x, pc(n, S.gnp)])),
    byPosition: pos,
    landedHeadBodyLegs: [pc(S.head, S.head + S.body + S.legs), pc(S.body, S.head + S.body + S.legs), pc(S.legs, S.head + S.body + S.legs)],
    KO_TKO: pc(S.ko, S.fights), SUB: pc(S.sub, S.fights), DEC: pc(S.dec, S.fights),
    groundAndPoundStoppages: pc(S.gndFin, S.fights), kdPerFight: (S.kd / S.fights).toFixed(2),
  };
}

// The same fights with the ground body shots on and off, for comparing like with like.
export async function ab(secs = 25, seed0 = 90210) {
  const G = MMA().data.GNP, was = {};
  for (const k in G) { was[k] = G[k].body; G[k].body = 0; }
  const off = await run(secs, seed0);
  for (const k in G) G[k].body = was[k];
  const on = await run(secs, seed0);
  return { off, on };
}
