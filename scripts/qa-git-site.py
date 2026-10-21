"""Exercise the site-project and Git publishing flow against a local GitHub stub."""

import base64
import http.cookiejar
import http.server
import json
import os
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class GithubStub(http.server.BaseHTTPRequestHandler):
    committed = None

    def log_message(self, *_args):
        pass

    def do_GET(self):
        assert self.path == "/repos/pilot/site/contents/ai-cmo.json?ref=main", self.path
        data = {"encoding": "base64", "content": base64.b64encode(b'{"version":1,"contentRoot":"content"}').decode()}
        self.reply(200, data)

    def do_PUT(self):
        GithubStub.committed = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        assert self.path.startswith("/repos/pilot/site/contents/content/blog/"), self.path
        self.reply(201, {"commit": {"html_url": "https://github.com/pilot/site/commit/abc123"}})

    def reply(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


github_port = free_port()
app_port = free_port()
github = http.server.ThreadingHTTPServer(("127.0.0.1", github_port), GithubStub)
threading.Thread(target=github.serve_forever, daemon=True).start()

with tempfile.TemporaryDirectory(prefix="ai-cmo-git-qa-") as temp:
    database = str(Path(temp) / "qa.sqlite")
    email = f"qa-git-{uuid.uuid4().hex[:8]}@example.test"
    env = os.environ.copy()
    env.update({
        "APP_SECRET": "qa-secret-long-enough-for-local-only-123456789",
        "CRON_SECRET": "qa-cron-long-enough-for-local-only-123456789",
        "AI_CMO_DATABASE_PATH": database,
        "OPERATOR_EMAILS": email,
        "GITHUB_SITE_TOKEN": "qa-token",
        "GITHUB_API_BASE_URL": f"http://127.0.0.1:{github_port}",
    })
    process = subprocess.Popen([str(ROOT / "node_modules/.bin/next"), "start", "-p", str(app_port)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    base = f"http://127.0.0.1:{app_port}"
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    session_cookie = [""]

    def api(path, body=None):
        headers = {"Content-Type": "application/json"} if body is not None else {}
        if session_cookie[0]:
            headers["Cookie"] = session_cookie[0]
        request = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                                         headers=headers)
        try:
            with opener.open(request, timeout=30) as response:
                if response.headers.get("Set-Cookie"):
                    session_cookie[0] = response.headers["Set-Cookie"].split(";", 1)[0]
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    try:
        for _ in range(80):
            try:
                if api("/api/health")[0] == 200:
                    break
            except Exception:
                time.sleep(0.25)
        else:
            raise AssertionError("App did not start")
        assert api("/api/auth", {"action": "signup", "email": email, "password": "testing-secret-123"})[0] == 200
        status, created = api("/api/workspace", {"action": "create_company", "name": "Pilot", "summary": "Serviços B2B de implantação de software", "website": ""})
        assert status == 200, created
        company_id = created["companyId"]
        status, configured = api("/api/workspace", {"action": "configure_site_repository", "companyId": company_id,
                                  "repository": "pilot/site", "branch": "main", "contentRoot": "content", "previewUrl": "", "liveUrl": "https://pilot.example.test"})
        assert status == 200, configured
        assert api("/api/workspace", {"action": "set_site_stage", "companyId": company_id, "stage": "building"})[0] == 200
        assert api("/api/workspace", {"action": "set_site_stage", "companyId": company_id, "stage": "review"})[0] == 200
        assert api("/api/workspace", {"action": "update_site_brief", "companyId": company_id, "brief": "Preservar a página de serviços."})[0] == 200
        content_id = str(uuid.uuid4())
        with sqlite3.connect(database) as connection:
            connection.execute("INSERT INTO content(id,company_id,channel,title,body,status) VALUES(?,?,?,?,?,?)",
                               (content_id, company_id, "blog", "Como vender serviços B2B", "## Primeiro passo\n\nTexto verificado para teste.", "approved"))
        assert api("/api/workspace", {"action": "publish_content", "companyId": company_id, "contentId": content_id})[0] == 400
        assert api("/api/workspace", {"action": "set_site_stage", "companyId": company_id, "stage": "operating"})[0] == 200
        status, published = api("/api/workspace", {"action": "publish_content", "companyId": company_id, "contentId": content_id})
        assert status == 200 and published["url"].endswith("/abc123"), (status, published)
        markdown = base64.b64decode(GithubStub.committed["content"]).decode()
        assert "Como vender serviços B2B" in markdown and "Texto verificado" in markdown
        status, workspace = api(f"/api/workspace?companyId={company_id}")
        assert status == 200 and workspace["content"][0]["status"] == "committed" and workspace["siteProject"]["brief"], workspace
        assert api("/api/workspace", {"action": "connect_wordpress", "companyId": company_id})[0] == 400
        assert api("/api/workspace", {"action": "enable_hosted_site", "companyId": company_id})[0] == 400
        print(json.dumps({"site_stage": workspace["siteProject"]["stage"], "repository": workspace["siteRepository"]["repository"],
                          "content_status": workspace["content"][0]["status"], "commit": published["url"]}))
    finally:
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
        github.shutdown()
