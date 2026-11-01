<div align="center">

# 紫微斗数 · 开源排盘引擎

### 算法是公开的传统智慧，不应该被锁在围墙里

[![CI](https://github.com/Renhuai123/ziwei-doushu/actions/workflows/ci.yml/badge.svg)](https://github.com/Renhuai123/ziwei-doushu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/dataset-CC%20BY%204.0-green.svg)](./DATASET-LICENSE)

**中文** · [English](./README.en.md)

</div>

**一、项目理念**：紫微斗数是中国传统命理学的瑰宝，倪海厦老师在《天纪》中系统梳理了正宗的紫微斗数体系。我们希望通过技术手段让更多人接触和学习这门学问。

开源排盘算法和知识库，是因为我们相信：**算法是公开的传统智慧，不应该被锁在围墙里**。真正的价值在于解读的深度、用户体验的打磨、以及持续运营的积累。

**二、项目信息**：基于<strong>倪海厦《天纪》</strong>教学体系的紫微斗数排盘系统，包含完整排盘算法、四化系统、格局知识库、古籍原文数据，以及一套完整开源的紫微斗数解读数据：**v4.0 解读数据集——67.5 万张命盘 × 13 维 = 877 万段解读，正文约 204 亿字，解压后 56.6 GB**（2026-10-15 发布）。

| 数据集 | 命盘 | 解读段数 | 解压后 | 覆盖年份 | 每张盘解读字数 |
|---|---|---|---|---|---|
| **v4.0 解读数据集**（2026-10-15） | **674,976** | **8,774,688** | **56.6 GB** | **1950–2026**（只含真实日期） | **约 3.0 万字** |
| v3.0 样本数据集 | 518,400 | 6,739,200 | 33.1 GB | 1924–1983 | 约 2.1 万字 |
| 变化 | +30% | +30% | **+71%** | +17 年 | +44% |

<sub>v3.0 每张盘解读字数按 2,160 张盘抽样估算，其余数字为全量统计；两版每张盘都是 13 维。</sub>

在线体验：[metisziwei.com](https://metisziwei.com/?from=gh-readme)，排盘、AI 解读、命盘历史全部开放。

> **注：关于六亲判断**
>
> 紫微斗数在六亲（父母、兄弟、子女等）判断上存在一定局限。倪师在《天纪》中指出：“斗数批六亲本来就比较差一点。”（[2上 · 00:25:27](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1527)）在传统术数中，铁板神数在核对六亲方面有其独特优势（[2上 · 00:03:15](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=195)）；倪师仍以紫微斗数为核心，是因为它能结合地理、环境与人事进行综合判断，形成“上知天文、下知地理、中知人事”的完整体系（[2上 · 00:25:43](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1543)）。因此，与六亲相关的分析仅供参考；[metisziwei.com](https://metisziwei.com/?from=gh-readme) 上父母、兄弟、子女三个维度也附有同样的说明。

---

## 目录

| | 章节 | 一句话 |
|---|------|--------|
| 一 | [本轮更新](#一本轮更新2026-10-15) | 13 维断语按倪师原话与《全书》逐句校正，发布 67.5 万命盘 × 13 维解读数据集 v4.0 |
| 二·新 | [13 维解读数据集 v4.0](#二新13-维解读数据集-v402026-10-15) | 2026-10-15 新版断语，67.5 万命盘，按年份下载 |
| 二 | [51.8 万命盘样本数据集](#二518-万命盘样本数据集) | 规格、下载、用途、许可 |
| 三 | [快速开始](#三快速开始) | 克隆到跑起来 |
| 四 | [排盘引擎](#四排盘引擎) | 能做到什么、文件怎么分、古籍数据 |
| 五 | [倪师《天纪·紫微斗数》原话](#五倪师天纪紫微斗数原话) | 14 讲 + 2 段补充、1848 条，一图看全，每条可回放 |
| 六 | [界面是一份 Demo](#六界面是一份-demo) | 不是线上那套，差距写明 |
| 七 | [开源边界](#七开源边界什么不在里面) | 什么开源、什么不开源 |
| 八 | [维护节奏与贡献](#八维护节奏与贡献) | 同步节奏、issue / PR 口径 |
| 九 | [协议](#九协议) | 代码 MIT / 数据 CC BY 4.0 / 古籍公版 / 倪师原话非商用 |
| 十 | [关于与联系](#十关于与联系) | 项目理念、技术栈、联系方式 |

---

## 一、本轮更新（2026-10-15）

本轮跟随网站 2026-10-15 发版（网站内容版本 `ca268829f7a9`）：

![本轮更新总览](./docs/update-20261015.png)

**1. 发布 13 维解读数据集 v4.0** —— 674,976 张命盘（公历 1950–2026 年每一个真实日期 × 12 时辰 × 男女）× 13 维 = **8,774,688 段解读**，正文约 204 亿字。解压后 56.6 GB（v3.0 为 33.1 GB，增加 71%），压缩后只有 161 MB，按年份分 77 个文件，可以只下需要的年份，也可以一次下全年份总包。下载见 [Release v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d)，规格和字段见[第二·新章](#二新13-维解读数据集-v402026-10-15)。发布前 77 个文件逐个解压，与原始数据逐字节比对一致。

**2. 13 维断语按倪师原话与《全书》原文逐句校正**（断语库仍不开源，校正结果体现在 v4.0 数据集里）：

- 标着倪师或《全书》却查不到出处的引文，删掉或换成逐字可查的原话；倪师原话注明《天纪》第几集、几分几秒
- 不会发生的四化（如七杀化权、紫微化忌）相关的句子删去；只在某种条件下才成立的断语补上条件
- 「力量强时……落陷时……」这类两头说的句子，改为按命盘只显示成立的那一种
- 健康：哪个脏腑要留意，改按倪师的看法——全盘杀星最集中的那一宫，按它的地支对应脏腑；不再按星的五行推脏器
- 网站知识库「古籍引证」由 244 处增至 405 处，每一处都能在《紫微斗数全书》原文里逐字找到

**3. 排盘引擎同步**（[PR #39](https://github.com/Renhuai123/ziwei-doushu/pull/39)）—— `dst-cn.ts` 新增 `chinaDSTSpan(year)`，查某年中国夏令时起止；`cities.ts` 补全省直辖县级单位与新疆兵团各市的经度（神农架、海南各市县、阿拉尔等），出生地选这些城市时真太阳时校正可用。

**4. 许可** —— [`DATASET-LICENSE`](./DATASET-LICENSE) 适用范围加上 v4.0；写明解读里引用的倪师原话不在数据授权范围内，与第五章倪师原话的 CC BY-NC-SA 4.0 一致。v3.0 样本数据集及其条款不变。

> **2026-10-27 补充**：排盘引擎同步——`true-solar-time.ts` 支持海外出生地：传 `utcOffsetMinutes`（出生地时区的固定标准偏移），按当地时区中央经线做经度修正，国内不传时结果逐位不变；新增 `clock-adjust.ts`，把夏令时、或当年时区与现在不同时的**钟表读数换成标准时间**（跨日不改，交给用户），建议做成用户亲手点、可撤销的按钮，不要自动改。顺带更正：中国夏令时引擎**只判定、从不自动扣除**，此前「引擎能力」表写成「自动扣除」，有误。

> **2026-10-24 补充**：项目理念移到页首——标题下居中一句「算法是公开的传统智慧，不应该被锁在围墙里」，紧接两段理念原文（前标「项目理念」），原有介绍段前标「项目信息」；第十章「项目理念」改为指向页首。

> **2026-10-20 补充**：星曜亮度默认改为《斗数全书》，与主流排盘软件默认一致，此前默认的「现代修正 v2」仍可在流派设置里选；补齐天姚、天刑、天喜、大耗、解神、截空、副截、旬空的亮度，月德不再标亮度。用 5 张金标准盘逐宫核对，星曜落宫与亮度全部吻合。注意：v4.0 数据集（10-15）是按旧默认「现代修正 v2」生成的，其中亮度字和少量随亮度变化的解读句会与新默认不同。

> **2026-10-06 ~ 10-07 补充**：README 加「注：关于六亲判断」（倪师原话 + 出处链接，中英两份）；网站链接加渠道码 `?from=`；同步倪师原话语料勘误（主星南斗、北斗归属）。

### 上一轮更新（2026-09-21）


> **2026-10-03 补充**：倪师《天纪·紫微斗数》原话 1848 条单独成章（第五章）；合并外部贡献 #29（时辰序号校验）；引擎拒绝不存在的公历日期，数据集补字段口径与已知问题；提交 package-lock.json；站点地址改为可配置；合盘演示改用本地引擎起盘、AI 接口缺失时明确提示；补齐贡献指南、行为准则、问题与 PR 模板；新增英文简介 [README.en.md](./README.en.md)；去掉两个用不上的部署工具包（vercel CLI、@cloudflare/next-on-pages），依赖从 483 个减到 185 个；随后升级到 Next.js 16 修掉 postcss 漏洞，GitHub 安全提醒从 51 条清零。

![本轮更新总览](./docs/update-20260921.png)

时隔三个月，本仓库完成一次完整更新（[PR #28](https://github.com/Renhuai123/ziwei-doushu/pull/28)，26 个文件、+2736 / −108 行）：

**1. 排盘引擎同步到线上口径** —— `algorithm.ts` 从 181 行到 641 行，另更新 sihua / types / constants / patterns / cities / famous；新增 8 个模块（1367 行）：

| 模块 | 作用 |
|------|------|
| `true-solar-time.ts` | 真太阳时校正（经度差 + 均时差） |
| `dst-cn.ts` | 中国 1986–1991 夏令时 |
| `clock-adjust.ts` | 钟表读数换成标准时间（夏令时 / 当年时区不同） |
| `lunar-solar.ts` | 农历 / 公历互转与闰月边界 clamp |
| `school-data.ts` / `school-tables.generated.ts` / `school-config.ts` | 星曜亮度流派数据与对照表、闰月与晚子时口径配置 |
| `shier-shen.ts` | 十二神煞 |
| `yunxian-context.ts` | 运限上下文（含童限） |

**2. 补上回归测试与 CI** —— 此前本仓库没有任何测试。现在 5 条排盘回归，`npm test` 一条命令跑完，每次 push 与 PR 在 GitHub Actions 上自动跑。

**3. 修掉样本时辰注释错位**（[#26](https://github.com/Renhuai123/ziwei-doushu/issues/26)）—— `famous.ts` 里 11 条名人样本有 7 条的时辰注释与 `hour` 索引不符（`hour` 一直是**时辰地支索引 0–11**，不是 0–23 的小时数）。已改正并加回归钉住。

**4. 积压 issue 从 18 条清到 4 条**，留下的都是还在走的。

**5. 文档与许可** —— 新增 [`DATASET-LICENSE`](./DATASET-LICENSE)；README 补齐引擎能力清单、维护节奏、开源边界；修正两处不实描述（数据集「口径与线上完全一致」、界面「完整的 Next.js 15 前端」）。

---

## 二·新、13 维解读数据集 v4.0（2026-10-15）

> **下载位置：本仓库右侧 [Releases → v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d)**

v4.0 用 2026-10-15 版网站断语库重新生成：13 个分析维度的断语已按倪海厦《天纪》逐字稿与《紫微斗数全书》原文逐句校正——查不到出处的引文删去或换成逐字可查的原话（倪师原话注明《天纪》集数与时间码），不会发生的四化相关句子删去，有条件的断语写明条件。

### 规格

| 项目 | 说明 |
|------|------|
| 命盘数 | **674,976 张**（公历 1950–2026 年 × 真实每月天数 × 12 时辰 × 男女） |
| 解读段数 | **8,774,688 段**（每张盘 13 维） |
| 维度 | 命格总览、性格、感情、事业、财运、健康、兄弟、子女、迁移、人际、田宅、福德、父母 |
| 大小 | 解压后 56.6 GB；压缩后 161 MB（77 个年份文件，zstd；另有一个全年份总包 `ziwei-interp-v4-all.tar`） |
| 正文 | 约 204 亿字，每张盘约 3.0 万字 |
| 生成方式 | 排盘引擎 + 断语库确定性生成，不经 AI，同一输入恒得同一输出 |
| 内容版本 | `ca268829f7a9`（与网站同期的 ANALYSIS_CONTENT_VERSION） |

**每行一张盘**（JSON Lines），字段：

| 字段 | 含义 |
|------|------|
| `k` | 键：`YYYY-MM-DD-时辰序号-性别`，如 `1990-01-01-0-male` |
| `y` / `m` / `d` | **公历**出生日期；只含真实存在的日期（不再有 2 月 30 日之类） |
| `h` | **时辰序号 0–11**（子 = 0 …… 亥 = 11），不是钟点；对照表见上一节 |
| `g` | `male` / `female` |
| `ms` | 命宫第一颗主星；命宫无主星时为 `null` |
| `t` | 各维字数 |
| `c` | 13 维解读全文（Markdown），键为 `overview` / `personality` / `love` / `career` / `wealth` / `health` / `family` / `children` / `move` / `friends` / `home` / `spirit` / `parents` |

**口径说明**
- 是本命盘视图的解读；网站上按读者当前年龄改写的句子、各维末尾附加的倪师法则段、AI 解读都不在数据集里。
- 按时辰序号直接排盘，未按出生地做真太阳时校正。

### 下载与解压

```bash
# 一次下全部：gh release download v4.0-13d --repo Renhuai123/ziwei-doushu -p "ziwei-interp-v4-all.tar"
# 只要某几年就只下那几年，例如 1990 年
zstd -d --long=27 year-1990.jsonl.zst          # 得到 year-1990.jsonl
shasum -a 256 -c SHA256SUMS.txt --ignore-missing # 校验
```

`--long=27` 必须带上（压缩时用了长窗口）。Windows 可用 [zstd 官方发布包](https://github.com/facebook/zstd/releases) 里的 zstd.exe，参数相同。

### 引文说明

解读里引用的倪海厦《天纪》原话**不属于本数据集的授权范围**：它们是为说明断语出处而注明集数与时间码的简短引用，著作权归原权利人；要把这些原话单独成批使用，按第五章倪师原话的 [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md) 处理。《紫微斗数全书》原文属公有领域。

### 许可

与 v3.0 相同：**CC BY 4.0，可自由商用，唯一要求是保留来源标注**（上面「引文说明」里的倪师原话除外），完整条款见 [DATASET-LICENSE](./DATASET-LICENSE)。引用时请写：

> 本项目使用了 **紫微斗数开源解读数据集 v4.0**（674,976 张命盘 × 13 维）
> 来源：https://github.com/Renhuai123/ziwei-doushu
> 作者：王多鱼AI

---

## 二、51.8 万命盘样本数据集

> **下载位置：本仓库右侧 [Releases](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v3.0-samples) 页面**

我们开源了一套完整的紫微斗数命盘样本数据集，覆盖 **51.8 万种排盘组合**（年 60 × 月 12 × 日 30 × 时 12 × 性别 2），每条样本包含完整的命盘结构和基于倪海厦体系的解读文本。

### 2.1 数据规格

| 项目 | 说明 |
|------|------|
| 样本数量 | **518,400 条** |
| 总大小 | 压缩后 5.5 GB（分 3 卷），解压后 33.1 GB |
| 体系 | 倪海厦《天纪》正统（纯飞星派已下线） |
| 内容 | 命盘 JSON + 13 主题解读文本（命格总览、财运、事业、感情、健康等） |
| 验证 | 男女命差异化 100%、健康含子午流注 100%、女命含妇科保养 100% |
| 口径 | 由 **v3 版排盘引擎 + 当期断语库**生成；线上引擎在持续更新，新版输出与本数据集可能有差异 |

**字段口径**（每条样本由 `birthInfo` 生成，常被看错的是 `hour`）：

| 字段 | 含义 |
|------|------|
| `birthInfo.year` / `month` / `day` | **公历**出生日期：1924–1983 年（一个完整甲子），每月取 1–30 日 |
| `birthInfo.hour` | **时辰序号 0–11**，不是 0–23 点钟：子 = 0、丑 = 1 …… 亥 = 11 |
| `birthInfo.gender` | `male` / `female` |
| `birthInfo.longitude` | 固定 120（东经 120°，未做各地真太阳时校正） |
| 文件名 `YYYY-MM-DD-hHH-性别.json` | 其中 `hHH` 同样是时辰序号，例如 `h11` 是亥时，不是上午 11 点 |

时辰序号与钟点对照：

| 序号 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 时辰 | 子 | 丑 | 寅 | 卯 | 辰 | 巳 | 午 | 未 | 申 | 酉 | 戌 | 亥 |
| 钟点 | 23–1 | 1–3 | 3–5 | 5–7 | 7–9 | 9–11 | 11–13 | 13–15 | 15–17 | 17–19 | 19–21 | 21–23 |

23:00–23:59 出生（晚子时）按次日排盘、时辰取 0；00:00–00:59 出生（早子时）按当日排盘、时辰同样取 0。

**已知问题：约 2,520 条样本的日期并不存在。** 生成时每个月都取了 1–30 日，所以 2 月 30 日，以及非闰年的 2 月 29 日也生成了样本，共 105 个日期 × 12 时辰 × 2 性别 = 2,520 条，占 0.49%。v3 引擎遇到这类日期不报错，而是顺延成 3 月 1–2 日排盘，所以这些样本的内容与对应的 3 月 1–2 日样本重复。使用时请过滤掉：`month = 2` 且 `day = 30`，或 `month = 2` 且 `day = 29` 且该年不是闰年。引擎从 2026-10-03 起会直接拒绝不存在的日期，下一版数据集不会再有这类样本。

### 2.2 下载方式

前往 [Releases](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v3.0-samples) 下载以下文件：

```
ziwei-samples-v3-part1.zip.001  (1.9 GB)
ziwei-samples-v3-part2.zip.002  (1.9 GB)
ziwei-samples-v3-part3.zip.003  (1.8 GB)
SHA256SUMS.txt                  (校验文件)
```

下载后合并解压：

```bash
# macOS / Linux
cat ziwei-samples-v3-part*.zip.* > combined.zip
unzip combined.zip

# Windows (PowerShell)
Get-Content ziwei-samples-v3-part*.zip.* -Encoding Byte -ReadCount 0 | Set-Content combined.zip -Encoding Byte
Expand-Archive combined.zip
```

### 2.3 用途

- 微调小模型的训练语料（51.8 万 input-output 配对）
- AI 对话的 RAG 检索源
- 修改 `patterns.ts` 后做 A/B 基线对比
- 紫微斗数研究与数据分析

### 2.4 数据许可与引用

📂 **完全开源 · 可自由商用** —— 你可以在任何项目里使用这套数据，包括但不限于：

- 商业产品 / SaaS / 付费应用
- AI 模型微调（开源或闭源模型均可）
- 二次开发、再分发、衍生数据集
- 学术研究、技术博客、教学课程

无需付费、无需申请、无需事先告知。

**唯一的要求是保留数据来源标注（attribution）**：

> 本项目使用了 **紫微斗数开源样本数据集 v3.0**（518,400 条）
> 来源：https://github.com/Renhuai123/ziwei-doushu
> 作者：王多鱼AI

放在哪里都行：

- **网页 / 产品**：About 页 / 关于我们 / 数据来源 / 页脚，写一行链接即可
- **AI 模型**：模型卡（Model Card）或数据集卡（Dataset Card）的 "Training Data" 字段
- **学术论文**：参考文献或致谢章节
- **二次发布的数据集**：README 或 metadata 文件里注明上游来源

仅此一条，其余都自由。完整条款见 [DATASET-LICENSE](./DATASET-LICENSE)。希望这套数据能帮你做出好东西 —— 做出来记得来小红书 / 抖音 / 闲鱼 **@王多鱼AI** 打个招呼 👋

---

## 三、快速开始

```bash
# 克隆
git clone https://github.com/Renhuai123/ziwei-doushu.git
cd ziwei-doushu

# 安装依赖
npm install

# 配置环境变量（只看排盘可以跳过；要用 AI 解读才需要填 Key）
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

本地验证：

```bash
npm run typecheck   # TypeScript 全量类型检查
npm test            # 排盘引擎回归（768 盘 × 紫微铁律、夏令时、立春边界、红鸾天喜、样本时辰一致性、时辰序号边界、日期合法性、同宫双四化）+ AI 解读纯逻辑回归 + 历史记录回归（本地存储 / 加密 / 接口隐私模型 / 前端接线）
```

每次 push 与 PR 都会在 GitHub Actions 上跑同一套（见 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)）。

> **排盘不需要任何 API Key。**排盘、命盘展示、合盘起盘都在浏览器里用本仓库的引擎完成。

### AI 解读（`/api/interpret` 与 `/api/heming`）

上游商业版的 AI 解读 prompt 与后端路由不开源。本仓库**提供了一套可用的开源实现**：把排盘引擎的真实输出（十二宫星曜、亮度、四化落宫、命盘格局、大限流年）序列化成「盘面文字」交给大模型，要求它**只依据盘面数据推理**，再用 SSE 流式返回。

| 文件 | 作用 |
|---|---|
| `lib/ai/config.ts` | 环境变量解析：协议、端点、密钥、模型、token 预算 |
| `lib/ai/provider.ts` | 流式客户端：Anthropic Messages 协议 + OpenAI 兼容协议 |
| `lib/ai/chart-context.ts` | 命盘 → 盘面文字（12 宫、亮度、四化、三方四正、格局） |
| `lib/ai/prompt.ts` | 解读 / 合盘两套 system prompt（合盘复用 `heming-knowledge.ts`） |
| `lib/ai/sse.ts` | SSE 事件封装（与前端 `data: {"delta":{"text":...}}` 约定一致） |
| `lib/ai/validate.ts` | 请求体校验 + 出生地白名单（防注入） |
| `lib/ai/sanitize.ts` | 输出净化：去掉模型偶尔混进来的英文单词 |
| `lib/ai/guard.ts` | 公网防护：单 IP 限流 + 全局并发上限 + 每日配额 |
| `lib/ai/handlers.ts` | 解读 / 合盘 / 健康检查的共享处理器（Next 路由与 Cloudflare Pages Functions 共用） |
| `lib/ai/error-text.ts` | 把接口失败翻译成一句能看懂的中文（状态码 + 服务端原文） |
| `lib/ai/client-stream.ts` | 前端共用的 SSE 读取器：分片拼接、错误可见化、断流自动重试 |
| `app/api/interpret/route.ts` | AI 命盘解读 |
| `app/api/heming/route.ts` | 合盘 AI 分析 |
| `app/api/health/route.ts` | 诊断接口：配置对不对、额度用掉多少、模型通不通 |

在 `.env.local` 里配好模型即可，两种协议都支持：

```bash
# Anthropic 协议
AI_PROVIDER=anthropic
AI_BASE_URL=https://api.anthropic.com/v1
AI_AUTH_MODE=api-key          # 或 bearer（私有端点常用）
AI_API_KEY=sk-...
AI_MODEL=your-model-id

# OpenAI 兼容协议（DeepSeek / MiMo / OpenAI 等）
AI_PROVIDER=deepseek          # 或 mimo / openai
DEEPSEEK_API_KEY=sk-...
```

**用 MiniMax 开放平台 Key（`sk-cp-` / `sk-api-` 开头）时，端点要换**——它们不能打 agent 端点，会直接返回 `401 auth failed`：

```bash
AI_PROVIDER=anthropic
AI_PROTOCOL=anthropic
AI_BASE_URL=https://api.minimaxi.com/anthropic/v1   # Anthropic 兼容端点
AI_AUTH_MODE=bearer                                  # 开放平台走 Authorization: Bearer
AI_API_KEY=sk-cp-...
AI_MODEL=MiniMax-M3.1-Flash
```

OpenAI 兼容端点 `https://api.minimaxi.com/v1` 同样能通（把 `AI_PROTOCOL` 设成 `openai`）。换完 Key 先用诊断接口确认，别直接上线：

```bash
curl 'https://你的域名/api/health?probe=1'   # probe.ok=true 才算配对
```

> **`AI_MAX_TOKENS` 要给够。**带 thinking 的模型（MiniMax M3 等）会先花掉一大截输出预算做思考，给小了会在正文开始前就被截断——表现是「正文一个字都没有」。默认 16384；用 DeepSeek 时它最高输出 8K，请设 `AI_MAX_TOKENS=8192`。路由里带了兜底：被截断且零输出时会自动把预算翻 4 倍重试一次。

想接自己的模型，直接改 `lib/ai/provider.ts` 即可；`scripts/smoke-ai.ts` 是打真实模型的冒烟脚本（`npm run dev` 之后跑 `npx tsx scripts/smoke-ai.ts`）。

> **关于「正文不得中英夹杂」**：prompt 里已经下了硬规则，但生成侧仍会偶发写出「重道义、 fairness 与担当」这种句子。所以输出前还有一层净化（`lib/ai/sanitize.ts`）：删掉正文里的拉丁字母词，并把删除后残留的空括号、多余空格、重复顿号收拾干净。命理正文里不存在合法英文，数字与 Markdown 标记不受影响。

#### 公网暴露前必读：额度防护

排盘本身不花钱（浏览器本地算），**AI 解读要花钱**。站点一旦开到公网，任何拿到链接的人都能调 `/api/interpret` 和 `/api/heming` 消耗你的 API Key 额度。所以这两个接口默认就带一道闸（`lib/ai/guard.ts`）：

| 防护 | 默认值 | 环境变量 |
|---|---|---|
| 单个来源滑动窗口限流 | 每分钟 20 次 | `AI_RATE_LIMIT_PER_WINDOW` / `AI_RATE_LIMIT_WINDOW_MS` |
| 全局并发上限 | 同时 3 个模型调用 | `AI_MAX_CONCURRENT` |
| 全局每日配额 | 500 次/天 | `AI_DAILY_REQUEST_CAP`（设 0 = 不限） |

超限直接返回 `429` 和一句中文提示。前端会把它当成接口失败，所以别把这三项调到 0。本机自用可以调高，对外分享建议保持默认甚至更严。

> **默认值的由来**：一个人正常逛一张盘面就会连打十几次——每次打开 `/chart` 自动生成一次命格总览，每点一个宫位一次，每点一个四化一次。所以每分钟 6 次这种「看起来很严」的值，普通用户自己就能撞上，然后误以为「解读坏了」。全局日配额 60 次更坑：它是**全站共享**的，站点自己做实测就会把用户的额度吃光，而且失败提示只有一句「解读失败」，根本看不出是被限流了。
>
> 要更严就把 `AI_RATE_LIMIT_PER_WINDOW` / `AI_DAILY_REQUEST_CAP` 调小；要更松就调大，三项都是纯环境变量，改完重启即可，不用改代码。

> 上游明确声明「服务端安全（签名、防刷、水印）」不在开源范围。这里实现的是**额度层面的兜底**（限流 + 并发 + 日配额），不等于完整的用户系统与签名机制；要正式对外运营，请自行补上登录、签名与按用户计费。

#### 出问题时先看这里：`/api/health`

以前「解读失败」只能靠猜——前端把真实原因吞成一句「解读失败，请检查 API 配置或稍后重试」，而 serverless 的运行日志往往留不住当时那一次请求。现在有两个入口：

**1. 诊断接口**（Next 与 Pages 都有，不返回任何密钥内容）：

```bash
curl https://你的域名/api/health
# {"ok":true,"ai":{"ok":true,"summary":"anthropic 协议 · bearer 鉴权 · … · 模型 MiniMax-M3.1-Flash"},
#  "guard":{"options":{"maxPerWindow":20,"maxConcurrent":3,"dailyCap":500},
#           "stats":{"concurrent":0,"dayCount":0,"trackedKeys":0},"clientKey":"…"}}

curl 'https://你的域名/api/health?probe=1'   # 再真打一次模型，确认 Key 与额度确实可用
# "probe":{"ok":true,"detail":"模型可达，返回 517 字节","ms":3095}
```

**2. 前端会把真实原因显示出来**：非 2xx 响应会显示 `HTTP 429：请求太频繁，请 12 秒后再试` 这样的完整信息（状态码 + 服务端原文），SSE 流里服务端报的错也会显示，不再是一句笼统的「解读失败」。连接被掐断时会显示现场信息，例如 `解读失败：连接中断，没有收到任何内容（耗时 12.3 秒）`。

**3. 前端会自动重试**：解读是长连接流式返回，途中被边缘节点掐断的概率不低。`lib/ai/client-stream.ts` 里做了统一处理——**一个字都没收到时自动重试（最多 3 次，每次重新暖连接并退避 800 毫秒）**（已经收到正文就不重试，否则会出现两份内容）；同时修正了老代码的一个丢内容 bug：网络包把一行 SSE 从中间切断时，老代码直接丢掉半行，现在用 carry-over 缓冲区正确拼行。断流的错误文案还会带上「断前收到 N 次服务端心跳」——收到过心跳就说明服务端还活着、是链路被掐；一次心跳都没收到才是服务端没开始响应。

**4. 开流即发「已受理」事件**：模型带 thinking 时，要思考 20~40 秒才吐第一个字。这期间服务端只发注释行心跳（`: open`），有些中间件（CDN / 代理 / 浏览器的 HTTP/2 层）只把**真正的内容**当作「响应已经开始」，于是迟迟不推响应头，到超时点直接掐断连接——前端拿到的就是一个没有解释的 `network error`。所以开流后立刻补一个真正的 data 事件（`{"status":"accepted"}`），生成期间的心跳也同时发 `{"status":"waiting"}`，保证连接上每 10 秒就有一次真实内容。

**5. 一键自检脚本**（部署完 / 换完 Key 之后跑一下就知道通没通）：

```bash
node_modules\.bin\tsx scripts/check-live.ts https://你的域名 --probe
```

它会依次检查健康接口、模型可达性、完整跑一遍 SSE 解读、再做一次并发压测确认**失败时返回的是可读原因**。

**从公网访问（隧道 / 反向代理）还要注意**：`next dev` 会拦截跨源的 `/_next/hmr` 与 `/__nextjs_font/*`，从公网域名打开时控制台会刷 "Blocked cross-origin request to Next.js dev resource"。本仓库已在 `next.config.js` 里放开：

```js
allowedDevOrigins: ['*.trycloudflare.com'],
```

用通配符是为了兼容隧道每次重启都会变的随机域名；换成自己的域名，把通配符换成具体域名即可（改完要重启 dev server）。正式部署用 `next build && next start` 则不受此限制。

**SSE 心跳**：解读是流式返回的，模型思考可能要几十秒。这期间如果响应体里一个字节都不来，浏览器（Chromium / Electron）大约 5 秒就会把连接掐掉，表现为前端拿到一个没有解释的 `TypeError: network error`——服务端明明还在正常跑。所以实现里在流的**开头**立刻发一个真正的 data 事件（`{"status":"accepted"}`），并在**生成期间每 2.5 秒**发一次心跳（`: open` 注释行 + 一个真正的 `{"status":"waiting"}` 事件）。注释行有些中间件不认，只发注释的话它们可能在超时点直接掐断连接；真正的事件能保证任何一层都不会误判「响应已经开始」。前端会忽略没有 `delta` / `error` 字段的事件。

**发请求前先暖连接**：解读是 POST，Chromium 出于安全**不会自动重试 POST**（重试 POST 不幂等）。如果连接已经被边缘节点悄悄关掉，这个 POST 就会直接失败。所以正式请求前先打一个廉价的 `GET /api/health`——GET 是幂等的，浏览器遇到断掉的连接会自己重试到新连接上，后面的 POST 就落在一条好连接上了（见 `lib/ai/client-stream.ts` 的 `primeConnection`）。再加上「一个字都没收到就自动重试」，双保险。

**Safari（WebKit）上的特殊处理**：`fetch()` 的流式响应在 WebKit 上有个已知缺陷（[WebKit Bug 322545](https://bugs.webkit.org/show_bug.cgi?id=322545)，Safari 26 / macOS 26）——当页面增量读取响应体时，**被扣下的字节只有服务端再发数据时才会释放**，而且「**流安静下来后最后一段永远送不到**」。我们服务端最后一条 `data: [DONE]` 正好属于「安静下来后不再有数据」的那一段，于是 Safari 会一直等不到结束标记，表现为解读卡住、最后超时失败。Chrome 和 Firefox 不受影响（内置浏览器是 Chromium 内核，所以它不受这条影响）。实现里检测到 WebKit（桌面 Safari、iOS 上的所有浏览器）就改用 `XMLHttpRequest` 读流：它的 `onprogress` 是「服务器给了多少就给多少」，不依赖 ReadableStream 的拉取模型，末帧能可靠收到。

**已知问题：Chromium 侧偶发的「首连断流」**。在部分网络环境下，浏览器**第一次**发解读请求时连接会在几秒后被掐断（前端报 `TypeError: network error`），但同一接口在 Node、curl、直连、走本地代理、HTTP/1.1、HTTP/2、IPv4、IPv6 各种组合下都能完整收完——说明**服务端是健康的，问题在浏览器这条连接上**。目前靠上面的「暖连接 + 自动重试」兜底：用户看到的是一次「正在重试…」的提示，随后正文正常流出来。因为断流发生在模型吐字之前、此时上游模型请求也会被一并中止，所以不会白白烧掉 token 配额。

### 历史记录（默认只存本机，别人看不到）

每次解读或合盘出字后，问答会自动存进**你自己浏览器**的本地存储，解读面板、合盘页、以及 `/chart` 未起盘时的页面顶部都能展开查看：列表、展开看全文、「回到这个命盘」接着追问、单条删除、导出 / 导入 JSON。

**隐私模型**（这是这个功能的核心）：

| | 存在哪 | 别人能不能看到 |
|---|---|---|
| 本地历史（默认） | 你这台设备的 `localStorage` | **不能**。数据压根没离开设备，服务器完全不知道 |
| 云备份（可选） | Cloudflare KV / Upstash | **不能**。存上去的是**客户端加密后的密文**，服务器没有同步码就解不开 |

云备份的加密在**浏览器里**完成：同步码经 PBKDF2-SHA256（20 万次）派生 AES-GCM-256 密钥，正文加密后才上传。服务器上只有密文，以及一个由同步码另一次 PBKDF2 派生（10 万次）出来的存放位置——同步码明文不上传，服务器也没有解密手段。

所以「本地那一份才是本体」：**同步码丢了只是云端备份取不回，本地历史不受影响**。同步码可以一键生成（24 字节随机 = 192 位熵），也可以自己写口令（至少 12 个字符）。

| 文件 | 作用 |
|---|---|
| `lib/history/types.ts` | 数据模型、上限常量、同步码请求头名 |
| `lib/history/local.ts` | 本地存储层：读写、条数/体积双上限、导入导出、变更事件 |
| `lib/history/crypto.ts` | PBKDF2 + AES-GCM 封装（加密、解密、随机同步码） |
| `lib/history/cloud.ts` | 云备份客户端：上传 / 下载 / 删除 / 探测 |
| `lib/history/kv-store.ts` | KV 抽象：Cloudflare 绑定 / Upstash REST / Cloudflare REST 三种后端 |
| `lib/history/history-api.ts` | `/api/history` 共享处理器（Next 路由与 Pages Functions 共用） |
| `lib/history/record.ts` | 写历史的统一入口 |
| `lib/history/restore.ts` | 把历史里的命盘暂存到 `sessionStorage`，供 `/chart` 恢复现场 |
| `components/HistoryPanel.tsx` | 历史面板（列表 / 全文 / 导出导入 / 云备份开关） |
| `app/api/history/route.ts`、`functions-src/api/history.ts` | 两个部署目标的接口入口 |

容量上限：本地最多 **30 条**、总体积不超过 **2 MB**，超了从最旧的一条开始丢。`/api/history` 自带 30 次/分的单 IP 闸，不占用 AI 解读的日配额。

「回到这个命盘」有两种路径都覆盖了：从合盘页跳回排盘页（走 `sessionStorage` 暂存 + `?restore=1`），以及**已经在排盘页时换回另一张盘**（路由不变、组件不会重挂载，所以额外派发一个窗口事件直接换盘）。恢复后会自动把 `?restore=1` 从地址栏去掉，免得下次进来又自动恢复。

**开启云备份**（可选，不开也完全能用）：

```bash
# 1) 建 KV 命名空间
wrangler kv namespace create HISTORY_KV
#    记下返回的 namespace id

# 2) 绑定到 Pages 项目（两种方式任选）
#    a) wrangler.toml 里写（scripts/build-pages.mjs 会自动写进去）：
#       [[kv_namespaces]]
#       binding = "HISTORY_KV"
#       id = "<namespace-id>"
#    b) 或者用 Cloudflare API 写进项目设置：
#       PATCH /accounts/{account}/pages/projects/{project}
#       {"deployment_configs":{"production":{"kv_namespaces":{"HISTORY_KV":{"namespace_id":"<id>"}}}}}

# 3) 部署
npm run build:pages
wrangler pages deploy out --project-name ziwei-doushu
```

Vercel 侧没有 Cloudflare 绑定，可以改用 Upstash（`KV_REST_API_URL` + `KV_REST_API_TOKEN`）或 Cloudflare KV 的 REST 接口（`CF_ACCOUNT_ID` + `CF_KV_NAMESPACE_ID` + `CF_API_TOKEN`）。**都不配也不影响使用**——本地历史照常工作，面板会提示「当前部署没有启用云备份」。

### 部署到 Cloudflare Pages（`pages.dev` 在大陆可直接访问）

排盘本身是纯浏览器计算，AI 解读需要服务端，所以这个仓库有两种部署形态：

| | Vercel | Cloudflare Pages |
|---|---|---|
| 域名 | `*.vercel.app` | `*.pages.dev` |
| 大陆可达性 | **被按 SNI 封锁**，多数网络打不开 | 可直接访问 |
| 服务端接口 | Next Route Handler（`app/api/*`） | Pages Functions（`functions/api/*`） |
| 两边的处理逻辑 | 共用 `lib/ai/handlers.ts`，协议完全一致 | 同左 |

> 踩坑记录：`*.vercel.app` 在大陆是 DNS 污染 + TLS 握手按 SNI 重置双重封锁（同一台机器上 `api.vercel.com` 正常返回，而 `*.vercel.app` 在握手阶段被 RST）。所以面向大陆用户的部署应该走 `pages.dev` 或自有域名。

Pages 这条路的构建脚本是 `scripts/build-pages.mjs`，它做三件事：

1. 跑 Next 的静态导出（`output: 'export'`）产出 `out/`。导出模式下 `next.config.js` 会把 `pageExtensions` 收窄成 `['tsx']`，把 `app/api/*` 这些服务端路由挡在构建之外；
2. 用 esbuild 把 `functions-src/api/*.ts` 打成 Workers 运行时能跑的 ESM，放进 `functions/`；
3. 写出 `wrangler.toml`。

```bash
# 依赖：npm i -g wrangler
npm run build:pages            # 等价于 node scripts/build-pages.mjs

wrangler login                 # 浏览器里授权一次
wrangler pages project create ziwei-doushu

# 密钥走 secret，不要写进仓库
wrangler pages secret put AI_API_KEY --project-name ziwei-doushu
wrangler pages secret put AI_MODEL --project-name ziwei-doushu
# 其余变量（AI_PROVIDER / AI_PROTOCOL / AI_BASE_URL / AI_AUTH_MODE / AI_MAX_TOKENS / AI_TIMEOUT_MS）
# 在 Pages 控制台的 Settings → Environment variables 里加

wrangler pages deploy out --project-name ziwei-doushu
```

本地先验一把（不需要登录）：`node scripts/make-dev-vars.mjs` 会把 `.env.local` 转成 `.dev.vars`，然后 `wrangler pages dev out --port 8788` 就能在本地用真正的 Workers 运行时跑 `/api/interpret`、`/api/heming`。

> 注意：Pages Functions 拿到的环境变量在 `context.env` 里，不是 `process.env`。所以 `lib/ai/handlers.ts` 的两个处理器都显式接收环境变量对象，Next 侧传 `process.env`、Pages 侧传 `context.env`，两边共用同一份逻辑。`.dev.vars`、`out/`、`functions/`、`.wrangler/` 都已在 `.gitignore` 里。

---

## 四、排盘引擎

排盘内核全部在 `lib/ziwei/`。

### 4.1 能做到什么（与常见排盘库的差异）

| 能力 | 说明 |
|------|------|
| **真太阳时校正** | 按出生地经度算时差 + 均时差，避免东西向差一个时辰 |
| **中国夏令时** | 1986–1991 年的夏令时区间自动判定（只判定、不自动扣除；钟表读数由用户确认后用 `clock-adjust.ts` 换成标准时间） |
| **闰月四种口径** | 闰月归前月 / 归后月 / 按日切分 / 按本月，可配置，不写死一派 |
| **晚子时换日** | 23:00–23:59 按次日排盘、00:00–00:59 按本日；换日策略可切换 |
| **星曜亮度 7 档** | 庙 / 旺 / 得 / 利 / 平 / 不 / 陷，另保留 3 档粗分类做显示降级 |
| **亮度流派可切换** | 不同流派（含主流排盘软件的不同版本）对辅星亮度判法不一致，做成开关而非写死 |
| **四化与飞星** | 生年四化、大限 / 流年四化、飞星自化 |
| **十二神煞** | 本命层按生年支起，流年层改按流年支起 |
| **格局判定** | 1100+ 行规则库（紫府同宫、日月并明、七杀朝斗等） |

### 4.2 文件怎么分

| 文件 | 说明 |
|------|------|
| `algorithm.ts` | 完整排盘流程：安命宫、定五行局、安十四主星、安辅星、排大限流年 |
| `constants.ts` | 天干地支、十四主星、辅星常量 |
| `sihua.ts` | 四化飞星系统（禄权科忌），含各天干四化对照表 |
| `patterns.ts` | **1100+ 行格局知识库**：紫府同宫、日月并明、七杀朝斗等经典格局判定规则 |
| `heming-knowledge.ts` | 合盘方法论：倪师体系下双盘比对逻辑 |
| `types.ts` | TypeScript 类型定义 |
| `cities.ts` | 中国城市经纬度，用于真太阳时校正 |
| `famous.ts` | 历史名人命盘示例数据 |
| `school-data.ts` / `school-tables.generated.ts` / `school-config.ts` | 星曜亮度流派数据与对照表、闰月与晚子时口径配置 |
| `shier-shen.ts` | 十二神煞（本命按生年支起、流年层按流年支起） |
| `true-solar-time.ts` | 真太阳时校正（经度差 + 均时差） |
| `dst-cn.ts` | 中国 1986–1991 夏令时年份与区间 |
| `clock-adjust.ts` | 钟表读数按分钟平移成标准时间（跨日不改） |
| `yunxian-context.ts` | 运限上下文（含童限处理） |
| `lunar-solar.ts` | 农历 / 公历互转与闰月边界 clamp |

### 4.3 古籍原文（`lib/classics/`）

- **骨髓赋**（`gusuifu.ts`）— 紫微斗数核心歌诀
- **紫微斗数全集**（`quanji.ts`）— 清代古本
- **紫微斗数全书**（`quanshu.ts`）— 陈希夷传本

### 4.4 SEO 知识图谱（`lib/seo/`）

14 主星 × 12 宫位的结构化知识数据，可用于内容生成或知识库构建。

---

## 五、倪师《天纪·紫微斗数》原话

![倪海厦《天纪·紫微斗数》一图看全](./docs/tianji-ziwei/overview.png)

倪海厦《天纪》紫微斗数部分的原话共 **1848 条**：正课 14 讲（第 2–15 讲上半）加 2 段补充，按讲分成 16 个文件，放在 [`docs/tianji-ziwei/`](./docs/tianji-ziwei/)。每条都带出处时间，点一下就跳回 B 站原视频的那一秒。

- **怎么读**：先在上图里找到想看的主题，再点进对应那一讲，比如 [5上](./docs/tianji-ziwei/5%E4%B8%8A.md)（紫微在子）、[13上](./docs/tianji-ziwei/13%E4%B8%8A.md)（杀破狼、科权禄三会）。
- **从哪来**：取自姊妹仓库 [nihai-tianji-corpus](https://github.com/Renhuai123/nihai-tianji-corpus)，以语料库为准，会随语料库同步。
- **能不能商用**：**不能**。这一章的内容单独采用 CC BY-NC-SA 4.0，详见[九、协议](#九协议)。

---

## 六、界面是一份 Demo

界面代码在 `app/` 与 `components/`。仓库里的界面是**一套最小可运行示例**，作用是把排盘引擎跑起来、把盘画出来，方便你在它基础上做自己的产品。**线上商业版的界面不在开源范围内**，两者差距很大：

| 页面 / 组件 | 本仓库（Demo） | 线上商业版 |
|------|------|------|
| 排盘页 `app/chart/page.tsx` | 75 行 | 1227 行 |
| 解读面板 `InsightPanel` | 467 行 | 5088 行 |
| 命盘方格 `ChartBoard` | 285 行 | 1334 行 |
| 宫位格 `PalaceCell` | 201 行 | 1192 行 |
| 合盘页 `app/heming/page.tsx` | 368 行 | 1937 行 |

**Demo 能跑通的**：出生信息表单、命盘方格与宫位详情、本命 / 大限 / 流年切换、古籍阅读器（全文搜索）、命理百科（14 主星 × 12 宫位）、亮暗主题、移动端适配。

**Demo 里没有的**：线上重做过的交互界面、AI 流式解读、合盘图谱、分享卡片，以及**断语内容本身**（`db-analysis.ts` 是占位实现）。也就是说，Demo 画得出盘，但给不出线上那套解读。

---

## 七、开源边界：什么不在里面

| | 内容 |
|---|---|
| ✅ **开源** | 排盘引擎（`lib/ziwei/`）、古籍公版原文（`lib/classics/`）、SEO 知识图谱（`lib/seo/`）、Demo 界面、51.8 万样本数据集、13 维解读数据集 v4.0、AI 解读接口的一套可用实现（`lib/ai/` + `app/api/`，prompt 自行编写、非上游那一版） |
| ❌ **不开源** | 断语库（`lib/ziwei/db-analysis.ts` 是占位，线上是上万行的 13 主题断语）、上游那一版 AI 解读 prompt、后端 API 的完整工程化（用户系统 / 登录 / 会员 / 支付、服务端安全如签名与防刷与水印）、部署配置 |

AI 解读的可用实现见「三、快速开始 → AI 解读」一节；上游那一版 prompt 与断语库仍然不在开源范围，本仓库这套是基于排盘引擎真实输出自己写的。

---

## 八、维护节奏与贡献

这个仓库是**排盘引擎 + 数据集的开放快照**，不是一个全职维护的开源产品，说清楚免得大家猜：

- **引擎同步**：随线上发版同步 `lib/ziwei/` 的引擎层并打 tag；断语库、AI 解读、商业站前端不在同步范围内。
- **Issue**：会看，但回复可能不及时；带复现步骤或具体盘例（年月日时 + 性别 + 哪一条不对）的问题优先处理。
- **PR**：欢迎，尤其是回归测试、口径修正、文档。动到排盘口径的改动请附上依据（古籍原文或可核对的对照）。

---

## 九、协议

本仓库分四部分授权。前三部分是宽松协议，**商用没有限制**；倪师原话目录**不许商用**：

| 内容 | 协议 | 简单说 |
|------|------|--------|
| **代码**（`lib/`、`app/`、`components/`） | [MIT License](./LICENSE) | 拿去随便用，保留 LICENSE 文件即可 |
| **数据**（Releases 中的 51.8 万样本数据集 v3.0、13 维解读数据集 v4.0） | [CC BY 4.0](./DATASET-LICENSE) · 要求 attribution | 商用也行，**注明数据来源即可** |
| **古籍原文**（骨髓赋、紫微斗数全集 / 全书等） | Public Domain | 古书都是公有领域，不存在版权 |
| **倪师原话**（[`docs/tianji-ziwei/`](./docs/tianji-ziwei/)） | [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md) | 可以引用、转载，注明出处；**不许商用**，改编后用同样协议 |

**一句话**：代码和数据拿去用，商用也行，把来源链接带上就行；倪师原话只限非商业的学习研究（数据集解读里引用的倪师原话同样不在数据授权范围内）。

---

## 十、关于与联系

### 项目理念

见本页开头。想自己搭？代码都在这里，拿去用。嫌麻烦？来 [metisziwei.com](https://metisziwei.com/?from=gh-readme) 直接用。

### 技术栈

- **框架**：Next.js 16（App Router）
- **语言**：TypeScript
- **样式**：Tailwind CSS + CSS Variables 设计系统
- **排盘**：基于 [iztro](https://github.com/SylarLong/iztro) + lunar-javascript
- **动画**：Framer Motion

### 联系

- 线上平台：[metisziwei.com](https://metisziwei.com/?from=gh-readme)（已完成 ICP 备案：渝ICP备2026013379号-1）
- 提问题、提修复：见 [CONTRIBUTING.md](./CONTRIBUTING.md)；使用交流请到 [讨论区](https://github.com/Renhuai123/ziwei-doushu/discussions)
- 💕 发财的小手点一下：小红书 / 抖音 / 闲鱼 / X 关注 **王多鱼AI**，第一时间看上线 + 解锁更多紫微干货～
