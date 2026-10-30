"""Offline capture regressions: python -m unittest discover -s scripts -p 'test_*.py'."""
import hashlib
import importlib.util
import pathlib
import tempfile
import unittest
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

SPEC = importlib.util.spec_from_file_location("legal_capture", pathlib.Path(__file__).with_name("capture-legal-sources.py"))
capture_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(capture_module)
URL = "https://www.in.gov.br/en/web/dou/-/test"
BODY = ("<script>secret-token-outside</script><div class='texto-dou'><p>"
        + "Synthetic normative text for offline tests. " * 5
        + "</p><script>secret-token-inside</script></div>").encode()


class CaptureTests(unittest.TestCase):
    def test_extracts_only_normative_text_without_portal_tokens(self):
        result = capture_module.extract_official_text(BODY)
        self.assertIn(b"Synthetic normative text", result)
        self.assertNotIn(b"secret-token", result)
        self.assertNotIn(b"<script", result)

    def test_rejects_error_page_without_recognized_normative_container(self):
        with self.assertRaises(ValueError):
            capture_module.extract_official_text(b"<html>Access denied</html>")

    def test_rejects_insecure_and_credential_bearing_targets(self):
        for url in ["http://www.in.gov.br/", "https://www.in.gov.br.evil.invalid/", "https://localhost/", "https://user:password@www.in.gov.br/", "https://www.in.gov.br:444/"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                capture_module.check_url(url)

    def test_redirect_cannot_escape_official_allowlist(self):
        with self.assertRaises(ValueError):
            capture_module.SafeRedirect().redirect_request(urllib.request.Request(URL), None, 302, "redirect", {}, "https://evil.invalid/")

    def test_capture_hashes_extracted_bytes_but_never_approves_source(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.geturl.return_value = URL
        response.headers.get_content_type.return_value = "text/html"
        response.read.return_value = BODY
        opener = MagicMock()
        opener.open.return_value = response
        with tempfile.TemporaryDirectory() as directory, patch.object(capture_module.urllib.request, "build_opener", return_value=opener):
            result = capture_module.capture({"id": "synthetic-source", "url": URL}, pathlib.Path(directory))
            stored = (pathlib.Path(directory) / result["file"]).read_bytes()
            self.assertEqual(hashlib.sha256(stored).hexdigest(), result["capture"]["sha256"])
            self.assertEqual(result["capture"]["identity"], "pendente")
            self.assertNotIn(b"secret-token", stored)

    def test_http_failure_is_recorded_without_body_or_headers(self):
        opener = MagicMock()
        opener.open.side_effect = urllib.error.HTTPError(URL, 503, "sensitive-transport-detail", {}, None)
        with tempfile.TemporaryDirectory() as directory, patch.object(capture_module.urllib.request, "build_opener", return_value=opener):
            result = capture_module.capture({"id": "synthetic-source", "url": URL}, pathlib.Path(directory))
            self.assertEqual(result["error"], "HTTP 503")
            self.assertNotIn("capture", result)
            self.assertEqual(list(pathlib.Path(directory).iterdir()), [])

    def test_large_response_never_creates_a_snapshot(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.geturl.return_value = URL
        response.headers.get_content_type.return_value = "text/html"
        response.read.return_value = b"x" * (capture_module.MAX_BYTES + 1)
        opener = MagicMock()
        opener.open.return_value = response
        with tempfile.TemporaryDirectory() as directory, patch.object(capture_module.urllib.request, "build_opener", return_value=opener):
            result = capture_module.capture({"id": "synthetic-source", "url": URL}, pathlib.Path(directory))
            self.assertEqual(result["status"], "indisponivel")
            self.assertEqual(list(pathlib.Path(directory).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
