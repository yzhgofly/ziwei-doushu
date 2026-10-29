/**
 * 把一张 ZiweiChart 序列化成「盘面文字」——给大模型读的数据层。
 *
 * 设计原则：
 * 1. 只描述盘上真实存在的东西（星曜、亮度、四化、格局），不替模型编论断
 * 2. 宫位一律带「宫名 + 地支 + 宫干」三件套，模型既能按宫名也能按地支推理
 * 3. 纯函数、无副作用、不 import server-only 的模块 —— 这样能被 tsx 直接跑单测
 *    （格局识别在 patterns.ts，带 server-only，由路由层算好后传进来）
 */

import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { BRANCHES, STEMS, SHICHEN } from '@/lib/ziwei/constants';
import { getDaXianSiHua, getLiuNianSiHua, getSiHuaByStem } from '@/lib/ziwei/sihua';

export interface PatternLike {
  name: string;
  level: string;
  description: string;
  palaces?: string[];
  source?: string;
}

export interface ChartContextOptions {
  /** 由 detectPatterns() 产出的格局（server-only，调用方传入） */
  patterns?: PatternLike[];
  /** 流年干支用哪一年，默认当前系统年 */
  liunianYear?: number;
  /** 这张盘在合盘场景里的称呼，如「甲方」 */
  label?: string;
}

const LUNAR_MONTHS = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const LEVEL_LABEL: Record<string, string> = {
  excellent: '上上格',
  good: '上格',
  neutral: '中格',
  caution: '破格 / 警示',
};

function lunarMonthName(month: number): string {
  const isLeap = month < 0;
  const abs = Math.abs(month);
  return `${isLeap ? '闰' : ''}${LUNAR_MONTHS[abs] ?? abs}月`;
}

function lunarDayName(day: number): string {
  return LUNAR_DAYS[day - 1] ?? `${day}日`;
}

function formatStar(star: Star): string {
  const parts = [star.name];
  if (star.brightnessRaw) parts.push(`（${star.brightnessRaw}）`);
  if (star.siHua) parts.push(`化${star.siHua}`);
  return parts.join('');
}

function groupStars(palace: Palace): { major: Star[]; minor: Star[]; lucky: Star[]; sha: Star[] } {
  return {
    major: palace.stars.filter(s => s.type === 'major'),
    minor: palace.stars.filter(s => s.type === 'minor'),
    lucky: palace.stars.filter(s => s.type === 'lucky'),
    sha: palace.stars.filter(s => s.type === 'sha'),
  };
}

function palaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
  return chart.palaces.find(p => p.branch === ((branch % 12) + 12) % 12);
}

/** 本宫 + 对宫 + 两个三合宫 */
function sanFangSiZheng(branch: number): number[] {
  return [branch, (branch + 6) % 12, (branch + 4) % 12, (branch + 8) % 12];
}

function majorStarText(palace: Palace | undefined): string {
  if (!palace) return '（无此宫）';
  const major = groupStars(palace).major;
  if (major.length === 0) {
    if (palace.borrowedStars?.length) {
      return `空宫（借${palace.borrowedFromName ?? '对宫'}：${palace.borrowedStars.join('、')}）`;
    }
    return '空宫（无主星）';
  }
  return major.map(formatStar).join('、');
}

/** 某颗星落在哪个宫 */
function locateStar(chart: ZiweiChart, starName: string): string {
  const p = chart.palaces.find(pal => pal.stars.some(s => s.name === starName));
  if (!p) return '（不在盘中）';
  return `${p.name}（${BRANCHES[p.branch]}宫）`;
}

function describeSihua(transforms: Record<string, string>, chart: ZiweiChart): string {
  const order: Array<[string, string]> = [['禄', '化禄'], ['权', '化权'], ['科', '化科'], ['忌', '化忌']];
  return order
    .map(([key, label]) => {
      const star = transforms[key];
      if (!star) return '';
      return `${label}：${star} → ${locateStar(chart, star)}`;
    })
    .filter(Boolean)
    .join('；');
}

