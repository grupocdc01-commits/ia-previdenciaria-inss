import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentFieldReview } from "@/components/document-field-review";
import { DocumentDossier } from "@/components/document-dossier";
import { buildDocumentDossier } from "@/lib/api/document-dossier.server";
import { fixtureDoc, THREAD, TODAY } from "./fixtures/document-dossier";
const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/api/cloud-adapter", () => ({ cloudAdapter: { documentModule: mocks.submit } }));
beforeEach(() => {
  mocks.submit.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);
describe("module 3 review and report UI", () => {
  it("never confirms fields until explicit saving, and retains choices after failure", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("Falha sintética"));
    render(<DocumentFieldReview document={fixtureDoc()} onSaved={async () => {}} />);
    fireEvent.change(screen.getByLabelText("Conferência do campo 1"), {
      target: { value: "rejected" },
    });
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Salvar conferência dos campos"));
    await screen.findByText("Falha sintética");
    expect(screen.getByLabelText("Conferência do campo 1")).toHaveValue("rejected");
    fireEvent.click(screen.getByText("Salvar conferência dos campos"));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[1]![0]).toMatchObject({
      decisions: ["rejected", "confirmed", "pending"],
      expectedRevision: 1,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("prevents duplicate saves and editing while a confirmation is in flight", async () => {
    mocks.submit.mockReturnValue(new Promise(() => {}));
    render(<DocumentFieldReview document={fixtureDoc()} onSaved={async () => {}} />);
    const button = screen.getByText("Salvar conferência dos campos");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Conferência do campo 1")).toBeDisabled();
  });
  it("does not transmit declared periods before generation or persist them in localStorage", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    mocks.submit.mockResolvedValue({
      ok: true,
      dossier: buildDocumentDossier(
        { operation: "dossier", threadId: THREAD, periods: [] },
        [],
        TODAY,
      ),
    });
    render(<DocumentDossier threadId={THREAD} documents={[]} />);
    fireEvent.change(screen.getByLabelText("Início declarado"), {
      target: { value: "2020-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Fim declarado"), { target: { value: "2020-01-10" } });
    fireEvent.click(screen.getByText("Adicionar período declarado"));
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Gerar relatório administrativo"));
    await screen.findByRole("article", { name: "Relatório administrativo" });
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        periods: [{ origin: "declared", start: "2020-01-01", end: "2020-01-10" }],
      }),
    );
    expect(storage).not.toHaveBeenCalled();
    expect(screen.getByText(/Tempo oficial de contribuição e carência/)).toBeInTheDocument();
  });
  it("keeps period selection after API failure and allows removing invalid entries", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("Datas inválidas"));
    render(<DocumentDossier threadId={THREAD} documents={[]} />);
    fireEvent.change(screen.getByLabelText("Início declarado"), {
      target: { value: "2020-01-10" },
    });
    fireEvent.change(screen.getByLabelText("Fim declarado"), { target: { value: "2020-01-01" } });
    fireEvent.click(screen.getByText("Adicionar período declarado"));
    fireEvent.click(screen.getByText("Gerar relatório administrativo"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Remover período 1")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remover período 1"));
    expect(screen.queryByLabelText("Remover período 1")).not.toBeInTheDocument();
  });
  it("shows only confirmed fields for explicit pairing and never chooses dates automatically", () => {
    render(
      <DocumentDossier
        threadId={THREAD}
        documents={[fixtureDoc({ administrative_review: ["confirmed", "pending", "rejected"] })]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Documento do período"), {
      target: { value: fixtureDoc().id },
    });
    expect(screen.getByLabelText("Campo de início")).toHaveValue("");
    expect(screen.getByLabelText("Campo de fim").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByText("Adicionar período conferido")).toBeDisabled();
  });
  it("hides an old report when a document revision changes", async () => {
    const document = fixtureDoc();
    mocks.submit.mockResolvedValue({
      ok: true,
      dossier: buildDocumentDossier(
        { operation: "dossier", threadId: THREAD, periods: [] },
        [document],
        TODAY,
      ),
    });
    const view = render(<DocumentDossier threadId={THREAD} documents={[document]} />);
    fireEvent.click(screen.getByText("Gerar relatório administrativo"));
    await screen.findByRole("article", { name: "Relatório administrativo" });
    view.rerender(
      <DocumentDossier threadId={THREAD} documents={[fixtureDoc({ review_revision: 2 })]} />,
    );
    expect(
      screen.queryByRole("article", { name: "Relatório administrativo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/A lista de documentos mudou/)).toBeInTheDocument();
  });
  it("offers no fields from malformed legacy extraction", () => {
    render(
      <DocumentDossier
        threadId={THREAD}
        documents={[fixtureDoc({ extraction: { bad: "payload" } })]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Documento do período"), {
      target: { value: fixtureDoc().id },
    });
    expect(screen.getByLabelText("Campo de início").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByText("Adicionar período conferido")).toBeDisabled();
  });
});
