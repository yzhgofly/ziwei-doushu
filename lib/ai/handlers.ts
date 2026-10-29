/**
 * AI 解读 / 合盘分析的共享处理器
 *
 * 同一套逻辑要跑在两个运行时上：
 *   - Next.js 路由      app/api/interpret/route.ts、app/api/heming/route.ts（部署到 Vercel）
 *   - Cloudflare Pages Functions  functions/api/*.ts（部署到 Cloudflare 边缘）
 *
 * 两边的请求体、响应协议、防护策略必须完全一致，所以逻辑抽到这里，
 * 路由层只做薄包装：解析环境变量 → 调处理器 → 返回 Response。
 *
 * 环境变量的取法也统一成「显式传入」：
 *   - Next.js      process.env
 *   - Pages        context.env（Worker 运行时里 process.env 不可靠）
 */

import { detectPatterns } from '@/lib/ziwei/patterns-core';
import { resolveAiConfig, type AiConfig } from './config';
import { normalizeMessages, streamAiText, type AiChatMessage } from './provider';
import { buildHemingSystemPrompt, buildInterpretSystemPrompt } from './prompt';
import { createSseStream, sseHeaders } from './sse';
import { parseChart, trimMessages } from './validate';
import { getRequestGuard, resolveClientKey, withRelease } from './guard';

/** 环境变量集合：Next 用 process.env，Workers 用 context.env */
export type EnvBag = Record<string, string | undefined>;

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/**
 * POST /api/interpret —— AI 命盘解读（流式）
 *
 *   请求：{ chart: ZiweiChart, messages: {role, content}[] }
 *   响应：SSE —— data: {"delta":{"text":"..."}} …… data: [DONE]
 */
export async function handleInterpret(request: Request, env: EnvBag = process.env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, '请求体不是合法 JSON');
  }

  const payload = (body ?? {}) as { chart?: unknown; messages?: AiChatMessage[] };
  const chart = parseChart(payload.chart);
  if (!chart) {
    return jsonError(400, '命盘数据无效或缺失');
  }

  const messages = trimMessages(Array.isArray(payload.messages) ? payload.messages : []);

  let config: AiConfig;
  try {
    config = resolveAiConfig(env);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI 配置有误';
    return jsonError(500, `AI 解读未配置：${message}`);
  }

  // 公网暴露时的额度保护：单 IP 限流 + 全局并发 + 每日配额
  const guard = getRequestGuard(env);
  const verdict = guard.check(resolveClientKey(request));
  if (!verdict.ok) {
    return jsonError(verdict.status, verdict.error);
  }

  // 格局识别放在服务端算好后传进 prompt（patterns-core 不带 server-only，跨运行时可用）
  const patterns = detectPatterns(chart);
  const system = buildInterpretSystemPrompt(chart, { patterns });

  const abort = new AbortController();
  const generator = streamAiText(config, {
    system,
    messages: normalizeMessages(messages),
    signal: abort.signal,
  });

  return new Response(
    createSseStream(withRelease(generator, verdict.release), () => abort.abort()),
    { headers: sseHeaders() }
  );
}

/**
 * POST /api/heming —— 合盘 AI 分析（流式）
 *
 *   请求：{ chartA: ZiweiChart, chartB: ZiweiChart, question?: string }
 *   响应：SSE —— data: {"delta":{"text":"..."}} …… data: [DONE]
 */
export async function handleHeming(request: Request, env: EnvBag = process.env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, '请求体不是合法 JSON');
  }

  const payload = (body ?? {}) as { chartA?: unknown; chartB?: unknown; question?: unknown };
  const chartA = parseChart(payload.chartA);
  const chartB = parseChart(payload.chartB);
  if (!chartA || !chartB) {
    return jsonError(400, '合盘需要两张有效的命盘数据');
  }

  const question = typeof payload.question === 'string' ? payload.question.slice(0, 500) : undefined;

  let config: AiConfig;
  try {
    config = resolveAiConfig(env);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI 配置有误';
    return jsonError(500, `合盘分析未配置：${message}`);
  }

  // 公网暴露时的额度保护：单 IP 限流 + 全局并发 + 每日配额
  const guard = getRequestGuard(env);
  const verdict = guard.check(resolveClientKey(request));
  if (!verdict.ok) {
    return jsonError(verdict.status, verdict.error);
  }

  const system = buildHemingSystemPrompt(chartA, chartB, question, {
    patterns: detectPatterns(chartA),
  });

  const abort = new AbortController();
  const generator = streamAiText(config, {
    system,
    messages: [{ role: 'user', content: question?.trim() || '请对这两张命盘做合盘分析。' }],
    signal: abort.signal,
  });

  return new Response(
    createSseStream(withRelease(generator, verdict.release), () => abort.abort()),
    { headers: sseHeaders() }
  );
}
