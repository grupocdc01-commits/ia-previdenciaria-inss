import { describe, expect, it } from "vitest";
import { applyAnamnesisTurn, newInvestigationFacts, readAnamnesis } from "@/lib/anamnesis";
import {
  factsSchema,
  responseSchema,
  type InterviewFacts,
  type InterviewResponse,
} from "@/lib/anamnesis-schema";
import { emptyAnswers, recordAdaptedResponse, reconcileAdaptedAnswers } from "@/lib/case-model";
import {
  contextualTechnical,
  pendingProbes,
  probeById,
  probeForStep,
  pruneContext,
  recordProbe,
} from "@/lib/legal/contextual";
import { parseFacts } from "@/lib/investigation";

const completeStory = () =>
  applyAnamnesisTurn(null, newInvestigationFacts(true), {
    kind: "story",
    text: "Relato fictício",
    finish: true,
  });
function answer(benefit: string | null, facts: InterviewFacts, response: InterviewResponse) {
  return applyAnamnesisTurn(benefit, facts, {
    kind: "answer",
    questionId: readAnamnesis(benefit, facts).current!.key,
    response,
  });
}
function session(benefit = "Aposentadoria") {
  const story = completeStory();
  return answer(null, story.facts, { status: "confirmado", values: [benefit] });
}
function fill(responses: Record<string, InterviewResponse> = {}, benefit = "Aposentadoria") {
  let state = session(benefit);
  for (let i = 0; i < 40 && state.session.current; i++)
    state = answer(
      state.benefit,
      state.facts,
      responses[state.session.current.key] ?? { status: "nao_sei" },
    );
  if (state.session.current) throw new Error("Interview did not terminate");
  return state;
}

describe("Módulo 2 — simples", () => {
  it("keeps legacy flows and requires explicit story completion for new interviews", () => {
    expect(newInvestigationFacts(false).interviewVersion).toBe(1);
    expect(readAnamnesis(null, { interviewVersion: 2 }).phase).toBe("story");
    expect(parseFacts({ answers: { reason: "Fictício" } }).storyStatus).toBe("complete");
    const first = applyAnamnesisTurn(null, newInvestigationFacts(true), {
      kind: "story",
      text: "Meu trabalho era rural",
      finish: false,
    });
    expect(first.session.current).toBeNull();
    expect(first.benefit).toBeNull();
    const done = applyAnamnesisTurn(null, first.facts, { kind: "story", text: "", finish: true });
    expect(done.facts.story).toEqual(["Meu trabalho era rural"]);
    expect(done.session.current?.key).toBe("benefit");
    expect(done.facts.contexto).toEqual({});
  });
  it("asks every relevant work complement, never only one per step", () => {
    let input = { ...emptyAnswers(), trabalhos: ["rural", "insalubre", "sem_registro"] };
    const order: string[] = [];
    while (probeForStep(input, "trabalho")) {
      const probe = probeForStep(input, "trabalho")!;
      order.push(probe.id);
      input = recordProbe(input, probe, "pulado");
    }
    expect(order).toEqual(["rural", "insalubre", "sem_registro"]);
    expect(contextualTechnical(input)[0]?.rural).toBeUndefined();
    expect(
      contextualTechnical(input).every(
        (item) => item.evidence === "declarado" && !item.values.length,
      ),
    ).toBe(true);
  });
  it("finishes without mandatory documents and retains explicit unknown and skipped statuses", () => {
    const done = fill({
      situation: { status: "pulado" },
      documents: { status: "confirmado", values: ["nenhum"] },
    });
    expect(done.session.phase).toBe("complete");
    expect(done.session.canConclude).toBe(false);
    expect(done.facts.responses["situation"]?.status).toBe("pulado");
    expect(done.facts.answers["situation"]).toBeUndefined();
    expect(done.facts.responses["workTypes"]?.status).toBe("nao_sei");
    expect(done.session.missing.length).toBeGreaterThan(0);
  });
  it("resumes exactly from serialized private facts without local storage", () => {
    const state = fill({
      workTypes: { status: "confirmado", values: ["rural", "insalubre"] },
      "context:rural": { status: "confirmado", values: ["ccir_itr", "testemunhas"] },
      "context:insalubre": { status: "pulado" },
    });
    const restored = readAnamnesis(state.benefit, JSON.parse(JSON.stringify(state.facts)));
    expect(restored).toEqual(state.session);
    expect(restored.contextual).toHaveLength(2);
    expect(restored.contextual.every((item) => item.basis.every((source) => !source.usable))).toBe(
      true,
    );
  });
  it("separates adapted answers from omitted and unknown values", () => {
    const base = { ...emptyAnswers(), beneficio: "aposentadoria" as const };
    const confirmed = recordAdaptedResponse(
      base,
      "ap_historico",
      "confirmado",
      "Trabalho fictício",
    );
    const unknown = recordAdaptedResponse(confirmed, "ap_historico", "nao_sei");
    expect(unknown.adaptadas["ap_historico"]).toBeUndefined();
    expect(unknown.adaptadasStatus?.["ap_historico"]).toBe("nao_sei");
    expect(
      reconcileAdaptedAnswers(confirmed, { ...confirmed, beneficio: "outro" }).adaptadas,
    ).toEqual({});
  });
});

