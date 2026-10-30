/**
 * 一键更换线上站点的模型 API Key。
 *
 * 用法（密钥从标准输入读，不进命令行参数、不进 shell 历史）：
 *   $env:AI_API_KEY | node scripts/set-api-key.mjs
 *   或
 *   Get-Content key.txt | node scripts/set-api-key.mjs
 *
 * 可选参数（不传就跳过对应平台）：
 *   --pages <项目名>     更新 Cloudflare Pages 的 secret
 *   --vercel <项目目录>  更新 Vercel 的环境变量
 *
 * 会同时更新：
 *   - Cloudflare Pages：wrangler pages secret put AI_API_KEY --project-name <项目名>
 *   - Vercel：vercel env add AI_API_KEY --environment production --value ... --sensitive --force --yes
 * 并把新的 Key 写进本机 .env.local 与 .dev.vars（下次本地跑用同一个 Key）。
 *
 * 注意：Pages 的 secret 是构建期注入，改完要重新部署一次才生效：
 *   wrangler pages deploy out --project-name <项目名>
 *   vercel deploy --prod --yes
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const pagesProject = arg('--pages');
const vercelDir = arg('--vercel');

// 1) 从 stdin 读 key
const key = (await new Promise(resolve => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { buf += d; });
  process.stdin.on('end', () => resolve(buf.trim()));
})).trim();

if (!key) {
  console.error('没有读到 API Key。用法：$env:AI_API_KEY | node scripts/set-api-key.mjs --pages <项目名>');
  process.exit(1);
}
if (key.length < 20) {
  console.error(`Key 看起来不完整（只有 ${key.length} 个字符），已中止。`);
  process.exit(1);
}
console.log(`收到 API Key（长度 ${key.length}）`);

function run(cmd, args, opts = {}) {
  // Windows 上 wrangler.cmd / vercel.cmd 是 .cmd 包装脚本，
  // Node 不能直接 spawn（会报 EINVAL），必须走 shell。
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', shell: true, ...opts });
}

// 2) Cloudflare Pages
if (pagesProject) {
  try {
    run('wrangler.cmd', ['pages', 'secret', 'put', 'AI_API_KEY', '--project-name', pagesProject], { input: key + '\n' });
    console.log(`Cloudflare Pages（${pagesProject}）：已更新 AI_API_KEY`);
  } catch (e) {
    console.error('Cloudflare Pages 更新失败：' + (e.stdout || e.message).toString().slice(0, 300));
  }
}

// 3) Vercel
if (vercelDir) {
  try {
    run('vercel.cmd', ['env', 'add', 'AI_API_KEY', '--environment', 'production', '--value', `"${key}"`, '--sensitive', '--force', '--yes'],
      { cwd: path.resolve(root, vercelDir) });
    console.log('Vercel：已更新 AI_API_KEY（加密存储）');
  } catch (e) {
    console.error('Vercel 更新失败：' + (e.stdout || e.message).toString().slice(0, 300));
  }
}

// 4) 本机 .env.local / .dev.vars 也换掉
for (const [file, label] of [['.env.local', '本机 .env.local'], ['.dev.vars', '本机 .dev.vars']]) {
  const p = path.join(root, file);
  try {
    const text = readFileSync(p, 'utf8');
    const next = /^AI_API_KEY=.*$/m.test(text)
      ? text.replace(/^AI_API_KEY=.*$/m, `AI_API_KEY=${key}`)
      : text.replace(/\s*$/, '\n') + `AI_API_KEY=${key}\n`;
    writeFileSync(p, next, 'utf8');
    console.log(`${label}：已更新（都在 .gitignore 内）`);
  } catch { /* 文件不存在就跳过 */ }
}

console.log('\n完成。新的 Key 需要重新部署才会生效：');
if (pagesProject) console.log(`  wrangler pages deploy out --project-name ${pagesProject}`);
if (vercelDir) console.log('  vercel deploy --prod --yes');
