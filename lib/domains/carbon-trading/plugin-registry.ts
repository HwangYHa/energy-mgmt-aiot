/**
 * Carbon Trading — Plugin Registry
 *
 * 확장 가능성 아키텍처 (Open/Closed Principle):
 * - 코어 서비스(buy/sell/retire)는 수정 없이 새 기능 추가 가능
 * - 각 플러그인은 ICarbonPlugin 인터페이스만 구현하면 됨
 *
 * 현재 등록된 플러그인:
 * - (기본값: 없음 — 필요 시 register()로 등록)
 *
 * 향후 등록 예정:
 * - CarbonESGBridgeService  : RETIRE 이벤트 → ESG 보고서 상쇄 자동 반영
 * - BlockchainBridgePlugin   : RETIRE 이벤트 → 온체인 소각 (Toucan/KlimaDAO)
 * - XBRLAutoExportPlugin     : RETIRE/BUY 이벤트 → XBRL 자동 생성
 *
 * 사용 예시 (서버 초기화 시):
 * ```ts
 * import { CarbonPluginRegistry } from '@/lib/domains/carbon-trading';
 * import { CarbonESGBridgeService } from '@/lib/domains/carbon-trading/extensions/esg-bridge';
 *
 * CarbonPluginRegistry.register(new CarbonESGBridgeService());
 * ```
 */

import type { CarbonDomainEvent } from './events';

// ─── 플러그인 인터페이스 ───────────────────────────────────────────────

export interface ICarbonPlugin {
  /** 플러그인 식별자 (중복 등록 방지) */
  readonly name: string;
  /**
   * 도메인 이벤트 핸들러
   * - 이벤트를 처리할 필요 없으면 즉시 반환
   * - 예외를 던지면 로그만 남기고 무시 (코어 처리 방해 없음)
   */
  onEvent(event: CarbonDomainEvent): Promise<void>;
}

// ─── 레지스트리 ───────────────────────────────────────────────────────

class _CarbonPluginRegistry {
  private readonly _plugins = new Map<string, ICarbonPlugin>();

  /**
   * 플러그인 등록 (중복 이름은 덮어씀)
   */
  register(plugin: ICarbonPlugin): void {
    this._plugins.set(plugin.name, plugin);
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[CarbonPlugin] Registered: ${plugin.name}`);
    }
  }

  /**
   * 플러그인 해제
   */
  unregister(name: string): void {
    this._plugins.delete(name);
  }

  /**
   * 이벤트 발행 — 모든 플러그인에 전달
   * - Fire-and-forget: 코어 트랜잭션 완료 후 호출
   * - 개별 플러그인 실패는 격리 (다른 플러그인에 영향 없음)
   */
  async emit(event: CarbonDomainEvent): Promise<void> {
    const settled = await Promise.allSettled(
      Array.from(this._plugins.values()).map((p) =>
        p.onEvent(event).catch((err) => {
          console.error(`[CarbonPlugin:${p.name}] 이벤트 처리 실패`, {
            eventType: event.type,
            tenantId: event.tenantId,
            error: err instanceof Error ? err.message : String(err),
          });
        })
      )
    );

    const failed = settled.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[CarbonPlugin] ${failed.length}개 플러그인 처리 실패 (코어 영향 없음)`);
    }
  }

  /** 현재 등록된 플러그인 목록 (디버그용) */
  list(): string[] {
    return Array.from(this._plugins.keys());
  }
}

/**
 * 싱글톤 — 애플리케이션 전역에서 단일 레지스트리 사용
 * (Next.js hot-reload 시 globalThis에서 재사용)
 */
const g = globalThis as typeof globalThis & { _carbonPluginRegistry?: _CarbonPluginRegistry };
if (!g._carbonPluginRegistry) {
  g._carbonPluginRegistry = new _CarbonPluginRegistry();
}

export const CarbonPluginRegistry = g._carbonPluginRegistry;
