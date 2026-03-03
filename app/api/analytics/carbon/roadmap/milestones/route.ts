// app/api/analytics/carbon/roadmap/milestones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/analytics/carbon/roadmap/milestones
 * 마일스톤 목록 조회 (없으면 기본값 자동 삽입)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    let rows = await prisma.milestone.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ displayOrder: 'asc' }, { year: 'asc' }],
    });
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        year: Number(r.year),
        title: r.title,
        status: r.status,
        displayOrder: Number(r.displayOrder),
      })),
    });
  } catch (error) {
    console.error('Milestone GET error:', error);
    return NextResponse.json(
      { error: '마일스톤 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/carbon/roadmap/milestones
 * 마일스톤 추가
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json() as { year: number; title: string; status?: string };
    const { year, title, status = 'pending' } = body;

    if (!year || !title?.trim()) {
      return NextResponse.json({ error: '연도와 내용은 필수입니다.' }, { status: 400 });
    }

    // compute next displayOrder using Prisma aggregate
    const agg = await prisma.milestone.aggregate({
      where: { tenantId: auth.tenantId },
      _max: { displayOrder: true },
    });
    const displayOrder = (Number(agg._max.displayOrder ?? -1)) + 1;

    const created = await prisma.milestone.create({
      data: {
        tenantId: auth.tenantId,
        year,
        title: title.trim(),
        status,
        displayOrder,
      },
    });

    return NextResponse.json({ success: true, id: created.id, displayOrder: created.displayOrder });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Milestone POST] 저장 실패:', msg, error);
    return NextResponse.json(
      { error: `마일스톤 추가 실패: ${msg}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/analytics/carbon/roadmap/milestones
 * 마일스톤 수정 (status | title | year 부분 업데이트 — 단일 쿼리)
 * body: { id, year?, title?, status? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json() as {
      id: string;
      year?: number;
      title?: string;
      status?: string;
    };
    const { id, year, title, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    }

    // 권한 확인 + 존재 여부 via Prisma
    const existing = await prisma.milestone.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!existing) return NextResponse.json({ error: '마일스톤을 찾을 수 없습니다.' }, { status: 404 });

    const data: { status?: string; title?: string; year?: number } = {};
    if (status !== undefined) data.status = status;
    if (title !== undefined && title.trim()) data.title = title.trim();
    if (year !== undefined && year > 0) data.year = year;

    if (Object.keys(data).length > 0) {
      // updatedAt은 스키마의 @updatedAt이 자동 처리
      await prisma.milestone.update({ where: { id }, data });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Milestone PATCH error:', error);
    return NextResponse.json(
      { error: '마일스톤 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analytics/carbon/roadmap/milestones?id=xxx
 * 마일스톤 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id 파라미터가 필요합니다.' }, { status: 400 });
    }

    // Ensure tenant ownership then delete
    await prisma.milestone.deleteMany({ where: { id, tenantId: auth.tenantId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Milestone DELETE error:', error);
    return NextResponse.json(
      { error: '마일스톤 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
