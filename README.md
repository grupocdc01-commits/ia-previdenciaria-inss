# IA Previdenciária INSS

Agente de inteligência artificial especializado
na investigação de benefícios negados pelo INSS.

## Estado após a publicação do ambiente
O INSS ficou acessível e uma primeira página oficial de orientação sobre BPC foi
arquivada com metadados e hash em `data/legal-sources/`, pendente de revisão jurídica.
Execute `python scripts/verificar_fontes.py` para verificar a integridade da cópia.

A implementação local anterior não apareceu no checkout após a reconexão. Os
anexos de especificação foram recuperados, mas o núcleo e os testes anteriores
continuam pendentes de recuperação. Consulte `docs/ESTADO_APOS_PUBLICACAO.md`.

## Núcleo local reconstruído

A nova implementação demonstrativa está em `src/`, com testes novos em `tests/`.
Requer Node.js 24+: `npm ci`, `npm run check`, `npm run build`, `npm run demo`.
Usa somente dados fictícios e não produz conclusões jurídicas reais.
Instruções de API, execução e limites: [docs/NUCLEO_LOCAL.md](docs/NUCLEO_LOCAL.md).
Histórico da retomada: [docs/RECUPERACAO_NUCLEO.md](docs/RECUPERACAO_NUCLEO.md).
