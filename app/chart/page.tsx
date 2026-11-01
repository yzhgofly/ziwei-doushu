'use client';
import { useCallback, useEffect, useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import HistoryPanel from '@/components/HistoryPanel';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';
import { RESTORE_EVENT, takeStagedChart } from '@/lib/history/restore';

/**
 * 命盘页 —— 开源版「排盘引擎 Demo」
 *
 * 这是一个最小可运行示例：用本仓库的排盘引擎 generateChart() 配合基础 UI
 * 组件，渲染一张完整紫微命盘 + 基础解读，并支持本命 / 大限 / 流年切换。
 *
 * 说明：线上商业版的完整交互界面（重设计的新 UI、AI 流式解读、合盘、分享
 * 卡片等）不在开源范围内；但排盘内核——安星算法、四化、格局识别、古籍库——
 * 完全开放（见 lib/ziwei/*），可自由二次开发出你自己的界面。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());

  // ── 从历史记录恢复现场 ──
  // 两种来源都要接住：
  //   1. 整页跳过来（?restore=1 + sessionStorage 暂存盘）
  //   2. 同一页内换盘（历史面板派发 RESTORE_EVENT，路由不变、组件不重挂载）
  const applyRestoredChart = useCallback((restored: ZiweiChart) => {
    setChart(restored);
    setSelectedPalace(null);
    // 去掉 ?restore=1，免得下次进来又自动恢复
    try {
      if (window.location.search.includes('restore=1')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch { /* 忽略 */ }
  }, []);

  useEffect(() => {
    const onRestore = (e: Event) => {
      const restored = (e as CustomEvent<ZiweiChart>).detail;
      if (!restored) return;
      takeStagedChart();  // 同页恢复：把暂存那份清掉，别留着影响下次
      applyRestoredChart(restored);
    };
    window.addEventListener(RESTORE_EVENT, onRestore);
    // 整页跳过来的：取走暂存的盘
    const staged = takeStagedChart();
    if (staged) applyRestoredChart(staged);
    return () => window.removeEventListener(RESTORE_EVENT, onRestore);
  }, [applyRestoredChart]);

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>紫微斗数排盘</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 14, lineHeight: 1.7 }}>
          输入出生年月日时，开源排盘引擎即时生成命盘。
          <br />
          （本页为引擎 Demo，完整商业版界面不在开源范围；排盘内核完全开放。）
        </p>
        {/* 未起盘时也能看到历史：直接回看以前的解读，或一键恢复当时的命盘 */}
        <HistoryPanel />
        <div style={{ marginTop: '20px' }}>
          <BirthForm onSubmit={(info: BirthInfo) => setChart(generateChart(info))} />
        </div>
      </main>
    );
  }

  // ── 已起盘：命盘 + 解读 ──
  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <button
        type="button"
        onClick={() => { setChart(null); setSelectedPalace(null); }}
        style={{
          marginBottom: 16, padding: '6px 14px', cursor: 'pointer',
          border: '1px solid #ccc', borderRadius: 8, background: 'transparent',
        }}
      >
        ← 重新起盘
      </button>

      <TimeNav
        chart={chart}
        view={view}
        liunianYear={liunianYear}
        onViewChange={setView}
        onYearChange={setLiunianYear}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
          gap: 20, marginTop: 16, alignItems: 'start',
        }}
      >
        <ChartBoard chart={chart} onPalaceSelect={setSelectedPalace} />
        <InsightPanel chart={chart} selectedPalace={selectedPalace} />
      </div>
    </main>
  );
}
