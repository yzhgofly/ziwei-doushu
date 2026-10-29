/**
 * robots.txt
 *
 * 为什么是 .tsx 而不是 .ts：
 * 静态导出（Cloudflare Pages）时 next.config.js 会把 pageExtensions 收窄成
 * ['tsx']，用来屏蔽 app/api 下的 route.ts（服务端路由不能静态导出）。
 * 元数据文件如果还是 .ts 就会被一起屏蔽掉，robots.txt 会整个消失，
 * 所以这个文件统一改成 .tsx —— 两种构建模式下 Next 都认。
 */

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// 纯静态导出（output: 'export'）要求这条路由是静态的
export const dynamic = 'force-static';

const BASE_URL = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/preview-versions/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
