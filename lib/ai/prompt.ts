/**
 * AI 解读 / 合盘 分析的 prompt 构造
 *
 * 上游（商业版）的断语库与 prompt 不开源，这里自己写一套：
 *   - 「盘面数据」由 chart-context.ts 从排盘引擎的真实输出生成，是唯一事实依据
 *   - 合盘部分复用仓库里公开的 heming-knowledge.ts（倪师合盘方法论 + 十四主星夫妻宫断语）
 *
 * 关键约束写进 system prompt：只准依据盘面数据推理，不准编造盘上没有的星曜/格局。
 */

import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  HEMING_METHODOLOGY,
  HEMING_SCORE_CRITERIA,
  MARRIAGE_STARS_BRIEF,
  SIHUA_IN_FUQI_GU,
  STAR_IN_FUQI_GU,
} from '@/lib/ziwei/heming-knowledge';
import {
  buildChartContext,
  buildHemingContext,
  type ChartContextOptions,
  type PatternLike,
} from './chart-context';

/** 上游文件里有几个替换字符（U+FFFD），嵌进 prompt 前清掉，避免模型读到乱码 */
function clean(text: string): string {
  return text.replace(/\uFFFD/g, '');
}

const INTERPRET_RULES = `## 硬规则
1. **只依据【盘面数据】推理。** 盘面上没有的星曜、宫位、四化、格局，一律不许编造或假设。
2. 「【命盘格局】」是排盘引擎判定的既定结论，直接引用，不要另造格局名。
3. 命理专名（星曜名、宫名、格局名、四化名）保持中文原名，不要翻译成拼音或英文。
4. 用简体中文回答，**正文里不要混入英文单词**（模型偶尔会写出「重视名誉 fairness 与担当」这类中英夹杂，要避免）。Markdown 格式，可用 **加粗** 与二级标题（##），不要用一级标题。
5. 结构固定为：**先给结论**（1-2 句）→ **再给依据**（引用盘上的宫位与星曜）→ **最后给可操作建议**。
6. 用户问什么答什么。有历史对话时不要重复已经说过的内容，不要每次都复述整张盘。
7. 涉及健康、婚姻、生育、投资时，补一句「命理仅供自我观照，不构成医疗、法律或投资建议」。
8. 篇幅 300-600 字；用户明确要求详版才展开。
9. 直接输出正文，不要 JSON、代码块或 YAML。

## 排盘口径提醒
- 本命四化 = 出生年天干四化；大限四化、流年四化是叠层，不要与本命四化混为一谈。
- 空宫要借对宫论，并说明所借之星来自哪一宫。
- 命宫三方四正 = 命宫 + 财帛宫 + 官禄宫 + 迁移宫。
- 亮度（庙/旺/得/利/平/不/闲/陷）要参与判断，不要只按星名断。`;

/**
 * 命盘解读的 system prompt。
 */
export function buildInterpretSystemPrompt(
  chart: ZiweiChart,
  options: ChartContextOptions = {},
): string {
  const context = buildChartContext(chart, options);
  return [
    '你是倪海厦《天纪·紫微斗数》体系的命理师，为用户解读一张已经排好的紫微命盘。',
    '',
    INTERPRET_RULES,
    '',
    '════════【盘面数据】════════',
    context,
    '════════════════════════════',
    '',
    '现在请根据用户的问题作答。',
  ].join('\n');
}

