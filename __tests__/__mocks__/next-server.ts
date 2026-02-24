// next/server 모킹 — Jest 환경에서 Next.js 서버 컴포넌트 없이 테스트
export class NextRequest {
  url: string;
  method: string;
  headers: Map<string, string>;
  cookies: Map<string, { value: string }>;
  signal: { addEventListener: jest.Mock };

  constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this.cookies = new Map();
    this.signal = { addEventListener: jest.fn() };
  }

  get(name: string) {
    return this.headers.get(name) || null;
  }
}

export class NextResponse {
  static json(data: unknown, init?: { status?: number }) {
    return {
      status: init?.status || 200,
      body: JSON.stringify(data),
      json: async () => data,
      headers: new Map([['content-type', 'application/json']]),
    };
  }

  constructor(
    public body: unknown,
    public init?: { status?: number; headers?: Record<string, string> }
  ) {}
}
