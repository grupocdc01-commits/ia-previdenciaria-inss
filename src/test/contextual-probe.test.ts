import { describe, it, expect } from "vitest";
import { emptyAnswers } from "@/lib/case-model";
import { probeForStep, recordProbe, ruralAssessment, contextualTechnical } from "@/lib/legal/contextual";

const rural = () => ({ ...emptyAnswers(), trabalhos: ["rural", "insalubre"] });
describe("investigação contextual", () => {
  it("detecta trabalho rural na etapa de trabalho", () => expect(probeForStep(rural(), "trabalho")?.id).toBe("rural"));
  it("no máximo uma interrupção por etapa", () => {
    const a = recordProbe(rural(), probeForStep(rural(), "trabalho")!, "pulado");
    expect(probeForStep(a, "trabalho")).toBeUndefined();
  });
  it("pular ou não sei não grava fatos", () => {
    const a = recordProbe(rural(), probeForStep(rural(), "trabalho")!, "nao_sei", ["ccir_itr"]);
    expect(a.contexto?.["rural"]?.values).toBeUndefined();
  });
  it("sem fato relevante não interrompe", () => expect(probeForStep({ ...emptyAnswers(), trabalhos: ["registrado"] }, "trabalho")).toBeUndefined());
  it("detecta indeferimento", () => expect(probeForStep({ ...emptyAnswers(), situacao: "negado" }, "situacao")?.id).toBe("indeferimento"));
  it("documento da terra sozinho é indício isolado, nunca conclusivo", () => {
    expect(ruralAssessment(["ccir_itr"]).status).toBe("indicio_isolado");
    expect(ruralAssessment(["testemunhas"]).status).toBe("sem_indicio");
    expect(ruralAssessment(["autodeclaracao", "notas_produtor", "testemunhas"]).conclusive).toBe(false);
  });
  it("relatório técnico mostra precedentes como não verificados", () => {
    const a = recordProbe(rural(), probeForStep(rural(), "trabalho")!, "confirmado", ["ccir_itr"]);
    const t = contextualTechnical(a)[0]!;
    expect(t.basis.find(b => b.ref === "Súmula 149")?.verification).toBe("nao_verificada");
    expect(t.evidence).toBe("declarado");
  });
});
