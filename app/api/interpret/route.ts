/**
 * POST /api/interpret —— AI 命盘解读（流式）
 *
 * 开源版原本没有这个路由，前端 ChatPanel / InsightPanel 会因此拿到 404
 * 并提示「开源版不含 AI 解读接口」。本实现补上它：
 *
 *   请求：{ chart: ZiweiChart, messages: {role, content}[] }
 *   响应：SSE —— data: {"delta":{"text":"..."}} …… data: [DONE]
 *
 * 实际处理逻辑在 lib/ai/handlers.ts —— 与 Cloudflare Pages Functions 共用同一份，
 * 保证两个部署目标下的协议、防护、输出净化完全一致。
 */

import { handleInterpret } from '@/lib/ai/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 带 thinking 的模型思考 + 出字可能一两分钟（合盘更久），
// 平台默认的函数时长上限会把请求中途砍断，这里显式申请更长的额度。
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  return handleInterpret(request, process.env);
}
