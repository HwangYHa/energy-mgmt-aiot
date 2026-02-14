/**
 * Dynamic OpenGraph Image
 *
 * Next.js App Router 자동 생성: /opengraph-image
 * SNS 공유 시 표시되는 1200x630 미리보기 이미지
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'EnergyAI - AI 기반 에너지 관리 플랫폼';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: '48px', fontWeight: 'bold', color: 'white' }}>
            Energy
            <span style={{ color: '#10b981' }}>AI</span>
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
          AI 기반 에너지 관리 플랫폼
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['부하 예측', '이상 탐지', '자동 최적화', '탄소 추적'].map((feature) => (
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
          에너지 비용 15% 절감 · 월 ₩7.2M 절약 · 92% AI 정확도
        </div>
      </div>
    ),
    { ...size }
  );
}
