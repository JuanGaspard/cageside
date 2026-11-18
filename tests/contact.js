// Bodies through each other, measured (ANIM.CONTACT, the last pass before they're drawn). Load in the game page
// after camtest.js:
//   const C = await import('/tests/camtest.js'); await C.setup(1, true, true);
//   const K = await import('/tests/contact.js'); K.survey(); ... K.result
// The long ones run on a timer and leave their answer in K.result (the browser tools give up on a call that
// takes more than a few seconds while the pane is hidden).
import * as C from './camtest.js';
const FVX = () => MMA.fightview;
export let result = null, error = null;

// Every held position and every technique and attempt: the overlap (as camtest's overlap(): the worst, and
// the mean of each frame's worst), the pops, and totals to compare. `off`: without CONTACT.
export function survey(off = false) {
  result = null; error = null;
  setTimeout(() => {
    const CT = FVX().anim.CONTACT;
    CT.off = off;
    try {
      const pos = C.overlaps(1500), tech = [];
      let tw = 0, tm = 0, tp = 0, pw = 0, pm = 0;
      for (const T of [...C.TECHNIQUES, ...C.ATTEMPTS]) {
        const r = C.techTest(T.from, T.go, T.ms);
        tw += r.worst; tm += r.mean; tp += r.pops.length;
        tech.push(T.label + ': ' + r.worst + ' / ' + r.mean + ' @' + r.where + ' pops ' + r.pops.length + (r.pops.length ? ' ' + r.pops.slice(0, 3).join(', ') : ''));
      }
      for (const p of pos) { pw += p.worst; pm += p.mean; }
      result = { sum: 'positions worst ' + pw.toFixed(2) + ' mean ' + pm.toFixed(3) + ' | moves worst ' + tw.toFixed(2) + ' mean ' + tm.toFixed(3) + ' pops ' + tp,
        pos: pos.map((p) => p.label + ' ' + p.worst + ' / ' + p.mean + ' ' + p.where), tech };
    } catch (e) { error = e.stack; }
    CT.off = false;
  }, 10);
  return 'started';
}

// The survey's totals for each of a list of CONTACT settings (each { name, ...cfg changes } on top of the
// defaults), one after another; in `variantsOut` as they come, each with the positions' and moves' totals.
export let variantsOut = [];
export function variants(list, measure = 'overlap') {
  variantsOut = [];
  const CT = FVX().anim.CONTACT, base = Object.assign({}, CT.cfg);
  let i = 0;
  const next = () => {
    if (i >= list.length) { Object.assign(CT.cfg, base); CT.off = false; variantsOut.push('done'); return; }
    const v = list[i++];
    Object.assign(CT.cfg, base, v, { name: undefined });
    CT.off = !!v.off;
    if (measure === 'visible') visibleSurvey(); else survey(!!v.off);
    const wait = () => { if (!result && !error) return setTimeout(wait, 500); variantsOut.push(v.name + ': ' + (error || result.sum)); next(); };
    setTimeout(wait, 500);
  };
  next();
  return 'started';
}
// What kind of thing is in what, summed over every technique and attempt (cm a frame, both men): each of one
// man's bones against the other's trunk, head and limbs, his trunk against the other's, his head.
export function census() {
  result = null; error = null;
  setTimeout(() => {
    try {
      const tot = {};
      let n = 0;
      for (const T of [...C.TECHNIQUES, ...C.ATTEMPTS]) {
        T.from(); C.run(2500); T.go();
        for (let t = 0; t < T.ms; t += 45) { C.run(45); const r = classify(); n++; for (const k in r) tot[k] = (tot[k] || 0) + r[k]; }
      }
      const out = {};
      for (const k in tot) out[k] = +(tot[k] / n * 100).toFixed(2);
      result = Object.entries(out).sort((x, y) => y[1] - x[1]);
    } catch (e) { error = e.stack; }
  }, 10);
  return 'started';
}
export function classify() {
  const cam = FVX().cam(), BODY = FVX().anim.BODY, id = (p) => p, res = {};
  const add = (k, d) => { if (d > 0.01) res[k] = (res[k] || 0) + d; };
  for (const [me, opp] of [[cam.a, cam.b], [cam.b, cam.a]]) {
    const S = BODY.shapes(opp, id, id), P = me.v2.pts, s = me.v2.body.s;
    const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    const none = { c: [0, -99, 0], r: 0 };
    const St = { rings: S.rings, caps: [], head: none }, Sh = { rings: [], caps: S.caps.filter((c) => !c.lim), head: S.head }, Sl = { rings: [], caps: S.caps.filter((c) => c.lim), head: none };
    const L = (v) => (v ? Math.hypot(v[0], v[1], v[2]) : 0);
    for (const [a, b, r, nm] of [['shL', 'elL', 0.06, 'upper'], ['elL', 'fiL', 0.05, 'fore'], ['shR', 'elR', 0.06, 'upper'], ['elR', 'fiR', 0.05, 'fore'],
      ['hpL', 'knL', 0.08, 'thigh'], ['knL', 'anL', 0.055, 'shin'], ['hpR', 'knR', 0.08, 'thigh'], ['knR', 'anR', 0.055, 'shin']]) {
      let wt = 0, wh = 0, wl = 0;
      for (let i = 1; i <= 8; i++) {
        const p = mix(P[a], P[b], i / 8);
        wt = Math.max(wt, L(BODY.pen(St, p, r * s, [0, 1, 0], false, true)));
        wh = Math.max(wh, L(BODY.pen(Sh, p, r * s, [0, 1, 0], false)));
        wl = Math.max(wl, L(BODY.pen(Sl, p, r * s, [0, 1, 0], true)));
      }
      add(nm + '>trunk', wt); add(nm + '>head', wh); add(nm + '>limb', wl);
    }
    for (const j of ['P', 'W', 'Ch']) { add('trunk>trunk', L(BODY.pen(St, P[j], 0.11 * s, [0, 1, 0], false, true)) / 2); add('trunk>limb', L(BODY.pen(Sl, P[j], 0.11 * s, [0, 1, 0], true))); }
    add('head>all', L(BODY.pen(S, P.Hd, 0.1 * s, [0, 1, 0], true)));
    // (and under the mat: any of his limbs' points below their own radius)
    for (const [a, b, r] of [['knL', 'anL', 0.045], ['knR', 'anR', 0.045], ['elL', 'fiL', 0.04], ['elR', 'fiR', 0.04]])
      for (let i = 0; i <= 4; i++) { const p = mix(P[a], P[b], i / 4); add('limb>mat', Math.max(0, r * s - p[1])); }
  }
  return res;
}

