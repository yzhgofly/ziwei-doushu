/**
 * 从 .env.local 生成 wrangler 本地调试用的 .dev.vars。
 *
 * Cloudflare Pages 的本地调试（wrangler pages dev）和线上部署都从环境变量
 * 读取 AI 配置，跟 Next 的 .env.local 不是一套，所以这里转一份过来。
 * 密钥只在本机文件之间搬运，不打印到终端。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = readFileSync(path.join(root, '.env.local'), 'utf8');

function get(key) {
  const m = envText.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

const keys = [
  'AI_PROVIDER',
  'AI_PROTOCOL',
  'AI_BASE_URL',
  'AI_AUTH_MODE',
  'AI_MODEL',
  'AI_MAX_TOKENS',
  'AI_TIMEOUT_MS',
  'AI_API_KEY',
];

const lines = keys
  .map(k => {
    const v = get(k);
    return v ? `${k}=${v}` : '';
  })
  .filter(Boolean);

writeFileSync(path.join(root, '.dev.vars'), lines.join('\n') + '\n', 'utf8');

console.log(`.dev.vars 已写入：${lines.map(l => l.split('=')[0]).join(', ')}`);
console.log(`AI_API_KEY 长度：${get('AI_API_KEY').length}`);
