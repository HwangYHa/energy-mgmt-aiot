'use client';

import React, { useState, useEffect } from 'react';
import {
  DashboardPanel,
  EnergyBarChart,
  EnergyLineChart,
  CircularGauge,
  StatDisplay,
} from '@/components/dashboard';

// Sample data for charts
const monthlyConsumptionData = [
  { name: 'Jan', consumption: 4200, target: 4000 },
  { name: 'Feb', consumption: 3800, target: 4000 },
  { name: 'Mar', consumption: 4100, target: 4000 },
  { name: 'Apr', consumption: 3600, target: 3800 },
  { name: 'May', consumption: 3900, target: 3800 },
  { name: 'Jun', consumption: 4500, target: 4200 },
  { name: 'Jul', consumption: 5200, target: 4500 },
  { name: 'Aug', consumption: 5100, target: 4500 },
  { name: 'Sep', consumption: 4300, target: 4200 },
  { name: 'Oct', consumption: 3800, target: 4000 },
  { name: 'Nov', consumption: 3600, target: 3800 },
  { name: 'Dec', consumption: 4000, target: 4000 },
];

const weeklyTrendData = [
  { name: 'Mon', current: 680, previous: 720 },
  { name: 'Tue', current: 720, previous: 700 },
  { name: 'Wed', current: 750, previous: 680 },
  { name: 'Thu', current: 690, previous: 750 },
  { name: 'Fri', current: 630, previous: 690 },
  { name: 'Sat', current: 420, previous: 480 },
  { name: 'Sun', current: 380, previous: 450 },
];

const hourlyLoadData = [
  { name: '00', load: 120, peak: 200 },
  { name: '04', load: 100, peak: 200 },
  { name: '08', load: 280, peak: 300 },
  { name: '12', load: 350, peak: 350 },
  { name: '16', load: 320, peak: 350 },
  { name: '20', load: 250, peak: 300 },
];

const costAnalysisData = [
  { name: 'Jan', cost: 12500, savings: 1800 },
  { name: 'Feb', cost: 11200, savings: 2100 },
  { name: 'Mar', cost: 12800, savings: 1500 },
  { name: 'Apr', cost: 10800, savings: 2400 },
  { name: 'May', cost: 11500, savings: 2000 },
  { name: 'Jun', cost: 13200, savings: 1200 },
];

const efficiencyTrendData = [
  { name: 'W1', efficiency: 82, target: 85 },
  { name: 'W2', efficiency: 84, target: 85 },
  { name: 'W3', efficiency: 86, target: 85 },
  { name: 'W4', efficiency: 88, target: 85 },
  { name: 'W5', efficiency: 85, target: 85 },
  { name: 'W6', efficiency: 87, target: 85 },
];

