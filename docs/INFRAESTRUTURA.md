# Infraestrutura para integração do front-end

API e trabalhador agora são processos separados. A interface cria o caso,
envia dados sintéticos, solicita análise e acompanha um job. O trabalho pesado
não ocorre mais no pedido HTTP do servidor padrão.

O backend permanece demonstrativo: infraestrutura pronta para prototipar a
interface não significa autorização para analisar dados reais ou lançar o produto.

## Executar localmente

Node.js 24+, npm e Python 3 para checks. Copie `.env.example` para `.env` e
substitua o token local. Não use token compartilhado em um frontend publicado.

```sh
npm ci
npm run db:migrate
npm run dev
# Em outro terminal:
npm run worker
```

Sem DATABASE_URL, usa SQLite/WAL local e diretório privado. Esse modo é para
desenvolvimento, não para múltiplas máquinas. Para concorrência real, configure
PostgreSQL. A migração é executada separadamente antes das réplicas, evitando
bloqueios de DDL durante tráfego. O modo produção impede migração automática.

Docker Compose local, também só com dados fictícios:

```sh
docker compose build api
docker compose up -d
docker compose ps
```

O Compose cria PostgreSQL, migração, API e worker. Porta HTTP vinculada somente
ao loopback. Arquivos temporários ficam em volume compartilhado local. Não use
`down -v` se precisar preservar os casos de desenvolvimento.

No ambiente gerenciado, preserve o proxy e configure `BUILD_CA_FILE` com o CA
fornecido, sem desativar TLS. O Dockerfile recebe o certificado como segredo de
build, nunca o incorpora na imagem. A imagem final roda como usuário não root
e contém só dependências de produção.

## Fila e integridade

- PostgreSQL: pool limitado e `FOR UPDATE SKIP LOCKED` para distribuir jobs.
- Deduplicação por caso e revisão; repetir clique não cria segunda análise.
- Três análises ativas por usuário; quotas HTTP de 120 pedidos/minuto por padrão,
  compartilhadas pelo banco entre réplicas.
- Lease de 60 segundos, heartbeat, três tentativas com espera crescente.
- Token de lease impede trabalhador antigo de publicar após retomada por outro.
- Alteração do caso cancela trabalho antigo e invalida análise/PDF anteriores.
- Atualizações simultâneas retornam 409, evitando perda silenciosa de dados.
- Shutdown deixa de buscar tarefas e permite concluir as já iniciadas.

Configure número de réplicas e WORKER_CONCURRENCY considerando os limites do
modelo/OCR, CPU e conexões do banco. Esses fornecedores ainda não estão ligados.
O limite do pool é por processo: seis APIs com pool 5 e quatro workers com pool 5
consumiriam até 50 conexões, além de administração/migração. Reserve margem.

## Autenticação e front-end

Em produção, o servidor exige JWT assimétrico verificado por JWKS HTTPS, issuer,
audience, assinatura, subject e expiração. Pode usar um provedor como Supabase
Auth com chaves assimétricas. Não usar service-role, chave de API do modelo,
credencial de armazenamento ou token compartilhado no navegador.

CORS aceita somente origens configuradas. Configure o endereço real da interface
em CORS_ORIGINS. O bucket também precisa de CORS para o PUT direto da interface,
limitado às mesmas origens, Content-Type e eventuais headers assinados.

Contrato: [openapi.json](openapi.json). Integração sugerida:

1. Consultar `/capabilities` e deixar claro que o modo atual usa dados fictícios.
2. Criar caso e responder entrevista.
3. Enviar texto sintético pelo endpoint de documentos. PDF/imagem binária só
   pode ir para quarentena S3: isso ainda não produz um documento analisável.
4. `POST /cases/:id/analyze` responde 202 e Location do job.
5. Consultar `/jobs/:id` a cada pollAfterMs; parar ao concluir, falhar ou cancelar.
6. Ler análise e baixar relatório. Expiração do PDF vem em reportExpiresAt.
7. Tratar 401 como nova autenticação, 409 como atualização do caso e 429 como
   espera, respeitando Retry-After quando fornecido.

