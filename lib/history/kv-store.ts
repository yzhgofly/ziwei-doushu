/**
 * 云备份的 KV 抽象
 *
 * 支持三种后端，按优先级挑第一个可用的：
 *   1. **Cloudflare KV 绑定**（Pages Functions）：`env.HISTORY_KV`
 *   2. **Upstash REST 接口**（Vercel KV 等）：`env.KV_REST_API_URL` + `env.KV_REST_API_TOKEN`
 *   3. **Cloudflare KV REST 接口**：`env.CF_ACCOUNT_ID` + `env.CF_KV_NAMESPACE_ID` + `env.CF_API_TOKEN`
 *
 * 三个后端都只当「字符串存取」用，看不出里面是明文还是密文——
 * 本项目存进去的**永远是密文**，服务端不需要、也拿不到解密所需的同步码。
 */

export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

interface CloudflareKvBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export type EnvBag = Record<string, string | undefined>;

/** Upstash 风格 REST 的返回格式 */
interface RestResult<T> {
  result?: T | { result?: T };
  error?: string;
}

function unwrapRest<T>(body: RestResult<T>): T | null {
  const r = body?.result;
  if (r && typeof r === 'object' && 'result' in (r as Record<string, unknown>)) {
    return (r as { result: T }).result;
  }
  return (r as T) ?? null;
}

/** 从环境变量里找出可用的 KV 后端；没有就返回 null */
export function getKvStore(env: EnvBag): KvStore | null {
  // 1) Cloudflare KV 绑定
  const binding = (env as Record<string, unknown>).HISTORY_KV as CloudflareKvBinding | undefined;
  if (binding && typeof binding.get === 'function' && typeof binding.put === 'function') {
    return {
      get: (key) => binding.get(key),
      put: (key, value) => binding.put(key, value),
      del: (key) => binding.delete(key),
    };
  }

  // 2) Upstash / Vercel KV 的 REST 接口
  const url = (env.KV_REST_API_URL || '').replace(/\/+$/, '');
  const token = env.KV_REST_API_TOKEN;
  if (url && token) {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(`${url}${path}`, { ...init, headers });
      const body = await res.json().catch(() => ({} as RestResult<T>));
      if (!res.ok) {
        const err = (body as RestResult<T>)?.error;
        throw new Error(err || `KV 请求失败（HTTP ${res.status}）`);
      }
      return unwrapRest<T>(body) as T;
    };
    return {
      get: async (key) => {
        const v = await call<string | null>(`/get/${encodeURIComponent(key)}`);
        return typeof v === 'string' ? v : null;
      },
      put: async (key, value) => {
        await call<string>(`/set/${encodeURIComponent(key)}`, {
          method: 'POST',
          body: JSON.stringify(value),
        });
      },
      del: async (key) => {
        await call<number>(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
      },
    };
  }

  // 3) Cloudflare KV 的 REST 接口（不依赖运行时绑定，Pages / Vercel 都能用）
  const cfAccount = env.CF_ACCOUNT_ID;
  const cfNamespace = env.CF_KV_NAMESPACE_ID;
  const cfToken = env.CF_API_TOKEN;
  if (cfAccount && cfNamespace && cfToken) {
    const base = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}`
      + `/storage/kv/namespaces/${cfNamespace}/values`;
    const headers = { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'text/plain' };
    return {
      get: async (key) => {
        const res = await fetch(`${base}/${encodeURIComponent(key)}`, { headers });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`KV 读取失败（HTTP ${res.status}）`);
        return await res.text();
      },
      put: async (key, value) => {
        const res = await fetch(`${base}/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers,
          body: value,
        });
        if (!res.ok) throw new Error(`KV 写入失败（HTTP ${res.status}）`);
      },
      del: async (key) => {
        const res = await fetch(`${base}/${encodeURIComponent(key)}`, { method: 'DELETE', headers });
        if (!res.ok && res.status !== 404) throw new Error(`KV 删除失败（HTTP ${res.status}）`);
      },
    };
  }

  return null;
}