const carbonEmissionData = [
  { name: 'Jan', emission: 2800, limit: 3000 },
  { name: 'Feb', emission: 2600, limit: 3000 },
  { name: 'Mar', emission: 2900, limit: 3000 },
  { name: 'Apr', emission: 2400, limit: 2800 },
  { name: 'May', emission: 2500, limit: 2800 },
  { name: 'Jun', emission: 3100, limit: 3200 },
];

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold text-cyan-400 tracking-wider"
          style={{ textShadow: '0 0 20px rgba(6, 182, 212, 0.5)' }}
        >
          Energy Operation and Management
        </h1>
        <p className="text-slate-500 text-sm mt-1" suppressHydrationWarning>
          {currentTime}
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Charts */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Monthly Consumption */}
          <DashboardPanel title="월별 에너지 소비량">
            <EnergyBarChart
              data={monthlyConsumptionData}
              bars={[
                { dataKey: 'consumption', color: '#22d3ee', name: '소비량' },
                { dataKey: 'target', color: '#4ade80', name: '목표' },
              ]}
              height={160}
              showLegend={false}
            />
          </DashboardPanel>

          {/* Weekly Trend */}
          <DashboardPanel title="주간 소비 추이">
            <EnergyBarChart
              data={weeklyTrendData}
              bars={[
                { dataKey: 'current', color: '#06b6d4', name: '이번주' },
                { dataKey: 'previous', color: '#0891b2', name: '지난주' },
              ]}
              height={140}
              showLegend={false}
            />
          </DashboardPanel>

          {/* Hourly Load */}
          <DashboardPanel title="시간대별 부하">
            <EnergyBarChart
              data={hourlyLoadData}
              bars={[
                { dataKey: 'load', color: '#22d3ee', name: '현재 부하' },
                { dataKey: 'peak', color: '#f59e0b', name: '피크' },
              ]}
              height={140}
              showLegend={false}
            />
          </DashboardPanel>
        </div>

        {/* Center Column - Main Stats */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {/* Main Stats Display */}
          <DashboardPanel className="py-8">
            <StatDisplay
              value={153123461}
              label="Total Energy Consumption"
              sublabel="kWh (Year to Date)"
              size="xl"
              trend={{ value: 8.5, direction: 'down' }}
            />
          </DashboardPanel>

          {/* Cost Analysis */}
          <DashboardPanel title="비용 분석 (천원)">
            <EnergyBarChart
              data={costAnalysisData}
              bars={[
                { dataKey: 'cost', color: '#f97316', name: '비용' },
                { dataKey: 'savings', color: '#22c55e', name: '절감' },
              ]}
              height={180}
              showLegend
            />
          </DashboardPanel>

          {/* Bottom Circular Gauges */}
          <div className="grid grid-cols-4 gap-3">
            <DashboardPanel className="py-4" glowColor="green">
              <CircularGauge
                value={94}
                label="설비 가동률"
                color="green"
                size="sm"
              />
            </DashboardPanel>
            <DashboardPanel className="py-4" glowColor="cyan">
              <CircularGauge
                value={87}
                label="에너지 효율"
                color="cyan"
                size="sm"
              />
            </DashboardPanel>
            <DashboardPanel className="py-4" glowColor="yellow">
              <CircularGauge
                value={76}
                label="DR 참여율"
                color="yellow"
                size="sm"
              />
            </DashboardPanel>
            <DashboardPanel className="py-4" glowColor="purple">
              <CircularGauge
                value={92}
                label="탄소 목표"
                color="purple"
                size="sm"
              />
            </DashboardPanel>
          </div>
        </div>

        {/* Right Column - Additional Charts */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Efficiency Trend */}
          <DashboardPanel title="효율성 추이">
            <EnergyLineChart
              data={efficiencyTrendData}
              lines={[
                { dataKey: 'efficiency', color: '#22d3ee', name: '효율' },
                { dataKey: 'target', color: '#f59e0b', name: '목표', dot: false },
              ]}
              height={160}
              showLegend={false}
            />
          </DashboardPanel>

          {/* Carbon Emission */}
          <DashboardPanel title="탄소 배출량 (tCO2)">
            <EnergyBarChart
              data={carbonEmissionData}
              bars={[
                { dataKey: 'emission', color: '#a78bfa', name: '배출량' },
                { dataKey: 'limit', color: '#ef4444', name: '한도' },
              ]}
              height={140}
              showLegend={false}
            />
          </DashboardPanel>

          {/* Quick Stats */}
          <DashboardPanel title="실시간 현황">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-[#0d2847] rounded">
                <span className="text-slate-400 text-sm">현재 전력</span>
                <span className="text-cyan-400 font-bold">245.7 kW</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#0d2847] rounded">
                <span className="text-slate-400 text-sm">금일 사용량</span>
                <span className="text-green-400 font-bold">1,842 kWh</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#0d2847] rounded">
                <span className="text-slate-400 text-sm">피크 대비</span>
                <span className="text-yellow-400 font-bold">72%</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-[#0d2847] rounded">
                <span className="text-slate-400 text-sm">예상 요금</span>
                <span className="text-orange-400 font-bold">₩284,500</span>
              </div>
            </div>
          </DashboardPanel>

          {/* Alerts Summary */}
          <DashboardPanel title="알림 현황" glowColor="yellow">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-red-950/50 rounded border border-red-500/30">
                <p className="text-2xl font-bold text-red-400">1</p>
                <p className="text-[10px] text-red-300">긴급</p>
              </div>
              <div className="p-2 bg-yellow-950/50 rounded border border-yellow-500/30">
                <p className="text-2xl font-bold text-yellow-400">3</p>
                <p className="text-[10px] text-yellow-300">주의</p>
              </div>
              <div className="p-2 bg-emerald-950/50 rounded border border-emerald-500/30">
                <p className="text-2xl font-bold text-emerald-400">12</p>
                <p className="text-[10px] text-emerald-300">정보</p>
              </div>
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
