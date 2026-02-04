import { Shield, Lock, Eye, Server, CheckCircle } from 'lucide-react';

/**
 * 보안 정책 페이지
 */
export const metadata = {
  title: '보안 정책 - EnergyAI',
  description: 'EnergyAI 보안 및 데이터 보호',
};

export default function SecurityPage() {
  const securityMeasures = [
    {
      icon: Lock,
      title: '데이터 암호화',
      description: 'AES-256 암호화로 저장 데이터 보호, TLS 1.3으로 전송 데이터 암호화',
      features: [
        '전송 중 암호화 (HTTPS/TLS 1.3)',
        '저장 데이터 암호화 (AES-256)',
        'End-to-End 암호화 옵션',
      ],
    },
    {
      icon: Eye,
      title: '접근 제어',
      description: '역할 기반 접근 제어(RBAC)로 데이터 접근 권한 관리',
      features: [
        '다단계 권한 시스템 (Viewer ~ Admin)',
        '2단계 인증 (2FA) 지원',
        'IP 화이트리스트',
      ],
    },
    {
      icon: Server,
      title: '인프라 보안',
      description: '엔터프라이즈급 클라우드 인프라와 보안 모니터링',
      features: [
        'AWS/GCP 엔터프라이즈 인프라',
        'DDoS 방어',
        '24/7 보안 모니터링',
      ],
    },
    {
      icon: CheckCircle,
      title: '규정 준수',
      description: '국제 보안 표준 및 규정 준수',
      features: [
        'ISO 27001 인증',
        'SOC 2 Type II',
        'GDPR 준수',
      ],
    },
  ];

  const dataProtection = [
    {
      title: '데이터 백업',
      items: [
        '일일 자동 백업',
        '30일 보관 정책',
        '지역별 다중 백업',
        '즉시 복구 가능',
      ],
    },
    {
      title: '재해 복구',
      items: [
        'RPO: 1시간',
        'RTO: 4시간',
        '다중 리전 배포',
        '자동 페일오버',
      ],
    },
    {
      title: '감사 로그',
      items: [
        '모든 API 호출 기록',
        '데이터 접근 로그',
        '관리자 활동 추적',
        '최소 90일 보관',
      ],
    },
  ];

  const certifications = [
    { name: 'ISO 27001', desc: '정보보안 관리' },
    { name: 'SOC 2 Type II', desc: '서비스 조직 통제' },
    { name: 'GDPR', desc: '개인정보 보호' },
    { name: 'K-ISMS', desc: '국내 정보보호 인증' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full mb-6">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold">Security</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            보안 및 데이터 보호
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            엔터프라이즈급 보안으로 귀하의 에너지 데이터를 안전하게 보호합니다
          </p>
        </div>

        {/* Security Measures */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {securityMeasures.map((measure, index) => (
            <div
              key={index}
              className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-green-500/50 transition-all"
            >
              <div className="w-16 h-16 bg-green-500/10 rounded-lg flex items-center justify-center mb-6">
                <measure.icon className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                {measure.title}
              </h3>
              <p className="text-slate-300 mb-6">{measure.description}</p>
              <ul className="space-y-2">
                {measure.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-slate-400"
                  >
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Data Protection */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            데이터 보호 체계
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {dataProtection.map((section, index) => (
              <div key={index}>
                <h3 className="text-xl font-semibold text-white mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-slate-300 text-sm"
                    >
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            인증 및 규정 준수
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {certifications.map((cert, index) => (
              <div
                key={index}
                className="text-center p-6 bg-slate-900 rounded-lg border border-slate-700"
              >
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {cert.name}
                </h3>
                <p className="text-sm text-slate-400">{cert.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Responsible Disclosure */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-6">
            보안 취약점 신고
          </h2>
          <div className="text-slate-300 space-y-4">
            <p>
              보안 취약점을 발견하셨다면 책임감 있는 공개(Responsible Disclosure) 정책에 따라 신고해주세요:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>이메일: security@energyai.io</li>
              <li>PGP 키: 제공 가능</li>
              <li>응답 시간: 24시간 이내</li>
              <li>해결 시간: 심각도에 따라 7-30일</li>
            </ul>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mt-6">
              <p className="text-green-400 font-semibold mb-2">버그 바운티 프로그램</p>
              <p className="text-slate-300 text-sm">
                심각한 보안 취약점 발견 시 최대 $10,000의 보상을 제공합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center mt-16">
          <p className="text-slate-400 mb-4">보안 관련 문의사항이 있으신가요?</p>
          <a
            href="mailto:security@energyai.io"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Shield className="w-5 h-5" />
            보안팀 문의
          </a>
        </div>
      </div>
    </div>
  );
}
