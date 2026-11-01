/**
 * 把「一次问答」写进历史
 *
 * 解读面板和合盘页都走这个入口，保证：
 *   - 展示用的短标签统一（用标签而不是长 prompt）；
 *   - 命盘快照跟着一起存，方便「回到这个命盘」继续追问；
 *   - 存不进去（隐私模式 / 超限）也不影响主流程。
 */

import { addHistoryEntry } from './local';
import { chartTitle, newEntryId, type HistoryEntry, type HistoryKind } from './types';
import type { ZiweiChart } from '@/lib/ziwei/types';

export interface RecordInput {
  /** 解读 / 合盘 */
  kind: HistoryKind;
  /** 展示用的提问标签（短句，不要塞整个 prompt） */
  question: string;
  /** AI 回答全文 */
  answer: string;
  /** 解读用的命盘 / 合盘的甲方盘 */
  chart?: ZiweiChart;
  /** 合盘的乙方盘 */
  chartB?: ZiweiChart;
}

/** 标签最长保留这么多字，超了截断（列表里只显示这一行） */
const MAX_LABEL_LENGTH = 40;

/** 回答正文最长保留这么多字（2MB 总上限下，单条留 200KB 足够） */
const MAX_ANSWER_LENGTH = 200_000;

/**
 * 写入一条历史。返回存下来的那条（被容量上限裁掉时返回 null）。
 * 这个函数**不会抛异常**：历史存不下是降级，不是故障。
 */
export function recordHistory(input: RecordInput): HistoryEntry | null {
  try {
    const answer = (input.answer || '').trim();
    if (!answer) return null;

    const title = input.kind === 'heming'
      ? `${chartTitle(input.chart, '甲方')} × ${chartTitle(input.chartB, '乙方')}`
      : chartTitle(input.chart, '命盘');

    const entry: HistoryEntry = {
      id: newEntryId(),
      kind: input.kind,
      savedAt: Date.now(),
      title,
      question: (input.question || '').trim().slice(0, MAX_LABEL_LENGTH) || (input.kind === 'heming' ? '综合合盘分析' : '命格'),
      answer: answer.slice(0, MAX_ANSWER_LENGTH),
      chart: input.chart,
      chartB: input.chartB,
    };

    const stored = addHistoryEntry(entry);
    return stored.find(e => e.id === entry.id) ?? null;
  } catch {
    return null;
  }
}
