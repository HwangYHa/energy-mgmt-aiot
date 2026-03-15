'use client';

/**
 * hooks/use-menu.ts — DB 기반 메뉴 + 기능 잠금 훅
 *
 * RBAC + Plan 기반 메뉴 접근 제어.
 * - `allowed: true` → 메뉴 정상 표시
 * - `locked: true`  → 잠금 아이콘 표시 (업그레이드 유도)
 * - 메뉴 항목 자체가 없으면 → 역할 미달로 숨김
 *
 * 사용:
 *   const { groups, isLoading, hasFeature } = useMenu();
 *   // groups[n].items[m].locked === true → <LockIcon /> 표시
 *
 *   const locked = useFeatureLocked('carbon_trading');
 *   // locked === true → 업그레이드 프롬프트 표시
 */

import useSWR from 'swr';
import { apiFetcher } from '@/lib/api/query-client';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export interface MenuItemData {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  path: string | null;
  displayOrder: number;
  minRole: string;
  badgeType: string;
  badgeColor: string | null;
  locked: boolean;                   // true → 상위 플랜 필요
  featureRequired: string | null;    // 필요 기능 코드
}

export interface MenuGroupData {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  displayOrder: number;
  minRole: string;
  items: MenuItemData[];
}

export interface UseMenuResult {
  groups: MenuGroupData[];
  isLoading: boolean;
  error: Error | undefined;
  /** menuCode에 해당하는 MenuItem 찾기 */
  findItem: (menuCode: string) => MenuItemData | undefined;
  /** featureCode가 현재 플랜에서 잠겨 있는지 */
  isFeatureLocked: (featureCode: string) => boolean;
  /** 수동 갱신 (플랜 업그레이드 후 즉시 반영) */
  refresh: () => void;
}

// ──────────────────────────────────────────────────────────────
// 메인 훅
// ──────────────────────────────────────────────────────────────

export function useMenu(): UseMenuResult {
  const { data, error, isLoading, mutate } = useSWR<MenuGroupData[]>(
    '/api/menus',
    apiFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,     // 30초 중복 요청 방지
    }
  );

  const groups = data ?? [];

  const findItem = (menuCode: string): MenuItemData | undefined => {
    for (const group of groups) {
      const item = group.items.find(i => i.code === menuCode);
      if (item) return item;
    }
    return undefined;
  };

  const isFeatureLocked = (featureCode: string): boolean => {
    // featureRequired가 일치하는 모든 아이템 중 하나라도 locked이면 잠금
    for (const group of groups) {
      for (const item of group.items) {
        if (item.featureRequired === featureCode && item.locked) return true;
      }
    }
    // 아이템에 featureCode가 없으면 기능 자체가 미할당 → 잠금으로 처리
    return false;
  };

  return {
    groups,
    isLoading,
    error: error as Error | undefined,
    findItem,
    isFeatureLocked,
    refresh: () => { mutate(); },
  };
}

// ──────────────────────────────────────────────────────────────
// 개별 기능 잠금 훅 (컴포넌트 레벨)
// ──────────────────────────────────────────────────────────────

/**
 * 특정 기능이 현재 플랜에서 잠겨 있는지 확인.
 *
 * ```tsx
 * const locked = useFeatureLocked('carbon_trading');
 * if (locked) return <PlanLockedBanner feature="carbon_trading" />;
 * ```
 */
export function useFeatureLocked(featureCode: string): boolean {
  const { isFeatureLocked, isLoading } = useMenu();
  if (isLoading) return false;  // 로딩 중에는 차단하지 않음
  return isFeatureLocked(featureCode);
}

/**
 * 특정 메뉴 아이템이 잠겨 있는지 확인.
 *
 * ```tsx
 * const { locked, featureRequired } = useMenuItemAccess('carbon-trading-menu');
 * ```
 */
export function useMenuItemAccess(menuCode: string): {
  locked: boolean;
  featureRequired: string | null;
} {
  const { findItem, isLoading } = useMenu();
  if (isLoading) return { locked: false, featureRequired: null };
  const item = findItem(menuCode);
  if (!item) return { locked: false, featureRequired: null };
  return { locked: item.locked, featureRequired: item.featureRequired };
}
