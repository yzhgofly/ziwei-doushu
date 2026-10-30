/**
 * 把接口失败翻译成一句能看懂的中文。
 *
 * 之前所有失败都只显示「解读失败，请检查API配置或稍后重试」，
 * 出问题时完全看不出到底是限流、没配 Key、还是被网关挡了。
 * 这里把状态码和服务端返回的 JSON 里的 error 字段原样带出来。
 */

/** 从失败的响应里读出最有用的那一句原因 */
export async function describeHttpError(res: Response): Promise<string> {
  const status = res.status;
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 500);
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
  return `${prefix}（${res.statusText || '请求失败'}）`;
}

/** SSE 流里服务端发来的 error 事件 */
export function describeStreamError(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const e = (payload as { error?: unknown }).error;
    if (typeof e === 'string' && e.trim()) return e.trim();
  }
  return '解读过程中断';
}
