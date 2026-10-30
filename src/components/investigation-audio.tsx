import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, FileAudio, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";

export function InvestigationAudio({
  onTranscript,
  disabled,
  onActiveChange,
}: {
  onTranscript: (text: string) => void;
  disabled: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const media = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      media.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    onActiveChange?.(recording);
  }, [recording, onActiveChange]);
  useEffect(() => {
    if (!audio) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(audio);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [audio]);
  const start = async () => {
    setError("");
    setAudio(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não permite gravar áudio. Você pode continuar por texto.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      media.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.current = current;
      const chunks: Blob[] = [];
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (alive.current) {
          setAudio(new Blob(chunks, { type: current.mimeType }));
          setRecording(false);
          setPaused(false);
        }
      };
      current.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (alive.current) {
          setRecording(false);
          setPaused(false);
          setError("A gravação foi interrompida. Tente novamente ou escreva sua resposta.");
        }
      };
      current.start();
      setRecording(true);
      setPaused(false);
    } catch {
      setError("Não foi possível acessar o microfone. Autorize o acesso ou continue por texto.");
    }
  };
  const transcribe = async () => {
    if (!audio) return;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const text = await cloudAdapter.transcribe(audio, controller.current.signal);
      if (alive.current) {
        onTranscript(text);
        setAudio(null);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Transcrição indisponível. Continue por texto.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={recording ? "destructive" : "outline"}
          className="h-12"
          disabled={disabled || busy}
          onClick={() => (recording ? recorder.current?.stop() : start())}
          title={recording ? "Interromper gravação" : "Gravar resposta em áudio"}
        >
          {recording ? <Square /> : <Mic />}
          {recording ? "Terminei de contar" : "Gravar áudio"}
        </Button>
        {recording && (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={disabled || busy}
            onClick={() => {
              const current = recorder.current;
              if (!current) return;
              if (current.state === "recording") {
                current.pause();
                setPaused(true);
              } else if (current.state === "paused") {
                current.resume();
                setPaused(false);
              }
            }}
          >
            {paused ? <Play /> : <Pause />}
            {paused ? "Continuar gravação" : "Pausar gravação"}
          </Button>
        )}
        {audio && (
          <>
            <audio
              controls
              src={url || undefined}
              className="max-w-full"
              aria-label="Ouvir gravação antes de transcrever"
            />
            <Button type="button" className="h-12" disabled={busy} onClick={transcribe}>
              <FileAudio />
              {busy ? "Transcrevendo…" : "Transcrever para revisar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12"
              disabled={busy}
              onClick={() => setAudio(null)}
              title="Cancelar gravação"
            >
              <Trash2 />
              Cancelar
            </Button>
          </>
        )}
      </div>
      {audio && (
        <p className="mt-2 text-sm text-muted-foreground">
          Ao transcrever, seu áudio será enviado ao serviço de transcrição. Confira e corrija o
          texto antes de enviar a resposta.
        </p>
      )}
      {recording && (
        <p role="status" className="mt-2 text-destructive">
          {paused ? "Gravação pausada" : "Estou ouvindo"}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
