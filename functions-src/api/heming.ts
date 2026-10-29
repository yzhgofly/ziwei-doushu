/**
 * Cloudflare Pages Function —— POST /api/heming
 *
 * 与 Next.js 的 app/api/heming/route.ts 共用 lib/ai/handlers.ts。
 * 源码，构建时打包成 functions/api/heming.js。
 */

import { handleHeming } from '../../lib/ai/handlers';

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  return handleHeming(context.request, context.env);
}
