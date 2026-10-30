import { SOURCE_SEEDS } from "./source-data";
import {
  assessLegalRecord,
  legalDateSchema,
  legalRecordSchema,
  libraryQuerySchema,
  type LegalRecord,
} from "./catalog-schema";
import captures from "./capture-data.json";
import updates from "./catalog-updates.json";

const REFERENCES: Record<string, string[]> = {
  "lei-8213": [
    "art. 15",
    "art. 25",
    "art. 26",
    "art. 29-A",
    "art. 42",
    "art. 48",
    "art. 49",
    "art. 54",
    "art. 59",
    "art. 103",
  ],
  "decreto-3048": ["art. 19", "art. 303", "art. 305"],
  "ec-103": ["art. 18", "art. 19"],
  loas: ["art. 20, caput", "art. 20, §§ 2º, 3º, 10 e 11"],
  "lei-10259": ["art. 3º", "art. 10"],
  "in-128": ["Processo administrativo previdenciário — dispositivos a conferir"],
  "stf-tema-350": ["Tema 350 — tese e exceções a conferir"],
  "stj-sumula-149": ["Súmula 149 — enunciado e alcance a conferir"],
  "stj-tema-554": ["Tema 554 — tese e alcance a conferir"],
};
const PRECEDENTS: Record<string, LegalRecord["precedent"]> = {
  "stf-tema-350": {
    court: "STF",
    category: "tema",
    number: "350",
    caseNumber: "RE 631.240",
    documentUrl: null,
    status: "nao_conferido",
    scopeNote: null,
  },
  "stj-sumula-149": {
    court: "STJ",
    category: "sumula",
    number: "149",
    caseNumber: null,
    documentUrl: null,
    status: "nao_conferido",
    scopeNote: null,
  },
  "stj-tema-554": {
    court: "STJ",
    category: "tema",
    number: "554",
    caseNumber: null,
    documentUrl: null,
    status: "nao_conferido",
    scopeNote: null,
  },
};

// Repository-versioned candidates. Consolidated text is not assumed to apply
// throughout the declared historical interval. Human confirmation is required.
const initialRecords: readonly LegalRecord[] = SOURCE_SEEDS.map((source) =>
  legalRecordSchema.parse({
    id: source.id,
    version: source.version,
    revision: 1,
    kind: PRECEDENTS[source.id] ? "jurisprudencia" : "legislacao",
    title: source.title,
    url: source.url,
    authority: PRECEDENTS[source.id]?.court ?? (source.id === "in-128" ? "DOU" : "Planalto"),
    references: REFERENCES[source.id],
    effective: { from: source.effectiveFrom, until: source.effectiveUntil, verified: false },
    legalStatus: "nao_conferida",
    precedent: PRECEDENTS[source.id] ?? null,
    capture: captures.find((item) => item.id === source.id)?.capture ?? null,
    review: {
      status: "pendente",
      reviewerReference: null,
      reviewedAt: null,
      captureSha256: null,
      dueOn: null,
      note: null,
    },
    history: [
      {
        at: "2026-10-30T00:00:00Z",
        event: "cadastro",
        reason:
          "Referência preexistente importada como candidata; artigos, vigência e situação aguardam conferência oficial e revisão humana.",
      },
      ...captures
        .filter((item) => item.id === source.id)
        .map((item) => ({
          at: item.capture.capturedAt,
          event: "captura",
          reason:
            "Texto normativo capturado com SHA-256; identidade, vigência, alterações posteriores e revisão humana permanecem pendentes.",
        })),
    ],
  }),
);

// Future revisions are appended in data, never written through a public endpoint.
export const LEGAL_CATALOG: readonly LegalRecord[] = validateLegalCatalog([
  ...initialRecords,
  ...updates,
]);

function freeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}
freeze(LEGAL_CATALOG);

