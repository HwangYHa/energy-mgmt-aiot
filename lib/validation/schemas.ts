/**
 * lib/validation/schemas.ts - 모든 API 요청 검증 스키마
 * 
 * 사용:
 * const validated = deviceCreateSchema.parse(body);
 */

import { z } from 'zod';

// ==========================================
// Common Schemas
// ==========================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

// ==========================================
// Auth Schemas
// ==========================================

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .min(1, 'Name required')
    .max(100, 'Name too long'),
  tenantId: uuidSchema.optional(), // ⭐ optional로 변경 (자동 생성)
});

// ==========================================
// Device Schemas
// ==========================================

export const deviceTypeEnum = z.enum([
  'HVAC',
  'LIGHTING',
  'METER',
  'POWER_FACTOR',
  'TEMPERATURE_SENSOR',
  'PRODUCTION_EQUIPMENT',
  'OTHER',
]);

export const protocolEnum = z.enum([
  'modbus_tcp',
  'modbus_rtu',
  'bacnet',
  'opcua',
  'mqtt',
  'http',
]);

export const connectionConfigSchema = z.object({
  host: z
    .union([
      z.string().ip({ version: 'v4' }),
      z.string().min(1).includes('.'), // hostname with dot
      z.string().min(1), // hostname
    ])
    .refine((val) => val.length > 0, 'Host required'),
  port: z
    .number()
    .int()
    .min(1, 'Port must be >= 1')
    .max(65535, 'Port must be <= 65535'),
  timeout: z
    .number()
    .int()
    .min(100, 'Timeout must be >= 100ms')
    .max(30000, 'Timeout must be <= 30s')
    .optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export const deviceCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name required')
    .max(200, 'Name too long')
    .trim(),
  
  deviceType: deviceTypeEnum,
  
  protocol: protocolEnum,
  
  connectionConfig: connectionConfigSchema,
  
  controlCapable: z.boolean().default(false),
  
  siteId: uuidSchema,
  
  manufacturerName: z.string().max(100).optional(),
  
  model: z.string().max(100).optional(),
});

export const deviceUpdateSchema = deviceCreateSchema.partial();

// ==========================================
// Site Schemas
// ==========================================

export const siteTypeEnum = z.enum([
  'factory',
  'office',
  'warehouse',
  'retail',
  'mixed',
]);

export const siteCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name required')
    .max(200, 'Name too long'),
  
  code: z.string().max(50).optional(),
  
  address: z.string().max(500).optional(),
  
  city: z.string().max(100).optional(),
  
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  siteType: siteTypeEnum.default('factory'),
  
  areaSqm: z.number().positive().optional(),
  
  peakPowerKw: z.number().positive().optional(),
});

// ==========================================
// DR Event Schemas
// ==========================================

export const drEventTypeEnum = z.enum(['CBL', 'peak_cut', 'emergency']);

export const drEventCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name required')
    .max(200, 'Name too long'),
  
  description: z.string().max(1000).optional(),
  
  eventType: drEventTypeEnum,
  
  startTime: z.string().datetime('Invalid datetime format'),
  
  endTime: z.string().datetime('Invalid datetime format'),
  
  targetReductionKw: z
    .number()
    .positive('Target reduction must be positive'),
  
  baselineKwh: z
    .number()
    .positive('Baseline must be positive')
    .optional(),
  
  provider: z.string().max(100).optional(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  }
);

// ==========================================
// Pagination Schemas
// ==========================================

