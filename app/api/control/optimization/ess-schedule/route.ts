// app/api/control/optimization/ess-schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';

// POST: Generate ESS charge/discharge schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, capacity, chargeEfficiency = 0.95 } = body;

    if (!tenantId || !capacity) {
      return NextResponse.json(
        { error: 'tenantId and capacity are required' },
        { status: 400 }
      );
    }

    // Generate 24-hour ESS schedule
    const schedule = generateESSSchedule(capacity, chargeEfficiency);

    return NextResponse.json({
      tenantId,
      capacity,
      chargeEfficiency,
      schedule,
      estimatedCost: calculateESSCost(schedule),
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to generate ESS schedule:', error);
    return NextResponse.json(
      { error: 'Failed to generate ESS schedule' },
      { status: 500 }
    );
  }
}

function generateESSSchedule(capacity: number, efficiency: number) {
  const schedule = [];
  const offPeakRate = 100; // ₩/kWh (저가 시간)
  const peakRate = 200; // ₩/kWh (고가 시간)

  for (let hour = 0; hour < 24; hour++) {
    let operation = 'idle';
    let power = 0;
    let soc = 50; // State of Charge %
    let cost = 0;

    if (hour >= 23 || hour < 7) {
      // Night: Charging (low-cost hours)
      operation = 'charging';
      power = capacity * 0.8; // 80% charging power
      soc = Math.min(100, 50 + (power / capacity) * 20);
      cost = (power * offPeakRate) / efficiency;
    } else if ((hour >= 9 && hour <= 11) || (hour >= 18 && hour <= 20)) {
      // Peak hours: Discharging
      operation = 'discharging';
      power = capacity * 0.6; // 60% discharging power
      soc = Math.max(0, 50 - (power / capacity) * 15);
      cost = power * peakRate;
    } else {
      // Idle/Standby
      operation = 'idle';
      power = capacity * 0.05; // Minimal standby
      soc = 50;
      cost = power * 10;
    }

    schedule.push({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      operation,
      power: parseFloat(power.toFixed(2)),
      soc: parseFloat(soc.toFixed(1)),
      cost: Math.round(cost),
      revenue:
        operation === 'discharging' ? Math.round(power * peakRate) : 0,
    });
  }

  return schedule;
}

function calculateESSCost(schedule: any[]) {
  const totalCost = schedule.reduce((sum, hour) => sum + hour.cost, 0);
  const totalRevenue = schedule.reduce((sum, hour) => sum + hour.revenue, 0);
  const netSavings = totalRevenue - totalCost;

  return {
    chargingCost: Math.round(
      schedule
        .filter((h) => h.operation === 'charging')
        .reduce((sum, h) => sum + h.cost, 0)
    ),
    totalRevenue: Math.round(totalRevenue),
    netSavings: Math.round(netSavings),
    netSavingsPerDay: Math.round(netSavings),
    netSavingsPerMonth: Math.round(netSavings * 30),
  };
}
