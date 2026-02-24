/**
 * lib/gateway/protocol-config.ts — Edge Gateway 프로토콜 설정 스키마
 *
 * 지원 프로토콜:
 *   MQTT     — 클라우드 Push (현재 기본)
 *   Modbus   — 산업용 PLC/DDC (TCP/RTU)
 *   BACnet   — 빌딩 자동화 (IP)
 *   OPC-UA   — 스마트 팩토리 표준
 *   HTTP     — REST Pull (폴링)
 *
 * 사용 예:
 *   Gateway.config 필드에 저장
 *   { protocol: 'modbus_tcp', modbus: { host: '192.168.1.100', port: 502, ... } }
 *
 * 아키텍처:
 *   현장 게이트웨이가 각 프로토콜로 설비에 연결 →
 *   데이터를 표준 페이로드로 클라우드 POST →
 *   /api/gateways/{id}/data 엔드포인트 수신
 */

// ──────────────────────────────────────────────────────────────
// 표준 데이터 페이로드 (프로토콜 무관)
// ──────────────────────────────────────────────────────────────

export interface GatewayDataPayload {
  /** 게이트웨이 UUID (경로 파라미터로도 전달) */
  gatewayId?: string;
  /** 데이터 수집 시각 (ISO8601) */
  timestamp: string;
  /** 센서 측정값 배열 */
  readings: SensorReading[];
  /** 프로토콜 메타 (옵션) */
  meta?: {
    protocol: string;
    firmwareVersion?: string;
    signalQuality?: number; // 0~100
    bufferCount?: number;   // 버퍼에 쌓인 미전송 레코드 수
  };
}

export interface SensorReading {
  /** 센서 코드 (Sensor.code 또는 외부 태그명) */
  sensorId: string;
  /** 지표 키 (power, energy, temperature, flow, pressure …) */
  metricKey: string;
  /** 측정값 */
  value: number;
  /** 데이터 품질 (good | bad | uncertain) */
  quality?: 'good' | 'bad' | 'uncertain';
  /** 개별 타임스탬프 (배치 전송 시 각 시점 명시) */
  timestamp?: string;
  /** 단위 (kW, kWh, °C, m³/h …) */
  unit?: string;
}

// ──────────────────────────────────────────────────────────────
// 프로토콜별 설정 스키마
// ──────────────────────────────────────────────────────────────

/** Modbus TCP 설정 */
export interface ModbusTcpConfig {
  protocol: 'modbus_tcp';
  host: string;          // PLC IP
  port: number;          // 기본 502
  unitId: number;        // Slave ID (1~247)
  registers: ModbusRegister[];
  pollIntervalMs: number; // 수집 주기 (기본 5000)
  timeout: number;        // ms (기본 3000)
}

export interface ModbusRegister {
  address: number;       // 레지스터 주소
  length: number;        // 레지스터 수
  type: 'holding' | 'input' | 'coil' | 'discrete';
  dataType: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64';
  scale?: number;        // 스케일 (값 × scale)
  offset?: number;       // 오프셋
  sensorCode: string;    // → SensorReading.sensorId
  metricKey: string;
  unit?: string;
}

/** Modbus RTU 설정 */
export interface ModbusRtuConfig {
  protocol: 'modbus_rtu';
  serialPort: string;    // /dev/ttyS0 or COM3
  baudRate: number;      // 9600|19200|38400|57600|115200
  dataBits: 7 | 8;
  parity: 'none' | 'even' | 'odd';
  stopBits: 1 | 2;
  unitId: number;
  registers: ModbusRegister[];
  pollIntervalMs: number;
}

/** BACnet/IP 설정 */
export interface BacnetConfig {
  protocol: 'bacnet';
  deviceAddress: string;  // BACnet 장치 IP
  deviceId: number;       // BACnet Device ID
  port: number;           // 기본 47808
  objects: BacnetObject[];
  pollIntervalMs: number;
}

export interface BacnetObject {
  objectType: 'analogInput' | 'analogOutput' | 'analogValue' | 'binaryInput' | 'binaryOutput' | 'binaryValue';
  objectInstance: number;
  propertyId: 'presentValue' | 'statusFlags';
  sensorCode: string;
  metricKey: string;
  unit?: string;
}

