/**
 * GET /api/carbon/vcm/[registryId]
 *
 * VCM 프로젝트 단건 조회
 * - 공동편익(SDG), 추가성 등급, 검증 정보 포함
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { VCMRegistryService } from '@/lib/domains/carbon-trading/extensions/vcm/vcm-registry.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ registryId: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { registryId } = await params;

  try {
    const project = await VCMRegistryService.getByRegistryId(registryId, auth.tenantId);
    if (!project) return errorResponse('RESOURCE_NOT_FOUND', { status: 404, details: { message: 'VCM 프로젝트를 찾을 수 없습니다' } });
    return successResponse(project);
  } catch (e) {
    console.error('[carbon/vcm/[registryId] GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}