# Estabilização técnica — IA Previdenciária INSS

Data: 30/10/2026. Branch exclusiva: `codex/previdenciario-4-modulos`. Base: `0e8d726c40677913dfde8a48aa6b878c01b9dfc3`.

## Resultado final

A suíte completa tem **120 testes aprovados, zero reprovados e zero pulados**, em 14 arquivos. Foram acrescentados 62 casos de regressão em relação aos 58 casos originais (um deles anteriormente bloqueado).

| Nível / verificação                    | Execução real                                                                     |     Aprovados | Reprovados / pulados |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------: | -------------------: |
| Simples / suíte completa               | `npm test`                                                                        |           120 |                0 / 0 |
| Médio / seleção de regressões e falhas | Seis arquivos listados abaixo                                                     |            73 |                0 / 0 |
| Alto estresse local                    | Seis rodadas completas; até três processos simultâneos; dois workers por processo | 720 execuções |                0 / 0 |
| TypeScript                             | `./node_modules/.bin/tsc --noEmit`                                                |       saída 0 |          nenhum erro |
| Lint                                   | `npm run lint`                                                                    |       saída 0 |   0 erros; 16 avisos |
| Build local                            | `npm run build`                                                                   |       saída 0 |    nenhum erro fatal |
| Whitespace do diff                     | `git diff --check`                                                                |       saída 0 |          nenhum erro |

São 120 casos distintos. Os 73 casos médios são um subconjunto e as 720 execuções de estresse repetem a suíte; não representam novos casos distintos. Cada rodada inclui 10.000 nomes adversariais no teste de estabilidade do sanitizador: 60.000 nomes no ensaio final de estresse.

## Correções

- O teste de rotas simula o adaptador Cloud, força ausência das quatro variáveis Supabase antes das importações e testa seis rotas conhecidas mais um caminho inexistente. Não há credenciais de produção nem credenciais inventadas.
- O setup dos testes bloqueia `fetch` por padrão e restaura mocks/variáveis entre casos. Os testes de upload simulam autenticação, armazenamento e metadados; usam somente valores sintéticos e criptografia local.
- O upload usa `sanitizeDocumentName`, preservando a política anterior: substituir controles ASCII 0–31 e separadores por `_`, depois limitar a 180 unidades UTF-16. A regex que gerava `no-control-regex` foi substituída por inspeção de caracteres.
- A regressão do sanitizador cobre os 32 controles, barras, nomes normais, acentos, emoji, nome vazio, limite de tamanho e repetição adversarial.
- A regressão do handler cobre sucesso, falta de autenticação, identificador inválido, falha de armazenamento e remoção do objeto novo quando falha o registro dos metadados.
- O `.gitignore` protege arquivos `.env` e variantes, `.dev.vars`, diretórios de segredos/credenciais, chaves privadas e formatos comuns de credenciais. Dezesseis testes verificam exclusões e preservação de arquivos normais, sem escrever credenciais.
- Os 1.425 erros anteriores de lint foram eliminados: a regex e os erros de formatação. Não foram desabilitadas regras de lint para mascarar os erros. Os 16 avisos existentes de Fast Refresh foram preservados.

## Preservação do comportamento

Cinquenta e sete arquivos têm somente mudanças de formatação, conferidas por comparação após normalização repetida com a configuração original do Prettier. Os sete arquivos jurídicos afetados estão nesse conjunto: nenhum cálculo, critério previdenciário, prazo ou fonte foi modificado. Dependências, lockfile e configuração Vitest não foram alterados.

## Execuções intermediárias e correção da instabilidade

Uma execução inicial encontrou incompatibilidade do ambiente Node de um teste novo com o setup de navegador. O teste passou a usar o ambiente padrão do projeto.

Na primeira rodada de estresse, três processos falharam no `beforeAll` do teste de rotas: a importação da árvore de páginas excedeu 10 segundos enquanto build e outros checks disputavam CPU. Cada processo teve 113 casos aprovados e sete pulados por falha da suíte; os três processos seguintes passaram com 120 casos cada.

O teste de rotas passou a usar importação estática com mock e variáveis preparados por `vi.hoisted`, retirando a importação pesada do hook temporizado. O limite global não foi aumentado. A repetição do ensaio passou nas seis rodadas. Os resultados intermediários e finais estão registrados no JSON de evidências.

## Reprodução

```sh
npm test
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
./node_modules/.bin/vitest run src/test/document-upload.test.ts src/test/document-filename.test.ts src/test/gitignore.test.ts src/test/app-routing.test.tsx src/test/document-policy.test.ts src/test/investigation-audio.test.tsx
```

