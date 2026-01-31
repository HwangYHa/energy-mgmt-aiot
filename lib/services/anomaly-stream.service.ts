// lib/services/anomaly-stream.service.ts
import { EventEmitter } from 'events';

export class AnomalyStreamService extends EventEmitter {
  private buffer: Measurement[] = [];
  private readonly BUFFER_SIZE = 100;
  
  async processRealtimeMeasurement(measurement: Measurement) {
    this.buffer.push(measurement);
    
    if (this.buffer.length >= this.BUFFER_SIZE) {
      // AI 엔진에 배치 전송
      const result = await fetch('http://ai-engine:8000/anomaly/detect', {
        method: 'POST',
        body: JSON.stringify({ data: this.buffer })
      }).then(r => r.json());
      
      if (result.anomaly_indices.length > 0) {
        // 이상 탐지 시 알람 발생
        this.emit('anomaly-detected', {
          tenantId: measurement.tenantId,
          deviceId: measurement.deviceId,
          severity: result.severity,
          anomalies: result.anomaly_indices,
          confidence: result.confidence
        });
      }
      
      this.buffer = [];
    }
  }
}