/**
 * GET /api/carbon/retirement/[id]/certificate
 *
 * 소각 인증서 상세 조회 + JSON 다운로드
 * (PDF 생성은 별도 서버사이드 렌더링 구현 시 확장)
 *
 * ?format=json|pdf (기본: json)
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { errorResponse } from '@/lib/api/response';
import { CarbonRetirementService } from '@/lib/domains/carbon-trading';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'json';

  const cert = await CarbonRetirementService.getCertificate(id, auth.tenantId);
  if (!cert) return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });

  if (format === 'json') {
    const filename = `CarbonRetirement_${cert.retirementId}.json`;
    return new Response(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          documentType: 'CarbonRetirementCertificate',
          issuedAt: new Date().toISOString(),
          certificate: {
            retirementId:       cert.retirementId,
            registry:           cert.registry?.registry,
            projectId:          cert.registry?.projectId,
            creditType:         cert.registry?.creditType,
            vintageYear:        cert.registry?.vintageYear,
            serialNumbers:      cert.serialNumbers,
            retiredQuantity:    cert.retiredQuantity,
            retirementReason:   cert.retirementReason,
            beneficiaryCompany: cert.beneficiaryCompany,
            retirementDate:     cert.retirementDate,
            offsetScope:        cert.offsetScope,
            compliancePeriod:   cert.compliancePeriod,
            registryReference:  cert.registryReference,
            ketsSubmissionId:   cert.ketsSubmissionId,
          },
          auditTrail: {
            ledgerEntryHashSignature: cert.ledgerEntry?.hashSignature,
            recordedAt: cert.ledgerEntry?.createdAt,
          },
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // format=pdf — 향후 PDFKit으로 확장
  return errorResponse('VALIDATION_ERROR', {
    status: 400,
    details: { message: 'PDF 형식은 준비 중입니다. format=json을 사용하세요' },
  });
}
