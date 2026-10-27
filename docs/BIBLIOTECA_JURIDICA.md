# Biblioteca jurídica versionada

Diretório adicional de TRFs, Jusbrasil e consulta processual INSS:
[FONTES_DE_PESQUISA.md](FONTES_DE_PESQUISA.md). Cadastro de portais e coleta de
documentos são estados distintos; consulte `GET /library/resources`.

## Entrega

A biblioteca agora tem catálogo persistente em SQLite, importação local por ID e
hash, originais imutáveis, extração em trechos, histórico de revisão e busca
textual. A API diferencia curadoria de consulta aprovada. O agente demonstrativo
continua separado: nenhuma fonte draft foi ativada como regra ou conclusão.

Foi consultado o robots do Planalto, que não ficou disponível nesta tentativa.
As seis URLs prioritárias desse portal foram registradas como não coletadas.
Foram localizadas versões oficiais no portal da Câmara dos Deputados, cujo
robots permitiu as rotas consultadas. Não houve contorno de autenticação ou
challenge, coleta em massa, nem consulta a dados de segurados.

## Acervo inicial real

| Documento | Origem | Estado |
| --- | --- | --- |
| Constituição Federal | Câmara dos Deputados, texto apresentado como atualizado | draft |
| EC 103/2019 | Câmara dos Deputados, publicação original | draft |
| Lei 8.212/1991 | Câmara dos Deputados, texto apresentado como atualizado | draft |
| Lei 8.213/1991 | Câmara dos Deputados, texto apresentado como atualizado | draft |
| Lei 8.742/1993 — LOAS | Câmara dos Deputados, texto apresentado como atualizado | draft |
| Decreto 3.048/1999 | Câmara dos Deputados, texto apresentado como atualizado | draft |
| Orientação BPC/deficiência | INSS, coleta anterior preservada | draft |

São sete versões arquivadas. Os totais de blocos extraídos estão em
`data/library/index.json`; blocos HTML não equivalem a artigos nem a regras.
Os seis endereços do Planalto continuam no catálogo como pendências, sem
conteúdo inventado. As URLs alternativas da Câmara foram descobertas em busca
pública e verificadas durante a coleta. Os registros de tentativas e êxitos
ficam em `data/library/collection-log.json`.

Cada diretório `data/legal-sources/<id>/<sha256>/` contém `original.html`,
`robots.txt` e `metadata.json`. A extração ocorre no banco local, sem modificar
os arquivos oficiais. A orientação INSS mantém seus metadados e limites de
licença originais; os trechos são índice interno de pesquisa, não publicação
adaptada como texto oficial.

## Reproduzir

```sh
npm ci
npm run library:import
npm run check
npm run build
```

O importador cria/reutiliza `.local/development.sqlite`. Aceita `DATABASE_PATH`
do ambiente ou `.env`. É idempotente: mesmos bytes e mesmo extrator não criam
nova versão nem mudam aprovação. Para atualizar o inventário rastreado:

```sh
npm run library:import -- --write-manifest
```

O banco pode ser reconstruído apenas com os arquivos versionados e o importador.
Ele não vai para Git. `index.json` é um inventário da execução registrada, não
uma alternativa ao banco e não reflete automaticamente futuras revisões locais.

Coleta pontual, sem agendamento ou descoberta automática de links:

```sh
npm run library:collect -- --source camara-loas-8742-1993
```

Sem `--source`, o coletor percorre somente os endereços pendentes do catálogo.
Ele usa HTTPS, proxy herdado, lista de hosts, limites de tamanho, timeout,
robots e intervalo entre requisições. Robots indisponível ou proibitivo impede
o download. Possíveis challenges são rejeitados. Não há retries ilimitados.
Revisão de termos de uso e de licenças permanece parte da curadoria; não houve
declaração automática de autorização para redistribuição de conteúdo adaptado.

## API

Execute `npm run dev` a partir da raiz. O token local de desenvolvimento
identifica `local-demo`, que pode importar e pesquisar para curadoria, mas não
aprovar juridicamente. Clientes comuns configurados sem papel de curador não
acessam as rotas administrativas.

