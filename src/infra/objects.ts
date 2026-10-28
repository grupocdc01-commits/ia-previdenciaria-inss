import { mkdir, readFile, writeFile, rename, unlink, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, GetBucketVersioningCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DomainError } from '../domain.ts';

export interface PrivateObjects {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  ready?(): Promise<void>;
}
function validKey(key: string) {
  if (/^quarantine\/[a-f0-9]{64}\/[a-f0-9-]{36}$/.test(key)) return key;
  if (!/^[a-zA-Z0-9/_-]+\.pdf$/.test(key) || key.includes('..') || key.startsWith('/')) throw new DomainError('Chave de objeto inválida.');
  return key;
}
export class LocalPrivateObjects implements PrivateObjects {
  root: string;
  constructor(root: string) { this.root = resolve(root); }
  async ready() { await mkdir(this.root, { recursive: true, mode: 0o700 }); }
  private async path(key: string) {
    const path = resolve(this.root, validKey(key));
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const base = await realpath(this.root); const parent = await realpath(dirname(path));
    const rel = relative(base, parent);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new DomainError('Objeto fora do armazenamento.');
    return path;
  }
  async put(key: string, bytes: Buffer, _type: string) {
    const path = await this.path(key); const temporary = path + '.' + randomUUID();
    await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  }
  async get(key: string) {
    const path = await this.path(key);
    try {
      const target = await realpath(path); const rel = relative(await realpath(this.root), target);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new DomainError('Objeto fora do armazenamento.');
      return await readFile(target);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new DomainError('Relatório não encontrado.', 404); throw error; }
  }
  async delete(key: string) { try { await unlink(await this.path(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
}
export class S3PrivateObjects implements PrivateObjects {
  client: S3Client; bucket: string;
  constructor(options: { bucket: string; region: string; endpoint?: string }) {
    this.bucket = options.bucket;
    this.client = new S3Client({ region: options.region, ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}) });
  }
  async ready() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    const versioning = await this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket }));
    if (versioning.Status) throw new Error('O bucket temporário deve ser dedicado e nunca ter versionamento ativado.');
  }
  async put(key: string, bytes: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: validKey(key), Body: bytes, ContentType: contentType }));
  }
  async get(key: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: validKey(key) }));
    if (!result.Body) throw new DomainError('Objeto não encontrado.', 404);
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async delete(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: validKey(key) })); }
  // Destino de quarentena, nunca chave fornecida pelo cliente ou bucket público.
  async uploadTicket(key: string, contentType: string, bytes: number) {
    if (!/^quarantine\/[a-f0-9]{64}\/[a-f0-9-]{36}$/.test(key) || !['application/pdf', 'image/jpeg', 'image/png'].includes(contentType) || bytes < 1 || bytes > 10_000_000) throw new DomainError('Upload inválido.');
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: bytes }), { expiresIn: 300 });
    return { url, method: 'PUT', expiresInSeconds: 300, contentType, bytes, status: 'quarantine', notice: 'O envio não libera leitura ou análise; validação e antivírus ainda são necessários.' };
  }
}
