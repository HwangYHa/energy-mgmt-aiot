/**
 * lib/sdk/partner-client.ts
 * 탄소이음 파트너 연동 SDK
 *
 * 파트너사가 자사 시스템에서 탄소이음 API를 호출할 때 사용하는
 * TypeScript/JavaScript 클라이언트 라이브러리.
 *
 * 사용 예시:
 * ```typescript
 * import { CarboneumClient } from '@/lib/sdk/partner-client';
 *
 * const client = new CarboneumClient({
 *   apiKey: 'ck_live_...',
 *   baseUrl: 'https://carboneum.kr/api',
 * });
 *
 * const sensors = await client.sensors.list({ siteId: 'site_abc' });
 * await client.measurements.batch([{ sensorId: 's1', value: 42.5, time: new Date() }]);
 * ```
 */

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

export interface ClientOptions {
  /** API 키 (설정 → API 키 관리에서 발급) */
  apiKey: string;
  /** API 베이스 URL (기본: https://carboneum.kr/api) */
  baseUrl?: string;
  /** 요청 타임아웃 (ms, 기본: 30_000) */
  timeout?: number;
  /** 최대 재시도 횟수 (기본: 2) */
  maxRetries?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
}

export interface Measurement {
  id: string;
  sensorId: string;
  value: number;
  unit: string;
  time: string;
  quality: 'good' | 'uncertain' | 'bad';
}

export interface MeasurementInput {
  sensorId: string;
  value: number;
  unit?: string;
  time?: Date | string;
  quality?: 'good' | 'uncertain' | 'bad';
}

export interface Sensor {
  id: string;
  name: string;
  code: string | null;
  sensorType: string;
  unit: string | null;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastValue: number | null;
  lastSeenAt: string | null;
  quality: string;
}

export interface Site {
  id: string;
  name: string;
  address: string | null;
  industryType: string;
  isActive: boolean;
  timezone: string;
}

export interface CarbonSummary {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  unit: string;
}

export interface AnomalyResult {
  anomalies: Array<{
    index: number;
    value: number;
    zScore: number;
    type: 'high' | 'low';
  }>;
  method: string;
  threshold: number;
}

export interface ForecastPoint {
  time: string;
  value: number;
  lower: number;
  upper: number;
}

export interface Recommendation {
  type: 'peak_shift' | 'standby_reduction' | 'weekend_schedule' | 'high_variance';
  title: string;
  description: string;
  estimatedSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export interface GatewayReading {
  sensorId: string;
  value: number;
  unit?: string;
  quality?: 'good' | 'uncertain' | 'bad';
  time?: Date | string;
}

export interface GatewayPayload {
  gatewaySerial?: string;
  timestamp?: Date | string;
  readings: GatewayReading[];
}

// ─────────────────────────────────────────────────────
// API 오류 클래스
// ─────────────────────────────────────────────────────

export class CarboneumApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'CarboneumApiError';
  }
}

// ─────────────────────────────────────────────────────
// HTTP 클라이언트 (내부)
// ─────────────────────────────────────────────────────

class HttpClient {
  constructor(private readonly opts: Required<ClientOptions>) {}

