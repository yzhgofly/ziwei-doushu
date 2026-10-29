/**
 * 请求体校验
 *
 * 命盘数据是浏览器端算好后 POST 上来的，属于「不可信输入」：
 * 这里只做形状校验（够用即可），并把会进 prompt 的用户可控字符串做净化。
 */

import type { ZiweiChart } from '@/lib/ziwei/types';
import { PROVINCES } from '@/lib/ziwei/cities';

/** 允许进 prompt 的字符：中日韩、拉丁字母数字、少量标点 */
function safeLabel(value: unknown, maxLen = 32): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[^\u4e00-\u9fa5\u3400-\u4dbfA-Za-z0-9\s·・()（）-]/g, '')
    .slice(0, maxLen)
    .trim();
}

/**
 * 出生地必须走白名单：省份取自 PROVINCES，城市取自该省下的城市表。
 * 只按字符集过滤挡不住中文注入（"忽略上面的指令" 全是合法汉字），
 * 所以这里改成「对不上表就丢掉」。
 */
function sanitizeLocation(province: unknown, city: unknown): { province: string; city: string } {
  const provName = typeof province === 'string' ? province.trim() : '';
  const prov = PROVINCES.find(p => p.name === provName);
  if (!prov) return { province: '', city: '' };

  const cityName = typeof city === 'string' ? city.trim() : '';
  if (!cityName) return { province: prov.name, city: '' };

  const hit = prov.cities.find(c => c.name === cityName);
  if (!hit) return { province: prov.name, city: '' };
  return { province: prov.name, city: hit.name };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 校验并净化客户端传来的命盘。
 * 结构不对就返回 null（路由层回 400）。
 */
export function parseChart(input: unknown): ZiweiChart | null {
  if (!isRecord(input)) return null;

  const birthInfo = input.birthInfo;
  const lunarInfo = input.lunarInfo;
  const palaces = input.palaces;
  if (!isRecord(birthInfo) || !isRecord(lunarInfo) || !Array.isArray(palaces)) return null;
  if (palaces.length !== 12) return null;

  if (!isNum(birthInfo.year) || !isNum(birthInfo.month) || !isNum(birthInfo.day) || !isNum(birthInfo.hour)) {
    return null;
  }
  if (birthInfo.gender !== 'male' && birthInfo.gender !== 'female') return null;
  if (!isNum(lunarInfo.yearStem) || !isNum(lunarInfo.yearBranch)) return null;
  if (!isNum(input.mingGongBranch) || !isNum(input.shenGongBranch) || !isNum(input.wuxingJu)) return null;

  for (const p of palaces) {
    if (!isRecord(p)) return null;
    if (!isNum(p.branch) || p.branch < 0 || p.branch > 11) return null;
    if (!Array.isArray(p.stars)) return null;
  }

  // 净化会进 prompt 的自由文本字段
  const loc = sanitizeLocation(birthInfo.province, birthInfo.city);
  birthInfo.province = loc.province;
  birthInfo.city = loc.city;
  birthInfo.name = safeLabel(birthInfo.name);

  return input as unknown as ZiweiChart;
}

/** 最多保留最近 N 条对话，控制 token 消耗 */
export function trimMessages<T extends { role: string; content: string }>(messages: T[], max = 20): T[] {
  return Array.isArray(messages) ? messages.slice(-max) : [];
}
