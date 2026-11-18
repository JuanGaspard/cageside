// Fight-engine test harness: load in the game page with
//   await (await import('/tests/harness.js?v=' + Date.now())).run({ secs: 30 })
// Measures how fights end and what the numbers look like, between neighbouring ranked UFC fighters,
// and how much a +4 bump to one attribute moves the win rate between identical twins.
// a yield that background tabs don't throttle (setTimeout is clamped to a second there)
const chan = new MessageChannel();
const waiting = [];
chan.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
const sleep = () => new Promise((r) => { waiting.push(r); chan.port2.postMessage(0); });

function makeFight(a, b, rounds, seed, samePlan) {
  const E = MMA.engine, F = MMA.fighter, r = new MMA.RNG(seed);
  const planA = F.autoPlan(a, b, r, 0.7), planB = samePlan ? Object.assign({}, planA) : F.autoPlan(b, a, r, 0.7);
  return new E.Fight({ a, b, planA, planB, rounds: rounds || 3, seed: seed + 7, quiet: true,
    judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
}
function runFight(f) {
  const E = MMA.engine;
  let guard = 0;
  while (!f.over && guard++ < 3000) {
    if (f.betweenRounds) { f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
    f.step();
  }
  return f;
}

export async function realism(secs) {
  const W = MMA.world;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const S = { n: 0, ko: 0, sub: 0, dec: 0, kd: 0, sigL: 0, sigA: 0, mins: 0, tdA: 0, tdL: 0, ctrl: 0, clinch: 0, r1: 0, split: 0 };
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < secs * 1000) {
    for (let q = 0; q < 4; q++) {
      const d = MMA.data.DIVISIONS[k++ % 8];
      const list = W.rankings(d.id, 'UFC').list;
      const i = Math.floor(Math.random() * 12), a = list[i], b = list[i + 1];
      if (!a || !b) continue;
      const f = runFight(makeFight(a, b, 3, Math.floor(Math.random() * 1e9)));
      const r = f.result;
      S.n++;
      if (r.method === 'DEC' || r.method === 'DRAW') { S.dec++; if (/Split|Majority/.test(r.detail)) S.split++; } else if (r.method === 'SUB') S.sub++; else S.ko++;
      if (r.method !== 'DEC' && r.method !== 'DRAW' && r.round === 1) S.r1++;
      const mins = (r.method === 'DEC' || r.method === 'DRAW') ? 15 : (r.round - 1) * 5 + (r.time || 0) / 60;
      S.mins += mins;
      for (const s of [f.A, f.B]) { S.sigL += s.stats.sigLand; S.sigA += s.stats.sigAtt; S.tdA += s.stats.tdAtt; S.tdL += s.stats.tdLand; S.ctrl += s.stats.ctrl; S.kd += s.stats.kd; }
    }
    await sleep();
  }
  const p = (x) => (100 * x / S.n).toFixed(1) + '%';
  return {
    fights: S.n, KO_TKO: p(S.ko), SUB: p(S.sub), DEC: p(S.dec), splitOfDec: (100 * S.split / Math.max(1, S.dec)).toFixed(1) + '%', finishesInR1: (100 * S.r1 / Math.max(1, S.ko + S.sub)).toFixed(0) + '%',
    kdPerFight: (S.kd / S.n).toFixed(2), sigLandedPerMin: (S.sigL / S.mins / 2).toFixed(2), sigAccuracy: (100 * S.sigL / S.sigA).toFixed(1) + '%',
    tdPer15: (S.tdA / S.mins * 15 / 2).toFixed(2), tdAccuracy: (100 * S.tdL / Math.max(1, S.tdA)).toFixed(1) + '%', ctrlSecsPer15: Math.round(S.ctrl / S.mins * 15),
  };
}

// Stances and the feet (3D-C): who wins open-stance fights, how switch hitters do, how often men walk into
// the power hand, who takes the outside foot, how often stances change.
export async function stances(secs) {
  const W = MMA.world;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const T = { n: 0, open: 0, openSouthWins: 0, switchFights: 0, switchWins: 0, intoPower: 0, moments: 0, openMoments: 0, outsideWon: 0, switches: 0, switchByNatural: 0,
    outsideSouth: 0, outsideNorth: 0, walkWinner: 0, walkLoser: 0 };
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < secs * 1000) {
    for (let q = 0; q < 4; q++) {
      const d = MMA.data.DIVISIONS[k++ % 8];
      const list = W.rankings(d.id, 'UFC').list;
      const i = Math.floor(Math.random() * 12), a = list[i], b = list[i + 1];
      if (!a || !b) continue;
      const f = runFight(makeFight(a, b, 3, Math.floor(Math.random() * 1e9)));
      if (f.result.method === 'DRAW' || !f.result.winner) continue;
      T.n++;
      const win = f.result.winner === 'a' ? f.A : f.B;
      const sa = a.stance, sb = b.stance;
      if (sa !== 'Switch' && sb !== 'Switch' && (sa === 'Southpaw') !== (sb === 'Southpaw')) { T.open++; if (win.f.stance === 'Southpaw') T.openSouthWins++; }
      if ((sa === 'Switch') !== (sb === 'Switch')) { T.switchFights++; if (win.f.stance === 'Switch') T.switchWins++; }
      for (const s of [f.A, f.B]) {
        T.intoPower += s.stats.intoPower; T.moments += s.stats.posMoments; T.openMoments += s.stats.openMoments; T.outsideWon += s.stats.outsideWon; T.switches += s.stats.switches;
        if (!s.switcher) T.switchByNatural += s.stats.switches;
        // (the outside foot between a natural southpaw and a natural orthodox man only)
        if (!f.A.switcher && !f.B.switcher && f.A.natural !== f.B.natural) { if (s.natural === 1) T.outsideSouth += s.stats.outsideWon; else T.outsideNorth += s.stats.outsideWon; }
        if (s === win) T.walkWinner += s.stats.intoPower; else T.walkLoser += s.stats.intoPower;
      }
    }
    await sleep();
  }
  const pc = (x, n) => (100 * x / Math.max(1, n)).toFixed(1) + '%';
  return {
    fights: T.n, openStanceFights: T.open, southpawWinsOpen: pc(T.openSouthWins, T.open), switchHitterFights: T.switchFights, switchHitterWins: pc(T.switchWins, T.switchFights),
    walkedIntoPowerPerMoment: pc(T.intoPower, T.moments), walkIntoPowerWinnerVsLoser: (T.walkWinner / Math.max(1, T.walkLoser)).toFixed(2),
    outsideFootDecided: pc(T.outsideWon, T.openMoments / 2), outsideSouthpawShare: pc(T.outsideSouth, T.outsideSouth + T.outsideNorth),
    switchesPerFight: (T.switches / T.n).toFixed(2), naturalSwitchesPerFight: (T.switchByNatural / T.n).toFixed(3),
  };
}

// What being a southpaw is worth on its own: each open-stance pairing fought twice on the same seed, once
// as they are and once with the southpaw made orthodox. (Raw win rates mix it with who the southpaws in
// the rankings happen to be.) Call it repeatedly: the counts add up across calls until `reset`.
const EDGE = { n: 0, south: 0, ortho: 0 };
export async function stanceEdge(secs, reset) {
  const W = MMA.world;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  if (reset) { EDGE.n = EDGE.south = EDGE.ortho = 0; }
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < secs * 1000) {
    for (let q = 0; q < 4; q++) {
      const d = MMA.data.DIVISIONS[k++ % 8], list = W.rankings(d.id, 'UFC').list;
      const i = Math.floor(Math.random() * 12), a = list[i], b = list[i + 1];
      if (!a || !b || a.stance === 'Switch' || b.stance === 'Switch' || (a.stance === 'Southpaw') === (b.stance === 'Southpaw')) continue;
      const side = a.stance === 'Southpaw' ? 'a' : 'b', s = side === 'a' ? a : b, seed = Math.floor(Math.random() * 1e9);
      const f1 = runFight(makeFight(a, b, 3, seed));
      s.stance = 'Orthodox';
      let f2;
      try { f2 = runFight(makeFight(a, b, 3, seed)); } finally { s.stance = 'Southpaw'; }
      if (!f1.result.winner || !f2.result.winner) continue;
      EDGE.n++; if (f1.result.winner === side) EDGE.south++; if (f2.result.winner === side) EDGE.ortho++;
    }
    await sleep();
  }
  const pc = (x) => (100 * x / Math.max(1, EDGE.n)).toFixed(1) + '%';
  return { pairs: EDGE.n, asSouthpaw: pc(EDGE.south), sameManOrthodox: pc(EDGE.ortho), edge: (100 * (EDGE.south - EDGE.ortho) / Math.max(1, EDGE.n)).toFixed(1) + ' points' };
}