// One technique, frame by frame from `t0` to `t1`: the overlap as posed (before CONTACT), as CONTACT solved it,
// and as shown, each man's worst and where. (Wraps CONTACT.solve to see what it's given.)
export function trace(T, t0, t1, every = 45) {
  const CT = FVX().anim.CONTACT;
  if (!CT._orig) CT._orig = CT.solve;
  let capt = null;
  CT.solve = function (ga, gb) { const cp = (g) => { const o = {}; for (const k in g.pt) o[k] = g.pt[k].slice(); return o; }; capt = { a: cp(ga), b: cp(gb) }; return CT._orig.apply(this, arguments); };
  try {
    T.from(); C.run(2500); T.go();
    const rows = [], cam = FVX().cam();
    for (let t = 0; t <= t1; t += 15) {
      C.run(15);
      if (t >= t0 && t % every === 0 && capt) {
        const L = CT.last, f = (o) => o.a + ' | ' + o.b;
        rows.push(t + ' posed ' + f(ovl(capt.a, capt.b)) + ' / solved ' + (L ? f(ovl(L.X.P, L.Y.P)) : '-') + ' / shown ' + f(ovl(cam.a.v2.pts, cam.b.v2.pts)));
      }
    }
    return rows;
  } finally { CT.solve = CT._orig; }
}
// The pops through a technique (as camtest's techTest), each found both as posed (before CONTACT) and as
// shown: which are the pose's own and which CONTACT's.
export function popsOf(T) {
  const CT = FVX().anim.CONTACT;
  if (!CT._orig) CT._orig = CT.solve;
  let capt = null;
  CT.solve = function (ga, gb) { const cp = (g) => { const o = {}; for (const k in g.pt) o[k] = g.pt[k].slice(); return o; }; capt = { a: cp(ga), b: cp(gb) }; return CT._orig.apply(this, arguments); };
  try {
    T.from(); C.run(2500); T.go();
    const cam = FVX().cam(), posed = [], shown = [], snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
    for (let t = 0; t < T.ms; t += 15) { C.run(15); posed.push({ t, a: capt ? capt.a : snap(cam.a), b: capt ? capt.b : snap(cam.b) }); shown.push({ t, a: snap(cam.a), b: snap(cam.b) }); }
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    // (a stance mirrored: left and right trade names where they are, the same picture)
    const other = (k) => (/[LR]$/.test(k) ? k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L') : k);
    const find = (frames) => {
      const out = [];
      for (const s of ['a', 'b']) for (let i = 2; i + 1 < frames.length; i++) {
        const J = frames[i][s], P = frames[i - 1][s], Q = frames[i - 2][s], N = frames[i + 1][s];
        for (const k in J) {
          if (!P[k] || !Q[k] || !N[k]) continue;
          const d = dd(J[k], P[k]);
          if (P[other(k)] && dd(J[k], P[other(k)]) < Math.max(0.03, 0.5 * dd(J[k], P[k]))) continue;
          if (d > 0.03 && d > 2.5 * Math.max(dd(P[k], Q[k]), dd(N[k], J[k]), 0.004)) out.push(frames[i].t + ' ' + s + '.' + k + ' ' + (d * 100).toFixed(1));
        }
      }
      return out;
    };
    return { posed: find(posed), shown: find(shown) };
  } finally { CT.solve = CT._orig; }
}
// How fast each point goes through a technique (`speed`: the picture's own, 2 as in live play), as posed and
// as shown: every point over `over` m/s, with when (ms after go) and how fast.
export function speeds(T, speed = 2, over = 6) {
  const CT = FVX().anim.CONTACT;
  if (!CT._orig) CT._orig = CT.solve;
  let capt = null;
  CT.solve = function (ga, gb) { const cp = (g) => { const o = {}; for (const k in g.pt) o[k] = g.pt[k].slice(); return o; }; capt = { a: cp(ga), b: cp(gb) }; return CT._orig.apply(this, arguments); };
  FVX().setSpeed(speed);
  try {
    T.from(); C.run(2500); T.go();
    const cam = FVX().cam(), posed = [], shown = [], snap = (g) => { const J = {}; for (const k in g.v2.pts) J[k] = g.v2.pts[k].slice(); return J; };
    for (let t = 0; t < T.ms / speed + 300; t += 15) { C.run(15); posed.push({ t, a: capt ? capt.a : snap(cam.a), b: capt ? capt.b : snap(cam.b) }); shown.push({ t, a: snap(cam.a), b: snap(cam.b) }); }
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const find = (fr) => { const out = []; for (const s of ['a', 'b']) for (let i = 1; i < fr.length; i++) for (const k in fr[i][s]) { const P = fr[i - 1][s][k]; if (!P) continue; const v = dd(fr[i][s][k], P) / 0.015; if (v > over) out.push(fr[i].t + ' ' + s + '.' + k + ' ' + v.toFixed(1)); } return out; };
    return { posed: find(posed), shown: find(shown) };
  } finally { CT.solve = CT._orig; FVX().setSpeed(1); }
}
// What's visibly in what: points on each man's surface as it's drawn (the trunk's sections round their
// outline, the head, each limb's tube round and along it, the radii the 3D figure has) tested against the
// other man's shapes at the radii they're drawn with. { a/b: { [part>part]: deepest m } , worst, where }.
const T3R = { thigh: [0.092, 0.06], shin: [0.06, 0.039], upper: [0.062, 0.045], fore: [0.046, 0.04] };
export function surfacePoints(g) {
  const P = g.pts, F = g.fr, b = g.body, s = b.s, t = b.thick, RINGS = FVX().anim.BODY ? null : null, out = [];
  const add = (a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  // the trunk as drawn (FIG.RINGS: [frame, joint, height, half-width, depth in front, behind])
  const R = MMA.fightview.anim.RINGS || [
    ['Rp', 'P', -0.1, 0.11, 0.07, 0.08], ['Rp', 'P', -0.02, 0.165, 0.095, 0.13], ['Rp', 'P', 0.08, 0.15, 0.1, 0.1],
    ['Rw', 'W', 0, 0.14, 0.105, 0.095], ['Rw', 'W', 0.12, 0.155, 0.115, 0.1],
    ['Rc', 'Ch', 0.02, 0.17, 0.13, 0.11], ['Rc', 'Ch', 0.11, 0.175, 0.115, 0.115], ['Rc', 'N', -0.01, 0.11, 0.07, 0.085]];
  R.forEach(([fk, jk, h, w, df, db], i) => {
    const Fr = F[fk], c = add(P[jk], mul(Fr[1], h * s)), gut = i === 3 || i === 4 ? 1 + 0.3 * b.build : 1;
    const W = w * s * b.wide, Df = df * s * t * gut, Db = db * s * t;
    for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); out.push({ p: add(add(c, mul(Fr[0], (ca >= 0 ? Df : Db) * ca)), mul(Fr[2], W * sa)), part: 'trunk' }); }
  });
  // the head, a ball 0.1 s round, a little taller than wide
  const hu = unit(sub(P.Hd, P.Nt)), hx = unit(cross(hu, [0, 0, 1])), hz = cross(hx, hu);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) { const th = (i + 0.5) / 6 * Math.PI, ph = j / 8 * Math.PI * 2, r = 0.1 * s; out.push({ p: add(P.Hd, add(add(mul(hu, Math.cos(th) * r * 1.16), mul(hx, Math.sin(th) * Math.cos(ph) * r * 0.98)), mul(hz, Math.sin(th) * Math.sin(ph) * r * 0.95))), part: 'head' }); }
  // each limb's tube
  for (const k of ['L', 'R']) for (const [a, c, nm] of [['hp' + k, 'kn' + k, 'thigh'], ['kn' + k, 'an' + k, 'shin'], ['sh' + k, 'el' + k, 'upper'], ['el' + k, 'fi' + k, 'fore']]) {
    const A = P[a], B = P[c], ax = unit(sub(B, A)), q = unit(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), q2 = cross(ax, q), [r1, r2] = T3R[nm];
    for (let i = 1; i <= 4; i++) { const u = i / 5, m = add(A, mul(sub(B, A), u)), r = (r1 + (r2 - r1) * u) * s * t; for (let j = 0; j < 8; j++) { const ph = j / 8 * Math.PI * 2; out.push({ p: add(m, add(mul(q, Math.cos(ph) * r), mul(q2, Math.sin(ph) * r))), part: nm }); } }
  }
  return out;
}
export function visible() {
  const cam = FVX().cam(), BODY = FVX().anim.BODY, id = (p) => p, res = { worst: 0, where: '' };
  for (const [k, me, opp] of [['a', cam.a, cam.b], ['b', cam.b, cam.a]]) {
    const S = BODY.shapes(opp, id, id), by = {};
    // (his shapes split, to say what each point is in)
    const none = { c: [0, -99, 0], r: 0 }, parts = { trunk: { rings: S.rings, caps: [], head: none }, head: { rings: [], caps: S.caps.filter((c) => !c.lim), head: S.head }, limb: { rings: [], caps: S.caps.filter((c) => c.lim), head: none } };
    for (const { p, part } of surfacePoints(me.v2)) for (const pk in parts) {
      const v = BODY.pen(parts[pk], p, 0, [0, 1, 0], true), d = v ? Math.hypot(v[0], v[1], v[2]) * (pk === 'limb' ? 2 : 1) : 0;
      if (d > 0.005) { const key = part + '>' + pk; by[key] = Math.max(by[key] || 0, d); if (d > res.worst) { res.worst = d; res.where = k + ' ' + key; } }
    }
    res[k] = by;
  }
  return res;
}
// A man's own limbs in his own body, as drawn: his arms' and legs' surface points (the upper arm and thigh
// from halfway out, where they're clear of the shoulder and hip they hang from; the forearm and shin all
// along) against his own trunk, neck and head. { a/b: { part: deepest m }, worst, where }.
export function selfVisible() {
  const cam = FVX().cam(), BODY = FVX().anim.BODY, id = (p) => p, res = { worst: 0, where: '' };
  for (const [k, me] of [['a', cam.a], ['b', cam.b]]) {
    const S = BODY.shapes(me, id, id), own = { rings: S.rings, caps: S.caps.filter((c) => !c.lim), head: S.head }, by = {};
    const pts = surfacePoints(me.v2), per = { thigh: 32, shin: 32, upper: 32, fore: 32 };
    // (surfacePoints gives each tube 4 rings of 8 along it: the first two rings of the upper arm and thigh are
    // within half of the root)
    const seen = {};
    for (const { p, part } of pts) {
      if (part === 'trunk' || part === 'head') continue;
      const key = part + (seen[part] = (seen[part] || 0) + 1);
      const n = seen[part] - 1, side = Math.floor(n / per[part]), ring = Math.floor((n % per[part]) / 8);
      if ((part === 'upper' || part === 'thigh') && ring < 2) continue;
      const v = BODY.pen(own, p, 0, [0, 1, 0], false), d = v ? Math.hypot(v[0], v[1], v[2]) : 0;
      if (d > 0.005) { const kk = part + (side ? 'R' : 'L'); by[kk] = Math.max(by[kk] || 0, d); if (d > res.worst) { res.worst = d; res.where = k + ' ' + kk; } }
    }
    res[k] = by;
  }
  return res;
}
// selfVisible() through every held position, technique and attempt, standing still, the strikes and the
// clinch: per situation the mean of the deepest (cm) and the worst, and how often anything's over 3 cm in.
export function selfSurvey() {
  result = null; error = null;
  setTimeout(() => {
    try {
      const rows = [];
      const watch = (label, ms) => { let s = 0, n = 0, w = 0, wh = '', deep = 0; for (let t = 0; t < ms; t += 45) { C.run(45); const r = selfVisible(); s += r.worst; n++; if (r.worst > 0.03) deep++; if (r.worst > w) { w = r.worst; wh = r.where + ' @' + t; } } rows.push([label, +(s / n * 100).toFixed(1), +(w * 100).toFixed(1), wh, Math.round(deep / n * 100) + '%']); };
      for (const [label, g, sub, att] of C.POSITIONS) { C.pos(g, 'a', sub || null, att || 'a'); C.run(1600); watch(label, 1200); }
      for (const T of [...C.TECHNIQUES, ...C.ATTEMPTS]) { T.from(); C.run(2500); T.go(); watch(T.label, T.ms); }
      C.pos('stand'); C.run(2500); watch('standing', 1500);
      for (const S of C.STRIKES) { S.go(); watch('strike ' + S.label, S.ms + 200); }
      C.pos('clinch'); C.run(2500); watch('clinch', 1500);
      result = rows.sort((x, y) => y[1] - x[1]);
    } catch (e) { error = e.stack; }
  }, 10);
  return 'started';
}
// Each technique and attempt and each held position, frame by frame, measured as visible(): for each kind of
// thing in another (trunk>trunk, fore>limb...), the mean over frames of the deepest (cm), and its worst.
export function visibleSurvey() {
  result = null; error = null;
  setTimeout(() => {
    try {
      const tot = {}, worst = {};
      let n = 0, deep = 0;
      const take = () => { const r = visible(); n++; if (r.worst > 0.04) deep++; for (const s of ['a', 'b']) for (const k in r[s]) { tot[k] = (tot[k] || 0) + r[s][k]; worst[k] = Math.max(worst[k] || 0, r[s][k]); } };
      for (const [label, g, sub, att] of C.POSITIONS) { C.pos(g, 'a', sub || null, att || 'a'); C.run(1600); for (let t = 0; t < 900; t += 90) { C.run(90); take(); } }
      const nPos = n, totPos = Object.assign({}, tot);
      for (const T of [...C.TECHNIQUES, ...C.ATTEMPTS]) { T.from(); C.run(2500); T.go(); for (let t = 0; t < T.ms; t += 45) { C.run(45); take(); } }
      const fmt = (o, m) => Object.entries(o).map(([k, v]) => [k, +(v / m * 100).toFixed(2)]).sort((x, y) => y[1] - x[1]);
      const moves = {}; for (const k in tot) moves[k] = tot[k] - (totPos[k] || 0);
      const sum = (o, m) => Object.values(o).reduce((a, v) => a + v, 0) / m * 100;
      const w = Object.entries(worst).map(([k, v]) => [k, +(v * 100).toFixed(1)]).sort((x, y) => y[1] - x[1]);
      result = { sum: 'positions ' + sum(totPos, nPos).toFixed(2) + ' cm | moves ' + sum(moves, n - nPos).toFixed(2) + ' cm | over 4 cm ' + (deep / n * 100).toFixed(1) + '% of frames | worst ' + w.slice(0, 3).map((x) => x.join(' ')).join(', '),
        positions: fmt(totPos, nPos), moves: fmt(moves, n - nPos), worst: w };
    } catch (e) { error = e.stack; }
  }, 10);
  return 'started';
}
// Each technique and attempt's deepest moment as visible() sees it: [label, cm, ms after go, what in what],
// and how many frames anything is more than 4 cm in, deepest first.
export function worstMoments(off = false, list = null) {
  result = null; error = null;
  setTimeout(() => {
    const CT = FVX().anim.CONTACT;
    CT.off = off;
    try {
      const out = [];
      for (const T of list || [...C.TECHNIQUES, ...C.ATTEMPTS]) {
        T.from(); C.run(2500); T.go();
        let w = 0, at = 0, where = '', deep = 0, sum = 0, n = 0;
        // (and the stretches over 6 cm: from, to, deepest, what in what)
        const spans = [];
        let cur = null;
        for (let t = 0; t < T.ms; t += 30) {
          C.run(30); const r = visible(); n++; sum += r.worst;
          if (r.worst > 0.04) deep++;
          if (r.worst > w) { w = r.worst; at = t; where = r.where; }
          if (r.worst > 0.06) { if (!cur) spans.push(cur = { from: t, to: t, d: 0, where: '' }); cur.to = t; if (r.worst > cur.d) { cur.d = r.worst; cur.where = r.where; } } else cur = null;
        }
        out.push([T.label, +(w * 100).toFixed(1), at, where, deep, +(sum / n * 100).toFixed(1), spans.map((s) => s.from + '-' + s.to + ' ' + (s.d * 100).toFixed(0) + ' ' + s.where).join('; ')]);
      }
      result = out.sort((x, y) => y[5] - x[5]);
    } catch (e) { error = e.stack; }
    CT.off = false;
  }, 10);
  return 'started';
}
// worstMoments() steadier: the position each move starts from is still working (the guard player's head and
// arms go 10 to 15 cm about), so one run says as much about the moment it started as about the move. Each
// started `reps` times, `gap` ms apart in the position's working, with the same random numbers each time: per
// move [label, mean cm (of the runs' means), worst cm (of any run), frames over 4 cm (%), the moments over 6 cm
// that come up in more than one run: clip-ish ms (60 ms bins), how many runs, deepest, what in what].
// One technique at each of `times` (ms after go): what's deepest in what as shown and as posed (before
// CONTACT), part, side and ring along it (trunk: which section), and each man's move with its own time and
// the grips it has on.
export function why(label, times) {
  const FV = FVX(), CT = FV.anim.CONTACT, BODY = FV.anim.BODY, id = (p) => p;
  const T = [...C.TECHNIQUES, ...C.ATTEMPTS].find((t) => t.label === label);
  let capt = null, now = 0;
  const orig = CT.solve, ocf = FV.camFrame;
  CT.solve = function (ga, gb) { const cp = (g) => { const o = {}; for (const k in g.pt) o[k] = g.pt[k].slice(); return o; }; capt = { a: cp(ga), b: cp(gb) }; return orig.apply(this, arguments); };
  FV.camFrame = function (c) { now = c; return ocf.apply(this, arguments); };
  const detail = () => {
    const cam = FV.cam(), out = [];
    for (const [k, me, opp] of [['a', cam.a, cam.b], ['b', cam.b, cam.a]]) {
      const S = BODY.shapes(opp, id, id), none = { c: [0, -99, 0], r: 0 };
      const parts = { trunk: { rings: S.rings, caps: [], head: none }, head: { rings: [], caps: S.caps.filter((c) => !c.lim), head: S.head }, limb: { rings: [], caps: S.caps.filter((c) => c.lim), head: none } };
      const cnt = {};
      let best = { d: 0 };
      for (const { p, part } of surfacePoints(me.v2)) {
        const n = cnt[part] = (cnt[part] || 0) + 1, limb = part !== 'trunk' && part !== 'head';
        const nm = part + (limb ? ((n - 1) >= 32 ? 'R' : 'L') + '#' + Math.floor(((n - 1) % 32) / 8) : part === 'trunk' ? '#' + Math.floor((n - 1) / 16) : '');
        for (const pk in parts) { const v = BODY.pen(parts[pk], p, 0, [0, 1, 0], true), d = v ? Math.hypot(...v) * (pk === 'limb' ? 2 : 1) : 0; if (d > best.d) best = { d, s: nm + '>' + pk }; }
      }
      out.push(k + ' ' + (best.d * 100).toFixed(1) + ' ' + (best.s || ''));
    }
    return out.join(', ');
  };
  try {
    T.from(); C.run(2500); T.go();
    let el = 0;
    const rows = [];
    for (const tm of times) {
      C.run(tm - el); el = tm;
      const cam = FV.cam(), shown = detail(), keep = { a: cam.a.v2.pts, b: cam.b.v2.pts };
      cam.a.v2.pts = capt.a; cam.b.v2.pts = capt.b;
      const posed = detail();
      cam.a.v2.pts = keep.a; cam.b.v2.pts = keep.b;
      const acts = ['a', 'b'].map((k) => { const a = cam[k].acts.find((x) => x.trans); if (!a) return k + ' -'; const lt = Math.round((now - a.t0) * a.C.dur / a.dur); return k + ' ' + a.C.id + '@' + lt + ' ' + (a.grips || []).filter((g) => lt >= g.t[0] && lt < g.t[1]).map((g) => g.eff + '>' + g.to.slice(0, 2).join('-')).join(' '); }).join(' ; ');
      rows.push(tm + ' shown [' + shown + '] posed [' + posed + '] ' + acts);
    }
    return rows;
  } finally { CT.solve = orig; FV.camFrame = ocf; }
}
// The held positions' shape, to check a change of CONTACT keeps them as built (kept out of each other by being
// slid apart, mount came off and side control was half a metre wide): for each, held, the mean over 900 ms
// of how far apart their hips and their chests are on the floor (cm), and each man's hips' height (cm).
export function shapesOfPositions() {
  const out = [];
  for (const [label, g, sub, att] of C.POSITIONS) {
    C.pos(g, 'a', sub || null, att || 'a'); C.run(1600);
    let n = 0, hp = 0, ch = 0, ya = 0, yb = 0;
    for (let t = 0; t < 900; t += 90) {
      C.run(90);
      const cam = FVX().cam(), A = cam.a.v2.pts, B = cam.b.v2.pts;
      hp += Math.hypot(A.P[0] - B.P[0], A.P[2] - B.P[2]); ch += Math.hypot(A.Ch[0] - B.Ch[0], A.Ch[2] - B.Ch[2]); ya += A.P[1]; yb += B.P[1]; n++;
    }
    out.push([label, Math.round(hp / n * 100), Math.round(ch / n * 100), Math.round(ya / n * 100), Math.round(yb / n * 100)]);
  }
  return out;
}
// How deep one man's `parts` (of thigh, shin, upper, fore, trunk, head) are in the other's trunk and head as
// keyed (CONTACT off) from t0 to t1 ms after go, every 30: [mean cm, deepest cm, when]. Quick, for keying.
export function posedIn(label, who, parts, t0, t1, withContact = false) {
  const FV = FVX(), CT = FV.anim.CONTACT, BODY = FV.anim.BODY, id = (p) => p;
  const T = [...C.TECHNIQUES, ...C.ATTEMPTS].find((t) => t.label === label);
  CT.off = !withContact;
  try {
    T.from(); C.run(2500); T.go(); C.run(t0);
    let s = 0, n = 0, w = 0, at = 0;
    for (let t = t0; t <= t1; t += 30) {
      const cam = FV.cam(), me = cam[who], opp = cam[who === 'a' ? 'b' : 'a'], S = BODY.shapes(opp, id, id), body = { rings: S.rings, caps: S.caps.filter((c) => !c.lim), head: S.head };
      let d = 0;
      for (const { p, part } of surfacePoints(me.v2)) if (parts.includes(part)) { const v = BODY.pen(body, p, 0, [0, 1, 0], false); if (v) d = Math.max(d, Math.hypot(...v)); }
      s += d; n++; if (d > w) { w = d; at = t; }
      C.run(30);
    }
    return [+(s / n * 100).toFixed(1), +(w * 100).toFixed(1), at];
  } finally { CT.off = false; }
}
// The jumps (popsOf, as shown) through every move, each started `reps` times as worstMany() does: per move
// [label, jumps over 10 cm in all the runs, runs with one, the biggest (cm), the biggest few: ms point cm],
// and in `result.sum` the totals. (A knee or toe jumping 20 to 80 cm in a frame, in some runs and not others.)
export function popsMany(list = null, reps = 4, gap = 170) {
  result = null; error = null;
  setTimeout(() => {
    const realR = Math.random;
    let seed = 1;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    try {
      const out = [];
      let n10 = 0, n20 = 0, runsWith = 0;
      for (const T of list || [...C.TECHNIQUES, ...C.ATTEMPTS]) {
        const all = [];
        let withOne = 0;
        for (let r = 0; r < reps; r++) {
          seed = 12345 + r;
          // (popsOf sets up and starts the move itself: started at the same moment of the working each time)
          const from = T.from;
          const T2 = Object.assign({}, T, { from: () => { from(); C.run(1000); align(r * gap - 1000); } });
          const big = popsOf(T2).shown.map((s) => { const p = s.split(' '); return { t: +p[0], what: p[1], cm: +p[2] }; }).filter((p) => p.cm > 10);
          if (big.length) withOne++;
          all.push(...big);
        }
        const top = all.slice().sort((x, y) => y.cm - x.cm);
        n10 += all.length; n20 += all.filter((p) => p.cm > 20).length; runsWith += withOne;
        out.push([T.label, all.length, withOne, top.length ? top[0].cm : 0, top.slice(0, 4).map((p) => p.t + ' ' + p.what + ' ' + p.cm).join(', ')]);
      }
      result = { sum: 'jumps over 10 cm ' + n10 + ', over 20 cm ' + n20 + ', runs with one ' + runsWith, rows: out.sort((x, y) => y[3] - x[3]) };
    } catch (e) { error = e.stack; }
    Math.random = realR;
  }, 10);
  return 'started';
}
// What CONTACT adds to how fast the legs move: every move started `reps` times as worstMany(), and each frame,
// for each knee, ankle and toe, how much further it moved as shown than as keyed (cm). Per move [label,
// frames with more than 10 cm added, more than 20, the most (cm), where]; result.sum the totals. A jump and a
// whip over a few frames count alike, frame by frame.
export function legExcess(list = null, reps = 4, gap = 170) {
  result = null; error = null;
  setTimeout(() => {
    const realR = Math.random, CT = FVX().anim.CONTACT;
    let seed = 1;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    try {
      const out = [];
      let n10 = 0, n20 = 0, frames = 0;
      for (const T of list || [...C.TECHNIQUES, ...C.ATTEMPTS]) {
        let a10 = 0, a20 = 0, w = 0, wh = '';
        const list10 = [];
        for (let r = 0; r < reps; r++) {
          seed = 12345 + r;
          T.from(); C.run(1000); align(r * gap - 1000); C.run(2500); T.go();
          let prev = null;
          for (let t = 0; t < T.ms; t += 15) {
            CT.dbg = []; C.run(15); frames++;
            const rec = {};
            for (const d of CT.dbg) if (d && d.who && !d.fix) rec[d.who] = d;
            if (prev) for (const who of ['a', 'b']) {
              const A = rec[who], B = prev[who];
              if (!A || !B || !A.shown || !B.shown) continue;
              let e = 0, ek = '';
              for (const k of ['knL', 'knR', 'anL', 'anR', 'toL', 'toR']) { const x = dd(A.shown[k], B.shown[k]) - dd(A.raw[k], B.raw[k]); if (x > e) { e = x; ek = k; } }
              if (e > 0.1) { a10++; if (list10.length < 12) list10.push('r' + r + ' ' + t + ' ' + who + '.' + ek + ' ' + (e * 100).toFixed(0)); }
              if (e > 0.2) a20++;
              if (e > w) { w = e; wh = t + ' ' + who + '.' + ek; }
            }
            prev = rec;
          }
        }
        CT.dbg = null;
        n10 += a10; n20 += a20;
        out.push([T.label, a10, a20, +(w * 100).toFixed(1), wh, list10.join(', ')]);
      }
      result = { sum: 'frames with more than 10 cm added ' + n10 + ', 20 cm ' + n20 + ' (of ' + frames + ')', rows: out.sort((x, y) => y[3] - x[3]) };
    } catch (e) { error = e.stack; }
    CT.dbg = null;
    Math.random = realR;
  }, 10);
  return 'started';
}
// Everything the picture can show, looked at for anything odd, one row a situation: standing, each strike, the
// clinch, each held position, each technique and attempt. Per situation, over its frames (15 ms):
//   in: the other man's body, mean of each frame's deepest and the worst (cm); self: his own;
//   jumps: points moving more than 8 cm in a frame and 2.5 times their neighbours' (not left and right trading);
//   posture: each joint past its range (camtest's posture()), the worst by how far (rad) and for how many frames;
//   float: held up on nothing (cm, on the mat); under: anything under the mat (cm);
//   fast: the fastest a point that isn't striking goes (m/s).
// result: rows sorted by a rough score, worst first; saved as review/<name>.json when `name` is given.
export function audit(name = null, only = null) {
  result = null; error = null;
  setTimeout(async () => {
    const realR = Math.random;
    let seed = 1;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const other = (k) => (/[LR]$/.test(k) ? k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L') : k);
    try {
      const sits = [];
      sits.push({ label: 'standing', ms: 3000, set: () => { C.pos('stand'); C.run(2500); } });
      for (const S of [...C.STRIKES, ...C.KICKS_DEF]) sits.push({ label: 'strike: ' + S.label, ms: S.ms + 500, strike: true, set: () => { C.pos('stand'); C.run(2500); S.go(); } });
      sits.push({ label: 'clinch', ms: 3000, set: () => { C.pos('stand'); C.run(1500); C.pos('clinch'); C.run(2500); } });
      sits.push({ label: 'into the clinch', ms: 2000, set: () => { C.pos('stand'); C.run(2500); C.pos('clinch'); } });
      sits.push({ label: 'out of the clinch', ms: 2000, set: () => { C.pos('clinch'); C.run(2500); C.pos('stand'); } });
      for (const [label, g, sub, att] of C.POSITIONS) sits.push({ label: 'held: ' + label, ms: 3000, ground: true, set: () => { C.pos(g, 'a', sub || null, att || 'a'); C.run(2500); } });
      for (const [label, g, sub, att] of C.POSITIONS) if (sub) sits.push({ label: 'into: ' + label, ms: 2200, ground: true, set: () => { C.pos(g, 'a', null, 'a'); C.run(2500); C.pos(g, 'a', sub, att || 'a'); } });
      for (const T of [...C.TECHNIQUES, ...C.ATTEMPTS]) sits.push({ label: T.label, ms: T.ms + 600, ground: true, set: () => { T.from(); C.run(2500); T.go(); } });
      const rows = [];
      for (const S of sits) {
        if (only && !only.some((o) => S.label.includes(o))) continue;
        seed = 4242;
        // A clean slate first. Each situation sets its own starting position, but the figures carry everything
        // else over from whatever ran before: strikes still in the air, where their feet are, the restless
        // offset, the hit-stop. The same situation scored 4 run on its own and 20 run after the rest, which
        // sent me looking for a fault in a clip that was already fixed. Reset, then settle, then set up.
        const c0 = FVX().cam();
        for (const sd of ['a', 'b']) { const g = c0[sd]; if (!g) continue; if (g.acts) g.acts.length = 0; if (g.fw) g.fw.off = true; g.legFree = 0; }
        c0.rest = null; c0.closeUntil = 0; c0.wideUntil = 0; c0.stopUntil = 0; c0.slowUntil = 0; c0.attempt = null;
        C.pos('stand'); C.run(900);
        S.set();
        const cam = FVX().cam();
        let n = 0, inS = 0, inW = 0, inWh = '', inAt = 0, selfS = 0, selfW = 0, selfWh = '', fl = 0, flAt = 0, under = 0, underWh = '', fast = 0, fastWh = '';
        const post = {}, frames = [], jumps = [], caught = [], CT = FVX().anim.CONTACT, f1 = (x) => (x * 100).toFixed(1);
        let prevRec = null;
        for (let t = 0; t < S.ms; t += 15) {
          CT.dbg = [];
          C.run(15); n++;
          // (the contact pass's own record of a leg thrown: what it was given, what each step did)
          const rec = { fx: {} };
          for (const d of CT.dbg) if (d && d.fix) rec.fx[d.who + d.i] = d; else if (d && d.who) rec[d.who] = d;
          CT.dbg = null;
          if (prevRec) for (const who of ['a', 'b']) {
            const A = rec[who], B = prevRec[who];
            if (!A || !B || !A.shown || !B.shown) continue;
            for (const k of ['knL', 'knR', 'anL', 'anR', 'toL', 'toR']) {
              const sh = dd(A.shown[k], B.shown[k]), rw = dd(A.raw[k], B.raw[k]);
              if (sh - rw < 0.15 || caught.length > 5) continue;
              const sd = k.slice(-1), F = rec.fx[who + (sd === 'L' ? 2 : 3)], toe = 'toe' + sd;
              caught.push(t + ' ' + who + '.' + k + ' shown ' + f1(sh) + ' raw ' + f1(rw) + (A.plan[k] ? ' plan ' + f1(dd(A.plan[k], B.shown[k])) : '') +
                (k.startsWith('to') && A[toe] && B[toe] ? ' follow ' + f1(dd(A[toe].follow, B[toe].follow)) + ' inLine ' + f1(dd(A[toe].inLine, B[toe].inLine)) + ' tw ' + B[toe].wF.toFixed(2) + '>' + A[toe].wF.toFixed(2) : '') +
                ' kn ' + f1(dd(A.shown['kn' + sd], B.shown['kn' + sd])) + ' an ' + f1(dd(A.shown['an' + sd], B.shown['an' + sd])) +
                (F && F.m1 ? ' | lengths ' + f1(dd(F.m1, F.m0)) + (F.m2 ? ' bend ' + f1(dd(F.m2, F.m1)) : '') + (F.m3 ? ' hipLim ' + f1(dd(F.m3, F.m2 || F.m1)) : '') + ' reach ' + F.reach.toFixed(2) + ' wIK ' + (+F.wIK).toFixed(2) + ' anat ' + F.anat + ' hip ' + F.hip : ''));
            }
          }
          prevRec = rec;
          const v = visible(), sv = selfVisible();
          inS += v.worst; if (v.worst > inW) { inW = v.worst; inWh = v.where; inAt = t; }
          selfS += sv.worst; if (sv.worst > selfW) { selfW = sv.worst; selfWh = sv.where + ' @' + t; }
          const fr = {};
          for (const s of ['a', 'b']) {
            const g = cam[s].v2, P = g.pts;
            fr[s] = {};
            for (const k in P) fr[s][k] = P[k].slice();
            const p = C.posture(g);
            if (p) for (const k in p.by) { const e = post[s + ' ' + k] = post[s + ' ' + k] || { v: 0, n: 0, at: 0 }; e.n++; if (p.by[k] > e.v) { e.v = p.by[k]; e.at = t; } }
            if (g.base && !/^(guard|hurt|clinch)$/.test(g.base)) { const f = C.unsupported(g, cam[s === 'a' ? 'b' : 'a']); if (f > fl) { fl = f; flAt = t; } }
            for (const k in P) if (P[k][1] < -0.02 && -P[k][1] > under) { under = -P[k][1]; underWh = s + '.' + k + ' @' + t; }
          }
          frames.push(fr);
        }
        for (const s of ['a', 'b']) for (let i = 2; i + 1 < frames.length; i++) {
          const J = frames[i][s], P = frames[i - 1][s], Q = frames[i - 2][s], N = frames[i + 1][s];
          for (const k in J) {
            if (!P[k] || !Q[k] || !N[k]) continue;
            const d = dd(J[k], P[k]);
            if (P[other(k)] && dd(J[k], P[other(k)]) < Math.max(0.03, 0.5 * d)) continue;
            if (d > 0.08 && d > 2.5 * Math.max(dd(P[k], Q[k]), dd(N[k], J[k]), 0.004)) jumps.push((i * 15) + ' ' + s + '.' + k + ' ' + (d * 100).toFixed(0));
            // (a strike's own hand or foot is meant to be fast: only the mat and the clinch)
            if (!S.strike && d / 0.015 > fast) { fast = d / 0.015; fastWh = s + '.' + k + ' @' + (i * 15); }
          }
        }
        const pl = Object.entries(post).map(([k, e]) => [k, +e.v.toFixed(2), e.n, e.at]).sort((x, y) => y[1] * Math.min(1, y[2] / 10) - x[1] * Math.min(1, x[2] / 10));
        const score = inS / n * 100 + inW * 30 + selfS / n * 100 + jumps.length * 2 + pl.reduce((a, p) => a + p[1] * Math.min(1, p[2] / 10) * 3, 0) + fl * 60 + under * 100 + Math.max(0, fast - 8) * 0.5;
        rows.push({ label: S.label, score: +score.toFixed(1), in: (inS / n * 100).toFixed(1) + '/' + (inW * 100).toFixed(0) + ' ' + inWh + ' @' + inAt, self: (selfS / n * 100).toFixed(1) + '/' + (selfW * 100).toFixed(0) + ' ' + selfWh,
          jumps: jumps.length + (jumps.length ? ': ' + jumps.slice(0, 5).join(', ') : ''), posture: pl.slice(0, 6).map((p) => p[0] + ' ' + p[1] + ' x' + p[2] + ' @' + p[3]).join('; '),
          float: (fl * 100).toFixed(0) + (fl > 0.04 ? ' @' + flAt : ''), under: (under * 100).toFixed(0) + ' ' + underWh, fast: fast.toFixed(1) + ' ' + fastWh, caught: caught.join(' || ') });
        // (a turn of the page between situations, on a message channel: a timer in a hidden pane is held back,
        // up to a minute at a time once it's been hidden a while)
        await new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
      }
      rows.sort((x, y) => y.score - x.score);
      if (name) await fetch('/review/' + name + '.json', { method: 'PUT', body: JSON.stringify(rows, null, 1) });
      result = rows;
    } catch (e) { error = e.stack; if (name) fetch('/review/' + name + '.json', { method: 'PUT', body: JSON.stringify({ error }) }); }
    Math.random = realR;
  }, 10);
  return 'started';
}
// One leg of one man through one run (`r`, as popsMany()), frame by frame from t0 to t1: the move playing and
// its own time, how fast the knee goes as keyed and as shown (m/s), how far the push has it from as keyed (cm),
// and the last pass's knee limit [angle from the leg's front, limit, put back] and hip limit [fold, limit,
// weight, put back], and how far the ankle is from the hip (of the leg's reach).
export function legTrace(label, r, who, sd, t0, t1, gap = 170) {
  const FV = FVX(), CT = FV.anim.CONTACT, T = [...C.TECHNIQUES, ...C.ATTEMPTS].find((t) => t.label === label);
  const realR = Math.random;
  let seed = 12345 + r;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), k = 'kn' + sd, i = sd === 'L' ? 2 : 3;
  try {
    T.from(); C.run(1000); align(r * gap - 1000); C.run(2500); T.go();
    let prev = null;
    const out = [];
    for (let t = 0; t <= t1; t += 15) {
      CT.dbg = []; C.run(15);
      let rec = null, fx = null;
      for (const d of CT.dbg) if (d && d.who === who) { if (d.fix && d.i === i) fx = d; else if (!d.fix) rec = d; }
      CT.dbg = null;
      if (t >= t0 && rec && prev && rec.shown && prev.shown) {
        const a = FV.cam()[who].acts.find((x) => x.trans);
        // (the push split: the whole man moved, T, and the knee's own on top of that)
        const own = (R) => [0, 1, 2].map((j) => R.shown[k][j] - R.raw[k][j] - R.T[j]), o1 = own(rec), o0 = own(prev);
        out.push(t + ' ' + (a ? a.C.id + '@' + Math.round(a.lt) : '-') + ' raw ' + (dd(rec.raw[k], prev.raw[k]) / 0.015).toFixed(1) + ' shown ' + (dd(rec.shown[k], prev.shown[k]) / 0.015).toFixed(1) +
          ' push ' + (dd(rec.shown[k], rec.raw[k]) * 100).toFixed(1) + ' body ' + (Math.hypot(...rec.T) * 100).toFixed(1) + ' (' + (dd(rec.T, prev.T) / 0.015).toFixed(1) + ' m/s) own ' + (Math.hypot(...o1) * 100).toFixed(1) + ' (' + (dd(o1, o0) / 0.015).toFixed(1) + ' m/s)' +
          (fx ? ' anat ' + fx.anat + ' hip ' + fx.hip + ' reach ' + fx.reach.toFixed(2) + ' | pushed>shown ' + (dd(rec.plan[k], prev.shown[k]) * 100).toFixed(1) + ' lengths ' + (dd(fx.m1, fx.m0) * 100).toFixed(1) + ' bend ' + (dd(fx.m2, fx.m1) * 100).toFixed(1) + ' hipLim ' + (dd(fx.m3, fx.m2) * 100).toFixed(1) : ''));
      }
      if (rec) prev = rec;
    }
    return out;
  } finally { CT.dbg = null; Math.random = realR; }
}
// One run of popsMany() (`r`, the same start) frame by frame with CONTACT's own record on (CONTACT.dbg): for
// every knee, ankle or toe that moves more than `over` m in a frame, how far it moved as keyed (raw), after the
// push and its rate limit (plan: knees and ankles), and as shown; for a toe, as the shin carries it (follow)
// and after it's put back in line with the knee (inLine). Where a jump starts.
export function traceJump(label, r = 0, gap = 170, over = 0.1) {
  const FV = FVX(), CT = FV.anim.CONTACT, T = [...C.TECHNIQUES, ...C.ATTEMPTS].find((t) => t.label === label);
  const realR = Math.random;
  let seed = 12345 + r;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dd = (p, q) => (p && q ? Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) : 0), f = (x) => (x * 100).toFixed(1);
  try {
    T.from(); C.run(1000); align(r * gap - 1000); C.run(2500); T.go();
    let prev = null;
    const out = [];
    for (let t = 0; t < T.ms; t += 15) {
      CT.dbg = []; C.run(15);
      const rec = {}, fx = {};
      for (const d of CT.dbg) if (d && d.fix) fx[d.who + d.i] = d; else if (d && d.who) rec[d.who] = d;
      rec.fx = fx;
      if (prev) for (const who of ['a', 'b']) {
        const A = rec[who], B = prev[who];
        if (!A || !B || !A.shown || !B.shown) continue;
        for (const k of ['knL', 'knR', 'anL', 'anR', 'toL', 'toR']) {
          const s = dd(A.shown[k], B.shown[k]);
          if (s < over) continue;
          let row = t + ' ' + who + '.' + k + ' shown ' + f(s) + ' raw ' + f(dd(A.raw[k], B.raw[k]));
          if (A.plan[k]) row += ' plan ' + f(dd(A.plan[k], B.plan[k]));
          const sd = k.slice(-1), toe = 'toe' + sd;
          if (k.startsWith('to') && A[toe] && B[toe]) row += ' follow ' + f(dd(A[toe].follow, B[toe].follow)) + ' inLine ' + f(dd(A[toe].inLine, B[toe].inLine)) + ' wF ' + B[toe].wF.toFixed(2) + '>' + A[toe].wF.toFixed(2);
          row += ' | kn ' + f(dd(A.shown['kn' + sd], B.shown['kn' + sd])) + ' an ' + f(dd(A.shown['an' + sd], B.shown['an' + sd]));
          // (the leg's last pass: the knee as pushed (m0) against last frame's shown, then what each step did to
          // it: the bones' lengths (m1), the bend put back from hip to ankle (m2), the hip's limit (m3))
          const F = rec.fx[who + (sd === 'L' ? 2 : 3)];
          if (k.startsWith('kn') && F) row += ' || pushed ' + f(dd(F.m0, B.shown[k])) + ' lengths ' + f(dd(F.m1, F.m0)) + ' bend ' + f(dd(F.m2, F.m1)) + ' hipLim ' + f(dd(F.m3, F.m2)) + ' reach ' + F.reach0.toFixed(2) + '>' + F.reach.toFixed(2) + ' wlen ' + f(F.wlen) + ' anat ' + F.anat + ' hip ' + F.hip;
          out.push(row);
        }
      }
      prev = rec;
    }
    return out;
  } finally { CT.dbg = null; Math.random = realR; }
}
// (the picture's own clock moved on to `phase` ms into the positions' working (each loop 3 s or 1.8 s, so
// 9 s for all of them): skipped forward, as a moment passing unseen, never back. Set back, or on a long way,
// every spring in the figures blew up)
export function align(phase) {
  const cam = FVX().cam(), vn = C.now() - (cam.warp || 0);
  cam.warp = (cam.warp || 0) - ((((phase - vn) % 9000) + 9000) % 9000);
}
export function worstMany(list = null, reps = 4, gap = 170, fresh = true) {
  result = null; error = null;
  setTimeout(() => {
    const realR = Math.random;
    let seed = 1;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    try {
      const out = [];
      for (const T of list || [...C.TECHNIQUES, ...C.ATTEMPTS]) {
        let sum = 0, n = 0, w = 0, deep = 0;
        const bins = {};
        for (let r = 0; r < reps; r++) {
          seed = 12345 + r;
          // (from the same moment of the positions' working each time: measured from wherever the clock had
          // got to, the same move read 0.3 cm a frame either way from one run to the next)
          T.from(); C.run(1000); if (fresh) align(0); C.run(1500 + r * gap); T.go();
          const seen = {};
          for (let t = 0; t < T.ms; t += 30) {
            C.run(30); const v = visible(); sum += v.worst; n++; w = Math.max(w, v.worst);
            if (v.worst > 0.04) deep++;
            if (v.worst > 0.06) { const b = Math.floor(t / 60) * 60, B = bins[b] = bins[b] || { runs: 0, d: 0, where: {} }; if (!seen[b]) { seen[b] = 1; B.runs++; } B.d = Math.max(B.d, v.worst); B.where[v.where] = (B.where[v.where] || 0) + 1; }
          }
        }
        const top = (o) => Object.entries(o).sort((x, y) => y[1] - x[1])[0][0];
        const m = Object.entries(bins).filter(([, B]) => B.runs > 1).map(([b, B]) => b + ' x' + B.runs + ' ' + (B.d * 100).toFixed(0) + ' ' + top(B.where));
        out.push([T.label, +(sum / n * 100).toFixed(2), +(w * 100).toFixed(1), Math.round(deep / n * 100), m.join('; ')]);
      }
      result = out.sort((x, y) => y[1] - x[1]);
    } catch (e) { error = e.stack; }
    Math.random = realR;
  }, 10);
  return 'started';
}
// each man's worst overlap with the other given both men's points (T: in his trunk, otherwise counting his
// limbs at half, as camtest's overlap())
export function ovl(Pa, Pb) {
  const cam = FVX().cam(), BODY = FVX().anim.BODY, id = (p) => p, out = {};
  for (const [k, me, P, opp, Q] of [['a', cam.a, Pa, cam.b, Pb], ['b', cam.b, Pb, cam.a, Pa]]) {
    const S = BODY.shapes({ v2: { pts: Q, fr: opp.v2.fr, body: opp.v2.body } }, id, id), s = me.v2.body.s;
    const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    let worst = 0, where = '';
    const test = (p, r, name, lim) => { const v = BODY.pen(S, p, r, [0, 1, 0], lim), d = v ? Math.hypot(v[0], v[1], v[2]) : 0; if (d > worst) { worst = d; where = name + (lim ? '' : ' T'); } };
    for (const [a, b, r] of [['shL', 'elL', 0.05], ['elL', 'fiL', 0.04], ['shR', 'elR', 0.05], ['elR', 'fiR', 0.04], ['hpL', 'knL', 0.07], ['knL', 'anL', 0.05], ['hpR', 'knR', 0.07], ['knR', 'anR', 0.05]])
      for (let i = 0; i <= 9; i++) test(mix(P[a], P[b], i / 9), r * s, a + '-' + b + '@' + i, true);
    for (const j of ['P', 'W', 'Ch']) test(P[j], 0.1 * s, j, true);
    test(P.Hd, 0.1 * s, 'Hd', true);
    out[k] = k + ' ' + worst.toFixed(3) + ' ' + where;
  }
  return out;
}

