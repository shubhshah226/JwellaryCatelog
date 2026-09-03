import type { EChartsOption } from 'echarts';
import { graphic } from 'echarts/core';
import { ChartPoint, DonutSegment } from '../../dashboard/models/dashboard.model';

export function buildSalesChartOptions(
  points: ChartPoint[],
  isDark: boolean
): EChartsOption {
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const splitLineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';

  return {
    grid: {
      left: 12,
      right: 12,
      top: 24,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      textStyle: {
        color: isDark ? '#f8fafc' : '#0f172a',
      },
      valueFormatter: (value) => `Rs ${Number(value).toLocaleString('en-IN')}`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((point) => point.label),
      axisLine: {
        lineStyle: { color: splitLineColor },
      },
      axisTick: { show: false },
      axisLabel: {
        color: axisColor,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: { color: splitLineColor },
      },
      axisLabel: {
        color: axisColor,
        fontSize: 11,
        formatter: (value: number) => formatCompactAxis(value),
      },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 7,
        data: points.map((point) => point.amount),
        lineStyle: {
          color: '#a855f7',
          width: 3,
        },
        itemStyle: {
          color: '#a855f7',
          borderColor: isDark ? '#111827' : '#ffffff',
          borderWidth: 2,
        },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(168,85,247,0.45)' },
            { offset: 1, color: 'rgba(168,85,247,0.02)' },
          ]),
        },
      },
    ],
  };
}

export function buildDonutChartOptions(
  segments: DonutSegment[],
  total: number,
  isDark: boolean
): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      textStyle: {
        color: isDark ? '#f8fafc' : '#0f172a',
      },
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'center',
          formatter: `{total|${total}}\n{label|Total}`,
          rich: {
            total: {
              fontSize: 22,
              fontWeight: 700,
              color: isDark ? '#f8fafc' : '#0f172a',
              lineHeight: 28,
            },
            label: {
              fontSize: 12,
              color: isDark ? '#94a3b8' : '#64748b',
              lineHeight: 18,
            },
          },
        },
        labelLine: { show: false },
        data: segments.map((segment) => ({
          name: segment.label,
          value: segment.value,
          itemStyle: { color: segment.color },
        })),
      },
    ],
  };
}

function formatCompactAxis(value: number): string {
  if (value >= 100000) {
    return `Rs${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `Rs ${Math.round(value / 1000)}k`;
  }

  return `Rs ${value}`;
}
