# Módulo 1 — Base jurídica e jurisprudência

Data: 30/10/2026. Branch: `codex/previdenciario-4-modulos`. Base técnica anterior: `f02abfa33e4c6716d60a0a6f93b0d5f212d0914e`.

## Estado da entrega

**Estrutura técnica implementada e testada; conteúdo jurídico não homologado.** Nenhuma referência está liberada para conclusões jurídicas. Nenhum novo cálculo ou critério previdenciário foi implementado. O Módulo 2 não foi iniciado.

O catálogo tem nove referências candidatas: seis de legislação e três de jurisprudência. As referências, datas e versões preexistentes foram preservadas como informações a conferir, sem presumir que o texto consolidado tenha vigorado durante todo o intervalo informado.

## Funcionalidades

- Tela `/biblioteca`, acessível pelo menu “Base jurídica”, com busca por norma, artigo e precedente; filtro por tipo, data de referência e paginação.
- Consulta por função de servidor GET, através de `CloudCaseAdapter`, sem banco, IA externa, credenciais ou dados de clientes. O aplicativo continua sujeito à configuração original do Supabase para seus demais fluxos.
- Identificação do tribunal, tema/súmula, processo quando já informado, documento específico e alcance. Campos desconhecidos permanecem nulos; os links genéricos dos tribunais não são tratados como inteiro teor conferido.
- Schema estrito para endereços HTTPS oficiais, datas de calendário, vigência, revisões, captura, SHA-256, responsável, prazo de nova conferência e histórico.
- Catálogo imutável em memória e versionado no Git. `catalog-updates.json` recebe futuras revisões completas, mantendo versões anteriores. Revisões duplicadas, lacunas e reescrita do histórico são rejeitadas.
- Atualização produz rascunho, limpa captura/aprovação anteriores e exige nova revisão. A consulta padrão escolhe a revisão mais recente, sem recorrer silenciosamente a uma versão antiga aprovada.
- Uma captura não concede confiança jurídica. Para uso de uma referência são necessários identificação documental conferida, hash correspondente, revisão humana com responsável/data/escopo/prazo, vigência confirmada e situação aplicável. Precedentes também exigem documento específico correspondente à captura, alcance e processo para temas.
- Citações precisam indicar versão e dispositivo cadastrado. Versão desconhecida, dispositivo não cadastrado, data futura, situação revogada/superada/suspensa, revisão vencida e dados inconsistentes bloqueiam o uso.
- O motor e o encaminhamento consultam esses bloqueios, considerando a data de referência do caso. O relatório técnico expõe a trilha de auditoria e mantém a liberação bloqueada. O relatório simples deixa de apresentar “parece cumprido” quando as referências não estão conferidas.

Os cálculos de idade, renda, períodos, contribuição e carência e os critérios existentes permanecem intactos. As alterações no motor limitam-se à confiança das citações e à propagação da data para a auditoria. Nenhuma regra executável foi homologada.

## Fontes oficiais consultadas nesta sessão

Foram feitas seis consultas pontuais, com no máximo duas conexões simultâneas, sem repetição automática. Não houve teste de carga em órgãos públicos.

| Referência candidata         | Resultado observado                             |
| ---------------------------- | ----------------------------------------------- |
| Lei 8.213/1991, Planalto     | HTTP 503                                        |
| Decreto 3.048/1999, Planalto | HTTP 503                                        |
| EC 103/2019, Planalto        | HTTP 503                                        |
| Lei 8.742/1993, Planalto     | HTTP 503                                        |
| Lei 10.259/2001, Planalto    | HTTP 503                                        |
| IN PRES/INSS 128/2022, DOU   | Texto capturado; identidade e revisão pendentes |

