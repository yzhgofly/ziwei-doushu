/**
 * 紫微斗数格局识别 —— 对外入口。
 *
 * 实现放在 patterns-core.ts（不带 'server-only' 标记），
 * 这样 Cloudflare Pages Functions（Workers 运行时）也能复用同一份逻辑，
 * 而 Next.js 侧依旧保持 server-only 的保护语义。
 */

import 'server-only';

export * from './patterns-core';