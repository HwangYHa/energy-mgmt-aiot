'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface BarConfig {
  dataKey: string;
  color: string;
  name?: string;
}

interface EnergyBarChartProps {
  data: DataPoint[];
  bars: BarConfig[];
  height?: number | string;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function EnergyBarChart({
  data,
  bars,
  height = 200,
  showGrid = true,
  showLegend = true,
}: EnergyBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
        )}
        <XAxis
          dataKey="name"
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={{ stroke: '#1e3a5f' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={{ stroke: '#1e3a5f' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0a1929',
            border: '1px solid #06b6d4',
            borderRadius: '8px',
            color: '#e2e8f0',
          }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
          />
        )}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={bar.color}
            name={bar.name || bar.dataKey}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
