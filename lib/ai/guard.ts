/**
 * 公网暴露防护 —— 限流 / 并发 / 日配额
 *
 * 排盘本身不需要 API Key，纯浏览器本地算；但 AI 解读要打模型，一样要花钱。
 * 一旦把站点开到公网，任何拿到链接的人都能调 /api/interpret 和 /api/heming
 * 消耗 API Key 的额度。所以这两个路由上线前必须先过一道闸：
 *
 *   1. 单 IP 滑动窗口限流   —— 挡住脚本化连续刷
 *   2. 全局并发上限         —— 挡住「同时开 50 个标签页」
 *   3. 全局每日配额         —— 兜底：最多消耗 N 次模型调用/天
 *
 * 三条都用环境变量可调（见 resolveGuardOptions），本机自用可以把上限调高。
 * 这个模块不 import 任何 server-only 依赖，可以直接被 tsx 跑单测。
 */

export interface GuardOptions {
  /** 滑动窗口长度（毫秒） */
  windowMs: number;
  /** 单个来源在窗口内最多放行几次 */
  maxPerWindow: number;
  /** 全局同时进行的模型调用数上限 */
  maxConcurrent: number;
  /** 全局每日最多放行多少次；<=0 表示不限 */
  dailyCap: number;
}

export const DEFAULT_GUARD_OPTIONS: GuardOptions = {
  windowMs: 60_000,
  // 一个人正常逛一个盘面就会连打十几次：
  //   每次打开 /chart 自动生成一次命格总览 + 每点一个宫位一次 + 每点一个四化一次。
  // 原来的 6 次/分，普通用户很容易撞上限然后以为「解读坏了」。
  maxPerWindow: 20,
  // 前端按钮在请求中会禁用，单用户同时只有 1 个在飞；
  // 这里留 3 个并发给「同时开两个标签页」的情况。
  maxConcurrent: 3,
  // 全站每天的模型调用上限（成本天花板）。
  // 60 太紧：这一条是**全站共享**的，站点自己做的实测就会把用户的额度吃光。
  dailyCap: 500,
};

