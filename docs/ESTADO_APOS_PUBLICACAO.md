# Estado verificado após publicação do ambiente

## Rede
Acesso ao portal INSS e à página BPC/deficiência: HTTP 200.
Planalto/LOAS e robots do Planalto: HTTP 503 (serviço indisponível).
Isso distingue o resultado atual do bloqueio anterior 403. O 503 não demonstra
falta de autorização; o texto da LOAS ainda não foi obtido nesta tentativa.

## Primeira fonte efetivamente arquivada
A página de orientação do INSS está em data/legal-sources/inss-bpc/<sha256>/.
O endereço, instituição, data da consulta, datas exibidas, hash, status e limites
estão em metadata.json. original.html preserva os bytes recebidos. robots.txt
preserva o arquivo consultado; a rota foi avaliada como permitida para o agente.
O rodapé declara CC BY-ND 3.0, com atribuição ao INSS e URL no registro. Não tratar
cópias adaptadas como publicação oficial nem coletar além de permissões verificadas.

A página exibe atualização em 21/09/2023: consulta recente não significa conteúdo
jurídico atualizado. É orientação administrativa, não substitui a legislação.
Status draft, vigência não verificada, sem ativação de regra ou conclusão real.
Não há coleta agendada, corpus completo ou jurisprudência real arquivada.

Verificação reproduzível: `python scripts/verificar_fontes.py`.
Valida bytes e metadados da cópia; não valida interpretação jurídica.

## Problema de restauração
Após reconexão, o checkout tinha apenas README.md e HEAD a445b20 (o commit inicial).
A branch de desenvolvimento e os arquivos locais anteriores não apareceram.
Foram verificados branches locais/remotos, reflog, objetos Git e diretórios
compartilhados. Os commits locais anteriores (por exemplo 917d5c3 e 99f84cf) não
estão disponíveis no banco de objetos desta máquina; o remoto só expôs main.
Não é possível afirmar que o snapshot publicado preservou aquele desenvolvimento.

Os 12 anexos originais foram baixados novamente e preservados em docs/originais;
AGENTS.md e especificações centrais foram recuperados. Isso recupera requisitos,
não a implementação anterior nem os relatórios temporários. Os 30 testes citados
antes pertencem à instância anterior e não foram reexecutados nesta instância,
pois seus arquivos não estão aqui. Não anunciar a API anterior como disponível.
A recuperação do snapshot/código anterior permanece pendente. O histórico desta
conversa registra a implementação, mas não substitui uma cópia Git recuperável.

## Continuidade
Preservar esta primeira coleta em Git e confirmar armazenamento remoto antes de
nova publicação. Recuperar/reconstruir o núcleo anterior e seus testes antes de
prometer ambiente de desenvolvimento completo. Retomar fontes oficiais de forma
incremental, com controle de versões e revisão jurídica antes da liberação.
