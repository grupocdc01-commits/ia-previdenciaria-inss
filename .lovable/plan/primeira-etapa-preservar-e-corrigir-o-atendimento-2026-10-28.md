# Primeira etapa — preservar e corrigir o atendimento

## Diagnóstico verificado
- Quatro testes passaram. A tela de entrada funciona em computador e celular; conversa e transcrição recusam acesso sem conta.
- Banco ativo, documentos privados e políticas por proprietário presentes. Não há contas cadastradas, portanto histórico, anexos e transcrição autenticados ainda não foram verificados.
- Gravação não encerra por silêncio, mas faltam pausa/continuação e confirmação explícita do fim do relato. A conversa começa pelas perguntas antes de ouvir a história.
- Upload valida apenas o tipo informado pelo navegador; o armazenamento não tem restrições específicas de formato/tamanho. Há permissões diretas indevidas na função de criação de perfil, que precisam ser retiradas preservando o cadastro.
- Motor jurídico, extração documental e PDF real não existem. Nenhuma regra está validada.
- Sincronização e branch do GitHub não podem ser verificadas pelas ferramentas disponíveis; conferir em Configurações do projeto → Git. A branch de backup não será alterada.
- Custos registrados de execução: 0,02 créditos solicitados em dois dias de worker, de 15 a 28/10/2026, incluindo o dia atual parcial. Isso não mede custo total atual nem economia possível. Sem histórico de carga representativo, não reduzir capacidade nem trocar modelo por suposição.

## Entrega desta etapa
1. Corrigir as permissões da função de perfil e verificar que o cadastro continua funcionando.
2. Reutilizar gravação e transcrição existentes: adicionar **Pausar gravação**, **Continuar gravação** e **Terminei de contar**, sem temporizador de silêncio.
3. Iniciar novas investigações com a mensagem acolhedora enviada no documento. Salvar o relato privado e seu término explícito; não iniciar perguntas enquanto a pessoa relata. Preservar atendimentos existentes.
4. Testar pausas prolongadas, término explícito, falhas de transcrição e bloqueio de avanço durante gravação; verificar a apresentação no celular.
5. Registrar o resultado da auditoria e os bloqueios reais. Não publicar, alterar o backup, refazer telas ou liberar conclusão jurídica.

## Verificação que depende de conta
Criar uma conta pela prévia permite testar retomada de duas investigações e anexos. Isolamento entre usuários exige duas contas de teste autorizadas. Não inventar credenciais ou dispensar confirmação de e-mail.

## Próximas fases, sem antecipar implementação
Após corrigir o atendimento, estruturar fontes, regras, evidências e resultados. Implementar os três módulos iniciais em sequência com status não homologado; depois leitura documental, integração, painel e PDF. Conclusões de produção dependem de fontes oficiais aplicáveis e aprovação profissional, além dos testes técnicos.

## Detalhes técnicos
- Manter CaseAdapter/CloudCaseAdapter e fluxo demonstrativo inalterados.
- Alterações incrementais nos componentes de áudio/chat e estado privado da entrevista; compatibilidade com fatos antigos.
- Revogar execução de `create_private_profile` de anon/authenticated via migração, mantendo o trigger de cadastro.
- Nenhum dado sensível em localStorage, logs ou biblioteca compartilhada.
- Não escolher política de retenção, excluir dados, aumentar custos externos ou mudar qualidade do modelo sem a decisão correspondente.