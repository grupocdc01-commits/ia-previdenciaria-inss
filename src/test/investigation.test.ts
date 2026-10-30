import { describe, expect, it } from "vitest";
import {
  BENEFITS,
  canInvestigateFully,
  MODULES,
  nextInterviewQuestion,
  parseFacts,
  collectStory,
  canAdvanceInterview,
} from "@/lib/investigation";
describe("Investigation safeguards", () => {
  it("does not ask questions before explicit story completion", () => {
    const facts = collectStory(
      parseFacts({ storyStatus: "collecting" }),
      "Meu pedido foi negado",
      false,
    );
    expect(facts.story).toEqual(["Meu pedido foi negado"]);
    expect(nextInterviewQuestion("Aposentadoria", facts)).toBeUndefined();
    const complete = collectStory(facts, "", true);
    expect(nextInterviewQuestion("Aposentadoria", complete)?.key).toBe("subtype");
  });
  it("blocks interview advancement during recording even after intake", () => {
    expect(canAdvanceInterview(parseFacts({}), true)).toBe(false);
    expect(canAdvanceInterview(parseFacts({}), false)).toBe(true);
  });
  it("allows complete analysis only for validated retirement", () => {
    expect(canInvestigateFully("Aposentadoria", true)).toBe(true);
    expect(canInvestigateFully("Aposentadoria", false)).toBe(false);
    for (const benefit of BENEFITS.filter((b) => b !== "Aposentadoria"))
      expect(canInvestigateFully(benefit, true)).toBe(false);
  });
  it("does not release any unvalidated legal module", () => {
    expect(MODULES).toHaveLength(8);
    expect(MODULES.every((module) => module.status === "not_validated")).toBe(true);
  });
  it("asks retirement subtype before reasons and contributions when applicable", () => {
    const facts = parseFacts({});
    expect(nextInterviewQuestion("Aposentadoria", facts)?.key).toBe("subtype");
    facts.answers["subtype"] = "Rural";
    expect(nextInterviewQuestion("Aposentadoria", facts)?.key).toBe("reason");
    expect(nextInterviewQuestion("BPC/LOAS", parseFacts({}))?.key).toBe("reason");
  });
});
