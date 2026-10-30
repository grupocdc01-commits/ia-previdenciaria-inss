import type { Analysis } from "./api/types";
import { emptyAnswers, type Answers } from "./case-model";

// TODOS OS DADOS ABAIXO SÃO FICTÍCIOS. Não representam pessoas nem resultados reais.

export interface DemoCase {
  id: string;
  titulo: string;
  descricao: string;
  answers: Answers;
  analysis: Analysis;
}

const base = (o: Partial<Analysis>): Analysis => ({
  caseId: "",
  resumo: "",
  urgencias: [],
  linhaDoTempo: [],
  documentosAnalisados: [],
  fatosDeclarados: [],
  fatosComprovados: [],
  motivoInss: null,
  explicacao: "",
  inconsistencias: [],
  fundamentosFavoraveis: [],
  fundamentosContrarios: [],
  limitacoes: [
    "Exemplo fictício gerado para demonstração. Não é resultado real.",
    "Nenhum documento real foi lido. OCR e análise automática ainda não estão integrados.",
    "Não substitui advogado, médico ou perito.",
  ],
  proximosPassos: [],
  fontes: ["Lei 8.742/1993 (LOAS) — referência ilustrativa no modo demonstrativo"],
  dataAnalise: "Exemplo fictício",
  preparoAdvogado: { disponiveis: [], faltantes: [], perguntas: [] },
  pdf: { disponivel: false, expiraEm: null },
  ...o,
});

