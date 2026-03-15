/**
 * GET  /api/carbon/market-prices  — 탄소 시장 가격 이력 조회
 * POST /api/carbon/market-prices  — 새 가격 등록 (tenant_admin 이상)
 *
 * 지원 시장: KETS | EU_ETS | VCM | GOLD_STANDARD
 * env KETS_MARKET_PRICE 를 DB 기반으로 대체
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const VALID_MARKETS = ['KETS', 'EU_ETS', 'VCM', 'GOLD_STANDARD'];

// ─────────────────────────────────────────────────────────────
// GET: 시장 가격 이력 조회
// Query: market (default: KETS), days (default: 30), latest=true (최신 1건)
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const market = (searchParams.get('market') || 'KETS').toUpperCase();
    const days   = Math.min(parseInt(searchParams.get('days') || '30', 10), 365);
    const latest = searchParams.get('latest') === 'true';

    if (!VALID_MARKETS.includes(market)) {
      return NextResponse.json(
        { error: `Invalid market. Must be one of: ${VALID_MARKETS.join(', ')}` },
        { status: 400 }
      );
    }

    if (latest) {
      // 최신 가격 1건만 반환 (포트폴리오 평가용)
      const price = await db.carbonMarketPrice.findFirst({
        where: { market },
        orderBy: { priceDate: 'desc' },
      });

      if (!price) {
        // DB에 없으면 env 폴백 (마이그레이션 전 호환)
        const fallbackPrice = Number(process.env.KETS_MARKET_PRICE ?? 8500);
        return NextResponse.json({
          success: true,
          data: null,
          fallback: { market: 'KETS', price: fallbackPrice, currency: 'KRW', source: 'env' },
        });
      }

      return NextResponse.json({ success: true, data: price });
    }

    // 이력 조회
    const since = new Date();
    since.setDate(since.getDate() - days);

    const prices = await db.carbonMarketPrice.findMany({
      where: {
        market,
        priceDate: { gte: since },
      },
      orderBy: { priceDate: 'asc' },
    });

    // 통계 계산
    const priceValues = prices.map((p: { price: unknown }) => Number(p.price));
    const stats = priceValues.length > 0 ? {
      min:  Math.min(...priceValues),
      max:  Math.max(...priceValues),
      avg:  priceValues.reduce((s: number, v: number) => s + v, 0) / priceValues.length,
      last: priceValues[priceValues.length - 1],
      first: priceValues[0],
      changeRate: priceValues.length >= 2
        ? ((priceValues[priceValues.length - 1] - priceValues[0]) / priceValues[0]) * 100
        : 0,
    } : null;

    return NextResponse.json({
      success: true,
      data: prices,
      meta: { market, days, count: prices.length },
      stats,
    });
  } catch (error) {
    console.error('[market-prices GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST: 새 가격 데이터 등록 (관리자)
// Body: { market, priceDate, price, currency?, unit?, source?, changeRate?, volume?, notes? }
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { market, priceDate, price, currency, unit, source, changeRate, volume, notes } = body;

    if (!market || !priceDate || price == null) {
      return NextResponse.json(
        { error: 'market, priceDate, price are required' },
        { status: 400 }
      );
    }

    const marketUpper = String(market).toUpperCase();
    if (!VALID_MARKETS.includes(marketUpper)) {
      return NextResponse.json(
        { error: `Invalid market. Must be one of: ${VALID_MARKETS.join(', ')}` },
        { status: 400 }
      );
    }

    // UPSERT: 같은 market + priceDate 이면 가격 갱신
    const result = await db.carbonMarketPrice.upsert({
      where: {
        uq_market_date: {
          market: marketUpper,
          priceDate: new Date(priceDate),
        },
      },
      update: {
        price:      Number(price),
        currency:   currency   ?? 'KRW',
        unit:       unit       ?? 'tCO2',
        source:     source     ?? null,
        changeRate: changeRate != null ? Number(changeRate) : null,
        volume:     volume     != null ? Number(volume)     : null,
        notes:      notes      ?? null,
      },
      create: {
        market:     marketUpper,
        priceDate:  new Date(priceDate),
        price:      Number(price),
        currency:   currency   ?? 'KRW',
        unit:       unit       ?? 'tCO2',
        source:     source     ?? null,
        changeRate: changeRate != null ? Number(changeRate) : null,
        volume:     volume     != null ? Number(volume)     : null,
        notes:      notes      ?? null,
      },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('[market-prices POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
