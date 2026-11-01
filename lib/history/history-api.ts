/**
 * GET / PUT / DELETE /api/history —— 云备份接口（Next 路由与 Pages Functions 共用）
 *
 * 接口只做一件事：**按同步码存取一段不透明的密文**。
 *
 *   - 同步码从 `X-History-Key` 请求头拿，缺失或太短一律拒绝；
 *   - 存放位置由同步码 PBKDF2 派生（服务器不存同步码明文，也不存明文内容）；
 *   - 存进去的是客户端已经加密好的密文，服务器没有任何解密手段。
 *
 * 所以：**没有同步码的人拿不到你的历史；就算拿到了服务器上的数据，也解不开。**
 */

import {
  MAX_BACKUP_BYTES,
  MIN_SYNC_CODE_LENGTH,
  SYNC_CODE_HEADER,
} from './types';
import { pbkdf2Sha256, SERVER_KEY_SALT, SERVER_PBKDF2_ITERATIONS } from './crypto';
import { getKvStore, type EnvBag } from './kv-store';

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** 限流：PBKDF2 本身有成本，再加一层简单的频率闸，防止有人拿它打 CPU */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function tooManyRequests(key: string, now: number): boolean {
  const list = (hits.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 512) {
    for (const [k, v] of hits) {
      if (v.length === 0 || now - v[0] > WINDOW_MS) hits.delete(k);
    }
  }
  return false;
}

function clientKey(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',').pop()?.trim() ||
    'local'
  );
}

/** 同步码 → KV 里的存放位置（服务器只认这个派生值） */
async function deriveStorageKey(code: string): Promise<string> {
  const salt = new TextEncoder().encode(SERVER_KEY_SALT);
  const bits = await pbkdf2Sha256(code, salt, SERVER_PBKDF2_ITERATIONS);
  return 'h:' + Array.from(bits).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handleHistory(
  request: Request,
  env: EnvBag = process.env,
): Promise<Response> {
  const now = Date.now();
  if (tooManyRequests(clientKey(request), now)) {
    return jsonError(429, '请求太频繁，请稍后再试');
  }

  const code = (request.headers.get(SYNC_CODE_HEADER) || '').trim();
  if (!code) {
    return jsonError(401, '缺少同步码');
  }
  if (code.length < MIN_SYNC_CODE_LENGTH) {
    return jsonError(400, `同步码至少 ${MIN_SYNC_CODE_LENGTH} 个字符`);
  }

  const kv = getKvStore(env);
  if (!kv) {
    return jsonError(503, '当前部署没有启用云备份（本地历史仍然可用）');
  }

  const storageKey = await deriveStorageKey(code);

  if (request.method === 'GET') {
    const raw = await kv.get(storageKey);
    if (!raw) return jsonError(404, '服务器上没有找到备份');
    try {
      return Response.json(JSON.parse(raw));
    } catch {
      return jsonError(500, '备份数据已损坏');
    }
  }

  if (request.method === 'PUT') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, '请求体不是合法 JSON');
    }
    const blob = body?.blob;
    if (!blob || typeof blob !== 'object' || typeof blob.data !== 'string') {
      return jsonError(400, '缺少备份内容');
    }
    const text = JSON.stringify(blob);
    if (text.length > MAX_BACKUP_BYTES) {
      return jsonError(413, '备份内容过大');
    }
    await kv.put(storageKey, JSON.stringify({
      blob,
      savedAt: Date.now(),
      count: typeof body?.count === 'number' ? body.count : undefined,
    }));
    return Response.json({ ok: true });
  }

  if (request.method === 'DELETE') {
    await kv.del(storageKey);
    return Response.json({ ok: true });
  }

  return jsonError(405, '不支持的请求方法');
}
