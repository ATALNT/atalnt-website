import http.server
import os
os.chdir("/Users/nikjain55/Desktop/Claude Code/ROI Calculator")
handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.HTTPServer(("", 3334), handler)
print(f"Serving on port 3334")
httpd.serve_forever()
