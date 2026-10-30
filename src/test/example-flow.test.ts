import { describe, expect, it } from "vitest";
import { advanceExampleStage } from "@/lib/example-flow";

describe("Sequência dos exemplos", () => {
  it("avança da conversa para as perguntas quando há informações", () => {
    expect(advanceExampleStage(0, true)).toBe(1);
  });
  it("avança das perguntas para o painel sem pular etapas", () => {
    expect(advanceExampleStage(1, true)).toBe(2);
  });
  it("aguarda informações antes de avançar", () => {
    expect(advanceExampleStage(0, false)).toBe(0);
    expect(advanceExampleStage(1, false)).toBe(1);
  });
});