/**
 * /library/search 的 metadata。
 * 页面本身改成了客户端组件（静态导出时服务端拿不到查询串），
 * 客户端组件不能导出 metadata，所以挪到这个 layout 里。
 */

import type { ReactNode } from 'react';

export const metadata = {
  title: '搜索 · 古籍原典库',
};

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
