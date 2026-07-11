"""Tiny no-cache static server for local development.
Serves the folder this file lives in (Deadzone) so edits always reload fresh.
"""
import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8137"))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


# ThreadingHTTPServer so keep-alive connections from the browser don't block
# other requests (a single-threaded server deadlocks the preview webview).
httpd = http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler)
httpd.daemon_threads = True
print(f"Dead Zone dev server on http://localhost:{PORT}")
httpd.serve_forever()
