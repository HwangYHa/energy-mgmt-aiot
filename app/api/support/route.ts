/**
 * /api/support - 고객 문의 접수
 *
 * 보안:
 * ✅ 비로그인도 가능 (공개 폼)
 * ✅ 입력 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import logger from '@/lib/logger';

const VALID_CATEGORIES = ['general', 'technical', 'billing', 'account', 'feature', 'bug'];

// POST /api/support - 문의 접수
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, category, subject, message } = body;

    // 입력 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: '이름을 입력해주세요.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: '올바른 이메일 주소를 입력해주세요.' }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: '올바른 문의 유형을 선택해주세요.' }, { status: 400 });
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ success: false, error: '제목을 입력해주세요.' }, { status: 400 });
    }
    if (subject.length > 500) {
      return NextResponse.json({ success: false, error: '제목은 500자 이내로 입력해주세요.' }, { status: 400 });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: '문의 내용을 입력해주세요.' }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ success: false, error: '문의 내용은 5000자 이내로 입력해주세요.' }, { status: 400 });
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

    // DB 저장
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

    return NextResponse.json({
      success: true,
      data: {
        id: inquiry.id,
        message: '문의가 접수되었습니다. 24시간 이내에 답변 드리겠습니다.',
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Support inquiry error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({
      success: false,
      error: '문의 접수 중 오류가 발생했습니다.',
    }, { status: 500 });
  }
}
