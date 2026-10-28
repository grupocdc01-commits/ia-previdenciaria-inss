/**
 * Pesquisa jurisprudencial comparativa — núcleo sem dependências externas.
 * Não acessa tribunais automaticamente: recebe decisões de adaptadores oficiais.
 * Nunca transforma resultado de busca em parecer jurídico.
 */
export type Outcome = "favoravel" | "desfavoravel" | "misto" | "indeterminado";
export type Verification = "nao_verificado" | "fonte_oficial_verificada" | "revisao_juridica_aprovada";
export type Authority = "STF" | "STJ" | "TNU" | "TRF" | "CRPS" | "INSS" | "OUTRO";
export interface Decision {
  id: string;
  authority: Authority;
  caseNumber: string;
  officialUrl: string;
  decisionDate: string;
  checkedAt: string;
  summary: string;
  legalIssue: string;
  outcome: Outcome;
  keywords: string[];
  benefit: string;
  denialReason: string;
  verification: Verification;
  bindingStatus: "vinculante" | "nao_vinculante" | "a_verificar";
  currentStatus: "vigente" | "suspenso" | "superado" | "a_verificar";
  sourceExcerpt?: string;
}
export interface CaseFacts {
  benefit: string;
  denialReason: string;
  description: string;
  requestDate?: string;
  keywords?: string[];
}
export interface SourceAdapter {
  id: string;
  search(query: CaseFacts): Promise<Decision[]>;
}
export interface Match {
  decision: Decision;
  score: number;
  reasons: string[];
  warnings: string[];
}
export interface ResearchResult {
  status: "comparacao_preliminar" | "fontes_insuficientes";
  favorable: Match[];
  unfavorable: Match[];
  mixed: Match[];
  unverified: Match[];
  limitations: string[];
  searchedSources: string[];
  sourceErrors: string[];
  requiresLegalReview: true;
}
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const tokens=(v:string)=>new Set(norm(v).split(/[^a-z0-9]+/).filter(w=>w.length>=4));
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
const officialDomains:Record<Authority,string[]>={
 STF:["stf.jus.br"],STJ:["stj.jus.br"],TNU:["cjf.jus.br","trf1.jus.br","trf2.jus.br","trf3.jus.br","trf4.jus.br","trf5.jus.br","trf6.jus.br"],
 TRF:["trf1.jus.br","trf2.jus.br","trf3.jus.br","trf4.jus.br","trf5.jus.br","trf6.jus.br"],
 CRPS:["gov.br"],INSS:["gov.br"],OUTRO:["jus.br","gov.br"]
};
export function isOfficialUrl(url:string,authority:Authority):boolean {
 try {
  const parsed=new URL(url);
  if(parsed.protocol!=="https:"||parsed.username||parsed.password)return false;
  const host=parsed.hostname.toLowerCase();
  return officialDomains[authority].some(domain=>host===domain||host.endsWith("."+domain));
 } catch {return false}
}
export function validateDecision(d:Decision):string[] {
 const issues:string[]=[];
 if(!d.id||!d.caseNumber||!d.legalIssue||!d.summary)issues.push("metadados incompletos");
 if(!validDate(d.decisionDate)||!validDate(d.checkedAt))issues.push("datas inválidas");
 if(!isOfficialUrl(d.officialUrl,d.authority))issues.push("URL não pertence a domínio oficial permitido");
 if(!["favoravel","desfavoravel","misto","indeterminado"].includes(d.outcome))issues.push("resultado inválido");
 return issues;
}
export function compareDecision(facts:CaseFacts,decision:Decision):Match {
 const reasons:string[]=[],warnings:string[]=[];
 const sameBenefit=norm(facts.benefit)===norm(decision.benefit);
 const sameReason=norm(facts.denialReason)===norm(decision.denialReason);
 let score=0;
 if(sameBenefit){score+=4;reasons.push("mesmo tipo de benefício")}
 else warnings.push("tipo de benefício diferente");
 if(sameReason){score+=4;reasons.push("mesmo motivo de indeferimento")}
 else warnings.push("motivo de indeferimento diferente");
 const terms=tokens([facts.description,...(facts.keywords??[])].join(" "));
 const shared=decision.keywords.filter(k=>terms.has(norm(k))).length;
 score+=Math.min(3,shared);
 if(shared)reasons.push(shared+" termo(s) coincidente(s)");
 if(facts.requestDate&&validDate(facts.requestDate)&&decision.decisionDate<facts.requestDate)warnings.push("decisão anterior à DER; conferir vigência e evolução jurisprudencial");
 if(decision.currentStatus!=="vigente")warnings.push("situação do precedente não confirmada como vigente");
 if(decision.bindingStatus!=="vinculante")warnings.push("não presumir força vinculante");
 if(decision.verification!=="revisao_juridica_aprovada")warnings.push("decisão ainda não aprovada por revisão jurídica");
 return {decision,score,reasons,warnings};
}
export function researchFromDecisions(facts:CaseFacts,decisions:Decision[],searchedSources:string[]=[],sourceErrors:string[]=[]):ResearchResult {
 const seen=new Set<string>();
 const buckets:{favorable:Match[];unfavorable:Match[];mixed:Match[];unverified:Match[]}={favorable:[],unfavorable:[],mixed:[],unverified:[]};
 for(const d of decisions){
  const key=d.authority+":"+d.caseNumber+":"+d.decisionDate;
  if(seen.has(key))continue;seen.add(key);
  const errors=validateDecision(d);
  const match=compareDecision(facts,d);
  if(errors.length||d.verification==="nao_verificado"||d.currentStatus==="superado"||d.currentStatus==="suspenso"){
   match.warnings.push(...errors);buckets.unverified.push(match);continue;
  }
  if(match.score<4){buckets.unverified.push({...match,warnings:[...match.warnings,"baixa correspondência factual"]});continue}
  if(d.outcome==="favoravel")buckets.favorable.push(match);
  else if(d.outcome==="desfavoravel")buckets.unfavorable.push(match);
  else buckets.mixed.push(match);
 }
 for(const key of Object.keys(buckets) as (keyof typeof buckets)[])buckets[key].sort((a,b)=>b.score-a.score);
 const limitations=["Resultados não equivalem a probabilidade de êxito nem conclusão jurídica.","Comparação textual não substitui exame dos fatos, da prova, da competência e da vigência.","Ausência de decisão contrária na amostra não prova inexistência de precedentes desfavoráveis."];
 if(sourceErrors.length)limitations.push("Uma ou mais fontes não puderam ser consultadas.");
 if(!buckets.favorable.length||!buckets.unfavorable.length)limitations.push("Amostra não contém ambos os lados; ampliar busca antes de qualquer avaliação.");
 return {status:buckets.favorable.length&&buckets.unfavorable.length?"comparacao_preliminar":"fontes_insuficientes",...buckets,limitations,searchedSources,sourceErrors,requiresLegalReview:true};
}
export async function researchWithAdapters(facts:CaseFacts,adapters:SourceAdapter[]):Promise<ResearchResult>{
 const settled=await Promise.allSettled(adapters.map(a=>a.search(facts)));
 const decisions:Decision[]=[],errors:string[]=[];
 settled.forEach((r,i)=>{if(r.status==="fulfilled")decisions.push(...r.value);else errors.push(adapters[i].id+": consulta indisponível")});
 return researchFromDecisions(facts,decisions,adapters.map(a=>a.id),errors);
}
