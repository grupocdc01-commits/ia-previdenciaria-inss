# Expansão do conhecimento previdenciário — investigação de indeferimentos

## Missão
Ampliar a base jurídica para **diversas modalidades de benefícios negados pelo INSS**, preservando a especialização e sem apresentar uma cobertura como validada antes de testes e revisão jurídica. A versão anterior permanece na branch `backup/versao-original-2026-10-28`. Não modificar essa branch.

## Organização por especialidades
- Aposentadorias RGPS: idade, transições, especial, rural, pessoa com deficiência e outras hipóteses aplicáveis.
- Benefícios por incapacidade: benefício por incapacidade temporária, aposentadoria por incapacidade permanente e auxílio-acidente, observadas diferenças.
- BPC/LOAS: idoso e pessoa com deficiência, critérios assistenciais próprios.
- Pensão por morte.
- Salário-maternidade.
- Auxílio-reclusão.
- Outros benefícios: triagem inicial, sem análise conclusiva até homologação do módulo.

## Taxonomia de motivos de indeferimento
`requisito_nao_atendido`, `prova_insuficiente`, `carencia`, `qualidade_segurado`, `tempo_contribuicao`, `idade`, `renda_familiar`, `dependencia`, `incapacidade_pericia`, `vinculo_cnis`, `atividade_rural`, `atividade_especial`, `exigencia_nao_cumprida`, `inconsistencia_cadastral`, `documentacao`, `regra_transicao`, `outro`, `desconhecido`.
Motivos podem coexistir; registrar texto literal do indeferimento e classificação separadamente. Não inferir motivo como fato se o cidadão não o conhece.

## Motor de investigação
1. Identificar benefício, subtipo, DER, data de ciência, UF, motivo formal e situação de recurso/processo.
2. Perguntas adaptativas por benefício/motivo; áudio e texto intercambiáveis, documentos opcionais para começar.
3. Distinguir fatos declarados, comprovados, hipóteses e lacunas.
4. Consultar legislação, INSS, CRPS, STF, STJ, TNU e TRFs com vigência e hierarquia, quando houver fonte oficial disponível.
5. Executar cálculos apenas por regras determinísticas versionadas, testadas e aprovadas.
6. Testar argumentos favoráveis e contrários; indicar limitações e urgências a verificar.
7. Resultado estruturado, com fontes verificáveis, provas faltantes e caminhos possíveis; conclusão indeterminada quando necessário.

## Base jurídica e governança
Indexar normas por benefício, motivo, DER/período de vigência, órgão, jurisdição, versão, fonte e status de revisão. Coleta autorizada de fontes oficiais; não inventar APIs, precedentes ou citações. Atualização semiautomática e aprovação humana antes de ativar regra nova. Separar corpus público jurídico dos dados privados dos clientes.

## Liberação por modalidade
A biblioteca pode abranger todos os benefícios, mas a interface só pode oferecer **análise jurídica completa** dos módulos homologados. Para os demais, oferecer triagem e informar limitação sem cobrar por análise indisponível. Começar por aposentadorias indeferidas e ampliar progressivamente para incapacidade e BPC, depois demais benefícios. Cada módulo exige casos sintéticos, casos revisados por especialista, testes de fontes e de regras, análise de segurança/LGPD e critérios objetivos de qualidade.

## Diretrizes para implementação
Preservar os arquivos existentes e a branch de backup. Atualizar PRD, arquitetura, taxonomia, esquema de dados, entrevista, motor de regras e testes em branch de desenvolvimento; não mesclar nem publicar automaticamente. Confirmar código real do frontend Lovable antes de editar UI. A existência desta especificação não significa que os módulos estejam implementados.
