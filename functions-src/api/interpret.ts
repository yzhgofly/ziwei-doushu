/**
 * Cloudflare Pages Function —— POST /api/interpret
 *
 * 与 Next.js 的 app/api/interpret/route.ts 共用 lib/ai/handlers.ts，
 * 两边协议、防护、输出净化完全一致。
 *
 * 这个文件是源码，构建时由 scripts/build-pages.mjs 用 esbuild 打包成
 * functions/api/interpret.js（Workers 运行时只认编译产物）。
 */

import { handleInterpret } from '../../lib/ai/handlers';

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  return handleInterpret(context.request, context.env);
}