// One man's limbs through a technique: each elbow's and knee's angle (degrees: 180 straight), how far it's up
// from his shoulder or above the mat, and how far out to his side from his shoulder or hip (cm), every `every` ms.
export function limbs(T, who, every = 75) {
  const cam = () => FVX().cam(), sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const L = (a) => Math.hypot(a[0], a[1], a[2]), ang = (a, b, c) => { const u = sub(a, b), v = sub(c, b); return Math.round(Math.acos(Math.max(-1, Math.min(1, dot(u, v) / L(u) / L(v)))) * 57.3); };
  T.from(); C.run(2500); T.go();
  const out = [];
  for (let t = 0; t < T.ms; t += every) {
    C.run(every);
    const g = cam()[who].v2, P = g.pts, Rp = g.fr.Rp, Rc = g.fr.Rc, row = [t];
    for (const k of ['L', 'R']) {
      const z = k === 'L' ? -1 : 1;
      row.push(k + ' elbow ' + ang(P['sh' + k], P['el' + k], P['fi' + k]) + ' up ' + Math.round((P['el' + k][1] - P['sh' + k][1]) * 100) + ' out ' + Math.round(dot(sub(P['el' + k], P['sh' + k]), Rc[2]) * 100 * z));
      row.push('knee ' + ang(P['hp' + k], P['kn' + k], P['an' + k]) + ' out ' + Math.round(dot(sub(P['kn' + k], P['hp' + k]), Rp[2]) * 100 * z) + ' high ' + Math.round(P['kn' + k][1] * 100));
    }
    out.push(row.join(' | '));
  }
  return out;
}

