"""Coleta pontual das URLs do catálogo. Nunca contorna robots, login ou desafios."""
import hashlib
import argparse
import json
import time
import tempfile
import os
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = 'IAPrevidenciariaResearch/0.1'
MAX_BYTES = 5_000_000
ALLOWED_HOSTS = {'www.planalto.gov.br', 'www.gov.br', 'www2.camara.leg.br'}


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme != 'https' or parsed.hostname != urllib.parse.urlparse(req.full_url).hostname:
            raise ValueError('Redirecionamento externo bloqueado')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS or parsed.username or parsed.password:
        raise ValueError('URL não autorizada')
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.build_opener(OfficialRedirect()).open(request, timeout=15) as response:
        content = response.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise ValueError('Limite de tamanho excedido')
        return content, response.headers, response.geturl()


def collect(selected=None):
    catalog = json.loads((ROOT / 'data/library/catalog.json').read_text())
    results = []
    robots_cache = {}
    for source in catalog:
        if source['collection'] != 'pending_permission_check':
            continue
        if selected and source['id'] not in selected:
            continue
        record = {'source_id': source['id'], 'url': source['url'], 'checked_at': datetime.now(timezone.utc).isoformat()}
        try:
            url = source['url']
            origin = urllib.parse.urlparse(url)
            robots_url = f'{origin.scheme}://{origin.netloc}/robots.txt'
            if robots_url not in robots_cache:
                try:
                    raw_robots, _, _ = fetch(robots_url)
                    # HTML de challenge/erro não equivale a robots permitindo coleta.
                    if b'<html' in raw_robots.lower() or b'<!doctype html' in raw_robots.lower():
                        raise ValueError('Robots retornou HTML; permissão não estabelecida')
                    parser = urllib.robotparser.RobotFileParser(robots_url)
                    parser.parse(raw_robots.decode('utf-8', errors='replace').splitlines())
                    robots_cache[robots_url] = (raw_robots, parser)
                except (urllib.error.URLError, ValueError, TimeoutError) as error:
                    robots_cache[robots_url] = error
            robots = robots_cache[robots_url]
            if isinstance(robots, Exception):
                raise ValueError('Robots indisponível; nenhuma coleta realizada') from robots
            raw_robots, parser = robots
            if not parser.can_fetch(USER_AGENT, url):
                raise ValueError('Coleta não permitida por robots')
            if (parser.crawl_delay(USER_AGENT) or 0) > 60:
                raise ValueError('Crawl-delay exige agendamento posterior')
            time.sleep(max(parser.crawl_delay(USER_AGENT) or 2, 2))
            content, headers, final_url = fetch(url)
            media_type = headers.get('Content-Type', '')
            if not media_type.lower().startswith('text/html'):
                raise ValueError('Tipo de conteúdo não suportado')
            lowered = content.lower()
            if any(marker in lowered for marker in [b'cf-chl-', b'verify you are human', b'access denied', b'captcha']):
                raise ValueError('Possível challenge; coleta interrompida')
            digest = hashlib.sha256(content).hexdigest()
            directory = ROOT / 'data/legal-sources' / source['id'] / digest
            if not directory.exists():
                directory.parent.mkdir(parents=True, exist_ok=True)
                metadata = {
                    'source_id': source['id'], 'title': source['title'], 'url': url,
                    'final_url': final_url, 'institution': source['institution'], 'type': source['type'],
                    'retrieved_at': datetime.now(timezone.utc).isoformat(), 'sha256': digest,
                    'bytes': len(content), 'http_status': 200, 'media_type': media_type,
                    'approval_status': 'draft', 'legal_validity': 'nao_verificada',
                    'robots_allowed_for_path': True, 'robots_user_agent': USER_AGENT,
                    'license_displayed': None,
                    'limitations': ['Coleta pública pontual; termos e vigência exigem revisão.',
                                    'Texto consolidado pode conter redações revogadas; não inferir vigência histórica.',
                                    'Sem aprovação jurídica; não ativar regras.']
                }
                with tempfile.TemporaryDirectory(prefix='.download-', dir=directory.parent) as scratch:
                    staging = Path(scratch)
                    (staging / 'original.html').write_bytes(content)
                    (staging / 'robots.txt').write_bytes(raw_robots)
                    (staging / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
                    os.rename(staging, directory)
            else:
                existing = json.loads((directory / 'metadata.json').read_text())
                if (hashlib.sha256((directory / 'original.html').read_bytes()).hexdigest() != digest
                        or existing['url'] != url or existing['sha256'] != digest
                        or not (directory / 'robots.txt').is_file()):
                    raise ValueError('Arquivo existente inconsistente; não foi sobrescrito')
            record.update(status='archived_draft', sha256=digest, bytes=len(content))
        except (urllib.error.URLError, ValueError, OSError) as error:
            record.update(status='not_collected', reason=str(error)[:200])
        results.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
    log = ROOT / 'data/library/collection-log.json'
    previous = json.loads(log.read_text()) if log.exists() else []
    log.write_text(json.dumps(previous + results, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument('--source', action='append', help='ID exato do catálogo; pode ser repetido')
    collect(arguments.parse_args().source)
