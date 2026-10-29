/**
 * 正文净化：把中英夹杂的英文词去掉
 *
 * 为什么需要这层：prompt 里已经写了「正文里不要混入英文单词」，
 * 但模型偶尔还是会写出「重道义、 fairness 与担当」这种句子——
 * 硬规则拦不住生成侧的偶发失误，而这类输出直接违反「正文不得中英夹杂」的要求。
 *
 * 做法：在 SSE 输出前对每段文本做一次净化
 *   1. 删掉所有拉丁字母词（命理正文里不存在合法英文，数字保留）
 *   2. 把删除后留下的空括号、多余空格、重复顿号收拾干净
 *
 * 只动空格和标点，**不碰换行**，否则会把 Markdown 的段落结构压掉。
 */

export function stripLatin(text: string): string {
  if (!text) return text;
  // 连同英文词两侧紧邻的空格一起删掉。
  // 只删词会留下「重道义、  与担当」这种双空格；
  // 而如果改成删掉整行的行尾空格，又会误伤 Markdown：
  // 模型分片正好切在「## 」和「结论」之间时，行尾空格被吃掉就变成「##结论」。
  // 吸收单词两侧的空格既干净，又不会碰到换行和行尾。
  return text.replace(/[ \t]*[A-Za-z]+[ \t]*/g, '');
}

// 汉字 + 中文标点 + 全角符号（target 是 ES2017，不能用 \p{Script=Han}）
const CJK = '\\u4e00-\\u9fa5\\u3400-\\u4dbf\\u3000-\\u303f\\uff00-\\uffef\\u2018\\u2019\\u201c\\u201d';

export function tidyChinese(text: string): string {
  if (!text) return text;
  let s = text;

  // 空括号：删词后可能剩下「（ ）」或「( )」
  s = s.replace(/[（(][ \t]*[）)]/g, '');

  // 两个中文之间的空格（只吃空格和制表符，换行必须留着）
  s = s.replace(new RegExp(`([${CJK}])[ \\t]+([${CJK}])`, 'g'), '$1$2');

  // 顿号/逗号/句号连用：删词后容易出现「、、」或「， 、」
  s = s.replace(/([、，；：])[ \t]*\1/g, '$1');

  // 标点前残留的空格
  s = s.replace(/[ \t]+([、，；：！？」』）】])/g, '$1');

  // 括号内开头的顿号逗号：「（、太阳」→「（太阳」
  s = s.replace(/([（(])[ \t]*([、，])/g, '$1');

  // 闭括号前的顿号逗号：「太阳、）」→「太阳）」
  s = s.replace(/([、，])[ \t]*([）】])/g, '$2');

  // 注意：**不要**修剪行首/行尾空格。
  // 模型分片可能正好切在「## 」和「结论」之间，剪掉行尾空格会让标题变成「##结论」。

  return s;
}

/** 完整净化：去英文 + 收拾标点 */
export function sanitizeChinese(text: string): string {
  return tidyChinese(stripLatin(text));
}
