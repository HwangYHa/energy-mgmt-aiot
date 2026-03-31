'use client';

import { useState, useEffect } from 'react';
import { X, Shield, FileText, Lock, Eye, Server, CheckCircle } from 'lucide-react';

type LegalType = 'privacy' | 'terms' | 'security';

interface LegalModalProps {
  type: LegalType;
  isOpen: boolean;
  onClose: () => void;
}

const TITLES: Record<LegalType, string> = {
  privacy: '개인정보 처리방침',
  terms: '이용약관',
  security: '보안 정책',
};

export function LegalModal({ type, isOpen, onClose }: LegalModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            {type === 'privacy' && <Shield className="w-6 h-6 text-blue-400" />}
            {type === 'terms' && <FileText className="w-6 h-6 text-emerald-400" />}
            {type === 'security' && <Shield className="w-6 h-6 text-green-400" />}
            <h2 className="text-xl font-bold text-white">{TITLES[type]}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">
          {type === 'privacy' && <PrivacyContent />}
          {type === 'terms' && <TermsContent />}
          {type === 'security' && <SecurityContent />}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-6 text-slate-300">
      <p className="text-sm text-slate-400">최종 업데이트: 2026년 2월 3일</p>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">1. 수집하는 개인정보</h3>
        <p className="mb-2">탄소이음는 다음과 같은 개인정보를 수집합니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>필수 정보: 이메일, 이름, 회사명</li>
          <li>선택 정보: 전화번호, 부서, 직책</li>
          <li>자동 수집: IP 주소, 쿠키, 로그 데이터</li>
          <li>에너지 데이터: 사이트 및 디바이스 에너지 사용량</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">2. 개인정보 이용 목적</h3>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>서비스 제공 및 운영</li>
          <li>회원 관리 및 본인 확인</li>
          <li>에너지 데이터 분석 및 AI 예측</li>
          <li>고객 지원 및 문의 응대</li>
          <li>서비스 개선 및 신규 서비스 개발</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">3. 개인정보 보유 기간</h3>
        <p className="mb-2">회원 탈퇴 시까지 보유하며, 법령에 따라 다음 정보는 일정 기간 보관합니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>계약 또는 청약철회 기록: 5년</li>
          <li>대금결제 및 재화 공급 기록: 5년</li>
          <li>소비자 불만 또는 분쟁처리 기록: 3년</li>
          <li>로그인 기록: 3개월</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">4. 제3자 제공</h3>
        <p className="mb-2">회사는 원칙적으로 개인정보를 제3자에게 제공하지 않습니다. 단, 다음의 경우는 예외입니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>사용자가 사전에 동의한 경우</li>
          <li>법령에 의거하거나 수사 목적으로 요구된 경우</li>
          <li>결제 처리를 위한 PG사 제공 (아임포트, Stripe)</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">5. 정보주체의 권리</h3>
        <p className="mb-2">귀하는 다음과 같은 권리를 행사할 수 있습니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>개인정보 열람 요구</li>
          <li>개인정보 정정 요구</li>
          <li>개인정보 삭제 요구</li>
          <li>개인정보 처리 정지 요구</li>
        </ul>
        <p className="mt-3 text-sm">권리 행사는 설정 페이지 또는 carbonieum.official@gmail.com로 요청 가능합니다.</p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">6. 보안 조치</h3>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>데이터 암호화 (AES-256)</li>
          <li>접근 권한 관리 및 RBAC 적용</li>
          <li>정기적인 보안 감사</li>
          <li>침입 탐지 시스템 운영</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">7. 문의</h3>
        <p>개인정보 관련 문의사항이 있으시면 아래로 연락주세요:</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>이메일: carbonieum.official@gmail.com</li>
          {/* 사업자 등록 완료 후 기재 예정
          <li>전화: 000-0000-0000</li>
          <li>주소: (사업자 등록 주소 기재 예정)</li>
          */}
        </ul>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-6 text-slate-300">
      <p className="text-sm text-slate-400">최종 업데이트: 2026년 2월 3일</p>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">1. 서비스 이용</h3>
        <p className="mb-2">탄소이음 서비스를 이용함으로써 귀하는 본 약관에 동의하게 됩니다.</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>서비스는 만 14세 이상만 이용 가능합니다</li>
          <li>정확한 정보를 제공해야 합니다</li>
          <li>계정 정보는 안전하게 관리해야 합니다</li>
          <li>타인의 계정을 무단으로 사용할 수 없습니다</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">2. 요금 및 결제</h3>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>요금제는 월간 또는 연간 구독 방식입니다</li>
          <li>결제는 신용카드, 계좌이체 등을 통해 가능합니다</li>
          <li>요금은 선불로 청구되며 자동 갱신됩니다</li>
          <li>환불 정책: 미사용 시 7일 이내 전액 환불</li>
          <li>플랜 변경 시 차액은 일할 계산됩니다</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">3. 지적 재산권</h3>
        <p className="mb-2">서비스의 모든 콘텐츠, 기능, 기술은 회사의 지적 재산입니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>AI 알고리즘 및 예측 모델</li>
          <li>대시보드 UI/UX 디자인</li>
          <li>문서 및 튜토리얼</li>
          <li>로고 및 브랜드 요소</li>
        </ul>
        <p className="mt-3 text-sm">귀하의 에너지 데이터는 귀하의 소유입니다.</p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">4. 금지 행위</h3>
        <p className="mb-2">다음 행위는 엄격히 금지됩니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>서비스의 역설계, 복제, 수정</li>
          <li>해킹, DDoS 공격 등 불법 행위</li>
          <li>타인의 데이터 무단 접근</li>
          <li>스팸, 악성 코드 유포</li>
          <li>서비스 과부하를 유발하는 행위</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">5. 서비스 중단 및 해지</h3>
        <p className="mb-2">회사는 다음의 경우 서비스를 중단하거나 계정을 해지할 수 있습니다:</p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>약관 위반</li>
          <li>결제 실패 또는 사기 의심</li>
          <li>장기간 미사용 (1년 이상)</li>
          <li>시스템 유지보수 (사전 공지)</li>
        </ul>
        <p className="mt-3 text-sm">귀하는 언제든지 계정을 삭제하고 서비스를 해지할 수 있습니다.</p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">6. 면책 조항</h3>
        <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
          <li>AI 예측의 정확도는 보장되지 않습니다</li>
          <li>제3자 통합 서비스의 장애에 대해 책임지지 않습니다</li>
          <li>불가항력(천재지변 등)으로 인한 서비스 중단</li>
          <li>사용자의 부주의로 인한 데이터 손실</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">7. 약관 변경</h3>
        <p className="text-sm">회사는 필요 시 약관을 변경할 수 있으며, 변경 사항은 7일 전에 공지합니다.</p>
        <p className="text-sm mt-1">변경 후 서비스를 계속 이용하시면 변경된 약관에 동의한 것으로 간주됩니다.</p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">8. 준거법 및 관할</h3>
        <p className="text-sm">본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.</p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">9. 문의</h3>
        <p>약관 관련 문의사항:</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>이메일: carbonieum.official@gmail.com</li>
          {/* 사업자 등록 완료 후 기재 예정
          <li>전화: 000-0000-0000</li>
          */}
        </ul>
      </section>
    </div>
  );
}

