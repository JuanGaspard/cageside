// How predictable is a fight? Quiet engine fights between ranked UFC fighters, and how often whoever looks
// like winning early does win: the man ahead after the first minute, the man who won the first round on the
// cards, the higher-ranked man (next to each other, and three places apart), the man who scores the first
// knockdown. And how often the fight turns: rounds won by the other man than the round before, comebacks from
// losing the first round, men who were hurt or dropped and won anyway.
//   import * as W from './tests/swing.js';  await W.audit(20)   (or W.audit(20, { someTune: x }))
const chan = new MessageChannel();
const waiting = [];
chan.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
const sleep = () => new Promise((r) => { waiting.push(r); chan.port2.postMessage(0); });

// How decided is a pairing before the bell: the same two men (plans and all) fought `reps` times on different
// seeds, for `pairs` pairings; the spread of how often the first one wins. Real betting lines put most fights
// between 60/40 and 80/20, and very few past 90/10. Also what follows the first knockdown.
export async function matchups(pairs = 120, reps = 40, tune) {
  const E = MMA.engine, Wd = MMA.world, F = MMA.fighter, T = E.TUNE, old = {};
  if (tune) for (const k in tune) { old[k] = T[k]; T[k] = tune[k]; }
  if (!Wd.state() || !Wd.state().fighters || Wd.state().settings.world !== 'real') Wd.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const ps = [], kd = { n: 0, finishedSameRound: 0, droppedWon: 0 };
  try {
    for (let p = 0; p < pairs; p++) {
      const d = MMA.data.DIVISIONS[p % 8], list = Wd.rankings(d.id, 'UFC').list, i = Math.floor(Math.random() * 13), a = list[i], b = list[i + 1];
      if (!a || !b) continue;
      const r0 = new MMA.RNG(p * 7919 + 1), planA = F.autoPlan(a, b, r0, 0.7), planB = F.autoPlan(b, a, r0, 0.7);
      let wa = 0, n = 0;
      for (let k = 0; k < reps; k++) {
        const seed = Math.floor(Math.random() * 1e9), r = new MMA.RNG(seed);
        const f = new E.Fight({ a, b, planA: Object.assign({}, planA), planB: Object.assign({}, planB), rounds: 3, seed, quiet: true,
          judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
        let g = 0, kdAt = null, kdBy = null;
        while (!f.over && g++ < 3000) {
          if (f.betweenRounds) { f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
          const k0 = f.A.stats.kd, k1 = f.B.stats.kd;
          f.step();
          if (!kdAt && !f.over && (f.A.stats.kd > k0 || f.B.stats.kd > k1)) { kdAt = f.round; kdBy = f.A.stats.kd > k0 ? 'a' : 'b'; }
        }
        if (!f.result.winner) continue;
        n++; if (f.result.winner === 'a') wa++;
        if (kdAt) { kd.n++; if (f.result.method !== 'DEC' && f.result.round === kdAt && f.result.winner === kdBy) kd.finishedSameRound++; if (f.result.winner !== kdBy) kd.droppedWon++; }
      }
      if (n) ps.push(wa / n);
      if (p % 6 === 5) await sleep();
    }
  } finally { for (const x in old) T[x] = old[x]; }
  const fav = ps.map((x) => Math.max(x, 1 - x)).sort((x, y) => x - y), q = (u) => fav[Math.floor(u * (fav.length - 1))];
  const band = (lo, hi) => (100 * fav.filter((x) => x >= lo && x < hi).length / fav.length).toFixed(0) + '%';
  return { pairs: fav.length, favouriteWinChance: { median: q(0.5).toFixed(2), p25: q(0.25).toFixed(2), p75: q(0.75).toFixed(2) },
    share: { '50-60': band(0.5, 0.6), '60-70': band(0.6, 0.7), '70-80': band(0.7, 0.8), '80-90': band(0.8, 0.9), '90+': band(0.9, 1.01) },
    afterFirstKnockdown: { fights: kd.n, finishedThatRound: (100 * kd.finishedSameRound / Math.max(1, kd.n)).toFixed(0) + '%', droppedManWon: (100 * kd.droppedWon / Math.max(1, kd.n)).toFixed(0) + '%' } };
}

export async function audit(secs = 20, tune) {
  const E = MMA.engine, Wd = MMA.world, F = MMA.fighter, T = E.TUNE, old = {};
  if (tune) for (const k in tune) { old[k] = T[k]; T[k] = tune[k]; }
  if (!Wd.state() || !Wd.state().fighters || Wd.state().settings.world !== 'real') Wd.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const S = { n: 0, ko: 0, sub: 0, dec: 0, min1: [0, 0], r1: [0, 0], fav1: [0, 0], fav3: [0, 0], kd1: [0, 0], hurtWin: [0, 0], swaps: [0, 0], r1lostFinish: 0, r1lost: 0, dom: [0, 0] };
  const sc = (s) => s.stats.dmg + s.stats.sigLand * 0.5 + s.stats.kd * 25 + s.stats.tdLand * 4 + s.stats.ctrl / 15;
  const t0 = Date.now();
  let k = 0;
  try {
    while (Date.now() - t0 < secs * 1000) {
      for (let q = 0; q < 4; q++) {
        const d = MMA.data.DIVISIONS[k++ % 8], list = Wd.rankings(d.id, 'UFC').list;
        const gap = q % 2 ? 3 : 1, i = Math.floor(Math.random() * (14 - gap)), a = list[i], b = list[i + gap];
        if (!a || !b) continue;
        const seed = Math.floor(Math.random() * 1e9), r = new MMA.RNG(seed);
        // (sides shuffled so 'a' isn't always the better-ranked man)
        const flip = Math.random() < 0.5, fa = flip ? b : a, fb = flip ? a : b;
        const f = new E.Fight({ a: fa, b: fb, planA: F.autoPlan(fa, fb, r, 0.7), planB: F.autoPlan(fb, fa, r, 0.7), rounds: 3, seed: seed + 7, quiet: true,
          judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
        let lead1 = null, firstKd = null, hurt = { a: false, b: false };
        let guard = 0;
        while (!f.over && guard++ < 3000) {
          if (f.betweenRounds) { f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
          const kd0 = f.A.stats.kd + f.B.stats.kd, ka = f.A.stats.kd;
          f.step();
          if (f.A.rocked) hurt.a = true; if (f.B.rocked) hurt.b = true;
          // (a knockdown the fight went on after: the engine counts the knockout itself as one too)
          if (!firstKd && !f.over && f.A.stats.kd + f.B.stats.kd > kd0) firstKd = f.A.stats.kd > ka ? 'a' : 'b';
          if (f.round === 1 && f.tick === 20 && !lead1) { const x = sc(f.A), y = sc(f.B); if (Math.abs(x - y) > 2) lead1 = x > y ? 'a' : 'b'; }
        }
        const res = f.result, w = res.winner;
        if (!w) continue;
        S.n++;
        if (res.method === 'DEC' || res.method === 'DRAW') S.dec++; else if (res.method === 'SUB') S.sub++; else S.ko++;
        const tally = (arr, side) => { if (side) { arr[1]++; if (side === w) arr[0]++; } };
        tally(S.min1, lead1);
        const favSide = flip ? 'b' : 'a';
        tally(gap === 1 ? S.fav1 : S.fav3, favSide);
        tally(S.kd1, firstKd);
        for (const s of ['a', 'b']) if (hurt[s]) { S.hurtWin[1]++; if (s === w) S.hurtWin[0]++; }
        // the round-by-round story on the cards (majority of the three judges)
        const cards = f.scorecards || [], nR = cards[0] ? cards[0].length : 0, rw = [];
        for (let j = 0; j < nR; j++) { let va = 0; for (const c of cards) { if (c[j][0] > c[j][1]) va++; else if (c[j][1] > c[j][0]) va--; } rw.push(va > 0 ? 'a' : va < 0 ? 'b' : null); }
        if (rw[0] && (f.round > 1 || nR > 1)) {
          tally(S.r1, rw[0]);
          if (rw[0] !== w) { S.r1lost++; if (res.method !== 'DEC') S.r1lostFinish++; }
        }
        for (let j = 1; j < rw.length; j++) if (rw[j] && rw[j - 1]) { S.swaps[1]++; if (rw[j] !== rw[j - 1]) S.swaps[0]++; }
        // a one-sided decision: every round to the winner on every card
        if (res.method === 'DEC' && nR) { S.dom[1]++; if (rw.every((x) => x === w)) S.dom[0]++; }
      }
      await sleep();
    }
  } finally { for (const x in old) T[x] = old[x]; }
  const pc = (a) => (100 * a[0] / Math.max(1, a[1])).toFixed(1) + '%';
  return { fights: S.n, KO_TKO: pc([S.ko, S.n]), SUB: pc([S.sub, S.n]), DEC: pc([S.dec, S.n]),
    leaderAfter1MinWins: pc(S.min1), round1WinnerWins: pc(S.r1), favWins_nextRanked: pc(S.fav1), favWins_3apart: pc(S.fav3),
    firstKnockdownWins: pc(S.kd1), hurtButWon: pc(S.hurtWin), roundWinnerChanges: pc(S.swaps),
    lostR1ButWon: pc([S.r1lost, S.r1[1]]), ofThoseByFinish: pc([S.r1lostFinish, S.r1lost]), shutoutDecisions: pc(S.dom) };
}
