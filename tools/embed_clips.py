# Put the animation clips (anim/clips/*.json) and the techniques for two (anim/pairs/*.json) into the game,
# on the CLIP_DATA line of cageside.html.
#   py tools/embed_clips.py
import glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'cageside.html')

clips = []
for kind in ('clips', 'pairs'):
    for path in sorted(glob.glob(os.path.join(ROOT, 'anim', kind, '*.json'))):
        with open(path, encoding='utf-8') as f:
            clip = json.load(f)
        # notes are for whoever reads the clip, not for the game: drop them wherever they sit, including the
        # ones inside a key's own `top`/`bot` (those used to ride along into the embedded data)
        def strip(x):
            if isinstance(x, dict):
                x.pop('note', None)
                for v in x.values():
                    strip(v)
            elif isinstance(x, list):
                for v in x:
                    strip(v)
        strip(clip)
        if kind == 'pairs':
            clip['pair'] = True
        clips.append(clip)

html = open(GAME, encoding='utf-8', newline='').read()
# The line ends with `;` and then whatever this checkout uses for a newline. Anchoring on `;$` only works on
# LF: cloned on Windows with git's autocrlf, every line ends `;\r\n`, `$` sits before the `\n` and the match
# fails, so the tool stopped working on a fresh clone of its own repo. Keep the line's own ending.
line = re.compile(r'^  const CLIP_DATA = .*?;(?=\r?$)', re.M)
if len(line.findall(html)) != 1:
    raise SystemExit('expected exactly one CLIP_DATA line')
data = json.dumps(clips, separators=(',', ':'))
html = line.sub(lambda m: '  const CLIP_DATA = ' + data + ';', html)
open(GAME, 'w', encoding='utf-8', newline='').write(html)
print('embedded %d clips and techniques (%d bytes)' % (len(clips), len(data)))
