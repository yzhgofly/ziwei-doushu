/**
 * 前端共用的 SSE 读取器。
 *
 * 之前三个界面（聊天面板 / 解读面板 / 合盘页）各写了一份几乎一样的流解析代码，
 * 而且有三个共同的问题：
 *
 *   1. **分片边界会丢内容**：网络包可能把一行 SSE 从中间切断，
 *      老代码直接 `chunk.split('\n')` 然后丢掉半行，那半行的内容就永远读不到了。
 *   2. **读流失败看不出所以然**：连接被掐断时 Chromium 抛的是 `TypeError: network error`，
 *      老代码把它连同「解读失败，请稍后重试」一起吞掉，用户和排查的人都不知道到底发生了什么。
 *   3. **不会重试**：一次网络抖动 = 一次解读白等。
 *
 * 这里统一处理：
 *   - 用 carry-over 缓冲区正确拼行（跨包不丢内容）
 *   - 忽略 SSE 注释心跳行（`: open`）与服务端的状态事件（`{"status":"accepted"}`）
 *   - 服务端报的 `{"error":...}` 直接抛出，文案原样带出来
 *   - 读流失败时抛出带诊断信息（已收到多少字、耗时多久）的错误
 *   - **一个字都没收到时自动重试一次**（已经收到正文就不重试，避免出现两份内容）
 */

import { describeHttpError, describeStreamError } from './error-text';

/** 流被掐断 / 读流失败时抛出，带上现场诊断信息 */
export class SseStreamError extends Error {
  /** 已经收到的正文字数 */
  readonly received: number;
  /** 从开始读到失败经过的毫秒数 */
  readonly elapsedMs: number;
  /** 收到的网络包个数 */
  readonly chunks: number;
  /** 失败前收到的心跳（服务端状态事件）个数——用来判断服务端是死了还是链路断了 */
  readonly beats: number;

  constructor(message: string, received: number, elapsedMs: number, chunks: number, beats = 0) {
    super(message);
    this.name = 'SseStreamError';
    this.received = received;
    this.elapsedMs = elapsedMs;
    this.chunks = chunks;
    this.beats = beats;
  }

  /** 给用户看的一句话（带现场信息，方便排查） */
  describe(): string {
    const secs = (this.elapsedMs / 1000).toFixed(1);
    const why = this.received > 0
      ? `已收到 ${this.received} 字后连接中断（耗时 ${secs} 秒）`
      : `连接中断，没有收到任何内容（耗时 ${secs} 秒）`;
    // 心跳数是判断「服务端挂了」还是「链路断了」的关键：
    // 收到过心跳说明服务端还在正常说话，是链路/客户端这边断的。
    const beat = this.beats > 0
      ? `，断前收到 ${this.beats} 次服务端心跳（服务端仍在响应，是链路中断）`
      : '，一次心跳都没收到（服务端未开始响应）';
    return `${this.message}：${why}${beat}`;
  }
}

/** 服务端在流里报的错误 */
export class SseServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SseServerError';
  }
}

/**
 * 读一条 SSE 流，把正文增量回调出去。
 *
 * onDelta 收到的是**累计全文**（和旧代码的语义一致：前端每次都拿全文重画）。
 * 返回累计全文。
 */
export async function readSseText(
  res: Response,
  onDelta: (fullText: string) => void,
): Promise<string> {
  if (!res.body) throw new SseStreamError('无响应流', 0, 0, 0);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const started = Date.now();
  let buffer = '';
  let out = '';
  let chunks = 0;
  // 服务端心跳（status 事件）计数：断流时能据此判断服务端是否还在响应
  let beats = 0;

  const handleLine = (raw: string) => {
    const line = raw.replace(/\r$/, '');
    // 注释心跳行（`: open`）前端直接跳过
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // 半包 / 非 JSON，跳过
    }
    // 服务端在流里报的错要显示出来
    if (parsed?.error) throw new SseServerError(describeStreamError(parsed));
    const delta = parsed?.delta?.text;
    if (typeof delta === 'string' && delta) {
      out += delta;
      onDelta(out);
      return;
    }
    // 没有 delta 字段、也没有 error 的事件 = 服务端心跳
    if (parsed && typeof parsed === 'object') beats++;
  };

  try {
    for (;;) {
      let step: ReadableStreamReadResult<Uint8Array>;
      try {
        step = await reader.read();
      } catch (e) {
        // Chromium 抛 "network error"：连接在读完之前被掐断了
        throw new SseStreamError(
          e instanceof Error && e.message ? e.message : '读取响应流失败',
          out.length,
          Date.now() - started,
          chunks,
          beats,
        );
      }
      if (step.done) break;
      chunks++;
      buffer += decoder.decode(step.value, { stream: true });

      // carry-over：把不完整的尾巴留在 buffer 里，等下一个包拼上
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        handleLine(line);
        nl = buffer.indexOf('\n');
      }
    }
    // 收尾：解码器里可能还剩半个字符
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
  } finally {
    try { reader.releaseLock(); } catch { /* 已释放 */ }
  }

  return out;
}

