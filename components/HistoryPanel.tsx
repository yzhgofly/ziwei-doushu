'use client';
/**
 * 历史记录面板
 *
 * 隐私设计（这是这个组件最重要的部分）：
 *
 *   1. **默认只存本地**：历史写在浏览器 localStorage 里，数据压根不发给服务器。
 *      别人打开这个网址，看到的是自己的空历史——你的记录他碰不到。
 *   2. **云备份是可选的**：开了之后传的是**客户端加密后的密文**，
 *      同步码只有你自己知道，服务器上只有 PBKDF2 派生出来的存放位置。
 *      就算有人拿到服务器上的数据，没有同步码也解不开。
 *   3. **本地那一份才是本体**，云端只是备份——同步码丢了也不影响本地历史。
 *
 * 组件同时提供：列表、展开看全文、回到当时的命盘继续追问、导出/导入、清空。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HistoryEntry } from '@/lib/history/types';
import {
  HISTORY_CHANGED_EVENT,
  clearHistory,
  exportHistory,
  importHistory,
  readHistory,
  removeHistoryEntry,
} from '@/lib/history/local';
import {
  deleteBackup,
  forgetSyncCode,
  getBackup,
  isSyncCodeAcceptable,
  loadSyncCode,
  probeCloud,
  putBackup,
  saveSyncCode,
} from '@/lib/history/cloud';
import { randomSyncCode } from '@/lib/history/crypto';
import { requestChartRestore } from '@/lib/history/restore';

interface HistoryPanelProps {
  /** 紧凑模式：放在侧边栏里，字号和间距更小 */
  compact?: boolean;
}

const BORDER = 'rgba(128,128,128,0.25)';
const MUTED = 'rgba(128,128,128,0.95)';

/** 相对时间：刚刚 / 12 分钟前 / 昨天 14:23 / 2026-10-30 */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return sameYear
    ? `${md} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getFullYear()}-${md}`;
}

