import { DomainError } from './domain.ts';
import { conflictingFields } from './interview.ts';
import type { CaseState, RuleResult, Source } from './domain.ts';

export type Rule = {
  id: string; version: string; benefit: string; validFrom: string; validTo: string | null;
  approval: 'draft' | 'approved'; reviewedBy: string | null; demonstration: boolean;
  sourceId: string; sourceVersion: string;
  evaluate: (state: CaseState) => Pick<RuleResult, 'result' | 'justification' | 'evidenceIds' | 'missing'>
};
export function evaluateRule(rule: Rule, state: CaseState, sources: Source[], mode: 'demonstracao' | 'real'): RuleResult {
  const base = { id: rule.id, version: rule.version, requiresReview: true, referenceDate: state.case.der, demonstration: rule.demonstration };
  if (mode === 'real' && (rule.demonstration || rule.approval !== 'approved' || !rule.reviewedBy)) throw new DomainError('Regra não autorizada para análise real.');
  if (mode === 'demonstracao' && !rule.demonstration) throw new DomainError('Ambiente demonstrativo não executa regras reais.');
  const source = sources.find(s => s.id === rule.sourceId && s.version === rule.sourceVersion);
  if (!source || (mode === 'real' && (source.demonstration || source.approval !== 'approved' || !source.legalValidityVerified))) throw new DomainError('Fundamento da regra indisponível ou não aprovado.');
  if (!state.case.der) return { ...base, applicable: false, result: 'indeterminado', justification: 'DER ausente; não é possível selecionar a vigência.', evidenceIds: [], missing: ['DER'] };
  const date = state.case.der;
  const applicable = state.case.benefit === rule.benefit && rule.validFrom <= date && (rule.validTo === null || rule.validTo >= date) && source.validFrom <= date && (source.validTo === null || source.validTo >= date);
  if (!applicable) return { ...base, applicable: false, result: 'indeterminado', justification: 'Regra ou fonte não aplicável ao benefício/período.', evidenceIds: [], missing: [] };
  return { ...base, applicable: true, ...rule.evaluate(state) };
}
export const familyInformationDemoRule: Rule = {
  id: 'DEMO-informacoes-familiares', version: '1', benefit: 'bpc', validFrom: '2000-01-01', validTo: null,
  approval: 'draft', reviewedBy: null, demonstration: true, sourceId: 'demo-bpc', sourceVersion: '1',
  evaluate(state) {
    const fields = ['composicao_familiar', 'renda_familiar'];
    const evidence = state.facts.filter(f => fields.includes(f.field) && f.origin === 'documental' && f.confirmed);
    const missing = fields.filter(field => !evidence.some(f => f.field === field));
    if (missing.length || conflictingFields(state).some(field => fields.includes(field))) return {
      result: 'indeterminado', justification: 'DEMONSTRAÇÃO: faltam informações documentais confirmadas ou há divergências; nenhuma elegibilidade foi calculada.',
      evidenceIds: evidence.map(f => f.id), missing
    };
    return { result: 'atendido', justification: 'DEMONSTRAÇÃO: preenchimento documental atendido. Isso não significa direito ao BPC.', evidenceIds: evidence.map(f => f.id), missing: [] };
  }
};

// Utilitário civil, sem conversão automática em carência ou tempo previdenciário.
export function mergeDatePeriods(periods: { start: string; end: string }[]): { start: string; end: string }[] {
  const sorted = periods.map(p => ({ ...p })).sort((a, b) => a.start.localeCompare(b.start));
  const merged: { start: string; end: string }[] = [];
  for (const period of sorted) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period.start) || !/^\d{4}-\d{2}-\d{2}$/.test(period.end) || period.end < period.start || !Number.isFinite(Date.parse(period.start)) || !Number.isFinite(Date.parse(period.end)) || new Date(period.start).toISOString().slice(0, 10) !== period.start || new Date(period.end).toISOString().slice(0, 10) !== period.end) throw new DomainError('Período inválido.');
    const previous = merged.at(-1);
    if (previous && period.start <= previous.end) previous.end = period.end > previous.end ? period.end : previous.end;
    else merged.push(period);
  }
  return merged;
}
