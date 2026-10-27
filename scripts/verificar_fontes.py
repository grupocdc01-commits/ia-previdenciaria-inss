"""Valida integridade dos originais arquivados; não atesta validade jurídica."""
import hashlib
import json
from pathlib import Path

def verify(root: Path) -> int:
    records = sorted(root.glob('*/*/metadata.json'))
    if not records:
        raise ValueError('Nenhuma versão de fonte encontrada.')
    for path in records:
        metadata = json.loads(path.read_text())
        original = (path.parent / 'original.html').read_bytes()
        catalog_path = Path(__file__).resolve().parents[1] / 'data/library/catalog.json'
        catalog = json.loads(catalog_path.read_text())
        expected = next((source for source in catalog if source['id'] == metadata['source_id']), None)
        checks = [
            (hashlib.sha256(original).hexdigest() == metadata['sha256'], 'Hash incorreto'),
            (len(original) == metadata['bytes'], 'Tamanho incorreto'),
            (metadata['sha256'] == path.parent.name, 'Versão incorreta'),
            (metadata['source_id'] == path.parent.parent.name, 'Fonte incorreta'),
            (metadata['approval_status'] == 'draft', 'Metadados originais devem permanecer draft'),
            (metadata['legal_validity'] == 'nao_verificada', 'Integridade não é validação jurídica'),
            (expected is not None and metadata['url'] == expected['url'], 'Origem fora do catálogo'),
            ((path.parent / 'robots.txt').is_file() and metadata['robots_allowed_for_path'] is True, 'Registro robots ausente')
        ]
        for valid, message in checks:
            if not valid:
                raise ValueError(f'{message}: {path}')
    return len(records)

if __name__ == '__main__':
    count = verify(Path(__file__).resolve().parents[1] / 'data' / 'legal-sources')
    print(f'{count} versão(ões) com integridade confirmada; nenhuma aprovada juridicamente.')
