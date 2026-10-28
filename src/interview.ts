import type { CaseState, Question } from './domain.ts';

export function missingDocuments(state: CaseState): string[] {
  const missing: string[] = [];
  if (!state.documents.some(d => d.kind === 'carta_indeferimento')) missing.push('carta de indeferimento');
  if (state.case.benefit === 'aposentadoria_rgps' && !state.documents.some(d => d.kind === 'cnis')) missing.push('CNIS');
  if (state.case.benefit === 'incapacidade' && !state.documents.some(d => d.kind === 'laudo')) missing.push('documentação médica pertinente');
  return missing;
}
export function conflictingFields(state: CaseState): string[] {
  const fields = [...new Set(state.facts.map(f => f.field))];
  return fields.filter(field => new Set(state.facts.filter(f => f.field === field).map(f => f.value.toLocaleLowerCase('pt-BR'))).size > 1);
}
export function nextQuestion(state: CaseState): Question | null {
  if (state.case.benefit === 'rpps') return null;
  const conflict = conflictingFields(state)[0];
  if (conflict) return { field: conflict, text: 'Há informações diferentes sobre este ponto. Qual informação está correta e qual documento a comprova?' };
  const candidate = state.facts.find(f => f.origin === 'documental' && !f.confirmed);
  if (candidate) return { field: 'confirmacao:' + candidate.id, text: 'A informação extraída está correta? Confira a página e o trecho indicados antes de confirmar.' };
  if (!state.case.subtype) return { field: 'subtype', text: 'Qual é o nome exato do benefício solicitado?' };
  if (!state.case.der) return { field: 'der', text: 'Em que data você pediu o benefício ao INSS?' };
  if (!state.case.noticeDate) return { field: 'noticeDate', text: 'Em que data você soube que o pedido foi negado?' };
  if (!state.case.denialReason) return { field: 'denialReason', text: 'Qual motivo aparece na carta de indeferimento?' };
  if (missingDocuments(state).length) return { field: 'documents', text: 'Você pode fornecer ' + missingDocuments(state).join(' e ') + '?' };
  const has = (field: string) => state.facts.some(f => f.field === field && (f.origin === 'declarado' || f.confirmed));
  if (state.case.benefit === 'bpc') {
    if (!has('composicao_familiar')) return { field: 'composicao_familiar', text: 'Quem mora com você e qual é o parentesco de cada pessoa?' };
    if (!has('renda_familiar')) return { field: 'renda_familiar', text: 'Quais rendimentos cada pessoa da casa recebe?' };
  }
  if (state.case.benefit === 'aposentadoria_rgps' && !has('periodos_contributivos')) return { field: 'periodos_contributivos', text: 'Há algum trabalho ou contribuição que não aparece no CNIS?' };
  if (state.case.benefit === 'incapacidade' && !has('documentacao_medica')) return { field: 'documentacao_medica', text: 'De quando são os documentos médicos e quais limitações para o trabalho eles descrevem?' };
  return null;
}
