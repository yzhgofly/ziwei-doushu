/**
 * AI 解读接口冒烟测试 —— 打真实模型，验证 /api/interpret 与 /api/heming 的 SSE 链路。
 *
 * 需要先启动开发服务器：
 *   npm run dev
 * 然后：
 *   npx tsx scripts/smoke-ai.ts
 *
 * 这个脚本会真实调用模型并消耗额度，只在需要时手动跑；
 * `npm test` 里跑的是不联网的纯逻辑回归（scripts/regression/ai-prompt.test.ts）。
 */

import { generateChart } from '../lib/ziwei/algorithm';
import type { ZiweiChart } from '../lib/ziwei/types';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const RAW = process.env.SMOKE_RAW === '1';

/** 解析前端同款 SSE：data: {"delta":{"text":"..."}} …… data: [DONE] */
async function readSse(res: Response): Promise<string> {
  if (!res.body) throw new Error('响应没有 body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let out = '';

  const handleLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // 半包/非 JSON，跳过
    }
    if (RAW) console.log(`  [raw] ${payload.slice(0, 300)}`);
    if (parsed?.error) throw new Error(`服务端错误：${parsed.error}`);
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
  return out;
}

function makeChart(): ZiweiChart {
  return generateChart({
    year: 1990, month: 1, day: 1, hour: 4, // 辰时
    gender: 'male',
    province: '北京市', city: '北京', longitude: 116.4,
  });
}

async function callInterpret(chart: ZiweiChart, question: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart,
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}：${body.slice(0, 300)}`);
  }
  return readSse(res);
}

async function callHeming(chartA: ZiweiChart, chartB: ZiweiChart): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/heming`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chartA, chartB }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}：${body.slice(0, 300)}`);
  }
  return readSse(res);
}

async function main() {
  console.log(`目标：${BASE_URL}`);
  const chartA = makeChart();
  const chartB = generateChart({
    year: 1991, month: 6, day: 15, hour: 9, // 酉时
    gender: 'female',
    province: '上海市', city: '上海', longitude: 121.47,
  });

  console.log('\n────────── /api/interpret ──────────');
  const t0 = Date.now();
  const interpretText = await callInterpret(chartA, '我的整体命格如何？性格特点是什么？');
  console.log(`（${((Date.now() - t0) / 1000).toFixed(1)}s，${interpretText.length} 字）`);
  console.log(interpretText);

  console.log('\n────────── /api/heming ──────────');
  const t1 = Date.now();
  const hemingText = await callHeming(chartA, chartB);
  console.log(`（${((Date.now() - t1) / 1000).toFixed(1)}s，${hemingText.length} 字）`);
  console.log(hemingText);
}

main().catch(err => {
  console.error('\n❌ 冒烟测试失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