export interface SseFetchOptions {
  /** 发起请求（每次重试都会重新调用） */
  doFetch: () => Promise<Response>;
  /** 正文增量回调，收到的是累计全文 */
  onDelta: (fullText: string) => void;
  /** 重试前的提示（例如「连接中断，正在重试…」） */
  onRetry?: (attempt: number, maxAttempts: number, reason: string) => void;
  /** 最多尝试几次（含第一次） */
  maxAttempts?: number;
}

/** 重试前的退避时间（毫秒）：让请求落到一条新的连接上 */
const RETRY_BACKOFF_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 正式请求前先打一个便宜的 GET，把连接「换新」。
 *
 * 实测现象：浏览器里发解读请求时，连接可能已经被边缘节点悄悄关掉了
 * （页面加载完隔一会儿、或中间有别的请求把连接耗掉）。
 * Chromium 出于安全**不会自动重试 POST**（重试 POST 不幂等），
 * 于是这个 POST 就直接失败，前端拿到 `TypeError: network error`。
 *
 * 而 GET 是幂等的，浏览器遇到断掉的连接会自己重试到新连接上。
 * 所以先发一个廉价的 GET 让连接焕然一新，后面的 POST 就稳了。
 *
 * 这一步失败也无所谓——它只是暖连接，正式请求仍会照常发起并自己重试。
 */
export async function primeConnection(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    await fetch('/api/health?prime=1', { method: 'GET', cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
  } catch {
    // 暖连接失败不影响主流程
  }
}

/**
 * 发起一次 SSE 请求并读完。
 *
 * 「一个字都没收到就重试」是有意为之：
 *   - 完全没收到 → 多半是连接被掐断，重试一次大概率能成；
 *   - 已经收到一部分 → 重试会产生两份内容，反而更糟，直接把已有的部分和错误一起显示出来。
 *
 * 实测 Cloudflare 的 HTTP/2 链路会**间歇性**把长连接掐掉（服务端还在好好发心跳，
 * 客户端这边直接 network error），掐掉的概率不低。所以默认给 3 次机会，
 * 而且每次重试前都重新暖一次连接——立刻重试很可能还落在同一条坏连接上。
 */
export async function fetchSseText(opts: SseFetchOptions): Promise<string> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);

  for (let attempt = 1; ; attempt++) {
    // 先暖连接，避免这个 POST 落在已被关闭的连接上
    await primeConnection();

    let res: Response;
    try {
      res = await opts.doFetch();
    } catch (e) {
      // fetch 本身失败（连接被掐在响应头之前）
      if (attempt >= maxAttempts) throw e;
      opts.onRetry?.(attempt, maxAttempts - 1, e instanceof Error ? e.message : '连接失败');
      await sleep(RETRY_BACKOFF_MS);
      continue;
    }

    if (!res.ok) {
      // 非 2xx 是明确的失败（限流 / 没配 Key / 网关错误），不重试
      throw new Error(await describeHttpError(res));
    }

    let received = 0;
    try {
      return await readSseText(res, (full) => {
        received = full.length;
        opts.onDelta(full);
      });
    } catch (e) {
      const isStreamError = e instanceof SseStreamError;
      if (!isStreamError || received > 0 || attempt >= maxAttempts) throw e;

      const reason = e.describe();
      opts.onRetry?.(attempt, maxAttempts - 1, reason);
      // 退一下再试：立刻重试很可能还落在同一条坏连接上
      await sleep(RETRY_BACKOFF_MS);
    }
  }
}
