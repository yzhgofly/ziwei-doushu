/**
 * Cloudflare Pages Function —— GET /api/health
 *
 * 与 Next.js 的 app/api/health/route.ts 共用 lib/ai/handlers.ts。
 * 这个文件是源码，构建时由 scripts/build-pages.mjs 用 esbuild 打包成
 * functions/api/health.js（Workers 运行时只认编译产物）。
 */

import { handleHealth } from '../../lib/ai/handlers';

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  return handleHealth(context.request, context.env);
}
