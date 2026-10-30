/**
 * 回归：公网暴露防护（lib/ai/guard.ts）—— 不联网。
 *
 * 这道闸是「把站点开到公网」这件事的安全底线：
 *   单 IP 滑动窗口限流 + 全局并发上限 + 每日配额。
 * 任何一条失效，拿到链接的人就能把 API Key 的额度烧光。
 */
import {
  DEFAULT_GUARD_OPTIONS,
  RequestGuard,
  resolveClientKey,
  resolveGuardOptions,
  withRelease,
} from '../../lib/ai/guard';

let fails = 0;
function ok(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) fails++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ─── 1) 配置解析 ───
const defaults = resolveGuardOptions({});
ok('默认限流窗口 60 秒', defaults.windowMs === 60_000);
ok('默认单来源每分钟 20 次', defaults.maxPerWindow === 20);
ok('默认全局并发 3', defaults.maxConcurrent === 3);
ok('默认日配额 500 次', defaults.dailyCap === 500);

const custom = resolveGuardOptions({
  AI_RATE_LIMIT_WINDOW_MS: '5000',
  AI_RATE_LIMIT_PER_WINDOW: '3',
  AI_MAX_CONCURRENT: '1',
  AI_DAILY_REQUEST_CAP: '10',
});
ok('环境变量覆盖限流窗口', custom.windowMs === 5000);
ok('环境变量覆盖单窗口次数', custom.maxPerWindow === 3);
ok('环境变量覆盖并发上限', custom.maxConcurrent === 1);
ok('环境变量覆盖日配额', custom.dailyCap === 10);

ok('非法数值回落到默认值', resolveGuardOptions({ AI_MAX_CONCURRENT: 'abc' }).maxConcurrent === 3);
ok('零并发被抬到 1（不能把站点锁死）', resolveGuardOptions({ AI_MAX_CONCURRENT: '0' }).maxConcurrent === 1);
ok('日配额 0 表示不限', resolveGuardOptions({ AI_DAILY_REQUEST_CAP: '0' }).dailyCap === 0);
ok('默认配置常量与解析结果一致', eq(resolveGuardOptions({}), DEFAULT_GUARD_OPTIONS));

// ─── 2) 单 IP 滑动窗口限流 ───
{
  const guard = new RequestGuard({ windowMs: 60_000, maxPerWindow: 3, maxConcurrent: 10, dailyCap: 0 });
  const a = guard.check('1.1.1.1');
  const b = guard.check('1.1.1.1');
  const c = guard.check('1.1.1.1');
  const d = guard.check('1.1.1.1');
  ok('同一来源第 1 次放行', a.ok);
  ok('同一来源第 2 次放行', b.ok);
  ok('同一来源第 3 次放行', c.ok);
  ok('同一来源第 4 次被拒', !d.ok);
  if (!d.ok) {
    ok('超限返回 429', d.status === 429);
    ok('超限提示里带秒数', /秒后再试/.test(d.error));
    ok('超限带 Retry-After 语义', d.retryAfterMs > 0);
  }
  ok('另一个来源不受影响', guard.check('2.2.2.2').ok);
}

{
  // 窗口滑出后恢复
  const guard = new RequestGuard({ windowMs: 10_000, maxPerWindow: 1, maxConcurrent: 10, dailyCap: 0 });
  const t0 = 1_000_000;
  ok('窗口内第一次放行', guard.check('ip', t0).ok);
  ok('窗口内第二次被拒', !guard.check('ip', t0 + 1_000).ok);
  ok('窗口过后恢复放行', guard.check('ip', t0 + 11_000).ok);
}

// ─── 3) 全局并发上限 ───
{
  const guard = new RequestGuard({ windowMs: 60_000, maxPerWindow: 100, maxConcurrent: 2, dailyCap: 0 });
  const a = guard.check('1.1.1.1');
  const b = guard.check('2.2.2.2');
  const c = guard.check('3.3.3.3');
  ok('并发 1 放行', a.ok);
  ok('并发 2 放行', b.ok);
  ok('超出并发被拒', !c.ok);
  if (!c.ok) ok('并发超限返回 429', c.status === 429);
  if (a.ok) a.release();
  ok('释放后可以再进一个', guard.check('4.4.4.4').ok);
  if (b.ok) b.release();
  if (a.ok) {
    ok('释放是幂等的', (() => { a.release(); a.release(); return true; })());
  }
  ok('释放后并发数不越界', guard.stats().concurrent === 1);
}

