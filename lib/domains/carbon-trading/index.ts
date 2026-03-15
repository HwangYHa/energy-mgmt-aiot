/**
 * Carbon Trading v2 — 도메인 진입점 (배럴)
 *
 * 코어:
 * - types        : 공유 도메인 타입 (CarbonRegistry, LedgerEntry, etc.)
 * - events       : 도메인 이벤트 정의 (BUY/SELL/RETIRE/CANCEL)
 * - plugin-registry: ICarbonPlugin + CarbonPluginRegistry 싱글톤
 *
 * 서비스:
 * - CarbonTradingService   : BUY / SELL / CANCEL (멱등성 + 낙관적 잠금)
 * - CarbonPortfolioService : WAC + 마크투마켓 포트폴리오
 * - CarbonRetirementService: RETIRE + 인증서 (K-ETS 준수)
 *
 * 확장 모듈 (필요 시 선택 import):
 * - extensions/vcm          : VCMRegistryService — Verra/GoldStandard 메타
 * - extensions/blockchain   : IBlockchainBridge, BlockchainBridgeRegistry, OnChainRetirementPlugin
 * - extensions/xbrl         : CarbonXBRLMapper — GHG/CDP/ESRS/SEC/IFRS XBRL 매핑
 * - extensions/esg-bridge   : CarbonESGBridgeService — RETIRE → ESG 보고서 자동 연동
 *
 * 플러그인 등록 예시 (서버 초기화):
 * ```ts
 * import { CarbonPluginRegistry } from '@/lib/domains/carbon-trading';
 * import { CarbonESGBridgeService } from '@/lib/domains/carbon-trading/extensions/esg-bridge';
 * import { OnChainRetirementPlugin } from '@/lib/domains/carbon-trading/extensions/blockchain';
 *
 * CarbonPluginRegistry.register(new CarbonESGBridgeService());
 * CarbonPluginRegistry.register(new OnChainRetirementPlugin('toucan'));
 * ```
 */

// ─── 코어 타입 ─────────────────────────────────────────────────────────
export * from './types';
export * from './events';

// ─── 플러그인 레지스트리 ────────────────────────────────────────────────
export { CarbonPluginRegistry } from './plugin-registry';
export type { ICarbonPlugin }   from './plugin-registry';

// ─── 도메인 서비스 ─────────────────────────────────────────────────────
export { CarbonTradingService }    from './services/carbon-trading.service';
export { CarbonPortfolioService }  from './services/carbon-portfolio.service';
export { CarbonRetirementService } from './services/carbon-retirement.service';
