/**
 * Swagger/OpenAPI 문서 생성기
 * 
 * 모든 API 엔드포인트의 자동 문서화
 * 
 * 사용:
 * GET /api-docs - Swagger UI
 * GET /api-docs.json - OpenAPI 3.0 JSON
 */

/**
 * API 엔드포인트 정의
 * 이를 기반으로 Swagger 문서 자동 생성
 */

export const API_ENDPOINTS = {
  // ========================================
  // Authentication
  // ========================================
  'POST /api/auth/register': {
    summary: '사용자 회원가입',
    description: '새로운 사용자를 등록합니다.',
    tags: ['Authentication'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password', 'name', 'tenantId'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                example: 'user@example.com',
              },
              password: {
                type: 'string',
                format: 'password',
                minLength: 8,
                pattern: '^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])',
                example: 'SecurePass123!',
                description: '대문자, 숫자, 특수문자 포함 필수',
              },
              name: {
                type: 'string',
                minLength: 2,
                maxLength: 100,
                example: 'John Doe',
              },
              tenantId: {
                type: 'string',
                format: 'uuid',
                example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: '사용자 생성 성공',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                name: { type: 'string' },
                role: {
                  type: 'string',
                  enum: ['super_admin', 'tenant_admin', 'site_manager', 'operator', 'viewer'],
                },
              },
            },
          },
        },
      },
      400: {
        description: '입력 검증 실패',
      },
      409: {
        description: '이메일이 이미 등록됨',
      },
    },
  },

  'POST /api/auth/login': {
    summary: '사용자 로그인',
    description: '이메일과 비밀번호로 로그인합니다.',
    tags: ['Authentication'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                example: 'user@example.com',
              },
              password: {
                type: 'string',
                format: 'password',
                example: 'SecurePass123!',
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: '로그인 성공',
      },
      401: {
        description: '인증 실패',
      },
      429: {
        description: '레이트 제한 초과 (15분당 5회 제한)',
      },
    },
  },

  'GET /api/security/csrf': {
    summary: 'CSRF 토큰 발급',
    description: 'CSRF 공격 방지를 위한 토큰을 발급합니다.',
    tags: ['Authentication'],
    responses: {
      200: {
        description: 'CSRF 토큰 발급 성공',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                csrfToken: {
                  type: 'string',
                  description: 'X-CSRF-Token 헤더에 포함할 토큰',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
      },
    },
  },

  // ========================================
  // Devices
  // ========================================
  'GET /api/devices': {
    summary: '모든 기기 조회',
    description: '테넌트의 모든 기기 목록을 조회합니다.',
    tags: ['Devices'],
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'siteId',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
        description: '특정 사이트의 기기만 조회 (선택)',
      },
      {
        name: 'status',
        in: 'query',
        schema: { type: 'string', enum: ['online', 'offline', 'error', 'maintenance'] },
        description: '기기 상태로 필터링 (선택)',
      },
    ],
    responses: {
      200: {
        description: '기기 목록 조회 성공',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  deviceType: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['online', 'offline', 'error', 'maintenance'],
                  },
                  lastSeenAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      401: {
        description: '인증 필요',
      },
    },
  },

  'POST /api/devices': {
    summary: '새로운 기기 등록',
    description: '새로운 기기를 등록합니다.',
    tags: ['Devices'],
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'deviceType', 'protocol', 'siteId'],
            properties: {
              name: { type: 'string' },
              code: { type: 'string' },
              deviceType: { type: 'string' },
              manufacturer: { type: 'string' },
              model: { type: 'string' },
              protocol: {
                type: 'string',
                enum: ['modbus_tcp', 'modbus_rtu', 'bacnet', 'opcua', 'mqtt', 'http'],
              },
              siteId: { type: 'string', format: 'uuid' },
              gatewayId: { type: 'string', format: 'uuid' },
              connectionConfig: { type: 'object' },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: '기기 등록 성공',
      },
      400: {
        description: '입력 검증 실패',
      },
      403: {
        description: '권한 없음',
      },
    },
  },

  // ========================================
  // Sites
  // ========================================
  'GET /api/sites': {
    summary: '모든 사이트 조회',
    description: '테넌트의 모든 사이트 목록을 조회합니다.',
    tags: ['Sites'],
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: '사이트 목록 조회 성공',
      },
      401: {
        description: '인증 필요',
      },
    },
  },

  // ========================================
  // Analytics
  // ========================================
  'GET /api/analytics/summary': {
    summary: '분석 요약',
    description: '에너지 사용량, 비용, 탄소 배출량 요약',
    tags: ['Analytics'],
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'timeRange',
        in: 'query',
        schema: { type: 'string', enum: ['24h', '7d', '30d', 'custom'] },
      },
      {
        name: 'startDate',
        in: 'query',
        schema: { type: 'string', format: 'date' },
        description: 'timeRange=custom일 때 필수',
      },
      {
        name: 'endDate',
        in: 'query',
        schema: { type: 'string', format: 'date' },
        description: 'timeRange=custom일 때 필수',
      },
    ],
    responses: {
      200: {
        description: '분석 요약 조회 성공',
      },
    },
  },

  // ========================================
  // Alerts
  // ========================================
  'GET /api/alerts': {
    summary: '알람 목록 조회',
    description: '활성 및 지난 알람 목록을 조회합니다.',
    tags: ['Alerts'],
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'status',
        in: 'query',
        schema: { type: 'string', enum: ['active', 'resolved', 'all'] },
      },
    ],
    responses: {
      200: {
        description: '알람 목록 조회 성공',
      },
    },
  },

  // ========================================
  // AI Engine
  // ========================================
  'POST /api/ai/forecast': {
    summary: 'AI 에너지 예측',
    description: '향후 에너지 사용량을 예측합니다.',
    tags: ['AI'],
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['horizon'],
            properties: {
              horizon: {
                type: 'string',
                enum: ['24h', '7d', '30d'],
              },
              siteId: {
                type: 'string',
                format: 'uuid',
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: '예측 생성 성공',
      },
      401: {
        description: '인증 필요',
      },
    },
  },
};

