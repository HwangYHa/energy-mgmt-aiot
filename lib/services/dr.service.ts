/**
 * DR (Demand Response) 서비스
 * 수요 반응 관리 및 최적화
 */

export interface DREvent {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  targetReduction: number;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled';
  createdAt: Date;
  devices: string[];
  priority: 'low' | 'medium' | 'high';
}

/**
 * DR 이벤트 관리
 */
export class DRService {
  static async createEvent(data: {
    name: string;
    startTime: Date;
    endTime: Date;
    targetReduction: number;
    devices?: string[];
    priority?: 'low' | 'medium' | 'high';
  }): Promise<DREvent> {
    const event: DREvent = {
      id: `dr-${Date.now()}`,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      targetReduction: data.targetReduction,
      status: 'scheduled',
      createdAt: new Date(),
      devices: data.devices || [],
      priority: data.priority || 'medium',
    };
    return event;
  }

  static async executeEvent(eventId: string): Promise<DREvent> {
    return {
      id: eventId,
      name: 'Event',
      startTime: new Date(),
      endTime: new Date(),
      targetReduction: 50,
      status: 'running',
      createdAt: new Date(),
      devices: [],
      priority: 'medium',
    };
  }

  static async cancelEvent(_eventId: string): Promise<void> {
    // TODO: 이벤트 취소 로직
  }

  static async getEventStatus(_eventId: string): Promise<DREvent | null> {
    return null;
  }

  static async getEventHistory(
    _tenantId: string,
    _days: number = 30
  ): Promise<DREvent[]> {
    return [];
  }

  static calculateRevenue(
    reduction: number,
    hours: number,
    rate: number = 200
  ): number {
    return reduction * hours * rate;
  }
}

/**
 * DR 이벤트 최적화
 */
export class DROptimizer {
  static optimizeDeviceSelection(
    availableDevices: Array<{ id: string; reduction_capacity: number }>,
    targetReduction: number,
    _priority: string = 'cost_effective'
  ): string[] {
    const sortedDevices = availableDevices.sort((a, b) =>
      b.reduction_capacity - a.reduction_capacity
    );

    const selectedIds: string[] = [];
    let totalReduction = 0;

    for (const device of sortedDevices) {
      if (totalReduction >= targetReduction) break;
      selectedIds.push(device.id);
      totalReduction += device.reduction_capacity;
    }

    return selectedIds;
  }

  static optimizeTiming(
    peakHours: number[],
    maxDuration: number = 4
  ): [number, number] {
    if (peakHours.length === 0) return [14, 18];
    const start = Math.min(...peakHours);
    const end = Math.min(start + maxDuration, 24);
    return [start, end];
  }
}

/**
 * DR 분석
 */
export class DRAnalytics {
  static calculateSavings(
    reduction: number,
    hours: number,
    avoidedCostPerKwh: number = 200,
    drIncentivePerKwh: number = 100
  ): {
    avoidedCost: number;
    drIncentive: number;
    totalSavings: number;
  } {
    const avoidedCost = reduction * hours * avoidedCostPerKwh;
    const drIncentive = reduction * hours * drIncentivePerKwh;

    return {
      avoidedCost,
      drIncentive,
      totalSavings: avoidedCost + drIncentive,
    };
  }

  static analyzeResponseRate(
    targetReduction: number,
    actualReduction: number,
    targetDevices: number,
    responsiveDevices: number
  ): {
    reductionRate: number;
    deviceResponseRate: number;
    success: boolean;
    feedback: string;
  } {
    const reductionRate =
      targetReduction > 0 ? actualReduction / targetReduction : 0;
    const deviceResponseRate =
      targetDevices > 0 ? responsiveDevices / targetDevices : 0;

    return {
      reductionRate,
      deviceResponseRate,
      success: reductionRate >= 0.8 && deviceResponseRate >= 0.7,
      feedback: getFeedback(reductionRate, deviceResponseRate),
    };
  }
}

function getFeedback(reductionRate: number, deviceResponseRate: number): string {
  if (reductionRate >= 0.95 && deviceResponseRate >= 0.9) {
    return '⭐ 매우 우수한 응답';
  } else if (reductionRate >= 0.8 && deviceResponseRate >= 0.7) {
    return '✅ 좋은 응답';
  } else if (reductionRate >= 0.6) {
    return '⚠️ 개선 필요';
  } else {
    return '❌ 낮은 응답률';
  }
}