describe("Módulo 2 — médio", () => {
  it("refuses answers before story completion, empty completion and malformed persisted facts", () => {
    expect(() =>
      applyAnamnesisTurn(null, newInvestigationFacts(true), {
        kind: "answer",
        questionId: "benefit",
        response: { status: "pulado" },
      }),
    ).toThrow();
    expect(() =>
      applyAnamnesisTurn(null, newInvestigationFacts(true), {
        kind: "story",
        text: "",
        finish: true,
      }),
    ).toThrow();
    expect(() => parseFacts({ storyStatus: "corrupted" })).toThrow();
    expect(() => parseFacts({ interviewVersion: 2, storyStatus: "complete", story: [] })).toThrow();
    expect(() => factsSchema.parse({ story: Array(101).fill("synthetic") })).toThrow();
  });
  it.each([
    { status: "confirmado" },
    { status: "confirmado", value: " " },
    { status: "nao_sei", value: "invented" },
    { status: "pulado", values: ["rural"] },
    { status: "confirmado", value: "x", values: ["rural"] },
    { status: "confirmed", value: "x" },
  ])("rejects incompatible response %j", (response) =>
    expect(responseSchema.safeParse(response).success).toBe(false),
  );
  it.each(
    [["rural", "nunca"], ["rural", "rural"], ["invented"], ["__proto__"]].map((values) => ({
      values,
    })),
  )("rejects invalid work selection %j", ({ values }) => {
    const done = fill();
    expect(() =>
      applyAnamnesisTurn(done.benefit, done.facts, {
        kind: "revise",
        questionId: "workTypes",
        response: { status: "confirmado", values },
      }),
    ).toThrow();
  });
  it.each(["2026-02-30", "2999-01-01", "not-a-date"])(
    "rejects invalid or future date %s",
    (value) => {
      const done = fill({ situation: { status: "confirmado", values: ["negado"] } });
      expect(() =>
        applyAnamnesisTurn(done.benefit, done.facts, {
          kind: "revise",
          questionId: "requestDate",
          response: { status: "confirmado", value },
        }),
      ).toThrow();
    },
  );
  it.each(["-1", "121", "abc", "1.5"])("rejects invalid age %s", (value) => {
    const done = fill();
    expect(() =>
      applyAnamnesisTurn(done.benefit, done.facts, {
        kind: "revise",
        questionId: "age",
        response: { status: "confirmado", value },
      }),
    ).toThrow();
  });
  it("does not infer disability, work types or a benefit from story text", () => {
    const first = applyAnamnesisTurn(null, newInvestigationFacts(true), {
      kind: "story",
      text: "Fictício: rural, incapacidade, benefício",
      finish: true,
    });
    expect(first.benefit).toBeNull();
    expect(first.facts.responses).toEqual({});
    expect(first.session.contextual).toEqual([]);
  });
  it("rejects stale question identifiers without mutating the original state", () => {
    const state = session();
    const before = JSON.stringify(state.facts);
    expect(() =>
      applyAnamnesisTurn(state.benefit, state.facts, {
        kind: "answer",
        questionId: "documents",
        response: { status: "pulado" },
      }),
    ).toThrow();
    expect(JSON.stringify(state.facts)).toBe(before);
  });
  it("invalidates dependent answers on changed situation and work types", () => {
    const done = fill({
      situation: { status: "confirmado", values: ["negado"] },
      workTypes: { status: "confirmado", values: ["rural", "insalubre"] },
    });
    const changed = applyAnamnesisTurn(done.benefit, done.facts, {
      kind: "revise",
      questionId: "situation",
      response: { status: "confirmado", values: ["nao_solicitado"] },
    });
    expect(changed.facts.responses["noticeDate"]).toBeUndefined();
    expect(changed.facts.contexto["indeferimento"]).toBeUndefined();
    const work = applyAnamnesisTurn(changed.benefit, changed.facts, {
      kind: "revise",
      questionId: "workTypes",
      response: { status: "confirmado", values: ["registrado"] },
    });
    expect(work.facts.contexto["rural"]).toBeUndefined();
    expect(work.facts.contexto["insalubre"]).toBeUndefined();
  });
  it("preserves the story but resets dependent responses when the citizen changes benefit", () => {
    const done = fill({ workTypes: { status: "confirmado", values: ["rural"] } });
    const changed = applyAnamnesisTurn(done.benefit, done.facts, {
      kind: "revise",
      questionId: "benefit",
      response: { status: "confirmado", values: ["BPC/LOAS"] },
    });
    expect(changed.facts.story).toEqual(done.facts.story);
    expect(Object.keys(changed.facts.responses)).toEqual(["benefit"]);
    expect(changed.facts.contexto).toEqual({});
    expect(changed.session.current?.key).toBe("situation");
  });
  it("does not classify an unknown age as a child and invalidates changed age support", () => {
    const done = fill(
      {
        age: { status: "confirmado", value: "10" },
        dailySupport: { status: "confirmado", value: "Apoio fictício" },
      },
      "BPC/LOAS",
    );
    const changed = applyAnamnesisTurn(done.benefit, done.facts, {
      kind: "revise",
      questionId: "age",
      response: { status: "nao_sei" },
    });
    expect(changed.facts.responses["dailySupport"]).toBeUndefined();
    expect(changed.session.current?.label).not.toContain("criança");
  });
  it("flags divergent dates without inventing corrections or deadlines", () => {
    const done = fill({
      situation: { status: "confirmado", values: ["negado"] },
      requestDate: { status: "confirmado", value: "2020-06-01" },
      noticeDate: { status: "confirmado", value: "2020-05-01" },
    });
    expect(done.session.notices[0]).toContain("anterior");
    expect(done.facts.responses["noticeDate"]?.value).toBe("2020-05-01");
    expect(done.session.canConclude).toBe(false);
  });
  it("rejects fabricated contextual options and prunes deactivated triggers", () => {
    const base = { ...emptyAnswers(), trabalhos: ["rural"] };
    const probe = probeById("rural")!;
    expect(() =>
      recordProbe(base, { ...probe, options: { fake: "invented" } }, "confirmado", ["fake"]),
    ).toThrow();
    const answered = recordProbe(base, probe, "confirmado", ["ccir_itr"]);
    expect(pruneContext({ ...answered, trabalhos: ["registrado"] }).contexto).toEqual({});
    expect(
      pendingProbes({ ...answered, trabalhos: ["rural", "insalubre"] }).map((item) => item.id),
    ).toEqual(["insalubre"]);
  });
});

describe("Módulo 2 — alto estresse local", () => {
  it("completes 200 isolated sessions without inventing values or modifying initial facts", async () => {
    const original = newInvestigationFacts(true);
    const serialized = JSON.stringify(original);
    const result = await Promise.all(Array.from({ length: 200 }, async () => fill()));
    expect(
      result.every((item) => item.session.phase === "complete" && !item.session.canConclude),
    ).toBe(true);
    expect(
      result.every((item) =>
        Object.values(item.facts.responses)
          .filter((response) => response.status !== "confirmado")
          .every((response) => response.value === undefined && response.values === undefined),
      ),
    ).toBe(true);
    expect(JSON.stringify(original)).toBe(serialized);
    expect(fetch).not.toHaveBeenCalled();
  }, 20000);
  it("handles 5000 repeated invalid options without altering any declaration", () => {
    const base = { ...emptyAnswers(), trabalhos: ["rural"] };
    const probe = probeById("rural")!;
    for (let i = 0; i < 5000; i++)
      expect(() => recordProbe(base, probe, "confirmado", ["invented"])).toThrow();
    expect(base.contexto).toBeUndefined();
  }, 20000);
});
