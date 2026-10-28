"""Testes sem rede do coletor; nenhum dado jurídico é aprovado."""
import importlib.util
import json
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('collector', Path(__file__).resolve().parents[1] / 'scripts/collect_official_sources.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTest(unittest.TestCase):
    def run_collection(self, fake_fetch):
        scratch = Path(__file__).resolve().parents[1] / '.local'
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            root = Path(directory)
            (root / 'data/library').mkdir(parents=True)
            catalog = [{'id': 'sintetico', 'title': 'FICTÍCIO', 'url': 'https://www.gov.br/ficticio', 'institution': 'FICTÍCIO', 'type': 'lei', 'collection': 'pending_permission_check'}]
            (root / 'data/library/catalog.json').write_text(json.dumps(catalog))
            with patch.object(collector, 'ROOT', root), patch.object(collector, 'fetch', side_effect=fake_fetch), patch.object(collector.time, 'sleep'), patch('builtins.print'):
                collector.collect()
            return json.loads((root / 'data/library/collection-log.json').read_text())[0], list(root.glob('data/legal-sources/*/*/original.html'))

    def test_robots_indisponivel_nao_permite_busca_do_documento(self):
        calls = []
        def fetch(url):
            calls.append(url)
            raise TimeoutError('timeout simulado')
        result, files = self.run_collection(fetch)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result['status'], 'not_collected')
        self.assertEqual(files, [])

    def test_robots_proibido_nao_baixa_documento(self):
        result, files = self.run_collection(lambda url: (b'User-agent: *\nDisallow: /\n', {}, url))
        self.assertEqual(result['status'], 'not_collected')
        self.assertEqual(files, [])

    def test_challenge_nao_e_arquivado_como_norma(self):
        def fetch(url):
            if url.endswith('robots.txt'):
                return b'User-agent: *\nAllow: /\n', {}, url
            return b'<html>verify you are human</html>', {'Content-Type': 'text/html'}, url
        result, files = self.run_collection(fetch)
        self.assertEqual(result['status'], 'not_collected')
        self.assertEqual(files, [])

    def test_coleta_permitida_grava_snapshot_com_hash(self):
        original = b'<html><body><p>DOCUMENTO FICTICIO</p></body></html>'
        def fetch(url):
            if url.endswith('robots.txt'):
                return b'User-agent: *\nAllow: /\n', {}, url
            return original, {'Content-Type': 'text/html;charset=utf-8'}, url
        result, files = self.run_collection(fetch)
        self.assertEqual(result['status'], 'archived_draft')
        self.assertEqual(result['sha256'], hashlib.sha256(original).hexdigest())
        self.assertEqual(len(files), 1)


if __name__ == '__main__':
    unittest.main()
