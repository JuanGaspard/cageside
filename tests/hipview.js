// The head on the hip against the cage, posed and photographed from a few angles (review/<name>.png), with how
// far the two bodies are into each other:   import * as V from './tests/hipview.js'; await V.shots('hip1')
import * as C from './camtest.js';
const FVX = () => MMA.fightview;
// (`type`: the clinch state to pose — 'hip', or 'press', pressed flat into the fence)
export async function shots(name = 'hip', orbits = [0.4, 1.4, 2.4, 3.6], tw = 420, crop = [0.2, 0.12, 0.6, 0.8], lead = null, type = 'hip') {
  await C.setup(1, true, true);
  const f = C.fight(), A = f.A, B = f.B;
  if (lead != null) A.lead = lead;   // (which side his head goes to follows his stance)
  // B with his back on the fence, A in on his hips
  const r = 3.2, ang = Math.atan2(B.y, B.x) || 0;
  f.place(B, Math.cos(ang) * r, Math.sin(ang) * r); f.place(A, B.x - Math.cos(ang) * 0.25, B.y - Math.sin(ang) * 0.25);
  f.toClinch(A); f.clinchType = type;
  for (let i = 0; i < 6; i++) f.driveToFence(A, 0.2);
  const T3 = FVX().three(), cv = document.querySelector('#fvcanvas');
  T3.near = 2.6; C.run(3000);
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2]));
  const out = document.createElement('canvas');
  out.width = tw * orbits.length; out.height = th;
  const o = out.getContext('2d');
  const ov = C.overlap();
  orbits.forEach((orb, k) => {
    T3.orbit = orb; C.run(30);
    o.drawImage(C.grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], k * tw, 0, tw, th);
  });
  o.fillStyle = '#ff0'; o.font = 'bold 13px sans-serif';
  o.fillText('overlap a ' + (ov.a ? ov.a.worst + ' ' + ov.a.where : '') + ' / b ' + (ov.b ? ov.b.worst + ' ' + ov.b.where : ''), 6, 16);
  T3.orbit = null; T3.near = null;
  const cam = FVX().cam();
  return { status: await C.save(out, name), bases: cam.a.v2.base + '/' + cam.b.v2.base, ov };
}
// The way in, filmed: a real shot on a man pinned on the fence, stuffed into the head on the hip (the engine's
// own attemptTakedown, tried until it goes there), then `then` — 'finish' (the takedown off it), or nothing.
export async function entry(name = 'hipIn', frames = 12, every = 140, then = null, orbit = 1.2) {
  await C.setup(1, true, true);
  const f = C.fight(), A = f.A, B = f.B, E = MMA.engine;
  const r = 3.2, ang = Math.atan2(B.y, B.x) || 0;
  const T3 = FVX().three(); T3.near = 2.8; T3.orbit = orbit;
  let tries = 0;
  for (; tries < 60; tries++) {
    f.toStand();
    // (the engine's spots are in cage radii: B pushed out to the fence, A a step in front of him)
    f.place(B, Math.cos(ang) * r, Math.sin(ang) * r); f.place(A, B.x - Math.cos(ang) * 0.3, B.y - Math.sin(ang) * 0.3); f.updateCage();
    C.run(900);
    f.motion = []; f.events = [];
    const w = A.a.wrestling; A.a.wrestling = 0.05;
    f.attemptTakedown(A, false);
    A.a.wrestling = w;
    if (f.pos === 'clinch' && f.clinchType === 'hip') break;
  }
  FVX().camMotion(f.motion);
  const shots = [];
  const cv = document.querySelector('#fvcanvas'), crop = [0.15, 0.1, 0.7, 0.85], tw = 300;
  const th = Math.round(tw * (cv.height * crop[3]) / (cv.width * crop[2]));
  const cols = 6, out = document.createElement('canvas');
  out.width = tw * cols; out.height = th * Math.ceil(frames / cols);
  const o = out.getContext('2d');
  const cam = FVX().cam();
  for (let i = 0; i < frames; i++) {
    if (then === 'finish' && i === Math.floor(frames / 2)) {
      f.motion = []; A.a.wrestling = 1; B.a.tdd = 0;
      f.attemptTakedown(A, false);
      FVX().camMotion(f.motion);
      shots.push('then: ' + f.pos + ' ' + (f.gpos || '') + ' ' + (f.clinchType || ''));
    }
    C.run(every);
    o.drawImage(C.grab(), cv.width * crop[0], cv.height * crop[1], cv.width * crop[2], cv.height * crop[3], (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    o.fillStyle = '#ff0'; o.font = '12px sans-serif'; o.fillText(i + ' ' + cam.a.v2.base + '/' + cam.b.v2.base, (i % cols) * tw + 4, Math.floor(i / cols) * th + 14);
  }
  T3.orbit = null; T3.near = null;
  return { tries, status: await C.save(out, name), shots };
}