function describePalace(palace: Palace, chart: ZiweiChart, currentDaXianBranch: number | null): string {
  const g = groupStars(palace);
  const marks: string[] = [];
  if (palace.isMingGong) marks.push('★命宫');
  if (palace.isShenGong) marks.push('☆身宫');
  if (currentDaXianBranch !== null && palace.branch === currentDaXianBranch) marks.push('◆当前大限宫');

  const lines: string[] = [];
  const head = `■ ${palace.name}（${BRANCHES[palace.branch]}宫，${STEMS[palace.stem]}干）${marks.length ? ` ${marks.join(' ')}` : ''}`;
  lines.push(head);

  const major = g.major;
  if (major.length > 0) {
    lines.push(`  主星：${major.map(formatStar).join('、')}`);
  } else if (palace.borrowedStars?.length) {
    lines.push(`  主星：空宫，借${palace.borrowedFromName ?? '对宫'}之${palace.borrowedStars.join('、')}`);
  } else {
    lines.push('  主星：空宫（无主星，借对宫论）');
  }
  if (g.minor.length > 0) lines.push(`  辅星：${g.minor.map(formatStar).join('、')}`);
  if (g.lucky.length > 0) lines.push(`  吉星杂曜：${g.lucky.map(formatStar).join('、')}`);
  if (g.sha.length > 0) lines.push(`  煞曜：${g.sha.map(formatStar).join('、')}`);
  if (palace.selfSihua?.length) {
    lines.push(`  宫干自化：${palace.selfSihua.map(s => `${s.starName}化${s.siHua}`).join('、')}`);
  }
  if (palace.daXianAge) {
    lines.push(`  大限：${palace.daXianAge[0]}-${palace.daXianAge[1]} 岁`);
  }
  void chart;
  return lines.join('\n');
}

/**
 * 生成整张盘的文字描述。
 */
