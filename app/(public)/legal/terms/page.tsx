import { FileText } from 'lucide-react';

/**
 * 이용약관 페이지
 */
export const metadata = {
  title: '이용약관 - 탄소이음',
  description: '탄소이음 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
          <FileText className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">Terms of Service</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">이용약관</h1>
        <p className="text-slate-400 mb-8">최종 업데이트: 2026년 2월 3일</p>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. 서비스 이용</h2>
            <div className="text-slate-300 space-y-3">
              <p>탄소이음 서비스를 이용함으로써 귀하는 본 약관에 동의하게 됩니다.</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>서비스는 만 14세 이상만 이용 가능합니다</li>
                <li>정확한 정보를 제공해야 합니다</li>
                <li>계정 정보는 안전하게 관리해야 합니다</li>
                <li>타인의 계정을 무단으로 사용할 수 없습니다</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. 요금 및 결제</h2>
            <div className="text-slate-300 space-y-3">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>요금제는 월간 또는 연간 구독 방식입니다</li>
                <li>결제는 신용카드, 계좌이체 등을 통해 가능합니다</li>
                <li>요금은 선불로 청구되며 자동 갱신됩니다</li>
                <li>환불 정책: 미사용 시 7일 이내 전액 환불</li>
                <li>플랜 변경 시 차액은 일할 계산됩니다</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. 지적 재산권</h2>
            <div className="text-slate-300 space-y-3">
              <p>서비스의 모든 콘텐츠, 기능, 기술은 회사의 지적 재산입니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>AI 알고리즘 및 예측 모델</li>
                <li>대시보드 UI/UX 디자인</li>
                <li>문서 및 튜토리얼</li>
                <li>로고 및 브랜드 요소</li>
              </ul>
              <p className="mt-4">귀하의 에너지 데이터는 귀하의 소유입니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. 금지 행위</h2>
            <div className="text-slate-300 space-y-3">
              <p>다음 행위는 엄격히 금지됩니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>서비스의 역설계, 복제, 수정</li>
                <li>해킹, DDoS 공격 등 불법 행위</li>
                <li>타인의 데이터 무단 접근</li>
                <li>스팸, 악성 코드 유포</li>
                <li>서비스 과부하를 유발하는 행위</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. 서비스 중단 및 해지</h2>
            <div className="text-slate-300 space-y-3">
              <p>회사는 다음의 경우 서비스를 중단하거나 계정을 해지할 수 있습니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>약관 위반</li>
                <li>결제 실패 또는 사기 의심</li>
                <li>장기간 미사용 (1년 이상)</li>
                <li>시스템 유지보수 (사전 공지)</li>
              </ul>
              <p className="mt-4">귀하는 언제든지 계정을 삭제하고 서비스를 해지할 수 있습니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. 면책 조항</h2>
            <div className="text-slate-300 space-y-3">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>AI 예측의 정확도는 보장되지 않습니다</li>
                <li>제3자 통합 서비스의 장애에 대해 책임지지 않습니다</li>
                <li>불가항력(천재지변 등)으로 인한 서비스 중단</li>
                <li>사용자의 부주의로 인한 데이터 손실</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. 약관 변경</h2>
            <div className="text-slate-300 space-y-3">
              <p>회사는 필요 시 약관을 변경할 수 있으며, 변경 사항은 7일 전에 공지합니다.</p>
              <p>변경 후 서비스를 계속 이용하시면 변경된 약관에 동의한 것으로 간주됩니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. 준거법 및 관할</h2>
            <div className="text-slate-300 space-y-3">
              <p>본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. 문의</h2>
            <div className="text-slate-300">
              <p>약관 관련 문의사항:</p>
              <ul className="mt-4 space-y-2">
                <li>이메일: carbonieum.official@gmail.com</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