/** 极简 Markdown 渲染：标题行 + 粗体 + 段落 */
function AnswerText({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {text.split('\n').map((line, i) => {
        const heading = line.match(/^\*\*(.+?)\*\*$/);
        if (heading) {
          return (
            <div key={i} style={{ paddingTop: i === 0 ? 0 : '10px', fontSize: '12px', fontWeight: 600 }}>
              {heading[1]}
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: '4px' }} />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} style={{ fontSize: '12px', lineHeight: 1.75, opacity: 0.85 }}>
            {parts.map((p, j) =>
              j % 2 === 0 ? p : <strong key={j} style={{ fontWeight: 600 }}>{p}</strong>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HistoryPanel({ compact = false }: HistoryPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncCode, setSyncCode] = useState('');
  const [remembered, setRemembered] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [cloudState, setCloudState] = useState<{ supported: boolean; hasBackup: boolean; message?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setEntries(readHistory());
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    window.addEventListener(HISTORY_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HISTORY_CHANGED_EVENT, onChanged);
  }, [refresh]);

  /** 查一次云端状态（有没有备份、这个部署支不支持） */
  const probe = useCallback((code: string) => {
    if (!isSyncCodeAcceptable(code)) { setCloudState(null); return; }
    let alive = true;
    probeCloud(code).then(p => {
      if (alive) setCloudState({ supported: p.supported, hasBackup: p.hasBackup, message: p.message });
    });
    return () => { alive = false; };
  }, []);

  // 展开时顺手查一下云端状态
  useEffect(() => {
    if (!open) return;
    const code = loadSyncCode();
    setSyncCode(code);
    setRemembered(!!code);
    probe(code);
  }, [open, probe]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(n => (n === msg ? null : n)), 4000);
  };

  const handleDelete = (id: string) => {
    removeHistoryEntry(id);
    if (expandedId === id) setExpandedId(null);
    refresh();
  };

  const handleClear = () => {
    if (!window.confirm('确定清空本机的全部历史记录吗？（云端备份不受影响）')) return;
    clearHistory();
    refresh();
    flash('本机历史已清空');
  };

  const handleExport = () => {
    const blob = new Blob([exportHistory()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `紫微解读历史-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('已导出到下载目录');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importHistory(String(reader.result || ''));
      refresh();
      flash(result.ok ? `已导入 ${result.count} 条记录` : `导入失败：${result.error}`);
    };
    reader.readAsText(file);
  };

  const handleRestore = (entry: HistoryEntry) => {
    if (!entry.chart) return;
    // 派发恢复请求：跨页面跳转会靠 sessionStorage 传过去，
    // 已经在 /chart 时则直接换盘（路由不变，组件不会重挂载）。
    requestChartRestore(entry.chart);
    if (window.location.pathname !== '/chart') {
      router.push('/chart?restore=1');
    }
  };

  const handleGenerateCode = () => {
    const code = randomSyncCode();
    setNewCode(code);
    setSyncCode(code);
    saveSyncCode(code);
    setRemembered(true);
    probe(code);
  };

  /** 记住用户输入的同步码（可能是从别的设备抄过来的） */
  const handleRememberCode = () => {
    const code = syncCode.trim();
    if (!isSyncCodeAcceptable(code)) { flash(`同步码至少 ${12} 个字符`); return; }
    saveSyncCode(code);
    setRemembered(true);
    probe(code);
    flash('同步码已记住');
  };

  const handleBackupNow = async () => {
    if (!isSyncCodeAcceptable(syncCode)) { flash('同步码至少 12 个字符'); return; }
    setBusy(true);
    try {
      await putBackup(syncCode, readHistory());
      setCloudState({ supported: true, hasBackup: true });
      flash('已备份到云端（服务器上只有密文）');
    } catch (e) {
      flash(`备份失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreCloud = async () => {
    if (!isSyncCodeAcceptable(syncCode)) { flash('同步码至少 12 个字符'); return; }
    setBusy(true);
    try {
      const remote = await getBackup(syncCode);
      if (!remote) { flash('云端没有找到备份'); return; }
      const result = importHistory(JSON.stringify({ entries: remote }));
      refresh();
      flash(result.ok ? `已从云端恢复 ${result.count} 条记录` : '恢复失败');
    } catch (e) {
      flash(`恢复失败：${e instanceof Error ? e.message : '同步码不对？'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCloud = async () => {
    if (!window.confirm('确定删除云端备份吗？本机历史会保留。')) return;
    setBusy(true);
    try {
      await deleteBackup(syncCode);
      setCloudState(s => (s ? { ...s, hasBackup: false } : s));
      flash('云端备份已删除');
    } catch (e) {
      flash(`删除失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleStopCloud = () => {
    if (!window.confirm('停止云备份只会忘记本机记住的同步码，不会删除服务器上的数据。确定吗？')) return;
    forgetSyncCode();
    setSyncCode('');
    setCloudState(null);
    setNewCode(null);
    setRemembered(false);
    flash('已停止云备份（本机历史仍在）');
  };

  const btn: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: '11px',
    borderRadius: '8px',
    border: `1px solid ${BORDER}`,
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        flexShrink: 0,
        borderBottom: `1px solid ${BORDER}`,
        padding: compact ? '6px 10px' : '14px 18px',
      }}
    >
      {/* 标题行 */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'inherit', fontSize: compact ? '11px' : '12px',
        }}
      >
        <span style={{ opacity: 0.5 }}>{open ? '▾' : '▸'}</span>
        <span style={{ letterSpacing: '0.08em' }}>历史记录</span>
        <span style={{ fontSize: '10px', opacity: 0.5 }}>{entries.length} 条</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.45 }}>
          {remembered ? '已开云备份' : '只存本机'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 隐私说明 */}
          <div style={{
            fontSize: '11px', lineHeight: 1.7, opacity: 0.65,
            padding: '8px 10px', borderRadius: '8px',
            border: `1px solid ${BORDER}`,
          }}>
            这些记录<strong>只存在你这台设备的浏览器里</strong>，不会发给网站。
            别人打开同一个网址只会看到自己的空历史。
          </div>

          {/* 列表 */}
          {entries.length === 0 ? (
            <div style={{ fontSize: '11px', opacity: 0.5, padding: '6px 0' }}>
              还没有记录。每次解读或合盘完成后会自动存进来。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: compact ? 260 : 420, overflowY: 'auto' }}>
              {entries.map(e => {
                const expanded = expandedId === e.id;
                return (
                  <div key={e.id} style={{
                    border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '8px 10px',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px',
                    }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: '6px', fontSize: '10px',
                        border: `1px solid ${BORDER}`, opacity: 0.8,
                      }}>
                        {e.kind === 'heming' ? '合盘' : '解读'}
                      </span>
                      <span style={{ opacity: 0.75, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.question}
                      </span>
                      <span style={{ fontSize: '10px', opacity: 0.45 }}>{timeAgo(e.savedAt)}</span>
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '3px' }}>{e.title}</div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <button type="button" style={btn} onClick={() => setExpandedId(expanded ? null : e.id)}>
                        {expanded ? '收起' : '看全文'}
                      </button>
                      {e.chart && (
                        <button type="button" style={btn} onClick={() => handleRestore(e)}>
                          回到这个命盘
                        </button>
                      )}
                      <button type="button" style={btn} onClick={() => handleDelete(e.id)}>删除</button>
                    </div>

                    {expanded && (
                      <div style={{
                        marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${BORDER}`,
                        maxHeight: 320, overflowY: 'auto',
                      }}>
                        <AnswerText text={e.answer} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 本地操作 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={handleExport}>导出 JSON</button>
            <button type="button" style={btn} onClick={() => fileRef.current?.click()}>导入 JSON</button>
            <button type="button" style={btn} onClick={handleClear}>清空本机</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
          </div>

          {/* 云备份 */}
          <div style={{
            border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>云备份（可选）</div>
            <div style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.7 }}>
              开启后会把记录<strong>加密</strong>再存到服务器，换设备时输入同一个同步码就能恢复。
              服务器上只有密文，同步码不存明文。
            </div>

            {/* 同步码输入框：生成的和已有的是同一个入口，不需要两套 UI */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={syncCode}
                onChange={e => { setSyncCode(e.target.value); setNewCode(null); }}
                placeholder="同步码（≥12 字符，可粘贴已有的）"
                spellCheck={false}
                autoComplete="off"
                style={{
                  flex: 1, minWidth: '160px', padding: '5px 9px', fontSize: '11px',
                  borderRadius: '8px', border: `1px solid ${BORDER}`,
                  background: 'transparent', color: 'inherit',
                }}
              />
              <button type="button" style={btn} onClick={handleGenerateCode}>生成同步码</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" style={btn} onClick={handleRememberCode}>记住这个同步码</button>
              {remembered && <span style={{ fontSize: '10px', opacity: 0.5 }}>本机已记住</span>}
            </div>

            {cloudState && !cloudState.supported && (
              <div style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.6 }}>
                {cloudState.message || '当前部署没有启用云备份，本地历史仍然可用。'}
              </div>
            )}
            {cloudState?.hasBackup && (
              <div style={{ fontSize: '10px', opacity: 0.6 }}>云端已有备份。</div>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button type="button" style={btn} disabled={busy || !syncCode.trim()} onClick={handleBackupNow}>立即备份</button>
              <button type="button" style={btn} disabled={busy || !syncCode.trim()} onClick={handleRestoreCloud}>从云端恢复</button>
              <button type="button" style={btn} disabled={busy || !syncCode.trim()} onClick={handleDeleteCloud}>删除云端备份</button>
              <button type="button" style={btn} disabled={!remembered} onClick={handleStopCloud}>停止云备份</button>
            </div>

            {newCode && (
              <div style={{
                fontSize: '11px', lineHeight: 1.8, padding: '8px 10px',
                borderRadius: '8px', border: `1px solid ${BORDER}`,
                wordBreak: 'break-all',
              }}>
                <div style={{ opacity: 0.7, marginBottom: '4px' }}>
                  你的同步码（<strong>只显示这一次，请自己抄走</strong>；忘了本地记录还在，但云端备份就取不回了）：
                </div>
                <code style={{ fontSize: '12px' }}>{newCode}</code>
                <div style={{ marginTop: '6px' }}>
                  <button type="button" style={btn} onClick={() => {
                    navigator.clipboard?.writeText(newCode).then(
                      () => flash('已复制到剪贴板'),
                      () => flash('复制失败，请手动选中复制'),
                    );
                  }}>复制</button>
                </div>
              </div>
            )}
          </div>

          {notice && (
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{notice}</div>
          )}
        </div>
      )}
    </div>
  );
}
