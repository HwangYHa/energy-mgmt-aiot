// app/scripts/gateway-simulator.ts
import * as mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';

/**
 * 🎲 Gateway 시뮬레이터
 * 
 * 역할:
 * - 실제 IoT Gateway 동작 시뮬레이션
 * - 가상 센서 데이터 생성
 * - MQTT로 데이터 전송
 * 
 * 실행:
 * npx ts-node app/scripts/gateway-simulator.ts
 */

interface SensorData {
  timestamp: string;
  tenantId: string;
  gatewayId: string;
  deviceId: string;
  metricId: string;
  metricKey: string;
  value: number;
  quality: 'good' | 'bad' | 'uncertain';
  unit: string;
}

interface Metric {
  id: string;
  key: string;
  unit: string;
  min: number;
  max: number;
  accumulate?: boolean;
  currentValue?: number;
}

interface Device {
  id: string;
  name: string;
  type: string;
  metrics: Metric[];
}

class GatewaySimulator {
  private client: mqtt.MqttClient;
  private gatewayId: string;
  private tenantId: string;
  private devices: Device[] = [];
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private mqttUrl: string,
    private publishInterval: number = 5000, // 5초마다 전송
  ) {
    this.gatewayId = process.env.GATEWAY_ID || `gateway-${uuidv4()}`;
    this.tenantId = process.env.TENANT_ID || 'demo-tenant-id';
    
    // MQTT 클라이언트 연결
    this.client = mqtt.connect(this.mqttUrl, {
      clientId: this.gatewayId,
      clean: true,
      reconnectPeriod: 1000,
    });

    this.setupMqttHandlers();
    this.initializeDevices();
  }

  /**
   * MQTT 이벤트 핸들러 설정
   */
  private setupMqttHandlers() {
    this.client.on('connect', () => {
      console.log(`✅ Gateway ${this.gatewayId} connected to MQTT broker`);
      
      // Gateway 상태 토픽 구독 (제어 명령 수신용)
      this.client.subscribe(`gateway/${this.gatewayId}/control/#`, (err) => {
        if (err) {
          console.error('❌ Subscribe failed:', err);
        } else {
          console.log(`📡 Subscribed to control topic`);
        }
      });

      // 데이터 전송 시작
      this.startPublishing();
    });

    this.client.on('message', (topic, message) => {
      console.log(`📨 Received control message: ${topic} - ${message.toString()}`);
      this.handleControlMessage(topic, message);
    });

    this.client.on('error', (error) => {
      console.error('❌ MQTT Error:', error);
    });

    this.client.on('disconnect', () => {
      console.log('⚠️  Disconnected from MQTT broker');
    });
  }

  /**
   * 가상 디바이스 초기화
   */
  private initializeDevices() {
    this.devices = [
      // 전력계
      {
        id: `device-${uuidv4()}`,
        name: 'Main Power Meter',
        type: 'power_meter',
        metrics: [
          { id: uuidv4(), key: 'voltage', unit: 'V', min: 220, max: 240 },
          { id: uuidv4(), key: 'current', unit: 'A', min: 10, max: 100 },
          { id: uuidv4(), key: 'power', unit: 'kW', min: 2, max: 50 },
          { id: uuidv4(), key: 'energy', unit: 'kWh', min: 0, max: 1000, accumulate: true },
          { id: uuidv4(), key: 'power_factor', unit: '', min: 0.85, max: 1.0 },
        ],
      },
      // HVAC
      {
        id: `device-${uuidv4()}`,
        name: 'HVAC System',
        type: 'hvac',
        metrics: [
          { id: uuidv4(), key: 'temperature', unit: '°C', min: 18, max: 28 },
          { id: uuidv4(), key: 'humidity', unit: '%', min: 40, max: 70 },
          { id: uuidv4(), key: 'fan_speed', unit: 'RPM', min: 0, max: 1500 },
          { id: uuidv4(), key: 'power_consumption', unit: 'kW', min: 1, max: 15 },
        ],
      },
      // 조명
      {
        id: `device-${uuidv4()}`,
        name: 'LED Lighting',
        type: 'lighting',
        metrics: [
          { id: uuidv4(), key: 'brightness', unit: '%', min: 0, max: 100 },
          { id: uuidv4(), key: 'power_consumption', unit: 'W', min: 0, max: 500 },
          { id: uuidv4(), key: 'status', unit: 'bool', min: 0, max: 1 },
        ],
      },
    ];

    console.log(`🔧 Initialized ${this.devices.length} virtual devices`);
  }

  /**
   * 데이터 전송 시작
   */
  private startPublishing() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(() => {
      this.publishSensorData();
    }, this.publishInterval);

    console.log(`🚀 Started publishing data every ${this.publishInterval}ms`);
  }

  /**
   * 센서 데이터 생성 및 전송
   */
  private publishSensorData() {
    const timestamp = new Date().toISOString();

    this.devices.forEach((device) => {
      device.metrics.forEach((metric) => {
        const sensorData: SensorData = {
          timestamp,
          tenantId: this.tenantId,
          gatewayId: this.gatewayId,
          deviceId: device.id,
          metricId: metric.id,
          metricKey: metric.key,
          value: this.generateValue(metric),
          quality: Math.random() > 0.95 ? 'uncertain' : 'good', // 5% 확률로 uncertain
          unit: metric.unit,
        };

        // MQTT 토픽: measurement/{tenantId}/{gatewayId}/{deviceId}
        const topic = `measurement/${this.tenantId}/${this.gatewayId}/${device.id}`;
        
        this.client.publish(
          topic,
          JSON.stringify(sensorData),
          { qos: 1 },
          (err) => {
            if (err) {
              console.error(`❌ Publish failed: ${topic}`, err);
            }
          }
        );
      });
    });

    console.log(`📤 Published data for ${this.devices.length} devices at ${timestamp}`);
  }

  /**
   * 가상 센서 값 생성
   */
  private generateValue(metric: Metric): number {
    if (metric.accumulate) {
      // 누적 값 (전력량 등)
      metric.currentValue = (metric.currentValue || 0) + Math.random() * 0.5;
      return parseFloat(metric.currentValue.toFixed(2));
    } else {
      // 일반 값 (범위 내 랜덤)
      const value = metric.min + Math.random() * (metric.max - metric.min);
      
      // 정수형 (bool, status 등)
      if (metric.unit === 'bool' || metric.key === 'status') {
        return Math.round(value);
      }
      
      return parseFloat(value.toFixed(2));
    }
  }

  /**
   * 제어 명령 처리
   */
  private handleControlMessage(topic: string, message: Buffer) {
    try {
      const command = JSON.parse(message.toString());
      console.log('🎮 Control command received:', command);

      // 제어 명령 처리 로직
      // 예: 조명 ON/OFF, HVAC 온도 조절 등
      
      // 응답 전송
      const responseTopic = topic.replace('/control/', '/response/');
      this.client.publish(responseTopic, JSON.stringify({
        status: 'success',
        timestamp: new Date().toISOString(),
        command,
      }));
    } catch (error) {
      console.error('❌ Failed to handle control message:', error);
    }
  }

  /**
   * 시뮬레이터 종료
   */
  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.client.end();
    console.log('⏹️  Gateway simulator stopped');
  }
}

// ==========================================
// 실행
// ==========================================
if (require.main === module) {
  const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
  const publishInterval = parseInt(process.env.PUBLISH_INTERVAL || '5000', 10);

  const simulator = new GatewaySimulator(mqttUrl, publishInterval);

  // 종료 처리
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    simulator.stop();
    process.exit(0);
  });
}

export default GatewaySimulator;