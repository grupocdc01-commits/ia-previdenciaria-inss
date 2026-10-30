// Modelo do questionário (dados DECLARADOS pelo usuário — nunca tratados como comprovados).
// Vários campos ainda não existem no contrato atual do backend; ver INTEGRACAO.md.

export type ParaQuem = "para_mim" | "dependente" | "outra_pessoa";
export type Beneficio = "bpc_deficiencia" | "incapacidade" | "aposentadoria" | "outro" | "nao_sei";
export type Situacao =
  | "nao_solicitado"
  | "em_analise"
  | "exigencia"
  | "avaliacao_agendada"
  | "negado"
  | "aprovado"
  | "nao_sei";
export type DocInicial =
  "protocolo" | "decisao_inss" | "relatorios_medicos" | "relatorios_escolares" | "cnis" | "nenhum";
export type DocStatus = "disponivel" | "falta" | "nao_sei";

export interface Answers {
  paraQuem?: ParaQuem;
  beneficio?: Beneficio;
  situacao?: Situacao;
  idade?: string; // texto livre: "Não sei" permitido
  uf?: string;
  docs: DocInicial[];
  dataNegativa?: string;
  comunicacaoExigencia?: string;
  adaptadas: Record<string, string>;
  docStatus: Record<string, DocStatus>;
  trabalhos?: string[];
  contexto?: Record<
    string,
    { status: "confirmado" | "nao_sei" | "pulado"; values?: string[]; step: string }
  >;
}

export const TRABALHO_LABELS = {
  rural: "Na roça, pesca ou extrativismo",
  insalubre: "Com ruído, calor, produtos químicos ou risco",
  sem_registro: "Sem carteira assinada",
  registrado: "Com carteira assinada ou como autônomo pagando INSS",
  nunca: "Nunca trabalhei",
  nao_sei: "Não sei dizer",
} as const;

export const emptyAnswers = (): Answers => ({ docs: [], adaptadas: {}, docStatus: {} });

export const LABELS = {
  paraQuem: {
    para_mim: "Para mim",
    dependente: "Filho ou dependente",
    outra_pessoa: "Outra pessoa",
  },
  beneficio: {
    bpc_deficiencia: "BPC por deficiência",
    incapacidade: "Benefício por incapacidade",
    aposentadoria: "Aposentadoria",
    outro: "Outro",
    nao_sei: "Não sei",
  },
  // Ordem e textos só da pergunta do questionário: "Não sei" vem primeiro, como caminho recomendado.
  // Não altera LABELS.beneficio nem telas que exibem o benefício escolhido (conferência, exemplos).
  beneficioPergunta: {
    nao_sei: "Não sei — quero descobrir meus direitos",
    bpc_deficiencia: "BPC por deficiência",
    incapacidade: "Benefício por incapacidade",
    aposentadoria: "Aposentadoria",
    outro: "Outro",
  } as Record<Beneficio, string>,
  beneficioExplicacao: {
    nao_sei:
      "Não tem problema: contando sua história, a conversa descobre quais direitos você pode ter.",
    bpc_deficiencia:
      "Um salário mínimo por mês para quem tem 65 anos ou mais, ou deficiência, e renda baixa. Não precisa ter contribuído para o INSS.",
    incapacidade:
      "Dinheiro mensal para quem não consegue trabalhar por causa da saúde: pode ser por um tempo ou, em alguns casos, para sempre.",
    aposentadoria:
      "Para quem parou (ou vai parar) de trabalhar por idade ou depois de muitos anos contribuindo. Depende de conferir suas contribuições.",
    outro: "Outros casos, como pensão por morte, salário-maternidade ou auxílio por acidente.",
  } as Record<Beneficio, string>,
  beneficioDetalhe: {
    nao_sei:
      "Você não precisa saber o nome do benefício. Em seguida, a conversa vai perguntar sobre a sua vida e o seu trabalho, e a investigação aponta o que parece se encaixar — sempre sujeito a avaliação do INSS.",
    bpc_deficiencia:
      "É o BPC (também chamado de LOAS). Vale para idosos a partir de 65 anos e para pessoas com deficiência com impedimento de longo prazo, desde que a família atenda aos critérios legais de baixa renda. Não dá 13º salário e não vira pensão para a família quando a pessoa falece.",
    incapacidade:
      "Exige avaliação do INSS (perícia) e, em regra, um tempo mínimo de contribuição. Ter uma doença, sozinho, não garante o benefício: o que conta é o impedimento de trabalhar e os requisitos legais. Pode ser temporário (auxílio) ou permanente (aposentadoria por incapacidade), conforme a avaliação.",
    aposentadoria:
      "Existem várias regras: por idade, por tempo de contribuição e outras específicas. Para saber se tem direito, é preciso conferir quanto tempo você contribuiu e as demais condições de cada regra.",
    outro:
      "Se o seu caso é um desses — pensão por morte, salário-maternidade, auxílio por acidente de trabalho ou outro — escolha aqui e conte o que aconteceu nas próximas perguntas.",
  } as Record<Beneficio, string>,
  situacao: {
    nao_solicitado: "Ainda não solicitado",
    em_analise: "Em análise",
    exigencia: "Exigência de documentos",
    avaliacao_agendada: "Avaliação agendada",
    negado: "Negado",
    aprovado: "Aprovado",
    nao_sei: "Não sei",
  },
  docs: {
    protocolo: "Protocolo",
    decisao_inss: "Decisão do INSS",
    relatorios_medicos: "Relatórios médicos",
    relatorios_escolares: "Relatórios escolares ou terapêuticos",
    cnis: "CNIS",
    nenhum: "Nenhum",
  },
} as const;