export const DEMO_CASES: DemoCase[] = [
  {
    id: "demo-crianca",
    titulo: "BPC de criança com informações incompletas",
    descricao: "Mãe fictícia busca orientação para o filho de 7 anos. Pedido ainda não feito.",
    answers: {
      ...emptyAnswers(),
      paraQuem: "dependente",
      beneficio: "bpc_deficiencia",
      situacao: "nao_solicitado",
      idade: "7",
      uf: "MG",
      docs: ["relatorios_medicos"],
      adaptadas: {
        c_dificuldades: "Dificuldade na fala e para ficar em sala de aula.",
        c_desde: "Não sei",
        c_apoio: "Sim, precisa de ajuda para se vestir.",
      },
      docStatus: { medicos: "disponivel", terapeuticos: "falta", cadunico: "nao_sei" },
    },
    analysis: base({
      caseId: "demo-crianca",
      resumo:
        "Pedido de BPC ainda não feito para criança de 7 anos (dados fictícios). Faltam informações e documentos.",
      linhaDoTempo: [
        { data: "Não informada", fato: "Início das dificuldades", origem: "declarado" },
      ],
      documentosAnalisados: ["Relatório médico fictício (texto sintético)"],
      fatosDeclarados: ["Dificuldade na fala", "Precisa de ajuda para se vestir", "Mora em MG"],
      fatosComprovados: [],
      explicacao:
        "Com as informações atuais, não é possível orientar sobre o pedido com segurança. O BPC avalia como a condição afeta a vida da criança, além da renda da família.",
      inconsistencias: [
        "Início das dificuldades não informado.",
        "Composição familiar não informada.",
      ],
      proximosPassos: [
        "Pedir relatório escolar à escola.",
        "Verificar ou atualizar o CadÚnico no CRAS.",
        "Responder as perguntas pendentes.",
      ],
      preparoAdvogado: {
        disponiveis: ["Relatório médico"],
        faltantes: [
          {
            nome: "Relatório escolar",
            porque: "Mostra dificuldades na escola.",
            onde: "Escola da criança",
          },
          { nome: "CadÚnico", porque: "Exigido para o BPC.", onde: "CRAS" },
        ],
        perguntas: [
          "Quais relatórios são mais importantes no meu caso?",
          "Preciso atualizar o CadÚnico antes de pedir?",
        ],
      },
    }),
  },
  {
    id: "demo-negado",
    titulo: "BPC negado, aguardando a decisão do INSS",
    descricao: "Pessoa fictícia teve BPC negado e ainda não tem a decisão escrita.",
    answers: {
      ...emptyAnswers(),
      paraQuem: "para_mim",
      beneficio: "bpc_deficiencia",
      situacao: "negado",
      idade: "42",
      uf: "BA",
      docs: ["protocolo"],
      dataNegativa: "",
      docStatus: { protocolo: "disponivel", indeferimento: "falta", comunicacao: "nao_sei" },
    },
    analysis: base({
      caseId: "demo-negado",
      resumo:
        "BPC informado como negado (dados fictícios). A decisão escrita do INSS ainda não foi fornecida.",
      urgencias: [
        "Data da negativa não informada. Prazos dependem dela — obtenha a decisão o quanto antes.",
      ],
      linhaDoTempo: [
        { data: "Data fictícia", fato: "Pedido protocolado", origem: "documentado" },
        { data: "Não informada", fato: "Negativa comunicada", origem: "declarado" },
      ],
      documentosAnalisados: ["Protocolo fictício (texto sintético)"],
      fatosDeclarados: ["O pedido foi negado"],
      fatosComprovados: ["Existe um pedido protocolado"],
      motivoInss: null,
      explicacao:
        "O motivo da negativa não está demonstrado. Faltam documentos para saber por que o pedido foi negado. Não vamos supor uma causa.",
      proximosPassos: [
        "Baixar a decisão de indeferimento no Meu INSS.",
        "Pedir cópia do processo administrativo.",
        "Anotar a data em que recebeu a comunicação.",
      ],
      preparoAdvogado: {
        disponiveis: ["Protocolo"],
        faltantes: [
          {
            nome: "Decisão de indeferimento",
            porque: "Mostra o motivo e a data.",
            onde: "Meu INSS",
          },
          {
            nome: "Processo administrativo",
            porque: "Reúne perícias e avaliações.",
            onde: "Meu INSS",
          },
        ],
        perguntas: [
          "Qual é o prazo para recorrer no meu caso?",
          "Vale mais recorrer ou fazer novo pedido?",
        ],
      },
    }),
  },
  {
    id: "demo-exigencia",
    titulo: "Pedido em análise, com exigência documental",
    descricao: "Pedido fictício de benefício por incapacidade com carta de exigência.",
    answers: {
      ...emptyAnswers(),
      paraQuem: "para_mim",
      beneficio: "incapacidade",
      situacao: "exigencia",
      idade: "51",
      uf: "SP",
      docs: ["protocolo", "relatorios_medicos", "cnis"],
      comunicacaoExigencia: "Carta fictícia pedindo laudo atualizado.",
      adaptadas: {
        i_limitacoes: "Não consigo ficar em pé por muito tempo.",
        i_acidente: "Não houve acidente.",
      },
      docStatus: {
        carta_exigencia: "disponivel",
        protocolo: "disponivel",
        medicos: "falta",
        cnis: "disponivel",
      },
    },
    analysis: base({
      caseId: "demo-exigencia",
      resumo: "Pedido fictício em análise com exigência de laudo médico atualizado.",
      urgencias: [
        "Exigência com prazo informado na carta (fictícia). Verifique a data na carta real.",
      ],
      linhaDoTempo: [
        { data: "Data fictícia", fato: "Pedido protocolado", origem: "documentado" },
        { data: "Data fictícia", fato: "Carta de exigência emitida", origem: "documentado" },
      ],
      documentosAnalisados: ["Carta de exigência fictícia", "CNIS fictício"],
      fatosDeclarados: ["Dificuldade para ficar em pé", "Sem acidente"],
      fatosComprovados: ["INSS solicitou laudo médico atualizado (exemplo)"],
      motivoInss: "Exigência: apresentar laudo médico atualizado (texto fictício).",
      explicacao:
        "O INSS pediu um documento antes de decidir. Responder dentro do prazo evita que o pedido seja encerrado.",
      fundamentosFavoraveis: ["CNIS mostra vínculos registrados (exemplo)."],
      fundamentosContrarios: ["Laudo médico atual ainda não apresentado."],
      proximosPassos: [
        "Agendar consulta para laudo atualizado.",
        "Enviar o documento pelo Meu INSS.",
      ],
      preparoAdvogado: {
        disponiveis: ["Protocolo", "Carta de exigência", "CNIS"],
        faltantes: [
          {
            nome: "Laudo médico atualizado",
            porque: "Foi pedido pelo INSS.",
            onde: "Médico que acompanha você",
          },
        ],
        perguntas: ["O que fazer se não conseguir o laudo a tempo?"],
      },
      pdf: { disponivel: true, expiraEm: "24 horas após a geração (exemplo)" },
    }),
  },
];

export const findDemo = (id: string) => DEMO_CASES.find((c) => c.id === id);
