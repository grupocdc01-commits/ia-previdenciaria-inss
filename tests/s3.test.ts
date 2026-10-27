import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { S3Client } from '@aws-sdk/client-s3';
import { S3PrivateObjects } from '../src/infra/objects.ts';

// Emulador mínimo de contrato HTTP; não certifica IAM/políticas de um provedor real.
test('adaptador S3 envia comandos HTTP autenticados e assina upload temporário', async () => {
  const objectsByKey = new Map<string, Buffer>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    if (!request.headers.authorization && !url.searchParams.has('X-Amz-Signature')) { response.writeHead(403).end(); return; }
    if (request.method === 'HEAD') { response.writeHead(200).end(); return; }
    if (url.searchParams.has('versioning')) { response.writeHead(200, { 'content-type': 'application/xml' }).end('<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>'); return; }
    if (request.method === 'PUT') {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      objectsByKey.set(url.pathname, Buffer.concat(chunks)); response.writeHead(200, { ETag: '"test"' }).end(); return;
    }
    if (request.method === 'DELETE') { objectsByKey.delete(url.pathname); response.writeHead(204).end(); return; }
    const bytes = objectsByKey.get(url.pathname);
    if (!bytes) { response.writeHead(404, { 'content-type': 'application/xml' }).end('<Error><Code>NoSuchKey</Code></Error>'); return; }
    response.writeHead(200, { 'content-type': 'application/pdf', 'content-length': bytes.length }).end(bytes);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address() as { port: number }; const endpoint = `http://127.0.0.1:${address.port}`;
  const objects = new S3PrivateObjects({ bucket: 'synthetic-private', region: 'us-east-1', endpoint });
  objects.client.destroy();
  objects.client = new S3Client({ endpoint, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: 'synthetic-test', secretAccessKey: 'synthetic-test-only' }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  try {
    await objects.ready();
    await objects.put('reports/test.pdf', Buffer.from('%PDF-test'), 'application/pdf');
    assert.equal((await objects.get('reports/test.pdf')).toString(), '%PDF-test');
    assert.equal((await fetch(endpoint + '/synthetic-private/reports/test.pdf')).status, 403);
    const ticket = await objects.uploadTicket('quarantine/' + 'a'.repeat(64) + '/12345678-1234-1234-1234-123456789012', 'application/pdf', 9);
    assert.equal(ticket.expiresInSeconds, 300);
    assert.equal((await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: '%PDF-test' })).status, 200);
    await assert.rejects(() => objects.uploadTicket('reports/invalid.pdf', 'application/pdf', 9));
    await objects.delete('reports/test.pdf'); await assert.rejects(() => objects.get('reports/test.pdf'));
  } finally { objects.client.destroy(); server.close(); await once(server, 'close'); }
});
