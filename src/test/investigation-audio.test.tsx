import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvestigationAudio } from "@/components/investigation-audio";

vi.mock("@/lib/api/cloud-adapter", () => ({ cloudAdapter: { transcribe: vi.fn() } }));
import { cloudAdapter } from "@/lib/api/cloud-adapter";

class Recorder {
  static last: Recorder;
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  constructor() {
    Recorder.last = this;
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.stubGlobal("MediaRecorder", Recorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
  URL.createObjectURL = vi.fn(() => "blob:recording");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Continuous story recording", () => {
  it("keeps recording through prolonged silence and preserves pause/resume until explicit finish", async () => {
    const active = vi.fn();
    render(<InvestigationAudio disabled={false} onTranscript={vi.fn()} onActiveChange={active} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));
    });
    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(Recorder.last.state).toBe("recording");
    fireEvent.click(screen.getByRole("button", { name: "Pausar gravação" }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(Recorder.last.state).toBe("paused");
    expect(active).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Continuar gravação" }));
    expect(Recorder.last.state).toBe("recording");
    fireEvent.click(screen.getByRole("button", { name: "Terminei de contar" }));
    expect(Recorder.last.state).toBe("inactive");
    expect(active).toHaveBeenLastCalledWith(false);
  });
  it("preserves recording for retry and never inserts an invented transcript on failure", async () => {
    vi.mocked(cloudAdapter.transcribe).mockRejectedValue(new Error("Transcrição indisponível"));
    const transcript = vi.fn();
    render(<InvestigationAudio disabled={false} onTranscript={transcript} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Terminei de contar" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transcrever para revisar" }));
    });
    expect(transcript).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Transcrição indisponível");
    expect(cloudAdapter.transcribe).toHaveBeenCalledTimes(1);
  });
});
