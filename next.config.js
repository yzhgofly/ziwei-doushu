/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // 开发模式下 Next 会拦截跨源的 /_next/hmr 与字体等 dev 资源。
  // 从公网隧道（trycloudflare 随机域名）访问时 Host 与来源不一致，
  // 不放开的话控制台会一直报 "Blocked cross-origin request to Next.js dev resource"。
  // 用通配符覆盖随机子域名，换隧道也不用再改。
  allowedDevOrigins: ['*.trycloudflare.com'],
  // 部署到纯静态托管时用：
  //   NEXT_OUTPUT_EXPORT=1 npm run build
  // 会导出成 out/ 下的纯静态文件。
  //
  // 静态导出时不能带 app/api/* 这种服务端路由（带 force-dynamic 会被 Next 判为
  // "cannot be used with output: export"）。这里在导出模式下把 pageExtensions
  // 收窄成只认 .tsx —— 路由处理器都是 route.ts，于是它们在导出时不会被当成路由；
  // 其余页面本来就是 .tsx，不受影响。
  ...(process.env.NEXT_OUTPUT_EXPORT === '1'
    ? { output: 'export', pageExtensions: ['tsx'] }
    : {}),
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

module.exports = nextConfig;