- `GET /admin/sources`: catálogo, versões, hashes e quantidades de trechos.
- `POST /admin/sources/import`: `{ "sourceId": "inss-bpc", "sha256": "..." }`.
  Importa somente arquivos locais do catálogo; não aceita URL ou caminho enviado
  pelo usuário. Não realiza requisição de rede no servidor.
- `GET /admin/sources/:sourceId/versions/:sha256`: metadados, estado e trechos.
- `POST /admin/sources/search`: pesquisa de curadoria, incluindo draft,
  explicitamente marcado como não utilizável em análise jurídica.
- `POST /library/search`: retorna somente versões aprovadas e aplicáveis ao
  benefício, UF e data. Neste acervo inicial retorna vazio, pois nada foi aprovado.

Corpo de busca:

```json
{
  "query": "renda familiar",
  "benefit": "bpc",
  "date": "2026-10-27",
  "uf": "MG",
  "limit": 10
}
```

Os resultados têm ID da fonte, hash da versão, texto e ID do trecho, localizador
do extrator, âncora original quando existente, URL, estado e indicação de uso.
Quando não há âncora HTML oficial, o localizador aponta o bloco no extrator e
deve ser conferido contra o original preservado; não é um fragmento inventado
para a URL oficial. A verificação de citações compara versão, passagem e texto.

## Revisão, vigência e segurança

Novas versões ficam sempre `draft`, com vigência desconhecida. A data de coleta
nunca vira início de vigência. Os metadados originais não são reescritos quando
há revisão; decisões, revisor e eventos são registros separados no banco.

O serviço possui transições testadas de aprovação/rejeição/desativação. Uma
aprovação exige contexto de revisor qualificado, nota e período coerente, e
bloqueia duas versões da mesma fonte com períodos aprovados sobrepostos.
**Nenhum endpoint concede aprovação e nenhum revisor real foi configurado.**
As aprovações exercitadas nos testes usam somente documentos fictícios.

Filtros de aprovação, período e jurisdição precedem a ordenação textual.
Blocos com marcas HTML de texto revogado são excluídos da busca aprovada, mas
preservados para revisão. Isso não detecta todas as alterações jurídicas.
Textos consolidados contêm redações com vigências distintas: antes de ativar
uso real, é necessário revisar aplicabilidade por dispositivo e reconstrução
histórica, não aprovar todo um documento para qualquer DER.

O extrator `html-v2` preserva textos em parágrafos, divisões, tabelas e quebras
de linha, respeita charset e remove scripts/navegação. Atualizar o extrator
permite reindexar automaticamente apenas versões draft. Versões já revisadas
exigem migração explícita, evitando invalidar silenciosamente citações.

Importação valida hash, tamanho, URL exata, tipo e origem catalogada. Caminhos
fora do acervo, inclusive por symlink, são bloqueados. Dados de casos de clientes
não entram nesta biblioteca. Conteúdo dos documentos não é executado.

## Limites e próximos passos

A busca desta biblioteca é lexical. Embeddings semânticos reais, pgvector,
detecção automática de mudanças, histórico jurídico por dispositivo, fila,
ingestão de PDF e aprovação profissional integrada ainda não estão implementados.
A verificação de hash não certifica interpretação jurídica ou atualidade da lei.

Ainda faltam normas administrativas do INSS, DOU, CRPS e jurisprudência de
STF/STJ/TNU/TRFs. A ampliação deve manter o mesmo registro de permissões,
originais, versões e revisão. Não foi coletada jurisprudência nesta entrega.
O sistema continua local, sem publicação, pagamento ou parecer jurídico real.

## Verificação desta entrega

- 44 testes TypeScript e 4 testes Python aprovados, incluindo importação real
  BPC, cobertura do texto EC 103, permissões, hash, charset, citações e coleta.
- Compilação e validação TypeScript aprovadas.
- Sete versões e 15.108 blocos importados no banco local, todos draft.
- Busca HTTP local de curadoria conferida com acervo real; busca aprovada vazia.
- Integridade dos sete arquivos confirmada também com Python em modo otimizado.
- Auditoria npm das dependências de produção sem vulnerabilidades reportadas
  na consulta desta execução.
- Documentos originais e coleta INSS anterior preservados.

Testes não substituem validação jurídica, revisão de cada trecho, avaliação de
performance ou homologação de produção. O script de integridade foi ampliado
para validar URLs do catálogo e usar exceções explícitas em vez de `assert`.
