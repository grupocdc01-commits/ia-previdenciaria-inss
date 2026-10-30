import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { documentKinds } from "@/lib/document-policy";

export function PrevidenciaryAssistant() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [topic, setTopic] = useState<keyof typeof documentKinds>("cnis");
  const status = useQuery({ queryKey: ["private-processing-status"], queryFn: () => cloudAdapter.processingStatus(), enabled: open && signedIn });
  const show = async () => { setSignedIn(Boolean(await cloudAdapter.user())); setOpen(true); };
  const read = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(documentKinds[topic]); speech.lang = "pt-BR"; window.speechSynthesis.speak(speech);
  };
  return <>
    <Button className="fixed bottom-4 right-4 z-40 shadow-md" aria-label="Abrir assistente previdenciária" onClick={show}><MessageCircle /><span className="hidden sm:inline">Assistente</span></Button>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value && "speechSynthesis" in window) window.speechSynthesis.cancel(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto w-[calc(100%-2rem)]">
        <DialogTitle>Assistente · IA Previdenciária INSS</DialogTitle>
        <DialogDescription>{status.data?.name ? `${status.data.name}, ` : ""}vamos organizar seu atendimento, sem pressa. Documentos não são obrigatórios.</DialogDescription>
        <label className="grid gap-2">Sobre qual documento?<select className="border border-input rounded-md bg-background px-3 py-2" value={topic} onChange={e => setTopic(e.target.value as keyof typeof documentKinds)}>{Object.keys(documentKinds).map(key => <option key={key} value={key}>{key === "cnis" ? "CNIS e vínculos" : key === "ctps" ? "CTPS" : key === "bpc" ? "BPC/LOAS" : key === "incapacidade" ? "Incapacidade" : key === "aposentadoria" ? "Aposentadoria" : "Indeferimento"}</option>)}</select></label>
        <p>{documentKinds[topic]}</p><Button variant="outline" onClick={read}><Volume2 />Ouvir orientação</Button>
        <p className="text-sm text-muted-foreground">A voz usa o recurso do seu navegador. Nenhum documento é enviado por esta orientação.</p>
        <p role="status" className="text-sm">{signedIn ? status.data?.geminiConfigured ? "Gemini: chave configurada; modelo precisa ser validado." : "Gemini ainda não configurado. Orientação documental disponível sem IA." : "Entre para conversar e salvar seu atendimento privado."}</p>
        <Button asChild><Link to={signedIn ? "/investigacoes" : "/auth"}>{signedIn ? "Retomar atendimento" : "Entrar na minha conta"}</Link></Button>
        {signedIn && <Button asChild variant="outline"><Link to="/privacidade">Privacidade, uso e custos</Link></Button>}
      </DialogContent>
    </Dialog>
  </>;
}