  async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string | number | boolean> }
  ): Promise<T> {
    let url = `${this.opts.baseUrl}${path}`;
    if (options?.params) {
      const qs = new URLSearchParams(
        Object.entries(options.params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      );
      if (qs.size > 0) url += `?${qs.toString()}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeout);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${this.opts.apiKey}`,
            'Content-Type': 'application/json',
            'X-SDK-Version': '1.0.0',
            'X-SDK-Lang': 'typescript',
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Rate limit — 재시도
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
          const json = await res.json().catch(() => ({})) as { error?: string; code?: string };
          if (attempt < this.opts.maxRetries) {
            await sleep(retryAfter * 1000);
            continue;
          }
          throw new CarboneumApiError(
            json.error ?? '요청 한도 초과',
            429,
            json.code ?? 'RATE_LIMIT_EXCEEDED',
            retryAfter
          );
        }

        const json = await res.json() as ApiResponse<T>;

        if (!res.ok || !json.success) {
          throw new CarboneumApiError(
            json.error ?? `HTTP ${res.status}`,
            res.status,
            json.code ?? 'API_ERROR'
          );
        }

        return json.data;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof CarboneumApiError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.opts.maxRetries) {
          await sleep(Math.pow(2, attempt) * 500); // 지수 백오프
        }
      }
    }

    throw lastError ?? new Error('요청 실패');
  }

  get<T>(path: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────
// API 리소스 클래스
// ─────────────────────────────────────────────────────

class MeasurementsResource {
  constructor(private http: HttpClient) {}

  /**
   * 측정값 목록 조회
   */
  list(params: {
    sensorId?: string;
    siteId?: string;
    from: Date | string;
    to: Date | string;
    interval?: 'raw' | '1m' | '5m' | '15m' | '1h' | '1d';
    limit?: number;
  }): Promise<{ measurements: Measurement[]; total: number }> {
    return this.http.get('/measurements', {
      ...params,
      from: toIso(params.from),
      to: toIso(params.to),
    } as Record<string, string | number>);
  }

  /**
   * 측정값 벌크 저장 (최대 1,000개)
   */
  batch(readings: MeasurementInput[]): Promise<{ saved: number; duplicates: number }> {
    return this.http.post('/measurements/batch', { readings: readings.map(normalizeInput) });
  }
}

class SensorsResource {
  constructor(private http: HttpClient) {}

  list(params?: {
    siteId?: string;
    status?: 'online' | 'offline' | 'error' | 'maintenance';
    sensorType?: string;
  }): Promise<{ sensors: Sensor[]; total: number }> {
    return this.http.get('/sensors', params as Record<string, string>);
  }

  get(sensorId: string): Promise<Sensor> {
    return this.http.get(`/sensors/${sensorId}`);
  }
}

class SitesResource {
  constructor(private http: HttpClient) {}

  list(): Promise<{ sites: Site[] }> {
    return this.http.get('/sites');
  }
}

class CarbonResource {
  constructor(private http: HttpClient) {}

  summary(params: {
    year: number;
    siteId?: string;
    scope?: 'scope1' | 'scope2' | 'scope3';
  }): Promise<CarbonSummary> {
    return this.http.get('/analytics/carbon', params as Record<string, string | number>);
  }

  exportUrl(params: { format: 'csv' | 'json'; year: number }): string {
    const qs = new URLSearchParams({ ...params, year: String(params.year) });
    return `/api/analytics/carbon/export?${qs.toString()}`;
  }
}

class AiResource {
  constructor(private http: HttpClient) {}

  detectAnomalies(params: {
    sensorId: string;
    values: number[];
    sensitivity?: number;
  }): Promise<AnomalyResult> {
    return this.http.post('/ai/anomaly', params);
  }

  forecast(params: {
    sensorId: string;
    horizon?: number;
  }): Promise<{ forecasts: ForecastPoint[] }> {
    return this.http.post('/ai/forecast', params);
  }

  optimize(params: { siteId: string }): Promise<{ recommendations: Recommendation[] }> {
    return this.http.post('/ai/optimize', params);
  }
}

class GatewaysResource {
  constructor(private http: HttpClient) {}

  /**
   * 게이트웨이 측정값 전송
   */
  sendData(gatewayId: string, payload: GatewayPayload): Promise<{ saved: number }> {
    return this.http.post(`/gateways/${gatewayId}/data`, {
      ...payload,
      timestamp: toIso(payload.timestamp ?? new Date()),
      readings: payload.readings.map(r => ({ ...r, time: r.time ? toIso(r.time) : undefined })),
    });
  }
}

// ─────────────────────────────────────────────────────
// 메인 클라이언트
// ─────────────────────────────────────────────────────

/**
 * 탄소이음 API 클라이언트
 *
 * @example
 * ```typescript
 * const client = new CarboneumClient({ apiKey: 'ck_live_...' });
 *
 * // 센서 목록 조회
 * const { sensors } = await client.sensors.list({ status: 'online' });
 *
 * // 측정값 배치 전송
 * await client.measurements.batch([
 *   { sensorId: 'sensor_id', value: 42.5 },
 * ]);
 *
 * // 탄소 배출량 조회
 * const carbon = await client.carbon.summary({ year: 2026 });
 * console.log(`총 배출량: ${carbon.total} tCO₂eq`);
 * ```
 */
export class CarboneumClient {
  readonly measurements: MeasurementsResource;
  readonly sensors: SensorsResource;
  readonly sites: SitesResource;
  readonly carbon: CarbonResource;
  readonly ai: AiResource;
  readonly gateways: GatewaysResource;

  constructor(options: ClientOptions) {
    const opts: Required<ClientOptions> = {
      baseUrl: 'https://carboneum.kr/api',
      timeout: 30_000,
      maxRetries: 2,
      ...options,
    };

    const http = new HttpClient(opts);
    this.measurements = new MeasurementsResource(http);
    this.sensors = new SensorsResource(http);
    this.sites = new SitesResource(http);
    this.carbon = new CarbonResource(http);
    this.ai = new AiResource(http);
    this.gateways = new GatewaysResource(http);
  }
}

// ─────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────

function toIso(date: Date | string | undefined): string {
  if (!date) return new Date().toISOString();
  return date instanceof Date ? date.toISOString() : date;
}

function normalizeInput(input: MeasurementInput): Record<string, unknown> {
  return {
    ...input,
    time: input.time ? toIso(input.time) : new Date().toISOString(),
    unit: input.unit ?? 'kW',
    quality: input.quality ?? 'good',
  };
}

// 기본 export (편의용)
export default CarboneumClient;
