/**
 * Cloudflare Pages Function —— GET / PUT / DELETE /api/history
 *
 * 与 Next.js 的 app/api/history/route.ts 共用 lib/history/history-api.ts。
 * 这个文件是源码，构建时由 scripts/build-pages.mjs 用 esbuild 打包成
 * functions/api/history.js（Workers 运行时只认编译产物）。
 */

import { handleHistory } from '../../lib/history/history-api';

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  return handleHistory(context.request, context.env);
}

export async function onRequestPut(context: PagesContext): Promise<Response> {
  return handleHistory(context.request, context.env);
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  return handleHistory(context.request, context.env);
}
