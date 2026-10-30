import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newInvestigationFacts, readAnamnesis } from "@/lib/anamnesis";
import { StructuredInterview } from "@/components/structured-interview";

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/api/cloud-adapter", () => ({ cloudAdapter: { submitAnamnesis: mocks.submit } }));
vi.mock("@/components/investigation-audio", () => ({
  InvestigationAudio: ({
    onActiveChange,
    onTranscript,
    disabled,
  }: {
    onActiveChange: (value: boolean) => void;
    onTranscript: (value: string) => void;
    disabled: boolean;
  }) => (
    <div>
      <button disabled={disabled} onClick={() => onActiveChange(true)}>
        Gravar teste
      </button>
      <button disabled={disabled} onClick={() => onActiveChange(false)}>
        Parar teste
      </button>
      <button disabled={disabled} onClick={() => onTranscript("Transcrição fictícia para revisar")}>
        Transcrever teste
      </button>
    </div>
  ),
}));
beforeEach(() => {
  mocks.submit.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);
function page() {
  const facts = newInvestigationFacts(true);
  const thread = {
    id: "00000000-0000-4000-8000-000000000001",
    updated_at: "2026-10-30T00:00:00Z",
    benefit: null,
    facts,
    anamnesis: readAnamnesis(null, facts),
    messages: [],
  } as unknown as Parameters<typeof StructuredInterview>[0]["thread"];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <StructuredInterview thread={thread} />
    </QueryClientProvider>,
  );
}
describe("structured private interview UI", () => {
  it("never sends a transcript until the user reviews and explicitly confirms", async () => {
    page();
    expect(
      screen.getByRole("link", { name: "Ver painel e documentos da investigação" }),
    ).toHaveAttribute("href", "/investigacao/00000000-0000-4000-8000-000000000001/painel");
    fireEvent.click(screen.getByText("Transcrever teste"));
    expect(screen.getByLabelText("Seu relato")).toHaveValue("Transcrição fictícia para revisar");
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Terminei de contar"));
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: { kind: "story", text: "Transcrição fictícia para revisar", finish: true },
        }),
      ),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the draft after network failure and reuses the request id for identical retry", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("synthetic network failure"));
    page();
    fireEvent.change(screen.getByLabelText("Seu relato"), {
      target: { value: "Relato fictício retido" },
    });
    fireEvent.click(screen.getByText("Terminei de contar"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Seu relato")).toHaveValue("Relato fictício retido");
    fireEvent.click(screen.getByText("Terminei de contar"));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[0]![0].requestId).toBe(mocks.submit.mock.calls[1]![0].requestId);
  });
  it("prevents advancing while recording and prevents duplicate clicks while saving", async () => {
    let finish!: () => void;
    mocks.submit.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    page();
    fireEvent.change(screen.getByLabelText("Seu relato"), { target: { value: "Relato fictício" } });
    fireEvent.click(screen.getByText("Gravar teste"));
    expect(screen.getByText("Terminei de contar")).toBeDisabled();
    fireEvent.click(screen.getByText("Terminei de contar"));
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Parar teste"));
    fireEvent.click(screen.getByText("Terminei de contar"));
    fireEvent.click(screen.getByText("Terminei de contar"));
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});
