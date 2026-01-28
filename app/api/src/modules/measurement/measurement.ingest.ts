// app/api/src/modules/measurement/measurement.ingest.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { PrismaService } from '../../prisma/prisma.service';

interface IncomingSensorData {
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

@Injectable()
export class MeasurementIngestService implements OnModuleInit {
  private readonly logger = new Logger(MeasurementIngestService.name);
  private client: mqtt.MqttClient;
  private buffer: IncomingSensorData[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.connectToMqtt();
    this.startBufferFlush();
  }

  /**
   * MQTT Broker 연결
   */
  private async connectToMqtt() {
    const mqttUrl = this.configService.get<string>('MQTT_URL', 'mqtt://localhost:1883');
    
    this.client = mqtt.connect(mqttUrl, {
      clientId: `api-server-${process.pid}`,
      clean: true,
      reconnectPeriod: 1000,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Connected to MQTT broker');
      
      // measurement/+/+/+ 토픽 구독
      // measurement/{tenantId}/{gatewayId}/{deviceId}
      this.client.subscribe('measurement/+/+/+', { qos: 1 }, (err) => {
        if (err) {
          this.logger.error('❌ Failed to subscribe to measurement topic', err);
        } else {
          this.logger.log('📡 Subscribed to measurement/+/+/+');
        }
      });
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      this.logger.error('❌ MQTT Error:', error);
    });

    this.client.on('disconnect', () => {
      this.logger.warn('⚠️  Disconnected from MQTT broker');
    });
  }

  /**
   * MQTT 메시지 처리
   */
  private handleMessage(topic: string, message: Buffer) {
    try {
      const data: IncomingSensorData = JSON.parse(message.toString());
      
      // 데이터 검증
      if (!this.validateData(data)) {
        this.logger.warn(`⚠️  Invalid data received from ${topic}`);
        return;
      }

      // 버퍼에 추가
      this.buffer.push(data);

      this.logger.debug(`📥 Received: ${data.deviceId}/${data.metricKey} = ${data.value}`);
    } catch (error) {
      this.logger.error(`❌ Failed to parse message from ${topic}:`, error);
    }
  }

  /**
   * 데이터 검증
   */
  private validateData(data: IncomingSensorData): boolean {
    return !!(
      data.timestamp &&
      data.tenantId &&
      data.gatewayId &&
      data.deviceId &&
      data.metricId &&
      data.metricKey &&
      typeof data.value === 'number' &&
      data.quality &&
      data.unit
    );
  }

  /**
   * 버퍼 플러시 시작 (5초마다)
   */
  private startBufferFlush() {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // 5초마다 DB 저장
  }

  /**
   * 버퍼 데이터를 DB에 저장
   */
  private async flushBuffer() {
    if (this.buffer.length === 0) {
      return;
    }

    const dataToSave = [...this.buffer];
    this.buffer = [];

    try {
      const startTime = Date.now();

      // Bulk Insert (Prisma createMany)
      await this.prisma.measurement.createMany({
        data: dataToSave.map((item) => ({
          timestamp: new Date(item.timestamp),
          tenantId: item.tenantId,
          metricId: item.metricId,
          value: item.value,
          quality: item.quality,
          source: 'sensor' as const,
        })),
        skipDuplicates: true,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `💾 Saved ${dataToSave.length} measurements to DB (${duration}ms)`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to save measurements:', error);
      
      // 실패한 데이터를 다시 버퍼에 추가 (재시도)
      this.buffer.unshift(...dataToSave);
    }
  }

  /**
   * 서비스 종료 시 정리
   */
  async onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // 남은 버퍼 데이터 저장
    await this.flushBuffer();

    if (this.client) {
      this.client.end();
    }
  }
}