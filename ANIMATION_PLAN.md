# Cageside fight animation: the plan

Goal: fight animation as smooth and readable as Nekki's Shadow Fight 2 and Vector, using only free tools.

**Status, 2026-11-18.** The 3D octagon shipped and is the fight view now, not an option — section 10 was
approved and built, and `?flat` is the only way back to the old side-on cam. Moves are hand-keyed from
timing references. Progress is logged at the end of this file, newest last.

The original goal said "without changing how fights are decided". That is no longer true, and has not been
for a while: asked to make the fights themselves read like real ones, the work went into the engine as well
as the picture. What has changed there, and why, is in the log — the share of strikes that are kicks, how
far apart they are thrown from, how lopsided fights are allowed to get, what a round on the stool gives
back, how often a man's back is taken, and what ground and pound is worth from each position. Those change
results, not just how they look.

---

## 1. What makes Shadow Fight and Vector look the way they do

Both games come from Nekki, and both were animated with Nekki's in-house physics-assisted keyframe tool,
**Cascadeur** (the Vector store listing credits it for the parkour moves; a 2014 press release credits it
for Shadow Fight 2's stunts). Nekki's own team has also said that in those games "most of the animation
process was done by hand" in 2D. So the smoothness comes from **hand-authored keyframes, checked against
physics**, not from procedural motion. In practice that means:

("What we do today" is Cageside as it stood on 2026-10-29, when this was written. Most of the right-hand
column has since been built; the log at the end of the file is the record of it.)

| Quality | What it looks like | What we do today | What we'll do |
|---|---|---|---|
| Authored keyframes | every move posed by hand, strong silhouettes, clear line of action | poses computed from ~13 numbers and blended | a clip library, posed and timed by hand |
| Weight and balance | the body's mass over the feet; jumps follow a real arc | springs and a hip-height clamp | centre-of-mass and support checks, ballistic arcs |
| Anticipation, follow-through, overlap | a hip turn before the punch, a shoulder that keeps going, a trailing arm | a 6% "load" and a spring | per-joint timing offsets in every clip |
| Torso rotation | the shoulders and hips turn into a strike; near and far sides swap | none: the body is flat side-on | a twist channel that rotates the hips, chest and shoulders |
| Clean transitions | no pops between moves | linear cross-fades | inertialization (blends that decay the old motion out) |
| Two-person moves | throws and grappling look like one motion | separate figures, cross-faded | paired clips, both fighters keyed together |
| Silhouette | smooth anatomy, readable at small sizes | tapered capsules | a shaped, skinned body outline |

---

## 2. Tools: all free, all usable in a commercial game

| Tool | Licence | Used for | Who runs it |
|---|---|---|---|
| **Cageside Animation Studio** (new, built into the project) | ours | authoring and cleaning clips: timeline, onion skin, IK handles, curve editor, reference video overlay, physics checks, JSON export | Claude, and you if you want to tweak |
| **MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`, from a CDN) | Apache-2.0 | turning reference video into joint positions (pose-estimation rotoscoping), in the browser, no install | Claude |
| **Python 3** (already installed) with NumPy/SciPy (pip) | BSD | offline processing: smoothing, keyframe reduction, retargeting, QA metrics, film strips | Claude |
| **CMU Motion Capture Database** (optional) | free for all uses; may go in commercial products, raw data not resold | timing reference for boxing and kicks (7 boxing clips, a few punch/kick clips) | Claude, after you approve the download |
| **Blender** (optional) | GPL for the program; what you make with it is yours | only if a move needs a full 3D rig to pose (spinning techniques, complex scrambles) | Claude, headless via Python, after you approve the install |
| The browser pane and film-strip tools from last time | — | reviewing every clip frame by frame and in motion | Claude |

**Cascadeur, considered and set aside:** the game is private, so the free licence's non-commercial rule
isn't a problem. The blocker is that the free edition can't export animation at all: FBX/DAE export is
Indie-only (paid), and the free edition saves only its own .casc files. It also needs a Nekki sign-in, and it's a
3D desktop app I could only drive through screenshots. So nothing made in it could reach the game. We
build its key ideas into the Studio instead: fulcrum (planted-point) locking, centre-of-mass balance, and
ballistic arcs for jumps and falls. If you ever buy a month of Indie, Phase 3 can import its FBX through
Blender.

**Also ruled out:** Mixamo (needs an Adobe account, can't ship raw files); Spine (paid).

**Reference footage rule:** pose extraction only from footage you own (you recording yourself or a friend)
or footage under an open licence. No extraction from UFC broadcasts or other copyrighted video.

---

## 3. The new rig: the "2.5D" fighter

The current figure has 13 pose numbers and no torso turn. The new one:

- **Joints (18):** pelvis, lower spine, chest, neck, head; both clavicles, upper arms, forearms, fists;
  both thighs, shins, feet, toes.
- **Depth per joint** (near / far side of the body), so the near arm and leg draw over the torso and the
  far ones under it, and they swap correctly as the fighter turns.
- **Twist channels** for the pelvis and chest (0 = square side-on, ±1 = turned three-quarters): they set the
  visible width of the hips and shoulders and which side is near. A cross turns the chest ~60°; that turn is
  most of what makes a punch look powerful.
- **Stance:** orthodox, southpaw and switch handled as a mirror of the near/far sides, not separate clips.
- **Proportions per fighter:** height, reach and build (light, average, heavy) scale bone lengths and body
  widths, so a long heavyweight and a compact flyweight look different, from the same clips.
- **Body shape:** a smooth outline per segment (bezier shapes with joint bulges: deltoids, chest, glutes,
  calves) unioned into one silhouette, then the corner-colour rim light, gloves and shorts we have now.

---

## 4. Clip format and runtime

**Clip (JSON, embedded in the game):**
```
{ id: "jab_a", fps: 60, length: 21, loop: false,
  tracks: { pelvis: [...], chest: [...], ... },      // key frames: angle, twist, depth; bezier tangents per key
  root: [...],                                         // root motion (how far the body travels)
  contacts: { lfoot: [[0,21]], rfoot: [[0,8],[14,21]] },  // when each foot is planted
  events: { impact: 9, recoverable: 15 },               // the impact frame; when the next move may start
  tags: ["punch","lead","head"], variantOf: "jab" }
```

**Runtime, in order each frame:**
1. **Clip player:** samples the current clip(s) at 60 Hz, interpolated for 120/144 Hz screens.
2. **Time-warp:** each strike is stretched or squeezed so its `impact` frame lands exactly when the engine
   says the blow lands; the wind-up keeps its shape, the recovery absorbs the difference.
3. **Layers:** footwork on the legs (shuffle in, shuffle out, pivot, circle, stance switch, cycle-based),
   strikes and guards on the upper body, hit reactions additive on top, the spring layer last for small jolts.
4. **Inertialization** for every transition: the new clip starts at once and the leftover motion of the
   old one decays out over 100–200 ms, so no two poses are ever half-mixed.
5. **IK post-pass:** feet locked during their `contacts` (no sliding); a strike's last few centimetres
   corrected onto the real target; the head looks at the opponent.
6. **Physics:** a 2D ragdoll (Verlet points with angle limits) for knockouts, knockdowns and stumbles, blended
   back into a get-up clip chosen by how the fighter landed (face up or face down).
7. **Paired clips** for anything two-person: both fighters' tracks in one clip, aligned by a shared root, so
   a takedown or a clinch entry is one motion, not two figures cross-fading.
8. **Variants:** 2–4 versions of every common move, chosen by stance, style and power, never the same one
   twice in a row.

---

## 5. Getting the motion right: the reference pipeline

1. **Shot list for you to record (optional but the biggest single quality lever):** phone on its side,
   60 fps, side-on, full body in frame, plain background, fitted clothes. About 40 short clips: stance and
   bounce, step in, step out, pivot, jab, cross, both hooks, both uppercuts, overhand, body hook, teep, low,
   body and high kick off each leg, knee, elbow, blocks, slips, rolls, a kick check, a sprawl, a shot (level
   change), and falls onto a mat. I'll send the exact list if you want to do it.
2. **Extraction:** MediaPipe in the browser gives 33 points per frame; I smooth them (One-Euro filter),
   retarget them to the Cageside skeleton, and reduce them to key frames (curve fitting within a tolerance).
3. **Cleaning in the Studio:** fix the feet with locking, exaggerate the anticipation and follow-through
   (rotoscoped motion always looks floaty until it's pushed), check balance, set the impact and contact events.
4. **Without footage:** the same Studio, keyed by hand from frame-counted timing references (below) and,
   where it has the move, CMU's capture data for timing.

**Timing targets (real time, at 1x):**

| Move | Wind-up | To impact | Recovery |
|---|---|---|---|
| Jab | 0–2 frames | 7–9 frames (≈130 ms) | 8–10 frames |
| Cross | 2–3 frames | 10–12 frames | 10–12 frames |
| Hook | 3–4 frames | 11–13 frames | 12 frames |
| Low kick | 4–6 frames | 16–20 frames (≈300 ms) | 16 frames |
| Head kick | 6–8 frames | 22–28 frames (≈420 ms) | 20 frames |
| Double-leg shot | 4 frames | 20–24 frames to the hips | paired finish 30–40 frames |

---

## 6. Phases: what gets done, and when it counts as done

Each phase ends with a film strip and a short clip in the browser for you to judge. Fight outcomes are
checked with the harness after every phase: they must not move.

**Phase 0: baseline (½ session)**
- Record the current fight cam: film strips of 20 standard situations, and the QA metrics below.
- Build the reference board (timing table, silhouette targets).
- *Done when:* we have before-numbers to beat.

**Phase 1: the new figure (1 session)**
- 18-joint 2.5D skeleton, twist channels, per-fighter proportions, the new body outline.
- A pose gallery: guard, jab extended, cross extended with chest turned, kick chamber, kick extended, sprawl,
  mount, flat on back, in three builds.
- *Checkpoint 1:* you approve the look before any animation is made with it.

**Phase 2: the clip system and the Studio (1–2 sessions)**
- Clip format, player, time-warp, layers, inertialization, foot locking, strike aim correction.
- Studio v1: timeline, key frames, onion skin, curve editor, drag-the-hand/foot IK, foot pins,
  centre-of-mass display, play at 0.1x–1x, export.
- *Done when:* a hand-keyed jab plays in the fight cam, lands on the frame the engine says, and the feet
  never slide.

**Phase 3: the reference pipeline (1 session)**
- MediaPipe in the Studio: load a video, extract, smooth, retarget, reduce, clean.
- *Done when:* a recorded jab comes out as a clean clip in under a minute of cleaning (if footage exists).

**Phase 4: the striking library (2–3 sessions)**
- Stance cycles (orthodox, southpaw, tired, hurt), footwork cycles, every strike in the engine with 2–4
  variants, defences (block high/low, slip, roll, parry, lean back, kick check), reactions (head snap
  light/heavy, body fold, leg buckle, rocked stagger, knockdown).
- *Checkpoint 2:* a demo reel of 10 core moves at full speed and at 0.25x.

**Phase 5: clinch and grappling (2–3 sessions)**
- Paired clips: clinch entry and break, knees and dirty boxing, cage pin; double-leg, single-leg, body-lock
  trip, sprawl, failed shot; guard, half guard, side control, mount, back mount and the moves between them;
  sweeps, stand-ups, ground strikes; submissions (rear-naked choke, guillotine, armbar, triangle, kimura,
  arm-triangle) and the tap.

**Phase 6: physics (1 session)**
- Ragdoll knockouts and knockdowns, stumbles into the fence, get-ups; balance correction for authored clips.

**Phase 7: integration (1 session)**
- Engine events mapped to clips and variants, pacing at every speed (1x to 32x), camera framing and
  look-ahead, hit-stop and slow motion re-tuned to the new motion.
- *Checkpoint 3:* full fights at 1x, 4x and 16x.

**Phase 8: polish and QA (1 session, then as needed)**
- Clear every metric below, performance budget, reduced-motion mode, phone layout.

---

## 7. How quality is measured

Automated, on every clip and on 200 simulated fights:

| Metric | Target |
|---|---|
| Foot slide while planted | < 1 cm per contact |
| Pops (a joint jumping more than it could move in one frame) | 0 |
| Jerk spikes (sudden acceleration changes outside impacts) | 0 above threshold |
| Limb through torso or opponent (outside clinch and grappling contact) | 0 frames |
| Impact frame vs. engine's impact time | within 1 frame |
| Centre of mass outside the feet without a step or fall | 0 frames |
| Same variant twice in a row | never |
| Frame cost (fight cam, 2 figures) | < 2 ms on a mid laptop; 60 fps |

By eye: film strips and onion skins at 0.25x for every clip, side by side with the reference, and a
before/after for each phase.

---

## 8. What I need from you

1. **Approval of this plan.**
2. **Reference video:** will you record the shot list (best result), or should I hand-key from timing
   references (good, slower to reach the same quality)?
3. **Optional downloads:** MediaPipe's library and pose model from a CDN (~10 MB, loaded only in the Studio,
   never in the game); CMU capture files for timing (~a few MB); Blender (~300 MB, only if needed).

## 9. Honest limits

- I review motion through frame strips and metrics, not by watching at full speed the way you do, so your
  eye at the checkpoints matters.
- Rotoscoped motion needs exaggeration to read as powerful; that is hand work, and it is most of Phase 4.
- Grappling is the hardest part and will take the longest to get right.
- This is several sessions of work; each phase leaves the game in a working state.

## 10. The 3D revision (2026-10-31)

**Why.** Footwork. The engine already moves both fighters around the octagon floor every moment: where
each stands (seen from above), pressure and giving ground, circling off the fence, being pinned on it,
pivots that take an angle, which way each faces, how far off square he's been left, whether his feet are
set, backing up in a straight line. The side-on camera throws most of that away: it always sits square to
the line between them, so circling, angles and pivots collapse onto that line and only the small map in the
corner shows them.

**What's already 3D.** The figure (a 3D skeleton, drawn side-on), the clips and the player (3D poses, 3D
aim), and the tracer (MediaPipe gives depth). What's flat is the drawing and the feet, which are planted
on a line instead of a floor.

**1. The picture: a real 3D octagon.**
- three.js (MIT, WebGL), loaded from jsDelivr only when the fight view opens. The side view stays as the
  fallback (no WebGL, or no network), so the game still always works.
- The arena: the canvas with its logo, the eight fence panels and posts with their padding, the overhead
  lights, soft shadows on the canvas.
- The fighters: the same skeleton driving meshes (tapered limbs, the trunk lofted through its cross-sections,
  head and jaw), dark with the corner-colour rim light and kit, the look approved at Checkpoint 1, now with
  real light and shadow (as Shadow Fight did when it went 3D).
- The camera: broadcast-style, raised three-quarter view that follows the pair, keeps both in frame and
  swings round slowly when they circle so it stays roughly side-on to the action; closer on the mat; never
  through the fence.

**2. Footwork in the picture.**
- Each fighter's place and facing on the floor come from the engine and glide between moments (the engine
  moves them once a moment; the picture spreads that over the moment as steps).
- Feet planted on the floor, not a line: they step in any direction (in, out, sideways, pivots on the ball of
  the foot) when the body moves off them; stance width and angle per fighter; switch-hitters switch.
- Footwork clips: step-drag in and out, lateral shuffle, circling left and right, pivot, cutting off the cage,
  bounce; chosen from how the engine moved each man in the moment, played with real root motion.
- Turning: each man turns to face where the engine says; a pivot that leaves the other off square shows as
  him turning to catch up.

**3. The simulation.** The engine's footwork already works on the floor plane (height isn't a footwork
dimension), so it doesn't need rebuilding to be "3D". Two options:
- **View only:** show exactly what the engine does today; fight results don't change.
- **View and engine:** also add the footwork details a 3D view makes visible: the lead-foot battle in
  orthodox-against-southpaw (the outside foot gives the power hand its angle), circling into the other man's
  power hand being punished, switching stance. Checked with the harness after each change so results stay
  realistic (KO/TKO about 33%, submissions about 23%, decisions about 43%).

**4. Phases from here** (replacing 4 to 8; Phase 3, the tracer, finishes alongside and its depth now counts):
- **3D-A: the arena and the figures in 3D**, the camera, the fallback. *Checkpoint: the look of a fight in 3D.*
- **3D-B: footwork**: feet on the floor, footwork clips, turning, root motion; the measuring tools extended
  to foot slide on the floor and to the 3D through-the-body check the flat picture couldn't do.
- **3D-C (if chosen): the engine's footwork additions**, with the results check.
- Then as before, in 3D: the striking library (old 4), clinch and ground (5), physics (6), integration and
  polish (7, 8). The studio gets a 3D view.

**Costs.** three.js is about 0.7 MB fetched when the fight view first opens (cached after); the game stops
being completely self-contained (the fallback covers that); the arena and camera are new work.

## Progress log

**2026-10-29, Phase 0 (baseline), done.** Backup: `cageside-2026-10-29-before-anim.html`. Tools:
`tests/camtest.js` (`record`, `qa`, `reel`, `save`), `tools/devserver.py` (the preview server; it saves
PNGs and clips into `review/` and `anim/`). Film strips: `review/baseline-strikes.png`, `review/baseline-kicks.png`.

Measured over 280 s of picture at 2x (4 bouts plus one started on the mat: 72% standing, 13% clinch, 14% ground):

| Metric | Baseline |
|---|---|
| Foot slide while planted | mean 0.13 cm per contact; 20 of 972 contacts over 1 cm; worst 26.9 cm |
| Pops (a joint jumping further in a frame than a body can) | 1,568 (336 a minute): rear knee 455, elbows 814; the two-bone solver flipping the joint |
| Jerk spikes (body joints, away from impacts) | 574 (123 a minute) |
| Bones stretched over 5% | 109 frames, worst 84%: cross-fades between poses |
| Fist, foot or knee inside the other's trunk | 26 frames |
| Off balance with both feet down | 0 |
| Frame cost | 0.2 ms median, 0.3 ms at the 95th percentile |

By eye: thin outlined stick bodies, no hip or shoulder turn (the cross looks like the jab), the rear leg
flung back into long lunges, the same outline drawn around every limb.

**2026-10-29, Phase 1 (the new figure), built; waiting on Checkpoint 1.** `FIG` in the fight cam section
of `cageside.html` (exported as `MMA.fightview.figure`): a 3D skeleton seen side-on. Joints: pelvis, waist,
chest, neck, head and jaw; shoulders, elbows, wrists, fists; hips, knees, ankles, heels, toes. Pose
channels: pelvis and spine yaw/pitch/roll, neck, fist targets from the chest, elbow and knee pole
directions, ankle targets, foot yaw/pitch, shoulder blades. The two-bone solver bends towards a pole
direction, so knees and elbows can't flip (the cause of the baseline's pops). Body from height, reach and
weight (`body()`); southpaw = mirror. Drawing: the trunk lofted through 8 cross-sections, each limb one
shape with the big muscles laid on, near/far shading, the corner-colour outline around the whole figure,
a thin dark edge between overlapping parts, shorts with a straight hem. Two fighters draw together sorted
by depth, so arms can wrap around the other man in the clinch. Cost: about 0.1 ms for both.
Poses so far: guard, jab, cross, chamber, headKick, shot, sprawl, sprawled, mount, flat.
Review images: `review/figure-v2-faceoff.png`, `review/figure-v2-gallery.png`, `review/figure-v2-ground.png`.
Not yet in the live fight cam: that's Phase 2 (the clip player drives this figure). The sprawl pair
doesn't read yet; two-person moves get authored together in Phase 5. **Checkpoint 1: approved 2026-10-29.**

**2026-10-29, Phase 2 (the clip system and the Studio), done.**
- `ANIM` in `cageside.html` (exported as `MMA.fightview.anim`): a pose is 42 numbers (channels); clips
  are key poses with auto/flat/step tangents, sampled cubically. Each fighter has a base (stance, hurt,
  clinch, rest, win, down, or a position on the mat) with clips laid over it as the difference from
  their reference pose. Changes of base carry the gap on a critically damped spring (inertialization); hits
  land as kicks to the same spring. Feet are planted at the ball of the foot (pivots turn about it), step
  when the body has moved off them, and glide off the floor when a clip lifts them; the hips are kept
  within the legs' reach. Strikes are bent onto the real target (the limb over the end of the wind-up,
  the body carried over the whole strike), frozen at impact, each strike in a combination keeping its
  own. The man taking the back turns round as a pose (`'name~'`), anchors glide when the position
  changes, and strikes from out of range bring the fighters together.
- Clips: `anim/clips/*.json`, put into the game by `tools/embed_clips.py` (the dev server runs it on
  every save). Hand-keyed: jab, cross. Rough: kick (every kick height), knee, shoot, gnpPunch,
  sprawlReact. Every other move borrows the nearest (hooks, uppercuts and the rest: jab or cross).
- In the fight cam behind `cageside.html?fig2` (`FV.fig2`); without it the game is unchanged.
- Studio: `studio.html` (through the dev server): timeline with keys and foot contacts, onion skin,
  drag handles for fists, feet and hips, channel inspector, curve view, balance marker and support,
  0.1x to 1x playback, per-clip checks (planted-foot drift, fastest fist or foot), save.
- Done-when: strikes land on the scheduled frame (jab 0 ms late, cross 5, kicks 5 to 10: within a frame),
  fists 1 to 3 cm from the target point, planted feet 0.1 cm average drift.
- The pop test was corrected (a joint jumping alone in its frame, not just moving fast: a real fist goes
  from 1.6 to 4.6 m/s in a frame) and both versions re-measured with it, same four samples (220 s):

| Metric | Old fight cam | New figure |
|---|---|---|
| Pops | 622 | 51 (mostly fists and elbows in combinations) |
| Jerk spikes | 391 | 98 |
| Planted-foot drift | mean 0.33 cm, 27 contacts over 1 cm, worst 62.6 cm | mean 0.10 cm, 7 over 1 cm, worst 2.6 cm |
| Bones stretched over 5% | 317 frames (worst 82%) | none (solved in 3D at length) |
| Frame cost | 0.2 / 0.3 ms | 0.3 / 0.8 ms (median / 95th) |

  (The standing samples were taken before the last two fixes, the elbow fallback and the jab's step
  back; a 20 s spot check after them: 1 pop.) "Through the body" isn't comparable: the flat picture
  can't tell a fist passing in front of the body from one going through it; it needs a 3D check.
- Next: Phase 3 needs reference footage and the MediaPipe download; Phase 4 (the striking library) can go
  ahead without either.

**2026-10-29, Phase 3 (the reference pipeline), in progress (stopped at the usage limit).**
- Downloaded (approved): MediaPipe tasks-vision 1.1.1 and the heavy pose model (`tools/mediapipe/`), and 18
  Pexels clips (`anim/footage/`, sources and licence in `SOURCES.md`, list in `index.json`).
- `tools/devserver.py` now serves byte ranges (video seeking needs them: without, every frame tracked was
  the first one) and saves tracks to `anim/tracks/`.
- `trace.html`: tracks a clip (two fighters, ~0.3 s a frame), settles who's who by continuity, smooths
  (One Euro, both ways), maps onto the game's skeleton (scale from the trunk; facing and stance from the
  feet, or the shoulders when the legs are out of shot; the hips placed from the planted foot, so camera
  moves don't leak in; legs left to the game when unseen), detects foot contacts, suggests the impact,
  reduces to keys and saves a clip with its own `refPose` (`ANIM.compile` takes it).
- Tracked so far: 5752364 (heavy bag). Its legs are mostly out of frame (knee/ankle visibility 0.01 to
  0.3), so it can only give upper-body strikes.
- Left: make and check a traced jab (5752364, around frames 80 to 110) and a kick from full-body footage
  (6005335 karate is the next to track), compare them with the hand-keyed clips in the fight cam, note
  which clips show the legs, then log Phase 3 done.

**2026-10-31, the 3D revision approved (view and engine). 3D-A built; waiting on its checkpoint.**
- `cageside.html?fig3` (`FV.fig3`, which brings the new figure with it): three.js 0.186.1 fetched from
  jsDelivr the first time the fight view needs it; if it can't load, the side view carries on.
- The octagon: the canvas with the promotion's name, eight chain-link panels with padded skirt and rail,
  padded posts with red caps, the apron, a crowd in the dark; a warm key light from high up throwing soft
  shadows, a cool fill. The panels between the camera and the fighters are cut away.
- The fighters: meshes driven every frame by the same skeleton: tapered limbs with round joints and the
  big muscles, the trunk lofted through the side view's cross-sections, head and jaw, kit in the corner's
  colours, a rim of the corner's colour on the outline (a shader term, so it shows from any angle).
- Placement: the engine's spots on the floor give the middle of the line between them and its direction,
  gliding over each moment; spacing from the same spring as the side view; each faces the other give or
  take the angle the engine says he's been left at (`s.face`).
- The player now works on the floor, not a line (`ANIM.frame` takes `ax, az, th`; `FIG.place3`): feet
  planted and stepping in any direction, the aim and the clinch hands in 3D. The side view is the same
  thing with the heading 0 or 180 degrees.
- The camera: broadcast three-quarter view, side-on to the line between them and always on the same side
  (red on the left, never crossing the line), swinging round as they circle, closer on the mat.
- Measured in 3D (45 s standing): planted feet 0.04 cm average over 304 contacts, worst 0.5 cm, on the
  floor in both directions; 3 pops, 3 jerk spikes. Frame cost can't be judged here: this machine's
  browser pane draws WebGL in software (Microsoft Basic Render Driver), 8.7 ms a frame there.
- Pictures: `review/fig3-live-2.png` (a stretch of a real fight, takedown included), `review/fig3-cross.png`,
  `review/fig3-kick.png`.
- Next, 3D-B: footwork clips (step-drag, shuffle, circling, pivots) chosen from how the engine moved each
  man, real root motion, turning; then 3D-C, the engine's footwork additions.

**2026-10-31, 3D-A approved for now** (a visual overhaul will come later). **Hit markers removed** in every
view (the bursts and the flash on a block): this is a simulation. The beat and the shake on heavy blows,
and the ring over a rocked man's head, stay for now.

**2026-10-31, 3D-B (footwork), first pass done.**
- Each man now stands on his own spot from the engine, pushed apart along the line between them to the
  picture's spacing (before, both were placed from the middle, so one circling moved the other too).
- `stepper3` (fight cam): gets him there in steps. Each step moves the body in a push with a dip as the
  weight lands; the foot furthest along the way he's going moves first and the other follows (step and
  drag: in, the lead foot; back, the rear; sideways, the foot on that side); a turn pivots on the lead
  foot while the rear foot swings round; small corrections without stepping; no new step mid-strike;
  between steps a light bounce on the toes. Step length and speed come from footwork, legs, tank, rocked.
- `ANIM.step()` lets the footwork order a step (which foot, when, how long, how high: footwork steps skim
  the canvas, 2 to 4 cm up); `ANIM.feetAt()`; `o.bob` for the dip and the bounce.
- Measured: open fighting (45 s) 0.04 cm average planted-foot slide over 243 contacts, worst 0.7 cm, 4 pops,
  1 jerk spike; clinch-heavy (40 s) 0.1 cm, 3 contacts over 1 cm (worst 7 cm), 6 pops (knees), 22 jerk
  spikes. Side views unchanged (0 and 5 pops in 20 s).
- Pictures: `review/fig3-footprints.png` (12 s of footprints from above), `review/fig3-footwork-broadcast.png`.
- Not yet: the footwork is procedural (step rules), not authored clips; no lean into the movement; no
  switch stance (3D-C); the through-the-body check in 3D; the clinch is rougher than open fighting.
- Next: 3D-C, the engine's footwork additions.

**2026-10-31, 3D-B polish** (asked for before 3D-C: the clinch, leaning into movement, authored footwork).
- Authored footwork clips: `stepIn`, `stepOut`, `shuffleL`, `shuffleR`, `pivot` (in `anim/clips/`). The
  stepper plays the one that fits the direction as a walk act; the trunk leans the way he's going, the hips
  dip as the weight lands, and a foot in the air heads for where the stance will be when the step is done.
- Kicks: the knee whipped round mid-kick (worst 59 cm in a frame). Causes and fixes:
  - a high kick's aim pushed the foot straight up, into the hip, while it was chambered: the aim now swings
    the leg onto the target about the hip, and close in it's the shin that lands (the leg stays long);
  - with the foot tucked against the hip, the bend direction alone can't place the knee: new channels
    `kneeAtL/R` (a place for the knee and how much it counts) put the knee where the clip says, and the shin
    is aimed from it at the foot. The kick is re-authored on them (knee up and pointed, shin swung out round
    the knee and through, back the same way), and so is the knee strike. The knee is placed only once its
    foot is off the floor (placed, a planted foot slid 30 cm in the clinch).
  - Result: no flips; the knee peaks at about 10 m/s and the foot at about 19 m/s, smooth curves.
- A bug from the first pass: a foot in the air was held back whenever its target moved over 3 cm in a
  frame, so in 3D the kicking foot trailed its clip by up to 46 cm and kicks fell short. Now only a change in
  the stance it's headed for is smoothed over; kicks land (leg, ribs, head; `review/fig3-polish-kicks.png`).
- A step under way when a strike lifts the foot keeps its height, fading, instead of dropping 7 cm.
- Safety nets: an elbow or knee can't swing round its limb faster than 25 rad/s (two poses summed in the
  clinch flipped elbows 50 cm in a frame); a strike's aim follows a shifting target over ~40 ms instead of
  snapping; in 3D the facing glides as well as the position when the fight goes to the ground or gets up
  (the takedown jumped the whole body up to 27 cm).
- Measured in 3D (30 s each, 2x): open fighting 1 pop (3.8 cm), planted-foot slide 0.09 cm average, worst
  0.9 cm; clinch-heavy (22 s of clinch) 7 pops, slide 0.16 cm average; clinch into a takedown and the ground
  13 pops, worst 6.4 cm (none at the takedown). Side view: 0, 3 and 6 pops in three bouts.
- Left: a cross thrown while coming up out of a sprawl, double crosses in the clinch and the arms riding the
  other man's step in the clinch still move an elbow 15 to 35 cm in a frame now and then; a ground-and-pound
  punch is very fast (ground work is a later phase).
- Note for testing: three.js loads in the background, so a recording started straight after a page load
  runs on the side view; the tests now wait for 3D.
- Pictures: `review/fig3-polish-kicks.png`, `review/fig3-polish-open.png`, `review/fig3-polish-clinch.png`,
  `review/fig3-headkick-big.png`.

**2026-10-31, 3D-C (the engine's footwork additions) done.** Before, stance only counted through a fixed
pre-fight modifier, every man kept his lead side all night, and the man giving ground circled whichever way
at random.
- Circling into the power hand: the man giving ground chooses his way round, away from the other's rear hand
  if he knows his business (fight IQ; a "circle" plan more so), and a presser with the better feet can cut
  that way off and walk him into it. The man coming forward takes his angles the same way. Each moment
  measures how far each went round, into the power hand or away from it (signed, with a dead zone so the
  shuffling every moment has doesn't count), and the other man's rear-side shots land more often and harder
  that moment, or less, accordingly. Winners walk into it about a fifth less often than losers.
- The lead-foot battle (open stance): each moment, footwork, evasion, ring sense, which way each just moved,
  and the southpaw's habit decide who has his lead foot outside. The winner's rear hand and rear kick get the
  line (and he takes a small step round to the outside, which the picture shows); the loser's rear hand is
  shut off. The pre-fight "Open stance" modifier is kept for the familiarity (lefties are the unusual look).
- Changing stance: switch hitters switch freely (about 6 times a fight: a new look, to take the outside
  foot back, to hide a hurt lead leg); anyone else only when the lead leg is going (lead-leg kicks then land on
  the healthy one), fighting the wrong way round at a cost until it's even again (about one fight in seven).
- Also fixed on the way: a pivot used to go the opposite way to the circling it was part of.
- Commentary for each (walking into the power hand, the outside foot, switching), and the corner says it
  between rounds ("You keep circling into his right hand. Go the other way...", "He's got his lead foot
  outside yours...").
- The picture: a change of stance has the feet swap roles where they stand and hop through into the new
  stance, the body turning across over about a quarter second (the difference at the change fades, so a step
  under way comes through as it is). The QA reads frames across a switch with the sides swapped.
- Results (about 11,000 fights a run, neighbouring ranked UFC fighters): before, KO/TKO 33.0%, submissions
  23.8%, decisions 43.2%; after, 33.3 to 34.0%, 22.7 to 23.6%, 43.2%. Knockdowns 0.34 a fight (0.32),
  significant-strike accuracy 48.5% (48.8%). Takedown attempts are about 4% lower (the man giving ground
  gets off the fence a little more now his pivots go his way). Southpaws win 55% of open-stance fights; the
  same pairings with the southpaw made orthodox put stance itself at about one point of that (the rest is who
  the ranked southpaws are). Switch hitters win about 54%.
- Harness: `stances()` and `stanceEdge()` in `tests/harness.js`.
- Pictures: `review/fig3-switch.png` (a switch, 40 ms a frame), `review/fig3c-open-stance-top.png`.

**2026-10-31, Phase 4 (the striking library, in 3D), first pass.** Before it, every punch but the jab and
the cross borrowed one of those two, every kick borrowed one roundhouse, and the man on the end of a blow only
twitched (a spring jolt) or put up a fixed shell.
- New clips (40 in all now): hook (2 versions), uppercut (2), overhand, hook to the body (and a straight to
  the body), elbow, a snap jab and a stepping cross; dedicated calf kick, leg kick and head kick (on the knee
  target channels), the body kick keeping the roundhouse.
- Variants: which version plays is chosen when the strike is scheduled (so its timing is that version's), and
  never the same one twice running for the same man (`ANIM.pick`).
- Defences, played by the man it's thrown at and timed so they happen as the blow arrives: covering up high
  or low, checking a leg kick (the engine now tells the picture when a leg kick was checked), slipping
  (either side), rolling under hooks, leaning back, parrying the jab, stepping back out.
- Reactions: the head snapped back (light, or heavy with the hands coming apart), sideways (the way the blow
  pushes it: which side follows from the hand or foot that threw it and the two stances; one clip, mirrored),
  up (uppercuts, knees); folding over a body shot; the lead leg buckling; a stagger when rocked (the engine's
  events now say who a thing happened to).
- Bent-arm punches land with part of the arm (`reach` in the aim) and the body closes the rest, so hooks and
  uppercuts keep their shape instead of straightening out at range.
- The solver: a hand (or foot) pulled in past the shoulder (or hip) is pushed back out along a steady
  direction, so the arm doesn't swing round the shoulder (two moves summed did that, 50 cm in a frame); the
  elbow and knee swing limit is down to 12 rad/s.
- Measured in 3D (25 s each, 2x, three bouts): 0, 1 and 3 pops, the worst 6 cm; planted-foot slide 0.09 to
  0.13 cm average. Results unchanged (KO/TKO 33.6%, submissions 23.5%, decisions 42.9%).
- Checkpoint 2 reel, ten core moves with the other man's answers: `review/p4-reel-1x.webm` (full speed) and
  `review/p4-reel-quarter.webm` (a quarter speed), made in the browser (`video()` in `tests/camtest.js`).
  Stills: `review/p4-punches-reel.png`, `review/p4-bent-arm.png`, `review/p4-kicks-reel.png`.
- Still to do in Phase 4: the spinning back fist (it borrows the cross), the knee variants, more variants of
  the rest (2 to 4 each), the tired and hurt stance cycles as clips, a fall for knockdowns (with Phase 6's
  physics), and the stagger reads too small at broadcast distance.

**2026-10-31, Checkpoint 2 approved; Phase 4, second pass.**
- Spinning back fist: the rear foot steps across behind, the body turns a whole circle (rear shoulder back
  first), the head whips round ahead of it to spot him, and the rear arm unfolds into the back of the fist as
  the chest faces the lead side; the lead foot pivots on its ball throughout. The turning channels (the yaws)
  are now compared the short way round, so ending a full turn on from where it began is no jump.
- More versions: overhand (a dip to the lead side first), elbow (coming down from high), body kick (quicker,
  the rear arm thrown back), low kick (barely a chamber); and of the reactions: the head snapped back,
  folding over a body shot (giving ground, the elbow over the liver), covering up high (a high guard taken
  on the forearms). Reactions also never repeat the last one.
- Stance cycles as clips: tired (hands sagging, shoulders slumped, heaving breaths) and hurt (the sway of
  legs that won't hold), loops laid over the stance and eased in and out, in place of the old hand-coded
  drop and wobble.
- The stagger when rocked is about twice as big (a long step back, the legs going, the hands at the waist),
  so it reads from the broadcast camera.
- 50 clips now. Measured in 3D (25 s each, 2x): two standing bouts 0 pops; one that went to the clinch and
  the mat 11 small pops (worst 7 cm), most of its jerk spikes in the clinch and the takedowns (Phase 5's
  work). Results unchanged (KO/TKO 33.7%, submissions 23.6%, decisions 42.7%).
- Pictures: `review/p4-spinning.png`, `review/p4-variants-2.png`, `review/p4-stance-cycles.png`.
- Left in Phase 4: knee variants (better done with the clinch's paired clips in Phase 5) and a fall for
  knockdowns (Phase 6). The calf kick unwinds a little sharply (a couple of jerk spikes).

**2026-11-01, Phase 5 (clinch and grappling), first pass.** Before it, a change of position on the mat (or
into the clinch, or getting up) was the pose blending across in about 60 ms while the man slid to his new
spot, and a submission looked like whatever position it came from.
- Moves between positions: when the position the picture shows changes, both men move into it together.
  A transition clip starts from the pose each man is actually in (`@from`) and ends in his new one (`@to`);
  the keys between are a mix of the two plus what makes the move (the hips up to step round the guard, a roll
  onto a hip, a hand posted to stand up), so one clip serves every position he comes from (`ANIM.transit`).
  Fourteen of them: taken down and finishing on top, passing (and being passed), sweeping and being swept,
  standing up from underneath and from on top, into and out of the clinch, knocked down and getting up.
  The turning channels are lined up the short way round, so nobody spins the long way.
- Takedowns: the double-leg (the rear foot now comes up behind the drive instead of leaving him stretched
  flat), a single-leg (the lead leg, head on the inside), and a body-lock trip from the clinch (it had
  borrowed the shot); the sprawl and failed shot as before.
- The clinch: the hands only take hold once he's close enough (on the way in they stay up, reaching), and the
  steps in and out of it are longer.
- Submissions: the engine's thirteen are shown as six holds, each a pair of poses placed against each other:
  rear-naked choke (and the other chokes from the back), guillotine (and the other front chokes), armbar (and
  the leg locks), triangle, kimura (and the omoplata), and arm-triangle (and the other chokes and locks from
  on top). Finished by one, he taps.
- On the way: a hand pulled in past the shoulder is now pushed out forward and down (its one unsettled
  direction is up behind the head, where no hand goes); a new reaction to a blow takes over from one still
  going instead of adding to it; the hips settle more gently when the feet spread.
- Measured in 3D: a scripted sequence through every transition, three submissions and a reversal, 0 pops in
  688 frames; live, a bout mostly on the mat 1 pop (3 cm), a clinch-heavy one 6 pops (worst 8 cm) and 9 jerk
  spikes (78 before the clinch fixes). Results unchanged (KO/TKO 33.8%, submissions 22.7%, decisions 43.5%).
- Reels: `review/p5-grappling-1.webm` (clinch, body-lock trip, sweep, triangle, stand-up, single-leg, the
  back, rear-naked choke) and `review/p5-grappling-2.webm` (double-leg, passes to half guard and side control,
  mount, arm-triangle, the tap). Stills: `review/p5-transitions.png`, `review/p5-takedowns.png`,
  `review/p5-subs-3d.png`, `review/p5-subs-side.png`.
- Still to do in Phase 5: the knees and dirty boxing in the clinch (the knee to the head with it pulled down,
  the knee variants), the cage pin, more ground strikes, the submissions refined (the armbar is the roughest),
  and the most common transitions authored as their own pairs rather than mixes.

**2026-11-01, Phase 5 reworked after your review** ("not very smooth, no sense of both bodies working
together"). The cause: each man was animated on his own, the two only lining up because they started and
ended in the right places; nothing tied one to the other, the camera swung about on the mat, and some limbs
flipped.
- Holds: in every position each man's hands (and legs, where they hold) are on points of the other man, every
  frame: the closed guard's legs locked round the waist, hands on the hips and chest, the collar tie, the
  crossface, the hooks, the seatbelt, and each submission's grips. When one moves, what holds him goes with
  him. Out of reach, he leans in to it (or the man underneath curls up to it). The hold is taken towards the
  end of a change of position, and a hand lets go to strike, cover up or tap (coming back to cock the punch)
  and takes hold again after, all eased, never in a frame.
- Together: during a change of position both men's places on the mat, and which way they face, travel on the
  move's own time, so they arrive together instead of each sliding there on its own spring.
- Working the position: neither man is ever still on the mat. Loops on the clock both share, so each answers
  the other: on top he postures up as the man underneath pulls him down, the man underneath shrimps and
  frames, bridges as the man mounted on him rides it up; in a submission, the squeeze and the struggle on one
  beat.
- Ground strikes answered: the man underneath covers up, or his head is knocked to the mat. The punch from
  on top now comes up round the outside to cock by the ear (the old path went up through the shoulder).
- The camera on the mat looks along the line they went down on (it aimed at the line between their hips,
  which in side control or mount points nowhere in particular, so it swung about).
- Limbs: a hand or foot pulled in past its shoulder or hip is let out the way that limb pointed the frame
  before (no direction left to flip through); a foot leaving the floor starts moving from rest instead of at
  full speed.
- Measured in 3D: a scripted run through every change of position, three submissions, a reversal and ground
  strikes: no flips; what the pop count still flags is the punch from on top (a fast strike; the stand-up
  measure leaves out the frames round an impact, this one doesn't). Live: a bout mostly on the mat 0 pops; a
  clinch-heavy one 5 small ones (6 cm at most). No engine change this round.
- Reels (replacing the first ones): `review/p5-grappling-1.webm` (clinch, body-lock trip, side control
  working, sweep, closed guard working, triangle, stand-up), `review/p5-grappling-2.webm` (double-leg, ground
  and pound from the guard, passes to half guard and side control, mount, ground and pound from the mount,
  arm-triangle, the tap). Stills: `review/p5-working.png`, `review/p5-gnp-strip.png`.

**2026-11-02, Phase 5 reworked again after your review** ("still needs work": bodies pass through, moves look
robotic, positions look wrong, too fast to follow).
- Reference: eight free Pexels clips (BJJ rolling, judo groundwork and throws, MMA sparring) in
  `review/footage/`, looked at for shapes and timing only, nothing traced. Contact sheets
  `review/footage/sheet-*.png`; the sweep, the roll to the back and a throw stepped through in
  `review/footage/sweep-8611719.png`, `roll-6765428.png`, `throw-6253401.png`. What they show: a sweep is about
  1.5 s of breaking the posture down, 1.5 s of hip bump and roll, a second of settling; a roll to the back
  about 1.5 s, then a second's scramble before the seatbelt and hooks are in; a throw about 1.25 s in, 0.6 s
  down.
- Pace: a change of position plays at its own length whatever speed you watch at (not when fast-forwarding,
  8x and up), and the fight waits for it to finish. At the default 4x a pass used to be over in 0.75 s; now
  the fight holds about 2.2 s (the pass, then the usual beat). Lengths from the footage: finishing a takedown
  1.1 s after the shot (the shot itself at its own length too), passes, sweeps and stand-ups 1.5 s, getting up
  1.4 s, into and out of the clinch 0.6 s.
- Bodies keep out of each other (new in ANIM: BODY). The other man as shapes: his trunk as the sections it's
  drawn with (deeper in front than behind), his head, neck and each limb a tapered capsule. On the mat and in
  the clinch a hand or foot that would go into him is put on his surface instead; on the mat an elbow or knee
  that's in him turns round him (both bones keep their length, the hand or foot stays put, and it's not turned
  down into the mat); the man above is lifted off the man under him, as little as clears him. Standing apart
  it's left alone: what reaches him there is a strike, aimed at his surface already. Every correction rides a
  spring from rest with a speed cap, so a sudden change in the way out never shows as a jump.
- Holds on the surface: each grip says which side of him it's on: the ankles crossed behind his back, the
  collar tie behind his neck, the crossface under his head, the seatbelt across his chest, the hands on his
  chest in the mount, the hand at his far hip in side control.
- Weight: where he lies on him (side control, mount, half guard, the back, the arm-triangle) his weight comes
  down onto him rather than hovering; every change of position lands with a sink into it and back up at the
  moment it lands (a `land` on the clip: takedowns, sweeps, passes, stand-ups).
- Transitions re-authored from the footage: an anticipation first (the posture broken down before the sweep,
  the weight sat back before the pass, the knees buckling before being taken down), the fast part in the
  middle, the landing, the settle. The sweep comes up low and driving instead of sitting up through upright.
- Positions rebuilt:
  - The closed guard: he sits back on his heels, and the legs are locked round his waist.
  - Half guard: chest down, one leg trapped, the arm under the head.
  - Side control: across him, facing across him, chest on chest. This needed the man on top to be placed off
    the line between them and turned 90°, which wasn't possible before.
  - The mount: astride, the knees down either side.
  - The back, as it's taken: he's underneath, the man lying back on him, hooks in, seatbelt.
  - The six submissions with them: the choke from the back, and the guillotine, armbar, triangle and kimura
    at the guard's new height.
- Getting up: they come up apart, at the spacing they're headed for, instead of inside each other.
- Measured:
  - Overlap (the deepest point of one body inside the other), each position held: closed guard 15 → 4 cm on
    average, half guard 17 → 4, side control 16 → 4.5, mount 13 → 4.5, the back 16 → 2.4. Submissions, where
    the arms are wound into each other by design: the rear-naked choke 15 → 9, guillotine 15 → 6, armbar
    16 → 7, triangle 15 → 3, kimura 5 → 4, arm-triangle 17 → 7.
  - Pops:
    - Standing bouts: none from this.
    - A bout mostly on the mat: 2–3 small ones, 6 cm at most.
    - A scripted run through every change of position: 4, 8 cm at most (1 without the collision).
    - A scripted clinch exchange of eight strikes: no more than without it (59 against 61, blows landing
      included), the worst 23 cm against 41.
  - Results (no engine change this round): KO/TKO 33.2%, submissions 23.7%, decisions 43.1%.
- Reels: `review/p5c-grappling-1.webm` (double-leg to the guard, passes to half guard and side control, the
  mount, the back, the rear-naked choke) and `review/p5c-grappling-2.webm` (the guard, a sweep, a triangle,
  the stand-up), each at real speed and then half speed. Strips: `review/p5c-reel-1.png`,
  `review/p5c-reel-2.png`. Stills: `review/p5c-positions.png`, `review/p5c-subs.png`.
- Still rough:
  - The armbar: the legs are on him, but his upright back hides them from most angles.
  - The submissions' arms are still into each other 3–9 cm.
  - The mount-to-back change passes through a high arch for a moment.
  - A standing punch that jumps 40 cm at its start on one seeded bout, with or without this round's work
    (Phase 4's).

**2026-11-02, transitions as techniques for two: first three** (your review: "the transitions need a lot of
work"; you picked morphs not moves, not moving together, wrong moves). Studied frame by frame first: each
change of position was each man cross-fading from his old pose to his new one, his place on the mat sliding
in a straight line, so limbs went straight through space, the two passed through each other (the sweep) or
spun on the spot (side control), and some were the wrong move altogether (mount to back flew the man up into
an arch).
- Techniques for two (`anim/pairs/*.json`, embedded with the clips): both men keyed together on one clock,
  each key a pose for each (`top`, the man who ends on top; `bot`), in the clips' own terms, so a limb goes
  where it's put. Each man's path over the mat is keyed too (`place`: how far from where he was to where he's
  going, plus metres along and across the line, plus a turn), smooth through the keys, so a man is driven
  back, or tips to one side, or comes round, instead of sliding. `grips` hold a hand or foot on the other man
  for a stretch (the arms round the legs in the double-leg) and hand over to the position's own holds at the
  end; each man lands in his own time (`land`).
- Picked the frame the picture's position changes, for both men at once, by where they were and where they
  are now and whether the man on top changed (`stand>guard`, `guard>half`, `guard>guard!`). Changes with no
  technique yet still use the old blends.
- The mat: taken down, the man underneath lands a little behind where he stood (the layout used to put him
  between them, nearer the shooter than he'd been); swept, he goes down where he is and the other comes up on
  top of him (they used to slide 0.6 m along the mat to the layout's places). The lift that keeps the man on
  top out of the man under him waits until the move is nearly done: mid-sweep the sweeper is still underneath.
  A successful shot now hands over to the technique as he gets there, so the other man reacts to it.
- The three:
  - Double-leg: head on the hip, arms behind the knees; the back foot steps up and he drives; the other man
    bends over his back, hands on it, his knees go, he tips back with his arms flung out and lands on his
    backside; the shooter follows him down onto his knees, chest low, and the legs come up round him.
  - Knee-cut pass, guard to half guard: postured up in combat base, a hand pinning the near knee, the guard
    opening (feet to the hips); the knee cuts across as the hips turn, the arm goes under the head, the back
    leg is trapped; the chest drops onto him.
  - Hip-bump sweep, checked against footage 8611719 (18–25 s): posture broken and hands posted on the mat;
    he sits up onto a hand behind him and bumps into him; the man tips back and over to one side and lands on
    his back, the sweeper coming up into his guard.
- Measured through each move: no pops in any (the first versions had two, a hand folding past its own
  shoulder and a grip let go in one frame, both fixed); overlap 6–9 cm on average, more contact than the old
  blends had (5–8 cm) because the bodies now hold on to each other.
- Stepping sheets: `review/p5d-doubleleg.png`, `review/p5d-kneecut.png`, `review/p5d-sweep.png` (with the
  footage beside it). Video: `review/p5d-techniques.webm` (the three, real speed then half speed).
- Next, after your look: the body-lock trip, half guard to side control, side control to mount, mount to the
  back and side control to the back (the roll under, footage 6765428), the reversal from underneath, guard
  recovery, the stand-up and the wall walk.

**2026-11-02, the rest of the techniques** (you accepted the first three, "still a lot of clipping through";
that's still open).
- Eight more, so every change of position the engine makes now has a technique:
  - Body-lock trip from the clinch.
  - Half guard to side control (the trapped leg freed, the hips swung out across him).
  - Side control to the mount (the knee slid across the belly, sitting down astride).
  - Taking the back from the mount or side control: he turns away, the man on top rides him, slides down
    behind him onto a hip with the seatbelt, hooks in and rolls back taking him along; checked against footage
    6765428.
  - The reversal from underneath (bridge and roll) from the mount, side control or half guard.
  - Getting the guard back (frame, shrimp, a knee in).
  - The technical stand-up: the man on top steps back first, then the man underneath gets up.
  - The wall walk up into the clinch.
- On the way:
  - The back is now made by turning the man taking it round on the mat, his heading, not by turning his pose
    round inside itself. A technique can turn him the way it rolls (`turn`), and his limbs don't swing through
    his body on the way.
  - On the mat each man's stance is set by the side he's on, so the other man's head is on the same side of
    him whoever is where. The crossface reaches the same way for both.
  - The submissions' poses weren't on the list of poses on the mat, so the move into a submission had been
    skipped and snapped in on the spring. They're on it now.
- Measured, each technique on its own, the whole move: no pops in nine of the eleven; one elbow jump of about
  9 cm in the bridge and one in the wall walk. Overlap 5–9 cm on average through the moves (1 cm in the
  stand-up). Live, a bout that went to the mat by the body-lock trip: 2 small pops (4 cm at most). No engine
  change.
- Sheets: `review/p5d-kneeacross.png`, `p5d-freeleg.png`, `p5d-backroll.png` (with the footage), `p5d-bodylock.png`,
  `p5d-bridge.png`, `p5d-shrimp.png`, `p5d-standup.png`, `p5d-wallwalk.png`. Videos: `review/p5d-techniques-1.webm`
  (double-leg, body-lock trip, the passes, the mount, the back) and `review/p5d-techniques-2.webm` (the sweep,
  the reversal, guard recovery, stand-up, wall walk), each at real speed then half speed.
- Still open:
  - The clipping through. While a move plays, the lift that keeps the man above out of the man below waits,
    so the keyed poses can decide who's where; hands, feet, elbows and knees are still kept out. The worst
    moments are 15–20 cm, mostly forearms and shins wound into the other man.
  - The shot before the double-leg is still the old strike clip.

**2026-11-02, joint ranges** (your review: "the models are bending in unnatural manners to get into
position").
- A posture check first (`posture()` / `postureTest()` in tests/camtest.js), which measures each solved joint
  against what a body does: spine and neck twist, side bend, fold and arch; each knee's bend direction
  against the front of the leg; each elbow against the forward-and-in it can't point to; each foot against
  its knee; each hip and shoulder. It found:
  - Knees turned backwards in the back take and the bridge and roll.
  - Hips folded past the chest.
  - Feet twisted against their knees in most of the moves.
  - The arms of the man rolled over in the bridge.
- The causes:
  - A knee's bend direction and a foot's direction were set in the body's own frame, not the pelvis's. When a
    move rolled the hips onto one side, a knee meant to point up pointed sideways or backwards from the hip,
    and the foot twisted on the shin.
  - Nothing in the solver stopped a joint going past its range, whatever asked it to: a pose, a blend between
    two, a grip, or the collision's own elbow and knee turn, which could go up to 150°.
  - Two keys of mine were simply impossible poses (halfway through the back take, and the rolled man in the
    bridge).
- Fixed in the solver (FIG):
  - A knee bends only towards the front of the leg, give or take 1.1 rad of hip turn.
  - An elbow never points forward and in across the body.
  - A foot stays within a rad of its knee's way round the shin, and is lined up again after anything moves the
    knee later.
  - Past its range a joint is held at the edge, and only when asked for nearly the whole way round does it ease
    back to what was asked. With no jump anywhere near the edge, nothing flips from one side of its range to
    the other.
  - The collision's turn of an elbow or knee is capped at a rad either way.
  - The back take now comes off the top onto one hip with the legs swung out to the side before lying back
    (not legs through the hips). In the bridge the rolled man's far knee lifts as he tips, and his knees come
    up as he goes over onto his back.
- Measured:
  - Held positions: all within range except the armbar's foot (the attacker's leg over the face).
  - Through the techniques: the backwards knees and the twisted arms are gone. What still reads past range
    is a foot still in its kneeling angle mid-move, and the back take's leg as it swings over the man.
  - 4 small pops across all eleven (8 cm at most).
  - Standing: no new pops, and the strikes as they were.
- Videos: `review/p5e-techniques-1.webm`, `review/p5e-techniques-2.webm`. Sheets: `review/p5e-back.png`,
  `review/p5e-bridge.png`.

**2026-11-03, stiff arms, splayed legs, floating** (your review: "still unnatural"; you picked stiff straight
arms, legs splayed or folded, and floating, worst in the passes, the back and the sweeps and reversals).
- Measured first: the posture check now also counts:
  - An arm held dead straight that isn't punching.
  - A hip spread wider than it opens.
  - A man on the mat with none of the parts that can carry him (feet, knees, hands, backside, back, head) on
    the mat or on the other man (`unsupported()`).
- Locked arms were in every one of those moves, often most of it. Splayed hips went up to 25° past range.
  Floating as a whole body didn't occur, since something always touched the other man; what read as floating
  was legs and posts in the wrong place.
- The causes:
  - A technique's grips pulled a hand to its target however far away it was.
  - Several of my keys put a hand past arm's length.
  - The solver let an arm straighten all the way for anything.
  - Feet could be placed wider than a hip opens, and a knee could turn out further than a hip rotates.
  - In the sweep and the bridge, the man going over had his legs keyed to swing from behind him to in front by
    passing under his hips.
- Fixed:
  - In the solver (FIG), an arm that isn't punching never locks out: past 88% of its length it eases towards
    95% and keeps a bend. ANIM tells it which arm is punching.
  - A technique's grip out of reach is let go instead of yanking the arm at it.
  - A knee turns out no more than a hip rotates (0.85 rad), and a foot can't be placed wider than a hip opens
    (kicks, steered by the knee, are left alone).
  - On the mat, a man held up by nothing settles down, feet and all, until something carries him.
  - The man swept, or rolled, keeps his legs folded under him as he goes over and lands, and they come up
    into the guard after.
- Measured again, those seven moves:
  - Locked arms: none.
  - Floating: none.
  - Splayed hips: only the guard player's leg in the knee cut, pushed open by the pass, 17° past.
  - Pops: 1 small one.
- Standing unchanged: the stance within range, punches still straighten, no pops in a standing bout.
- Videos: `review/p5f-techniques-1.webm`, `review/p5f-techniques-2.webm`. Sheets: `review/p5f-sweep.png`,
  `review/p5f-bridge.png`, `review/p5f-mid-1.png`, `review/p5f-mid-2.png`.

**2026-11-07, the moves between positions** (your review: "still unnatural"; then "the problems are in the
inter-animation moves, whenever positions change the bodies get in unnatural positions").
- Looked at frame by frame from three sides, and the sweep beside footage 8611719 at the same moments
  (`review/p5g-sweep-vs-footage.png`). The joint ranges were holding; the shapes in between were wrong:
  - The man swept knelt upright inside the sweeper mid-sweep (the real one is folded over and tipping over
    his shoulder), and the sweeper sat up upright, apart from him (the real one comes over low, chest on chest).
  - In the bridge, the man underneath made a table on straight arms and legs.
  - Between keys, each man's hands and feet were blended in the room while his body turned, so as he tipped
    over or sat up his limbs were left behind and dragged across.
  - A man lying on his back was "turned onto his side" with the pelvis's roll, which in these poses swings
    him round flat on the mat; turning about the spine is the yaw. Wrong in the back take, the knee cut, half
    guard to side control, side control to the mount and the guard recovery.
- Fixed:
  - Limbs carried with the body (ANIM, every change of position, the old clips included): between two keys a
    hand or foot that's off the mat at either end is blended in his own frame (a hand from the chest, a foot,
    its knee's way and its toes from the hips), so as he tips over or rolls his arms and legs come round with
    him, as an animator's rig turns them; one on the mat at both ends stays put while the body moves over it.
    The keys themselves are exactly where they were. (`ANIM.FLAT.on` brings the old blend back, to compare.)
  - The hip-bump sweep re-keyed against the footage: broken down and folded over, then the sweeper turns onto
    his side and bumps, the man swept tips over his shoulder with his legs coming up and lands on his back,
    and the sweeper follows him over low, chest onto his chest, before coming up into his guard.
  - The bridge and roll re-keyed the same way: shoulders down and hips up (no table), the man on top tipped
    over to the trapped side and going over onto his side and back, the other turning over after him, low.
  - The turns onto the side made with the yaw in those five moves. In the back take he now turns away with his
    knees falling together to that side.
  - In the knee cut the leg cut across is pinned flat on the mat instead of standing up.
  - The back, held: the man lying back on the other has his knees bent and feet flat near him, instead of his
    legs stuck out straight.
- Then, checking those, four faults in the solver and ANIM that bent knees the wrong way mid-move:
  - The front of the leg (which way a knee may bend) was the pelvis's forward, switched to its up when a leg
    came into line with it: a quarter turn in one frame, the knee flipping with it. Now the pelvis's forward
    turned up with the hip's bend (forward for a leg under him, up for one out in front, towards his head for a
    knee pulled to the chest), which never jumps. The posture check in `tests/camtest.js` uses the same.
  - The limit on how fast a knee or elbow turns round its limb (`swing`, 12 rad/s, against flips) measured the
    turn in the room, so a body rolling over had its knees held back, bent the old way. Now measured against
    his own pelvis (knees) and chest (elbows): the body takes them round with it, and only a real flip is
    slowed.
  - A foot placed wider than the hip opens was only partly pulled in, and not at all when the leg pointed
    straight out to the side (the back take: legs in the splits for a moment). Now turned in to exactly the
    hip's limit, leaning on hanging down when there's little else to go on. The back take's key that asked for
    one leg out each side while sat tilted on a hip is now a side-sit, both legs folded to the low side.
  - A key can leave a knee's way empty (`[0, 0, 0]`) and get the leg's own front; a way asked for short of
    full length is made up with it. (No existing key or pose was short; one kick key by 3%.)
- And two jolts at the end of every change of position: the lift and weight that lay the man on top onto the
  man underneath switched on all at once at 75% of the move (now taken up from 60% to 95%), and the landing's
  kick was given in one frame (now spread over 80 ms).
- Measured, each move on its own from a fresh page (worst joint past its range, radians, before → now; pops):
  - Hip-bump sweep: the man swept knelt upright mid-move before (not a joint fault, so it didn't show);
    0.84 now, his hip folded at the moment he tips; no pops (the old blend had a 17 cm toe and 13 cm knee).
  - Bridge and roll: 1.84 → 0.86 (the man going over, hip folded); no pops.
  - Taking the back: 1.05 → 0.77 (an ankle); no pops.
  - Knee cut: 0.31 → 0.21; no pops.
  - The other seven: as they were or better; one pop in all eleven, the double-leg's 8.5 cm heel, as before.
  - The scripted run through every change of position: 6 pops (13 with the old blend and the same keys);
    the worst is the triangle's 19 cm toe, as before.
  - Standing: a seeded bout compared with the solver changes reverted: the same two pops in both (a 4 cm drop
    entering the clinch, a 5.4 cm fist in it), both from before this round.
- Not done: the double-leg, body-lock trip, half guard to side control, side control to the mount, guard
  recovery, stand-up and wall walk weren't re-keyed against footage, only fixed where the faults above
  touched them. Clipping is as it was (overlap 5–10 cm on average).
- Grids of every 75–110 ms from the side: `review/p5g-hb3-grid.png` (sweep), `review/p5g-br1-grid-b.png` and
  `-c` (bridge), `review/p5g-bk1-grid.png` (back take), `review/p5g-kc2-grid.png` (knee cut); before:
  `review/p5g-look-*.png`. Video: `review/p5g-moves.webm` (the four, real speed then half speed).

**2026-11-07, attempts on the mat: denied, reversed, major** (your request: a system like UFC Undisputed 3's
ground game; plan approved for watched fights, a playable mode left out).
- The reverse-engineered projects (UFC3ReX, Unchallenged 3) are static recompilations: the game's machine code
  turned into C++ at build time from the player's own disc, no readable game logic and no assets in the
  repositories. Nothing was taken from them or from the game; the system below is built from how the game
  plays (every change of position an attempt that can land, be blocked partway, or be reversed; minor
  transitions one position on, major ones skipping a position, quicker but easier to reverse).
- The engine (`attemptPass`): a pass is now an attempt with three outcomes. Minor: guard → half guard → side
  control → mount → back. Major: guard → side control, half guard → mount, side control → back (the old 25%
  side-to-back jump is one of these now); chosen more by better top players and on a hurt man, lands 80% as
  often as a minor one would. Stopped, it's denied (the man who tried it pays 0.6 more energy) or reversed
  (scramble and guard against posture and top game, energy, coaching edges; about 4% of stopped minors and 12%
  of stopped majors at even skills): the man underneath comes up on top in the guard or half guard. A failed sweep that
  doesn't give up position is shown as a sweep stopped. New commentary: `passDenied`, `passReversed`,
  `passMajor`; "recovers guard" only from the guard or half guard now (it was said from side control too).
- Balance, ~10,000 fights between neighbouring ranked fighters, before → after: decisions 42.2 → 42.9%,
  KO/TKO 34.3 → 34.3%, submissions 23.5 → 22.8%, control 270 → 267 s per 15 minutes, reversals 1.55 → 1.77 per
  15 minutes. Passes: 5.8 tried per 15 minutes, 48% land, 48% denied, 3% reversed; 30% of them major, 41% of
  those land. Twins +4 in one attribute (500 each): guard +4 → +3, top game +3 → +5, scramble +1 → +1,
  posture 0 → -1, wrestling +10 → +7 (all within the run's ±2 to 3 points).
- The fight view acts each one out (the engine's word on it reaches the picture through `movedPass` →
  camMotion → `cam.attempt` → pairNow):
  - Denied: the pass's own technique played to where it's caught (`deny.at` in its file), held there while the
    man underneath frames against it (`deny.grips`, and each man's `add` to the pose he's held in), and taken
    back to where it started (`hold`, `back` ms). Nothing changes on the mat, so it's played over the pose
    that's showing (`show`), starting from the pose without the position's working loop (which carries on
    under it), the gap carried on the spring a change of position uses.
  - Reversed: the pass as far as it got (`revAt`), then the sweep that turns it round (hip bump from the
    guard, bridge and roll from everywhere else) from wherever the two of them have got to.
  - Major, with no technique of its own: the two it skips through, the first quicker and cut at 88%, the
    second from there (guard → side control: knee cut then the leg freed; half guard → mount: the leg freed
    then the knee across).
  - Handing over between two techniques: grips still held where the first is cut off are kept to the end and
    handed on at the strength they had, while the second one's own take hold over 250 ms; the second starts
    from the pose before the grips (they'd count twice) and carries on at the pace the first was going.
  - Any grip: one that comes into reach is now taken over 150 ms (a knee dropping into reach had the hand
    thrown half a metre onto it in two frames, in the knee cut, in live play).
  - Stops and reversal points keyed in kneeCut, freeLeg, kneeAcross, backRoll (passes) and hipBump,
    bridgeRoll (sweeps stopped).
- Measured from fresh pages (`tests/camtest.js`: `ATTEMPTS`, twelve of them; `liveGround`, the engine's own
  grappling live for 60 s, with a speed check):
  - The twelve, scripted: no pops in eleven; one 4.4 cm elbow in the half-guard pass stopped went with the
    underhook grip (removed). Overlap as the techniques' own (worst 0.09–0.22 m, mean 0.04–0.09).
  - Posture: the stops 0–0.14 rad past range; the reversals 0.65–1.11, the sweeps' own legs-up phase (the
    sweeps alone: 0.84–0.87).
  - The eleven existing techniques: no pops (unchanged code path).
  - Live, 60 s (two passes stopped, one reversed, two landed, five sweeps stopped): two flicks left, a 13.6 cm
    toe in the reversal's sweep and a 9 cm elbow as the knee cut is stopped. No part of either body faster
    than 7 m/s.
  - Found on the way, not from this round: the live test had put the two men on the mat in their corners, and
    the first reversal brought them together across three metres of mat in a fifth of a second. In a fight a
    takedown puts them together first; the test now does too.
- Not done: more positions (north-south, butterfly guard, turtle, the clinch ties: the plan's step 3, its own
  approval); a playable mode; the two flicks above.
- Frames: `review/p6a-kneecut-denied.png`, `review/p6a-hipbump-denied.png`, `review/p6a-kneeacross-reversed.png`,
  `review/p6a-guard-to-side.png`. Video: `review/p6a-attempts.webm` (eight, real speed then half speed).

**2026-11-07, the swept man's limbs, and bodies kept out of each other** (your notes on the attempts video: the
man on top bends his limbs like a spider when he's reversed from underneath; a lot of clipping, to be avoided
as much as possible).
- The spider: the swept man's knees were keyed pointing straight out sideways and folded tight (35°), his elbows
  folded shut (50°) with the forearms out, as he went over; and in the bridge the bridger's own leg was keyed
  out to his side while he lay on that side, which is towards his head (his hip at 3.44 rad, 1.1 past what a
  hip does). Re-keyed in `hipBump` and `bridgeRoll` (and through them every reversed pass): the posting hand
  reaching for the mat with its elbow down and back, the legs folded together with the knees forward, the
  landing legs half as spread; the bridger's under leg in front of him; the swept man's top leg crossing over
  his body as he rolls, not swinging up knee first. Posture past range (rad), the man swept, before (the old
  keys, no contact pass) → after (the new keys, the contact pass on): hip bump 1.11 → 0.56, bridge 0.73 → 0.47, the four reversed passes
  0.61–1.35 → 0.35–0.60 (and one ankle at 1.0 in the half-guard pass before it's turned round); the sweeper's
  hip folded on past his chest (1.1–1.35 in every reversal; the bridger's 3.44 rad, now 2.62) is gone, his
  worst now an ankle at 0.79.
- Clipping, measured (`tests/contact.js`): what's in what over every technique and attempt: half of it limbs in
  each other's limbs (thighs and arms most), which nothing handled (BODY moved only hands and feet off limbs);
  then limbs in the other's trunk; trunk in trunk least.
- `ANIM.CONTACT`, a last pass once both men are posed each frame (on the mat, in the clinch, and 1.5 s after):
  each limb two tapered tubes at a shade under the drawn radii, the trunk its sections, the head a ball.
  Limbs pushed off each other's limbs (each giving as easily as it goes: a foot or hand planted on the mat a
  fifth as easily, a bone near its root hardly), out of the other's trunk and head, off the mat; trunks out
  of each other (half each, but the man flat on the mat none of the way down). Six rounds a frame. Each limb
  then back to its bones' lengths (a knee pushed aside takes the foot with it, the leg swinging from the hip),
  its elbow or knee turned round it at most 1 rad (0.8 a knee) from as posed and to the side it was last
  frame; a knee no further from the front of the leg than 1.2 rad, a thigh folded no further than 2.3 (or
  than the pose had them); the foot carried in the shin's own frame and put back in line with the knee.
  Two limbs keep to the side of each other they were on (unless gone 3 cm past each other's middle). Each
  frame starts from last frame's correction, let go over 120 ms, so a limb pressing in stops at the surface
  with nothing to catch up on; each point's correction speeds up no quicker than 150 m/s² (the whole man 80)
  and moves no quicker than 4 m/s (3), braking to arrive, so it starts and stops smoothly. The settings were
  measured against each other (`variants()`); a stance mirroring takes the corrections across with it.
- Measured, the same clips with the pass off → on: the eleven held positions, overlap 6.6 → 0.9 cm on average
  (sum of means 0.72 → 0.10); the 23 techniques and attempts 8.2 → 2.4 cm (1.88 → 0.55). Each move still has a
  moment or two at ~20 cm, where the clip drives one body through the other faster than a correction may
  move. Pops in the 23: 3 → 14 (mostly 3–5 cm). Live, 60 s of the engine's grappling at 2x: 9 pops, six of
  them one 5.6 cm knee as it's pushed aside by a passing shin and let go; no new speed (the guard player's
  legs whip at 12–14 m/s for 0.1 s in the stopped knee cut live, with the pass off too: the clip's own).
- Found on the way: the double-leg's "36 pops" were the shooter's stance mirroring as he goes to the mat (left
  and right trading names where they stand; the picture doesn't move). The pop counters skip those now. And
  `liveGround` left the picture at 2x with the fight running, so anything filmed after it went at double speed
  with the fight carrying on (a stand-up in the middle of a sweep): it puts both back now.
- Not done: the clip's own whip above; the ~20 cm moments (they need the clips re-keyed, the thighs crossing
  in the knee cut and leg drag most); a body against itself (an arm through his own chest) isn't checked.
- Frames: `review/p6b-hipbump-now.png` / `-after.png`, `review/p6b-bridge-now.png` / `-after.png` (before and
  after), stick figures `review/p6b-sticks-*.png`. Video: `review/p6b-contact.webm` (each sweep with the pass
  off then on, two reversed passes, the knee-cut pass off then on; real speed then half speed).

**2026-11-07, clipping, second round** (your note: clipping between bodies still a big issue).
- The measure was kind to it: it tested limbs thinner than they're drawn and each trunk by three balls down its
  middle. Measured now as it's seen (`tests/contact.js` `visible()`): points all over each man's surface as
  drawn (every section of the trunk round its outline, the head, each limb's tube round and along it, at the
  3D figure's radii) tested against the other man's shapes at theirs. By that, what you saw last round was
  still 6.4 (held positions) and 12.5 (moves), against 42 and 47 with no pass at all (the deepest of each
  kind of thing in another, cm, summed, a frame); most of it thighs in the other's limbs, limbs in trunks.
- `CONTACT`, changed (each measured against the rest, `variants(list, 'visible')`): each limb as thick as
  it's drawn, the muscles and glove included; trunk against trunk by each section's outline; two limbs in
  each other by their roots (hip against hip) and a thigh or upper arm in him near its root move the two men
  apart, what the limbs can't take; a lower leg or forearm in him that can't easily go (its end planted)
  moves him too (only him: the man it's on lifted for it was left in the air); 12 rounds a frame (1.4 ms).
  Corrections are quicker (6 m/s) and speed up as quickly as how far they have to go asks: gently for a few
  centimetres (150 m/s², or every small adjustment showed as a flick), up to 300 when deep in him (gently
  throughout, twice as much was left in). A lift let go over 40 ms, not 120 (he hung in the air once the man
  under him rolled out), and a man on the mat with nothing under him brought down to whatever first touches.
  The hip limit compares the thigh with as posed the short way round (a thigh pushed a little across where the
  fold angle turns over was read as folded round by 2 rad, and the leg swung back in a frame: 52–57 cm knees);
  the last pass only puts bones back to length, without the turn limit (a limit there undid the easing); the
  foot follows the shin's turn only where the knee is bent, blended out as it straightens (toes flipped 25 cm).
- Measured as seen, now: held positions 0.7–0.9, moves 2.4–2.5 (from 6.4 and 12.5); frames with anything more
  than 4 cm into the other: 7.5–9.8%. Live at 2x, 30 s: 12 pops, 4 of them over 5 cm (the quick corrections
  throughout gave 42).
- Not done: what's left is moments mid-move, 11–16 cm, shins, thighs and forearms in the other's trunk where
  the clip drives them through faster or further than a correction can follow (the hip bump and bridge as they
  go over, the guard straight to side control as it settles); and in the bridge's roll the clip has the two
  bodies through each other, so taken apart the man swept is left perched up to ~20 cm for a moment. Those
  need the clips re-keyed with the bodies' room in them.
- Frames: `review/p6c-positions.png`, `review/p6c-deep-*.png`. Video: `review/p6c-contact.webm` (four moves,
  each with the pass off then on, real speed then half speed).

**2026-11-08, arms through their own body; the positions as built** (your notes: a lot of self clipping
through the torso with the arms; and go ahead with re-keying what drives the bodies through each other).
- Measured (`tests/contact.js` `selfVisible()`, `selfSurvey()`): each man's arm and leg surfaces, as drawn,
  against his own trunk, neck and head (the upper arm and thigh from halfway down, clear of the shoulder and
  hip). Before: 15 to 17 cm on average in every position, every move, standing still and every strike; the
  poses were made for a slimmer body than the one drawn (standing in his guard, the rear elbow 11 cm inside his
  chest). `CONTACT` now keeps each man's limbs out of himself too (`selfOut`), always, standing included:
  after, under 1 cm on average everywhere, 10 to 14 cm for a moment in two reversals as it catches up. The
  guard looks the same, the elbows down, just in front of the body instead of in it.
- The held positions were coming apart: with the pass pushing the two men apart half each and across, the
  mount's man on top was slid off onto the mat between the legs and side control spread by half a metre (the
  overlap read nothing; the position wasn't the position any more). Two causes: the pose stage (`BODY.lie`)
  laid the man on top onto the man under him by three balls down his middle, slimmer than he's drawn, so he
  sank in by the difference every frame (14 cm in the mount); it now uses each section's outline, and the
  mount needs no correction. And while they hold a position (no change of position playing), a push that's
  mostly up or down only lifts the man above (`stack`); across, and in the middle of a move, they move apart
  as before.
- Re-keyed: side control's crossface (the hand was under his neck, the forearm through his head: now across
  his face, the hand on the far side, 8.6 → 1.4 cm); the guard player's knees wider (his thighs went through
  the waist of the man in it: closed guard 7.7 → 1.9 cm worst, the guillotine 10.6 → 5.4); the choke's heads
  (the head as big as it's drawn in the pass, 0.095 → 0.112, and each upper body leant a little its own way:
  8 → 0.7 cm).
- Measured as seen, now: held positions 2.0, moves 2.3 to 2.4 (cm, the summed measure above), frames with
  anything more than 4 cm into the other 7.5 to 9%; live at 2x, 30 s: 5 pops, one over 5 cm (12 before).
- Tried and left out: letting deep corrections go faster (10 m/s, 600 m/s²): less in each other, but live 146
  pops and limbs at 49 m/s. And the bridge's placement moved to give the two of them room mid-roll: worse at
  the end (I had its axis the wrong way round); put back.
- Not done: the bridge's roll still has the bodies through each other in the clip, so the man swept can be left
  perched up to ~15 cm for a moment; moves still have moments of 10 to 15 cm (thighs and shins in the other's
  trunk as they go over); the man sweeping's posting arm, kept out of his own back, goes 0.5 to 0.7 rad
  further behind him than a shoulder goes.
- Frames: `review/p6d-stand-before.png` / `-after.png` (the guard, the arms in the chest and out of it),
  `review/p6d-positions.png`, `review/p6d-side.png`. Video: `review/p6d-self.webm`.

**2026-11-08, the moves re-keyed where they put the bodies through each other** (your note: re-key the moves).
- A steadier measure first (`tests/contact.js` `worstMany()`): the position a move starts from is still
  working (the guard player's head and arms move 10 to 15 cm), so one run of a move said as much about the
  moment it started as about the move. Each move is now started four times at different moments of that
  working, with the same random numbers each time, and what comes up in more than one start is what counts.
  It still moves about 0.3 cm (one move, sometimes 0.5) between runs, because the limbs remember which way
  they last turned (on purpose: that stops flips), so the total over all 23 moves is the number to go by.
  And a quick one for keying (`posedIn()`): how far one man is into the other as keyed, before the contact
  pass, over a stretch of a move; the same to a tenth of a centimetre run to run, a second or two each.
- Found on the way: at the end of a change of position the contact pass switched in one frame from "moving"
  (both men give way) to "held" (the man above is lifted clear). Where the two disagreed, he jumped: after
  the guard straight to side control, the man on top's hips rose 21 cm in 150 ms, driving his shin into the
  man under him. It's now a weight taken up over the end of the move, as his weight settling onto the other
  man already was (60% to 95% of the way).
- Re-keyed:
  - The bridge and roll (and the two reversals that use it): the trapped arm is held until he's over (let go
    mid-roll, the bridger's forearm went through the other man's arm and chest to where the key had it).
  - The hip-bump sweep (and the knee cut turned into it): the two of them change places along the line, and
    mid-sweep they met in the middle, hips 12 cm apart at the same height. The man going over is now kept
    ahead of the sweeper coming after him. As keyed, 24 → 8.6 (the two men's mean depth summed). With the
    contact pass, the sweep 0.92 → 0.26 cm and the reversal 1.02 → 0.46.
  - The knee-cut pass (and the guard straight to side control, which starts with it): the passer's hips stay
    back as the knee drives across, instead of over the man's legs. Guard straight to side control 2.15 →
    1.30, the pass 0.58 → 0.51, the reversal 0.45 → 0.30, and the denied attempt still clean.
- Tried and left out: the same kind of placement for the bridge (better from the mount, worse from half guard,
  where the start is different); the back take and the leg-free pass (little to gain by placement); the guard
  player's knees wider in the sweep (worse); dropping the held lift for limbs (the positions came apart: the
  mount's chests 16 → 35 cm, the arm-triangle's 12 → 72); the other man giving way more easily (positions
  better, moves worse); no memory of which side a limb went in from (no better).
- Measured, all 23 moves from four starts each: summed 22.85 → 18.86 cm (the knee-cut pass 1.48 → 0.37, the
  hip bump 1.34 → 0.32, the bridge from half guard 2.2 → 0.87, the knee cut reversed 1.27 → 0.53). Live at
  2x, 30 s: 9 pops, one over 5 cm (an 8 cm toe); the fastest limb 9.5 m/s (12 to 14 before).
- Not done:
  - After the guard recovery from side control the guard player's left knee ends in the middle, in front of the
    man on top, and swings 40 cm out to its own side as the guard's working takes over, rubbing through him
    (10 cm for about a second). The same moment, the guard closing, after the bridge, the back take turned
    round and the knee across turned round.
  - Mid-roll in the bridge, thighs still 11 to 15 cm in the other's trunk.
  - The back take's ride (chest on his back) 10 to 13 cm.
  - The end of the guard straight to side control, the bottom man's leg 13 to 16 cm in the man on top.
  - Pops, which predate this round: knees and toes jumping 15 to 80 cm in a frame in some runs of the hip
    bump, the bridge from half guard, the back take and the knee cut reversed. Traced in the hip bump: the
    contact pass pushes the sweeper's knee up out of the man above him until the thigh is folded to the
    hip's limit (2.3 rad, the pose had 1.47); held there, it drops off the limit by 0.35 rad in one frame
    when the feet let go of the man's hips. The fix is in the solver: a leg held at a limit let back no
    faster than it moves. A debug record for it is in place (`CONTACT.dbg`).
- Frames: `review/p7-hipbump-after.png`, `review/p7-kneecut-after.png`. Video: `review/p7-moves.webm` (each
  move as it was, then now; real speed then half speed).

**2026-11-08, the knee jumps** (your note: fix the knee jumps).
- Measured first (`tests/contact.js` `popsMany()`, every move from four starts): 19 jumps of more than 10 cm in a
  frame, 13 of them more than 20, in 11 of the 92 runs; knees and toes, 20 to 63 cm (the back take, the technical
  stand-up, the bridge turning round a leg freed, the knee cut turned round).
- Traced (`traceJump()`, with a record the solver keeps when asked, `CONTACT.dbg`): none of it is in the poses.
  It's the last pass of the contact solver, which puts each leg back together after the push, in three places:
  - A leg folded tight (in the back take's side-sit the heel is a few centimetres from the hip): the knee was put
    back round the line from hip to ankle, and that line, a few centimetres long, swings round with every
    centimetre the ankle moves. The knee went 43 to 54 cm from where the push had it. Now, folded that tight, the
    knee stays where the push left it and the bones are put to length from the hip out; from a third of the reach
    to a tenth the one hands over to the other. Legs only: done for arms too, the guard's fists shook by 3 cm.
  - The hip's limit (a thigh folded up no further than 2.3 rad) reads the fold as the thigh's angle seen from the
    side. A thigh out to the side has next to nothing in that view, and its angle there turns half round for a
    few centimetres: read as 2.4 rad past the limit, the leg was swung down by that, 31 to 64 cm. Now the limit
    holds only as far as the angle can be read.
  - Both limits (the hip's, and the knee's own: turned no further from the front of the leg than 1.2 rad) put
    the leg back at once, however far past the push had taken it. In a roll the push takes a knee half a radian
    past in a frame, and putting it back in that frame moved it 30 cm. Now each is taken up and let go of at 4
    rad/s as shown (8 rad/s still left 20 cm frames in the bridge rolls; at once, 39).
  - And the toes: the foot is turned round the shin as the knee's been turned, as far as that turn can be read
    (not on a leg straight, or folded tight). Read off a knee straightening fast, getting up, it came and went in
    two frames and the toes swung 35 cm. It's now an angle, changed no quicker than 10 rad/s.
  - `CONTACT.cfg`: `fold`, `hipRead`, `hipRate`, `kneeRate`, `twistRate` (all off is the old behaviour).
- After, the same measure: 3 jumps of more than 10 cm (19), none of more than 20 (13), in 1 run of 92 (11).
  Measured as what the solver adds to how fast each knee, ankle and toe moves (`legExcess()`): frames adding more
  than 20 cm 14 → 2, the most 55 → 23 cm. Overlap unchanged (18.86 → 18.67, summed over the moves); the held
  positions keep their shape; arms in their own body 0.27 cm on average. Live at 2x, 30 s: no leg jump over
  6 cm; the small hand and elbow pops (3 to 6 cm) vary from run to run with or without the change.
- Not done: in the two bridge rolls that turn a pass round (the leg freed, the knee across) the rolled man's knee
  still moves fast for a few frames, 10 to 17 cm a frame more than the keys have it, as the push and the knee's
  limit pull against each other; frames adding 10 to 20 cm are about as many as before (75 against 73: fewer of
  the big ones, more middling).
- Why there's no before-and-after video: whether the old solver jumped depends on the frame's length and on
  what played before (the limbs remember how they last turned), so a recording doesn't reproduce it on demand.
  Frames caught in the act instead: `review/p8-backtake-jump.png` (the back take with the old solver, the knee
  41 cm in a frame, and the same moments now). Video of the moves that jumped, now: `review/p8-knees.webm`.

**2026-11-08, the bridge knees** (your note: smooth the bridge knees).
- Traced (`tests/contact.js` `legTrace()`: the move's own time, the knee's speed as keyed and as shown, and
  the push split into the whole man moved and the knee's own): in the bridge turned round from the knee across,
  the rolled man's right thigh is keyed 15 to 21 cm inside the man bridging, so the contact pass holds his knee
  35 to 44 cm out from where the keys have it. From that start he also travels further across the mat than from
  the mount, and his knee goes 7 m/s as keyed (4 to 5 from the mount). As the roll goes on the push is let go of
  at up to 10 m/s on top of that: 16 m/s for three or four frames.
- Keying it differently didn't help: the rolled man's knee and foot at the 550 and 800 keys, scanned, gave
  nothing better as keyed (24.3 → 24 to 31), and the bridge from the mount, keyed deepest, has the slowest knee.
- So, in the contact pass, a limb's correction never makes it go faster than it goes as keyed, or than
  `speedCap`, whichever is quicker (7.5 m/s); and the same for the knee or elbow after the limb's been put back
  together (with the push on it held back, putting the leg back together still moved the knee 15 cm a frame):
  turned back round the line from hip to ankle towards where it was, the bones' lengths as they are. It catches
  up over the next frames. At 6 m/s it fell 80 cm behind and was in the other man more; at 7.5 and 9 no more
  than without.
- The four moves that use the bridge, each from a fresh page, four starts each: frames where the contact pass
  adds more than 10 cm to how far a knee, ankle or toe moves, 22 → 3 (the knee across turned round 16 → 0,
  the leg freed turned round 6 → 3, those three a toe); overlap 7.04 → 6.78.
- All moves, four starts each, from a fresh page: frames where the contact pass adds more than 10 cm 42 (75
  after the knee jumps, 73 before them), none more than 20, the most 14.5 cm (23); jumps of more than 10 cm
  in a frame 6, none over 20 (3 after the knee jumps, 19 before; these six are toes as the guard closes after
  the knee cut turned round and the hip bump); overlap 18.08 (18.67, 18.86).
- Not done: the guard straight to side control is now the move where the contact pass adds most (15 frames, the
  bottom man's knee as the second half ends); the toes settling after the reversals; the guard closing.
- Tools: `legTrace()`, `legExcess()` (now listing each frame over 10 cm). The 3D view needs the pane to have a
  size: hidden at zero size, three.js never loads and nothing is measured (set one with the browser's viewport).
- Video: `review/p9-bridge-knees.webm` (the bridge turned round from the knee across, two starts, and from the
  leg freed, before and now, at 0.9x, 15 ms a frame as the game draws; logged as recorded: the knee across
  before, 16.5 and 17.5 cm added in a frame, 3 and 4 frames over 10 cm; now 8.7, and 12.4 on a toe).

**2026-11-09, an audit of everything, and the first fixes from it (unfinished: stopped part-way)** (your note:
as realistic as possible, fix all irregularities and oddities).
- `tests/contact.js` `audit(name)`: standing, every strike, the clinch, each held position, each way into a
  submission, every move, one row each: in the other man, in himself, jumps, joints past their range, held up on
  nothing, under the mat, the fastest point; and the contact pass's own record of any leg it throws. Saved as
  `review/<name>.json` (`p10-audit.json` before, `p10-audit-b.json` after the first two fixes).
- Fixed:
  - Feet twisted on their shins (up to 2 rad past what an ankle turns, in the armbar, the back take, the wall
    walk, the bridges). `footInLine` never did anything: it was given heel-to-toes as they are, 20 cm long, where
    a unit vector is measured. Fixed; the knee's front is now taken from the thigh square to the shin (steady
    with the leg folded tight), and the turn is taken up at 10 rad/s, not in a frame.
  - Limbs under the mat (a sprawl's knee 11 cm under, a bridge's 8, an ankle 10): a last pass in `settle2`
    lifts a knee, elbow, ankle or fist to the mat with its bone's length kept.
  - The back and the rear-naked choke: the man in front was a table, hips half a metre up over feet planted
    under his knees, a gap under him. He now sits lower down the other man (OFF2.back and the choke's -0.22 →
    -0.34), both hips at 0.14, his trunk a little more upright, the hooks on top of his thighs (not at their
    middle, where the shins were in them).
  - The arm-triangle: the pinned arm stood straight up in the air (keyed 40 cm above his chest, where the man on
    him is). Now up beside his own head.
- Looked at and left: the head kick (reads as a roundhouse; its posture flags are the measure's).
- NOT verified: the full audit and `popsMany()` after the back's new pose and the ankle changes; the moves into and
  out of the back (`backRoll`, its reversal) against the new pose; one run in four showed a 51 cm knee jump in
  half guard to side control that didn't come back when traced (the mat pass is the suspect: it isn't in the
  contact pass's record).
- Not done, in order: the stuffed shot (the sprawl puts the defender flat under the shooter, down in 180 ms and
  both up again 400 ms later: planned as a `shootStuffed` clip to the `sprawled` pose, a sprawl pose with the
  chest over the shooter's back, 1.1 s in all, `cam.hold` to its end); the guard closing through the man on top
  after four moves; toes jumping as the guard closes; half guard's bottom arm over the top man's back; the
  triangle's, armbar's and kimura's hips folded past what a hip does; the guillotine's shoulders; hips splayed
  0.2 to 0.3 rad past range on top in the mount, half guard and side control; the body-lock trip's toe at 135
  ms (20 m/s).

**2026-11-10, the audit carried on.**
- The four fixes above verified by a full audit (`p10-audit-d.json`); the back and the choke went from the worst
  of the held positions to among the cleanest.
- Fixed since:
  - The stuffed shot. The sprawl put the defender flat on the mat under the man shooting, down in 180 ms and
    both up 400 ms later. Now: a `sprawl` pose with the hips back and the chest over the shooter's back, then
    `sprawlHeavy` as his weight comes down; the shooter plays `shootStuffed` (the same way in, then pressed down
    to `sprawled`, held, and backs out); 1.1 s in all, the next thing held off until they're nearly up
    (`cam.hold`). `review/p10-sprawl.png`.
  - The body-lock trip: the tripping man's left foot spun a whole turn in the first 240 ms. Its turn had come to
    5.98 rad, a turn up from the 0 the move's next key names, and it went there the long way. In a change of
    position each key's turning channels are now taken the short way round from the key before (`compile`).
  - The triangle: the hips curled up under the legs (pelvis -0.85 → -1.55, the spine rounded to match): the
    thighs were folded a radian past what a hip does; now 0.3 to 0.5.
  - The guillotine: the elbows out to the sides (pointed up and back, the upper arms were 0.8 rad behind him,
    into the mat, and 17 cm into his own body at worst): nothing past its range, nothing in himself.
  - The mat pass: an ankle under the mat is raised straight up and the knee bent to suit (swung out along the
    floor from the knee, a shin pointing down threw the ankle 54 cm sideways: the 51 cm jump noted above).
  - The audit's ankle measure: the knee's front as the figure takes it, and only feet square to their shins
    (a man sitting on his heels read as having his feet on backwards).
- Measured now: the audit's total 559 → 413; jumps of more than 10 cm in a frame over 92 runs (`popsMany`) 0
  (6, and 19 before the knee work); frames with more than 10 cm added to a leg 52, none over 20; overlap over the
  moves 17.98 (18.08); nothing under the mat.
- Tried and left: the armbar's and kimura's hips the same way as the triangle's (no better, or the shoulder
  worse).
- Not done: the armbar settles into one of two shapes depending on what came before (in one, a hip folded 1.9
  rad past range, held); the moves into the armbar; fast legs in the bridge from half guard and the back take
  (10 to 18 cm a frame added for a few frames, at the cap); the top man's hips 0.2 to 0.3 rad wider than a hip
  opens in the mount, half guard and side control; half guard's bottom arm over the top man's back; three toes
  moving 8 to 11 cm in a frame as the guard closes.
- Video: `review/p10-fixes.webm` (the stuffed shot, the body-lock trip, taking the back, the choke, the
  triangle, the guillotine, the arm-triangle; real speed then half).

**2026-11-15, the hip measure was wrong, and the submissions it was hiding.**
- The armbar was the audit's worst row: a hip "folded past the chest" 1.9 rad past range, held every frame.
  A frame-independent check (the angle between the thigh and the torso) put it at 52 to 64 degrees, the same
  ballpark as the closed guard at 102 to 107: the bodies were fine and the measure was lying. `posture()` read
  the hip in the pelvis's own frame, and the pelvis tips with a man who lies back, so the measure turned over
  and every armbar, triangle and guard underneath came out 1 to 2 rad past what a hip does.
  - Rewritten: flexion is the angle from the torso's own down axis (hips to chest), 0 straight down the body and
    pi flat on the chest. It can't wrap, so the "past the chest" case is gone. Which side he's on only tells
    flexion from extension, and only while the leg is near enough to straight down for behind to mean anything;
    the chest's forward says which way he faces, since the pelvis's can be twisted off it. Limit 2.3 → 2.45.
  - And the splay limit now goes with the fold: a hip opens about 55 degrees with the leg straight down and 70
    to 80 folded up (knees by the ribs in the mount, or sitting cross-legged), so `hipOut` + 0.45 at full fold.
    That clears the mount, half guard and side control, which were flagged 0.2 to 0.3 rad over for months.
  - Checked the triangle fix from the last round against the corrected measure: the old hips read `hip back`
    2.64 and the new ones 0.51, so that fix was right and stays.
- Fixed with the measure honest:
  - The armbar's left knee bent sideways 1.5 rad past what a knee does (the foot dragged up to the opponent's
    head, the knee hint pointing out to the side): the knee now points up the way the leg bends. It costs about
    1.5 cm of overlap and the same in self-overlap, against a knee folding the wrong way.
  - The kimura's reaching arm put the upper arm behind him past what a shoulder goes (the elbow hint carried
    over from the guard): elbow down and out.
- Measured: the audit's total 413 → 308 (559 when the audit started). Every held position is clean or nearly:
  the worst left is the guillotine's thigh 2.4 cm into the other man. Jumps over 10 cm in a frame, over 92 runs,
  3 (0 last round, 19 at the start). Overlap over the moves 19.60 against 17.98, within this measure's usual
  swing between rounds and from changes that don't touch the moves.
- A warning for later: running `worstMany()` straight after `audit()` in the same page reads about 5 cm high
  (25.07 against 19.60 on a fresh page). The audit leaves the figures mid-position; give it its own load.
- Not done: knees turned about 1.8 rad past range for a handful of frames mid-roll in the bridge reversals
  (`knee across reversed`, `leg freed reversed`) and an ankle in the way into the armbar; the armbar reads as a
  man lying on his side with his legs up rather than draped over the opponent, which is a rebuild of the pose
  and its grips, not a tweak; half guard's bottom arm over the top man's back; the wall walk's shoulder.
- Frames: `review/p11-subs.png` (the armbar, kimura, triangle and guillotine as they are now).

**2026-11-15 (later), the fight view switched on, and the armbar rebuilt.**
- **The game was showing none of this.** `FV.fig2`/`FV.fig3` were both false unless you put `?fig3` in the
  address, so a fight watched the ordinary way — career, fight card, Spectate — drew the old flat side view.
  Every figure, contact and position change in this file has been invisible in normal play the whole time.
  Both now default on: the 3D octagon is the fight view. `?fig2` still gives the figure drawn from the side and
  `?flat` the rig before either, and if three.js can't load the side view carries on as it always did.
  Checked by playing it the way a player does: main menu → Continue career → Fight cards → Spectate → the bell,
  with the octagon, the round clock, the stats and the commentary all running and no errors.
- The armbar rebuilt, pose and grips:
  - The legs are draped over him now. The grips put each foot on his *near* surface (`out: FRONT`), so the legs
    stood straight up on his chest; they now carry the foot past him to his far side and 20 cm down (`out: BACK`
    with a drop), so the thigh lies across him and the foot hangs down the other side. The opponent's own frame
    has to be used for this, not the attacker's (`outMe`): the attacker is lying down, so his own forward points
    at the sky and "the far side of him" came out wrong.
  - The knee over the face no longer bends sideways (the knee hints point up the way a knee bends), and the
    attacker's right elbow is down and out instead of back past the shoulder.
  - The defender's posture is broken: sat back on his heels, hips down, chest folded over the trapped arm. He
    was kneeling bolt upright with his head 93 cm up, so the legs coming over it had to climb most of a metre —
    that, not the keys, was what bent the knee 1.5 rad sideways. Folded right down he arched over the man like a
    bridge, hips high and head under, so this is the middle of the two.
  - Measured: `into: armbar` 18.6 → 7.9 and `held: armbar` 13.1 → 4.0 on the audit's score; the held position is
    0 cm into the other man and 1 cm of self-overlap, with one knee 0.6 rad over.
- Audit total 317 against 308, jumps over 10 cm still 3 of 92 runs: the armbar's 20 points of improvement are
  offset by the usual run-to-run drift in the move rows, which moves 3 to 8 points either way between passes.
- A note on the audit's `fast` column: a held position can read 30 m/s when the stance mirrors and the left and
  right limbs trade names. The jump counter already allows for that; `fast` does not.
- Not done: the armbar reads as a broken-down tangle rather than an unmistakable armbar — the thighs sit across
  his belly rather than clamped on the chest with the arm visibly between them, which needs the attacker placed
  perpendicular at the shoulder (`SUBFAM.armbar.off`, and an `across` like side control's) rather than under him.
  Also still open: knees turned mid-roll in the two bridge reversals, half guard's bottom arm over the top man's
  back, the wall walk's shoulder.
- Frames: `review/p12-armbar.png`.

**2026-11-15 (later still), striking distance and moving round the cage** (your note: strikes thrown at the
wrong distance, kicks from close range, and the movement needs to be faster and more fluid).
- Measured first, over two minutes of live fighting, logging every strike with the distance between the two
  men at that moment: **every strike in the fight landed between 1.30 and 1.50 m**, kicks included, and all 25
  kicks were thrown in `pocket`. Movement came to **0.30 m/s** between them.
- Why: the drawn spacing for `pocket` was `clamp(dm, 1.22, 1.38)` — a fixed arm's length whatever the engine's
  own spacing was (its median was 1.81 m, so the clamp was throwing that away). And the engine only moves them
  once a `SECS_PER_TICK`, which is 3 s, about 0.4 m a man: between moments both targets stand still.
- Changed:
  - Spacing now follows what's being thrown. Hands pull them together (any range, not just from outside: a
    punch from 1.4 m finished 49 cm short of him, from 2 m nearly a metre); a body or head kick stands them
    off, on a stiffer spring so the room opens inside the kick's own wind-up; otherwise they sit at the
    engine's spacing, between punching and kicking range. Leg and calf kicks are left close, as they are in a
    fight.
  - A strike carries the body further into it (`far` 0.3 → 0.42 for hands, 0.45 → 0.5 for feet): a man steps
    into a punch rather than standing and reaching.
  - Steps are longer and quicker (reach 0.32 → 0.43 m, 316 → 220 ms for a good mover), start on a 3.5 cm
    error instead of 6, and small corrections glide in 260 ms instead of 500.
  - Restless feet (`fighters3`): between engine moments the pair circles its own middle and works in and out,
    a little under two tenths of a radian and 8 cm, scaled by the better mover's footwork and killed off while
    either man is busy, rocked or empty. The engine never sees it — it reads the spots it set — so nothing
    about the fight changes, they just stop standing still.
- Measured after, standing frames only: movement **0.30 → 1.10 m/s**; the distance between them **1.15 / 1.42 /
  1.68 m** at the tenth, half and ninetieth (it was pinned between 1.32 and 1.38); punches land at 1.10 to 1.27,
  leg and calf kicks at 1.17 to 1.21.
- Not verified: the body-kick stand-off. Only 3 body kicks came up in the sample and they still read 1.23 m,
  so the stiffer spring hasn't been shown to open the space in time. Head kicks didn't come up at all. Also
  unverified: how any of this looks in motion — the numbers are right but I haven't watched a full exchange,
  and the punch still finishes about 20 cm short of the head's middle (0.38 against an ideal 0.18), so hands
  may still look a touch short.

**2026-11-16, fluid feet and blows that land on something** (your note: more fluid footwork and movement, and
the striking more tangible).
- Checked the reach worry from last time first, in a controlled stand rather than mid-fight: at 1.1 m the
  strikes do arrive — jab 6 cm from where it's aimed, hook 3, body kick 9, head kick 9; the cross and the body
  punch are 15 to 17 cm short. So the hands were never the problem, the distance they were thrown from was,
  and that is fixed. (A `legKick` reads 35 cm but that is the measure aiming at the wrong leg, not the kick.)
- Fluidity: the feet stopped dead for the whole length of anything either man threw (`busy` in `stepper3`
  blocked stepping outright), and with a punch in the air much of the time that is what made the movement
  stutter. Now he keeps drifting where he was going while he throws — a drift, not a catch-up. The first try
  used a 520 ms constant, which closed the gap so well that he never had enough error left to take a real step
  with when he was free again: movement fell from 1.10 to 0.23 m/s, smoother and much slower. At 1400 ms it
  does what it should.
- Tangibility: a landed blow now catches the picture for a beat from 3.5 damage rather than 7 (and up to 110 ms
  rather than 75), shakes it from 6 rather than 9, and what it lands on actually moves — the head's own snap
  was a hundredth of a radian, which is nothing; it and the other reactions are roughly doubled.
- Measured over a live fight, standing frames only: movement **0.86 m/s** (0.30 before any of this), the
  distance between them **1.15 / 1.40 / 1.67 m** at the tenth, half and ninetieth, and the picture is held for
  **3.2%** of the fight, which is a beat on a hit and not a stutter.
- Frames: `review/p13-impact.png` — a cross, six moments through it from two sides: it arrives on the head at
  195 ms, stays there, and his head is turned away by 420.
- Not verified: how the heavier reactions read over a whole round (I checked one cross frame by frame, not a
  sustained exchange); whether the 3.2% hold feels right at the slower watching speeds; and the body-kick
  stand-off from last time is still unproven — body kicks remain rare enough in a sample that I have not seen
  the stiffer spring open the space in time.

**2026-11-16 (later), the double kick, the vanishing knockdown punch, and what the feet are really doing.**
- **Two kicks at once, fixed.** A second strike by the same man started at 0.62 of the clip before it, whatever
  the limb. For hands that is a combination; for legs it is impossible — a body kick was followed by a calf
  kick **254 ms** later, before the first had landed, and the pair read as one odd double-kick. A kick (or a
  knee) now has to finish before the next strike starts. After: no kick-to-kick pair inside 400 ms anywhere in
  a fight, `legKick -> jab` at 353 ms, and punch combinations still tight at 131 to 176 ms.
- **The knockdown punch, fixed.** A strike clip was thrown away the moment its man stopped counting as
  standing (`ON_GROUND[C.ref] === o.stand`), and a knockdown puts the fight on the ground the instant it lands
  — so the punch that caused it was dropped halfway through and the attacker was seen doing nothing at all.
  A strike already in the air now finishes through the change. Checked by firing a cross and dropping the
  fight to the ground 105 ms in: the fist travels 0.71 m after the switch, where it used to stop dead.
- **The feet.** Measured over a live fight before changing anything, in each man's own frame: the feet **never
  cross** (0% of frames), the planted spot is **perfectly still** (0 m/s), and the stance keeps its shape
  (width 0.46 to 0.61 m, front-to-back 0.33 to 0.51). The 13 cm "gap" that looked like sliding in the first
  measurement was mine, not the game's: the plant tracks the *ball* of the foot, which sits about 13 cm ahead
  of the ankle, so the ankle turning about a planted ball reads as slide unless you allow for it.
  - Changed what the measurements did support: a foot catches up on a 7 cm error rather than 10, and the foot
    that moved last gives way to the other when both are out — picking "whichever is worst" let one foot walk
    while the other dragged behind it.
- Live after all of it: movement 0.84 m/s, distance 1.13 / 1.40 / 1.68 m — both unchanged, so none of this
  cost what the last round gained.
- Not done: this is **not** the omni-directional foot system you asked for. I measured the existing one before
  rewriting it and it already places feet in any direction, keeps the stance and never crosses, so I tuned it
  rather than replacing it. If the feet still look wrong the fault is somewhere my measurements don't reach —
  most likely the body gliding between steps rather than the steps themselves, which would mean driving the
  body *from* the footfalls instead of the other way round. That is a real rewrite and worth doing only once
  we know it is the thing you are seeing.

### Micro steps, pace and the double kick

The guess at the end of the last round was right: the fault was the body gliding, not the steps. You said the
fighters were "doing micro steps in the direction they're moving", and the measurement agreed — **598 steps a
minute, a median stride of 9.9 cm, 42% of them under 8 cm**, better than ten footfalls a second. It was my own
restless-feet code doing it: the offset drifted on a pair of sine waves, so the target crept away a centimetre
at a time and the feet spent the fight catching up to it. Nothing was ever far enough away to be worth a step,
and everything was far enough to need one.

The fix is that the offset now **sits still and then jumps**, in a direction he holds for a few beats before
switching. There is ground in each beat, so there is a step in it, and then a pause. Alongside that:

- A step has to be **worth taking**: under 14 cm he shifts his weight instead and the error is left to build,
  and the leftover is leaned onto slowly rather than quietly swallowed before a step can gather in it.
- A planted foot stays planted inside **12 cm** rather than 7. Loading up onto a foot is what a weight shift
  looks like; re-planting for it is what the shuffling looked like.
- About **twenty degrees of turn** he takes in the stance. Below that a pivot was firing after every single
  travelling step, once both men had moved and the facing had shifted again — 112 pivots a minute, a step and
  then a twitch.
- The beat is **jumped, not eased**. Easing spread one beat's ground over about 400 ms, which the stepper broke
  into two or three short steps: the cadence was right and the stride was still 16 cm.

| | before | after |
|---|---|---|
| steps a minute | 598 | 260 |
| median stride | 0.099 m | **0.332 m** |
| under 8 cm | 42% | 14% (all of them pivots, which are pure turns) |
| over 25 cm | — | 63% |
| steps a second, each man | 5.3 | **2.1** |
| movement | 0.84 m/s | 0.70 m/s |

Movement reads lower because the old figure counted the drift: a man wiggling on the spot covers ground on
paper. 0.70 m/s in real strides is more travel than 0.84 m/s of shuffle.

**Pace by situation**, which you also asked for. How quick a step is now comes from how much he wants to be
somewhere — his game plan's mentality, the opponent's footwork, whether he's at range or in the pocket, and
whether he's rocked — on top of his own footwork and tank:

- at range **208 ms** and a 37 cm stride; in the pocket **157 ms** and 28 cm. Longer and more measured outside,
  sharper and tighter inside.
- between men in the same fight: a presser with good footwork steps at **142–147 ms**, a patient range fighter
  at **232–266 ms**. Close to a two-to-one spread.

**The double kick.** The last fix only spaced strikes inside one combination, and the pairs you were seeing
crossed between them — the engine hands out its strikes a moment at a time and knows nothing of the moment
before, so a kick at the end of one and a kick at the start of the next arrived 426 ms apart: the second leg
went up while the first was still coming down. A kick now waits until the leg it needs is back under him and
his weight is over it, with the beat varied so a real flurry doesn't come out as a mechanical tattoo. Over a
minute of fighting: **six offending pairs before, none after**.

Checked while I was in there, since you asked for footwork that doesn't break the stance: the feet **cross on
0.3% and 1.4% of frames**, all of them mid-swing, and the settled stance (0.68 m) matches the moving stance
(0.69 m), so the wider plant threshold is not stretching it. Circling cannot walk a man into the fence either —
it gives way as he runs out of room, and over a minute **no frame** put anyone past it.

### Audit round: armbar, wall walk, and a runaway

- **Armbar rebuilt again.** Measured rather than eyeballed, and it showed the two men were simply side by side:
  hips 53 cm from the elbow they were meant to lever on, both arms bent ~60 degrees, the defender sitting up.
  Now laid out across each other (`SUBFAM.armbar`, `across`), the attacker's hips bridged up, the defender folded
  over the arm, and the trapped hand carried up to the neck so the arm is straight. `into: armbar` 36.8 -> 9.3,
  `held: armbar` 3.2-3.8 (it read 13-15 in two later runs; noise band, not a regression).
- **Wall walk and technical stand-up:** `bot>clinch` had no transition, so getting up into the clinch was a plain
  interpolation with both shoulders swinging behind him. It now uses the stand-up climb. Wall walk 13.5 -> 9.4,
  technical stand-up 9 -> 4.8, float gone.
- **A real bug found on the way:** every ease in the picture is `1 - exp(-dt / t)`, which is a push *away* from
  the target when dt is below zero. A clock stepping backwards (a tab resuming, or the test's clock against the
  page's own) sent the figures 10^19 to 10^68 metres off the mat. `dtReal` is now floored at zero, `rest.w` is
  clamped to 0..1, and camtest drives the page on a single clock.
- Totals this round: 191, 229, 260 across runs (308 before); noise band is roughly +-35 on the total. Nothing under
  the mat. Still open: knees turned mid-roll in the bridge reversals, double-leg's shoulder, half guard's bottom arm.

### The audit was scoring the run order, not the animation

The useful find this round was in the measuring, not the animation. Each situation set its own starting
position but inherited everything else from whatever ran before it — strikes still in the air, where the feet
were, the restless offset, the hit-stop. The same situation scored **4.1 on its own and 20.5 run after the
rest**, which sent me hunting for a fault in a clip I had already fixed. `audit()` now clears the figures and
settles to standing before each situation. Jumps over 8 cm across the whole audit went 12 -> 3 on that change
alone, which is how much of the "popping" was the harness.

That invalidates a measurement I had already acted on. I read the rolls and reversals as 67.2 -> 38.9 from
raising `CFG.kneeRate` 4 -> 8 and wrote it up as a fix. Measured properly it is **79.6 at 4, 75.4 at 8, 74.7
at 13**, with no jumps at any of them, and runs vary by about as much as the gaps between them. I kept 8 —
the direction is consistent across both comparisons and holding the knee in shape through a roll is right on
its own terms — but it is a preference, not a result, and the knee turning mid-roll is **not fixed**.

- **Double-leg (a real fix).** The man being taken down threw his hands behind him as he landed (`handL/R`
  forward -0.05 at the 700 ms key) while the grip on the shooter's chest released, wrenching the shoulder
  0.79 rad past where one goes, for 30 frames. Hands now go slightly forward, as they do in a fall: the
  shoulder break is gone and the situation went 24-32 -> ~10, holding at the same figure isolated and in the
  full run.
- Full audit with the reset: **221 total, 3 jumps, nothing under the mat, standing clean at 3.5.** The field is
  flat — everything between 9 and 16, no outlier left.
- Still open: knees turning mid-roll (above), the wall walk's shoulder (11.4), `into: armbar` (10.6), and half
  guard's bottom arm. None of them dominates, so the next one is a judgement call rather than an obvious target.

### Striking distance, and facing

Two faults, both mine, and both from earlier rounds of this work.

**No maximum on striking distance.** There were two spacing flags — close for hands, wide for round kicks —
and a low kick matched neither, so it fell through to the range spacing and was thrown from wherever they
happened to be. Measured over a round: kicks landed at a median 1.59 m and up to 2.25, punches up to 2.04,
with a jab landing at 1.98 and a leg kick at 2.25. Nothing capped it.

Every blow now carries a band, a floor *and* a ceiling, because thrown from beyond the top of it the limb
simply finishes short of him: hands 1.02–1.3, low kicks 1.24–1.62, round kicks 1.48–1.8, knees 0.7–1.02. The
band opens just before the wind-up and the spacing spring is stiff while one is in the air.

The other half of it was the restless footwork. The in-and-out moves each man along his own radius, so the
gap between them changed by *twice* it — at ±0.4 m they opened and closed by 80 cm on their own, on top of
whatever the fight asked for. That is how a leg kick came to be thrown from three metres. It is ±0.13 now
and gives way entirely while a blow is in the air.

| at impact | before | after |
|---|---|---|
| punch | median 1.44, max **2.78** | median 1.50, max **1.81** |
| low kick | median 1.59, max **2.46** | median 1.48, max **1.82** |
| round kick | — | median 1.78, max **1.99** |
| strikes landed past 1.9 m | common | **1 of 77** |

**Losing the man in front of them.** Two causes. The picture showed up to half a radian of the engine's
off-square, and the engine squares a man up at its own rate — about a fifth of a radian per three-second
moment — so being turned persisted for seconds. And facing was carried by the step: the heading was read
once as a step began and interpolated to, so through a step or a punch he was aimed where the other man had
been. Tying it to the step threshold also held him up to 22 degrees off until a step was worth taking.

Facing is now continuous and never waits — turning the stance on the balls of the feet costs a fighter
nothing — and the picture shows a fraction of the engine's off-square rather than all of it. The error ran a
median of 19.5 degrees and over 20 degrees for **half of all frames**; it is now a median of 11.5 standing
and 12 while busy, over 20 degrees for 14% and 23%. Most of what is left is the deliberate blading, which is
right. Being badly turned is now rare and brief, which is when it happens.

Footwork is unchanged by it: median stride 0.30 m, 2% under 8 cm, 3.3 steps a second each, no double kicks.

**Pause now stops the fighters.** The engine stopped when you paused but the picture did not, so the two of
them carried on circling, shifting their weight and taking steps on a frozen round clock. The picture's clock
already had a way to stop — it is what holds the frame for a beat on a heavy blow — so pausing uses it.
Nothing that runs off `dt` or `vnow` advances while it is zero: footwork, the spacing spring, the restless
feet, a clip half played. `warp` swallows the real time that passes, so everything picks up mid-stride where
it left off. Measured through pause, resume and pause again: movement is exactly 0 while paused, and the same
as before on resume.

**A measuring failure worth recording.** The dev server was still serving the old session folder, so the first
three rounds of "fixes" this session were measured against a build that did not contain them. The numbers
moved anyway — run-to-run variance between fights is large enough to look like progress — and I reported
improvements that had not happened. Check what the server is actually serving before trusting a number: fetch
the page and grep it for the change.

### The ground: what was wrong, and what the guard actually was

The guard not enveloping turned out not to be the guard. Measured on entering closed guard, the ankles sat
25 cm apart where the pose and the grips put them 4 — but a time course showed it **settles by about 1.3 s**
and then holds (gap 6 cm, ankles 18 cm from his waist, hips 39 cm apart) for as long as you watch. My earlier
single readings at 2.5 s were landing in the transient and in solver state left over from the position
before. Rendered settled, the closed guard wraps correctly.

Two false starts, both measured and reverted. Exempting gripped limbs from self-collision did not close the
gap and let a forearm sink 13 cm into the man's own body. A `hug` factor that let a gripped limb press into
the other man was no better: the knees moved 2 cm and the ankle gap got worse. The knee position in a closed
guard is **forced by geometry** — with the ankles crossed behind his back, a leg 83 cm long has to bow about
35 cm out. It was right all along.

What was actually wrong, and is now fixed:

- **Half guard** read as a sprawl. The top man's free leg was posted 62 cm behind him with the knee nearly
  straight, so he lay flat and long over the man instead of driving his weight down. Leg in to 44 cm, knee
  bent under him, hips lower. 6.3 -> 1.1.
- **Mount** had the knees poled a full 1 to each side, so they sat wide of the man underneath — the knees are
  the thing that pins him. In at his ribs now.
- **The back take from the mount**: the bottom man's feet were keyed once at 350 ms and left there while his
  pelvis went on turning from 1.1 to 1.4, so the foot stopped matching the shin and the ankle read as twisted
  a whole 2 rad. The feet come round with the hips now. 19 -> 9.6, and `back take denied` 12.2 -> 4.6.
- **Rear-naked choke** (previous round): both of the defender's elbows were poled behind him, wrenching both
  shoulders 0.6 to 0.8 rad past range for over a hundred frames.

Held positions now score: closed guard 0.1, half guard 1.1, side control 0, mount 3.1, back 2.8. Whole audit
230 with **one** single-frame pop and nothing under the mat.

**`CFG.kneeRate`, settled properly.** Last round I raised it 4 -> 8 on a reading I then had to retract as
run-order noise. Re-measured with the audit's reset in place, on the rolls and reversals: rate 4 gives 72.5
total and 8.39 of knee-turn, rate 8 gives **65.0 and 4.57**, rate 20 gives 92.6 and 6.62 with a pop. 8 is the
sweet spot on both counts, so the change stands — this time on evidence.

### The knee through a roll: a limit chasing a number that wasn't there

`knee turned` was the top complaint in six of the seven worst situations and swung wildly between runs. It
was neither the pose nor the rate limit, and three guesses were wrong before the trace settled it.

`legTrace` through a bridge and roll, on the leg it flags, reading the knee's angle from the front of the leg
frame by frame:

```
t1035  anat 0.69,1.2,0     bend 1.2cm      ← within the limit, nothing to correct
t1050  anat 0.95,1.2,0     bend 1.7cm
t1065  anat 1.64,1.2,-0.12 bend 4.0cm      ← 0.69 rad in one frame: 43 rad/s
t1080  anat 1.8,1.2,-0.24  bend 8.7cm      ← needs -0.6, the rate limit allows -0.24
t1095  anat 1.39,1.2,-0.19 bend 6.8cm
```

The angle is measured **round the line from hip to ankle**. At that moment the leg is folded to 23% of its
length, so that line is a few centimetres long and its direction swings with every centimetre the foot moves.
The angle it gives is mostly noise — and the correction chasing it was twitching the knee 4 to 9 cm a frame.
That is the visual fault: not a knee bent the wrong way, but a knee being shaken by a limit arguing with a
measurement. Rendered close at the flagged frames, the figure was already fine.

This explains everything that didn't add up. `kneeRate` 0 made it worse (90.9, movement spiking to 31.5) and
20 worse again, because neither the correction nor its absence was the problem. And the scores swung run to
run because the number being scored was unstable.

The limit now eases off as the leg folds, the same way the hip's limit already holds "as far as the angle can
be read". Full above 40% extension, nothing below 18%. The test got the same guard, since it was measuring
the same unreadable angle and reporting a fault that wasn't on screen.

| through the roll | before | after |
|---|---|---|
| knee moved by the limit, per frame | 4.0 / 8.7 / 6.8 cm | **2.1 / 2.7 cm**, 0.1 elsewhere |
| worst angle reached | 1.8 rad | **1.35** |
| audit total | 230 | **203** |
| knee-turn across the audit | 4.57 | **1.16** on the rolls |

Standing is untouched: a leg under a man is 80 to 100% extended, where the weight is 1 and the limit holds in
full. The one place it still reads high is a head kick (1.77), where the leg is extended and the measure is
readable — a different question, and the kick looks right.

**`tools/embed_clips.py` was broken on this checkout.** It anchors on `;$`, and cloning the repo on Windows
turned every line ending into CRLF, so `$` sat before the `\n` and never matched the `;\r`. The tool failed on
a fresh clone of its own repo. It keeps the line's own ending now, and strips `note` wherever it sits — the
ones nested in a key's `top`/`bot` were riding along into the game (1.8 KB of them).

### Ground and pound: what each position is worth, and the arm that threw it

Ground and pound was one thing with one damage number scaled by the position. It is not one thing. What a man
can throw, and what it is worth, is most of what separates these places on the mat:

- **full guard** — his hips are held and his posture broken, so nothing has his weight behind it. Short
  punches; an elbow needs an angle the guard will not give him. The least damaging top position in the sport,
  and the reason referees stand it up.
- **half guard** — base enough to post, drive the shoulder in and free an arm. Elbows start to work.
- **side control** — chest to chest and square across him. The elbow is the weapon: short, heavy, landing on
  a head that cannot move away from it. Punches have no room to travel.
- **mount** — posture up and drop them with gravity behind. Where fights are finished.
- **back** — no angle on the head at all; the hands go round the side of a face he cannot square up to. He is
  there for the choke. A punch from the back is a nuisance.

Measured over 300 fights, damage per landed strike:

| | elbows thrown | per landed | elbow | punch |
|---|---|---|---|---|
| back | 8% | **1.12** | 1.94 | 1.05 |
| full guard | 15% | 1.90 | 2.22 | 1.84 |
| half guard | 42% | 4.30 | 5.12 | 3.68 |
| side control | 65% | 5.54 | **6.92** | 2.89 |
| mount | 43% | **8.03** | 9.12 | 7.18 |

Back control was on 0.9 for ground and pound, near mount's 1.3 — a choking position doing nearly a mounted
man's damage. It is a seventh of the mount now, and side control's elbows are worth 2.4 times its punches.
The finish mix is unchanged at 49% decisions, 29% KO/TKO, 21% submission.

**The arm that threw it.** Checked by firing flurries from all five positions and watching the limbs: on
every ground punch the striker's shoulder went 0.86 rad past where a shoulder goes, held through the whole
cock — about 120 ms of each strike. The hand was being carried *behind* the chest to cock (`handR` forward
-0.05) with the elbow poled back, when it should go up round the outside. Cocking up and out, with a key
added where it was swinging through the back of the shoulder, leaves a 20 to 30 ms transient at the top — one
or two frames, where the arm is genuinely out to the side and the measure is reading a face-down torso's
chest frame. Full guard and back control come out clean. Rendered, the strike reads correctly throughout.

The legs are untouched by it: the strike clips layer over the position's own pose, so throwing from half
guard does not pull his legs into a mount shape. (Worth saying because the clip is referenced to `mount` and
I assumed it did until I traced the knees through one — they do not move.)

### A man on an empty meter, and a knockout nobody threw

From a Volkov–Ngannou fight: Ngannou's body meter sat on 0 for a long stretch while the fight went on, his
gas was nearly gone, and then he fell over and was knocked out by a body shot that was never thrown. Two
separate faults, both real.

**The meter was lying.** The gauges are the engine's own numbers on a curve, and the comment above them
claimed "zero on the screen is zero in the engine". Rounding broke that at the bottom. The body gauge is
squared and the head's cubed, so they round down to nothing well before the fight can end on them:

| | engine ends the fight at | screen already reads 0 from | how much of the fight that is |
|---|---|---|---|
| body | 200 damage | **186** | a dozen more body shots |
| head | 400 damage | **331** | a seventeenth of a man's whole head durability |

So a fighter genuinely could sit on an empty body meter for a long time with the fight continuing — the
meter was wrong, not the stoppage. A gauge now shows 0 only when the engine gauge behind it is actually 0,
and at least 1 until then. Checked against the engine across the range: 186 damage shows 1 where it showed
0, 199 shows 1, 200 shows 0.

**The knockout nobody threw.** There was a rule that ended the fight the moment a man's energy reached zero —
`finish(opponent, 'TKO', 'Exhaustion')` — with no strike involved. On screen he simply fell over and it was
over, and his opponent was credited with a stoppage for a shot he never threw. It is also not how fights
end: a referee stops a fight when a man is being hit and not answering, which `refCheck` already does on
every landed strike and which already treats an empty tank as reason to look harder; and a corner pulls him
out between rounds, which also already exists. The rule is gone. Over 300 fights, Exhaustion finishes went
**5 to 0**, and those fights now end by strikes or go to a decision — the method mix is unchanged at 49%
decisions, 29% KO/TKO, 21% submission. A man who is merely exhausted keeps going and loses.

The referee also watches a man being beaten to the body now, not only to the head: `refCheck` ran at the end
of the head path only, so an exhausted fighter folding up under body shots — exactly this fight — could not
be stopped that way.

Worth noting this was partly my own doing: cutting between-round and in-round recovery the round before made
empty tanks more common, which made a bad rule fire more often.

### Pace: bursts and lulls, and combinations that run past two

The fights were being thrown at one even rate from the first bell to the last, which is the pace of a very
analytical fighter and of nobody else. Measured over 120 fights, 797 standing minutes:

- **9.4 strikes thrown per man per minute** — that part was fine; the UFC runs about 8 to 11.
- **60% of three-second moments had no strike in them**, spread evenly across every round.
- **Combinations: 40% single, 57% double, 2% of three, and none of four.**

The last one had a cause, not a tuning problem. `combo()` capped the `light`, `kick` and `counter` styles at
two strikes, and the jab and the kick are the two commonest things a man does — so the third shot was thrown
away before it was rolled. A jab-cross-hook is the most ordinary sequence in the sport and it could not
happen. The cap is now three for a jab-led or countering sequence (kicks still stop at two: nobody throws
four), the third shot's odds went from `0.08 + 0.15 × speed` to `0.17 + 0.26 × speed + 0.1 × boxing`, and
there is a fourth for the quick and the busy, or on a man already hurt.

For the rhythm, the fight now has a **heat**: one number for the pair of them, because a firefight is
something two men do together — one opening up is what makes the other. It settles back towards the fight's
own level and gets kicked out of it: a flurry where both let go, a feeling-out spell of feints and feet, a
floor when a man is hurt, a floor in the last half-minute of a round, and a floor that rises the longer
nothing has been thrown — without that last one, quiet spells ran to 19 moments, nearly a minute of two men
not throwing at all.

| | before | after | real |
|---|---|---|---|
| thrown per man per minute | 9.4 | 11.2 | ~8–11 |
| landed per man per minute | — | 4.6 | ~3.5–4.5 |
| combinations of 3 | 2% | **15%** | — |
| combinations of 4 | 0% | 2% | — |
| spread of strikes per moment (sd) | 1.19 | 1.43 | — |
| longest unbroken busy spell | — | 19 moments (57s) | — |

The base action rate came down to pay for it, so a man throws about as much over a round as he did — he just
throws it in bursts instead of a steady drip.

**It cost something that had to be paid back.** Clustered flurries mean a hurt man eats three shots where he
used to eat one, and the finish rate went from 29% of fights to 38% on its own. `TUNE.shock` is 1.45 rather
than 1.66, which brings it to 33% KO/TKO, 25% submission, 42% decision against a real split of roughly
30/20/50. The pace is what was wanted; the knockouts following from it were not.

In the picture, punches in a combination overlap by about 100 ms — the second hand leaving as the first comes
back, which is what makes a combination read as one thing rather than three. The kick spacing guard still
holds: no two kicks closer than 300 ms across a whole fight.

### A range of motion, in one place (2026-11-19)

Every limit an arm or a leg is held to now lives in one table, `FIG.ROM`, instead of being spread between
four constants in the solve and a separate table in the tests. The knee's turn was written in both places;
the shoulder was **only** in the tests, measured but never enforced. That is why pose after pose in `POSES`
carries a hand-written note about an upper arm going half a radian past where a shoulder goes — the
rear-naked choke, the guillotine, the armbar, the kimura were each patched by hand, one at a time, by
nudging an elbow pole until the complaint went away. With nothing enforcing the joint, every new move would
have needed the same treatment, which is why this had to come before adding any.

**The shoulder is held on the elbow's pole, not on the hand.** The rule is the one the tests already used:
the upper arm stays no more than `ROM.shBack` (1.0 rad) behind hanging straight down, in the chest's own
forward/up plane. For a given hand the bend angle is fixed by the bones, so that rule works out to a cone
the elbow's pole has to stay inside — which is the existing `within()` helper with a limit computed each
frame instead of a constant. An arm straight out to the side sits exactly on the boundary, so full reach
out to the side is untouched and only the forward/back of it is held.

Two other ways were built and measured first, and both were worse:

- **Turning the whole arm about the shoulder** after the bend. It keeps both bone lengths and swings the
  elbow down to the side, which is exactly what the hand-written patches did — but it moves the hand off
  what the pose and the grip asked for and leaves the contact pass more to push out. A wash on the shoulder
  (95.2 → 98.6 severity-weighted) while overlap went 12.4 → 16.1 and the audit's score 135.3 → 150.
- **Holding the range again after the contact pass**, where a foot is put back in line with its knee
  (`footInLine`). Turning an arm back there moves it into the body the push had just cleared it from:
  severity 157.6 → 183.3, score 181.3 → 208.5, with arms that the solve had left clean (taking the back,
  the knee-across reversal) going 0 → 0.85 and 0 → 0.72. A foot is only twisted about its own shin, which
  can't push it into anything; an arm can't be fixed there without undoing the push.

Measured over the 15 situations that had the complaint, as a switch on the same page (`ROM.shOn`):

| | off | on (the pole) |
|---|---|---|
| shoulder, severity-weighted | 95.2 / 112 / 115.4 / 128 | **85.3 / 85.3** |
| audit score | 135.3 / 144.4 / 162.5 / 185.6 | 145.9 / 145.9 |
| body overlap | 12.4 / 14.5 / 14.8 / 16.6 | 15.8 / 15.7 |

The armbar, the rear-naked choke and the knee-across reversal come out clean, and overlap doesn't move —
it can't, because the hand never moves. What is left is three situations (the wall walk, taking the back,
the head kick) where the hand itself is keyed behind the shoulder: no elbow can save those, and they are a
pose fix rather than a solver one.

**The measurements themselves were lying before this.** `setup()` waits for three.js by running frames
until WebGL is up, so how many frames it burns depends on how fast the machine got there, and every run
started from a different clock. Two runs of the same 15 situations with the same code gave 177 frames /
95.2 and 216 / 112 — bigger than most of what was being measured, and the reason an earlier "−33%" here
was nothing of the kind: it compared a 15-situation run against a 60-situation baseline. `C.setClock()`
pins the clock, and anything below about 15% between single runs is still noise and needs repeats. (The
pole version comes out identical run to run, which is its own small sign: it takes away the freedom the
divergence was feeding on.)

`RANGE` in the tests stays slacker than `ROM` on purpose for the measures that are noisy — a knee's turn is
read round the hip-to-ankle line, which is unstable folded tight — but the shoulder is read at exactly the
limit the solve enforces, and `setup()` now says so if the two ever drift apart.

### The three that were left (2026-11-19)

Of the three situations the range couldn't save, only one was what I said it was.

**The kicks were real, and they are fixed.** `chamber`, `kick` and `headKick` all keyed the rear hand behind
the chest — up to 0.35 m back — with the elbow poled straight back as well (`[-1, -0.5, 0.3]`). That put the
upper arm 1.6 rad behind hanging straight down: 92 degrees of shoulder extension against the 60 or so a
shoulder has. The clip's own note says the rear arm "swings down and back to balance it", and the second
half of that was doing the damage: a rear arm dropping for balance goes **down past the hip**, not backwards
horizontally. Keyed lower and less far back (and the recovery key in `headKick.json` with it), the head kick
goes from 23 frames over the range to **0**, and the body kick and leg kick from about 20 each to **0** —
stable across three page loads, where before it was 23 twice.

**`within()` had a plain bug.** It hardcoded 2.6 as the angle where a limit lets go again, which is right for
the fixed narrow limits it was written for (a knee at 0.85). The shoulder works out limits per frame and they
run close to pi, and with `lim` above `far` the last branch of `hold()` hands back *more* than `lim` — so for
exactly the poles pointing backwards, the ones that needed holding, the limit returned them unchanged and did
nothing at all. `within` now takes the release angle, and the shoulder passes one that starts after its limit.

**The wall walk and taking the back were not what I claimed.** I said the hand itself was keyed behind the
shoulder and no elbow could save them. For the head kick that was true. For these two the hand often sits at
0 to −1.25 while the arm is at −1.0 to −1.6 — the *elbow* is behind the hand, not the hand behind the body.
Two fixes aimed at that, both built and measured and both reverted:

- Holding `reach()`'s fallback direction to the range as well (it leans back, `[-0.3, -1, ...]`, and is
  unheld, which looked like the obvious remaining way round the limit). Taking the back went from 0.59 over
  20 frames to 0.86 over 66, the wall walk from 0.25 to 0.54, and the head kick didn't move. The fallback's
  job is to be steady when the pole has nothing to say; held per frame it stops being steady.
- Turning the elbow poles down and out in `backRoll` and `hipBump`, the same shape of fix that worked on the
  kicks. Taking the back went 14 frames to 68 and the 15-situation total 66 to 112. Those hands are gripped
  and the pelvis turns under them, so the pole that reads wrong written down is the one that comes out right.

**And the aggregate number can't carry weight.** Pinning the clock wasn't enough: `setup()` burns a variable
number of frames before the pin, and the figures keep that difference. The same build measured 65.6 and 66.8
on one pair of loads and 84.7 twice on another, with byte-identical clip data — runs cluster by how fast
WebGL came up. So the 15-situation total is only good for within-one-page comparisons like the `ROM.shOn`
switch, and single-situation numbers are only trustworthy where the situation itself is stable: the kicks
are (23, 23, then 0, 0, 0), the wall walk is not (48, 34 and 15 frames back to back, worst 0.59, 0.78, 0.66).
Nothing here should be read as a measured improvement in the aggregate; the kick result stands on its own.

### The ball on the chin (2026-11-19)

The jaw is a capsule from the middle of the head out to a jaw point. It sat 0.075 forward and 0.075 down,
which is 0.106 from the head's middle, and the cap on the end of it had radius 0.045 — against a head
outline of 0.106 in that direction, so the cap's centre landed exactly **on** the silhouette and a whole
hemisphere of it hung clear of the face. That is the small ball stuck on the chin. It is now 0.056 forward
and 0.046 down with the end widened to 0.06, so what shows past the head is a lens about 10 cm across and
2.8 cm deep — the line of a jaw rather than a 2:1 dome. (The side view was already fine: its head is a
circle of radius 0.12, which swallowed most of the same capsule.)

## Sources

- Cascadeur and Shadow Fight 2: [Triple Point press release (2014)](https://pressreleases.triplepointpr.com/?p=14873),
  [3DVF: SIGGRAPH 2019 interview](https://3dvf.com/redaction/siggraph-2019-cascadeur-physique-et-deep-learning-lavenir-de-lanimation/),
  [Cascadeur: about](https://cascadeur.com/about)
- Vector: [App Store listing via AppGoblin](https://appgoblin.info/apps/562989701)
- Cascadeur licences: [Plans and pricing](https://cascadeur.com/plans), [Licensing FAQ](https://cascadeur.com/blog/general/cascadeurs-new-licensing-structure-comprehensive-faq),
  [CG Channel on 2025.2](https://www.cgchannel.com/?p=168972)
- MediaPipe: [Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
  [GitHub (Apache-2.0)](https://github.com/google-ai-edge/mediapipe)
- CMU: [Motion Capture Database](http://mocap.cs.cmu.edu/)
- Blender to JSON: [blender-actions-to-json](https://github.com/chinedufn/blender-actions-to-json)
