// The pace on the feet: how much of the standing time nobody throws, how long the quiet spells run, how often
// both men let go in the same moment, how often one man flurries, and what a man does when the other is
// hurt or gassed. Quiet engine fights between neighbouring ranked UFC fighters.
//
//   import * as P from './tests/pace.js';
//   await P.audit(20)              // or P.audit(20, { someTune: 1.2 }) for an A/B within one page
const chan = new MessageChannel();
const waiting = [];
chan.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
const sleep = () => new Promise((r) => { waiting.push(r); chan.port2.postMessage(0); });

function makeFight(a, b, seed) {
  const E = MMA.engine, F = MMA.fighter, r = new MMA.RNG(seed);
  const planA = F.autoPlan(a, b, r, 0.7), planB = F.autoPlan(b, a, r, 0.7);
  return new E.Fight({ a, b, planA, planB, rounds: 3, seed: seed + 7, quiet: true,
    judges: [E.makeJudge(r), E.makeJudge(r), E.makeJudge(r)], referee: E.makeReferee(r) });
}

// How much of it the picture shows: real fights through the view on a synthetic clock, at the game's own speed
// (`speed` 1), counting the engine's strikes and shots against what the picture had room to act out — a
// moment it couldn't fit drops its misses first, then its earliest blows.
export async function view(secs = 30, speed = 1, bouts = [1, 3, 4, 2, 0]) {
  const C = await import('./camtest.js'), FV = MMA.fightview;
  const t0 = Date.now();
  let thrown = 0, shown = 0, fights = 0, ms = 0, ticks = 0;
  for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
    await C.setup(bouts[i % bouts.length], true, true);
    const f = C.fight(), cam = FV.cam();
    cam.shownMoves = cam.thrownMoves = 0;
    const real = performance.now, realST = window.setTimeout; let clock = C.now();
    performance.now = () => clock;
    const timers = [];
    window.setTimeout = (fn, ms) => { timers.push({ fn, at: clock + (ms || 0) }); return 0; };
    try {
      FV.setSpeed && FV.setSpeed(speed);
      if (!FV.camStats().running) FV.actions.fvpause();
      const k0 = f.tick + (f.round - 1) * 100;
      let t = 0;
      for (; t < 2000000 && !f.over && Date.now() - t0 < secs * 1000; t += 16) {
        clock += 16; C.setClock(clock);
        for (let k = 0; k < timers.length; k++) if (timers[k].at <= clock) { const x = timers.splice(k--, 1)[0]; try { x.fn(); } catch (e) { /* the result screen */ } }
        FV.camFrame(clock);
      }
      ms += t; ticks += f.tick + (f.round - 1) * 100 - k0;
    } finally { performance.now = real; window.setTimeout = realST; }
    thrown += cam.thrownMoves || 0; shown += cam.shownMoves || 0; fights++;
  }
  // (`msPerMoment`: screen time per 3-second moment of the fight; 3000 / speed if nothing ever waited)
  return { fights, thrown, shown, shownPct: (100 * shown / Math.max(1, thrown)).toFixed(1) + '%', msPerMoment: Math.round(ms / Math.max(1, ticks)), plain: Math.round(3000 / speed) };
}

