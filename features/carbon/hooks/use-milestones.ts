// features/carbon/hooks/use-milestones.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api/client';

export interface MilestoneSummary {
  id: string;
  year: number;
  title: string;
  status: 'achieved' | 'in_progress' | 'pending';
  displayOrder: number;
}

interface UseMilestonesResult {
  milestones: MilestoneSummary[];
  achieved: MilestoneSummary[];
  inProgress: MilestoneSummary | undefined;
  nextPending: MilestoneSummary | undefined;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 탄소 로드맵 마일스톤 조회 훅
 * - CarbonDashboard, 메인 대시보드 등 요약 위젯에서 공용 사용
 * - 전체 CRUD 가 필요한 roadmap/page.tsx 는 자체 상태 관리 유지
 */
export function useMilestones(): UseMilestonesResult {
  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet('/api/analytics/carbon/roadmap/milestones') as {
        data: MilestoneSummary[];
      };
      const sorted = (res.data ?? []).sort(
        (a, b) => a.displayOrder - b.displayOrder || a.year - b.year
      );
      setMilestones(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : '마일스톤 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const achieved = milestones.filter((m) => m.status === 'achieved');
  const inProgress = milestones.find((m) => m.status === 'in_progress');
  const nextPending = milestones.find((m) => m.status === 'pending');

  return { milestones, achieved, inProgress, nextPending, isLoading, error, refresh };
}
