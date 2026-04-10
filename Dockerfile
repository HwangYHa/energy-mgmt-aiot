# ============================================================
# Stage 1: deps — 의존성 설치 (캐시 레이어 최적화)
# ============================================================
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: builder — Next.js 빌드
# ============================================================
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client 생성
RUN npx prisma generate

# 빌드 타임 ARG (NEXT_PUBLIC_* 는 번들에 포함되므로 빌드 시 주입 필요)
ARG NEXT_PUBLIC_TOSS_CLIENT_KEY
ARG NEXT_PUBLIC_COMMIT_SHA
ENV NEXT_PUBLIC_TOSS_CLIENT_KEY=$NEXT_PUBLIC_TOSS_CLIENT_KEY
ENV NEXT_PUBLIC_COMMIT_SHA=$NEXT_PUBLIC_COMMIT_SHA

# 환경변수 (빌드 시점 — 런타임 비밀은 포함하지 않음)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 빌드 타임 더미 시크릿 — next-auth 등 라이브러리가 process.env를 직접 읽는 경우 대비
# 실제 값은 컨테이너 런타임에 .env.production 으로 덮어씀 (이미지에 실제 시크릿 없음)
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
ENV NEXTAUTH_SECRET="build-time-placeholder-secret-minimum-32-chars!"
ENV JWT_SECRET="build-time-placeholder-jwt-secret-32-chars!!!!!"
ENV NEXTAUTH_URL="http://localhost:3000"

RUN pnpm build

# ============================================================
# Stage 3: runner — 최소 런타임 이미지
# ============================================================
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 전용 시스템 사용자 (비-root 실행)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 필수 파일만 복사
# standalone 모드: .next/standalone 에 필요한 node_modules 포함됨
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# pnpm은 .prisma 경로가 다름 — standalone이 trace한 Prisma 엔진 바이너리 보완
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/@prisma/client

# 한국어 PDF 폰트 (Linux 프로덕션)
RUN mkdir -p ./public/fonts
# COPY --from=builder /app/public/fonts/NanumGothic.ttf ./public/fonts/

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
