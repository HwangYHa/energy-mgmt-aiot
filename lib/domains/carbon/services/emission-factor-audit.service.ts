/**
 * EmissionFactorAuditService
 * SHA-256 Hash Chain 기반 배출계수 변경 이력 감사 서비스
 *
 * Big4 감사 대응: 모든 배출계수 변경이 Append-only 로그로 기록되며,
 * 각 로그는 이전 로그의 해시를 포함해 체인을 형성하므로 변조가 즉시 탐지됨.
 *
 * Hash Chain 공식:
 *   hash1 = SHA256(JSON(data1) + 'genesis')
 *   hashN = SHA256(JSON(dataN) + hash(N-1))
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { ChangeType, AuditLogEntry } from '../types/carbon.types';

// ─── 입력 타입 ─────────────────────────────────────────────────────────────

export interface RecordChangeInput {
  /** 대상 배출계수 ID */
  emissionFactorId: string;
  /** 변경 유형 */
  changeType: ChangeType;
  /** 이전 값 (CREATED이면 null) */
  oldValue?: number | null;
  /** 변경 후 값 */
  newValue?: number | null;
  /** 변경 사유 */
  changeReason?: string;
  /** 요청자 User ID */
  requestedBy: string;
  /** 승인자 (APPROVED 시에만) */
  approvedBy?: string | null;
  /** 요청 시각 (기본: 현재) */
  requestedAt?: Date;
}

export interface RecordChangeResult {
  /** 생성된 감사 로그 ID */
  id: string;
  /** 이 로그의 SHA-256 해시 (다음 로그의 previousHash가 됨) */
  currentHash: string;
}

export interface VerifyIntegrityResult {
  /** 체인 무결성 여부 */
  isValid: boolean;
  /** 변조된 로그 목록 (isValid=false일 때만 populated) */
  tamperedLogs?: Array<{
    id: string;
    /** 예상 해시 (재계산 값) */
    expectedHash: string;
    /** 실제 저장 값 */
    actualHash: string;
  }>;
  /** 검증한 총 로그 수 */
  totalLogs: number;
}

export interface AuditLogQuery {
  /** 페이지 번호 (1부터) */
  page?: number;
  /** 페이지 크기 */
  pageSize?: number;
  /** 변경 유형 필터 */
  changeType?: ChangeType;
  /** 요청자 필터 */
  requestedBy?: string;
}

