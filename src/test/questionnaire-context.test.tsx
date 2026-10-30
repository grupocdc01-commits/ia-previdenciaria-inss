import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyAnswers, type Answers } from "@/lib/case-model";
import { CaseProvider, useCase } from "@/lib/case-store";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/components/shell", async (original) => ({
  ...(await original<typeof import("@/components/shell")>()),
  Page: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
import { Route } from "@/routes/questionario";
const Questionnaire = Route.options.component!;
let latest: Answers;
function Mount({ seed }: { seed: Answers }) {
  const store = useCase();
  const initialized = useRef(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    store.setAnswers(() => seed);
    store.setQuestionnaireStep("trabalho");
  }, [seed, store]);
  latest = store.answers;
  return (
    <>
      <button onClick={() => setVisible((value) => !value)}>Alternar montagem</button>
      {visible && <Questionnaire />}
    </>
  );
}
afterEach(cleanup);
function page() {
  const seed: Answers = {
    ...emptyAnswers(),
    paraQuem: "para_mim",
    beneficio: "aposentadoria",
    situacao: "nao_solicitado",
    idade: "50",
    uf: "SP",
    trabalhos: ["rural", "insalubre", "sem_registro"],
  };
  render(
    <CaseProvider>
      <Mount seed={seed} />
    </CaseProvider>,
  );
}
describe("questionnaire integration", () => {
  it("rejects an impossible age while allowing an explicit unknown answer", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    fireEvent.change(screen.getByLabelText("Idade (em anos)"), { target: { value: "999" } });
    expect(screen.getByRole("button", { name: "Próxima →" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Não sei" }));
    expect(screen.getByRole("button", { name: "Próxima →" })).toBeEnabled();
    expect(latest.idade).toBe("Não sei");
  });
  it("does not attribute earlier answers to a different person", () => {
    page();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    fireEvent.click(screen.getByLabelText("Outra pessoa"));
    expect(latest.paraQuem).toBe("outra_pessoa");
    expect(latest.trabalhos).toBeUndefined();
    expect(latest.idade).toBeUndefined();
  });
  it("asks all three complements before moving on and preserves their distinct statuses", async () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Próxima →" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("trabalho rural");
    expect(screen.getByLabelText(/Na roça, pesca/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Não sei" }));
    await screen.findByText("Você tem ou pode pedir à empresa algum destes papéis?");
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    await screen.findByText("Você tem algum papel da época desse trabalho?");
    fireEvent.click(screen.getByLabelText(/Recibos, holerites/));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("heading", { name: "Quais documentos você possui?" });
    expect(latest.contexto?.["rural"]?.status).toBe("nao_sei");
    expect(latest.contexto?.["insalubre"]?.status).toBe("pulado");
    expect(latest.contexto?.["sem_registro"]?.values).toEqual(["recibos"]);
  });
  it("resumes the in-memory step after navigation without writing browser storage", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    page();
    fireEvent.click(screen.getByRole("button", { name: "Próxima →" }));
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Pular" }));
      await waitFor(() => expect(Object.keys(latest.contexto ?? {})).toHaveLength(i + 1));
    }
    await screen.findByRole("heading", { name: "Quais documentos você possui?" });
    fireEvent.click(screen.getByText("Alternar montagem"));
    fireEvent.click(screen.getByText("Alternar montagem"));
    expect(
      screen.getByRole("heading", { name: "Quais documentos você possui?" }),
    ).toBeInTheDocument();
    expect(storage).not.toHaveBeenCalled();
  });
  it("removes a complement when the corresponding work declaration is removed", async () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Próxima →" }));
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Pular" }));
      await waitFor(() => expect(Object.keys(latest.contexto ?? {})).toHaveLength(i + 1));
    }
    await screen.findByRole("heading", { name: "Quais documentos você possui?" });
    fireEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    fireEvent.click(screen.getByLabelText(/Na roça, pesca/));
    expect(latest.contexto?.["rural"]).toBeUndefined();
    fireEvent.click(screen.getByLabelText(/Na roça, pesca/));
    fireEvent.click(screen.getByRole("button", { name: "Próxima →" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("trabalho rural");
  });
});