export function validateLegalCatalog(input: readonly unknown[]): LegalRecord[] {
  if (!input.length || input.length > 5000) throw new Error("Catálogo vazio ou acima do limite.");
  const records = input.map((record) => legalRecordSchema.parse(record));
  const versions = new Set<string>();
  const revisions = new Set<string>();
  for (const record of records) {
    const versionKey = `${record.id}@${record.version}`;
    const revisionKey = `${record.id}@${record.revision}`;
    if (versions.has(versionKey) || revisions.has(revisionKey))
      throw new Error("Versão ou revisão duplicada no catálogo.");
    versions.add(versionKey);
    revisions.add(revisionKey);
  }
  const byId = new Map<string, LegalRecord[]>();
  for (const record of records) byId.set(record.id, [...(byId.get(record.id) ?? []), record]);
  for (const versionsForId of byId.values()) {
    versionsForId.sort((a, b) => a.revision - b.revision);
    versionsForId.forEach((record, index) => {
      if (record.revision !== index + 1) throw new Error("Histórico de revisões incompleto.");
      const previous = versionsForId[index - 1];
      if (
        previous &&
        JSON.stringify(record.history.slice(0, previous.history.length)) !==
          JSON.stringify(previous.history)
      )
        throw new Error("Histórico anterior não pode ser reescrito.");
    });
  }
  return records;
}

export function latestLegalRecords(records: readonly LegalRecord[] = LEGAL_CATALOG) {
  const latest = new Map<string, LegalRecord>();
  for (const record of records) {
    if (!latest.has(record.id) || latest.get(record.id)!.revision < record.revision)
      latest.set(record.id, record);
  }
  return [...latest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function findLegalRecord(id: string, version?: string) {
  return version
    ? LEGAL_CATALOG.find((record) => record.id === id && record.version === version)
    : latestLegalRecords().find((record) => record.id === id);
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function readLegalLibrary(
  input: unknown,
  checkedOn: string,
  catalog: readonly unknown[] = LEGAL_CATALOG,
) {
  legalDateSchema.parse(checkedOn);
  const query = libraryQuerySchema.parse(input);
  const latest = latestLegalRecords(validateLegalCatalog(catalog));
  const term = normalize(query.query);
  const matching = latest.filter(
    (record) =>
      (query.kind === "todas" || record.kind === query.kind) &&
      normalize(
        [
          record.id,
          record.title,
          record.authority,
          ...record.references,
          record.precedent?.caseNumber ?? "",
        ].join(" "),
      ).includes(term),
  );
  return {
    moduleStatus: "nao_homologado" as const,
    notice:
      "Catálogo em revisão. Cadastro de referência não comprova vigência, alcance ou direito a benefício.",
    onDate: query.onDate,
    checkedOn,
    total: matching.length,
    offset: query.offset,
    limit: query.limit,
    items: matching.slice(query.offset, query.offset + query.limit).map((record) => ({
      ...record,
      assessment: assessLegalRecord(record, query.onDate, checkedOn),
    })),
  };
}
export type LegalLibraryResult = ReturnType<typeof readLegalLibrary>;

export function resolveLegalCitations(
  citations: readonly { sourceId: string; version: string; reference: string }[],
  onDate: string,
  checkedOn: string,
) {
  if (!citations.length || citations.length > 100) return { usable: false, citations: [] };
  const resolved = citations.map((citation) => {
    const record = findLegalRecord(citation.sourceId, citation.version);
    const assessment = record
      ? assessLegalRecord(record, onDate, checkedOn)
      : { usable: false, blockers: ["fonte_ou_versao_desconhecida"] };
    if (record && !record.references.includes(citation.reference))
      assessment.blockers.push("dispositivo_nao_catalogado");
    return {
      ...citation,
      usable: assessment.usable && assessment.blockers.length === 0,
      blockers: assessment.blockers,
    };
  });
  return { usable: resolved.every((item) => item.usable), citations: resolved };
}
