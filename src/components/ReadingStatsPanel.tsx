"use client";

import React from "react";
import { X } from "lucide-react";
import type { ReadingStatsReturn } from "@/hooks/useReadingStats";

interface ReadingStatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ReadingStatsReturn;
  headerBg: string;
  headerTextColor: string;
  textColor: string;
  isDarkMode: boolean;
  backgroundColor: string;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export function ReadingStatsPanel({
  isOpen,
  onClose,
  stats,
  headerBg,
  headerTextColor,
  textColor,
  isDarkMode,
  backgroundColor,
}: ReadingStatsPanelProps) {
  if (!isOpen) return null;

  const { todayMinutes, weekData, monthMinutes, totalMinutes, streak } = stats;
  const maxWeekMin = Math.max(...weekData.map(d => d.minutes), 1);
  const accentColor = isDarkMode ? '#6ba3e0' : '#4a90d9';

  return (
    <div className="rs-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rs-panel" style={{ backgroundColor: headerBg, color: headerTextColor }}>
        <div className="rs-header">
          <h3>阅读统计</h3>
          <button className="rs-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="rs-body" style={{ backgroundColor, color: textColor }}>
          {/* Summary Cards */}
          <div className="rs-cards">
            <div className="rs-card">
              <div className="rs-card-value" style={{ color: accentColor }}>{formatDuration(todayMinutes)}</div>
              <div className="rs-card-label">今日阅读</div>
            </div>
            <div className="rs-card">
              <div className="rs-card-value" style={{ color: accentColor }}>{formatDuration(monthMinutes)}</div>
              <div className="rs-card-label">本月累计</div>
            </div>
          </div>

          <div className="rs-cards">
            <div className="rs-card">
              <div className="rs-card-value" style={{ color: accentColor }}>{formatDuration(totalMinutes)}</div>
              <div className="rs-card-label">历史总计</div>
            </div>
            <div className="rs-card">
              <div className="rs-card-value" style={{ color: streak > 0 ? '#f59e0b' : accentColor }}>
                {streak} 天
              </div>
              <div className="rs-card-label">连续阅读</div>
            </div>
          </div>

          {/* Weekly Chart */}
          <div className="rs-chart-section">
            <div className="rs-chart-title">近7天阅读时长</div>
            <div className="rs-week-chart">
              {weekData.map((day, i) => {
                const barHeight = maxWeekMin > 0 ? Math.max((day.minutes / maxWeekMin) * 100, day.minutes > 0 ? 6 : 0) : 0;
                const isToday = i === weekData.length - 1;
                return (
                  <div key={i} className="rs-bar-col">
                    <div className="rs-bar-value">
                      {day.minutes > 0 ? `${day.minutes}m` : ''}
                    </div>
                    <div className="rs-bar-track">
                      <div
                        className="rs-bar-fill"
                        style={{
                          height: `${barHeight}%`,
                          backgroundColor: isToday ? accentColor : (isDarkMode ? '#555' : '#d1d5db'),
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <div className={`rs-bar-label ${isToday ? 'today' : ''}`}
                      style={isToday ? { color: accentColor, fontWeight: 700 } : undefined}
                    >
                      {day.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rs-tip">
            阅读时长每分钟自动记录（仅计算前台阅读时间）
          </div>
        </div>
      </div>

      <style jsx>{`
        .rs-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: rsFadeIn 0.15s ease;
        }
        @keyframes rsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .rs-panel {
          width: 90%;
          max-width: 400px;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: rsSlideUp 0.2s ease;
        }
        @keyframes rsSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .rs-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .rs-close {
          background: none; border: none; cursor: pointer;
          padding: 4px; border-radius: 4px; display: flex;
          opacity: 0.7; transition: opacity 0.15s; color: inherit;
        }
        .rs-close:hover { opacity: 1; }
        .rs-body {
          padding: 20px;
        }
        .rs-cards {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .rs-card {
          flex: 1;
          padding: 14px 12px;
          border-radius: 12px;
          background: rgba(128,128,128,0.08);
          text-align: center;
        }
        .rs-card-value { font-size: 18px; font-weight: 700; }
        .rs-card-label { font-size: 12px; opacity: 0.6; margin-top: 4px; }
        .rs-chart-section { margin-top: 8px; }
        .rs-chart-title {
          font-size: 13px;
          font-weight: 600;
          opacity: 0.7;
          margin-bottom: 12px;
        }
        .rs-week-chart {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 140px;
        }
        .rs-bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }
        .rs-bar-value {
          font-size: 10px;
          opacity: 0.6;
          height: 16px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .rs-bar-track {
          flex: 1;
          width: 100%;
          max-width: 32px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .rs-bar-fill {
          width: 100%;
          transition: height 0.4s ease;
        }
        .rs-bar-label {
          font-size: 12px;
          margin-top: 6px;
          opacity: 0.6;
        }
        .rs-tip {
          margin-top: 16px;
          font-size: 11px;
          opacity: 0.4;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
