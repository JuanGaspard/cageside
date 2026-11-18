# Cageside's local server: serves the project folder, and lets the test pages and the animation studio
# save what they make (review images, animation clips) into review/ and anim/. A clip saved into
# anim/clips/ is put straight into the game (tools/embed_clips.py).
#   py tools/devserver.py [port]
import http.server, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVE = re.compile(r'^/(review|anim)/([\w-]+/)?[\w.-]+\.(png|json|webm)$')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    # Part of a file on request (HTTP ranges): browsers need it to jump about in a video.
    def send_head(self):
        self._left = None
        rng, path = self.headers.get('Range'), self.translate_path(self.path)
        m = re.match(r'bytes=(\d*)-(\d*)$', (rng or '').strip())
        if not m or not os.path.isfile(path) or not (m.group(1) or m.group(2)):
            return super().send_head()
        size = os.path.getsize(path)
        if m.group(1):
            start, end = int(m.group(1)), min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
        else:
            start, end = max(0, size - int(m.group(2))), size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', 'bytes */%d' % size)
            self.end_headers()
            return None
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self._left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, '_left', None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def do_PUT(self):
        if not SAVE.match(self.path):
            self.send_error(403)
            return
        n = int(self.headers.get('Content-Length', 0))
        if n > 20_000_000:
            self.send_error(413)
            return
        path = os.path.join(ROOT, *self.path.lstrip('/').split('/'))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(self.rfile.read(n))
        if self.path.startswith('/anim/clips/'):
            done = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'embed_clips.py')], capture_output=True, text=True)
            if done.returncode:
                self.send_error(500, (done.stderr or done.stdout).strip()[-200:])
                return
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        if self.command == 'PUT' or (args and str(args[1])[0] in '45'):
            super().log_message(fmt, *args)


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