// Twins: the same fighter twice; A gets +4 in one attribute. Win rate above 50% is that attribute's worth.
export async function effects(attrs, perAttr, secsCap, samePlan) {
  const F = MMA.fighter, rng = new MMA.RNG(5);
  const out = {};
  const t0 = Date.now();
  for (const k of attrs) {
    let w = 0, n = 0;
    for (let i = 0; i < perAttr; i++) {
      const base = F.generate(rng, { division: MMA.data.DIVISIONS[i % 8].id, level: 12 + (i % 5) * 0.6, age: 28 });
      const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base));
      a.id = 'twinA' + i; b.id = 'twinB' + i; a.last = 'A'; b.last = 'B';
      a.attrs[k] = Math.min(20, a.attrs[k] + 4); a.cap[k] = Math.max(a.cap[k], a.attrs[k]);
      const f = runFight(makeFight(a, b, 3, 1000 + i * 7919, samePlan));
      if (f.result.winner === 'a') w++; else if (f.result.winner == null) w += 0.5;
      n++;
      if (i % 10 === 9) await sleep();
      if (secsCap && Date.now() - t0 > secsCap * 1000) break;
    }
    out[k] = '+' + Math.round(100 * w / n - 50) + ' (' + n + ')';
  }
  return out;
}

// Real matchups: neighbouring ranked UFC fighters, each pair fought twice on the same seed, once as they
// are and once with A's attribute +4. The difference in A's win rate is the attribute's worth there.
export async function effectsReal(attrs, perAttr, secsCap) {
  const W = MMA.world;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const out = {}, t0 = Date.now();
  for (const k of attrs) {
    let base = 0, bumped = 0, n = 0;
    for (let i = 0; i < perAttr; i++) {
      const d = MMA.data.DIVISIONS[i % 8];
      const list = W.rankings(d.id, 'UFC').list;
      const j = i % 12, a0 = list[j], b = list[j + 1];
      if (!a0 || !b) continue;
      const seed = 5000 + i * 7919;
      const f1 = runFight(makeFight(a0, b, 3, seed));
      const a = JSON.parse(JSON.stringify(a0)); a.attrs[k] = Math.min(20, a.attrs[k] + 4); a.cap[k] = Math.max(a.cap[k], a.attrs[k]);
      const f2 = runFight(makeFight(a, b, 3, seed));
      base += f1.result.winner === 'a' ? 1 : f1.result.winner == null ? 0.5 : 0;
      bumped += f2.result.winner === 'a' ? 1 : f2.result.winner == null ? 0.5 : 0;
      n++;
      if (i % 8 === 7) await sleep();
      if (secsCap && Date.now() - t0 > secsCap * 1000) break;
    }
    out[k] = '+' + Math.round(100 * (bumped - base) / n) + ' (' + n + ')';
  }
  return out;
}