Não manter a pessoa com tela bloqueada aguardando uma chamada longa. Mostrar
recebido, na fila, em processamento, concluído ou falhou. Reconectar usando o ID
do caso/job, sem reenviar repetidamente a análise.

## Arquivos temporários: preferência do produto

PDF também ocupa disco e gera custo de armazenamento. Os arquivos são cache
temporário, não um arquivo permanente do usuário:

- Texto integral e páginas do anexo sintético são descartados ao concluir a
  análise. Metadados, fatos extraídos e trechos citados permanecem no resumo.
- Atendimentos abandonados têm descarte do texto integral após uma hora.
- Uploads binários em quarentena expiram em uma hora; também são agendados para
  exclusão quando o caso é processado. PUT assinado expira em cinco minutos.
- PDF expira em uma hora por padrão, configurável em REPORT_TTL_SECONDS.
- Limpeza roda nos workers a cada 30 segundos, até 100 objetos por ciclo,
  repetindo exclusões que falharem. Sem worker ativo, a exclusão física fica
  pendente, mas o PDF expirado deixa de ser servido.
- PDF pode ser regenerado a partir da análise resumida da mesma revisão,
  sem repetir o processamento de análise. Isso não atualiza pesquisa jurídica.
- Arquivos órfãos de falha antes da publicação também são registrados para limpeza.
- Jurisprudência, textos oficiais e documentos do projeto não são anexos pessoais
  e continuam preservados no Git.

Anexos binários ainda não passam por OCR/antivírus; não estão liberados para
clientes reais. A etapa seguinte deve validar tamanho real, MIME, malware e
extração antes de permitir qualquer leitura pelo agente.

S3 deve usar bucket privado dedicado, sem versionamento nem object lock; a
readiness recusa versionamento ativo ou suspenso. Um provedor pode manter
backups, e DELETE sem VersionId não apaga versões históricas. Configure política
de acesso e lifecycle de segurança para quarentena/objetos órfãos. Não há criação
automática de bucket nem alteração de contas externas.

O descarte do arquivo não elimina os dados do resumo, auditoria e backups do
banco. Retenção/exclusão desses registros ainda precisa de política LGPD antes
de usar dados reais. A API antiga em memória usada pelos testes/demo permanece
compatível; o descarte e os jobs são comportamentos do servidor assíncrono.

## Implantação e observabilidade

Configuração de produção exige PostgreSQL, bucket S3 privado, JWT/JWKS e origem
HTTPS da interface. Use HTTPS no ingresso e conexão verificada ao banco gerenciado.
API não expõe curadoria por padrão; o CLI da biblioteca permanece separado.

`/health` informa processo vivo. `/ready` verifica banco e armazenamento, sem
expor credenciais. Logs de falha têm código técnico, sem documentos ou respostas.
Monitore filas por estado, idade do job mais antigo, falhas, tentativas, tempo de
espera, conexões e custo de OCR/modelo quando integrados. Não há painel ou alertas
externos configurados nesta entrega.

Não existe capacidade ilimitada garantida. Antes de lançamento, medir carga com
PDFs representativos, OCR/LLM reais, falhas de fornecedores e orçamento. Configurar
backups do banco, política de descarte, TLS, identidade e monitoramento no destino.
Nenhum serviço foi contratado e o sistema não foi publicado.

## Verificação

Testes cobrem fila, concorrência, persistência, lease, isolamento, JWT, CORS,
limites, descarte e expiração. O adaptador S3 foi exercitado contra um emulador
HTTP mínimo; isso não certifica políticas ou IAM de um provedor real.

```sh
npm run check
npm run build
# Banco exclusivo de testes; cria e remove um schema próprio.
INTEGRATION_DATABASE_URL=postgres://... npm run load:infra
```

O teste de carga usa HTTP real, PostgreSQL real e worker em outro processo;
simula 300 usuários, documentos textuais fictícios e PDFs. Sua saída fica em
`.local/load_<id>/result.json`. Não mede OCR, LLM, latência de nuvem ou custo real.
