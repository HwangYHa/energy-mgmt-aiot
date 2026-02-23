/**
 * Dynamic Favicon
 *
 * Next.js App Router 자동 생성: /icon
 * 브라우저 탭에 표시되는 파비콘
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)',
          borderRadius: '7px',
        }}
      >
        {/* 번개 아이콘을 SVG path로 렌더링 */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          style={{ display: 'flex' }}
        >
          <polygon
            points="13,2 4,14 12,14 11,22 20,10 12,10"
            fill="white"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
