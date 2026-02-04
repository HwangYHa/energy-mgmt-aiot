'use client';

import React from 'react';
import {
  LineChart,
  Line,
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

interface LineConfig {
  dataKey: string;
  color: string;
  name?: string;
  strokeWidth?: number;
  dot?: boolean;
}

interface EnergyLineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function EnergyLineChart({
  data,
  lines,
  height = 200,
  showGrid = true,
  showLegend = true,
}: EnergyLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={line.strokeWidth || 2}
            name={line.name || line.dataKey}
            dot={line.dot !== false ? { fill: line.color, r: 3 } : false}
            activeDot={{ r: 5, stroke: line.color, strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
