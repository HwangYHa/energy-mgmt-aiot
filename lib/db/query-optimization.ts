/**
 * Prisma N+1 쿼리 제거 가이드 및 유틸
 * 
 * 문제: N+1 쿼리란?
 * - 1번의 쿼리로 N개의 부모 레코드를 가져온 후
 * - 각 부모마다 1번씩 쿼리를 실행하여 자식 데이터를 가져오는 패턴
 * - 총 N+1번의 쿼리 발생
 * 
 * 예시:
 * ❌ BAD: 11번의 쿼리 (1 + 10)
 * const sites = await prisma.site.findMany({ take: 10 });
 * const devicesPerSite = await Promise.all(
 *   sites.map(site => prisma.device.findMany({ where: { siteId: site.id } }))
 * );
 * 
 * ✅ GOOD: 1번의 쿼리
 * const sitesWithDevices = await prisma.site.findMany({
 *   take: 10,
 *   include: { devices: true }
 * });
 */

import { prisma } from '@/lib/db/prisma';
import { logPerformance } from '@/lib/logger';

// ========================================
// 1. Select 대신 Include 사용
// ========================================

/**
 * ❌ BAD: N+1 쿼리 발생
 * 
 * const sites = await prisma.site.findMany();
 * const devicesMap = new Map();
 * 
 * for (const site of sites) {
 *   const devices = await prisma.device.findMany({ where: { siteId: site.id } });
 *   devicesMap.set(site.id, devices);
 * }
 */

/**
 * ✅ GOOD: Include를 사용하여 관계 데이터 한 번에 로드
 */
