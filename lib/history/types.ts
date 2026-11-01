/**
 * AI 解读历史 —— 数据模型
 *
 * 一条记录 = 一次完整的「提问 + 回答」，外加当时的命盘（用来恢复现场继续追问）。
 *
 * 隐私约定：
 *   - 记录默认只存在用户自己的浏览器里（localStorage），**不会发到服务器**；
 *   - 开启「云备份」后，发上去的是**用同步码加密后的密文**，服务器只存密文；
 *   - 同步码本身只以哈希形式出现在服务器上（PBKDF2 派生），不存明文。
 */

import type { ZiweiChart } from '@/lib/ziwei/types';

export type HistoryKind = 'interpret' | 'heming';

export interface HistoryEntry {
  /** 唯一 id */
  id: string;
  /** 解读 / 合盘 */
  kind: HistoryKind;
  /** 保存时间（毫秒时间戳） */
  savedAt: number;
  /** 展示标题，例如「1990年1月5日 · 男」 */
  title: string;
  /** 展示用的提问标签，例如「命格」「感情」「我的性格特点是什么？」 */
  question: string;
  /** AI 回答全文（Markdown） */
  answer: string;
  /** 解读用的命盘 / 合盘的甲方盘 */
  chart?: ZiweiChart;
  /** 合盘时的乙方盘 */
  chartB?: ZiweiChart;
}

/** 最多存多少条 */
export const MAX_HISTORY_ENTRIES = 30;

/** 本地存储的体积上限（超出就从最旧的一条开始丢） */
export const MAX_HISTORY_BYTES = 2 * 1024 * 1024;

/** 云备份里单次上传的密文上限（防止有人拿这个接口当文件仓库） */
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

/** 同步码最少这么长（太短会被暴力猜） */
export const MIN_SYNC_CODE_LENGTH = 12;

/** 同步码在请求头里的名字 */
export const SYNC_CODE_HEADER = 'X-History-Key';

/** 生成一条记录的 id */
export function newEntryId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${Date.now().toString(36)}-${rand}`;
}

/** 从命盘里取一句人类可读的标题 */
export function chartTitle(chart: ZiweiChart | undefined, fallback = '命盘'): string {
  const b = chart?.birthInfo;
  if (!b) return fallback;
  const parts = [
    b.name,
    `${b.year}年${b.month}月${b.day}日`,
    b.city || b.province || '',
    b.gender === 'female' ? '女' : '男',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : fallback;
}
