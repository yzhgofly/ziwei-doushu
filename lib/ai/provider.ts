/**
 * AI 流式客户端
 *
 * 两种协议统一成「逐段吐出文本」：
 *   - anthropic：POST {baseURL}/messages          （Anthropic Messages 协议）
 *   - openai   ：POST {baseURL}/chat/completions  （OpenAI 兼容协议）
 *
 * 这里刻意不用 @anthropic-ai/sdk：
 * 本地/私有端点（例如走 Authorization: Bearer 而非 x-api-key）需要完全掌控请求头，
 * 两种协议共用一套 SSE 解析，比分别维护 SDK 与手写 fetch 更一致。
 */

import type { AiConfig } from './config';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiStreamOptions {
  system: string;
  messages: AiChatMessage[];
  signal?: AbortSignal;
}

export class AiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
  }
}

/**
 * 把对话规整成模型能接受的形状：
 * 丢掉空消息、合并同角色相邻消息、确保第一条是 user。
 * （前端会把隐藏的预设提问也一并发过来，角色序列不保证严格交替。）
 */
export function normalizeMessages(messages: AiChatMessage[]): AiChatMessage[] {
  const cleaned: AiChatMessage[] = messages
    .filter(m => typeof m?.content === 'string' && m.content.trim().length > 0)
    .map((m): AiChatMessage => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const merged: AiChatMessage[] = [];
  for (const m of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      merged.push({ ...m });
    }
  }
  if (merged.length === 0) {
    return [{ role: 'user', content: '请解读这张命盘。' }];
  }
  if (merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: '请解读这张命盘。' });
  }
  return merged;
}

/** 逐行拆 SSE，取出每条 data: 的载荷 */
async function* readSsePayloads(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        const payload = parseSseLine(line);
        if (payload) yield payload;
        nl = buffer.indexOf('\n');
      }
    }
    const tail = parseSseLine(buffer.replace(/\r$/, ''));
    if (tail) yield tail;
  } finally {
    try { reader.releaseLock(); } catch { /* 已释放 */ }
  }
}

function parseSseLine(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  return payload;
}

function buildHeaders(cfg: AiConfig): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.authMode === 'bearer') {
    headers['authorization'] = `Bearer ${cfg.apiKey}`;
  } else {
    headers['x-api-key'] = cfg.apiKey;
  }
  if (cfg.protocol === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01';
  }
  return headers;
}

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([timeout, external]) : timeout;
}

async function readErrorBody(res: Response): Promise<string> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
  try {
    const parsed = JSON.parse(text);
    const message =
      parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? parsed?.detail;
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch { /* 非 JSON，按原文处理 */ }
  return text.slice(0, 500) || `${res.status} ${res.statusText}`;
}

function extractAnthropicDelta(payload: string): { text?: string; error?: string; stopReason?: string } {
  let ev: any;
  try { ev = JSON.parse(payload); } catch { return {}; }
  if (ev?.type === 'error') {
    return { error: ev?.error?.message ?? '模型返回错误' };
  }
  if (ev?.type === 'message_delta' && typeof ev?.delta?.stop_reason === 'string') {
    return { stopReason: ev.delta.stop_reason };
  }
  if (ev?.type === 'content_block_delta' && ev?.delta?.type === 'text_delta') {
    const text = ev.delta.text;
    return typeof text === 'string' ? { text } : {};
  }
  return {};
}

function extractOpenAiDelta(payload: string): { text?: string; error?: string; stopReason?: string } {
  let ev: any;
  try { ev = JSON.parse(payload); } catch { return {}; }
  if (ev?.error) {
    const message = typeof ev.error === 'string' ? ev.error : ev.error?.message;
    return { error: message ?? '模型返回错误' };
  }
  const finish = ev?.choices?.[0]?.finish_reason;
  const text = ev?.choices?.[0]?.delta?.content;
  const out: { text?: string; error?: string; stopReason?: string } = {};
  if (typeof finish === 'string' && finish) out.stopReason = finish === 'length' ? 'max_tokens' : finish;
  if (typeof text === 'string' && text.length > 0) out.text = text;
  return out;
}

interface StreamOutcome {
  stopReason?: string;
  chars: number;
}

/** 跑一轮流式请求，把文本增量吐出去，同时记录 stop_reason */
async function* streamOnce(
  cfg: AiConfig,
  opts: AiStreamOptions,
  maxTokens: number,
  outcome: StreamOutcome,
): AsyncGenerator<string> {
  const messages = normalizeMessages(opts.messages);
  const url = cfg.protocol === 'anthropic'
    ? `${cfg.baseURL}/messages`
    : `${cfg.baseURL}/chat/completions`;

  const body = cfg.protocol === 'anthropic'
    ? {
        model: cfg.model,
        max_tokens: maxTokens,
        system: opts.system,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }
    : {
        model: cfg.model,
        max_tokens: maxTokens,
        stream: true,
        messages: [{ role: 'system', content: opts.system }, ...messages],
      };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(cfg),
      body: JSON.stringify(body),
      signal: combineSignals(cfg.timeoutMs, opts.signal),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new AiRequestError(`模型请求超时（${cfg.timeoutMs}ms）`, 504);
    }
    throw new AiRequestError(`无法连接模型服务：${e instanceof Error ? e.message : String(e)}`, 502);
  }

  if (!res.ok) {
    throw new AiRequestError(await readErrorBody(res), res.status);
  }
  if (!res.body) {
    throw new AiRequestError('模型服务未返回响应流', 502);
  }

  const extract = cfg.protocol === 'anthropic' ? extractAnthropicDelta : extractOpenAiDelta;
  for await (const payload of readSsePayloads(res.body)) {
    const { text, error, stopReason } = extract(payload);
    if (error) throw new AiRequestError(error, 502);
    if (stopReason) outcome.stopReason = stopReason;
    if (text) {
      outcome.chars += text.length;
      yield text;
    }
  }
}

const MAX_RETRY_BUDGET = 65_536;

/**
 * 调用模型并逐段产出文本增量。
 *
 * 关键处理：带 thinking 的模型（MiniMax M3 等）会先花掉一大截输出预算做思考，
 * 如果 max_tokens 给小了，就会在正文开始前被截断 —— 表现为「一个字的正文都没有」。
 * 这里检测到「被 max_tokens 截断且零输出」时，自动把预算翻 4 倍重试一次。
 *
 * 任何上游错误都会以异常形式抛出，由路由层转成 SSE 里的 error 事件。
 */
export async function* streamAiText(cfg: AiConfig, opts: AiStreamOptions): AsyncGenerator<string> {
  let maxTokens = cfg.maxTokens;
  let retried = false;

  while (true) {
    const outcome: StreamOutcome = { chars: 0 };
    for await (const text of streamOnce(cfg, opts, maxTokens, outcome)) {
      yield text;
    }

    const truncated = outcome.stopReason === 'max_tokens';
    // 零输出 + 被截断 = 预算全被 thinking 吃掉，加预算重来
    if (truncated && outcome.chars === 0 && !retried && maxTokens < MAX_RETRY_BUDGET) {
      retried = true;
      maxTokens = Math.min(maxTokens * 4, MAX_RETRY_BUDGET);
      continue;
    }
    // 出了字但被截断：内容不完整，明确告诉用户，别让他以为就是完整答案
    if (truncated && outcome.chars > 0) {
      yield '\n\n（本次回答触及模型输出上限已被截断，可调高 AI_MAX_TOKENS 后重试。）';
    }
    return;
  }
}
