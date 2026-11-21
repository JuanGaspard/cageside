// What a man does with a strike that misses him, and what he does about it afterwards.
//
//   import * as X from './tests/counters.js';
//   await X.run(40)                     // 40 seconds of fights
//   await X.ab(30)                      // the same fights with counters on and off (MMA.engine.TUNE)
//
// It reads the motion list — the same stream the fight view is fed — so what it counts is exactly what
// the picture is shown. Real numbers to hold it against, from UFC public stats and tape:
//   counters           about 10-15% of significant strikes thrown
//   of what misses     roughly half caught on the guard, the rest slipped, rolled, pulled or stepped off
//   knee on a shot     a handful a card, so a few per cent of shots
const MMA = () => window.MMA;

function makeFight(a, b, seed) {
  const E = MMA().engine, F = MMA().fighter, r = new (MMA().RNG)(seed);
  // (`quiet: false`: the motion list is only kept when the fight thinks someone is watching)
  return new E.Fight({ a, b, planA: F.autoPlan(a, b, r, 0.7), planB: F.autoPlan(b, a, r, 0.7),
    rounds: 3, seed: seed + 7, quiet: false,
    judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
}

const sleep = () => new Promise((r) => setTimeout(r, 0));

export async function run(secs = 30, seed0 = 90210) {
  const W = MMA().world, E = MMA().engine;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const S = { fights: 0, mins: 0, thrown: 0, landed: 0, missed: 0, def: {}, shots: 0, knees: 0, kneeLand: 0,
    counters: 0, counterLand: 0, ko: 0, sub: 0, dec: 0, kd: 0, tdA: 0, tdL: 0 };
  const t0 = Date.now();
  let k = 0, seed = seed0;
  while (Date.now() - t0 < secs * 1000) {
    for (let q = 0; q < 3; q++) {
      const d = MMA().data.DIVISIONS[k++ % 8], list = W.rankings(d.id, 'UFC').list;
      const i = (k * 5) % 12, a = list[i], b = list[i + 1];
      if (!a || !b) continue;
      const f = makeFight(a, b, (seed += 7919));
      let guard = 0, sawKnee = false;
      while (!f.over && guard++ < 3000) {
        if (f.betweenRounds) { f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
        f.step();
        for (const m of f.motion || []) {
          if (m.key === 'shoot') { S.shots++; sawKnee = false; continue; }
          if (!MMA().data.STRIKES[m.key]) continue;
          S.thrown++;
          if (m.counter) { S.counters++; if (m.land) S.counterLand++; }
          if (m.land) S.landed++; else { S.missed++; S.def[m.def || '(none)'] = (S.def[m.def || '(none)'] || 0) + 1; }
        }
        // (a knee thrown in the same moment as a shot, by the other man: the knee on the way in)
        const ms = f.motion || [];
        for (let j = 1; j < ms.length; j++) if (ms[j].key === 'knee' && ms[j - 1].key === 'shoot' && ms[j].by !== ms[j - 1].by) {
          S.knees++; if (ms[j].land) S.kneeLand++; sawKnee = true;
        }
      }
      const r = f.result;
      S.fights++;
      if (r.method === 'DEC' || r.method === 'DRAW') S.dec++; else if (r.method === 'SUB') S.sub++; else S.ko++;
      S.mins += (r.method === 'DEC' || r.method === 'DRAW') ? 15 : (r.round - 1) * 5 + (r.time || 0) / 60;
      for (const s of [f.A, f.B]) { S.kd += s.stats.kd; S.tdA += s.stats.tdAtt; S.tdL += s.stats.tdLand; }
      void sawKnee;
    }
    await sleep();
  }
  const pc = (x, n) => (100 * x / Math.max(1, n)).toFixed(1) + '%';
  const def = {};
  for (const k2 of Object.keys(S.def).sort((x, y) => S.def[y] - S.def[x])) def[k2] = pc(S.def[k2], S.missed);
  return {
    fights: S.fights,
    strikesPerMin: (S.thrown / S.mins / 2).toFixed(2), accuracy: pc(S.landed, S.thrown),
    counters: pc(S.counters, S.thrown), counterAccuracy: pc(S.counterLand, S.counters),
    ofWhatMisses: def,
    shots: S.shots, kneeOnShot: pc(S.knees, S.shots), kneeLands: pc(S.kneeLand, S.knees),
    KO_TKO: pc(S.ko, S.fights), SUB: pc(S.sub, S.fights), DEC: pc(S.dec, S.fights),
    kdPerFight: (S.kd / S.fights).toFixed(2), tdAccuracy: pc(S.tdL, S.tdA),
  };
}

// The same fights with the counters on and off, for comparing like with like.
export async function ab(secs = 25, seed0 = 90210) {
  const T = MMA().engine.TUNE, was = [T.counter, T.kneeOnShot];
  T.counter = 0; T.kneeOnShot = 0;
  const off = await run(secs, seed0);
  T.counter = was[0]; T.kneeOnShot = was[1];
  const on = await run(secs, seed0);
  return { off, on };
}
