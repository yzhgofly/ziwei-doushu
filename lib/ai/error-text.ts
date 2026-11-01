/**
 * 把接口失败翻译成一句能看懂的中文。
 *
 * 之前所有失败都只显示「解读失败，请检查API配置或稍后重试」，
 * 出问题时完全看不出到底是限流、没配 Key、还是被网关挡了。
 * 这里把状态码和服务端返回的 JSON 里的 error 字段原样带出来。
 */

/**
 * 把状态码 + 响应体整理成一句能看懂的中文。
 *
 * fetch 通道和 XHR 通道都要用，所以单独抽出来，
 * 保证两条通道给用户看到的文案完全一致。
 */
export function formatHttpError(status: number, statusText: string, body: string): string {
  let detail = '';
  try {
    detail = (body ?? '').slice(0, 500);
  } catch {
    detail = '';
  }

  let serverMsg = '';
  if (detail) {
    try {
      const parsed = JSON.parse(detail);
      serverMsg = parsed?.error ?? parsed?.message ?? '';
      if (typeof serverMsg !== 'string') serverMsg = '';
    } catch {
      // 不是 JSON（例如网关返回的 HTML 错误页），只留一小段纯文本
      serverMsg = detail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    }
  }

  const prefix = `HTTP ${status}`;
  if (serverMsg) return `${prefix}：${serverMsg}`;
  return `${prefix}（${statusText || '请求失败'}）`;
}

/** 从失败的响应里读出最有用的那一句原因 */
export async function describeHttpError(res: Response): Promise<string> {
  let body = '';
  try {
    body = await res.text();
  } catch {
    body = '';
  }
  return formatHttpError(res.status, res.statusText, body);
}

/** SSE 流里服务端发来的 error 事件 */
export function describeStreamError(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const e = (payload as { error?: unknown }).error;
    if (typeof e === 'string' && e.trim()) return e.trim();
  }
  return '解读过程中断';
}
