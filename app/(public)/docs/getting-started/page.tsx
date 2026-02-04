import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Rocket,
  CheckCircle,
  User,
  Building2,
  Cpu,
  BarChart3,
  ArrowRight,
  Play,
} from 'lucide-react';

/**
 * 시작 가이드 페이지
 */
export const metadata = {
  title: '시작하기 - EnergyAI',
  description: '5분 만에 EnergyAI 시작하기',
};

export default function GettingStartedPage() {
  const steps = [
    {
      number: 1,
      icon: User,
      title: '계정 생성',
      description: '이메일로 가입하거나 소셜 로그인을 사용하세요',
      details: [
        '이메일 주소 입력',
        '비밀번호 설정 (8자 이상)',
        '이메일 인증 완료',
        '회사 정보 입력 (선택)',
      ],
      action: '회원가입',
      href: '/register',
      duration: '1분',
    },
    {
      number: 2,
      icon: Building2,
      title: '첫 사이트 등록',
      description: '에너지를 관리할 사이트(건물, 공장)를 추가하세요',
      details: [
        '사이트 이름 및 주소 입력',
        '사이트 유형 선택 (오피스/제조/데이터센터)',
        '면적 및 용도 정보',
        '운영 시간 설정',
      ],
      duration: '2분',
    },
    {
      number: 3,
      icon: Cpu,
      title: '디바이스 연결',
      description: '전력 미터, 센서 등 IoT 디바이스를 연결하세요',
      details: [
        '디바이스 유형 선택 (Modbus, MQTT, REST)',
        '연결 정보 입력 (IP, Port, ID)',
        '데이터 포인트 매핑',
        '연결 테스트 및 확인',
      ],
      duration: '3분',
    },
    {
      number: 4,
      icon: BarChart3,
      title: '대시보드 확인',
      description: '실시간 에너지 데이터를 모니터링하세요',
      details: [
        '실시간 전력 사용량 확인',
        'AI 부하 예측 활성화',
        '알림 규칙 설정',
        'DR 이벤트 참여 (선택)',
      ],
      href: '/dashboard',
      duration: '2분',
    },
  ];

  const quickLinks = [
    { title: '사이트 등록', href: '/admin/sites', icon: Building2 },
    { title: 'API 문서', href: '/docs/api', icon: Rocket },
    { title: '비디오 튜토리얼', href: '/docs/videos', icon: Play },
    { title: '고객 지원', href: '/support', icon: CheckCircle },
  ];

  const videoTutorials = [
    {
      title: '계정 생성부터 첫 사이트 등록까지',
      duration: '5:30',
      thumbnail: 'video-1',
    },
    {
      title: '디바이스 연동 및 데이터 수집',
      duration: '8:20',
      thumbnail: 'video-2',
    },
    {
      title: 'AI 부하 예측 기능 활용하기',
      duration: '6:45',
      thumbnail: 'video-3',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
            <Rocket className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Getting Started</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            5분 만에 시작하기
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            간단한 4단계로 EnergyAI를 시작하고 에너지 관리를 혁신하세요
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Rocket className="mr-2 w-5 h-5" />
              무료로 시작하기
            </Button>
          </Link>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-12">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-8 top-20 w-0.5 h-32 bg-gradient-to-b from-emerald-500 to-transparent hidden md:block" />
                )}

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-emerald-500/50 transition-all">
                  <div className="flex items-start gap-6">
                    {/* Step Number */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-500/50">
                        <step.icon className="w-8 h-8 text-emerald-400" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-full font-semibold">
                          STEP {step.number}
                        </span>
                        <span className="text-slate-400 text-sm">
                          소요 시간: {step.duration}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-slate-300 mb-6">{step.description}</p>

                      <div className="grid md:grid-cols-2 gap-3 mb-6">
                        {step.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-slate-400"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">{detail}</span>
                          </div>
                        ))}
                      </div>

                      {step.action && (
                        <Link href={step.href || '#'}>
                          <Button className="bg-emerald-500 hover:bg-emerald-600">
                            {step.action}
                            <ArrowRight className="ml-2 w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Tutorials Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            비디오 튜토리얼
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {videoTutorials.map((video, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-emerald-500/50 transition-all group cursor-pointer"
              >
                <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
                  <Play className="w-12 h-12 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded">
                    {video.duration}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold group-hover:text-emerald-400 transition-colors">
                    {video.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            다음 단계
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {quickLinks.map((link, index) => (
              <Link key={index} href={link.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-all group">
                  <link.icon className="w-12 h-12 text-emerald-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-semibold group-hover:text-emerald-400 transition-colors">
                    {link.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">도움이 필요하신가요?</h2>
          <p className="text-xl text-slate-300 mb-8">
            언제든지 고객 지원팀에 문의하세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/support">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                고객 지원 문의
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/community">
              <Button size="lg" variant="outline">
                커뮤니티 방문
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
