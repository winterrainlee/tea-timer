"""Serve only public app assets; proxy feedback exclusively to a local Worker."""
import argparse
from http.client import HTTPConnection
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def handler_for(root=ROOT, worker_port=8787):
    source = (root / 'sw.js').read_text()
    allowed = {'/', '/sw.js'}
    for name in ('SHELL_ASSETS', 'STATIC_ASSETS'):
        block = re.search(r'const ' + name + r' = \[(.*?)\];', source, re.S).group(1)
        allowed.update('/' + item[2:] for item in re.findall(r'"(\./[^"\n]*)"', block))

    class AppOnlyHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def send_head(self):
            path = unquote(urlsplit(self.path).path)
            target = (root / path.lstrip('/')).resolve()
            if path not in allowed or not target.is_relative_to(root):
                self.send_error(404)
                return None
            return super().send_head()

        def list_directory(self, _path):
            self.send_error(404)
            return None

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()

        def reply_json(self, status, body):
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def fail(self, status, code):
            self.reply_json(status, json.dumps({'ok': False, 'error': code}).encode())

        def do_POST(self):
            # This is not an arbitrary proxy or a private admin endpoint.
            if self.path != '/api/messages':
                self.fail(404, 'not_found')
                return
            if self.headers.get('Origin') != 'http://' + self.headers.get('Host', ''):
                self.fail(403, 'invalid_origin')
                return
            if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
                self.fail(400, 'invalid_request')
                return
            length = self.headers.get('Content-Length', '')
            if self.headers.get('Transfer-Encoding') or not length.isdecimal():
                self.fail(400, 'invalid_request')
                return
            if not 0 < int(length) <= 8192:
                self.fail(413, 'payload_too_large')
                return
            self.connection.settimeout(5)
            conn = HTTPConnection('127.0.0.1', worker_port, timeout=10)
            try:
                body = self.rfile.read(int(length))
                if len(body) != int(length):
                    self.fail(400, 'invalid_request')
                    return
                conn.request('POST', '/messages', body=body, headers={
                    'Content-Type': 'application/json',
                    'Origin': 'http://127.0.0.1:8138',
                    # Ignore client-supplied proxy headers; use the actual peer.
                    'CF-Connecting-IP': self.client_address[0],
                })
                response = conn.getresponse()
                data = response.read(8193)
                if len(data) > 8192 or not response.getheader('Content-Type', '').startswith('application/json'):
                    self.fail(503, 'unavailable')
                    return
                self.reply_json(response.status, data)
            except (OSError, ValueError):
                self.fail(503, 'unavailable')
            finally:
                conn.close()

    return AppOnlyHandler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8138)
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--worker-port', type=int, default=8787)
    args = parser.parse_args()
    print(f'App-only preview on {args.bind}:{args.port}; feedback → local Worker:{args.worker_port}', flush=True)
    ThreadingHTTPServer((args.bind, args.port), handler_for(worker_port=args.worker_port)).serve_forever()


if __name__ == '__main__':
    main()