// How much damage shows: the worse-off fighter's consciousness and core at the end of round 1 and at the
// final bell of fights that go the distance, and the lowest consciousness seen during them.
export async function damage(secs) {
  const W = MMA.world;
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const E = MMA.engine;
  const S = { n: 0, dec: 0, ko: 0, sub: 0, endCons: [], endCore: [], minCons: [], r1Cons: [], r1Core: [] };
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < secs * 1000) {
    for (let q = 0; q < 4; q++, k++) {
      const d = MMA.data.DIVISIONS[k % 8];
      const list = W.rankings(d.id, 'UFC').list;
      const i = Math.floor(Math.random() * 12), a = list[i], b = list[i + 1];
      if (!a || !b) continue;
      const f = makeFight(a, b, 3, Math.floor(Math.random() * 1e9));
      let g = 0, low = 100;
      while (!f.over && g++ < 3000) {
        if (f.betweenRounds) {
          if (f.round === 1) { S.r1Cons.push(Math.min(f.A.consciousness(), f.B.consciousness())); S.r1Core.push(Math.min(f.A.core(), f.B.core())); }
          f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue;
        }
        f.step();
        low = Math.min(low, f.A.consciousness(), f.B.consciousness());
      }
      S.n++;
      const m = f.result.method;
      if (m === 'DEC' || m === 'DRAW') {
        S.dec++;
        S.endCons.push(Math.min(f.A.consciousness(), f.B.consciousness()));
        S.endCore.push(Math.min(f.A.core(), f.B.core()));
        S.minCons.push(low);
      } else if (m === 'SUB') S.sub++; else S.ko++;
    }
    await sleep();
  }
  const avg = (x) => (x.length ? Math.round(x.reduce((p, c) => p + c, 0) / x.length) : null);
  const p = (x) => Math.round(100 * x / S.n) + '%';
  return { fights: S.n, KO_TKO: p(S.ko), SUB: p(S.sub), DEC: p(S.dec), r1WorstCons: avg(S.r1Cons), r1WorstCore: avg(S.r1Core),
    decWorstEndCons: avg(S.endCons), decWorstEndCore: avg(S.endCore), decLowestCons: avg(S.minCons) };
}

export async function run(o) {
  o = o || {};
  const r = await realism(o.secs || 25);
  return r;
}
