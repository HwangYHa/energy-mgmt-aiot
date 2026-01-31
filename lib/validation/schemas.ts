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
  tenantId: uuidSchema,
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
// Forecast Schemas
// ==========================================

export const forecastHorizonEnum = z.enum(['24h', '7d', '30d']);

export const forecastRequestSchema = z.object({
  siteId: uuidSchema.optional(),
  
  horizon: forecastHorizonEnum.default('24h'),
  
  features: z
    .array(z.string())
    .optional(),
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
