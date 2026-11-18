# Cageside

An MMA simulation: build a fighter, run a promotion, and watch the fights play out in a 3D cage view
where every strike, takedown and scramble is animated from what the engine actually decided.

The whole game is one file, `cageside.html` — no build, no dependencies, no install. Open it and it runs.

## Running it

Open `cageside.html` in a browser, or serve the folder if you want the test harnesses too:

```bash
python tools/devserver.py
```

Then go to `http://localhost:8765/cageside.html`.

`?flat` falls back to the old 2D fight view; `?fig2` keeps the new figures but drops the 3D octagon.

## Layout

| | |
|---|---|
| `cageside.html` | the game: engine, UI and fight view |
| `anim/clips/` | single-figure animations (strikes, steps, reactions) as JSON |
| `anim/pairs/` | two-figure techniques (takedowns, passes, sweeps, reversals) |
| `anim/tracks/` | pose tracks pulled off reference footage |
| `tests/` | measurement harnesses, run from the browser console |
| `tools/embed_clips.py` | bakes `anim/` into `cageside.html` |
| `ANIMATION_PLAN.md` | the working log for the animation system |

Animation data lives in `anim/` as readable JSON and is embedded into the single file at build time. After
editing a clip:

```bash
python tools/embed_clips.py
```

## Tests

The harnesses drive the fight view on their own clock, so frames are exact whether or not the browser is
painting. From the console on a loaded page:

```js
const C = await import('/tests/camtest.js'), K = await import('/tests/contact.js');
await C.setup(); K.audit();          // scores every position, technique and strike
```

`camtest.js` renders film strips and measures posture; `contact.js` scores clipping, limbs through the mat,
anatomically impossible joints and single-frame pops across ~60 situations. `K.audit()` returns a row per
situation, worst first.

## Reference footage

The repo carries no video. Footage under `anim/footage/` was used only to look at while animating and to
pull pose tracks from; it isn't ours to redistribute. `anim/tracks/` holds the derived data.
