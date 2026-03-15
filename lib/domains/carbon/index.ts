/**
 * Carbon Domain - Public API
 * lib/domains/carbon/ 의 진입점
 *
 * 외부에서는 이 파일을 통해서만 carbon domain에 접근
 */

// Types
export type {
  EmissionScope,
  DataSource,
  DataQuality,
  ChangeType,
  CalculationMethod,
  EmissionFactorStatus,
  AuditLogEntry,
} from './types/carbon.types';

// DTOs
export type {
  FindEffectiveEmissionFactorInput,
  EmissionFactorDTO,
  CreateEmissionFactorInput,
  ApproveEmissionFactorInput,
} from './dtos/emission-factor.dto';
export { mapEmissionFactorToDTO, calculateNextVersion } from './dtos/emission-factor.dto';

// Services (레거시 서비스 레이어 — 기존 API 호환)
export { EmissionFactorService } from './services/emission-factor.service';
export { EmissionFactorAuditService } from './services/emission-factor-audit.service';

// Strategy calculators
export { getCalculator, getCalculatorVersions } from './strategies/index';
export type {
  CalculateEmissionsInput,
  CalculationOutput,
  ValidationResult,
} from './strategies/types';

// Constants
export {
  SCOPE3_CATEGORIES,
  getCategoryNo,
  isValidScope3Category,
  getCategoryByCode,
  getCategoriesByMethod,
  getAllScope3Categories,
} from './constants/scope3-categories';
export type {
  Scope3Category,
  Scope3CalcMethod,
} from './constants/scope3-categories';

// ─── DDD Layer (v2) ──────────────────────────────────────────────────────────

// Domain Errors
export {
  CarbonDomainError,
  EmissionFactorNotFoundError,
  EmissionFactorOverlapError,
  EmissionFactorAlreadyApprovedError,
  ParentVersionNotFoundError,
  UnsupportedCalculationError,
  CalculationValidationError,
  UnsupportedUnitError,
  ChainIntegrityViolationError,
  isEmissionFactorNotFound,
  isEmissionFactorOverlap,
  isAlreadyApproved,
  isChainViolation,
  errorToHttpStatus,
} from './domain/errors';

// Domain Value Objects
export {
  EmissionValue,
  ValidityPeriod,
  FactorVersion,
  RecordHash,
  UnitConversion,
} from './domain/value-objects';

// Repository Interface (for DI)
export type {
  IEmissionFactorRepository,
  EmissionFactorRecord,
  FindEffectiveQuery,
  FindVersionChainQuery,
  ListFactorsQuery,
  ListFactorsResult,
  CreateFactorData,
} from './domain/repositories/IEmissionFactorRepository';

// Infrastructure
export { PrismaEmissionFactorRepository } from './infrastructure/repositories/PrismaEmissionFactorRepository';

// Application: Calculation Engine
export { CalculationEngine } from './application/calculation-engine/CalculationEngine';
export type {
  CalculationInput,
  CalculationResult,
  FactorSelectionReason,
} from './application/calculation-engine/CalculationEngine';

// Application: Use Cases
export { CreateEmissionFactorVersionUseCase } from './application/use-cases/CreateEmissionFactorVersion.usecase';
export type {
  CreateEmissionFactorVersionInput,
  CreateEmissionFactorVersionOutput,
} from './application/use-cases/CreateEmissionFactorVersion.usecase';

export { ApproveEmissionFactorUseCase } from './application/use-cases/ApproveEmissionFactor.usecase';
export type {
  ApproveEmissionFactorInput as ApproveEmissionFactorUseCaseInput,
  ApproveEmissionFactorOutput,
} from './application/use-cases/ApproveEmissionFactor.usecase';

export { DeprecateEmissionFactorUseCase } from './application/use-cases/DeprecateEmissionFactor.usecase';
export type {
  DeprecateEmissionFactorInput,
  DeprecateEmissionFactorOutput,
} from './application/use-cases/DeprecateEmissionFactor.usecase';

export { VerifyAuditChainUseCase } from './application/use-cases/VerifyAuditChain.usecase';
export type {
  VerifyAuditChainInput,
  IntegrityReport,
} from './application/use-cases/VerifyAuditChain.usecase';

export { CalculateEmissionsUseCase } from './application/use-cases/CalculateEmissions.usecase';
