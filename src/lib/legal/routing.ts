import { isSourceTrusted, sourceById } from "./sources";

// Classificação de encaminhamento. Nunca promete concessão, nunca declara ação
// obrigatória/procedente, nunca exige advogado em todos os casos.
export type RoutingFacts = {
  referenceDate: string;
  everRequested?: boolean;
  denied?: boolean;
  decisionDate?: string;          // data da ciência da decisão do INSS (ISO)
  pendingRequirement?: boolean;   // exigência em aberto no Meu INSS
  cnisDivergence?: boolean;       // vínculos/salários faltando ou errados no CNIS
  benefitGranted?: boolean;       // já recebe benefício (possível revisão)
  grantDate?: string;             // data do primeiro pagamento, para revisão
  appealFiled?: boolean;          // recurso ao CRPS já apresentado
  appealDecided?: boolean;
  factualDispute?: "pericia" | "renda" | "tempo_rural" | "outro"; // controvérsia de fato relatada
  needsWitnessOrExpertProof?: boolean;
};

export type Track = "administrativa" | "potencial_judicial" | "investigacao_complementar";
export type Recommendation = {
  track: Track; action: string; why: string;
  basis: { sourceId: string; reference: string; title: string; url: string; trusted: boolean }[];
  factsUsed: (keyof RoutingFacts)[]; gaps: string[]; humanReview: boolean;
};
export type RoutingResult = { status: "preliminar" | "definitiva"; recommendations: Recommendation[]; inss: Recommendation[]; legalHelp: Recommendation[]; documents: string[]; nextSteps: string[]; notices: string[] };

const b = (sourceId: string, reference: string) => { const s = sourceById(sourceId); return { sourceId, reference, title: s.title, url: s.url, trusted: isSourceTrusted(s) }; };
const daysBetween = (a: string, c: string) => Math.floor((Date.parse(c) - Date.parse(a)) / 86_400_000);

