import { describe, expect, it } from "vitest";
import { LABELS } from "@/lib/case-model";

describe("pergunta de benefício do questionário", () => {
  it("coloca 'Não sei' em primeiro lugar, como caminho recomendado", () => {
    expect(Object.keys(LABELS.beneficioPergunta)[0]).toBe("nao_sei");
    expect(LABELS.beneficioPergunta.nao_sei).toContain("Não sei");
  });

  it("mantém as mesmas opções de benefício já existentes", () => {
    expect(new Set(Object.keys(LABELS.beneficioPergunta))).toEqual(new Set(Object.keys(LABELS.beneficio)));
  });

  it("explica cada opção em linguagem simples, com 'Saiba mais' para detalhes", () => {
    for (const key of Object.keys(LABELS.beneficioPergunta) as (keyof typeof LABELS.beneficioPergunta)[]) {
      expect(LABELS.beneficioExplicacao[key]?.length ?? 0).toBeGreaterThan(0);
      expect(LABELS.beneficioDetalhe[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
