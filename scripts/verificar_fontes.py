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
        assert hashlib.sha256(original).hexdigest() == metadata['sha256'], f'Hash incorreto: {path}'
        assert len(original) == metadata['bytes'], f'Tamanho incorreto: {path}'
        assert metadata['sha256'] == path.parent.name, f'Versão incorreta: {path}'
        assert metadata['approval_status'] == 'draft', 'Fontes não revisadas devem permanecer draft.'
        assert metadata['legal_validity'] == 'nao_verificada', 'Integridade não é validação jurídica.'
        assert metadata['url'].startswith('https://www.gov.br/'), 'Origem não esperada nesta primeira carga.'
    return len(records)

if __name__ == '__main__':
    count = verify(Path(__file__).resolve().parents[1] / 'data' / 'legal-sources')
    print(f'{count} versão(ões) com integridade confirmada; nenhuma aprovada juridicamente.')
