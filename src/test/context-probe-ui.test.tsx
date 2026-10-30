import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextProbe } from "@/components/context-probe";
import { probeById } from "@/lib/legal/contextual";

afterEach(cleanup);
const rural = probeById("rural")!;
describe("contextual dialog regressions", () => {
  it("focuses the question and confirms only selected declarations", async () => {
    const done = vi.fn();
    render(<ContextProbe probe={rural} onDone={done} />);
    expect(screen.getByRole("heading", { name: rural.question })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/CCIR, ITR/));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(done).toHaveBeenCalledWith("confirmado", ["ccir_itr"]));
  });
  it.each([
    ["Não sei", "nao_sei"],
    ["Pular", "pulado"],
  ])("%s never sends selected values", async (label, status) => {
    const done = vi.fn();
    render(<ContextProbe probe={rural} onDone={done} />);
    fireEvent.click(screen.getByLabelText(/CCIR, ITR/));
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(done).toHaveBeenCalledWith(status, []));
  });
  it("keeps None mutually exclusive with document choices", () => {
    render(<ContextProbe probe={rural} onDone={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/CCIR, ITR/));
    fireEvent.click(screen.getByLabelText("Nenhum destes"));
    expect(screen.getByLabelText(/CCIR, ITR/)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/CCIR, ITR/));
    expect(screen.getByLabelText("Nenhum destes")).not.toBeChecked();
  });
  it("prevents double submits and all changes while an answer is being saved", async () => {
    let finish!: () => void;
    const done = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<ContextProbe probe={rural} onDone={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(done).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Não sei" })).toBeDisabled();
    await act(async () => finish());
  });
  it("retains selections after a failure so the user can retry", async () => {
    const done = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic internal failure"))
      .mockResolvedValue(undefined);
    render(<ContextProbe probe={rural} onDone={done} />);
    fireEvent.click(screen.getByLabelText(/CCIR, ITR/));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente");
    expect(screen.getByLabelText(/CCIR, ITR/)).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(2));
  });
  it("blocks actions while recording or disabled by the parent", () => {
    const done = vi.fn();
    render(<ContextProbe probe={rural} onDone={done} disabled />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/CCIR, ITR/)).toBeDisabled();
  });
});