Para reproduzir o ensaio de estresse, execute seis vezes `./node_modules/.bin/vitest run --maxWorkers=2`, mantendo até três processos simultâneos e verificando o código de saída de cada um. O processo que conduziu o ensaio usou `ThreadPoolExecutor(max_workers=3)` do Python para agendar as seis execuções, sem alterar código/configuração entre rodadas.

## Pendências e limites

- Permanecem 16 avisos `react-refresh/only-export-components`. São avisos de organização dos exports para desenvolvimento; eliminá-los exigiria separar módulos, fora da correção mínima de lint solicitada.
- O build mantém avisos de empacotamento, incluindo fallback WebAssembly do Shiki. A compilação concluiu; isso não comprova compatibilidade completa no ambiente de hospedagem.
- O ensaio de estresse mede repetição e concorrência dos testes locais. Não é teste de capacidade de produção, banco real ou provedores externos.
- Autenticação real, RLS entre contas, migrações aplicadas, extração, transcrição e IA externa continuam sem validação ponta a ponta nesta etapa. Nenhuma chamada de integração real foi executada pelos testes.
- `.gitignore` não detecta segredos arbitrários embutidos em código e não remove segredos previamente versionados. Nenhum arquivo de credencial foi acrescentado nesta etapa.
- A base jurídica permanece preliminar e sem homologação. O Módulo 1 não foi iniciado.

A `main` permanece em `a445b20e7be9f4e2b1f1b68d72033a596530423a`. Não houve publicação, ativação de serviços pagos, cobrança ou uso de dados reais de clientes.

## Arquivos alterados

### Alterações técnicas e testes

- `.gitignore`
- `src/lib/document-policy.ts`
- `src/routes/api/private-document-upload.ts`
- `src/test/app-routing.test.tsx`
- `src/test/setup.ts`
- `src/test/document-filename.test.ts`
- `src/test/document-upload.test.ts`
- `src/test/gitignore.test.ts`

### Somente formatação (57 arquivos)

- `src/components/ai-elements/conversation.tsx`
- `src/components/ai-elements/message.tsx`
- `src/components/ai-elements/prompt-input.tsx`
- `src/components/ai-elements/tool.tsx`
- `src/components/context-probe.tsx`
- `src/components/investigation-shell.tsx`
- `src/components/previdenciary-assistant.tsx`
- `src/components/private-documents.tsx`
- `src/components/shell.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/input-group.tsx`
- `src/components/ui/spinner.tsx`
- `src/generated/ai-gateway/models.d.ts`
- `src/integrations/supabase/auth-attacher.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/cron-auth.ts`
- `src/integrations/supabase/previewAuthStorage.ts`
- `src/integrations/supabase/types.ts`
- `src/lib/api/adapter.ts`
- `src/lib/api/cloud-adapter.ts`
- `src/lib/api/document.functions.ts`
- `src/lib/api/gemini.server.ts`
- `src/lib/api/types.ts`
- `src/lib/auth-messages.ts`
- `src/lib/case-model.ts`
- `src/lib/demo-cases.ts`
- `src/lib/example-flow.ts`
- `src/lib/gemini-model-policy.ts`
- `src/lib/legal-registry.ts`
- `src/lib/legal/contextual.ts`
- `src/lib/legal/engine.ts`
- `src/lib/legal/periods.ts`
- `src/lib/legal/report.ts`
- `src/lib/legal/routing.ts`
- `src/lib/legal/sources.ts`
- `src/routes/_authenticated/investigacao.$threadId.painel.tsx`
- `src/routes/_authenticated/investigacoes.tsx`
- `src/routes/_authenticated/privacidade.tsx`
- `src/routes/acompanhamento.tsx`
- `src/routes/api/investigation-chat.ts`
- `src/routes/api/public/document-retention.ts`
- `src/routes/conferencia.tsx`
- `src/routes/documentos.tsx`
- `src/routes/exemplos.tsx`
- `src/routes/index.tsx`
- `src/routes/perguntas.tsx`
- `src/routes/questionario.tsx`
- `src/routes/resultado.tsx`
- `src/test/beneficio-pergunta.test.ts`
- `src/test/contextual-probe.test.ts`
- `src/test/document-policy.test.ts`
- `src/test/example-flow.test.ts`
- `src/test/gemini-model-policy.test.ts`
- `src/test/legal-engine.test.ts`
- `src/test/legal-routing.test.ts`

### Documentação desta etapa

- `docs/RELATORIO-ESTABILIZACAO-TECNICA.md`
- `docs/evidencias-estabilizacao.json`
