import PDFDocument from 'pdfkit';
import type { Analysis } from './domain.ts';

export async function reportPdf(analysis: Analysis): Promise<Buffer> {
  const pdf = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Análise previdenciária demonstrativa', Author: 'IA Previdenciária INSS' } });
  const parts: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', chunk => parts.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(parts)));
    pdf.on('error', reject);
  });
  pdf.fontSize(18).text('DEMONSTRAÇÃO — SEM VALOR JURÍDICO');
  pdf.moveDown().fontSize(11).text('Análise automatizada de apoio. Não é parecer emitido por advogado.');
  pdf.text('Caso: ' + analysis.case_id).text('Data: ' + analysis.created_at).text('Estado: ' + analysis.status);
  const sections: [string, string[]][] = [
    ['Resumo', [analysis.resumo]],
    ['Motivo informado da negativa', [analysis.motivo_indeferimento ?? 'Não informado']],
    ['Fatos documentais confirmados', analysis.fatos_comprovados.map(f => `${f.field}: ${f.value}\nDocumento ${f.evidence?.documentId}, página ${f.evidence?.page}: ${f.evidence?.quote}`)],
    ['Fatos declarados', analysis.fatos_declarados.map(f => f.field + ': ' + f.value)],
    ['Hipóteses de investigação', analysis.hipoteses_favoraveis.map(h => h.descricao + '\nProvas necessárias: ' + h.provas_necessarias.join('; '))],
    ['Limites e argumentos contrários', analysis.fundamentos_contrarios],
    ['Regras demonstrativas', analysis.regras_executadas.map(r => `${r.id}@${r.version}: ${r.result}. ${r.justification}`)],
    ['Fontes demonstrativas', analysis.fontes.map(f => `${f.sourceId}@${f.version}, ${f.anchor}\n${f.quote}\n${f.url}`)],
    ['Documentos faltantes', analysis.documentos_faltantes],
    ['Prazos a verificar', analysis.prazos_a_verificar],
    ['Próximos passos', analysis.proximos_passos],
    ['Limitações', analysis.limitacoes],
    ['Revisão profissional', ['Recomendada.']]
  ];
  for (const [title, lines] of sections) {
    pdf.moveDown().fontSize(13).text(title).fontSize(10);
    for (const line of lines.length ? lines : ['Nenhum registro.']) pdf.text(line).moveDown(0.3);
  }
  pdf.end();
  return result;
}
