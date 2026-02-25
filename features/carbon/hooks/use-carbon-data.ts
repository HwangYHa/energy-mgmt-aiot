/**
 * features/carbon/hooks/use-carbon-data.ts
 * 탄소 데이터 SWR 훅 모음
 */
'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { apiFetcher, SWR_KEYS, SWR_CONFIG } from '@/lib/api/query-client';
import { generateDownloadFilename } from '@/lib/utils/filename';
import { toast } from '@/lib/toast';

// ─── 타입 ─────────────────────────────────────────────────────────

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

// ─── 월별 배출량 훅 ───────────────────────────────────────────────

export function useCarbonEmissions(year: number) {
  const { data, error, isLoading, mutate } = useSWR<MonthlyEmission[]>(
    SWR_KEYS.carbon.emissions(year),
    async (url: string) => {
      const raw = await apiFetcher<Array<Record<string, unknown>>>(url);
      return (Array.isArray(raw) ? raw : []).map((d) => ({
        ...(d as object),
        monthName: `${d.month}월`,
      })) as MonthlyEmission[];
    },
    SWR_CONFIG.slow,
  );

  return { emissions: data ?? [], error, isLoading, mutate };
}

// ─── 탄소 발자국 훅 ───────────────────────────────────────────────

export function useCarbonFootprint(year: number, target = 500) {
  const { data, error, isLoading, mutate } = useSWR<CarbonFootprint>(
    SWR_KEYS.carbon.footprint(year, target),
    apiFetcher<CarbonFootprint>,
    SWR_CONFIG.slow,
  );

  return { footprint: data ?? null, error, isLoading, mutate };
}

// ─── 복합 훅 (emissions + footprint 동시 로딩) ────────────────────

export function useCarbonData(year: number) {
  const { emissions, error: emissionsError, isLoading: emissionsLoading, mutate: mutateEmissions } =
    useCarbonEmissions(year);

  const { footprint, error: footprintError, isLoading: footprintLoading, mutate: mutateFootprint } =
    useCarbonFootprint(year);

  const isLoading = emissionsLoading || footprintLoading;
  const error = emissionsError || footprintError;

  const refresh = useCallback(() => {
    mutateEmissions();
    mutateFootprint();
  }, [mutateEmissions, mutateFootprint]);

  return { emissions, footprint, isLoading, error, refresh };
}

// ─── 내보내기 훅 ─────────────────────────────────────────────────

export function useCarbonExport(year: number) {
  const exportCSV = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics/carbon/export?format=csv&year=${year}`);
      if (!res.ok) throw new Error('CSV 생성 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateDownloadFilename('탄소배출데이터', '', 'csv');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('CSV 생성 중 오류가 발생했습니다.');
    }
  }, [year]);

  const exportJSON = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics/carbon/export?format=json&year=${year}`);
      if (!res.ok) throw new Error('JSON 생성 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateDownloadFilename('탄소배출데이터', '', 'json');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('JSON 내보내기 중 오류가 발생했습니다.');
    }
  }, [year]);

  const exportCompliancePDF = useCallback(async () => {
    try {
      toast.info?.('규제 리포트 PDF 생성 중...');
      const res = await fetch(`/api/analytics/carbon/compliance-report/pdf?year=${year}`);
      if (!res.ok) throw new Error('PDF 생성 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateDownloadFilename('온실가스명세서', '', 'pdf');
      a.click();
      URL.revokeObjectURL(url);
      toast.success('규제 리포트 PDF가 생성되었습니다.');
    } catch {
      toast.error('PDF 생성 중 오류가 발생했습니다.');
    }
  }, [year]);

  return { exportCSV, exportJSON, exportCompliancePDF };
}
