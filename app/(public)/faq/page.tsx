/**
 * FAQ 페이지
 */
export const metadata = {
  title: 'FAQ - 탄소이음',
  description:
    '탄소이음 에너지 관리 플랫폼에 대해 자주 묻는 질문과 답변. 시작하기, 요금, AI 기능, 보안 등 카테고리별 FAQ.',
  openGraph: {
    title: '자주 묻는 질문 (FAQ) - 탄소이음',
    description: '탄소이음 에너지 관리 플랫폼 FAQ',
  },
};

const faqs = [
  {
    category: '시작하기',
    questions: [
      {
        q: '탄소이음를 어떻게 시작하나요?',
        a: '회원가입 후 무료 체험을 시작하실 수 있습니다. 신용카드 등록 없이 14일간 모든 기능을 사용해보세요.',
      },
      {
        q: '설치가 필요한가요?',
        a: '아니요, 탄소이음는 클라우드 기반 SaaS 서비스입니다. 웹 브라우저만 있으면 어디서든 접속 가능합니다.',
      },
      {
        q: '기존 시스템과 연동이 가능한가요?',
        a: '네, REST API와 MQTT 프로토콜을 지원하여 대부분의 에너지 관리 시스템과 연동 가능합니다.',
      },
    ],
  },
  {
    category: '기능',
    questions: [
      {
        q: 'AI 예측은 얼마나 정확한가요?',
        a: 'LSTM 신경망 기반으로 평균 92% 이상의 정확도(MAPE < 8%)를 제공합니다. 데이터가 쌓일수록 정확도가 향상됩니다.',
      },
      {
        q: '실시간 모니터링은 어떻게 작동하나요?',
        a: 'WebSocket과 MQTT를 통해 1초 단위로 실시간 데이터를 수집하고 대시보드에 표시합니다.',
      },
      {
        q: '어떤 종류의 이상을 탐지하나요?',
        a: '과부하, 비정상 전력 스파이크, 설비 고장 징후, 비효율적 운영 패턴 등을 자동으로 감지합니다.',
      },
    ],
  },
  {
    category: '가격 및 결제',
    questions: [
      {
        q: '무료 플랜의 제한사항은 무엇인가요?',
        a: '무료 플랜은 1개 사이트, 10개 디바이스까지 지원하며 기본 대시보드와 7일간의 데이터 보관을 제공합니다.',
      },
      {
        q: '언제든 플랜을 변경할 수 있나요?',
        a: '네, 언제든 업그레이드하거나 다운그레이드할 수 있습니다. 변경 사항은 즉시 적용됩니다.',
      },
      {
        q: '환불 정책은 어떻게 되나요?',
        a: '14일 이내 100% 환불 보장합니다. 서비스에 만족하지 않으시면 전액 환불해드립니다.',
      },
    ],
  },
  {
    category: '보안',
    questions: [
      {
        q: '데이터는 안전하게 보관되나요?',
        a: '모든 데이터는 AES-256으로 암호화되며, ISO 27001 인증을 받은 보안 체계를 갖추고 있습니다.',
      },
      {
        q: '누가 데이터에 접근할 수 있나요?',
        a: 'RBAC(역할 기반 접근 제어)를 통해 권한이 있는 사용자만 데이터에 접근할 수 있습니다.',
      },
      {
        q: '데이터 백업은 어떻게 되나요?',
        a: '매일 자동으로 백업되며, 3개의 다른 지역에 분산 저장됩니다.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            자주 묻는 질문
          </h1>
          <p className="text-xl text-slate-300">
            궁금하신 내용을 빠르게 찾아보세요
          </p>
        </div>

        <div className="space-y-12">
          {faqs.map((category, idx) => (
            <div key={idx}>
              <h2 className="text-2xl font-bold text-white mb-6">
                {category.category}
              </h2>
              <div className="space-y-6">
                {category.questions.map((faq, qIdx) => (
                  <div
                    key={qIdx}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-white mb-3">
                      {faq.q}
                    </h3>
                    <p className="text-slate-300 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            원하는 답변을 찾지 못하셨나요?
          </h2>
          <p className="text-slate-300 mb-6">
            고객센터로 문의하시면 빠르게 도와드리겠습니다.
          </p>
          <a
            href="/support"
            className="inline-flex items-center justify-center px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
          >
            고객센터 문의
          </a>
        </div>
      </div>
    </div>
  );
}
