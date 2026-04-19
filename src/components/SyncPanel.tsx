"use client";

import React, { useState } from "react";

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
  syncCode: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  onCreateSync: () => void;
  onBindCode: (code: string) => void;
  onPush: () => void;
  onPull: () => void;
  onUnbind: () => void;
  isDarkMode?: boolean;
}

export function SyncPanel({
  isOpen,
  onClose,
  syncCode,
  syncing,
  lastSyncAt,
  syncError,
  onCreateSync,
  onBindCode,
  onPush,
  onPull,
  onUnbind,
  isDarkMode = false,
}: SyncPanelProps) {
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const colors = {
    bg: isDarkMode ? "#1e1e2e" : "#ffffff",
    text: isDarkMode ? "#e0e0e0" : "#333333",
    secondary: isDarkMode ? "#888" : "#666",
    border: isDarkMode ? "#333" : "#e0e0e0",
    accent: isDarkMode ? "#6ba3e0" : "#4a90d9",
    cardBg: isDarkMode ? "#2a2a3e" : "#f8f9fa",
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleCopy = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", zIndex: 1000,
        }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90%", maxWidth: 380,
        backgroundColor: colors.bg, borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        zIndex: 1001, overflow: "hidden",
      }}>
        {/* 头部 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${colors.border}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text }}>
            多设备同步
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: colors.secondary, fontSize: 20, lineHeight: 1,
          }}>×</button>
        </div>

        {/* 内容 */}
        <div style={{ padding: 20 }}>
          {syncError && (
            <div style={{
              padding: "10px 14px", marginBottom: 16, borderRadius: 8,
              backgroundColor: "#fee2e2", color: "#dc2626", fontSize: 13,
            }}>
              {syncError}
            </div>
          )}

          {syncCode ? (
            /* ===== 已绑定状态 ===== */
            <>
              <div style={{
                textAlign: "center", padding: "20px 0",
                backgroundColor: colors.cardBg, borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, color: colors.secondary, marginBottom: 8 }}>
                  你的同步码
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 700, letterSpacing: 6,
                  color: colors.accent, fontFamily: "monospace",
                }}>
                  {syncCode}
                </div>
                <button onClick={handleCopy} style={{
                  marginTop: 10, padding: "6px 16px", border: `1px solid ${colors.border}`,
                  borderRadius: 6, background: "transparent", color: colors.text,
                  fontSize: 13, cursor: "pointer",
                }}>
                  {copied ? "已复制 ✓" : "复制同步码"}
                </button>
              </div>

              <div style={{ fontSize: 12, color: colors.secondary, textAlign: "center", marginBottom: 16 }}>
                在其他设备输入此同步码即可同步数据
                {lastSyncAt && (
                  <div style={{ marginTop: 4 }}>上次同步: {formatTime(lastSyncAt)}</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button onClick={onPush} disabled={syncing} style={{
                  flex: 1, padding: "12px 0", border: "none", borderRadius: 8,
                  backgroundColor: colors.accent, color: "#fff",
                  fontSize: 14, fontWeight: 500, cursor: syncing ? "wait" : "pointer",
                  opacity: syncing ? 0.6 : 1,
                }}>
                  {syncing ? "同步中..." : "上传数据 ↑"}
                </button>
                <button onClick={onPull} disabled={syncing} style={{
                  flex: 1, padding: "12px 0", border: `1px solid ${colors.accent}`,
                  borderRadius: 8, backgroundColor: "transparent",
                  color: colors.accent, fontSize: 14, fontWeight: 500,
                  cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.6 : 1,
                }}>
                  {syncing ? "同步中..." : "下载数据 ↓"}
                </button>
              </div>

              <button onClick={onUnbind} style={{
                width: "100%", padding: "10px 0", border: `1px solid ${colors.border}`,
                borderRadius: 8, background: "transparent",
                color: colors.secondary, fontSize: 13, cursor: "pointer",
              }}>
                解除绑定
              </button>
            </>
          ) : (
            /* ===== 未绑定状态 ===== */
            <>
              <div style={{
                textAlign: "center", padding: "16px 0 20px",
                color: colors.secondary, fontSize: 14,
              }}>
                生成同步码或输入已有同步码来同步数据
              </div>

              {/* 生成新同步码 */}
              <button onClick={onCreateSync} disabled={syncing} style={{
                width: "100%", padding: "14px 0", border: "none", borderRadius: 8,
                backgroundColor: colors.accent, color: "#fff",
                fontSize: 15, fontWeight: 600, cursor: syncing ? "wait" : "pointer",
                marginBottom: 20, opacity: syncing ? 0.6 : 1,
              }}>
                {syncing ? "生成中..." : "生成同步码"}
              </button>

              {/* 分隔线 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              }}>
                <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <span style={{ fontSize: 12, color: colors.secondary }}>或输入已有同步码</span>
                <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </div>

              {/* 输入同步码 */}
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="输入 6 位同步码"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  style={{
                    flex: 1, padding: "12px 14px", border: `1px solid ${colors.border}`,
                    borderRadius: 8, fontSize: 18, fontFamily: "monospace",
                    letterSpacing: 4, textAlign: "center", textTransform: "uppercase",
                    backgroundColor: colors.cardBg, color: colors.text, outline: "none",
                  }}
                />
                <button
                  onClick={() => { if (inputCode.length === 6) onBindCode(inputCode); }}
                  disabled={syncing || inputCode.length !== 6}
                  style={{
                    padding: "12px 20px", border: "none", borderRadius: 8,
                    backgroundColor: inputCode.length === 6 ? colors.accent : colors.border,
                    color: "#fff", fontSize: 14, fontWeight: 500,
                    cursor: inputCode.length === 6 ? "pointer" : "not-allowed",
                    opacity: syncing ? 0.6 : 1,
                  }}
                >
                  绑定
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