export function buildChartContext(chart: ZiweiChart, options: ChartContextOptions = {}): string {
  const { patterns = [], liunianYear = new Date().getFullYear(), label } = options;
  const bi = chart.birthInfo;
  const lunar = chart.lunarInfo;
  const out: string[] = [];

  if (label) out.push(`【${label}命盘资料】`);
  else out.push('【命主资料】');

  const clock = bi.origInput
    ? `${bi.origInput.clockHour}:${String(bi.origInput.clockMinute).padStart(2, '0')}`
    : null;
  const place = [bi.province, bi.city].filter(Boolean).join(' ');
  const shichen = SHICHEN[bi.hour];
  out.push(
    `公历：${bi.year}年${bi.month}月${bi.day}日${clock ? ` ${clock}` : ''}` +
    `${place ? `（出生地：${place}）` : ''} → 排盘时辰：${shichen?.name ?? '未知'}（${shichen?.range ?? ''}）`
  );
  out.push(
    `农历：${STEMS[lunar.yearStem] ?? ''}${BRANCHES[lunar.yearBranch] ?? ''}年 ` +
    `${lunarMonthName(lunar.lunarMonth)}${lunarDayName(lunar.lunarDay)}` +
    `${lunar.isLeapMonth ? '（闰月）' : ''}`
  );
  if (lunar.fourPillars) {
    out.push(`四柱（节气口径）：${lunar.fourPillars.join(' ')}`);
  }
  if (lunar.fourPillarsLunar) {
    out.push(`四柱（农历口径）：${lunar.fourPillarsLunar.join(' ')}`);
  }
  out.push(`五行局：${chart.wuxingJuName}`);
  out.push(
    `命主星：${chart.mingZhu || '未标注'}　身主星：${chart.shenZhu || '未标注'}　阴阳男女：${chart.yinYangGender || '未标注'}`
  );
  out.push(`当前年龄：${chart.currentAge} 岁`);

  // ── 生年四化 ──
  const birthSihua = getSiHuaByStem(lunar.yearStem);
  out.push('');
  out.push(`【生年四化】（${STEMS[lunar.yearStem]}年干）`);
  out.push(describeSihua(birthSihua, chart));

  // ── 十二宫 ──
  const currentDx = chart.daXians[chart.currentDaXianIndex];
  const currentDaXianBranch = currentDx?.palaceBranch ?? null;
  out.push('');
  out.push('【本命十二宫】（★命宫 ☆身宫 ◆当前大限宫）');
  const ordered = [...chart.palaces].sort((a, b) => a.branch - b.branch);
  for (const p of ordered) {
    out.push(describePalace(p, chart, currentDaXianBranch));
  }

  // ── 命宫三方四正 ──
  const ming = palaceByBranch(chart, chart.mingGongBranch);
  out.push('');
  out.push('【命宫三方四正】（命宫 + 财帛 + 官禄 + 迁移）');
  for (const b of sanFangSiZheng(chart.mingGongBranch)) {
    const p = palaceByBranch(chart, b);
    if (!p) continue;
    const role = b === chart.mingGongBranch ? '本宫' : b === (chart.mingGongBranch + 6) % 12 ? '对宫' : '三合';
    out.push(`  ${p.name}（${BRANCHES[b]}宫，${role}）：${majorStarText(p)}`);
  }

  // ── 当前大限 ──
  out.push('');
  if (currentDx) {
    const dxPalace = palaceByBranch(chart, currentDx.palaceBranch);
    out.push(
      `【当前大限】${currentDx.startAge}-${currentDx.endAge} 岁（${chart.currentAge} 岁）` +
      `，位于${dxPalace?.name ?? '未知宫'}（${BRANCHES[currentDx.palaceBranch]}宫）` +
      `${currentDx.stemName ? `，宫干 ${currentDx.stemName}` : ''}`
    );
    out.push(`  大限主星：${majorStarText(dxPalace)}`);
    const dxSihua = getDaXianSiHua(chart, chart.currentDaXianIndex);
    if (dxSihua) {
      out.push(`  大限四化（${dxSihua.stemName}干）：${describeSihua(dxSihua.transforms, chart)}`);
    }
  } else {
    out.push('【当前大限】无（童限或数据缺失）');
  }

  // ── 流年 ──
  const ln = getLiuNianSiHua(liunianYear);
  out.push('');
  out.push(`【流年】${liunianYear} 年（${ln.stemName}年干）`);
  out.push(`  流年四化：${describeSihua(ln.transforms, chart)}`);

  // ── 格局 ──
  if (patterns.length > 0) {
    out.push('');
    out.push('【命盘格局】（由本仓库格局识别引擎判定，非模型自行推测）');
    for (const p of patterns) {
      out.push(`  ◆ ${p.name}【${LEVEL_LABEL[p.level] ?? p.level}】${p.description}`);
      if (p.source) out.push(`     出处：${p.source}`);
      if (p.palaces?.length) out.push(`     涉及宫位：${p.palaces.join('、')}`);
    }
  }

  // ── 身宫 ──
  const shen = palaceByBranch(chart, chart.shenGongBranch);
  if (shen && shen.branch !== chart.mingGongBranch) {
    out.push('');
    out.push(`【身宫】位于${shen.name}（${BRANCHES[shen.branch]}宫），主星：${majorStarText(shen)}`);
  }

  void ming;
  return out.join('\n');
}

/**
 * 合盘场景：把两张盘并排描述，突出互相相关的宫位（命/夫妻/福德）。
 */
export function buildHemingContext(chartA: ZiweiChart, chartB: ZiweiChart, options: ChartContextOptions = {}): string {
  const liunianYear = options.liunianYear ?? new Date().getFullYear();
  const a = buildChartContext(chartA, { ...options, label: '甲方', liunianYear });
  const b = buildChartContext(chartB, { ...options, label: '乙方', liunianYear });

  const focus: string[] = [];
  for (const [who, chart] of [['甲方', chartA], ['乙方', chartB]] as const) {
    for (const palaceName of ['命宫', '夫妻宫', '福德宫']) {
      const p = chart.palaces.find(pal => pal.name === palaceName);
      if (!p) continue;
      focus.push(`  ${who} ${palaceName}（${BRANCHES[p.branch]}宫）：${majorStarText(p)}`);
    }
  }

  return [
    a,
    '',
    '════════════════════════════',
    '',
    b,
    '',
    '【合盘重点宫位速览】',
    ...focus,
  ].join('\n');
}