export const UFS =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export interface AdaptedQuestion {
  id: string;
  bloco: string;
  pergunta: string;
  ajuda?: string;
}

const isCrianca = (a: Answers) => {
  const n = parseInt(a.idade ?? "", 10);
  return !Number.isNaN(n) && n < 18;
};

/** Mostra apenas perguntas pertinentes. Não calcula elegibilidade. */
export function adaptedQuestions(a: Answers): AdaptedQuestion[] {
  const q: AdaptedQuestion[] = [];
  if (a.beneficio === "bpc_deficiencia" || a.beneficio === "nao_sei") {
    if (isCrianca(a)) {
      const b = "Cotidiano da criança ou adolescente";
      q.push(
        {
          id: "c_dificuldades",
          bloco: b,
          pergunta: "Quais dificuldades a criança apresenta no dia a dia?",
          ajuda: "Pense na idade dela: alimentação, fala, escola, brincadeiras, convivência.",
        },
        { id: "c_desde", bloco: b, pergunta: "Desde quando essas dificuldades aparecem?" },
        {
          id: "c_apoio",
          bloco: b,
          pergunta: "Ela precisa de apoio ou supervisão maior que outras crianças da mesma idade?",
        },
        {
          id: "c_acompanhamento",
          bloco: b,
          pergunta: "Existe acompanhamento médico ou terapêutico?",
          ajuda: "Ex.: pediatra, neurologista, fonoaudiologia, terapia ocupacional.",
        },
        { id: "c_escola", bloco: b, pergunta: "Existem relatórios escolares sobre ela?" },
      );
    } else {
      q.push({
        id: "a_limitacoes",
        bloco: "Limitações",
        pergunta: "Quais limitações a pessoa enfrenta no dia a dia e para trabalhar?",
      });
    }
    q.push({
      id: "familia",
      bloco: "Família e renda",
      pergunta: "Quem mora na mesma casa? Conte quantas pessoas e se alguém tem renda.",
      ajuda: "Apenas descreva. O cálculo de renda não é feito aqui.",
    });
  }
  if (a.beneficio === "incapacidade") {
    q.push(
      {
        id: "i_limitacoes",
        bloco: "Limitações para trabalhar",
        pergunta: "O que você não consegue mais fazer no trabalho?",
      },
      {
        id: "i_acidente",
        bloco: "Acidente e sequelas",
        pergunta: "Houve algum acidente? Ficaram sequelas?",
      },
      {
        id: "i_historico",
        bloco: "Trabalho e contribuições",
        pergunta: "Qual foi seu último trabalho e quando parou?",
      },
    );
  }
  if (a.beneficio === "aposentadoria") {
    q.push({
      id: "ap_historico",
      bloco: "Trabalho e contribuições",
      pergunta:
        "Conte seu histórico de trabalho: empregos, períodos e se contribuiu por conta própria.",
    });
  }
  if (a.beneficio === "outro") {
    q.push({
      id: "o_descricao",
      bloco: "Seu caso",
      pergunta: "Descreva com suas palavras o que você precisa.",
    });
  }
  return q;
}

