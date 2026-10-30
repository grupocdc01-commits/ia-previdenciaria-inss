# Módulo 3 — Documentos, períodos e relatório administrativo

Data: 30/10/2026. Branch exclusiva: `codex/previdenciario-4-modulos`.

## Estado e alcance

A parte administrativa foi implementada, com habilitação desativada por padrão. Este trabalho não libera o cálculo previdenciário especializado. O catálogo jurídico continua sem homologação; não há cálculo oficial de tempo de contribuição, carência, elegibilidade, renda, prazo, escolha automática de medida ou PDF. Regras e fórmulas previdenciárias existentes não foram alteradas. A validação técnica de datas foi endurecida para rejeitar datas inexistentes, sem normalizá-las silenciosamente.

O código original recuperado e as funcionalidades anteriores foram preservados. Não houve publicação, alteração da `main`, uso de dados reais ou chamada de extração paga durante este trabalho. Nenhuma migração foi aplicada a banco externo.

## Conferência de documentos

CNIS e CTPS continuam opcionais. Upload, acesso temporário e extração administrativa já existiam; não foi reconstruído um leitor ou OCR. O novo fluxo aproveita a extração existente e oferece, por campo, `pending`, `confirmed` ou `rejected`. “Confirmado” significa apenas que o titular comparou o campo com o documento: não comprova autenticidade, vínculo ou direito. A revisão jurídica humana é uma etapa diferente.

A conferência não modifica texto, citação, página ou modelo da extração. Uma sugestão incorreta pode ser rejeitada. Retificação textual da extração não foi implementada; um período independente pode ser informado como declarado. Documentos médicos não podem ser conferidos neste fluxo. Extrações inválidas não derrubam a seleção de campos nem são apresentadas como verificadas.

A migração `0006_document_field_reviews.sql` acrescenta a revisão atual ao documento e um histórico de revisões associado ao arquivo. A função transacional `review_document_fields`:

- exige sessão autenticada e propriedade do documento e da investigação;
- bloqueia o registro durante a gravação e confere hash, versão e snapshot da extração;
- rejeita documentos vencidos/em exclusão e decisões fora do domínio ou com quantidade diferente dos campos;
- rejeita revisão antiga e reconhece uma repetição idêntica após perda de resposta;
- grava a revisão atual e o histórico na mesma transação;
- não concede escrita direta ao cliente; o histórico tem RLS por proprietário e acompanha a exclusão do documento por cascata.

O histórico registra confirmações do titular, não homologação de advogado. Não cria um prazo de retenção novo. A migração foi escrita manualmente para o esquema existente, sem inventar snapshots do Drizzle a partir do esquema vazio do projeto.

## Períodos e relatório

Cada período possui origem explícita: declarado ou datas conferidas em documento. O titular escolhe os campos de início e fim; o sistema não infere pareamento entre vínculos ou empregadores. Períodos documentais exigem os dois campos confirmados na revisão vigente e preservam ID do documento, SHA-256, versão de extração, revisão, índices de campos e páginas. Essa trilha identifica a origem, sem validar o conteúdo como prova.

A aritmética ocorre somente no servidor: união inclusiva dos intervalos, dias em intervalos conferidos, dias exclusivamente declarados e dias de duplicidade removidos. Os rótulos não chamam o resultado de contribuição ou carência. Não há conversão para meses, aplicação de fatores especiais ou aproveitamento automático desses intervalos pelo motor jurídico. O validador exige datas reais, em ordem, desde 1900 e sem futuro na data de referência de São Paulo.

O relatório mostra sobreposições, lacunas, origem dos intervalos, referências candidatas do catálogo e próximos passos de conferência. Referências continuam rotuladas como pendentes de revisão jurídica e não fundamentam conclusões liberadas. Possíveis caminhos administrativos/judiciais são apresentados para avaliação profissional, sem escolher uma medida ou calcular prazo. Um relatório deixa de ser exibido se a lista recebida na tela indicar mudança da revisão ou retirada do documento. A conferência final usa uma leitura do banco no momento da solicitação; não é um documento jurídico imutável ou assinado.

Limites: 100 documentos por relatório, 500 períodos, 100 campos por extração e corpo de requisição de até 128 KiB inclusive por streaming. Sobreposições são contadas integralmente, mas a interface recebe no máximo 100 avisos, com indicação quando há outros. O excesso de documentos é recusado explicitamente, sem truncamento silencioso.