export async function audit(secs = 20, tune) {
  const E = MMA.engine, W = MMA.world, T = E.TUNE, old = {};
  if (tune) for (const k in tune) { old[k] = T[k]; T[k] = tune[k]; }
  if (!W.state() || !W.state().fighters || W.state().settings.world !== 'real') W.newGame({ world: 'real', seed: 11, promotion: 'UFC' });
  const S = { fights: 0, ko: 0, sub: 0, dec: 0, kd: 0, mins: 0, sigA: 0, sigL: 0, standTicks: 0, idle: 0, both: 0, flurry: 0,
    gaps: [], hurtTicks: 0, hurtAtt: 0, hurtIdle: 0, gasTicks: 0, gasAtt: 0, evenTicks: 0, evenAtt: 0, byKiller: {} };
  const t0 = Date.now();
  let k = 0;
  try {
    while (Date.now() - t0 < secs * 1000) {
      for (let q = 0; q < 4; q++) {
        const d = MMA.data.DIVISIONS[k++ % 8];
        const list = W.rankings(d.id, 'UFC').list;
        const i = Math.floor(Math.random() * 12), a = list[i], b = list[i + 1];
        if (!a || !b) continue;
        const f = makeFight(a, b, Math.floor(Math.random() * 1e9));
        let gap = 0, guard = 0;
        while (!f.over && guard++ < 3000) {
          if (f.betweenRounds) { if (gap) S.gaps.push(gap); gap = 0; f.corner('a', E.aiCorner(f, f.A)); f.corner('b', E.aiCorner(f, f.B)); f.nextRound(); continue; }
          const stand = f.pos === 'stand' && !f.subLock;
          const pre = { a: f.A.stats.sigAtt, b: f.B.stats.sigAtt, ta: f.A.stats.tdAtt, tb: f.B.stats.tdAtt };
          const state = { a: { rk: !!f.B.rocked, gas: f.B.energy < 35 && f.A.energy > f.B.energy + 15, even: !f.A.rocked && !f.B.rocked && Math.abs(f.A.energy - f.B.energy) < 15, killer: f.A.plan.killer },
            b: { rk: !!f.A.rocked, gas: f.A.energy < 35 && f.B.energy > f.A.energy + 15, even: !f.A.rocked && !f.B.rocked && Math.abs(f.A.energy - f.B.energy) < 15, killer: f.B.plan.killer } };
          const selfRocked = { a: !!f.A.rocked, b: !!f.B.rocked };
          f.step();
          if (!stand) { if (gap) S.gaps.push(gap); gap = 0; continue; }
          // (doing something: a strike, a takedown attempt, or tying him up — a shot isn't standing around)
          const tie = f.pos !== 'stand' ? 1 : 0;
          const da = f.A.stats.sigAtt - pre.a + f.A.stats.tdAtt - pre.ta + (tie && f.top === f.A.side ? 1 : 0), db = f.B.stats.sigAtt - pre.b + f.B.stats.tdAtt - pre.tb + (tie && f.top === f.B.side ? 1 : 0);
          S.standTicks++;
          if (!da && !db) {
            S.idle++; gap++;
            if (gap === 8 && (S.long = S.long || []).length < 12) S.long.push({ e: Math.round(f.A.energy) + '/' + Math.round(f.B.energy), act: f.activity(f.A).toFixed(2) + '/' + f.activity(f.B).toFixed(2), heat: (f.heat || 0).toFixed(2), lull: f.lull, rk: !!f.A.rocked + '/' + !!f.B.rocked, t: f.round + ':' + f.tick, range: f.range });
          } else { if (gap) S.gaps.push(gap); gap = 0; }
          if (da && db) S.both++;
          if (da >= 3 || db >= 3) S.flurry++;
          for (const [s, dd] of [['a', da], ['b', db]]) {
            const st = state[s];
            if (selfRocked[s]) continue;
            if (st.rk) {
              S.hurtTicks++; S.hurtAtt += dd; if (!dd) S.hurtIdle++;
              const kb = S.byKiller[st.killer] = S.byKiller[st.killer] || { ticks: 0, att: 0 };
              kb.ticks++; kb.att += dd;
            } else if (st.gas) { S.gasTicks++; S.gasAtt += dd; }
            else if (st.even) { S.evenTicks++; S.evenAtt += dd; }
          }
        }
        if (gap) S.gaps.push(gap);
        const r = f.result;
        S.fights++;
        if (r.method === 'DEC' || r.method === 'DRAW') S.dec++; else if (r.method === 'SUB') S.sub++; else S.ko++;
        S.mins += (r.method === 'DEC' || r.method === 'DRAW') ? 15 : (r.round - 1) * 5 + (r.time || 0) / 60;
        for (const s of [f.A, f.B]) { S.sigA += s.stats.sigAtt; S.sigL += s.stats.sigLand; S.kd += s.stats.kd; }
      }
      await sleep();
    }
  } finally { for (const x in old) T[x] = old[x]; }
  const g = S.gaps.sort((p, q) => p - q), sp = 3; // seconds per moment
  const pc = (x, n) => (100 * x / Math.max(1, n)).toFixed(1) + '%';
  const killer = {};
  for (const x in S.byKiller) killer[x] = (S.byKiller[x].att / Math.max(1, S.byKiller[x].ticks) * 20).toFixed(1) + '/min';
  return {
    fights: S.fights, KO_TKO: pc(S.ko, S.fights), SUB: pc(S.sub, S.fights), DEC: pc(S.dec, S.fights), kdPerFight: (S.kd / S.fights).toFixed(2),
    sigAttPerMin: (S.sigA / S.mins / 2).toFixed(1), sigAttPerStandMin: (S.sigA / (S.standTicks * sp / 60) / 2).toFixed(1), sigAcc: pc(S.sigL, S.sigA),
    standIdle: pc(S.idle, S.standTicks), bothThrow: pc(S.both, S.standTicks), flurry3plus: pc(S.flurry, S.standTicks),
    quietSpellSecs: { median: g.length ? g[g.length >> 1] * sp : 0, p90: g.length ? g[Math.floor(g.length * 0.9)] * sp : 0, max: g.length ? g[g.length - 1] * sp : 0 },
    attPerMin: { evenFight: (S.evenAtt / Math.max(1, S.evenTicks) * 20).toFixed(1), rivalGassed: (S.gasAtt / Math.max(1, S.gasTicks) * 20).toFixed(1), rivalHurt: (S.hurtAtt / Math.max(1, S.hurtTicks) * 20).toFixed(1) },
    rivalHurtIdle: pc(S.hurtIdle, S.hurtTicks), rivalHurtByKiller: killer, longSpells: S.long,
  };
}
