/**
 * Dynamic OpenGraph Image — 탄소이음
 *
 * Next.js App Router 자동 생성: /opengraph-image
 * SNS 공유 시 표시되는 1200x630 미리보기 이미지
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '탄소이음 - 에너지 데이터로 세상을 잇다';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #10b981, #06b6d4, #10b981)',
          }}
        />

        {/* Logo + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          {/* 연결 고리 심볼 */}
          <div
            style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="44" height="28" viewBox="0 0 44 28" fill="none">
              <circle cx="14" cy="14" r="10" fill="none" stroke="white" strokeWidth="4" />
              <circle cx="30" cy="14" r="10" fill="none" stroke="white" strokeWidth="4" />
            </svg>
          </div>
          <span style={{ fontSize: '52px', fontWeight: 'bold', color: 'white' }}>
            탄소
            <span style={{ color: '#10b981' }}>이음</span>
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            color: '#cbd5e1',
            marginBottom: '40px',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          에너지 데이터로 세상을 잇다
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['부하 예측', '이상 탐지', '탄소 추적', '에너지 절감'].map((feature) => (
            <div
              key={feature}
              style={{
                padding: '10px 24px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '999px',
                color: '#34d399',
                fontSize: '18px',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Bottom stat */}
        <div style={{ marginTop: '40px', fontSize: '20px', color: '#64748b' }}>
          에너지 비용 15% 절감 · 탄소 배출 20% 감축 · K-ETS 대응
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #10b981, #06b6d4, transparent)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
