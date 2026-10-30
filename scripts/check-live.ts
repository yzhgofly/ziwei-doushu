/**
 * 线上自检 —— 对着已部署的站点跑一遍，确认「AI 解读这条路」真的通。
 *
 * 用途：改完代码、换完 Key、重新部署之后，不用猜，直接跑这个脚本看结果。
 *
 *   node_modules\.bin\tsx scripts\check-live.ts https://ziwei-doushu-b6t.pages.dev
 *   node_modules\.bin\tsx scripts\check-live.ts https://xxx.pages.dev --probe
 *
 * 依次检查：
 *   1. GET  /api/health          —— AI 配置解析成功吗、防护闸用量是多少
 *   2. GET  /api/health?probe=1  —— 真打一次模型，Key 与额度到底通不通
 *   3. POST /api/interpret       —— 完整走一遍 SSE，解读能不能出字
 *   4. 并发压测                  —— 故意打满并发，确认失败时返回的是**可读原因**
 *                                   而不是一句「解读失败」
 *
 * 脚本只读不写，不会改动任何数据。
 */

import { generateChart } from '../lib/ziwei/algorithm';
import type { ZiweiChart } from '../lib/ziwei/types';

const BASE_URL = (process.argv[2] ?? 'https://ziwei-doushu-b6t.pages.dev').replace(/\/+$/, '');
const PROBE = process.argv.includes('--probe');
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY ?? '6');

function makeChart(): ZiweiChart {
  return generateChart({
    year: 1990, month: 1, day: 1, hour: 4,
    gender: 'male',
    province: '北京市', city: '北京', longitude: 116.4,
  });
}

/** 解析 SSE，返回正文；服务端报的 error 会抛出来 */
async function readSse(res: Response): Promise<string> {
  if (!res.body) throw new Error('响应没有 body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let out = '';
  let serverError = '';

  const handleLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    let parsed: any;
    try { parsed = JSON.parse(payload); } catch { return; }
    if (parsed?.error) { serverError = String(parsed.error); return; }
    if (typeof parsed?.delta?.text === 'string') out += parsed.delta.text;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      handleLine(buffer.slice(0, nl).trim());
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf('\n');
    }
  }
  handleLine(buffer.trim());
  if (serverError) throw new Error(`服务端错误：${serverError}`);
  return out;
}

function line(title: string) {
  console.log(`\n────────── ${title} ──────────`);
}

async function checkHealth() {
  line('1) GET /api/health');
  const res = await fetch(`${BASE_URL}/api/health`);
  const body = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  return body;
}

async function checkProbe() {
  line(`2) GET /api/health?probe=1${PROBE ? '' : '（加 --probe 才会真打模型）'}`);
  const res = await fetch(`${BASE_URL}/api/health?probe=1`);
  const body = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  return body;
}

async function checkInterpret(chart: ZiweiChart) {
  line('3) POST /api/interpret（完整走一遍 SSE）');
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart,
      messages: [{ role: 'user', content: '我的整体命格如何？性格特点是什么？' }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.log(`✗ HTTP ${res.status}：${text.slice(0, 400)}`);
    console.log(`  （前端现在会把这句原样显示给用户）`);
    return false;
  }
  const text = await readSse(res);
  console.log(`✓ ${((Date.now() - t0) / 1000).toFixed(1)}s，${text.length} 字`);
  console.log(text.slice(0, 600) + (text.length > 600 ? '\n…（略）' : ''));
  return true;
}

async function checkConcurrency(chart: ZiweiChart) {
  line(`4) 并发压测 × ${CONCURRENCY}（确认失败时给的是可读原因）`);
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, i) => {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart,
          messages: [{ role: 'user', content: `并发压测 ${i}` }],
        }),
      });
      if (res.ok) {
        await readSse(res).catch(() => '');
        return { i, status: res.status, note: '通过' };
      }
      const text = await res.text();
      return { i, status: res.status, note: text.slice(0, 200), ms: Date.now() - t0 };
    })
  );
  for (const r of results) {
    console.log(`  #${r.i} HTTP ${r.status} ${r.note}`);
  }
  const rejected = results.filter(r => r.status !== 200);
  if (rejected.length > 0) {
    const readable = rejected.every(r => r.note.includes('error') || r.note.includes('请求') || r.note.includes('频繁'));
    console.log(readable
      ? '✓ 被拒的请求都带了可读原因（前端会原样显示）'
      : '✗ 被拒的请求没有可读原因，需要补');
  } else {
    console.log('（并发没打满，没有触发拒绝）');
  }
}

async function main() {
  console.log(`目标：${BASE_URL}`);
  const health = await checkHealth();
  if (PROBE) await checkProbe();
  const chart = makeChart();
  await checkInterpret(chart);
  await checkConcurrency(chart);
  console.log('\n自检完成。');
  if (health?.ai?.ok === false) {
    console.log('⚠ AI 配置没解析成功，先修配置再谈解读。');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ 自检失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
