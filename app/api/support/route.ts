/**
 * /api/support - 고객 문의 접수 / 관리자 목록 조회
 *
 * POST (공개)        → 문의 접수 (비로그인 가능)
 * GET  (tenant_admin+) → 문의 목록 조회 (페이지네이션, 필터)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';
import logger from '@/lib/logger';

const VALID_CATEGORIES = ['general', 'technical', 'billing', 'account', 'feature', 'bug'];
const VALID_STATUSES = ['pending', 'in_progress', 'resolved', 'closed'];

// ──────────────────────────────────────────────────────────────
// GET — 관리자 문의 목록 조회
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const isSuperAdmin = requireRoleOrHigher(auth, 'super_admin' as UserRole);

    const where: Record<string, unknown> = {};

    // super_admin은 전체, tenant_admin은 자기 테넌트 문의만
    if (!isSuperAdmin) {
      where.tenantId = auth.tenantId;
    }

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, inquiries] = await Promise.all([
      prisma.supportInquiry.count({ where: where as never }),
      prisma.supportInquiry.findMany({
        where: where as never,
        select: {
          id: true,
          name: true,
          email: true,
          category: true,
          subject: true,
          status: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return successResponse(
      { inquiries },
      {
        pagination: { skip, take: limit, total, hasMore: skip + limit < total },
        meta: { page, limit, totalPages: Math.ceil(total / limit) },
      }
    );
  } catch (error) {
    console.error('[API] 문의 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// POST — 문의 접수 (비로그인 가능)
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, category, subject, message } = body;

    // 입력 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: '이름을 입력해주세요.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: '올바른 문의 유형을 선택해주세요.' },
        { status: 400 }
      );
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ success: false, error: '제목을 입력해주세요.' }, { status: 400 });
    }
    if (subject.length > 500) {
      return NextResponse.json(
        { success: false, error: '제목은 500자 이내로 입력해주세요.' },
        { status: 400 }
      );
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '문의 내용을 입력해주세요.' },
        { status: 400 }
      );
    }
    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: '문의 내용은 5000자 이내로 입력해주세요.' },
        { status: 400 }
      );
    }

    // 로그인 사용자인 경우 연결
    let tenantId: string | null = null;
    let userId: string | null = null;
    try {
      const auth = await verifyAuth(request);
      if (auth) {
        tenantId = auth.tenantId;
        userId = auth.userId;
      }
    } catch {
      // 비로그인 사용자 → 무시
    }

    const inquiry = await prisma.supportInquiry.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category,
        subject: subject.trim(),
        message: message.trim(),
        tenantId,
        userId,
      },
      select: {
        id: true,
        category: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info('Support inquiry created', {
      inquiryId: inquiry.id,
      category,
      email: email.substring(0, 3) + '***',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: inquiry.id,
          message: '문의가 접수되었습니다. 24시간 이내에 답변 드리겠습니다.',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Support inquiry error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { success: false, error: '문의 접수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