function SecurityContent() {
  const securityMeasures = [
    {
      icon: Lock,
      title: '데이터 암호화',
      description: 'AES-256 암호화로 저장 데이터 보호, TLS 1.3으로 전송 데이터 암호화',
      features: ['전송 중 암호화 (HTTPS/TLS 1.3)', '저장 데이터 암호화 (AES-256)', 'End-to-End 암호화 옵션'],
    },
    {
      icon: Eye,
      title: '접근 제어',
      description: '역할 기반 접근 제어(RBAC)로 데이터 접근 권한 관리',
      features: ['다단계 권한 시스템 (Viewer ~ Admin)', '2단계 인증 (2FA) 지원', 'IP 화이트리스트'],
    },
    {
      icon: Server,
      title: '인프라 보안',
      description: '엔터프라이즈급 클라우드 인프라와 보안 모니터링',
      features: ['AWS/GCP 엔터프라이즈 인프라', 'DDoS 방어', '24/7 보안 모니터링'],
    },
    {
      icon: CheckCircle,
      title: '규정 준수',
      description: '국제 보안 표준 및 규정 준수',
      features: ['ISO 27001 인증', 'SOC 2 Type II', 'GDPR 준수'],
    },
  ];

  return (
    <div className="space-y-6 text-slate-300">
      <div className="grid md:grid-cols-2 gap-4">
        {securityMeasures.map((measure, index) => (
          <div key={index} className="bg-slate-900 border border-slate-700 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <measure.icon className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-bold text-white">{measure.title}</h3>
            </div>
            <p className="text-sm text-slate-400 mb-3">{measure.description}</p>
            <ul className="space-y-1">
              {measure.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">데이터 보호 체계</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: '데이터 백업', items: ['일일 자동 백업', '30일 보관 정책', '지역별 다중 백업', '즉시 복구 가능'] },
            { title: '재해 복구', items: ['RPO: 1시간', 'RTO: 4시간', '다중 리전 배포', '자동 페일오버'] },
            { title: '감사 로그', items: ['모든 API 호출 기록', '데이터 접근 로그', '관리자 활동 추적', '최소 90일 보관'] },
          ].map((section, index) => (
            <div key={index} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="font-semibold text-white mb-2">{section.title}</h4>
              <ul className="space-y-1">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-3">인증 및 규정 준수</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'ISO 27001', desc: '정보보안 관리' },
            { name: 'SOC 2 Type II', desc: '서비스 조직 통제' },
            { name: 'GDPR', desc: '개인정보 보호' },
            { name: 'K-ISMS', desc: '국내 정보보호 인증' },
          ].map((cert, index) => (
            <div key={index} className="text-center p-4 bg-slate-900 rounded-lg border border-slate-700">
              <Shield className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="font-semibold text-white text-sm">{cert.name}</div>
              <div className="text-xs text-slate-400">{cert.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <p className="text-green-400 font-semibold mb-1">보안 취약점 신고</p>
        <p className="text-sm">보안 취약점 발견 시 security@carboneum.kr로 신고해주세요. 심각한 취약점에 대해 최대 $10,000의 보상을 제공합니다.</p>
      </section>
    </div>
  );
}

/**
 * Footer에서 사용하는 법적 링크 클라이언트 컴포넌트
 */
export function FooterLegalLinks() {
  const [modalType, setModalType] = useState<LegalType | null>(null);

  const legalItems: { label: string; type: LegalType }[] = [
    { label: '개인정보처리방침', type: 'privacy' },
    { label: '이용약관', type: 'terms' },
    { label: '보안정책', type: 'security' },
  ];

  return (
    <>
      <div className="flex gap-6 text-sm text-slate-400">
        {legalItems.map((item) => (
          <button
            key={item.type}
            onClick={() => setModalType(item.type)}
            className="hover:text-emerald-400 transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>
      {modalType && (
        <LegalModal
          type={modalType}
          isOpen={true}
          onClose={() => setModalType(null)}
        />
      )}
    </>
  );
}
