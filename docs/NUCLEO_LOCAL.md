# Núcleo local — primeira etapa reconstruída

Este núcleo usa exclusivamente dados fictícios. Não foi recuperado o código da
instância antiga. Os testes deste diretório foram escritos e executados novamente.
Não são os 30 testes mencionados no registro histórico.

## Executar

Requisitos: Node.js 24+, npm e Python 3 para conferir a fonte arquivada.

```sh
npm ci
npm run check
npm run build
npm run demo
```

`npm run demo` usa SQLite em memória, sem abrir porta ou chamar serviços externos.
Apresenta um caso BPC fictício com informações incompletas e estado indeterminado.

Para servidor persistente local:

```sh
cp .env.example .env
# Edite DEMO_API_TOKEN em .env: use um token local com pelo menos 24 caracteres.
npm run dev
```

A API escuta somente `127.0.0.1:3000`. `npm start` executa a versão compilada.
O banco fica em `.local/development.sqlite`, ignorado pelo Git. `node:sqlite`
é um recurso nativo que ainda pode emitir aviso experimental no Node 24.
Nunca envie dados reais a esta versão. A exigência `syntheticData: true` é uma
declaração do operador, não um detector automático de dados pessoais.

## Fluxo da API

Todas as rotas, exceto `GET /health`, exigem `Authorization: Bearer <token>`.
O proprietário vem da configuração do servidor, nunca do corpo ou de um header
de usuário. A configuração padrão oferece uma identidade demonstrativa local.
Não há cadastro, login ou aprovação jurídica de produção.

1. `POST /cases`: cria caso. Corpo de exemplo:

   ```json
   {
     "benefit": "bpc",
     "subtype": "pessoa_com_deficiencia",
     "uf": "MG",
     "der": "2025-01-10",
     "noticeDate": null,
     "denialReason": "Renda familiar — caso fictício",
     "syntheticData": true,
     "consent": true
   }
   ```

2. `GET /cases/:id`: consulta caso e evidências.
3. `PATCH /cases/:id`: atualiza `subtype`, `der`, `noticeDate`, `denialReason`.
4. `POST /cases/:id/documents`: recebe JSON com `name`, `kind`,
   `mimeType: "text/plain"` e `text`. Não recebe multipart, PDFs ou fotos reais.
   `kind`: `carta_indeferimento`, `cnis`, `ctps`, `laudo`, `outro`.
   Páginas sintéticas são separadas por form feed (`\f`).
5. O extrator reconhece apenas linhas rotuladas como `Renda familiar: ...`,
   `Composição familiar: ...`, `Motivo do indeferimento: ...`. Retorna candidatos
   com documento, página e trecho; não interpreta texto livre ou comandos.
6. `POST /cases/:id/facts`: registra `field`, `value`, `origin` e, para fatos
   documentais, `evidence: {documentId, page, quote}`. A página e o trecho são
   verificados. O valor interpretado ainda exige conferência humana.
7. `POST /cases/:id/facts/:factId/confirm`, corpo `{"confirmed": true}`:
   confirma a leitura documental. Isso não certifica autenticidade ou validade.
8. `GET /cases/:id/interview`: próxima pergunta. Dados cadastrais são respondidos
   pelo PATCH, documentos pelo upload e confirmações pela rota de confirmação.
9. `POST /cases/:id/interview/messages`: corpo `{"field":"composicao_familiar",
   "answer":"Duas pessoas fictícias"}`. Salva como declaração, sem promovê-la
   a prova. Divergências ficam preservadas e pedem esclarecimento.
10. `POST /cases/:id/analyze`, corpo `{"mode":"demonstracao"}`: análise
    síncrona local. `real` é rejeitado. Fila e jobs são etapas posteriores.
11. `GET /cases/:id/analysis`: última análise da revisão atual do caso.
12. `GET /cases/:id/report`: PDF preliminar com aviso de demonstração.

Mudanças de dados invalidam análise e PDF anteriores. Documento repetido, com
mesmo conteúdo e espécie, não duplica fatos nem invalida a análise.

Limites: corpo HTTP 150 KB; texto 100 mil caracteres; 30 páginas; 10 documentos;
100 fatos; 50 respostas por caso. Erros de validação não devolvem valores de
documentos. Há eventos de auditoria sem conteúdo pessoal. Não há limite global
de casos, proteção distribuída ou política de retenção automatizada nesta fase.

## Organização e decisões

- `domain.ts`: contratos internos em inglês e resultado analítico em português,
  conforme AGENTS.md. O exemplo JSON original foi mantido sem alterações.
- `storage.ts`: SQLite local, casos segregados por proprietário e eventos.
- `documents.ts`: extrator sintético substituível e proveniência verificável.
- `interview.ts`: perguntas por lacunas, confirmação e divergências.
- `knowledge.ts`: busca lexical combinada com vetores locais demonstrativos.
  Não são embeddings de um modelo semântico. Vigência, benefício e jurisdição
  são filtrados antes do ranking. Fonte draft nunca entra em busca real.
- `rules.ts`: resultados trivalentes; aplicabilidade e revisão em campos
  separados. Regra real exige aprovação, revisor e fonte aprovada/verificada.
  Não existe regra jurídica real incluída ou endpoint para aprová-la.
- `investigation.ts`: coordenador local substituível por adaptador de análise;
  não chama LLM. Todas as análises permanecem indeterminadas juridicamente.
- `reports.ts`: PDF com fatos, hipóteses investigativas, argumentos contrários,
  regras, fontes, lacunas, prazos a verificar e limites.

A única regra demonstrativa verifica completude documental, não elegibilidade.
O utilitário de união de períodos civis não calcula carência ou tempo
previdenciário. Não foram introduzidos valores ou prazos jurídicos fictícios.

## Segurança e limites de validação

Testes verificam isolamento entre identidades, validação de entradas, persistência,
deduplicação, bloqueio de fontes/regras, evidências e invalidação de relatórios.
O texto de documentos nunca é executado como instrução. Isso não comprova defesa
de um LLM real, pois esse componente ainda não foi integrado.

Não há antivírus, OCR, RLS Supabase, criptografia de banco em repouso, fila,
autenticação de produção, revisão jurídica, cobrança ou interface comercial.
O diretório do banco tem criação privada, mas esta versão não é homologada para
dados pessoais. Não foi realizado teste de carga ou avaliação jurídica.

A fonte oficial BPC continua intacta em `data/legal-sources/`, em estado draft.
Não foi indexada como fonte aprovada. Nenhuma nova coleta oficial foi alegada.

## Próxima entrega

Cadastro e versionamento persistente de fontes/passagens, importação local
auditável da coleta existente sem aprovação automática e testes de vigência.
Depois, integrar PDF/OCR e pesquisa oficial incremental. Um primeiro subtipo só
poderá gerar conclusões reais após fontes e regras revisadas por profissional
qualificado. As dependências de produto/LGPD continuam no roadmap original.
