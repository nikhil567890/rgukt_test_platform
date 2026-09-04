import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Sparkles,
  Target,
  BarChart2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { Attempt } from '../../types';

interface ScoreTrendChartProps {
  attemptsHistory?: Attempt[];
  onNavigateToTests?: () => void;
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  attemptsHistory = [],
  onNavigateToTests,
}) => {
  const [viewMetric, setViewMetric] = useState<'percentage' | 'marks'>('percentage');
  const [showTopperComparison, setShowTopperComparison] = useState<boolean>(true);

  // Process attempts to get the last 5 completed mock tests in chronological order (oldest -> newest)
  const chartData = useMemo(() => {
    if (!attemptsHistory || attemptsHistory.length === 0) return [];

    // Clone and sort chronologically by submittedAt date (ascending)
    const sorted = [...attemptsHistory].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    // Take the last 5 completed tests
    const last5 = sorted.slice(-5);

    return last5.map((attempt, index) => {
      const studentPct =
        typeof attempt.percentage === 'number'
          ? attempt.percentage
          : Math.round((attempt.score / (attempt.totalMarks || 1)) * 100);

      const topperPct =
        attempt.topperScore && attempt.totalMarks
          ? Math.round((attempt.topperScore / attempt.totalMarks) * 100)
          : Math.min(100, Math.max(90, studentPct + 10));

      const formattedDate = attempt.submittedAt
        ? new Date(attempt.submittedAt).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
          })
        : `Test ${index + 1}`;

      // Abbreviated label for X-Axis
      const labelName = `Test ${index + 1}`;

      return {
        id: attempt.id,
        testNum: index + 1,
        label: labelName,
        fullTitle: attempt.testTitle || `Mock Test ${index + 1}`,
        subject: attempt.subject || 'General',
        dateStr: formattedDate,
        score: attempt.score,
        totalMarks: attempt.totalMarks || 50,
        studentPct,
        topperScore: attempt.topperScore || Math.round((topperPct / 100) * attempt.totalMarks),
        topperPct,
        gap: attempt.gapToTopper ?? Math.max(0, (attempt.topperScore || 0) - attempt.score),
      };
    });
  }, [attemptsHistory]);

  // Derived Trend Statistics over last 5 tests
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        latestScorePct: 0,
        avgScorePct: 0,
        highestScorePct: 0,
        lowestScorePct: 0,
        deltaPct: 0,
        trendDirection: 'neutral' as 'up' | 'down' | 'neutral',
        isImproving: false,
      };
    }

    const percentages = chartData.map((d) => d.studentPct);
    const latestScorePct = percentages[percentages.length - 1];
    const firstScorePct = percentages[0];
    const avgScorePct = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    const highestScorePct = Math.max(...percentages);
    const lowestScorePct = Math.min(...percentages);
    const deltaPct = latestScorePct - firstScorePct;

    const trendDirection = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'neutral';

    return {
      latestScorePct,
      avgScorePct,
      highestScorePct,
      lowestScorePct,
      deltaPct,
      trendDirection,
      isImproving: deltaPct > 0,
    };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px] z-50">
          <div className="border-b border-slate-800 pb-2">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              {dataPoint.subject}
            </span>
            <p className="font-extrabold text-slate-100 text-xs mt-1.5">{dataPoint.fullTitle}</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Completed on {dataPoint.dateStr}</span>
            </p>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                <span>Your Score:</span>
              </span>
              <span className="font-mono font-black text-indigo-200">
                {viewMetric === 'percentage'
                  ? `${dataPoint.studentPct}%`
                  : `${dataPoint.score} / ${dataPoint.totalMarks}`}
              </span>
            </div>

            {showTopperComparison && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>Topper Score:</span>
                </span>
                <span className="font-mono font-black text-amber-200">
                  {viewMetric === 'percentage'
                    ? `${dataPoint.topperPct}%`
                    : `${dataPoint.topperScore} / ${dataPoint.totalMarks}`}
                </span>
              </div>
            )}

            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Score Gap:</span>
              {dataPoint.gap === 0 ? (
                <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Top Topper Match!</span>
                </span>
              ) : (
                <span className="text-amber-300 font-bold">
                  -{dataPoint.gap} marks ({dataPoint.topperPct - dataPoint.studentPct}% gap)
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="score-trend-chart-card"
      className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-5"
    >
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <BarChart2 className="w-3 h-3 text-indigo-600" />
              <span>Recharts Trend Matrix</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Last {chartData.length} Completed Mock Tests
            </span>
          </div>

          <h2 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
            <span>Score Trend & Progression Analysis</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Track score trajectory, percentage shifts, and gap to topper across your last 5 completed test papers
          </p>
        </div>

        {/* View Mode Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* Percentage vs Marks Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200">
            <button
              onClick={() => setViewMetric('percentage')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMetric === 'percentage'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Percentage (%)
            </button>
            <button
              onClick={() => setViewMetric('marks')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMetric === 'marks'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw Marks
            </button>
          </div>

          {/* Topper Overlay Checkbox */}
          <button
            onClick={() => setShowTopperComparison(!showTopperComparison)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center space-x-1.5 ${
              showTopperComparison
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle Topper Benchmark Overlay Line"
          >
            <Zap className={`w-3.5 h-3.5 ${showTopperComparison ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
            <span>Topper Line</span>
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        /* Empty State */
        <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto border border-indigo-100">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 text-sm">No Mock Test Attempts Found Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Complete mock test papers to generate your live performance trendline and compare your progress against toppers.
            </p>
          </div>
          {onNavigateToTests && (
            <button
              onClick={onNavigateToTests}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center space-x-1.5"
            >
              <span>Take Your First Test Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Latest Score */}
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-indigo-600 tracking-wider">
                Latest Score
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black text-indigo-950">{stats.latestScorePct}%</span>
                <span className="text-[11px] font-bold text-indigo-600">
                  ({chartData[chartData.length - 1]?.score}/{chartData[chartData.length - 1]?.totalMarks})
                </span>
              </div>
              <p className="text-[10px] text-indigo-700 font-medium truncate">
                {chartData[chartData.length - 1]?.fullTitle}
              </p>
            </div>

            {/* 5-Test Average */}
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-purple-600 tracking-wider">
                5-Test Average
              </span>
              <p className="text-xl font-black text-purple-950">{stats.avgScorePct}%</p>
              <p className="text-[10px] text-purple-700 font-medium">Mean across last {chartData.length} tests</p>
            </div>

            {/* Progression Delta */}
            <div
              className={`p-3 rounded-xl border space-y-1 ${
                stats.trendDirection === 'up'
                  ? 'bg-emerald-50/60 border-emerald-100'
                  : stats.trendDirection === 'down'
                  ? 'bg-rose-50/60 border-rose-100'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase font-extrabold tracking-wider ${
                    stats.trendDirection === 'up'
                      ? 'text-emerald-700'
                      : stats.trendDirection === 'down'
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  5-Test Delta
                </span>
                {stats.trendDirection === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                ) : stats.trendDirection === 'down' ? (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                ) : null}
              </div>
              <p
                className={`text-xl font-black ${
                  stats.trendDirection === 'up'
                    ? 'text-emerald-950'
                    : stats.trendDirection === 'down'
                    ? 'text-rose-950'
                    : 'text-slate-900'
                }`}
              >
                {stats.deltaPct > 0 ? `+${stats.deltaPct}%` : `${stats.deltaPct}%`}
              </p>
              <p
                className={`text-[10px] font-medium ${
                  stats.trendDirection === 'up'
                    ? 'text-emerald-700'
                    : stats.trendDirection === 'down'
                    ? 'text-rose-700'
                    : 'text-slate-500'
                }`}
              >
                {stats.trendDirection === 'up'
                  ? 'Positive Score Trajectory 🚀'
                  : stats.trendDirection === 'down'
                  ? 'Needs Score Focus 🎯'
                  : 'Consistent Score Output'}
              </p>
            </div>

            {/* Peak Score */}
            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-amber-700 tracking-wider">
                Peak Score
              </span>
              <p className="text-xl font-black text-amber-950">{stats.highestScorePct}%</p>
              <p className="text-[10px] text-amber-800 font-medium">Highest score achieved</p>
            </div>
          </div>

          {/* Main Recharts Area Chart */}
          <div id="recharts-trendline-container" className="pt-2">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 15, right: 15, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="studentScoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="topperScoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />

                  <YAxis
                    domain={viewMetric === 'percentage' ? [0, 100] : [0, 'auto']}
                    ticks={viewMetric === 'percentage' ? [0, 25, 50, 75, 100] : undefined}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => (viewMetric === 'percentage' ? `${val}%` : `${val}`)}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Legend
                    wrapperStyle={{ paddingTop: '12px', fontSize: '11px', fontWeight: 600 }}
                    iconType="circle"
                    iconSize={8}
                  />

                  {/* Benchmark target line at 80% */}
                  {viewMetric === 'percentage' && (
                    <ReferenceLine
                      y={80}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Top Rank Cutoff (80%)',
                        fill: '#059669',
                        fontSize: 10,
                        fontWeight: 700,
                        position: 'insideTopRight',
                      }}
                    />
                  )}

                  {/* Topper Score Area/Line */}
                  {showTopperComparison && (
                    <Area
                      type="monotone"
                      dataKey={viewMetric === 'percentage' ? 'topperPct' : 'topperScore'}
                      name="Topper Score"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill="url(#topperScoreGradient)"
                      activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}

                  {/* Student Score Main Area */}
                  <Area
                    type="monotone"
                    dataKey={viewMetric === 'percentage' ? 'studentPct' : 'score'}
                    name="Your Score"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    fill="url(#studentScoreGradient)"
                    activeDot={{ r: 7, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Test Summary Chips for the 5 tests */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
              Breakdown of Last {chartData.length} Completed Tests:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {chartData.map((d, idx) => (
                <div
                  key={d.id || idx}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/30 transition-all space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Test #{d.testNum}</span>
                    <span>{d.dateStr}</span>
                  </div>
                  <p className="font-extrabold text-slate-900 text-xs truncate" title={d.fullTitle}>
                    {d.fullTitle}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-black text-indigo-700 text-xs">{d.studentPct}%</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {d.score}/{d.totalMarks}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
