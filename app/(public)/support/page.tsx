import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ContactForm } from '@/components/support/ContactForm';
import {
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Clock,
  CheckCircle,
  ArrowRight,
  Book,
  HelpCircle,
  Send,
} from 'lucide-react';

/**
 * 고객 지원 페이지
 */
export const metadata = {
  title: '고객 지원 - 탄소이음',
  description: '24/7 고객 지원 서비스',
};

export default function SupportPage() {
  const contactMethods = [
    {
      icon: MessageCircle,
      title: '실시간 채팅',
      description: '즉시 답변받고 싶으신가요?',
      detail: '평일 09:00-18:00 운영',
      action: '채팅 시작',
      href: '#chat',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: Mail,
      title: '이메일 문의',
      description: '자세한 내용을 전달하고 싶으신가요?',
      detail: 'support@탄소이음.io',
      action: '이메일 보내기',
      href: 'mailto:support@탄소이음.io',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Phone,
      title: '전화 상담',
      description: '긴급한 문제가 있으신가요?',
      detail: '1588-1234 (평일 09:00-18:00)',
      action: '전화하기',
      href: 'tel:1588-1234',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  const faqCategories = [
    {
      title: '계정 & 로그인',
      icon: HelpCircle,
      faqs: [
        {
          q: '비밀번호를 잊어버렸어요',
          a: '로그인 페이지에서 "비밀번호 찾기"를 클릭하여 이메일로 재설정 링크를 받으실 수 있습니다.',
        },
        {
          q: '2단계 인증을 설정하려면?',
          a: '설정 > 보안 > 2단계 인증에서 활성화하실 수 있습니다.',
        },
      ],
    },
    {
      title: '사이트 & 디바이스',
      icon: HelpCircle,
      faqs: [
        {
          q: '디바이스 연결이 안돼요',
          a: 'IP 주소, 포트, 프로토콜 설정을 확인해주세요. Modbus TCP는 502 포트를 사용합니다.',
        },
        {
          q: '사이트 삭제 후 복구 가능한가요?',
          a: '삭제된 지 30일 이내라면 고객지원팀에 문의하시면 복구 가능합니다.',
        },
      ],
    },
    {
      title: '요금 & 결제',
      icon: HelpCircle,
      faqs: [
        {
          q: '요금제 변경은 어떻게 하나요?',
          a: '설정 > 구독 관리에서 언제든지 플랜을 변경하실 수 있습니다. 차액은 일할 계산됩니다.',
        },
        {
          q: '환불 정책이 궁금해요',
          a: '결제 후 7일 이내 미사용 시 전액 환불 가능합니다.',
        },
      ],
    },
  ];

  const resources = [
    {
      icon: Book,
      title: '문서',
      description: '상세한 가이드와 튜토리얼',
      href: '/docs',
    },
    {
      icon: MessageCircle,
      title: '커뮤니티',
      description: '다른 사용자들과 소통',
      href: '/community',
    },
    {
      icon: Clock,
      title: '시스템 상태',
      description: '서비스 가동 현황',
      href: '/status',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
            <Headphones className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Support</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            고객 지원
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            언제든지 도와드릴 준비가 되어 있습니다
          </p>
        </div>
      </section>

      {/* Contact Methods Section */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            문의 방법
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {contactMethods.map((method, index) => (
              <Link key={index} href={method.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center hover:border-emerald-500/50 hover:shadow-xl transition-all group">
                  <div
                    className={`w-16 h-16 ${method.bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}
                  >
                    <method.icon className={`w-8 h-8 ${method.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {method.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-2">
                    {method.description}
                  </p>
                  <p className="text-slate-500 text-xs mb-6">{method.detail}</p>
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 w-full"
                  >
                    {method.action}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            자주 묻는 질문
          </h2>
          <div className="space-y-6">
            {faqCategories.map((category, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8"
              >
                <div className="flex items-center gap-3 mb-6">
                  <category.icon className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-semibold text-white">
                    {category.title}
                  </h3>
                </div>
                <div className="space-y-4">
                  {category.faqs.map((faq, idx) => (
                    <div key={idx} className="border-t border-slate-700 pt-4">
                      <div className="flex items-start gap-3 mb-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <h4 className="text-white font-semibold">{faq.q}</h4>
                      </div>
                      <p className="text-slate-400 text-sm ml-8">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/faq">
              <Button variant="outline" size="lg">
                모든 FAQ 보기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="chat" className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-4">
              <Send className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-semibold text-sm">
                Contact Us
              </span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">문의하기</h2>
            <p className="text-slate-400">
              아래 양식을 작성해주시면 24시간 이내에 답변 드리겠습니다
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            추가 리소스
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {resources.map((resource, index) => (
              <Link key={index} href={resource.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-all group">
                  <resource.icon className="w-12 h-12 text-emerald-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-slate-400 text-sm">{resource.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            아직도 해결되지 않으셨나요?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            언제든지 문의해주세요. 최대한 빠르게 도와드리겠습니다
          </p>
          <Link href="#chat">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
              <Mail className="mr-2 w-5 h-5" />
              문의하기
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
