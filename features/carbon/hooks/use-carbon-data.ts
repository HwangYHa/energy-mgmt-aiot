'use client';

import useSWR from 'swr';
import { apiFetcher } from '@/lib/api/query-client';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export interface MonthlyEmission {
  month: number;
  monthName: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface CarbonFootprint {
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
    unit: string;
  };
  progress: {
    current: number;
    target: number;
    achievement: number;
    reduction: number;
    reductionRate: number;
  };
  breakdown: Array<{
    category: string;
    sourceType: string;
    amount: number;
    unit: string;
    emission: number;
    percentage: number;
  }>;
  recommendations: string[];
}

// ──────────────────────────────────────────────────────────────
// 탄소 데이터 훅 (SWR — 자동 캐싱/재검증)
// ──────────────────────────────────────────────────────────────

export function useCarbonData(year: number) {
  const {
    data: monthlyRaw,
    isLoading: monthlyLoading,
    error: monthlyError,
    mutate: refreshMonthly,
  } = useSWR<MonthlyEmission[]>(
    `/api/analytics/carbon/emissions?year=${year}`,
    apiFetcher,
    { refreshInterval: 5 * 60_000 } // 5분 주기
  );

  const {
    data: footprint,
    isLoading: footprintLoading,
    error: footprintError,
    mutate: refreshFootprint,
  } = useSWR<CarbonFootprint>(
    `/api/analytics/carbon/footprint?year=${year}&target=500`,
    apiFetcher,
    { refreshInterval: 5 * 60_000 }
  );

  // monthName 자동 추가
  const monthlyData: MonthlyEmission[] = (monthlyRaw ?? []).map((d) => ({
    ...d,
    monthName: `${d.month}월`,
  }));

  const refresh = async () => {
    await Promise.all([refreshMonthly(), refreshFootprint()]);
  };

  return {
    monthlyData,
    footprint: footprint ?? null,
    isLoading: monthlyLoading || footprintLoading,
    error: monthlyError ?? footprintError ?? null,
    refresh,
  };
}

// ──────────────────────────────────────────────────────────────
// 탄소 내보내기 훅
// ──────────────────────────────────────────────────────────────

export function useCarbonExport(year: number) {
  const exportCSV = async () => {
    const response = await fetch(`/api/analytics/carbon/export?format=csv&year=${year}`);
    if (!response.ok) throw new Error('CSV 생성 실패');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `탄소배출_${year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportJSON = async () => {
    const response = await fetch(`/api/analytics/carbon/export?format=json&year=${year}`);
    if (!response.ok) throw new Error('JSON 생성 실패');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `탄소배출_${year}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const response = await fetch(`/api/analytics/carbon/compliance-report/pdf?year=${year}`);
    if (!response.ok) throw new Error('PDF 생성 실패');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `K-MRV_온실가스명세서_${year}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return { exportCSV, exportJSON, exportPDF };
}