export async function getSitesWithDevices(tenantId: string) {
  return await prisma.site.findMany({
    where: { tenantId },
    include: {
      devices: {
        select: {
          id: true,
          name: true,
          deviceType: true,
          status: true,
          lastSeenAt: true,
        },
      },
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

// ========================================
// 2. Select로 필요한 필드만 가져오기
// ========================================

/**
 * ❌ BAD: 모든 필드 가져오기 (불필요한 데이터)
 * const devices = await prisma.device.findMany();
 */

/**
 * ✅ GOOD: 필요한 필드만 가져오기 (passwordHash, connectionConfig 제외)
 */
export async function getDevicesForUI(tenantId: string) {
  return await prisma.device.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      code: true,
      deviceType: true,
      status: true,
      lastSeenAt: true,
      gateway: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

// ========================================
// 3. 중첩된 Include (깊이 제한)
// ========================================

/**
 * ✅ GOOD: 깊이 제한하여 과도한 조인 방지 (권장: 최대 3단계)
 */
export async function getTenantWithHierarchy(tenantId: string) {
  return await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      // 레벨 1: 사이트
      sites: {
        select: {
          id: true,
          name: true,
          // 레벨 2: 기기
          devices: {
            select: {
              id: true,
              name: true,
              // 레벨 3: 메트릭 (권장 최대 깊이)
              metrics: {
                select: {
                  id: true,
                  key: true,
                  unit: true,
                },
                take: 5, // 메트릭 개수 제한
              },
            },
            take: 10, // 기기 개수 제한
          },
        },
        take: 5, // 사이트 개수 제한
      },
      users: {
        select: {
          id: true,
          email: true,
          role: true,
        },
        take: 10,
      },
    },
  });
}

// ========================================
// 4. 페이지네이션과 함께 사용
// ========================================

/**
 * ✅ GOOD: 대량 데이터는 페이지네이션으로 처리
 */
export async function getDevicesPaginated(
  tenantId: string,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;

  const [devices, total] = await Promise.all([
    prisma.device.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        deviceType: true,
        status: true,
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.device.count({
      where: { tenantId },
    }),
  ]);

  return {
    data: devices,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ========================================
// 5. 집계 쿼리 최적화
// ========================================

/**
 * ❌ BAD: 모든 데이터를 가져와서 메모리에서 계산
 * 
 * const measurements = await prisma.measurement.findMany();
 * const avgValue = measurements.reduce((sum, m) => sum + m.value, 0) / measurements.length;
 */

/**
 * ✅ GOOD: 데이터베이스에서 직접 계산
 */
export async function getMeasurementStats(metricId: string) {
  return await prisma.measurement.aggregate({
    where: { metricId },
    _avg: { value: true },
    _min: { value: true },
    _max: { value: true },
    _count: true,
  });
}

// ========================================
// 6. 배치 쿼리
// ========================================

/**
 * ❌ BAD: 루프에서 개별 쿼리
 * 
 * for (const deviceId of deviceIds) {
 *   const device = await prisma.device.findUnique({
 *     where: { id: deviceId }
 *   });
 * }
 */

/**
 * ✅ GOOD: findMany로 한 번에 가져오기
 */
export async function getDevicesByIds(deviceIds: string[]) {
  return await prisma.device.findMany({
    where: {
      id: { in: deviceIds },
    },
    select: {
      id: true,
      name: true,
      status: true,
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

// ========================================
// 7. 필터링 및 정렬 최적화
// ========================================

/**
 * ✅ GOOD: 데이터베이스 레벨에서 필터링 및 정렬
 */
export async function searchDevices(
  tenantId: string,
  searchTerm?: string,
  status?: string,
  sortBy: 'name' | 'status' | 'createdAt' = 'createdAt'
) {
  return await prisma.device.findMany({
    where: {
      tenantId,
      // 텍스트 검색 (MySQL LIKE)
      ...(searchTerm && {
        OR: [
          { name: { contains: searchTerm } },
          { code: { contains: searchTerm } },
          { manufacturer: { contains: searchTerm } },
        ],
      }),
      // 상태 필터
      ...(status && { status: status as any }),
    },
    select: {
      id: true,
      name: true,
      code: true,
      deviceType: true,
      status: true,
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      [sortBy]: 'asc',
    },
    take: 100,
  });
}

// ========================================
// 8. 성능 모니터링
// ========================================

/**
 * 쿼리 성능 추적
 */
export async function monitoredQuery<T>(
  operationName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    // 성능 로깅
    if (duration > 500) {
      logPerformance({
        operation: `Prisma: ${operationName}`,
        duration,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Query failed after ${duration}ms:`, error);
    throw error;
  }
}

// ========================================
// 9. 트랜잭션 최적화
// ========================================

/**
 * ✅ GOOD: 트랜잭션으로 관련 쿼리를 한 번에 처리
 */
export async function createSiteWithDevices(
  tenantId: string,
  siteData: { name: string; address?: string },
  devices: Array<{
    name: string;
    deviceType: string;
  }>
) {
  return await prisma.$transaction(async (tx) => {
    // 1. 사이트 생성
    const site = await tx.site.create({
      data: {
        ...siteData,
        tenantId,
      },
    });

    // 2. 기기 대량 생성
    await tx.device.createMany({
      data: devices.map((device) => ({
        ...device,
        tenantId,
        siteId: site.id,
        protocol: 'modbus' as any, // Default protocol
        connectionConfig: {} as any, // Default empty config
      })),
    });

    return site;
  });
}

// ========================================
// 10. 체크리스트
// ========================================

/**
 * N+1 쿼리 제거 체크리스트
 * 
 * □ Include/Select로 관계 데이터 한 번에 로드
 * □ 불필요한 필드 제외 (passwordHash, connectionConfig 등)
 * □ Include 깊이 최대 3단계 유지
 * □ 대량 데이터는 페이지네이션 적용
 * □ 집계는 DB에서 직접 계산
 * □ 루프에서 쿼리 금지 (findMany 사용)
 * □ 필터링/정렬은 DB 레벨에서 수행
 * □ 느린 쿼리 모니터링 (500ms 이상)
 * □ 트랜잭션으로 관련 쿼리 그룹화
 * □ 인덱스 활용 (createdAt, tenantId, status 등)
 */

export const QUERY_OPTIMIZATION_TIPS = {
  '1. Include 사용': '관계 데이터를 Include로 한 번에 로드',
  '2. Select 필터링': '필요한 필드만 선택하여 네트워크 트래픽 감소',
  '3. 깊이 제한': 'Include 깊이를 최대 3단계로 제한',
  '4. 페이지네이션': '대량 데이터는 반드시 페이지네이션',
  '5. 집계 함수': 'aggregate로 DB에서 직접 계산',
  '6. 배치 쿼리': 'findMany로 여러 ID의 데이터를 한 번에 가져오기',
  '7. 트랜잭션': '관련 쿼리는 트랜잭션으로 묶기',
  '8. 모니터링': '느린 쿼리 로깅 (500ms 기준)',
};