// Stick figures of one man (red) with the other (grey) through a technique, from round four sides, one row a
// moment (ms after go); the mat's line in each. Saved as review/<name>.png.
export async function sticks(name, T, who, times, views = [0, 1.57, 3.14, 4.71]) {
  const cam = () => FVX().cam();
  T.from(); C.run(2500); T.go();
  const W = 260, H = 220, cv = document.createElement('canvas');
  cv.width = W * views.length + 50; cv.height = H * times.length;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  const BONES = [['P', 'W'], ['W', 'Ch'], ['Ch', 'N'], ['N', 'Nt'], ['Nt', 'Hd'], ['N', 'shL'], ['N', 'shR'], ['shL', 'elL'], ['elL', 'fiL'], ['shR', 'elR'], ['elR', 'fiR'],
    ['P', 'hpL'], ['P', 'hpR'], ['hpL', 'knL'], ['knL', 'anL'], ['anL', 'toL'], ['hpR', 'knR'], ['knR', 'anR'], ['anR', 'toR']];
  let at = 0;
  for (let r = 0; r < times.length; r++) {
    C.run(times[r] - at); at = times[r];
    const me = cam()[who].v2.pts, op = cam()[who === 'a' ? 'b' : 'a'].v2.pts, c = me.P;
    for (let v = 0; v < views.length; v++) {
      const th = views[v], ox = 50 + v * W + W / 2, oy = r * H + H * 0.78, k = 150;
      const pr = (p) => { const x = p[0] - c[0], z = p[2] - c[2]; return [ox + k * (Math.cos(th) * x + Math.sin(th) * z), oy - k * p[1]]; };
      g.strokeStyle = '#ccc'; g.lineWidth = 1; g.beginPath(); g.moveTo(50 + v * W, oy); g.lineTo(50 + (v + 1) * W, oy); g.stroke();
      for (const [P, col, w] of [[op, '#9ab', 5], [me, '#c22', 4]]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
        for (const [a, b] of BONES) { if (!P[a] || !P[b]) continue; const A = pr(P[a]), B = pr(P[b]); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
        const h = pr(P.Hd); g.beginPath(); g.arc(h[0], h[1], 14, 0, 7); g.stroke();
      }
      // (his left elbow and knee marked)
      g.fillStyle = '#05a';
      for (const j of ['elL', 'knL']) { const q = pr(me[j]); g.fillRect(q[0] - 3, q[1] - 3, 6, 6); }
    }
    g.fillStyle = '#000'; g.font = 'bold 13px sans-serif'; g.fillText(times[r], 4, r * H + 16);
  }
  return C.save(cv, name);
}
