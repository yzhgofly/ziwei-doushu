/**
 * 回归：AI 错误可见化（lib/ai/error-text.ts + 三个前端调用点）—— 不联网。
 *
 * 背景：用户报「命理解读失败」，但前端把一切都吞成一句
 * 「解读失败，请检查 API 配置或稍后重试」，出问题时完全看不出真实原因
 * （限流 429 / 没配 Key 500 / 网关 502 / 被登录保护拦截 401……）。
 *
 * 这道回归锁两件事：
 *   1. describeHttpError / describeStreamError 能把真实原因挖出来；
 *   2. 三个前端调用点确实调用了它们，而不是继续吞掉。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describeHttpError, describeStreamError } from '../../lib/ai/error-text';
import { readSseText, fetchSseText, SseStreamError } from '../../lib/ai/client-stream';

let fails = 0;
function ok(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) fails++;
}

const ROOT = process.cwd();

const jsonRes = (body: unknown, status = 500) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function main() {
  // ─── 1) describeHttpError：JSON 里的 error / message ───
  const r1 = await describeHttpError(jsonRes({ error: '请求过于频繁，请稍后再试' }, 429));
  ok('429 带出状态码', r1.includes('429'));
  ok('429 带出服务端文案', r1.includes('请求过于频繁'));

  const r2 = await describeHttpError(jsonRes({ error: 'AI 解读未配置：缺少 AI_API_KEY' }, 500));
  ok('500 带出未配 Key 的原因', r2.includes('500') && r2.includes('AI_API_KEY'));

  const r3 = await describeHttpError(jsonRes({ message: '命盘数据无效或缺失' }, 400));
  ok('message 字段也被读出', r3.includes('命盘数据无效或缺失'));

  ok('错误文案里不带英文 JSON 噪音', !r1.includes('{') && !r1.includes('"error"'));

  // ─── 2) describeHttpError：非 JSON（网关 HTML 错误页）──
  const htmlRes = new Response('<html><head><title>502</title></head><body>Bad Gateway</body></html>', {
    status: 502,
    headers: { 'content-type': 'text/html' },
  });
  const r4 = await describeHttpError(htmlRes);
  ok('HTML 错误页剥掉标签', !r4.includes('<') && !r4.includes('>'));
  ok('HTML 错误页仍带状态码', r4.includes('502'));
  ok('HTML 错误页能看出是网关问题', r4.includes('Bad Gateway'));

  // ─── 3) describeHttpError：空 body ───
  const r5 = await describeHttpError(new Response(null, { status: 403, statusText: 'Forbidden' }));
  ok('空 body 也能给出状态码', r5.includes('403'));
  ok('空 body 有兜底文案', r5.length > 5);

  // ─── 4) describeStreamError ───
  ok('SSE error 事件带出原文', describeStreamError({ error: '模型请求超时（60000ms）' }).includes('超时'));
  ok('SSE error 事件非字符串被忽略', describeStreamError({ error: { code: 1 } }) === '解读过程中断');
  ok('SSE 无 error 字段有兜底', describeStreamError({ delta: { text: 'x' } }) === '解读过程中断');
  ok('SSE 载荷为 null 有兜底', describeStreamError(null) === '解读过程中断');

  // ─── 5) 三个前端调用点确实用了错误可见化，而不是继续吞 ───
  const FRONTEND = [
    { file: 'components/ChatPanel.tsx', label: '聊天面板' },
    { file: 'components/InsightPanel.tsx', label: '解读面板' },
    { file: 'app/heming/page.tsx', label: '合盘页' },
  ];

  for (const { file, label } of FRONTEND) {
    const path = join(ROOT, file);
    if (!existsSync(path)) {
      ok(`${label} 存在（${file}）`, false);
      continue;
    }
    const src = readFileSync(path, 'utf8');
    ok(`${label} 引入了共用的流读取器`, src.includes("from '@/lib/ai/client-stream'"));
    ok(`${label} 用 fetchSseText 读流`, src.includes('fetchSseText({'));
    ok(`${label} 不再自己手写 fetch 分片解析`, !src.includes("chunk.split('\\n')"));
    ok(`${label} 不再把错误直接 throw 成空 Error`, !/throw new Error\(\s*\)\s*;/.test(src));
  }

  // ─── 5b) 共用流读取器：真的把原因挖出来了 ───
  {
    const src = readFileSync(join(ROOT, 'lib/ai/client-stream.ts'), 'utf8');
    ok('流读取器遇到非 2xx 会调用 describeHttpError', src.includes('describeHttpError(res)'));
    ok('流读取器会抛出服务端报的 error 事件', src.includes('describeStreamError(parsed)'));
    ok('流读取器带现场诊断信息（字数 / 耗时 / 包数）', src.includes('elapsedMs') && src.includes('chunks'));
    ok('流读取器一个字节都没收到时会重试', src.includes('received > 0'));
  }

  // ─── 6) 合盘页必须展示真实原因，而不是固定文案 ───
  {
    const src = readFileSync(join(ROOT, 'app/heming/page.tsx'), 'utf8');
    ok('合盘页的错误态是字符串（能装下真实原因）', /useState<string \| null>\(null\)/.test(src));
    ok('合盘页不再显示「分析暂时不可用」这种无信息文案', !src.includes('分析暂时不可用'));
  }

  // ─── 7) 诊断接口：出问题时能自己查到现场，而不是靠猜 ───
  {
    const handlerPath = join(ROOT, 'lib/ai/handlers.ts');
    ok('共享 handler 里有 handleHealth', readFileSync(handlerPath, 'utf8').includes('export async function handleHealth'));
    ok('Next 路由存在（/api/health）', existsSync(join(ROOT, 'app/api/health/route.ts')));
    ok('Pages Function 存在（/api/health）', existsSync(join(ROOT, 'functions-src/api/health.ts')));

    const handlerSrc = readFileSync(handlerPath, 'utf8');
    // 诊断接口绝不能把 Key 吐出去
    const healthBlock = handlerSrc.slice(handlerSrc.indexOf('export async function handleHealth'));
    ok('诊断接口不返回 apiKey', !healthBlock.includes('apiKey:'));
    ok('诊断接口只返回配置摘要', healthBlock.includes('describeAiConfig'));
    ok('诊断接口带防护闸实时用量', healthBlock.includes('guard.stats()'));
    ok('诊断接口支持 probe 真打一次模型', healthBlock.includes('probeModel'));
  }

  // ─── 8) 流读取器的实际行为（构造假的 Response 来跑）───
  {
    const enc = new TextEncoder();
    /** 造一个按给定分片吐数据的 SSE 响应；failAfter=true 表示吐完就断流 */
    const sseRes = (chunks: string[], failAfter = false) => {
      let i = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < chunks.length) {
            controller.enqueue(enc.encode(chunks[i++]));
            return;
          }
          if (failAfter) controller.error(new TypeError('network error'));
          else controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    };

    // 分片边界：一行 SSE 被切成两个包，内容不能丢
    {
      let out = '';
      await readSseText(
        sseRes(['data: {"delta":{"text":"你', '好"}}\n\ndata: [DONE]\n\n']),
        (full) => { out = full; },
      );
      ok('SSE 行被网络包切开时内容不丢', out === '你好');
    }

    // 注释心跳行被跳过
    {
      let out = '';
      await readSseText(
        sseRes([': open\n\n', 'data: {"delta":{"text":"甲"}}\n\n', 'data: [DONE]\n\n']),
        (full) => { out = full; },
      );
      ok('注释心跳行被跳过', out === '甲');
    }

    // 服务端的状态事件被忽略
    {
      let out = '';
      await readSseText(
        sseRes(['data: {"status":"accepted"}\n\n', 'data: {"delta":{"text":"乙"}}\n\n']),
        (full) => { out = full; },
      );
      ok('服务端状态事件被忽略', out === '乙');
    }

    // 服务端 error 事件要抛出来
    {
      let threw = '';
      try {
        await readSseText(sseRes(['data: {"error":"模型请求超时"}\n\n']), () => {});
      } catch (e) {
        threw = e instanceof Error ? e.message : '';
      }
      ok('服务端 error 事件抛出原文', threw.includes('模型请求超时'));
    }

    // 读到一半断流 → 带现场信息
    {
      let err: any = null;
      try {
        await readSseText(sseRes(['data: {"delta":{"text":"一二三"}}\n\n'], true), () => {});
      } catch (e) {
        err = e;
      }
      ok('断流抛出的是 SseStreamError', err instanceof SseStreamError);
      if (err instanceof SseStreamError) {
        ok('断流错误带已收字数', err.received === 3);
        ok('断流错误带耗时', err.elapsedMs >= 0);
        ok('断流错误文案带现场信息', /连接中断/.test(err.describe()));
      }
    }

    // 一个字节都没收到 → 自动重试一次
    {
      let calls = 0;
      let out = '';
      await fetchSseText({
        doFetch: async () => {
          calls++;
          return calls === 1
            ? sseRes([], true)                       // 第一次：直接断流
            : sseRes(['data: {"delta":{"text":"重试成功"}}\n\n', 'data: [DONE]\n\n']);
        },
        onDelta: (full) => { out = full; },
      });
      ok('一个字都没收到时会自动重试一次', calls === 2);
      ok('重试后能拿到正文', out === '重试成功');
    }

    // 已经收到正文后断流 → 不重试（避免出现两份内容）
    {
      let calls = 0;
      let err: any = null;
      try {
        await fetchSseText({
          doFetch: async () => {
            calls++;
            return sseRes(['data: {"delta":{"text":"已有正文"}}\n\n'], true);
          },
          onDelta: () => {},
        });
      } catch (e) {
        err = e;
      }
      ok('已经收到正文后不再重试', calls === 1);
      ok('已经收到正文后抛出 SseStreamError', err instanceof SseStreamError);
    }
  }

  if (fails > 0) {
    console.error(`\n✗ ai-error-text 回归失败：${fails} 项`);
    process.exit(1);
  }
  console.log('\n✓ ai-error-text 回归全部通过');
}

main();
