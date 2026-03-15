/**
 * Carbon Trading — 플러그인 초기화 (서버 시작 시 1회 실행)
 *
 * 사용법:
 * Next.js App Router의 서버 컴포넌트 또는 instrumentation.ts에서 import:
 *
 * ```ts
 * // instrumentation.ts (Next.js 15 권장 — 서버 시작 시 1회 실행)
 * export async function register() {
 *   if (process.env.NEXT_RUNTIME === 'nodejs') {
 *     await import('@/lib/domains/carbon-trading/plugin-initializer');
 *   }
 * }
 * ```
 *
 * 또는 최초 API 라우트에서:
 * ```ts
 * import '@/lib/domains/carbon-trading/plugin-initializer';
 * ```
 *
 * 플러그인 활성화 조건:
 * - CARBON_ESG_BRIDGE_ENABLED=true  : RETIRE 이벤트 → ESG 보고서 자동 연동
 * - CARBON_BLOCKCHAIN_PROTOCOL=toucan|klimadao|mock : 온체인 소각 활성화
 *   - mock    : 개발/테스트 (외부 의존 없음)
 *   - toucan  : Toucan Protocol (Polygon) — POLYGON_RPC_URL + CARBON_WALLET_PRIVATE_KEY 필요
 *   - klimadao: KlimaDAO (Polygon)        — POLYGON_RPC_URL + CARBON_WALLET_PRIVATE_KEY 필요
 *
 * 블록체인 환경변수 (toucan/klimadao 사용 시):
 * - POLYGON_RPC_URL              Polygon Mainnet RPC (Alchemy/Infura)
 * - CARBON_WALLET_PRIVATE_KEY    서버 서명 지갑 개인키 (HSM 강력 권장)
 * - TOUCAN_NETWORK               mainnet|mumbai (기본: mainnet)
 * - TOUCAN_DEFAULT_POOL          bct|nct (기본: nct)
 * - KLIMADAO_DEFAULT_TOKEN       bct|nct|mco2|ubo|nbo (기본: bct)
 *
 * 기타 환경변수:
 * - CARBON_ESG_BRIDGE_ENABLED: 미설정 시 비활성 (안전 기본값)
 * - CARBON_BLOCKCHAIN_PROTOCOL: 미설정 시 비활성
 */

import { CarbonPluginRegistry } from './plugin-registry';
import { CarbonESGBridgeService } from './extensions/esg-bridge/carbon-esg-bridge.service';
import {
  OnChainRetirementPlugin,
  MockBlockchainAdapter,
  BlockchainBridgeRegistry,
} from './extensions/blockchain/blockchain-bridge.interface';
import { createToucanAdapter } from './extensions/blockchain/adapters/toucan.adapter';
import { createKlimaDAOAdapter } from './extensions/blockchain/adapters/klimadao.adapter';

// ─── 초기화 가드 (hot-reload 시 중복 등록 방지) ───────────────────────

const g = globalThis as typeof globalThis & { _carbonPluginsInitialized?: boolean };
if (!g._carbonPluginsInitialized) {
  g._carbonPluginsInitialized = true;
  _initPlugins();
}

function _initPlugins() {
  const registered: string[] = [];

  // 1. ESG Bridge — RETIRE → draft ESG 보고서 상쇄 자동 기록
  if (process.env.CARBON_ESG_BRIDGE_ENABLED === 'true') {
    CarbonPluginRegistry.register(new CarbonESGBridgeService());
    registered.push('carbon-esg-bridge');
  }

  // 2. 블록체인 어댑터 등록
  // env 값은 string으로 먼저 읽어 'mock' 포함 분기 처리 후 타입 단언
  const blockchainProtocolRaw = process.env.CARBON_BLOCKCHAIN_PROTOCOL;

  if (blockchainProtocolRaw) {
    let adapterRegistered = false;

    if (blockchainProtocolRaw === 'mock') {
      // 개발/테스트 — 외부 의존 없는 Mock 어댑터
      BlockchainBridgeRegistry.register(new MockBlockchainAdapter());
      CarbonPluginRegistry.register(new OnChainRetirementPlugin('custom'));
      registered.push('blockchain-retire-mock');
      adapterRegistered = true;
    } else if (blockchainProtocolRaw === 'toucan') {
      // Toucan Protocol (Polygon) 프로덕션 어댑터
      // 필요: POLYGON_RPC_URL + CARBON_WALLET_PRIVATE_KEY 환경변수
      const toucanAdapter = createToucanAdapter();
      if (toucanAdapter) {
        BlockchainBridgeRegistry.register(toucanAdapter);
        CarbonPluginRegistry.register(new OnChainRetirementPlugin('toucan'));
        registered.push('blockchain-retire-toucan');
        adapterRegistered = true;
      } else {
        // 환경변수 미설정 → Mock 폴백
        console.warn(
          '[CarbonInit] Toucan 어댑터: POLYGON_RPC_URL 또는 CARBON_WALLET_PRIVATE_KEY 미설정 → MockAdapter 폴백'
        );
        BlockchainBridgeRegistry.register(new MockBlockchainAdapter());
        CarbonPluginRegistry.register(new OnChainRetirementPlugin('custom'));
        registered.push('blockchain-retire-toucan(mock)');
        adapterRegistered = true;
      }
    } else if (blockchainProtocolRaw === 'klimadao') {
      // KlimaDAO (Polygon) 어댑터
      // 필요: POLYGON_RPC_URL + CARBON_WALLET_PRIVATE_KEY 환경변수
      const klimaAdapter = createKlimaDAOAdapter();
      if (klimaAdapter) {
        BlockchainBridgeRegistry.register(klimaAdapter);
        CarbonPluginRegistry.register(new OnChainRetirementPlugin('klimadao'));
        registered.push('blockchain-retire-klimadao');
        adapterRegistered = true;
      } else {
        console.warn(
          '[CarbonInit] KlimaDAO 어댑터: POLYGON_RPC_URL 또는 CARBON_WALLET_PRIVATE_KEY 미설정 → 비활성'
        );
      }
    }

    if (!adapterRegistered) {
      console.warn(`[CarbonInit] CARBON_BLOCKCHAIN_PROTOCOL='${blockchainProtocolRaw}' 어댑터를 찾을 수 없습니다`);
    }
  }

  if (registered.length > 0) {
    console.info(`[CarbonInit] 플러그인 활성화: ${registered.join(', ')}`);
  } else {
    console.debug('[CarbonInit] 활성화된 플러그인 없음 (환경변수 확인)');
  }
}

/**
 * 현재 등록된 플러그인 목록 (디버그용 API에서 호출)
 */
export function getRegisteredPlugins(): string[] {
  return CarbonPluginRegistry.list();
}