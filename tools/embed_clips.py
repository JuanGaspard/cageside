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
        clip.pop('note', None)
        for k in clip.get('keys', []):
            k.pop('note', None)
        if kind == 'pairs':
            clip['pair'] = True
        clips.append(clip)

html = open(GAME, encoding='utf-8', newline='').read()
line = re.compile(r'^  const CLIP_DATA = .*;$', re.M)
if len(line.findall(html)) != 1:
    raise SystemExit('expected exactly one CLIP_DATA line')
data = json.dumps(clips, separators=(',', ':'))
html = line.sub(lambda m: '  const CLIP_DATA = ' + data + ';', html)
open(GAME, 'w', encoding='utf-8', newline='').write(html)
print('embedded %d clips and techniques (%d bytes)' % (len(clips), len(data)))
