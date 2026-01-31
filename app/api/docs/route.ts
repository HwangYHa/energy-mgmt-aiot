/**
 * GET /api/docs - API 문서 및 OpenAPI 스키마 제공
 * 
 * 응답:
 * 1. /docs - HTML Swagger UI
 * 2. /docs.json - OpenAPI 3.0 JSON 스키마
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateOpenAPISchema } from '@/lib/api/openapi-schema';

export async function GET(request: NextRequest) {
  const pathname = new URL(request.url).pathname;

  // ========================================
  // /api/docs.json - OpenAPI 스키마
  // ========================================
  if (pathname === '/api/docs.json') {
    const schema = generateOpenAPISchema();

    return NextResponse.json(schema, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // 1시간 캐싱
      },
    });
  }

  // ========================================
  // /api/docs - Swagger UI HTML
  // ========================================
  if (pathname === '/api/docs') {
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Energy Management IoT - API 문서</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *,
        *:before,
        *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            padding: 0;
        }
        .topbar {
            background-color: #fafafa;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .topbar-title {
            margin-left: 20px;
            color: #333;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/docs.json',
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: 'StandaloneLayout',
            showExplorer: true,
            defaultModelsExpandDepth: 1,
            docExpansion: 'list',
            filter: true,
            showRequestHeaders: true,
            requestInterceptor: (request) => {
                // CSRF 토큰 자동 추가
                const token = localStorage.getItem('csrf-token');
                if (token && ['post', 'put', 'delete', 'patch'].includes(request.method.toLowerCase())) {
                    request.headers['X-CSRF-Token'] = token;
                }
                return request;
            },
            responseInterceptor: (response) => {
                // 응답 상태 기록
                console.log('API Response:', response.status, response.statusText);
                return response;
            }
        });
    </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return NextResponse.json(
    { error: 'Not Found' },
    { status: 404 }
  );
}