export function classifyRouting(f: RoutingFacts): RoutingResult {
  const r: Recommendation[] = [];
  const add = (x: Recommendation) => r.push(x);

  if (f.everRequested === undefined) add({ track: "investigacao_complementar", action: "Confirmar se já houve pedido ao INSS", why: "Sem saber se houve requerimento não é possível indicar a via adequada.", basis: [], factsUsed: [], gaps: ["Houve pedido ao INSS?"], humanReview: false });

  if (f.everRequested === false) {
    add({ track: "administrativa", action: "Fazer o requerimento inicial pelo Meu INSS (ou telefone 135)", why: "Não há pedido registrado; a concessão de benefício começa por requerimento ao INSS.", basis: [b("lei-8213", "art. 49 e 54 (data de entrada do requerimento)"), b("decreto-3048", "regras de requerimento")], factsUsed: ["everRequested"], gaps: [], humanReview: false });
    add({ track: "potencial_judicial", action: "Via judicial em regra não indicada antes do pedido", why: "O STF fixou a necessidade de prévio requerimento administrativo para demonstrar interesse de agir, com exceções; isso não exige esgotar recursos administrativos. Requer conferência jurídica.", basis: [b("stf-tema-350", "Tema 350")], factsUsed: ["everRequested"], gaps: [], humanReview: true });
  }

  if (f.pendingRequirement) add({ track: "administrativa", action: "Cumprir a exigência no Meu INSS dentro do prazo indicado na notificação", why: "Exigência em aberto pode levar ao indeferimento por falta de documentos.", basis: [b("decreto-3048", "regras de exigência no processo administrativo"), b("in-128", "processo administrativo previdenciário")], factsUsed: ["pendingRequirement"], gaps: ["Prazo exato consta na notificação do INSS"], humanReview: false });

  if (f.cnisDivergence) add({ track: "administrativa", action: "Pedir acerto de vínculos/remunerações do CNIS no Meu INSS", why: "Divergências no CNIS podem ser corrigidas com documentos que comprovem o vínculo.", basis: [b("lei-8213", "art. 29-A"), b("decreto-3048", "art. 19 e seguintes")], factsUsed: ["cnisDivergence"], gaps: ["Documentos do vínculo (CTPS, holerites, contrato)"], humanReview: false });

  if (f.denied) {
    if (!f.decisionDate) add({ track: "investigacao_complementar", action: "Informar a data em que tomou ciência do indeferimento", why: "O prazo de recurso conta da ciência da decisão.", basis: [b("decreto-3048", "art. 305")], factsUsed: ["denied"], gaps: ["Data da ciência da decisão"], humanReview: false });
    else {
      const d = daysBetween(f.decisionDate, f.referenceDate);
      add(d <= 30 && !f.appealFiled
        ? { track: "administrativa", action: "Avaliar recurso ao CRPS pelo Meu INSS", why: `Ciência há ${d} dias; o prazo de recurso indicado no regulamento é de 30 dias. Confira a data na carta.`, basis: [b("decreto-3048", "art. 303 e 305")], factsUsed: ["denied", "decisionDate"], gaps: [], humanReview: false }
        : { track: "administrativa", action: "Avaliar novo requerimento com documentos complementares", why: f.appealFiled ? "Recurso já apresentado; acompanhe o andamento no Meu INSS." : `Ciência há ${d} dias; o prazo de recurso pode ter passado — um novo pedido pode ser feito.`, basis: [b("decreto-3048", "art. 305")], factsUsed: ["denied", "decisionDate", "appealFiled"], gaps: [], humanReview: true });
    }
    // Indeferimento sozinho não gera sugestão judicial: exige controvérsia de fato.
    if (f.factualDispute) add({ track: "potencial_judicial", action: "Pode ser útil buscar orientação jurídica (advogado ou Defensoria Pública da União)", why: `Há controvérsia relatada (${f.factualDispute}) que pode exigir ${f.needsWitnessOrExpertProof ? "prova testemunhal ou pericial" : "análise de provas"}. Não esgotar recurso administrativo não impede, por si só, a via judicial; nos Juizados Especiais Federais a parte pode atuar sem advogado em primeiro grau, conforme limites de valor e competência. Prazos de prescrição e decadência devem ser conferidos. Isto não indica que uma ação seja obrigatória ou terá sucesso.`, basis: [b("stf-tema-350", "Tema 350"), b("lei-10259", "art. 3º e 10"), b("lei-8213", "art. 103")], factsUsed: ["denied", "factualDispute", "needsWitnessOrExpertProof"], gaps: ["Valor da causa", "Fase do processo administrativo", "Competência territorial"], humanReview: true });
  }

  if (f.benefitGranted) {
    const gaps = f.grantDate ? [] : ["Data do primeiro pagamento"];
    const late = f.grantDate ? daysBetween(f.grantDate, f.referenceDate) > 3650 : undefined;
    add({ track: f.grantDate ? "administrativa" : "investigacao_complementar", action: late ? "Revisão possivelmente atingida pela decadência — exige análise jurídica" : "Avaliar pedido de revisão no Meu INSS", why: "Revisão do ato de concessão sujeita ao prazo decadencial de 10 anos; parcelas sujeitas à prescrição de 5 anos (há exceções).", basis: [b("lei-8213", "art. 103, caput e parágrafo único")], factsUsed: ["benefitGranted", "grantDate"], gaps, humanReview: true });
  }

  if (!r.some(x => x.track !== "investigacao_complementar") && f.everRequested !== false) add({ track: "investigacao_complementar", action: "Continuar a investigação do caso", why: "Ainda não há fatos suficientes para indicar uma via.", basis: [], factsUsed: [], gaps: ["Situação do pedido", "Documentos do INSS"], humanReview: false });

  const allTrusted = r.every(x => x.basis.length > 0 && x.basis.every(s => s.trusted));
  const notices = ["Orientação preliminar: as fontes ainda não foram conferidas e revisadas por profissional jurídico.", "Não há consulta automática a sistemas do INSS/Dataprev; usamos só o que você informou ou enviou.", "Nenhuma recomendação garante concessão do benefício."];
  return {
    status: allTrusted ? "definitiva" : "preliminar",
    recommendations: r,
    inss: r.filter(x => x.track === "administrativa"),
    legalHelp: r.filter(x => x.track === "potencial_judicial"),
    documents: ["Documento de identidade e CPF", "Carta de indeferimento ou exigência (se houver)", "Extrato CNIS (pode ser baixado no Meu INSS)", "CTPS e comprovantes de contribuição", ...(f.factualDispute === "pericia" ? ["Laudos, exames e atestados médicos"] : []), ...(f.factualDispute === "renda" ? ["Comprovantes de renda e CadÚnico atualizado"] : [])],
    nextSteps: [...new Set(r.map(x => x.action))],
    notices: allTrusted ? notices.slice(1) : notices,
  };
}