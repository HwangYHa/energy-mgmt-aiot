import { Shield } from 'lucide-react';

/**
 * 개인정보 처리방침 페이지
 */
export const metadata = {
  title: '개인정보 처리방침 - 탄소이음',
  description: '탄소이음 개인정보 처리방침',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full mb-6">
          <Shield className="w-5 h-5 text-blue-400" />
          <span className="text-blue-400 font-semibold">Privacy Policy</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          개인정보 처리방침
        </h1>
        <p className="text-slate-400 mb-8">최종 업데이트: 2026년 2월 3일</p>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. 수집하는 개인정보</h2>
            <div className="text-slate-300 space-y-3">
              <p>탄소이음는 다음과 같은 개인정보를 수집합니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>필수 정보: 이메일, 이름, 회사명</li>
                <li>선택 정보: 전화번호, 부서, 직책</li>
                <li>자동 수집: IP 주소, 쿠키, 로그 데이터</li>
                <li>에너지 데이터: 사이트 및 디바이스 에너지 사용량</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. 개인정보 이용 목적</h2>
            <div className="text-slate-300 space-y-3">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>서비스 제공 및 운영</li>
                <li>회원 관리 및 본인 확인</li>
                <li>에너지 데이터 분석 및 AI 예측</li>
                <li>고객 지원 및 문의 응대</li>
                <li>서비스 개선 및 신규 서비스 개발</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. 개인정보 보유 기간</h2>
            <div className="text-slate-300 space-y-3">
              <p>회원 탈퇴 시까지 보유하며, 법령에 따라 다음 정보는 일정 기간 보관합니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>계약 또는 청약철회 기록: 5년</li>
                <li>대금결제 및 재화 공급 기록: 5년</li>
                <li>소비자 불만 또는 분쟁처리 기록: 3년</li>
                <li>로그인 기록: 3개월</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. 제3자 제공</h2>
            <div className="text-slate-300 space-y-3">
              <p>회사는 원칙적으로 개인정보를 제3자에게 제공하지 않습니다. 단, 다음의 경우는 예외입니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>사용자가 사전에 동의한 경우</li>
                <li>법령에 의거하거나 수사 목적으로 요구된 경우</li>
                <li>결제 처리를 위한 PG사 제공 (아임포트, Stripe)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. 정보주체의 권리</h2>
            <div className="text-slate-300 space-y-3">
              <p>귀하는 다음과 같은 권리를 행사할 수 있습니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>개인정보 열람 요구</li>
                <li>개인정보 정정 요구</li>
                <li>개인정보 삭제 요구</li>
                <li>개인정보 처리 정지 요구</li>
              </ul>
              <p className="mt-4">권리 행사는 설정 페이지 또는 support@탄소이음.io로 요청 가능합니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. 보안 조치</h2>
            <div className="text-slate-300 space-y-3">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>데이터 암호화 (AES-256)</li>
                <li>접근 권한 관리 및 RBAC 적용</li>
                <li>정기적인 보안 감사</li>
                <li>침입 탐지 시스템 운영</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. 문의</h2>
            <div className="text-slate-300">
              <p>개인정보 관련 문의사항이 있으시면 아래로 연락주세요:</p>
              <ul className="mt-4 space-y-2">
                <li>이메일: privacy@탄소이음.io</li>
                {/* <li>전화: 1588-1234</li>
                <li>주소: 서울특별시 강남구 테헤란로 123</li> */}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
