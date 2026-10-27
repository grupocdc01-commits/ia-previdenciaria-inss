import { z } from 'zod';
import { isoDate, ufSchema } from './domain.ts';

const resourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1),
  portalUrl: z.url().startsWith('https://'), researchUrl: z.url().startsWith('https://'),
  kind: z.enum(['official_jurisprudence', 'auxiliary_search', 'private_case_lookup']),
  coverage: z.array(ufSchema),
  verification: z.enum(['official_link_observed', 'official_link_documented', 'public_page_observed', 'public_shell_observed']),
  checkedOn: isoDate, automaticCollectionEnabled: z.literal(false)
}).strict();

// Diretório de portais descobertos; não é um corpus de decisões coletadas.
export function researchResources(input: unknown, uf?: unknown) {
  const resources = z.array(resourceSchema).parse(input);
  const state = uf === undefined ? null : ufSchema.parse(uf);
  return resources.map(resource => ({
    ...resource,
    integrationStatus: 'discovered_not_integrated' as const,
    regionalPriority: state !== null && resource.kind === 'official_jurisprudence' && resource.coverage.includes(state),
    usableAsLegalAuthority: false,
    requiresOfficialConfirmation: resource.kind === 'auxiliary_search',
    sharedCaseDataAllowed: false,
    purpose: resource.kind === 'official_jurisprudence' ? 'Localizar decisões oficiais para futura importação e revisão.'
      : resource.kind === 'auxiliary_search' ? 'Descobrir decisões; confirmar inteiro teor e situação na fonte oficial.'
      : 'Acompanhamento individual de recurso administrativo; não integrar dados pessoais ao corpus jurídico.',
    notice: 'Cadastro de portal não comprova coleta, aprovação jurídica ou autorização de automação. UF indica prioridade regional, não determina competência.'
  }));
}