export interface AuditLogListResult {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── 해시 계산 유틸 ─────────────────────────────────────────────────────────

/**
 * 감사 로그 엔트리의 SHA-256 해시 계산
 * @param data   직렬화할 데이터 객체
 * @param previousHash 이전 로그 해시 ('genesis' = 첫 번째 로그)
 */
function computeHash(
  data: Record<string, unknown>,
  previousHash: string
): string {
  const payload = JSON.stringify(data, Object.keys(data).sort()) + previousHash;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * DB 로그 레코드에서 해시 계산에 사용할 데이터 객체를 추출
 * NOTE: 해시 입력에 포함되는 필드를 변경하면 기존 모든 해시가 무효화됨 → 변경 금지
 */
function extractHashData(log: {
  emissionFactorId: string;
  changeType: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  changeReason?: string | null;
  requestedBy: string;
  requestedAt: Date | string;
}): Record<string, unknown> {
  return {
    emissionFactorId: log.emissionFactorId,
    changeType: log.changeType,
    oldValue: log.oldValue != null ? String(log.oldValue) : null,
    newValue: log.newValue != null ? String(log.newValue) : null,
    changeReason: log.changeReason ?? null,
    requestedBy: log.requestedBy,
    requestedAt: log.requestedAt instanceof Date
      ? log.requestedAt.toISOString()
      : log.requestedAt,
  };
}

// ─── 서비스 ──────────────────────────────────────────────────────────────────

export class EmissionFactorAuditService {
  /**
   * 배출계수 변경을 감사 로그에 Append-only 기록
   *
   * 1. 해당 배출계수의 마지막 로그를 조회 (previousHash 획득)
   * 2. SHA-256(데이터 + previousHash) 계산
   * 3. DB에 append (UPDATE 불가, INSERT만)
   */
  static async recordChange(input: RecordChangeInput): Promise<RecordChangeResult> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const requestedAt = input.requestedAt ?? new Date();

    // 1. 이전 로그 조회 (가장 최신 로그의 currentHash)
    const lastLog = await db.emissionFactorAuditLog.findFirst({
      where: { emissionFactorId: input.emissionFactorId },
      orderBy: { requestedAt: 'desc' },
      select: { currentHash: true },
    });

    const previousHash: string = lastLog?.currentHash ?? 'genesis';

    // 2. 해시 계산
    const hashData = extractHashData({
      emissionFactorId: input.emissionFactorId,
      changeType: input.changeType,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      changeReason: input.changeReason,
      requestedBy: input.requestedBy,
      requestedAt,
    });

    const currentHash = computeHash(hashData, previousHash);

    // 3. DB 저장 (Append-only: create만, update/delete 불가)
    const log = await db.emissionFactorAuditLog.create({
      data: {
        emissionFactorId: input.emissionFactorId,
        changeType: input.changeType,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        changeReason: input.changeReason ?? null,
        previousHash: lastLog ? previousHash : null, // 첫 로그는 null
        currentHash,
        requestedBy: input.requestedBy,
        requestedAt,
        approvedBy: input.approvedBy ?? null,
        approvedAt: input.changeType === 'APPROVED' ? requestedAt : null,
      },
      select: { id: true, currentHash: true },
    });

    return {
      id: log.id,
      currentHash: log.currentHash,
    };
  }

  /**
   * 배출계수 감사 로그 체인 무결성 검증
   *
   * 전체 로그를 시간순으로 읽어 각 로그의 해시를 재계산,
   * 저장된 currentHash와 불일치하면 변조로 판단
   */
  static async verifyIntegrity(emissionFactorId: string): Promise<VerifyIntegrityResult> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const logs = await db.emissionFactorAuditLog.findMany({
      where: { emissionFactorId },
      orderBy: { requestedAt: 'asc' },
    });

    if (logs.length === 0) {
      return { isValid: true, totalLogs: 0 };
    }

    const tamperedLogs: VerifyIntegrityResult['tamperedLogs'] = [];
    let runningPreviousHash = 'genesis';

    for (const log of logs) {
      const hashData = extractHashData({
        emissionFactorId: log.emissionFactorId,
        changeType: log.changeType,
        oldValue: log.oldValue,
        newValue: log.newValue,
        changeReason: log.changeReason,
        requestedBy: log.requestedBy,
        requestedAt: log.requestedAt,
      });

      const expectedHash = computeHash(hashData, runningPreviousHash);

      if (expectedHash !== log.currentHash) {
        tamperedLogs.push({
          id: log.id,
          expectedHash,
          actualHash: log.currentHash,
        });
      }

      // 체인 연결: 다음 로그의 previousHash는 현재 로그의 currentHash
      runningPreviousHash = log.currentHash;
    }

    return {
      isValid: tamperedLogs.length === 0,
      tamperedLogs: tamperedLogs.length > 0 ? tamperedLogs : undefined,
      totalLogs: logs.length,
    };
  }

  /**
   * 배출계수 변경 이력 조회 (Big4 감사용)
   * 해시값 포함, 페이지네이션 지원
   */
  static async getChangeHistory(
    emissionFactorId: string,
    query: AuditLogQuery = {}
  ): Promise<AuditLogListResult> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { emissionFactorId };
    if (query.changeType) where.changeType = query.changeType;
    if (query.requestedBy) where.requestedBy = query.requestedBy;

    const [logs, total] = await Promise.all([
      db.emissionFactorAuditLog.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.emissionFactorAuditLog.count({ where }),
    ]);

    const items: AuditLogEntry[] = logs.map((log: any) => ({
      id: log.id,
      emissionFactorId: log.emissionFactorId,
      changeType: log.changeType as ChangeType,
      reason: log.changeReason ?? undefined,
      oldValue: log.oldValue != null ? Number(log.oldValue) : undefined,
      newValue: log.newValue != null ? Number(log.newValue) : undefined,
      previousHash: log.previousHash ?? undefined,
      currentHash: log.currentHash,
      requestedBy: log.requestedBy,
      requestedAt: log.requestedAt,
      approvedBy: log.approvedBy ?? null,
      approvedAt: log.approvedAt ?? null,
    }));

    return { items, total, page, pageSize };
  }

  /**
   * 배출계수의 마지막 해시 조회
   * (EmissionFactorService에서 체인 연속성 확인용)
   */
  static async getLatestHash(emissionFactorId: string): Promise<string | null> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const log = await db.emissionFactorAuditLog.findFirst({
      where: { emissionFactorId },
      orderBy: { requestedAt: 'desc' },
      select: { currentHash: true },
    });

    return log?.currentHash ?? null;
  }
}
