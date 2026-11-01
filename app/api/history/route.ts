/**
 * GET / PUT / DELETE /api/history —— 云备份（Next.js 路由，部署到 Vercel 时用）
 *
 * 逻辑在 lib/history/history-api.ts —— 与 Cloudflare Pages Functions 共用同一份。
 * 存储后端由环境变量决定：
 *   - Cloudflare KV 绑定 `HISTORY_KV`
 *   - Upstash / Vercel KV 的 `KV_REST_API_URL` + `KV_REST_API_TOKEN`
 *
 * 服务器只存客户端加密后的密文，没有同步码就取不到、解不开。
 */

import { handleHistory } from '@/lib/history/history-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleHistory(request, process.env);
}

export async function PUT(request: Request): Promise<Response> {
  return handleHistory(request, process.env);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleHistory(request, process.env);
}