function toInt(v: string | undefined, fallback: number): number {
  if (v === undefined || v === null || v.trim() === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

/** 解析防护参数。环境变量缺失时用保守默认值。 */
export function resolveGuardOptions(env: Record<string, string | undefined> = process.env): GuardOptions {
  return {
    windowMs: Math.max(1_000, toInt(env.AI_RATE_LIMIT_WINDOW_MS, DEFAULT_GUARD_OPTIONS.windowMs)),
    maxPerWindow: Math.max(1, toInt(env.AI_RATE_LIMIT_PER_WINDOW, DEFAULT_GUARD_OPTIONS.maxPerWindow)),
    maxConcurrent: Math.max(1, toInt(env.AI_MAX_CONCURRENT, DEFAULT_GUARD_OPTIONS.maxConcurrent)),
    // 0 表示不设日配额（每天 0 次等于全站不可用，所以这里特判成「不限」）
    dailyCap: toInt(env.AI_DAILY_REQUEST_CAP, DEFAULT_GUARD_OPTIONS.dailyCap),
  };
}

export type GuardVerdict =
  | { ok: true; release: () => void }
  | { ok: false; status: number; error: string; retryAfterMs: number };

/**
 * 滑动窗口限流器 + 并发计数 + 日配额。
 * 纯内存实现：进程重启即重置（本机自用场景足够，且重启本来就会清掉异常状态）。
 */
export class RequestGuard {
  private readonly windows = new Map<string, number[]>();
  private concurrent = 0;
  private dayCount = 0;
  private dayStamp = 0;

  constructor(private options: GuardOptions = DEFAULT_GUARD_OPTIONS) {}

  private rollDay(now: number): void {
    const d = new Date(now);
    const stamp = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    if (stamp !== this.dayStamp) {
      this.dayStamp = stamp;
      this.dayCount = 0;
    }
  }

  /** 清掉窗口内已经没有记录的老 key，避免长时间运行后 Map 无限增长 */
  private sweep(now: number): void {
    if (this.windows.size < 512) return;
    for (const [key, hits] of this.windows) {
      if (hits.length === 0 || now - hits[0] > this.options.windowMs) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * 申请一次调用许可。
   * 通过时返回 release()，调用方必须在请求结束时（成功、出错、客户端断开）调用它。
   */
  check(key: string, now: number = Date.now()): GuardVerdict {
    this.rollDay(now);

    if (this.options.dailyCap > 0 && this.dayCount >= this.options.dailyCap) {
      return {
        ok: false,
        status: 429,
        error: `今日 AI 解读次数已达上限（${this.options.dailyCap} 次），明天再来`,
        retryAfterMs: 60_000,
      };
    }

    if (this.concurrent >= this.options.maxConcurrent) {
      return {
        ok: false,
        status: 429,
        error: '当前解读请求过多，请等前面的解读完成再试',
        retryAfterMs: 5_000,
      };
    }

    const hits = (this.windows.get(key) ?? []).filter(t => now - t < this.options.windowMs);
    if (hits.length >= this.options.maxPerWindow) {
      const retryAfterMs = Math.max(1_000, hits[0] + this.options.windowMs - now);
      this.windows.set(key, hits);
      return {
        ok: false,
        status: 429,
        error: `请求太频繁，请 ${Math.ceil(retryAfterMs / 1000)} 秒后再试`,
        retryAfterMs,
      };
    }

    hits.push(now);
    this.windows.set(key, hits);
    this.sweep(now);

    this.dayCount += 1;
    this.concurrent += 1;

    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        if (this.concurrent > 0) this.concurrent -= 1;
      },
    };
  }

  /** 只读状态，给 /api/health 之类的诊断用 */
  stats(): { concurrent: number; dayCount: number; trackedKeys: number } {
    return {
      concurrent: this.concurrent,
      dayCount: this.dayCount,
      trackedKeys: this.windows.size,
    };
  }
}

let singleton: RequestGuard | null = null;
let singletonOptions: GuardOptions | null = null;

/** 全进程共用一个限流器（两个路由要共享计数和日配额） */
export function getRequestGuard(env: Record<string, string | undefined> = process.env): RequestGuard {
  const opts = resolveGuardOptions(env);
  if (!singleton) {
    singleton = new RequestGuard(opts);
    singletonOptions = opts;
  } else if (
    singletonOptions &&
    (singletonOptions.windowMs !== opts.windowMs ||
      singletonOptions.maxPerWindow !== opts.maxPerWindow ||
      singletonOptions.maxConcurrent !== opts.maxConcurrent ||
      singletonOptions.dailyCap !== opts.dailyCap)
  ) {
    // 环境变量热更新后重建（例如改了 .env.local 重启了进程）
    singleton = new RequestGuard(opts);
    singletonOptions = opts;
  }
  return singleton;
}

/**
 * 取调用方 IP。
 * 反向代理（cloudflared / localhost.run / nginx）都会带上真实 IP：
 *   cf-connecting-ip  → Cloudflare 隧道
 *   x-forwarded-for   → 通用代理（取最后一段，代理会把自己看到的那段追加在末尾）
 *   x-real-ip         → nginx 默认
 * 拿不到就退化成 'local'，等于所有人共用一个桶（偏保守，安全）。
 */
export function resolveClientKey(request: Request): string {
  const headers = request.headers;
  const cf = headers.get('cf-connecting-ip');
  if (cf) return normalizeIp(cf);

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return normalizeIp(parts[parts.length - 1]);
  }

  const real = headers.get('x-real-ip');
  if (real) return normalizeIp(real);

  return 'local';
}

function normalizeIp(ip: string): string {
  // 去掉端口和 IPv6 的方括号
  const cleaned = ip.trim().replace(/^\[|\]$/g, '');
  if (!cleaned) return 'local';
  return cleaned.length > 64 ? 'local' : cleaned;
}

/** 给流式生成器套一层，保证结束/出错/断连时都会释放并发名额 */
export function withRelease<T>(gen: AsyncGenerator<T>, release: () => void): AsyncGenerator<T> {
  return (async function* wrapped() {
    try {
      yield* gen;
    } finally {
      release();
    }
  })();
}