// ─── 4) 每日配额 ───
{
  const guard = new RequestGuard({ windowMs: 60_000, maxPerWindow: 100, maxConcurrent: 10, dailyCap: 3 });
  ok('配额内第 1 次放行', guard.check('ip').ok);
  ok('配额内第 2 次放行', guard.check('ip').ok);
  ok('配额内第 3 次放行', guard.check('ip').ok);
  const over = guard.check('ip');
  ok('超出日配额被拒', !over.ok);
  if (!over.ok) {
    ok('日配额超限返回 429', over.status === 429);
    ok('日配额提示带上限数字', /上限/.test(over.error));
  }
  ok('不同来源也受全局日配额约束', !guard.check('other-ip').ok);
}

{
  // 跨天自动重置
  const guard = new RequestGuard({ windowMs: 60_000, maxPerWindow: 100, maxConcurrent: 10, dailyCap: 1 });
  const day1 = new Date('2026-01-01T10:00:00Z').getTime();
  ok('当天第 1 次放行', guard.check('ip', day1).ok);
  ok('当天第 2 次被日配额拦住', !guard.check('ip', day1 + 1000).ok);
  const day2 = new Date('2026-01-02T10:00:00Z').getTime();
  ok('第二天配额重置', guard.check('ip', day2).ok);
}

// ─── 5) 调用方 IP 识别 ───
{
  const mk = (headers: Record<string, string>) =>
    new Request('http://x/api/interpret', { headers });

  ok('优先用 cf-connecting-ip', resolveClientKey(mk({ 'cf-connecting-ip': '9.9.9.9' })) === '9.9.9.9');
  ok('x-forwarded-for 取最后一段（代理追加的那段）',
    resolveClientKey(mk({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' })) === '3.3.3.3');
  ok('x-real-ip 作为后备', resolveClientKey(mk({ 'x-real-ip': '5.5.5.5' })) === '5.5.5.5');
  ok('取不到 IP 时退化成一个公共桶', resolveClientKey(mk({})) === 'local');
  ok('IPv6 方括号被剥掉', resolveClientKey(mk({ 'x-real-ip': '[2001:db8::1]' })) === '2001:db8::1');
  ok('超长伪造头不会进 map', resolveClientKey(mk({ 'x-real-ip': 'x'.repeat(200) })) === 'local');
}

// ─── 6) 并发名额一定会被释放 ───
const pending: Promise<void>[] = [];

{
  const guard = new RequestGuard({ windowMs: 60_000, maxPerWindow: 100, maxConcurrent: 1, dailyCap: 0 });
  const verdict = guard.check('ip');
  ok('拿到许可', verdict.ok);
  let released = 0;
  if (verdict.ok) {
    const gen = withRelease(
      (async function* () {
        yield 'a';
        yield 'b';
      })(),
      () => { released++; verdict.release(); }
    );
    pending.push((async () => {
      for await (const _ of gen) { /* 正常消费 */ }
    })().then(() => {
      ok('流正常结束会释放名额', released === 1);
      ok('释放后并发数归零', guard.stats().concurrent === 0);
    }));
  }
}

{
  // 生成器抛错时也要释放
  const guard = new RequestGuard({ windowMs: 60_000, maxPerWindow: 100, maxConcurrent: 1, dailyCap: 0 });
  const verdict = guard.check('ip');
  let released = 0;
  if (verdict.ok) {
    const gen = withRelease(
      (async function* () {
        yield 'a';
        throw new Error('boom');
      })(),
      () => { released++; verdict.release(); }
    );
    pending.push((async () => {
      try { for await (const _ of gen) { /* ignore */ } } catch { /* 预期 */ }
    })().then(() => {
      ok('流出错也会释放名额', released === 1);
      ok('出错后并发数归零', guard.stats().concurrent === 0);
    }));
  }
}

// 顶层 await 在 tsx 的 cjs 输出模式下不支持，用 Promise 链收尾
Promise.all(pending).then(() => {
  if (fails > 0) {
    console.error(`\n✗ ai-guard 回归失败：${fails} 项`);
    process.exit(1);
  }
  console.log('\n✓ ai-guard 回归全部通过');
});