/** OPC-UA 설정 */
export interface OpcUaConfig {
  protocol: 'opcua';
  endpoint: string;      // opc.tcp://host:4840
  securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256';
  username?: string;
  password?: string;
  nodes: OpcUaNode[];
  subscriptionIntervalMs: number;
}

export interface OpcUaNode {
  nodeId: string;        // ns=2;s=Station1.Power
  sensorCode: string;
  metricKey: string;
  unit?: string;
  dataType?: 'Float' | 'Double' | 'Int32' | 'UInt32' | 'Boolean';
}

/** MQTT Push 설정 (게이트웨이 → 클라우드) */
export interface MqttConfig {
  protocol: 'mqtt';
  brokerUrl: string;     // mqtt://host:1883
  topicPattern: string;  // ems/{tenantId}/{sensorCode}/data
  qos: 0 | 1 | 2;
  username?: string;
  password?: string;
  clientId?: string;
  publishIntervalMs: number;
}

/** HTTP REST Pull 설정 */
export interface HttpConfig {
  protocol: 'http';
  baseUrl: string;       // 현장 서버 URL
  endpoints: HttpEndpoint[];
  headers?: Record<string, string>;
  pollIntervalMs: number;
  timeout: number;
}

export interface HttpEndpoint {
  path: string;          // /api/power
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  /** JSON 경로: 응답에서 값 추출 (예: data.power) */
  valuePath: string;
  sensorCode: string;
  metricKey: string;
  unit?: string;
}

/** 통합 프로토콜 설정 타입 */
export type ProtocolConfig =
  | ModbusTcpConfig
  | ModbusRtuConfig
  | BacnetConfig
  | OpcUaConfig
  | MqttConfig
  | HttpConfig;

// ──────────────────────────────────────────────────────────────
// 프로토콜별 기본 설정 템플릿
// ──────────────────────────────────────────────────────────────

export const PROTOCOL_DEFAULTS: Record<string, Partial<ProtocolConfig>> = {
  modbus_tcp: {
    protocol: 'modbus_tcp',
    port: 502,
    unitId: 1,
    pollIntervalMs: 5000,
    timeout: 3000,
    registers: [],
  } as Partial<ModbusTcpConfig>,
  modbus_rtu: {
    protocol: 'modbus_rtu',
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    unitId: 1,
    pollIntervalMs: 5000,
    registers: [],
  } as Partial<ModbusRtuConfig>,
  bacnet: {
    protocol: 'bacnet',
    port: 47808,
    pollIntervalMs: 10000,
    objects: [],
  } as Partial<BacnetConfig>,
  opcua: {
    protocol: 'opcua',
    securityMode: 'None',
    securityPolicy: 'None',
    subscriptionIntervalMs: 1000,
    nodes: [],
  } as Partial<OpcUaConfig>,
  mqtt: {
    protocol: 'mqtt',
    topicPattern: 'ems/{tenantId}/{sensorCode}/data',
    qos: 1,
    publishIntervalMs: 5000,
  } as Partial<MqttConfig>,
  http: {
    protocol: 'http',
    pollIntervalMs: 30000,
    timeout: 5000,
    endpoints: [],
  } as Partial<HttpConfig>,
};

/** 프로토콜 표시명 */
export const PROTOCOL_LABELS: Record<string, { label: string; desc: string; badge: string }> = {
  modbus_tcp: { label: 'Modbus TCP', desc: '산업용 PLC/인버터 (Ethernet)', badge: 'bg-blue-500/20 text-blue-400' },
  modbus_rtu: { label: 'Modbus RTU', desc: '산업용 PLC/인버터 (RS-485)', badge: 'bg-blue-500/20 text-blue-400' },
  bacnet:     { label: 'BACnet/IP',  desc: '빌딩 자동화 시스템', badge: 'bg-purple-500/20 text-purple-400' },
  opcua:      { label: 'OPC-UA',     desc: '스마트 팩토리 국제 표준', badge: 'bg-emerald-500/20 text-emerald-400' },
  mqtt:       { label: 'MQTT',       desc: 'IoT 경량 메시지 브로커', badge: 'bg-amber-500/20 text-amber-400' },
  http:       { label: 'HTTP REST',  desc: 'REST API 폴링', badge: 'bg-slate-500/20 text-slate-400' },
};
