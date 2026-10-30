import { describe, expect, it } from "vitest";
import { classifyRouting } from "@/lib/legal/routing";

const ref = "2026-10-30";
describe("encaminhamento", () => {
  it("nunca pediu: requerimento no INSS, sem sugerir ação judicial como saída", () => {
    const r = classifyRouting({ referenceDate: ref, everRequested: false });
    expect(r.inss[0]!.action).toContain("Meu INSS");
    expect(r.legalHelp.every(x => x.action.includes("não indicada"))).toBe(true);
  });
  it("indeferido sem controvérsia não gera via judicial automática", () => {
    const r = classifyRouting({ referenceDate: ref, everRequested: true, denied: true, decisionDate: "2026-10-20" });
    expect(r.legalHelp).toHaveLength(0);
    expect(r.inss[0]!.action).toContain("CRPS");
  });
  it("indeferido com controvérsia pericial: ajuda jurídica sem obrigar advogado nem prometer êxito", () => {
    const r = classifyRouting({ referenceDate: ref, everRequested: true, denied: true, decisionDate: "2026-01-01", factualDispute: "pericia", needsWitnessOrExpertProof: true });
    const j = r.legalHelp[0]!;
    expect(j.why).toContain("sem advogado");
    expect(j.why).toContain("não indica que uma ação seja obrigatória");
    expect(j.humanReview).toBe(true);
  });
  it("indeferido sem data de ciência pede investigação complementar", () => {
    const r = classifyRouting({ referenceDate: ref, everRequested: true, denied: true });
    expect(r.recommendations.some(x => x.track === "investigacao_complementar")).toBe(true);
  });
  it("fontes não validadas tornam a orientação preliminar", () => {
    const r = classifyRouting({ referenceDate: ref, everRequested: false });
    expect(r.status).toBe("preliminar");
    expect(r.notices[0]).toContain("preliminar");
  });
  it("toda recomendação de via tem fonte com URL oficial", () => {
    const r = classifyRouting({ referenceDate: ref, everRequested: true, denied: true, decisionDate: "2026-10-20", cnisDivergence: true, pendingRequirement: true });
    for (const x of [...r.inss, ...r.legalHelp]) expect(x.basis.length).toBeGreaterThan(0);
  });
});
