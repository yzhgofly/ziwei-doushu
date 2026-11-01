/**
 * SSE 输出helper —— 对齐前端 components/ChatPanel.tsx / InsightPanel.tsx 的解析约定：
 *
 *   data: {"delta":{"text":"..."}}   ← 一段增量文本
 *   data: [DONE]                    ← 结束
 *
 * 前端是按行 split('\n') 后判断 line.startsWith('data: ') 的，
 * 所以每个事件必须独占一行，事件之间用空行分隔。
 */

import { sanitizeChinese } from './sanitize';

const encoder = new TextEncoder();

export function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    // 关掉 nginx 之类的缓冲，否则增量会被攒成一坨
    'X-Accel-Buffering': 'no',
  };
}

export function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export const SSE_DONE = 'data: [DONE]\n\n';

/**
 * SSE 注释行（心跳）。
 * 前端按 line.startsWith('data: ') 过滤，注释行会被直接跳过，不影响解析。
 */
export const SSE_KEEPALIVE = ': open\n\n';

/**
 * 开流后立刻发的「已受理」事件。
 *
 * 只发注释心跳有个隐患：有些中间件（CDN、代理、浏览器的 HTTP/2 层）
 * 只把**真正的内容**当作「响应已经开始」，注释行不算。
 * 于是响应头迟迟不推给客户端，边缘节点在到达超时点时直接掐断连接，
 * 前端拿到的是 `TypeError: network error`——一个字都没有，也不知道发生了什么。
 *
 * 补一个真正的 data 事件，响应才算明确开始，前端也能立刻知道「请求收到了」。
 * 前端会忽略没有 delta / error 字段的事件，所以不影响正文解析。
 */
export const SSE_STATUS_ACCEPTED = 'accepted';

/**
 * 生成期间的心跳状态事件。
 *
 * 注释行（`: open`）有些中间件不认，只发注释的话连接在它们眼里可能一直是「空的」，
 * 于是到超时点直接掐断。所以心跳同时发一个真正的 data 事件：
 * 连接上每 10 秒就有一次真实内容，任何一层都不会误判。
 * 前端会忽略没有 delta / error 字段的事件。
 */
export const SSE_STATUS_WAITING = 'waiting';

/**
 * 心跳间隔（毫秒）。
 *
 * **不要调回 10 秒。**实测浏览器（Chromium / Electron）在「响应头已到、但正文迟迟不来」
 * 时，大约 5 秒没有收到任何响应体数据就会把连接掐掉，表现为前端拿到
 * `TypeError: network error`——服务端明明还在好好地发心跳。
 *
 * 带 thinking 的模型首字可能几十秒才来（实测长 prompt 首字 >50 秒），
 * 所以心跳必须明显短于这个阈值。2.5 秒一次，每次几十字节，代价可以忽略。
 */
export const SSE_KEEPALIVE_INTERVAL_MS = 2_500;

/**
 * 把一个「逐段吐文本」的异步生成器包装成 SSE 响应体。
 * 客户端断开时触发 onCancel（用来中止上游模型请求）。
 */
export function createSseStream(
  gen: AsyncGenerator<string>,
  onCancel?: () => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // 先吐一行注释心跳，把响应头立刻推出去。
      // 否则经过 CDN / 反向代理时，边缘节点要等到第一段正文才认为「有响应」——
      // 带 thinking 的模型思考 30~90 秒，Cloudflare 会直接甩一个 524 超时页。
      try {
        controller.enqueue(encoder.encode(SSE_KEEPALIVE));
        // 再补一个真正的 data 事件：光有注释行，有些中间件不认「响应已经开始」，
        // 会在超时点直接掐断连接，前端只看到一个没有解释的 network error。
        controller.enqueue(encoder.encode(sseEvent({ status: SSE_STATUS_ACCEPTED })));
      } catch { /* 流已关闭 */ }

      // 生成期间也要周期性心跳。
      // 模型思考 + 出字之间可能一两分钟没有任何数据流动，
      // 边缘节点（Cloudflare 等）有「空闲超时」，会把这种没数据的流直接掐掉：
      // cloudflared 日志里表现为 "stream canceled by remote with error code 0"，
      // 客户端拿到的是空响应。定时喂一行注释注释就能让连接保持活着。
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(SSE_KEEPALIVE));
          // 同时补一个真正的 data 事件：注释行有些中间件不认，
          // 只发注释的话它们可能在超时点直接掐断连接。
          controller.enqueue(encoder.encode(sseEvent({ status: SSE_STATUS_WAITING })));
        } catch { /* 流已关闭 */ }
      }, SSE_KEEPALIVE_INTERVAL_MS);

      try {
        for await (const raw of gen) {
          if (!raw) continue;
          // 净化：去掉模型偶尔混进来的英文单词（分段净化不影响结果——
          // 一个被切断的英文词，两半都会被各自删掉）
          const text = sanitizeChinese(raw);
          if (!text) continue;
          controller.enqueue(encoder.encode(sseEvent({ delta: { text } })));
        }
        controller.enqueue(encoder.encode(SSE_DONE));
      } catch (err) {
        const message = err instanceof Error ? err.message : '解读失败';
        try {
          controller.enqueue(encoder.encode(sseEvent({ error: message })));
          controller.enqueue(encoder.encode(SSE_DONE));
        } catch { /* 流已关闭 */ }
      } finally {
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* 已关闭 */ }
      }
    },
    cancel() {
      onCancel?.();
    },
  });
}
