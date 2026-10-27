# Motor de regras e investigação

## Princípios
A IA interpreta linguagem e formula hipóteses. Requisitos objetivos são avaliados por código determinístico, com dados tipados, datas e fontes. Cada regra exige ID, benefício, subtipo, condição, data inicial/final de vigência, fonte exata, versão, testes e aprovação jurídica.

## Resultado de regra
`atendido`, `nao_atendido` ou `indeterminado`; evidências usadas, evidências faltantes, data de referência, versão da regra e justificativa auditável. Não presumir contribuições, salários, deficiência, renda, incapacidade, qualidade de segurado ou vínculo.

## Investigação ativa
1. Classificar indeferimento e prazo potencial.
2. Perguntar o que falta para discriminar hipóteses: vínculos omitidos, atividade rural, tempo especial, períodos de graça, carência, incapacidade, renda e composição familiar no BPC, exigências não cumpridas, regra de transição, erros de DER.
3. Consultar fontes administrativas e judiciais aplicáveis; buscar precedentes contrários.
4. Gerar hipóteses com grau de suporte e lista de provas necessárias.
5. Separar solução administrativa, recurso e via judicial, sem afirmar estratégia definitiva sem revisão profissional.

## Precedentes
Armazenar órgão, processo/tema, data, tese, situação (pendente/julgado/suspenso/superado), alcance, modulação, tribunal, link oficial e data de última conferência. Não afirmar que precedente isolado vincula o INSS ou todo o país.

## Cálculos
Implementar módulos separados: períodos e sobreposições, carência, tempo de contribuição, regras de transição, datas de corte, qualidade de segurado, renda familiar do BPC, sempre com critérios específicos, exceções e testes por DER. **Não codificar números jurídicos sem validar texto oficial e vigência.**

## Revisão
Regras propostas por LLM ficam em estado `draft`; só revisor qualificado pode marcar `approved`. Alterações geram novo versionamento e testes de regressão. Casos complexos recebem `revisao_profissional_recomendada`.
