/**
 * Dynamic Favicon — 탄소이음
 *
 * 철학: 기술이 아니라 연결
 * 아이콘: 두 원이 겹쳐 이어진 체인링크 — "이음(連)" 심볼
 *
 * Next.js App Router 자동 생성: /icon
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
        {/* 연결 고리 (이음 심볼): 두 원이 겹쳐 "연결"을 표현 */}
        <svg
          width="22"
          height="14"
          viewBox="0 0 22 14"
          fill="none"
          style={{ display: 'flex' }}
        >
          {/* 왼쪽 원 */}
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          />
          {/* 오른쪽 원 */}
          <circle
            cx="15"
            cy="7"
            r="5.5"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
