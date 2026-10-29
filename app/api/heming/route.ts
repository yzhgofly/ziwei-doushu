/**
 * POST /api/heming —— 合盘 AI 分析（流式）
 *
 * 开源版原本没有这个路由，app/heming/page.tsx 会拿到 404 并提示
 * 「开源版不含合盘 AI 分析接口」。本实现补上它：
 *
 *   请求：{ chartA: ZiweiChart, chartB: ZiweiChart, question?: string }
 *   响应：SSE —— data: {"delta":{"text":"..."}} …… data: [DONE]
 *
 * 实际处理逻辑在 lib/ai/handlers.ts —— 与 Cloudflare Pages Functions 共用同一份。
 */

import { handleHeming } from '@/lib/ai/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 合盘要把两张盘都喂给模型，耗时比单盘解读长得多（实测 60~130 秒），
// 平台默认的函数时长上限不够，这里显式申请。
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  return handleHeming(request, process.env);
}
