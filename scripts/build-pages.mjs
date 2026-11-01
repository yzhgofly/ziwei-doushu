/**
 * 构建 Cloudflare Pages 产物。
 *
 * Pages 的托管模型 = 静态资源 + Pages Functions：
 *   - 静态资源：Next.js 的 output:'export' 产物（out/）
 *   - 服务端接口：functions/api/*.js（Workers 运行时）
 *
 * 关键点：
 *   1. 静态导出不能带 app/api/* 服务端路由。next.config.js 在导出模式下把
 *      pageExtensions 收窄成 ['tsx']，于是 route.ts 不会被当成路由，
 *      不需要改目录结构（改名目录在本机被安全策略拦了）。
 *   2. Pages Functions 只认编译产物，所以用 esbuild 把 functions-src/ 下的 TS
 *      打成 ESM，放进 functions/。自己打包还能避开 wrangler 对 @/ 别名解析的坑。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/**
 * esbuild 可能只作为 tsx 的嵌套依赖存在（node_modules/tsx/node_modules/esbuild），
 * 这里按顺序试一遍，避免为了打包而给项目新增依赖。
 */
function loadEsbuild() {
  // 先按包名找，再按绝对目录找（目录路径 require 走 package.json 的 main，
  // 不受父包 exports 字段限制，能命中 tsx 里的嵌套 esbuild）
  const candidates = [
    'esbuild',
    path.join(root, 'node_modules', 'esbuild'),
    path.join(root, 'node_modules', 'tsx', 'node_modules', 'esbuild'),
  ];
  const errors = [];
  for (const id of candidates) {
    try {
      return require(id);
    } catch (e) {
      errors.push(`${id}: ${e.message}`);
    }
  }
  throw new Error(`找不到 esbuild：\n${errors.join('\n')}`);
}

const { build } = loadEsbuild();
const apiDir = path.join(root, 'app', 'api');
const apiHiddenDir = path.join(root, 'app', '_api');
const outDir = path.join(root, 'out');
const functionsDir = path.join(root, 'functions');
const srcFunctionsDir = path.join(root, 'functions-src');

function run(cmd, args, env) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...(env || {}) },
    shell: process.platform === 'win32',
  });
}

/** 用项目本地的 next 可执行文件（本机没有全局 npx） */
function nextBin() {
  const p = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');
  if (existsSync(p)) return p;
  return 'next';
}

/** 把 app/api 临时藏起来，避免静态导出时和 force-dynamic 冲突 */
function hideApiRoutes() {
  return false;
}

function restoreApiRoutes(hidden) {
  if (!hidden) return;
}

async function bundleFunctions() {
  rmSync(functionsDir, { recursive: true, force: true });
  mkdirSync(path.join(functionsDir, 'api'), { recursive: true });

  const entries = [
    path.join(srcFunctionsDir, 'api', 'interpret.ts'),
    path.join(srcFunctionsDir, 'api', 'heming.ts'),
    path.join(srcFunctionsDir, 'api', 'health.ts'),
    path.join(srcFunctionsDir, 'api', 'history.ts'),
  ];

  for (const entry of entries) {
    const name = path.basename(entry).replace(/\.ts$/, '.js');
    const outfile = path.join(functionsDir, 'api', name);
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      tsconfig: path.join(root, 'tsconfig.json'),
      legalComments: 'none',
      minify: true,
      logLevel: 'info',
    });
  }
}

async function main() {
  const hidden = hideApiRoutes();
  try {
    // 1) Next 静态导出
    run(nextBin(), ['build'], {
      NEXT_OUTPUT_EXPORT: '1',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://ziwei-doushu.pages.dev',
    });
  } finally {
    restoreApiRoutes(hidden);
  }

  if (!existsSync(outDir)) {
    console.error('静态导出没有产出 out/ 目录');
    process.exit(1);
  }

  // 2) Pages Functions 打包
  await bundleFunctions();

  // 3) wrangler 配置（Pages 用 pages_build_output_dir 指静态产物目录）
  //    kv_namespaces 里的绑定会随 `wrangler pages deploy` 一起生效，
  //    /api/history 靠它拿到 Cloudflare KV（存的是客户端加密后的密文）。
  const kvNamespaceId = process.env.CF_HISTORY_KV_ID || 'd0d378fb6d9a41ff94514a90c9c4abc6';
  const wranglerToml = `name = "ziwei-doushu"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "out"

[[kv_namespaces]]
binding = "HISTORY_KV"
id = "${kvNamespaceId}"
`;
  writeFileSync(path.join(root, 'wrangler.toml'), wranglerToml, 'utf8');

  console.log('\n构建完成：');
  console.log('  静态资源  out/');
  console.log('  服务端接口 functions/api/*.js');
}

main().catch(err => {
  console.error('构建失败：', err);
  process.exit(1);
});
