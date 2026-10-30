# Plano de execução — IA Previdenciária (4 módulos)

## Estado inicial
A branch `codex/previdenciario-4-modulos` foi criada separadamente de `main`. Antes de qualquer alteração de aplicação, é obrigatório localizar e sincronizar o código-fonte integral da versão Lovable. Não substituir a aplicação por um protótipo.

## Módulo 1 — Base jurídica auditável
Catálogo de legislação, vigência, artigo, fonte oficial, jurisprudência identificada, situação do precedente, revisão humana e atualização. Nenhuma conclusão baseada em referência não conferida.

## Módulo 2 — Anamnese e investigação contextual
Formulário adaptativo; balão automático de complemento antes de avançar; respostas confirmadas, desconhecidas ou puladas; provas rurais (INCRA, CCIR, ITR, testemunhas), atividade especial, incapacidade, vínculo informal e indeferimento. Nunca fabricar informações.

## Módulo 3 — Documentos, cálculos e relatórios
CNIS/CTPS opcionais; extração sujeita a confirmação; distinção entre declarado e comprovado; tempo de contribuição sem sobreposição; carência separada; relatório com fundamentos, lacunas e caminhos administrativos/judiciais.

## Módulo 4 — Segurança, operação e comercialização
Consentimento e LGPD, isolamento entre contas/RLS, controle de acesso a documentos, revisão jurídica humana, administração, suporte, observabilidade, limites de uso e pagamentos somente após validação.

## Testes obrigatórios por módulo
1. Simples: um caso típico e dados completos.
2. Médio: dados incompletos, documentos divergentes, regras excepcionais e retomada.
3. Alto estresse: concorrência, repetição, volumes altos, falhas de API, isolamento e degradação segura.

Para cada módulo: testes automatizados, resultados reproduzíveis, evidências de execução, falhas e correções. Testes de carga exigem ambiente autorizado e não devem bombardear produção ou serviços públicos. Sem testes executados, status é 'não testado'.

## Critérios de liberação
Sem publicação automática, sem alterações em main, sem alegar fontes verificadas ou prontidão comercial antes de auditoria técnica e jurídica. Abrir PR para revisão.
