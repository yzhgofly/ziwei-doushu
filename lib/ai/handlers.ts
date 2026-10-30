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
import { resolveAiConfig, describeAiConfig, type AiConfig } from './config';
import { normalizeMessages, streamAiText, type AiChatMessage } from './provider';
import { buildHemingSystemPrompt, buildInterpretSystemPrompt } from './prompt';
import { createSseStream, sseHeaders } from './sse';
import { parseChart, trimMessages } from './validate';
import { getRequestGuard, resolveClientKey, resolveGuardOptions, withRelease } from './guard';

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
 * 真打一次模型，确认「Key / 额度 / 网络 / 模型名」都通。
 *
 * 只发一个几乎不要输出的最小请求，不走流式（诊断不需要看内容），
 * 目的是把「配置看起来对但实际调不通」这种情况区分出来。
 */
async function probeModel(cfg: AiConfig): Promise<{ ok: boolean; detail: string; ms: number }> {
  const url = cfg.protocol === 'anthropic'
    ? `${cfg.baseURL}/messages`
    : `${cfg.baseURL}/chat/completions`;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.authMode === 'bearer') {
    headers['authorization'] = `Bearer ${cfg.apiKey}`;
  } else {
    headers['x-api-key'] = cfg.apiKey;
  }
  if (cfg.protocol === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01';
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: '回复「好」' }],
      }),
      signal: AbortSignal.timeout(Math.min(cfg.timeoutMs, 30_000)),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, detail: `HTTP ${res.status}：${text.slice(0, 300)}`, ms };
    }
    const text = await res.text();
    return { ok: true, detail: `模型可达，返回 ${text.length} 字节`, ms };
  } catch (e) {
    return {
      ok: false,
      detail: `无法连接模型服务：${e instanceof Error ? e.message : String(e)}`,
      ms: Date.now() - started,
    };
  }
}

/**
 * GET /api/health —— 诊断接口
 *
 * 之前「解读失败」只能靠猜，因为前端把真实原因吞了、日志又留不住。
 * 这个接口把现场状态一次性摊开：
 *   - AI 配置解析成没成功（缺 Key / 缺模型名 / base URL 不对）
 *   - 防护闸的实时状态（今天已经用掉多少次、当前并发、每分钟上限）
 *   - ?probe=1 时再真打一次模型，确认 Key 与额度确实可用
 *
 * 不返回任何密钥内容。
 */
export async function handleHealth(request: Request, env: EnvBag = process.env): Promise<Response> {
  const probe = new URL(request.url).searchParams.get('probe') === '1';

  let ai: { ok: boolean; summary?: string; error?: string };
  let cfg: AiConfig | null = null;
  try {
    cfg = resolveAiConfig(env);
    ai = { ok: true, summary: describeAiConfig(cfg) };
  } catch (e) {
    ai = { ok: false, error: e instanceof Error ? e.message : 'AI 配置有误' };
  }

  const guard = getRequestGuard(env);
  const body: Record<string, unknown> = {
    ok: ai.ok,
    time: new Date().toISOString(),
    ai,
    guard: {
      options: resolveGuardOptions(env),
      stats: guard.stats(),
      clientKey: resolveClientKey(request),
    },
  };

  if (probe) {
    body.probe = cfg
      ? await probeModel(cfg)
      : { ok: false, detail: 'AI 配置都没解析成功，跳过探测', ms: 0 };
  }

  return Response.json(body);
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
