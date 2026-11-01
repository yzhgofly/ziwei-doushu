/**
 * 回归：历史记录功能（lib/history/*）—— 不联网。
 *
 * 这道回归锁四件事：
 *   1. **本地存储**：增删改查、条数/体积双上限、导入导出；
 *   2. **客户端加密**：同步码能解出原文、错的同步码解不开（这就是「别人看不到」的核心）；
 *   3. **服务端接口**：没同步码 401、同步码太短 400、没配 KV 503、存取删一轮通；
 *   4. **接线**：解读面板与合盘页确实挂了面板、确实在回答完成后写历史、/chart 确实能恢复命盘。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HISTORY_STORAGE_KEY,
  addHistoryEntry,
  clearHistory,
  exportHistory,
  importHistory,
  readHistory,
  removeHistoryEntry,
  writeHistory,
} from '../../lib/history/local';
import { decryptJson, encryptJson, randomSyncCode } from '../../lib/history/crypto';
import { handleHistory } from '../../lib/history/history-api';
import { getKvStore } from '../../lib/history/kv-store';
import { recordHistory } from '../../lib/history/record';
import { MAX_HISTORY_ENTRIES, chartTitle, newEntryId } from '../../lib/history/types';

let fails = 0;
function ok(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) fails++;
}

const ROOT = process.cwd();

// ─── 浏览器环境替身（Node 里没有 localStorage / window）───
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}
const mem = new MemoryStorage();
(globalThis as any).localStorage = mem;
(globalThis as any).window = {
  dispatchEvent: () => true,
  removeEventListener: () => { },
  addEventListener: () => { },
};

function fakeEntry(id: string, savedAt: number, answer = '回答内容') {
  return {
    id,
    kind: 'interpret' as const,
    savedAt,
    title: '测试命盘',
    question: '命格',
    answer,
  };
}

async function main() {
  // ═══ 1) 本地存储 ═══
  clearHistory();
  ok('清空后历史为空', readHistory().length === 0);

  addHistoryEntry(fakeEntry('a', 1000));
  addHistoryEntry(fakeEntry('b', 2000));
  ok('加了两条', readHistory().length === 2);
  ok('按时间倒序（新的在前）', readHistory()[0].id === 'b');

  removeHistoryEntry('a');
  ok('删除生效', readHistory().length === 1 && readHistory()[0].id === 'b');

  // 重复 id 应该是覆盖而不是追加
  addHistoryEntry(fakeEntry('b', 3000, '改过的内容'));
  ok('同 id 覆盖不重复', readHistory().length === 1 && readHistory()[0].answer === '改过的内容');

  // 条数上限
  const many = Array.from({ length: MAX_HISTORY_ENTRIES + 10 }, (_, i) =>
    fakeEntry(`x${i}`, 10000 + i));
  const trimmed = writeHistory(many);
  ok(`条数上限 ${MAX_HISTORY_ENTRIES} 生效`, trimmed.length === MAX_HISTORY_ENTRIES);
  ok('超出时丢的是最旧的', trimmed[0].id === `x${MAX_HISTORY_ENTRIES + 9}`);

  // 体积上限（一条超大内容应当被裁掉）
  const huge = writeHistory([fakeEntry('big', 1, 'x'.repeat(3 * 1024 * 1024))]);
  ok('体积超上限时裁剪（不留超限内容）', huge.length === 0 || JSON.stringify(huge).length <= 3 * 1024 * 1024);

  // 导入导出（先把 30 条重新写回存储，再导出）
  writeHistory(many);
  const exported = exportHistory();
  ok('导出是合法 JSON 且带 entries', (() => {
    try { const p = JSON.parse(exported); return Array.isArray(p.entries); } catch { return false; }
  })());
  clearHistory();
  ok('清空后存储里确实没了', mem.getItem(HISTORY_STORAGE_KEY) === null);
  const imp = importHistory(exported);
  ok('导入成功', imp.ok && imp.count === MAX_HISTORY_ENTRIES);
  ok('导入后存储里有了', mem.getItem(HISTORY_STORAGE_KEY) !== null);
  const bad = importHistory('这不是 JSON');
  ok('导入垃圾内容被拒绝', !bad.ok && !!bad.error);
  const bad2 = importHistory(JSON.stringify({ entries: [{ nope: 1 }] }));
  ok('导入结构不对的记录被拒绝', !bad2.ok);

  // ═══ 2) 客户端加密 ═══
  const code = randomSyncCode();
  ok('生成的同步码够长（≥12）', code.length >= 12);
  ok('两次生成不同', randomSyncCode() !== code);

  const plain = { entries: [{ id: 'x', answer: '我的秘密内容' }] };
  const blob = await encryptJson(code, plain);
  ok('密文里不含原文', !JSON.stringify(blob).includes('我的秘密内容'));
  ok('密文字段齐全', !!blob.salt && !!blob.iv && !!blob.data);

  const decrypted = await decryptJson(code, blob) as any;
  ok('同一同步码能解出原文', decrypted?.entries?.[0]?.answer === '我的秘密内容');

  let wrongFailed = false;
  try {
    await decryptJson('另一个同步码-完全不同的', blob);
  } catch {
    wrongFailed = true;
  }
  ok('错的同步码解不开', wrongFailed);

  const blob2 = await encryptJson(code, plain);
  ok('同样内容两次密文不同（随机盐/IV）', blob2.data !== blob.data);

  // ═══ 3) 服务端接口 ═══
  const store = new Map<string, string>();
  const kvBinding = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
  };
  const envWithKv = { HISTORY_KV: kvBinding } as any;

  // 没同步码 → 401
  const noKey = await handleHistory(new Request('https://x/api/history'), envWithKv);
  ok('缺同步码返回 401', noKey.status === 401);

  // 同步码太短 → 400
  const shortKey = await handleHistory(
    new Request('https://x/api/history', { headers: { 'X-History-Key': 'short' } }), envWithKv);
  ok('同步码太短返回 400', shortKey.status === 400);

  // 没配 KV → 503
  const noKv = await handleHistory(
    new Request('https://x/api/history', { headers: { 'X-History-Key': 'abcdefghijklmnop' } }), {});
  ok('没启用云备份返回 503', noKv.status === 503);

  // 存取删一轮通（这段固定用一个同步码，避免和上面的随机码串台）
  const apiCode = 'abcdefghijklmnop';
  const apiBlob = await encryptJson(apiCode, plain);
  const hdr = { 'X-History-Key': apiCode, 'Content-Type': 'application/json' };
  const putRes = await handleHistory(
    new Request('https://x/api/history', { method: 'PUT', headers: hdr, body: JSON.stringify({ blob: apiBlob }) }),
    envWithKv);
  ok('PUT 成功', putRes.status === 200);
  ok('KV 里确实写进去了', store.size === 1);
  ok('KV 里存的是密文不是明文', ![...store.values()].some(v => v.includes('我的秘密内容')));

  const getRes = await handleHistory(
    new Request('https://x/api/history', { headers: { 'X-History-Key': apiCode } }),
    envWithKv);
  ok('GET 拿回密文', getRes.status === 200);
  const gotBody = await getRes.json() as any;
  ok('GET 返回的 blob 能被同步码解开', (await decryptJson(apiCode, gotBody.blob) as any)
    ?.entries?.[0]?.answer === '我的秘密内容');

  // 换同步码 → 取不到别人的
  const otherRes = await handleHistory(
    new Request('https://x/api/history', { headers: { 'X-History-Key': 'zzzzzzzzzzzzzzzzzzzz' } }),
    envWithKv);
  ok('换个同步码取不到（拿不到别人的数据）', otherRes.status === 404);

  const delRes = await handleHistory(
    new Request('https://x/api/history', { method: 'DELETE', headers: hdr }), envWithKv);
  ok('DELETE 成功', delRes.status === 200);
  ok('删除后 KV 里没了', store.size === 0);

  // KV 后端识别
  ok('能认出 KV 绑定', !!getKvStore(envWithKv));
  ok('没有后端时返回 null', getKvStore({}) === null);
  ok('能认出 Cloudflare REST 后端', !!getKvStore({
    CF_ACCOUNT_ID: 'acc', CF_KV_NAMESPACE_ID: 'ns', CF_API_TOKEN: 'tok',
  }));

  // ═══ 4) 写入历史的公共入口 ═══
  clearHistory();
  const rec = recordHistory({
    kind: 'interpret',
    question: '感情',
    answer: '这是一段回答',
    chart: { birthInfo: { year: 1990, month: 1, day: 5, hour: 3, gender: 'male', name: '张三' } } as any,
  });
  ok('recordHistory 写入成功', !!rec);
  ok('写进去的是解读类型', readHistory()[0].kind === 'interpret');
  ok('标签按传入的存', readHistory()[0].question === '感情');
  ok('标题从命盘里取', readHistory()[0].title.includes('张三'));
  ok('空回答不入库', recordHistory({ kind: 'interpret', question: 'x', answer: '  ' }) === null);

  const rec2 = recordHistory({
    kind: 'heming',
    question: '综合合盘分析',
    answer: '合盘回答',
    chart: { birthInfo: { year: 1990, month: 1, day: 5, hour: 3, gender: 'male', name: '甲' } } as any,
    chartB: { birthInfo: { year: 1991, month: 2, day: 6, hour: 5, gender: 'female', name: '乙' } } as any,
  });
  ok('合盘记录标题带双方', !!rec2 && readHistory()[0].title.includes('甲') && readHistory()[0].title.includes('乙'));
  ok('合盘记录保存了乙方盘', !!readHistory()[0].chartB);

  // ═══ 5) 接线（读源码确认）═══
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
  const insight = read('components/InsightPanel.tsx');
  const heming = read('app/heming/page.tsx');
  const chartPage = read('app/chart/page.tsx');
  const panel = read('components/HistoryPanel.tsx');
  const localSrc = read('lib/history/local.ts');

  ok('解读面板挂了历史面板', insight.includes('<HistoryPanel'));
  ok('解读面板在回答完成后写历史', insight.includes('recordHistory') && insight.includes("kind: 'interpret'"));
  ok('合盘页挂了历史面板', heming.includes('<HistoryPanel'));
  ok('合盘页在分析完成后写历史', heming.includes('recordHistory') && heming.includes("kind: 'heming'"));
  ok('/chart 能从历史恢复命盘', chartPage.includes('takeStagedChart') && chartPage.includes('restore'));
  ok('/chart 监听了同页恢复事件（同一页里也能换盘）', chartPage.includes('RESTORE_EVENT'));
  ok('/chart 未起盘时也挂着历史面板', chartPage.includes('<HistoryPanel'));
  ok('历史面板用统一的恢复入口', panel.includes('requestChartRestore'));
  ok('历史面板没有残留的隐藏输入框', !panel.includes('display: \'none\'\n                  />') && !panel.includes('由下面的输入框接管'));
  ok('本地历史层不往外发数据', !localSrc.includes('fetch('));

  // ═══ 6) 小工具 ═══
  ok('newEntryId 不重复', newEntryId() !== newEntryId());
  ok('chartTitle 有兜底', chartTitle(undefined, '命盘') === '命盘');
  ok('chartTitle 带性别', chartTitle({ birthInfo: { year: 2000, month: 2, day: 2, hour: 1, gender: 'female' } } as any).includes('女'));

  console.log(fails === 0 ? '\n全部通过' : `\n失败 ${fails} 项`);
  if (fails > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
