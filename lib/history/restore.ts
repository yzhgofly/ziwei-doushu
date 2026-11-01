/**
 * 从历史记录恢复现场
 *
 * 把某条历史里的命盘暂存到 sessionStorage，然后跳到 /chart 把它载入，
 * 这样就能接着追问，AI 看到的上下文和当时一样。
 *
 * 用 sessionStorage 而不是 localStorage：它按标签页隔离，
 * 不会把「要恢复哪张盘」这种临时状态带到别的标签页去。
 *
 * 两种恢复路径都要覆盖：
 *   1. **跨页面跳转**（从合盘页回排盘页）：sessionStorage 暂存 → 目标页挂载时取走；
 *   2. **同页切换**（已经在 /chart，想换回另一张盘）：路由不变、组件不重挂载，
 *      所以额外派发一个窗口事件，让当前这一页直接换盘。
 */

import type { ZiweiChart } from '@/lib/ziwei/types';

export const RESTORE_KEY = 'ziwei_restore_chart';

/** 同页恢复用的事件名 */
export const RESTORE_EVENT = 'ziwei-history-restore-chart';

/** 暂存一张盘，准备恢复 */
export function stageChartForRestore(chart: ZiweiChart): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, JSON.stringify(chart));
  } catch { /* 忽略 */ }
}

/** 取出并清除暂存的盘 */
export function takeStagedChart(): ZiweiChart | null {
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESTORE_KEY);
    const chart = JSON.parse(raw) as ZiweiChart;
    return chart && Array.isArray(chart.palaces) ? chart : null;
  } catch {
    return null;
  }
}

/**
 * 发起一次恢复：
 *   - 暂存一份到 sessionStorage（供跨页面跳转后取用）；
 *   - 同时派发事件，让**已经挂载着**的 /chart 页立刻换盘。
 */
export function requestChartRestore(chart: ZiweiChart): void {
  stageChartForRestore(chart);
  try {
    window.dispatchEvent(new CustomEvent<ZiweiChart>(RESTORE_EVENT, { detail: chart }));
  } catch { /* 忽略 */ }
}