export const paginationSchema = z.object({
  page: z
    .number()
    .int()
    .min(1)
    .default(1),
  
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

// ==========================================
// Query Filter Schemas
// ==========================================

export const deviceFilterSchema = z.object({
  siteId: uuidSchema.optional(),
  deviceType: deviceTypeEnum.optional(),
  status: z.enum(['online', 'offline', 'error', 'maintenance']).optional(),
  ...paginationSchema.shape,
});

// ==========================================
// AI Forecast Schemas
// ==========================================

export const forecastRequestSchema = z.object({
  siteId: uuidSchema.optional(),
  horizon: z
    .string()
    .regex(/^\d+[hd]$/, 'Horizon must be in format like "24h" or "7d"')
    .default('24h'),
  features: z
    .array(z.string())
    .default(['hour', 'weekday', 'temperature']),
});

export const anomalyRequestSchema = z.object({
  siteId: uuidSchema.optional(),
  sensitivity: z
    .number()
    .min(0)
    .max(1)
    .default(0.1),
});

export const optimizeRequestSchema = z.object({
  siteId: uuidSchema.optional(),
  targetReduction: z
    .number()
    .min(0)
    .max(100)
    .default(50),
});

// ==========================================
// Carbon Schemas
// ==========================================

export const emissionTypeEnum = z.enum(['scope1', 'scope2', 'scope3']);

export const emissionsRegisterSchema = z.object({
  emissionType: emissionTypeEnum,
  sourceType: z.string().min(1, 'Source type required'),
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().min(1, 'Unit required'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
  notes: z.string().max(1000).optional(),
});

// ==========================================
// Report Schemas
// ==========================================

export const reportTypeEnum = z.enum([
  'energy',
  'cost',
  'carbon',
  'regulation',
  'dr',
  'custom',
]);

export const reportGenerateSchema = z.object({
  type: reportTypeEnum,
  format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  siteId: uuidSchema.optional(),
  includeCharts: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  }
);

// ==========================================
// Alert Schemas
// ==========================================

export const alertCategoryEnum = z.enum([
  'system',
  'energy',
  'device',
  'security',
  'dr',
  'carbon',
  'cost',
]);

export const alertSeverityEnum = z.enum(['info', 'warning', 'critical']);

export const alertRuleCreateSchema = z.object({
  name: z.string().min(1, 'Name required').max(200, 'Name too long'),
  description: z.string().max(1000).optional(),
  category: alertCategoryEnum,
  severity: alertSeverityEnum,
  scope: z.enum(['tenant', 'site', 'device', 'metric']),
  scopeId: z.string().optional(),
  condition: z.record(z.any()), // JSON object
  channels: z.array(z.string()).optional(),
  recipients: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

// ==========================================
// Control Schemas
// ==========================================

export const controlActionEnum = z.enum([
  'start',
  'stop',
  'setpoint',
  'schedule',
  'optimize',
]);

export const controlExecutionModeEnum = z.enum([
  'manual',
  'scheduled',
  'automated',
  'dr',
]);

export const controlRequestSchema = z.object({
  deviceId: uuidSchema,
  action: controlActionEnum,
  parameters: z.record(z.any()).optional(),
  targetValue: z.number().optional(),
  executionMode: controlExecutionModeEnum.default('manual'),
  requiresApproval: z.boolean().default(false),
});

// ==========================================
// Schedule Schemas
// ==========================================

export const scheduleCreateSchema = z.object({
  name: z.string().min(1, 'Name required').max(200, 'Name too long'),
  deviceId: uuidSchema,
  action: controlActionEnum,
  parameters: z.record(z.any()).optional(),
  cronExpression: z.string().min(1, 'Cron expression required'),
  enabled: z.boolean().default(true),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ==========================================
// Measurement Schemas
// ==========================================

export const measurementCreateSchema = z.object({
  metricId: uuidSchema,
  value: z.number(),
  quality: z.enum(['good', 'bad', 'uncertain']).default('good'),
  source: z.enum(['sensor', 'calculated', 'estimated', 'manual']).default('sensor'),
  timestamp: z.string().datetime().optional(),
});

export const measurementBatchSchema = z.object({
  measurements: z.array(measurementCreateSchema).min(1, 'At least one measurement required'),
});

// ==========================================
// Subscription Schemas
// ==========================================

export const subscriptionStatusEnum = z.enum([
  'PRE_PAYMENT',
  'PAID',
  'INSTALL_SCHEDULED',
  'INSTALLED',
  'ACTIVE',
  'EXPIRE_SOON',
  'EXPIRED',
  'SUSPENDED',
  'TERMINATED',
]);

export const billingCycleEnum = z.enum(['monthly', 'yearly', 'lifetime']);

export const subscriptionUpdateSchema = z.object({
  status: subscriptionStatusEnum.optional(),
  autoRenew: z.boolean().optional(),
  paymentMethod: z.string().max(50).optional(),
});

// ==========================================
// Helper Functions
// ==========================================

/**
 * 검증 오류를 클라이언트 친화적인 형식으로 변환
 */
export function formatValidationError(error: z.ZodError) {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * 안전한 파싱 (에러 발생 시 기본값 반환)
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : fallback;
}

/**
 * 부분 업데이트 검증 (undefined 값 제거)
 */
export function parsePartialUpdate<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: unknown
) {
  const partial = schema.partial();
  const result = partial.parse(data);
  
  // undefined 값 제거
  return Object.fromEntries(
    Object.entries(result).filter(([_, v]) => v !== undefined)
  ) as Partial<z.infer<z.ZodObject<T>>>;
}