/** 合盘时用到的：某张盘夫妻宫 + 命宫 + 福德宫的关键星曜断语 */
function marriageStarsKnowledge(chart: ZiweiChart): string {
  const lines: string[] = [];
  const role = chart.birthInfo.gender === 'male' ? '男命' : '女命';

  for (const palaceName of ['夫妻宫', '命宫', '福德宫']) {
    const palace = chart.palaces.find(p => p.name === palaceName);
    if (!palace) continue;
    const major = palace.stars.filter(s => s.type === 'major');

    if (major.length > 0) {
      lines.push(`■ ${palaceName}主星（${role}）：${major.map(s => s.name).join('、')}`);
    }
    if (palaceName === '夫妻宫') {
      for (const s of major) {
        const k = STAR_IN_FUQI_GU[s.name];
        if (!k) continue;
        lines.push(`  ◆ ${s.name}`);
        lines.push(`    核心：${clean(k.summary)}`);
        lines.push(`    吉象：${clean(k.good)}`);
        lines.push(`    凶象：${clean(k.bad)}`);
        lines.push(`    配偶特质：${clean(k.spouse_traits)}`);
        lines.push(`    婚期建议：${clean(k.timing)}`);
        if (k.ni_quote) lines.push(`    倪师原话：${clean(k.ni_quote)}`);
      }
      const sihuaStars = palace.stars.filter(s => s.siHua);
      for (const s of sihuaStars) {
        const t = SIHUA_IN_FUQI_GU[`化${s.siHua}` as keyof typeof SIHUA_IN_FUQI_GU];
        if (!t) continue;
        lines.push(`  ◆ ${s.name}化${s.siHua}（${palaceName}）：${clean(t)}`);
      }
    }
  }

  // 婚姻相关神煞
  const marriageSha: string[] = [];
  for (const palace of chart.palaces) {
    if (palace.name !== '夫妻宫' && palace.name !== '命宫') continue;
    for (const s of palace.stars) {
      const brief = MARRIAGE_STARS_BRIEF[s.name];
      if (brief) marriageSha.push(`  ${palace.name}见${s.name}：${clean(brief)}`);
    }
  }
  if (marriageSha.length > 0) {
    lines.push('■ 婚姻相关神煞');
    lines.push(...marriageSha);
  }

  return lines.join('\n');
}

/**
 * 合盘分析的 system prompt。
 */
export function buildHemingSystemPrompt(
  chartA: ZiweiChart,
  chartB: ZiweiChart,
  question: string | undefined,
  options: ChartContextOptions = {},
): string {
  const context = buildHemingContext(chartA, chartB, options);
  const q = question?.trim();

  return [
    '你是倪海厦《天纪·紫微斗数》体系的命理师，为用户做**合盘分析**（两个人的命盘对照着看）。',
    '',
    '## 硬规则',
    '1. **只依据【盘面数据】推理**，不许编造盘上没有的星曜、宫位、四化。',
    '2. 合盘必须同时看双方的**命宫 + 夫妻宫 + 福德宫**（倪师原话：只看夫妻宫判断婚姻，大错特错）。',
    '3. 太阳太阴互参：女命以太阳论夫，男命以太阴论妻，须结合落宫庙旺与是否化忌。',
    '4. 四化飞化互参：甲方生年干四化落在乙方哪个宫，反之亦然。',
    '5. 必须给出**缘分评级**（五星 / 四星 / 三星 / 二星 / 一星），评级标准见下方「合盘评分标准」，并在文末单独一行写「缘分评级：X 星」。',
    '6. 用简体中文，正文里不要混入英文单词；Markdown 可用 **加粗** 与二级标题；不要用一级标题。',
    '7. 结构：**先给结论与评级** → **再分步论证**（双方命格基础 / 夫妻宫互参 / 日月星象 / 四化飞化 / 大限同步）→ **最后给相处建议**。',
    '8. 涉及婚姻、健康、投资时补一句「命理仅供自我观照，不构成医疗、法律或投资建议」。',
    '9. 篇幅 600-1000 字；用户另有指定时从其要求。',
    '',
    '════════【合盘方法论】════════',
    clean(HEMING_METHODOLOGY),
    '',
    '════════【合盘评分标准】════════',
    ...Object.entries(HEMING_SCORE_CRITERIA).map(([k, v]) => `  ${k}：${clean(v)}`),
    '',
    '════════【甲方夫妻/命/福德关键星曜断语】════════',
    marriageStarsKnowledge(chartA),
    '',
    '════════【乙方夫妻/命/福德关键星曜断语】════════',
    marriageStarsKnowledge(chartB),
    '',
    '════════【盘面数据】════════',
    context,
    '════════════════════════════',
    '',
    q ? `用户追问：${q}` : '请开始合盘分析。',
  ].join('\n');
}

export type { ChartContextOptions, PatternLike };
