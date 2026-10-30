// Catálogo versionado de fontes oficiais. "verification" indica se o texto foi
// conferido contra a publicação oficial (hash); "review" indica revisão jurídica humana.
// Nenhuma fonte aqui está revisada: o motor sempre marca resultados como preliminares.
export type SourceVerification = "nao_verificada" | "verificada";
export type SourceReview = "pendente" | "aprovada";

export type LegalSource = {
  id: string;
  title: string;
  url: string;
  version: string;
  effectiveFrom: string; // ISO
  effectiveUntil: string | null;
  verification: SourceVerification;
  sha256: string | null;
  review: SourceReview;
  reviewer: string | null;
};

const base = {
  verification: "nao_verificada",
  sha256: null,
  review: "pendente",
  reviewer: null,
} as const;

export const SOURCE_SEEDS: LegalSource[] = [
  {
    id: "lei-8213",
    title: "Lei 8.213/1991 — Planos de Benefícios da Previdência Social",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
    version: "compilado-2026-10",
    effectiveFrom: "1991-07-25",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "decreto-3048",
    title: "Decreto 3.048/1999 — Regulamento da Previdência Social",
    url: "https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm",
    version: "compilado-2026-10",
    effectiveFrom: "1999-05-07",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "ec-103",
    title: "Emenda Constitucional 103/2019 — Reforma da Previdência",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm",
    version: "original-2019-11-13",
    effectiveFrom: "2019-11-13",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "loas",
    title: "Lei 8.742/1993 — Lei Orgânica da Assistência Social (LOAS)",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm",
    version: "compilado-2026-10",
    effectiveFrom: "1993-12-08",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "lei-10259",
    title: "Lei 10.259/2001 — Juizados Especiais Federais",
    url: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10259.htm",
    version: "compilado-2026-10",
    effectiveFrom: "2002-01-13",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "stf-tema-350",
    title: "STF — Repercussão Geral, Tema 350 (prévio requerimento administrativo, RE 631.240)",
    url: "https://portal.stf.jus.br/jurisprudenciaRepercussao/",
    version: "consulta-pendente",
    effectiveFrom: "2014-09-03",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "in-128",
    title: "Instrução Normativa PRES/INSS 128/2022",
    url: "https://www.in.gov.br/en/web/dou/-/instrucao-normativa-pres/inss-n-128-de-28-de-marco-de-2022-389275446",
    version: "original-2022-03-29",
    effectiveFrom: "2022-03-29",
    effectiveUntil: null,
    ...base,
  },
  // Precedentes: texto e situação (vigente/superado) NÃO conferidos no sistema; nenhuma pesquisa em tempo real é feita.
  {
    id: "stj-sumula-149",
    title: "STJ — Súmula 149 (prova exclusivamente testemunhal e atividade rurícola)",
    url: "https://scon.stj.jus.br/SCON/sumstj/",
    version: "consulta-pendente",
    effectiveFrom: "1995-12-18",
    effectiveUntil: null,
    ...base,
  },
  {
    id: "stj-tema-554",
    title:
      "STJ — Recurso repetitivo, Tema 554 (trabalhador rural boia-fria, início de prova material)",
    url: "https://processo.stj.jus.br/repetitivos/temas_repetitivos/",
    version: "consulta-pendente",
    effectiveFrom: "2012-11-28",
    effectiveUntil: null,
    ...base,
  },
];
