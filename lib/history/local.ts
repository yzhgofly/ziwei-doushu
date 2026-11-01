/**
 * AI 解读历史 —— 本地存储层
 *
 * 全部存在用户自己的浏览器里（localStorage），**不会发到服务器**，
 * 这是「别人看不到」最硬的一道保证：数据压根没出过这台设备。
 *
 * 容量控制：
 *   - 最多 MAX_HISTORY_ENTRIES 条；
 *   - 总体积不超过 MAX_HISTORY_BYTES，超了从最旧的开始丢。
 *
 * 隐私模式 / 存储写满时静默失败，不影响主功能（解读照常能跑）。
 */

import {
  MAX_HISTORY_BYTES,
  MAX_HISTORY_ENTRIES,
  type HistoryEntry,
} from './types';

export const HISTORY_STORAGE_KEY = 'ziwei_ai_history_v1';

/** 历史变化事件：多个面板之间靠它同步刷新 */
export const HISTORY_CHANGED_EVENT = 'ziwei-history-changed';

function notifyChanged(): void {
  try {
    window?.dispatchEvent(new Event(HISTORY_CHANGED_EVENT));
  } catch { /* 非浏览器环境忽略 */ }
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null; // 某些隐私模式下访问 localStorage 会抛
  }
}

/** 读出全部历史（按时间倒序） */
export function readHistory(): HistoryEntry[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e && typeof e.id === 'string' && typeof e.answer === 'string');
  } catch {
    return [];
  }
}

/** 按上限裁剪后写回，返回真正存下来的列表 */
export function writeHistory(list: HistoryEntry[]): HistoryEntry[] {
  const s = storage();
  const sorted = [...list].sort((a, b) => b.savedAt - a.savedAt);

  // 先按条数裁剪，再按体积裁剪
  let trimmed = sorted.slice(0, MAX_HISTORY_ENTRIES);
  while (trimmed.length > 0 && JSON.stringify(trimmed).length > MAX_HISTORY_BYTES) {
    trimmed = trimmed.slice(0, trimmed.length - 1);
  }

  if (!s) return trimmed;
  try {
    s.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // 写满或被禁用了：本地历史存不下，但不影响解读
  }
  return trimmed;
}

/** 加一条（新的放最前） */
export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...readHistory().filter(e => e.id !== entry.id)];
  const stored = writeHistory(next);
  notifyChanged();
  return stored;
}

/** 删一条 */
export function removeHistoryEntry(id: string): HistoryEntry[] {
  const stored = writeHistory(readHistory().filter(e => e.id !== id));
  notifyChanged();
  return stored;
}

/** 全清 */
export function clearHistory(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(HISTORY_STORAGE_KEY);
  } catch { /* 忽略 */ }
  notifyChanged();
}

/** 导出成 JSON 字符串（用于备份到文件 / 换设备） */
export function exportHistory(): string {
  return JSON.stringify({ v: 1, exportedAt: Date.now(), entries: readHistory() }, null, 2);
}

export interface ImportResult {
  ok: boolean;
  count: number;
  error?: string;
}

/** 从导出的 JSON 导入（会合并去重） */
export function importHistory(json: string): ImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, count: 0, error: '不是合法的 JSON 文件' };
  }
  const incoming: HistoryEntry[] = Array.isArray(parsed) ? parsed : parsed?.entries;
  if (!Array.isArray(incoming)) {
    return { ok: false, count: 0, error: '文件里没有找到历史记录' };
  }
  const valid = incoming.filter(e => e && typeof e.id === 'string' && typeof e.answer === 'string');
  if (valid.length === 0) {
    return { ok: false, count: 0, error: '文件里没有有效的记录' };
  }
  const byId = new Map<string, HistoryEntry>();
  for (const e of [...readHistory(), ...valid]) byId.set(e.id, e);
  const merged = writeHistory([...byId.values()]);
  notifyChanged();
  return { ok: true, count: merged.length };
}