/**
 * OpenAPI 3.0 스키마 생성
 */
export function generateOpenAPISchema() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Energy Management IoT API',
      version: '1.0.0',
      description: '에너지 관리 IoT 플랫폼 API',
      contact: {
        name: 'API Support',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.yourdomain.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'NextAuth JWT 토큰',
        },
        CsrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF 토큰',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'email', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: {
              type: 'string',
              enum: ['super_admin', 'tenant_admin', 'site_manager', 'operator', 'viewer'],
            },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Device: {
          type: 'object',
          required: ['id', 'name', 'deviceType'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            code: { type: 'string' },
            deviceType: { type: 'string' },
            status: { type: 'string' },
            lastSeenAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: Object.entries(API_ENDPOINTS).reduce((acc, [path, endpoint]) => {
      const [method, pathname] = path.split(' ');
      if (!pathname || !method) return acc; // Skip if pathname or method is undefined
      if (!acc[pathname]) {
        acc[pathname] = {};
      }
      acc[pathname][method.toLowerCase()] = endpoint;
      return acc;
    }, {} as Record<string, any>),
  };
}

/**
 * 모든 API의 자동 완성 메타데이터
 */
export const API_METADATA = {
  rateLimit: {
    general: '100 요청/시간',
    auth: '10 요청/15분 (IP당)',
    login: '5 시도/15분 (이메일당)',
  },
  authentication: 'Bearer Token (JWT)',
  errorHandling: 'JSON 형식의 상세 에러 메시지',
  versioning: 'URL 경로 버전 관리 (현재 v1)',
  cors: '화이트리스트 기반 CORS 정책',
  https: '프로덕션에서는 필수',
};