A origem da captura foi o [DOU — IN PRES/INSS 128/2022](https://www.in.gov.br/en/web/dou/-/instrucao-normativa-pres/inss-n-128-de-28-de-marco-de-2022-389275446). O extrator reteve apenas texto do contêiner normativo `texto-dou`, sem scripts, estilos, atributos ou conteúdo externo ao ato. O HTML bruto do portal não foi versionado.

O SHA-256 do texto extraído é `9b710de04719d96deefd68ef132a342053a702c0228840da44ce8448b176e81f`. O hash dos bytes de transporte está no recibo, separadamente. A normalização é identificada como `texto-dou-v1`; esse hash **não** é uma assinatura do órgão nem comprova atualização, vigência ou conteúdo jurídico correto.

As capturas e os recibos estão em `docs/fontes-oficiais/`. A projeção de metadados usada pelo catálogo fica em `src/lib/legal/capture-data.json`. Um teste compara os bytes versionados com o tamanho e hash declarados. As três referências de jurisprudência seguem como candidatas, sem inteiro teor conferido.

## Revisão e atualização controladas

1. Localizar o texto oficial, alterações, versão temporalmente aplicável e, para jurisprudência, documento específico, processo, situação, modulação e alcance. Não usar o link de pesquisa como prova da tese.
2. Obter uma captura sem credenciais e conferir a identidade e os bytes. O capturador atual reconhece o contêiner do DOU; não é um capturador genérico de Planalto, STF, STJ ou PDFs. Falta de formato reconhecido gera indisponibilidade, nunca aprovação automática.
3. Usar `proposeLegalRevision` para preparar uma nova versão e acrescentar o registro completo a `catalog-updates.json`. A função não persiste nem aprova: a gravação é feita por alteração revisada no repositório. Não remover a versão anterior nem alterar o prefixo de seu histórico.
4. Um profissional jurídico responsável deve conferir os dispositivos efetivamente citados, vigência dessa versão, texto e situação do precedente. Registrar referência interna do responsável e do parecer, escopo, data, hash e prazo explícito de nova conferência. Nenhum nome, OAB, parecer ou aprovação foi inventado nesta entrega.
5. Acrescentar o evento `revisao` correspondente à data de aprovação. Uma aprovação sem captura identificada, hash correspondente, responsável, prazo, escopo e histórico é inválida. Mesmo um registro aprovado fica bloqueado se fora da vigência, desatualizado, futuro ou não aplicável.
6. Executar testes, revisar o diff e submeter a PR. Não há endpoint público para cadastrar/aprovar referências, agendamento de atualização ou aplicação de migrações nesta entrega.

Exemplo de captura manual, a executar somente quando desejado:

```sh
python scripts/capture-legal-sources.py scripts/legal-capture-targets.json ../work/captura-juridica
```

Compare os recibos e textos antes de importar novos metadados. A saída de uma captura não altera automaticamente o catálogo nem a aprovação.

## Testes executados na versão final

| Verificação                 |     Aprovados |     Reprovados | Observação                                                                     |
| --------------------------- | ------------: | -------------: | ------------------------------------------------------------------------------ |
| Suíte principal             |           160 |              0 | 17 arquivos; nenhum caso pulado                                                |
| Capturador Python           |             7 |              0 | HTTP, redirecionamento, tamanho e extração simulados; sem rede                 |
| Simples do catálogo         |             4 |              0 | Busca, paginação, referências candidatas e integridade da captura              |
| Médio do catálogo           |            28 |              0 | Datas/URLs inválidas, revisão/hash/vigência, citações, histórico e bloqueios   |
| Estresse local do catálogo  |             2 |              0 | 5.000 registros, limite de 50 resultados e 200 leituras via Promise.all        |
| Repetição paralela completa | 960 execuções |              0 | Seis rodadas de 160; até três processos simultâneos, dois workers por processo |
| TypeScript                  |       saída 0 |        0 erros | `tsc --noEmit`                                                                 |
| Lint                        |       saída 0 |        0 erros | 16 avisos Fast Refresh preexistentes                                           |
| Build local                 |       saída 0 | 0 erros fatais | Nenhuma implantação                                                            |

São **167 casos distintos**, somando TypeScript e Python. Os testes por nível são subconjuntos dos 160 e as 960 execuções repetem esses casos; não são testes distintos adicionais. As execuções filtradas pulam deliberadamente os outros níveis; todos os casos foram exercitados na suíte completa.

As 200 leituras via Promise.all são consultas síncronas agendadas no mesmo processo, não 200 usuários reais. O paralelismo efetivo adicional foi exercitado pelos processos Vitest separados. Não foi medido throughput de produção, banco ou provedor externo.

Também há testes de componente para busca, paginação, carregamento, erro de serviço, repetição explícita e apresentação das pendências. Todas as chamadas de negócio são simuladas e `fetch` é bloqueado no setup. Nenhuma credencial ou dado real de cliente foi utilizado.

Comandos de reprodução:

```sh
npm test
python -m unittest discover -s scripts -p 'test_*.py'
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
./node_modules/.bin/vitest run src/test/legal-catalog.test.ts -t 'Módulo 1 — simples'
./node_modules/.bin/vitest run src/test/legal-catalog.test.ts -t 'Módulo 1 — médio'
./node_modules/.bin/vitest run src/test/legal-catalog.test.ts -t 'Módulo 1 — alto estresse local'
```

Para repetir o ensaio paralelo, executar seis vezes `./node_modules/.bin/vitest run --maxWorkers=2`, com no máximo três processos simultâneos e checagem individual do código de saída. Os resultados e os hashes dos logs estão em `docs/evidencias-modulo-1.json`.

## Pendências de homologação e limites

- Conferir todas as nove referências e os dispositivos citados com um profissional jurídico. As datas históricas e versões importadas não foram homologadas.
- Capturar as cinco normas do Planalto quando o acesso estiver disponível, observando alterações e consolidações. HTTP 503 não demonstra inexistência ou revogação da norma.
- Localizar e conferir documentos específicos, processos, tese, exceções, modulação e situação atual dos três precedentes. Não presumir aplicabilidade porque o tema ou a súmula foi identificado.
- Revisar a IN 128 capturada e suas alterações posteriores. A captura é do endereço da publicação original, não uma garantia de consolidação atualizada.
- Definir prazos de revisão por política jurídica. Nenhuma duração arbitrária foi adotada para liberar fontes.
- Não há migração de banco nesta etapa: catálogo e revisões são mantidos no Git. A tabela legada `legal_rule_versions` não foi alterada nem apresentada como integrada ao catálogo.
- A tela foi validada por componentes e geração de rotas; não houve navegação ponta a ponta com sessão real, aplicação de migrações ou validação de RLS. Permanecem os 16 avisos Fast Refresh e os avisos não fatais do empacotador já observados.
- O Módulo 1 técnico não libera a análise jurídica completa, pagamentos ou PDF. Os demais módulos não foram iniciados.

Não houve publicação, merge em main, ativação de serviços pagos ou cobrança. A branch `main` deve permanecer em `a445b20e7be9f4e2b1f1b68d72033a596530423a`.

## Arquivos desta entrega

- `.gitignore`
- `README.md`
- `docs/MODULO-1-BASE-JURIDICA.md`
- `docs/evidencias-modulo-1.json`
- `docs/fontes-oficiais/README.md`
- `docs/fontes-oficiais/capturas.json`
- `docs/fontes-oficiais/in-128-9b710de04719d96deefd68ef132a342053a702c0228840da44ce8448b176e81f.txt`
- `scripts/capture-legal-sources.py`
- `scripts/legal-capture-targets.json`
- `scripts/test_capture_legal_sources.py`
- `src/components/investigation-shell.tsx`
- `src/components/legal-library-page.tsx`
- `src/components/legal-library.tsx`
- `src/lib/api/cloud-adapter.ts`
- `src/lib/api/legal-library.functions.ts`
- `src/lib/legal-registry.ts`
- `src/lib/legal/capture-data.json`
- `src/lib/legal/catalog-schema.ts`
- `src/lib/legal/catalog-updates.json`
- `src/lib/legal/catalog.ts`
- `src/lib/legal/engine.ts`
- `src/lib/legal/report.ts`
- `src/lib/legal/routing.ts`
- `src/lib/legal/source-data.ts`
- `src/lib/legal/sources.ts`
- `src/routeTree.gen.ts`
- `src/routes/biblioteca.tsx`
- `src/test/app-routing.test.tsx`
- `src/test/legal-catalog.test.ts`
- `src/test/legal-library-page.test.tsx`
- `src/test/legal-library-view.test.tsx`
