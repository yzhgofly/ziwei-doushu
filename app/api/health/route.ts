/**
 * GET /api/health —— 诊断接口
 *
 * 「AI 解读失败」排查时最缺的就是现场信息：这个接口一次性给出
 * AI 配置是否解析成功、防护闸的实时用量、当前来源 IP，
 * 加 ?probe=1 还会真打一次模型确认 Key 与额度可用。
 *
 * 不返回任何密钥内容。逻辑与 Cloudflare Pages Functions 共用同一份。
 */

import { handleHealth } from '@/lib/ai/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleHealth(request, process.env);
}
