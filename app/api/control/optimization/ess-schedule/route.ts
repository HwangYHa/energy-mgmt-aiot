/**
 * POST /api/control/optimization/ess-schedule
 *
 * ESS 충방전 24시간 최적 스케줄 생성 — operator 이상 권한 필요
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

const bodySchema = z.object({
  capacity:         z.number().positive('용량은 양수여야 합니다.'),
  chargeEfficiency: z.number().min(0.5).max(1).default(0.95),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) return forbiddenResponse();

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '잘못된 파라미터입니다.' },
        { status: 400 }
      );
    }

    const { capacity, chargeEfficiency } = parsed.data;
    const schedule = generateESSSchedule(capacity, chargeEfficiency);

    return successResponse({
      tenantId: auth.tenantId,
      capacity,
      chargeEfficiency,
      schedule,
      estimatedCost: calculateESSCost(schedule),
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error('[ESS Schedule]', error);
    return serverErrorResponse();
  }
}

function generateESSSchedule(capacity: number, efficiency: number) {
  const schedule = [];
  const offPeakRate = 100; // ₩/kWh
  const peakRate    = 200; // ₩/kWh

  for (let hour = 0; hour < 24; hour++) {
    let operation: 'charging' | 'discharging' | 'idle';
    let power: number;
    let soc: number;
    let cost: number;

    if (hour >= 23 || hour < 7) {
      operation = 'charging';
      power = capacity * 0.8;
      soc   = Math.min(100, 50 + (power / capacity) * 20);
      cost  = (power * offPeakRate) / efficiency;
    } else if ((hour >= 9 && hour <= 11) || (hour >= 18 && hour <= 20)) {
      operation = 'discharging';
      power = capacity * 0.6;
      soc   = Math.max(0, 50 - (power / capacity) * 15);
      cost  = power * peakRate;
    } else {
      operation = 'idle';
      power = capacity * 0.05;
      soc   = 50;
      cost  = power * 10;
    }

    schedule.push({
      hour:      `${hour.toString().padStart(2, '0')}:00`,
      operation,
      power:     parseFloat(power.toFixed(2)),
      soc:       parseFloat(soc.toFixed(1)),
      cost:      Math.round(cost),
      revenue:   operation === 'discharging' ? Math.round(power * peakRate) : 0,
    });
  }
  return schedule;
}

function calculateESSCost(schedule: Array<{ operation: string; cost: number; revenue: number }>) {
  const totalCost    = schedule.reduce((s, h) => s + h.cost, 0);
  const totalRevenue = schedule.reduce((s, h) => s + h.revenue, 0);
  const netSavings   = totalRevenue - totalCost;
  return {
    chargingCost:      Math.round(schedule.filter(h => h.operation === 'charging').reduce((s, h) => s + h.cost, 0)),
    totalRevenue:      Math.round(totalRevenue),
    netSavings:        Math.round(netSavings),
    netSavingsPerDay:  Math.round(netSavings),
    netSavingsPerMonth: Math.round(netSavings * 30),
  };
}
