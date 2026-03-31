/**
 * lib/modules/iot/topic-parser.ts
 *
 * MQTT 토픽 파싱 및 빌더
 * 토픽 구조: ems/{tenantId}/site/{siteId}/gw/{gatewayId}/dev/{deviceId}/{category}/{type}
 */

export interface ParsedMqttTopic {
  tenantId:  string;
  siteId:    string;
  gatewayId: string;
  deviceId:  string;
  category:  string;
  type:      string;
}

/**
 * MQTT 토픽 파싱
 * @returns ParsedMqttTopic | null (유효하지 않은 형식)
 */
export function parseMqttTopic(topic: string): ParsedMqttTopic | null {
  if (!topic || typeof topic !== 'string') return null;

  const parts = topic.split('/');

  // ems/{t}/site/{s}/gw/{g}/dev/{d}/{cat}/{type} = 10 parts
  if (parts.length < 10) return null;
  if (parts[0] !== 'ems')  return null;
  if (parts[2] !== 'site') return null;
  if (parts[4] !== 'gw')   return null;
  if (parts[6] !== 'dev')  return null;

  const tenantId  = parts[1]  ?? '';
  const siteId    = parts[3]  ?? '';
  const gatewayId = parts[5]  ?? '';
  const deviceId  = parts[7]  ?? '';
  const category  = parts[8]  ?? '';
  const type      = parts[9]  ?? '';

  if (!tenantId || !siteId || !gatewayId || !deviceId || !category || !type) return null;

  return { tenantId, siteId, gatewayId, deviceId, category, type };
}

/**
 * MQTT 토픽 빌더
 */
export function buildMqttTopic(params: ParsedMqttTopic): string {
  return `ems/${params.tenantId}/site/${params.siteId}/gw/${params.gatewayId}/dev/${params.deviceId}/${params.category}/${params.type}`;
}

/**
 * 게이트웨이 상태 토픽 파싱
 * 형식: ems/{tenantId}/site/{siteId}/gw/{gatewayId}/status
 */
export function parseGatewayStatusTopic(topic: string): {
  tenantId: string; siteId: string; gatewayId: string;
} | null {
  const parts = topic.split('/');
  if (parts.length !== 6) return null;
  if (parts[0] !== 'ems' || parts[2] !== 'site' || parts[4] !== 'gw' || parts[5] !== 'status') {
    return null;
  }
  const tenantId  = parts[1] ?? '';
  const siteId    = parts[3] ?? '';
  const gatewayId = parts[4] ?? '';
  if (!tenantId || !siteId || !gatewayId) return null;
  return { tenantId, siteId, gatewayId };
}

/** 전력 실시간 데이터 토픽인지 확인 */
export function isPowerRealtimeTopic(topic: string): boolean {
  const parsed = parseMqttTopic(topic);
  return parsed?.category === 'power' && parsed?.type === 'realtime';
}

/** 릴레이 명령 토픽인지 확인 */
export function isRelayCommandTopic(topic: string): boolean {
  const parsed = parseMqttTopic(topic);
  return parsed?.category === 'command' && parsed?.type === 'relay';
}
