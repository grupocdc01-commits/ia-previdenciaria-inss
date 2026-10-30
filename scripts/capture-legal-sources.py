"""Optional maintenance capture: bounded public GETs, no review or auto-approval.

Usage: python scripts/capture-legal-sources.py <targets.json> <output-directory>
Targets must contain [{"id": "...", "url": "https://..."}]. Run only deliberately;
the application and test suite never invoke this script.
"""
import concurrent.futures
import datetime
import hashlib
from html.parser import HTMLParser
import json
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ALLOWED = {"www.planalto.gov.br", "www.in.gov.br"}
MAX_BYTES = 5 * 1024 * 1024


class OfficialText(HTMLParser):
    """Extract only the DOU normative container, never portal scripts or tokens."""
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.active = None
        self.done = False
        self.skip = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "div":
            self.depth += 1
            if not self.done and self.active is None and "texto-dou" in dict(attrs).get("class", "").split():
                self.active = self.depth
        if self.active is not None:
            if tag in {"script", "style"}:
                self.skip += 1
            if tag in {"p", "br"}:
                self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        if tag == "div":
            if self.active == self.depth:
                self.active = None
                self.done = True
            self.depth -= 1

    def handle_data(self, value):
        if self.active is not None and not self.skip:
            self.parts.append(value)


def extract_official_text(body):
    parser = OfficialText()
    parser.feed(body.decode("utf-8", errors="strict"))
    text = "\n".join(" ".join(line.split()) for line in "".join(parser.parts).splitlines() if line.strip()) + "\n"
    if not parser.done or len(text) < 100:
        raise ValueError("Recognized normative container missing")
    return text.encode("utf-8")


def check_url(value):
    url = urllib.parse.urlsplit(value)
    if (url.scheme != "https" or url.hostname not in ALLOWED
            or url.username or url.password or url.port):
        raise ValueError("Only approved official HTTPS addresses are allowed")
    return value


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        check_url(newurl)
        return super().redirect_request(request, fp, code, message, headers, newurl)


def capture(target, output):
    identity = target["id"]
    if not re.fullmatch(r"[a-z0-9-]{1,100}", identity):
        raise ValueError("Invalid source identifier")
    url = check_url(target["url"])
    at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        opener = urllib.request.build_opener(SafeRedirect())
        request = urllib.request.Request(url, headers={"User-Agent": "LegalCatalogAudit/1.0", "Accept": "text/html,text/plain"})
        with opener.open(request, timeout=12) as response:
            final_url = check_url(response.geturl())
            content_type = response.headers.get_content_type()
            if content_type not in {"text/html", "text/plain"}:
                raise ValueError("Unsupported content type")
            body = response.read(MAX_BYTES + 1)
            if not body or len(body) > MAX_BYTES:
                raise ValueError("Empty or oversized response")
        transport_digest = hashlib.sha256(body).hexdigest()
        body = extract_official_text(body)
        digest = hashlib.sha256(body).hexdigest()
        name = f"{identity}-{digest}.txt"
        path = output / name
        if path.exists() and path.read_bytes() != body:
            raise ValueError("Immutable snapshot collision")
        path.write_bytes(body)
        return {"id": identity, "url": url, "status": "capturada_nao_conferida", "file": name,
                "capture": {"sha256": digest, "capturedAt": at, "finalUrl": final_url,
                            "bytes": len(body), "identity": "pendente", "format": "texto-dou-v1"},
                "transportSha256": transport_digest, "contentType": content_type}
    except (OSError, ValueError, urllib.error.URLError) as error:
        # Never copy response bodies, headers, credentials or exception strings.
        return {"id": identity, "url": url, "status": "indisponivel", "attemptedAt": at,
                "error": f"HTTP {error.code}" if isinstance(error, urllib.error.HTTPError) else type(error).__name__}


if __name__ == "__main__":
    targets = json.loads(pathlib.Path(sys.argv[1]).read_text())
    if not isinstance(targets, list) or not 1 <= len(targets) <= 10:
        raise ValueError("Between 1 and 10 explicit sources required")
    output = pathlib.Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda target: capture(target, output), targets))
    (output / "capturas.json").write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps([{ "id": item["id"], "status": item["status"] } for item in results]))
