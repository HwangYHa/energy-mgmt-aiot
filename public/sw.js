/**
 * public/sw.js — 탄소이음 PWA 서비스워커
 *
 * 캐시 전략:
 *   - 정적 자산 (_next/static, 이미지, 폰트): Cache-First (오프라인에서도 제공)
 *   - API 요청: Network-First (최신 데이터 우선, 실패 시 캐시)
 *   - 페이지 탐색: Network-First → 실패 시 /offline 폴백
 *   - 외부 리소스: Network-Only
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `carboneum-static-${CACHE_VERSION}`;
const API_CACHE = `carboneum-api-${CACHE_VERSION}`;
const PAGE_CACHE = `carboneum-pages-${CACHE_VERSION}`;

// 설치 시 프리캐시할 정적 자원
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// API 캐시 최대 유지 시간 (5분)
const API_CACHE_TTL_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────
// Install — 프리캐시
// ─────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch(() => {
        // 오프라인 환경에서 설치 시 프리캐시 실패 무시
      })
    ).then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────────────
// Activate — 구버전 캐시 정리
// ─────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, API_CACHE, PAGE_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────
// Fetch — 요청 처리
// ─────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 브라우저 확장/비-HTTP 요청 무시
  if (!request.url.startsWith('http')) return;

  // ── 1. Next.js HMR / WebSocket 무시 ──
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // ── 2. 정적 자산: Cache-First ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 3. API 요청: Network-First (5분 캐시) ──
  if (url.pathname.startsWith('/api/')) {
    // SSE, 웹훅, CSRF 등 캐시 제외
    const noCache = ['/api/realtime', '/api/security/csrf', '/api/payment/stripe/webhook'];
    if (noCache.some((p) => url.pathname.startsWith(p))) return;

    if (request.method === 'GET') {
      event.respondWith(networkFirstWithTtl(request, API_CACHE, API_CACHE_TTL_MS));
    }
    return;
  }

  // ── 4. 페이지 탐색: Network-First → /offline 폴백 ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then(
          (r) => r ?? new Response('오프라인 상태입니다.', { status: 503 })
        )
      )
    );
    return;
  }
});

// ─────────────────────────────────────────────────────
// 전략 헬퍼 함수
// ─────────────────────────────────────────────────────

/** Cache-First: 캐시 히트 → 네트워크 폴백 → 캐시 업데이트 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    return new Response('리소스를 불러올 수 없습니다.', { status: 503 });
  }
}

/** Network-First with TTL: 네트워크 우선, 실패 시 TTL 이내 캐시 반환 */
async function networkFirstWithTtl(request, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      // TTL 헤더를 메타데이터로 저장
      const headers = new Headers(networkRes.headers);
      headers.set('X-SW-Cached-At', String(Date.now()));
      const body = await networkRes.clone().arrayBuffer();
      const cachedRes = new Response(body, { status: networkRes.status, headers });
      await cache.put(request, cachedRes);
    }
    return networkRes;
  } catch {
    const cached = await cache.match(request);
    if (!cached) {
      return new Response(JSON.stringify({ success: false, error: '오프라인 상태입니다.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TTL 확인
    const cachedAt = parseInt(cached.headers.get('X-SW-Cached-At') ?? '0', 10);
    if (cachedAt && Date.now() - cachedAt > ttlMs) {
      // TTL 만료 — 만료 응답 반환 (클라이언트가 재시도하도록)
      return new Response(
        JSON.stringify({ success: false, error: '캐시가 만료되었습니다. 인터넷 연결을 확인하세요.' }),
        { status: 504, headers: { 'Content-Type': 'application/json', 'X-SW-Cache-Expired': 'true' } }
      );
    }

    return cached;
  }
}

// ─────────────────────────────────────────────────────
// Background Sync (측정값 전송 실패 복구)
// ─────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-measurements') {
    event.waitUntil(syncPendingMeasurements());
  }
});

async function syncPendingMeasurements() {
  // IndexedDB의 pending 측정값을 서버로 재전송
  // (실제 구현은 IndexedDB 연동 필요 — 현재는 로그만)
  console.log('[SW] Background sync: measurements');
}

// ─────────────────────────────────────────────────────
// Push Notification
// ─────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const options = {
    body: data.body ?? '새 알림이 있습니다.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag ?? 'default',
    data: { url: data.url ?? '/dashboard' },
    requireInteraction: data.severity === 'critical',
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title ?? '탄소이음 알림',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url) && 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
