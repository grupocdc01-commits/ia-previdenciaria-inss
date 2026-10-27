# Validação da infraestrutura — 27/10/2026

## Resultados

- 61 testes TypeScript e quatro Python aprovados.
- Typecheck estrito, build e integridade das sete fontes oficiais aprovados.
- Auditoria npm completa sem vulnerabilidades reportadas nesta execução.
- Imagem Docker construída com TLS verificado e CA via segredo de build.
- Compose real executado: PostgreSQL, migração, API e worker separados.
- No Compose, readiness, criação de caso, job 202, conclusão e download PDF passaram.
- Adaptação S3 testada contra contrato HTTP mínimo; não houve conexão a bucket real.

## Carga sintética com PostgreSQL real

Execução final com worker em processo separado e quatro consumidores:

| Medida | Resultado |
| --- | --- |
| Usuários disparados simultaneamente | 300 |
| Requisições POST | 930 |
| Tempo para aceitar os atendimentos | 5.333 ms |
| P95 das requisições POST | 2.296 ms |
| Tempo total, incluindo PDFs conferidos | 8.033 ms |
| Análises concluídas | 300 |
| PDFs conferidos | 300 |
| Textos integrais dos anexos descartados | 300 |
| Jobs duplicados | 0 |
| Limite de conexões API / worker | 10 / 5 |

O cenário inclui 300 documentos textuais fictícios e repetição de submissões
para verificar idempotência. O schema de teste é criado separadamente e removido
ao final. O CI repete o cenário usando seu próprio PostgreSQL temporário.

Foi corrigida a execução de migrações durante tráfego: agora são uma etapa
separada antes das réplicas. Isso evita bloqueios de DDL sob concorrência.

Resultados variam conforme recursos do host. Não demonstram o mesmo tempo com
OCR, LLM, documentos grandes ou rede de produção. Nenhuma capacidade comercial
foi prometida. PDFs e anexos usam armazenamento temporário; resumos e metadados
continuam no banco, conforme explicado em INFRAESTRUTURA.md.

## Situação para o próximo trabalho

É possível construir o front-end de demonstração sobre esse contrato. Para
atender pessoas reais faltam OCR/antivírus, provedor de IA, regras revisadas,
identidade e storage reais configurados, política de dados, monitoramento e
validação de carga com esses fornecedores. Não houve publicação ou contratação.
