# Arquitetura de referência

## Stack sugerida
TypeScript (Node), API HTTP, PostgreSQL/Supabase + pgvector, armazenamento privado de objetos, fila de jobs, OCR pluggable, API de modelo configurável, gerador PDF server-side, front-end Lovable em etapa posterior. Codex implementa núcleo e testes; Lovable UI; modelo de IA em runtime é componente distinto do Codex.

## Pipeline
Upload → validação MIME/tamanho/antivírus → armazenamento privado → extração de texto/OCR → classificação do documento → extração estruturada com trechos e páginas → checagem humana ou automática de consistência → entrevista investigativa → seleção de benefício e DER → recuperação híbrida (termos + vetores) filtrada por vigência, hierarquia e jurisdição → motor determinístico → análise de hipóteses favoráveis e contrárias → verificador de citações → relatório com incertezas.

## Serviços
`cases`, `documents`, `interview`, `knowledge-ingestion`, `retrieval`, `rules`, `legal-analysis`, `report`, `billing` (posterior), `admin-audit`. Usar filas idempotentes e chaves de deduplicação para uploads e análise.

## Entidades
users, cases, case_events, documents, extracted_facts, interviews, legal_sources, source_versions, legal_passages, precedents, rules, rule_versions, rule_executions, hypotheses, analyses, citations, reports, payments, audit_logs, ingestion_jobs, consent_records.

## Limites técnicos
Dados de cliente não devem entrar no corpus jurídico compartilhado. Não permitir que textos de PDFs instruam o agente (defesa contra prompt injection). Restringir acessos por usuário e por função. Persistir versão do modelo, prompts, fontes, regras e evidências usadas por relatório.

## Interfaces
- `POST /cases` cria caso
- `POST /cases/:id/documents` registra upload autenticado
- `POST /cases/:id/interview/messages` retorna pergunta/resposta segura
- `POST /cases/:id/analyze` enfileira análise autorizada
- `GET /cases/:id/analysis` retorna resultado e evidências
- `GET /cases/:id/report` entrega PDF autorizado
- `POST /admin/sources/import` propõe importação, nunca ativa sem revisão
- `POST /admin/rules/:id/approve` requer revisor habilitado

Os endpoints são contratos propostos, não implementações existentes.