A seleção de períodos e o relatório ficam na memória React. Não são gravados em `localStorage`, não são exportados nem retomados após recarregar/sair da tela. Conferências de campos, diferentemente dessa seleção, têm persistência e histórico previstos no banco. Anexos anteriores não são migrados nem analisados automaticamente.

## Habilitação futura em homologação

`DOCUMENT_DOSSIER_ENABLED` permanece ausente/desativada. Sem o valor exato `true`, a nova API retorna 503 antes de autenticar e a interface não oferece conferência/relatório. Isso é independente do bloqueio jurídico e das aprovações já existentes para processamento externo: habilitar o relatório não configura Gemini, pagamentos ou PDF.

Antes de habilitar, revisar e aplicar a migração em homologação, validar permissões/RLS com contas sintéticas e executar navegação autenticada via PostgREST real. O PostgreSQL local usado nos testes simula `auth.uid()` e esquemas mínimos do Supabase; não substitui esses testes de integração.

## Arquivos principais

| Arquivo                                                                       | Alteração                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/document-dossier-schema.ts`                                          | Contratos estritos de revisão/períodos e datas de calendário                         |
| `src/lib/api/document-dossier.server.ts`                                      | Conferência autenticada e relatório administrativo no servidor                       |
| `src/routes/api/document-dossier.ts`                                          | Entrada com bloqueio por configuração, sessão e respostas privadas                   |
| `src/components/document-field-review.tsx`                                    | Conferência explícita de campos, sem edição da extração                              |
| `src/components/document-dossier.tsx`                                         | Seleção em memória e exibição do relatório                                           |
| `src/components/private-documents.tsx`                                        | Integração opcional, tratamento de extração inválida e prevenção de clique duplicado |
| `src/lib/api/document.functions.ts`                                           | Consulta autenticada de disponibilidade do módulo                                    |
| `src/lib/api/cloud-adapter.ts`                                                | Acesso ao novo endpoint pelo adaptador                                               |
| `src/lib/legal/periods.ts`                                                    | Rejeição de datas de calendário inválidas, sem mudar fórmulas                        |
| `src/routes/_authenticated/investigacao.$threadId.painel.tsx`                 | Distinção entre conferência administrativa e prova jurídica                          |
| `src/integrations/supabase/types.ts`                                          | Contratos das colunas, histórico e RPC novos                                         |
| `src/routeTree.gen.ts`                                                        | Registro gerado da rota                                                              |
| `drizzle/migrations/0006_document_field_reviews.sql` e `meta/_journal.json`   | Migração transacional e registro no histórico de migrações                           |
| `scripts/check_anamnesis_database.py`                                         | Compartilhamento do ambiente local isolado com os testes do Módulo 3                 |
| `scripts/check_document_database.py`                                          | Integração SQL, RLS, rollback, repetição e concorrência                              |
| `src/test/document-dossier*.test.*` e `src/test/fixtures/document-dossier.ts` | Testes novos e dados exclusivamente sintéticos                                       |
| `README.md`, este relatório e arquivos de evidências                          | Estado, resultados e reprodução das verificações                                     |

## Verificações executadas

Resultado final: **305 testes distintos aprovados, zero reprovados**: 276 Vitest em 25 arquivos, 7 Python do capturador de fontes e 22 SQL (12 novos e 10 regressões herdadas do Módulo 2). Foram adicionados 52 testes de aplicação e 12 testes SQL neste módulo. As seis repetições abaixo não aumentam o número de testes distintos.

| Nível de domínio    |    Resultado | Cobertura                                                                                                                       |
| ------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------- |
| Simples             |  4 aprovados | Documentos opcionais, união de intervalos, origem, limites inclusivos e ano bissexto                                            |
| Médio               | 18 aprovados | Datas impossíveis/futuras/invertidas, revisão antiga, ausência/exclusão/expiração, campos não confirmados e contratos inválidos |
| Alto estresse local |  2 aprovados | 500 intervalos duplicados com diagnósticos limitados; 200 relatórios lógicos independentes                                      |

As execuções filtradas por nível marcam os demais testes desse arquivo como ignorados pelo filtro (20, 6 e 22 respectivamente); os 24 testes foram executados em todas as suítes completas, sem ignorados. Os outros 28 testes novos cobrem API, autenticação ausente, configuração desabilitada, limite de corpo, isolamento, erros de banco, conservação das escolhas após falha, cliques duplicados, extração inválida e ocultação de relatório antigo.

Estabilidade: **6 suítes completas × 276 = 1.656 execuções aprovadas**, zero falhas, até 3 processos simultâneos com `--maxWorkers=2` cada. Cada rodada levou entre 42,80 e 51,03 segundos. Isso verifica repetição/concorrência local de testes, não capacidade para milhares de usuários. As 200 solicitações de domínio são tarefas lógicas no mesmo processo, não 200 sessões HTTP reais.

No PostgreSQL descartável, duas baterias novas de 20 chamadas concorrentes (até 8 conexões) verificaram repetição idempotente e decisões concorrentes. Uma única revisão foi gravada em cada cenário. Na disputa entre duas decisões, tentativas idênticas à vencedora receberam confirmação de duplicata; as demais foram rejeitadas. Também foram testados RLS, acesso anônimo, escrita direta, snapshot alterado, expiração, documento médico, cascata e rollback por falha injetada no histórico. As 10 regressões do Módulo 2 passaram após aplicar todas as sete migrações no banco local.

O contêiner `inss-module3-local`, PostgreSQL fixado por digest, foi executado com `--network none`, sem portas publicadas, sem senha de produção e com usuários sintéticos. Foi removido junto com seu volume após os testes. Não houve conexão com Supabase externo nem PostgREST real.

TypeScript: aprovado, zero erros. Lint: zero erros, 16 avisos anteriores de Fast Refresh. Build: aprovado, sem publicação. `git diff --check`: aprovado.

Uma execução inicial teve **273 testes aprovados e 1 falha de timeout**: o `beforeEach` de um teste novo retornava o mock, que era interpretado como função de limpeza e permanecia pendente. O hook foi corrigido para retornar `void`; a suíte seguinte passou em 274 testes. Foram então acrescentadas duas regressões de interface (extração inválida e relatório antigo), ambas aprovadas; as seis suítes finais executaram todos os 276 testes. A primeira checagem TypeScript também detectou a rota ainda não gerada; o build gerou a árvore, e a verificação final passou. Essas falhas iniciais não foram ocultadas nem contadas como aprovações.

### Reprodução

Com as dependências já instaladas pelo lockfile:

```sh
npm test -- --maxWorkers=2
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
python3 -m unittest discover -s scripts -p 'test_*.py'
./node_modules/.bin/vitest run src/test/document-dossier.test.ts -t 'module 3 simple'
./node_modules/.bin/vitest run src/test/document-dossier.test.ts -t 'module 3 medium'
./node_modules/.bin/vitest run src/test/document-dossier.test.ts -t 'module 3 high stress'
```

Para a bateria SQL, criar um PostgreSQL **descartável local**, imagem `postgres@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab`, nome `inss-module3-*`, rede `none` e sem portas; executar `ANAMNESIS_TEST_CONTAINER=<nome-local> python3 scripts/check_document_database.py`. O script recusa conexão por URL e valida isolamento/imagem antes de criar um banco aleatório, que é excluído ao final. Remover também o contêiner e seu volume. A autenticação `trust` é exclusiva desse ambiente local sem rede; não é configuração de homologação ou produção.

A repetição paralela utilizou `ThreadPoolExecutor(max_workers=3)` para executar seis vezes o comando `vitest run --maxWorkers=2`, verificando código de saída zero e 276 aprovações em cada log. Comandos e resultados estão em [evidências estruturadas](evidencias-modulo-3.json) e [logs consolidados](evidencias-modulo-3-resultados.txt).

## Pendências

- Homologação jurídica, fonte a fonte, continua pendente no Módulo 1.
- Cálculo oficial de contribuição, carência por competência e regras especiais exige especificação versionada, fontes conferidas e validação jurídica humana; o módulo não está liberado juridicamente.
- Migração real, PostgREST, sessão real, múltiplas abas e navegação ponta a ponta em homologação não foram executados.
- Não houve extração real por Gemini/OCR, teste com arquivo pessoal, teste de carga de produção ou acesso a serviços públicos para este módulo.
- Correção textual de campos, persistência da seleção de intervalos e relatório completo/PDF não foram habilitados.
- Permanecem os avisos anteriores de Fast Refresh no lint.
- Módulo 4 não iniciado; nenhuma funcionalidade comercial ou pagamento foi ativado.
