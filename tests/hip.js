// The head on the hip against the cage (hipTick): how often a fight gets there, how long it lasts, and what
// it turns into — a takedown (sitting on the fence or flat), the tie-up, apart, a guillotine.
//   import * as H from './tests/hip.js';  await H.audit(20)  (or H.audit(20, { hipFence: 0 }) to compare)
const chan = new MessageChannel();
const waiting = [];
chan.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
const sleep = () => new Promise((r) => { waiting.push(r); chan.port2.postMessage(0); });

export async function audit(secs = 20, tune) {
  const E = MMA.engine, W = MMA.world, F = MMA.fighter, T = E.TUNE, old = {};
  if (tune) for (const k in tune) { old[k] = T[k]; T[k] = tune[k]; }
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const S = { fights: 0, ko: 0, sub: 0, dec: 0, entries: 0, ticks: 0, exits: {}, sprawlOnFence: 0, tdA: 0, tdL: 0, fenceSit: 0 };
  const t0 = Date.now();
  let k = 0;
  try {
    while (Date.now() - t0 < secs * 1000) {
      for (let q = 0; q < 4; q++) {
        const d = MMA.data.DIVISIONS[k++ % 8], list = W.rankings(d.id, 'UFC').list;
        const i = Math.floor(Math.random() * 12), a = list[i], b = list[i + 1];
        if (!a || !b) continue;
        const seed = Math.floor(Math.random() * 1e9), r = new MMA.RNG(seed);
        const f = new E.Fight({ a, b, planA: F.autoPlan(a, b, r, 0.7), planB: F.autoPlan(b, a, r, 0.7), rounds: 3, seed: seed + 7, quiet: true,
          judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
        let guard = 0;
        while (!f.over && guard++ < 3000) {
          if (f.betweenRounds) { f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
          const was = f.pos === 'clinch' && f.clinchType === 'hip';
          f.step();
          const is = f.pos === 'clinch' && f.clinchType === 'hip';
          if (is) S.ticks++;
          if (is && !was) S.entries++;
          if (was && !is) {
            const k2 = f.over ? 'fight over' : f.subLock ? 'guillotine' : f.pos === 'ground' ? (f.gpos === 'fence' ? 'takedown: sitting on the fence' : 'takedown: ' + f.gpos) : f.pos;
            S.exits[k2] = (S.exits[k2] || 0) + 1;
          }
        }
        S.fights++;
        const res = f.result;
        if (res.method === 'DEC' || res.method === 'DRAW') S.dec++; else if (res.method === 'SUB') S.sub++; else S.ko++;
        for (const s of [f.A, f.B]) { S.tdA += s.stats.tdAtt; S.tdL += s.stats.tdLand; }
      }
      await sleep();
    }
  } finally { for (const x in old) T[x] = old[x]; }
  const pc = (x, n) => (100 * x / Math.max(1, n)).toFixed(1) + '%';
  const ex = {};
  const nEx = Object.values(S.exits).reduce((p, q) => p + q, 0);
  for (const x in S.exits) ex[x] = pc(S.exits[x], nEx);
  return { fights: S.fights, KO_TKO: pc(S.ko, S.fights), SUB: pc(S.sub, S.fights), DEC: pc(S.dec, S.fights),
    tdPerFight: (S.tdA / S.fights).toFixed(2), tdAcc: pc(S.tdL, S.tdA),
    hipPerFight: (S.entries / S.fights).toFixed(2), hipSecsEach: (S.ticks * 3 / Math.max(1, S.entries)).toFixed(1), exits: ex };
}
