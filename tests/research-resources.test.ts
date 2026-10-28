import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { researchResources } from '../src/research-resources.ts';
import { ufSchema } from '../src/domain.ts';
import { buildApp } from '../src/app.ts';

const resources: unknown = JSON.parse(readFileSync('data/library/research-resources.json', 'utf8'));
test('todas as UFs têm exatamente um TRF prioritário sem ativar coleta ou autoridade', () => {
  for (const uf of ufSchema.options) {
    const result = researchResources(resources, uf);
    assert.equal(result.filter(r => r.regionalPriority).length, 1);
    assert.ok(result.every(r => !r.automaticCollectionEnabled && !r.usableAsLegalAuthority));
  }
  assert.equal(researchResources(resources, 'MG').find(r => r.regionalPriority)?.id, 'trf6');
});
test('Jusbrasil exige confirmação oficial; consulta INSS não alimenta corpus compartilhado', () => {
  const result = researchResources(resources);
  assert.equal(result.find(r => r.id === 'jusbrasil')?.requiresOfficialConfirmation, true);
  const inss = result.find(r => r.id === 'inss-consulta-processos')!;
  assert.equal(inss.kind, 'private_case_lookup');
  assert.equal(inss.sharedCaseDataAllowed, false);
  assert.throws(() => researchResources(resources, 'XX'));
});
test('diretório de fontes na API exige autenticação e aceita filtro de prioridade regional', async () => {
  const token = 'token-diretorio-fontes-teste-123456';
  const app = buildApp({ tokens: { [token]: 'user' }, library: { catalog: [], archiveRoot: 'data/legal-sources', curators: [], researchResources: resources } });
  try {
    assert.equal((await app.inject('/library/resources')).statusCode, 401);
    const result = await app.inject({ url: '/library/resources?uf=SP', headers: { authorization: 'Bearer ' + token } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().find((r: { regionalPriority: boolean }) => r.regionalPriority).id, 'trf3');
  } finally { await app.close(); }
});
