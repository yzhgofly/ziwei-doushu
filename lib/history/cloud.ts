/**
 * AI 解读历史 —— 云备份客户端
 *
 * 备份走「同步码 + 客户端加密」：
 *   - 同步码只存在用户自己的浏览器里（localStorage），服务器不存明文；
 *   - 传到服务器的是加密后的密文，服务器只当二进制存起来；
 *   - 服务器用同步码的 PBKDF2 派生值算出「这条数据放在哪」，别人没有同步码就取不到。
 *
 * 也就是说：**即使有人拿到了服务器上的 KV 数据，没有同步码也解不开。**
 */

import {
  MAX_BACKUP_BYTES,
  MIN_SYNC_CODE_LENGTH,
  SYNC_CODE_HEADER,
  type HistoryEntry,
} from './types';
import { decryptJson, encryptJson, type EncryptedBlob } from './crypto';

const SYNC_CODE_STORAGE_KEY = 'ziwei_history_sync_code';

export interface BackupPayload {
  blob: EncryptedBlob;
  savedAt: number;
  count: number;
}

export interface CloudProbe {
  /** 当前部署是否启用了云备份 */
  supported: boolean;
  /** 服务器上是否已有备份 */
  hasBackup: boolean;
  /** 服务器端的提示（例如未启用） */
  message?: string;
}

function syncHeaders(code: string): Record<string, string> {
  return { 'Content-Type': 'application/json', [SYNC_CODE_HEADER]: code };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * 404 有两种完全不同的含义，必须区分：
 *   - 带 JSON body（`{error:'服务器上没有找到备份'}`）→ 接口在，只是这个同步码还没备份过；
 *   - HTML 页面 → 这个部署根本没有 /api/history（开源版或没部署 Functions）。
 * 分不清的话，用户会以为「云端有备份但丢了」。
 */
async function isJson404(res: Response): Promise<boolean> {
  try {
    const body = await res.clone().json();
    return !!body && typeof body === 'object' && typeof body.error === 'string';
  } catch {
    return false;
  }
}

/** 检查同步码是否够长（太短会被暴力猜） */
export function isSyncCodeAcceptable(code: string): boolean {
  return typeof code === 'string' && code.trim().length >= MIN_SYNC_CODE_LENGTH;
}

/** 本地记住同步码（免得每次都输） */
export function saveSyncCode(code: string): void {
  try {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, code);
  } catch { /* 忽略 */ }
}

/** 读取本机记住的同步码 */
export function loadSyncCode(): string {
  try {
    return localStorage.getItem(SYNC_CODE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** 忘掉本机的同步码（不影响服务器上的备份） */
export function forgetSyncCode(): void {
  try {
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
  } catch { /* 忽略 */ }
}

/** 查服务器：这个同步码有没有备份、这个部署支不支持云备份 */
export async function probeCloud(code: string): Promise<CloudProbe> {
  if (!isSyncCodeAcceptable(code)) {
    return { supported: false, hasBackup: false, message: '同步码太短，至少 12 个字符' };
  }
  try {
    const res = await fetch('/api/history', { headers: syncHeaders(code) });
    if (res.status === 404) {
      // 接口存在但没备份 → 支持云备份；接口根本不存在 → 不支持
      return (await isJson404(res))
        ? { supported: true, hasBackup: false }
        : { supported: false, hasBackup: false, message: '当前部署没有启用云备份接口' };
    }
    if (!res.ok) {
      const msg = await readError(res);
      return { supported: false, hasBackup: false, message: msg };
    }
    return { supported: true, hasBackup: true };
  } catch (e) {
    return {
      supported: false,
      hasBackup: false,
      message: e instanceof Error ? e.message : '连不上服务器',
    };
  }
}

/** 上传（加密后）备份 */
export async function putBackup(code: string, entries: HistoryEntry[]): Promise<void> {
  if (!isSyncCodeAcceptable(code)) throw new Error('同步码太短，至少 12 个字符');
  const blob = await encryptJson(code, { entries });
  const res = await fetch('/api/history', {
    method: 'PUT',
    headers: syncHeaders(code),
    body: JSON.stringify({ blob }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

/** 下载并解密备份；服务器上没有就返回 null */
export async function getBackup(code: string): Promise<HistoryEntry[] | null> {
  if (!isSyncCodeAcceptable(code)) throw new Error('同步码太短，至少 12 个字符');
  const res = await fetch('/api/history', { headers: syncHeaders(code) });
  if (res.status === 404) {
    if (await isJson404(res)) return null;      // 接口在，只是还没备份过
    throw new Error('当前部署没有启用云备份接口');
  }
  if (!res.ok) throw new Error(await readError(res));

  const payload = await res.json() as BackupPayload;
  if (!payload?.blob) throw new Error('服务器返回的数据不完整');
  const size = JSON.stringify(payload.blob).length;
  if (size > MAX_BACKUP_BYTES) throw new Error('备份数据过大');

  const plain = await decryptJson(code, payload.blob) as { entries?: HistoryEntry[] };
  if (!plain || !Array.isArray(plain.entries)) throw new Error('备份内容无法解析');
  return plain.entries;
}

/** 删除服务器上的备份 */
export async function deleteBackup(code: string): Promise<void> {
  if (!isSyncCodeAcceptable(code)) throw new Error('同步码太短，至少 12 个字符');
  const res = await fetch('/api/history', {
    method: 'DELETE',
    headers: syncHeaders(code),
  });
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}
