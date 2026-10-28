# TRFs, Jusbrasil e consulta de processos do INSS

Verificação de descoberta: 27/10/2026. Os oito portais estão cadastrados em
`data/library/research-resources.json`, separado dos documentos efetivamente
arquivados no catálogo. A consulta autenticada `GET /library/resources?uf=MG`
retorna as finalidades, situação de integração e prioridade regional.

## TRFs

Foram identificadas rotas oficiais de pesquisa nos TRFs 1 a 5 e documentação
oficial do módulo do TRF6. O endereço www.trf6.jus.br apresentou timeout no
acesso; o portal documentado é portal.trf6.jus.br. Links:

- TRF1: https://jurisprudencia.cjf.jus.br/?tribunal=trf1
- TRF2: https://eproc.trf2.jus.br/eproc/externo_controlador.php?acao=jurisprudencia@jurisprudencia/pesquisar
- TRF3: https://web.trf3.jus.br/jurisprudencia/
- TRF4: https://eproc-jur.trf4.jus.br/eproc2trf4/externo_controlador.php?acao=jurisprudencia@jurisprudencia/pesquisar
- TRF5: https://juliapesquisa.trf5.jus.br/julia-pesquisa/pesquisa
- TRF6: https://portal.trf6.jus.br/juizados-especiais-federais-inicio/jurisprudencia-4/pesquisa-de-jurisprudencia-eproc/

UF define somente prioridade de pesquisa, não competência judicial definitiva.
As páginas são diretórios/sistemas de pesquisa, não acórdãos aprovados. Nenhum
julgado foi coletado nesta alteração. A próxima integração exige conferir
robots, termos, modo público de pesquisa e inteiro teor de cada decisão,
registrando processo, órgão, julgamento/publicação, efeitos e situação atual.
Decisões isoladas não serão tratadas automaticamente como vinculantes.

## Jusbrasil

https://www.jusbrasil.com.br/ foi acessível como página pública. É fonte
auxiliar, não órgão judicial. Pode ajudar a localizar decisões, mas conteúdo
deve ser conferido na origem oficial antes de fundamentar análise. Não foi
configurada coleta, API, assinatura ou acesso autenticado. O coletor oficial
existente não aceita o domínio Jusbrasil.

## Consulta de processos do INSS

https://consultaprocessos.inss.gov.br/ respondeu HTTP 200 com uma aplicação
JavaScript, sem conteúdo processual no HTML inicial. Isso não comprova acesso
a processos ou existência de API pública. O INSS indica esse endereço para
acompanhamento de recursos administrativos:
https://www.gov.br/inss/pt-br/direitos-e-deveres/recurso/recurso-administrativo-de-beneficio-previdenciario

O sistema será referência de acompanhamento individual, separado da biblioteca
jurídica compartilhada. Não houve login, pedido de senha gov.br, consulta de CPF
ou coleta de processo de terceiro. A integração de documentos de um caso deve
ocorrer por envio autorizado pelo titular, mantendo isolamento e rastreabilidade.

## Estado

O cadastro está funcional; conectores e coleta destes oito portais ainda não
estão implementados. As sete versões oficiais anteriormente arquivadas continuam
intactas e pendentes de revisão jurídica. Nenhuma fonte foi aprovada nesta etapa.
