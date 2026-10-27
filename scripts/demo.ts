import { buildApp } from '../src/app.ts';

const token = 'token-apenas-para-demo-sintetica';
const app = buildApp({ tokens: { [token]: 'demo' } });
const headers = { authorization: 'Bearer ' + token };
try {
  const created = await app.inject({ method: 'POST', url: '/cases', headers, payload: { benefit: 'bpc', subtype: 'pessoa_com_deficiencia', uf: 'MG', der: '2025-01-10', noticeDate: null, denialReason: 'Renda familiar — caso fictício', syntheticData: true, consent: true } });
  if (created.statusCode !== 201) throw new Error(created.body);
  const id = created.json().case.id as string;
  const document = await app.inject({ method: 'POST', url: `/cases/${id}/documents`, headers, payload: { name: 'carta-ficticia.txt', mimeType: 'text/plain', kind: 'carta_indeferimento', text: 'DOCUMENTO FICTÍCIO\nMotivo do indeferimento: renda familiar informada incompleta.' } });
  if (document.statusCode !== 201) throw new Error(document.body);
  const response = await app.inject({ method: 'POST', url: `/cases/${id}/analyze`, headers, payload: { mode: 'demonstracao' } });
  if (response.statusCode !== 200) throw new Error(response.body);
  console.log(JSON.stringify(response.json(), null, 2));
} finally { await app.close(); }
