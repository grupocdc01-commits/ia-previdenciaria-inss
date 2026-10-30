import { describe, expect, it } from "vitest";
import { evaluate, nextQuestion } from "@/lib/legal/engine";
import { summarizePeriods } from "@/lib/legal/periods";
import { LEGAL_SOURCES, isSourceTrusted } from "@/lib/legal/sources";
import { plainReport, technicalReport } from "@/lib/legal/report";

const ref = "2026-10-30";
const mod = (r: ReturnType<typeof evaluate>, id: string) => r.find((m) => m.module === id)!;

describe("motor jurídico", () => {
  it("sem documentos e sem dados: tudo indeterminado, nunca elegível", () => {
    const r = evaluate({ referenceDate: ref });
    expect(r.every((m) => m.overall === "indeterminado" && m.preliminary)).toBe(true);
  });
  it("quem nunca pediu recebe primeira pergunta sobre pedido e ressalva própria", () => {
    expect(nextQuestion({ referenceDate: ref })?.fact).toBe("everRequested");
    const r = evaluate({ referenceDate: ref, everRequested: false });
    expect(r[0]!.caveats.some((c) => c.includes("ainda não fez o pedido"))).toBe(true);
    expect(nextQuestion({ referenceDate: ref, everRequested: false })).toBeDefined();
  });
  it("indeferido mantém motivo nas ressalvas", () => {
    const r = evaluate({
      referenceDate: ref,
      everRequested: true,
      denied: true,
      denialReason: "renda",
    });
    expect(r[0]!.caveats.join(" ")).toContain("motivo informado: renda");
  });
  it("BPC idoso: 65 anos e renda até 1/4 do mínimo informado = atendido, mas preliminar", () => {
    const m = mod(
      evaluate({
        referenceDate: ref,
        birthDate: "1955-01-01",
        householdSize: 2,
        householdMonthlyIncome: 300,
        minimumWage: 1500,
      }),
      "bpc_idoso",
    );
    expect(m.overall).toBe("atendido");
    expect(m.preliminary).toBe(true);
  });
  it("BPC idoso: 64 anos = não atendido", () => {
    expect(
      mod(evaluate({ referenceDate: ref, birthDate: "1962-11-01" }), "bpc_idoso").overall,
    ).toBe("nao_atendido");
  });
  it("renda sem salário mínimo informado fica indeterminada (não inventa valor)", () => {
    const m = mod(
      evaluate({
        referenceDate: ref,
        birthDate: "1950-01-01",
        householdSize: 1,
        householdMonthlyIncome: 0,
      }),
      "bpc_idoso",
    );
    expect(m.requirements.find((r) => r.id === "renda")!.status).toBe("indeterminado");
  });
  it("incapacidade nunca é atendida só por declaração", () => {
    const m = mod(
      evaluate({
        referenceDate: ref,
        workIncapacity: "temporaria",
        insuredStatus: true,
        hasMedicalEvidence: true,
        accidentOrExemptDisease: true,
      }),
      "incapacidade_temporaria",
    );
    expect(m.overall).toBe("indeterminado");
  });
  it("homem sem informar filiação antes da EC 103: contribuição indeterminada", () => {
    const m = mod(
      evaluate({ referenceDate: ref, sex: "masculino", birthDate: "1950-01-01" }),
      "aposentadoria_idade",
    );
    expect(m.requirements.find((r) => r.id === "contribuicao")!.status).toBe("indeterminado");
  });
  it("só declarados suficientes = indeterminado; comprovados = atendido", () => {
    const base = { referenceDate: ref, sex: "feminino" as const, birthDate: "1960-01-01" };
    const decl = mod(
      evaluate({
        ...base,
        periods: [{ start: "2000-01-01", end: "2016-12-31", origin: "declarado" }],
      }),
      "aposentadoria_idade",
    );
    expect(decl.overall).toBe("indeterminado");
    const prov = mod(
      evaluate({
        ...base,
        periods: [{ start: "2000-01-01", end: "2016-12-31", origin: "comprovado" }],
      }),
      "aposentadoria_idade",
    );
    expect(prov.overall).toBe("atendido");
  });
});

describe("períodos", () => {
  it("sobreposição não conta duas vezes", () => {
    const s = summarizePeriods([
      { start: "2020-01-01", end: "2020-12-31", origin: "comprovado" },
      { start: "2020-07-01", end: "2021-06-30", origin: "declarado" },
    ]);
    expect(s.totalDays).toBe(547);
    expect(s.provenDays).toBe(366);
    expect(s.declaredOnlyDays).toBe(181);
    expect(s.overlapsRemovedDays).toBe(184);
  });
});

describe("fontes e relatório", () => {
  it("fontes não verificadas não são confiáveis e marcam o resultado", () => {
    expect(LEGAL_SOURCES.some(isSourceTrusted)).toBe(false);
    expect(evaluate({ referenceDate: ref }).every((m) => !m.sourcesTrusted)).toBe(true);
  });
  it("relatório técnico traz URL oficial e o simples lista pendências", () => {
    const r = evaluate({ referenceDate: ref, everRequested: true });
    expect(technicalReport(r)[0]!.requirements[0]!.basis[0]!.url).toMatch(
      /^https:\/\/www\.planalto\.gov\.br/,
    );
    expect(plainReport(r).pending.length).toBeGreaterThan(0);
  });
});