export interface DocItem {
  id: string;
  nome: string;
  porque: string;
  onde: string;
}

/** Lista personalizada de documentos, com explicação do porquê. */
export function documentList(a: Answers): DocItem[] {
  const list: DocItem[] = [];
  const add = (d: DocItem) => list.push(d);
  if (a.situacao === "negado") {
    add({
      id: "indeferimento",
      nome: "Decisão de indeferimento",
      porque: "Mostra o motivo oficial da negativa e a data, importante para prazos.",
      onde: "Meu INSS, em “Consultar pedidos”.",
    });
    add({
      id: "comunicacao",
      nome: "Comunicação recebida",
      porque: "Confirma quando você foi informado.",
      onde: "Meu INSS, carta ou e-mail recebido.",
    });
    add({
      id: "processo",
      nome: "Processo administrativo (se disponível)",
      porque: "Reúne perícias, avaliações e pareceres do pedido.",
      onde: "Meu INSS, opção de cópia do processo.",
    });
  }
  if (a.situacao === "exigencia") {
    add({
      id: "carta_exigencia",
      nome: "Carta de exigência",
      porque: "Diz exatamente quais documentos o INSS pediu e até quando.",
      onde: "Meu INSS, em “Consultar pedidos”.",
    });
  }
  if (
    a.situacao &&
    ["em_analise", "exigencia", "avaliacao_agendada", "negado"].includes(a.situacao)
  ) {
    add({
      id: "protocolo",
      nome: "Número do protocolo",
      porque: "Identifica o pedido e permite acompanhar.",
      onde: "Comprovante do pedido ou Meu INSS.",
    });
  }
  add({
    id: "medicos",
    nome: "Relatórios e laudos médicos",
    porque:
      "Descrevem a condição e seus impactos. Diagnóstico sozinho não garante nem impede o benefício.",
    onde: "Médicos que acompanham a pessoa, postos e hospitais.",
  });
  if (a.beneficio === "bpc_deficiencia" || a.beneficio === "nao_sei") {
    add({
      id: "terapeuticos",
      nome: "Relatórios terapêuticos e escolares",
      porque: "Mostram dificuldades no cotidiano, na escola e na convivência.",
      onde: "Escola, terapeutas, CAPS, APAE.",
    });
    add({
      id: "cadunico",
      nome: "CadÚnico atualizado",
      porque: "O BPC exige cadastro com composição familiar e renda.",
      onde: "CRAS do seu município.",
    });
  }
  if (a.beneficio === "incapacidade" || a.beneficio === "aposentadoria") {
    add({
      id: "cnis",
      nome: "Extrato CNIS",
      porque: "Mostra vínculos e contribuições registradas.",
      onde: "Meu INSS, em “Extrato de contribuição”.",
    });
  }
  return list;
}

export interface Missing {
  campo: string;
}

export function missingInfo(a: Answers): string[] {
  const m: string[] = [];
  if (!a.paraQuem) m.push("Para quem é o atendimento");
  if (!a.beneficio || a.beneficio === "nao_sei") m.push("Qual benefício");
  if (!a.situacao || a.situacao === "nao_sei") m.push("Situação do pedido");
  if (!a.idade || a.idade === "Não sei") m.push("Idade da pessoa");
  if (!a.uf) m.push("Estado onde mora");
  if (a.situacao === "negado" && !a.dataNegativa) m.push("Data em que recebeu a negativa");
  const docs = documentList(a);
  docs.forEach((d) => {
    if (a.docStatus[d.id] !== "disponivel") m.push(`Documento: ${d.nome}`);
  });
  return m;
}
