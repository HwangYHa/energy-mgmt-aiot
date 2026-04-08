import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Users,
  MessageSquare,
  Clock,
  Mail,
  ArrowRight,
  Bell,
} from 'lucide-react';

/**
 * 커뮤니티 페이지 — 준비중
 */
export const metadata = {
  title: '커뮤니티 - 탄소이음',
  description: '탄소이음 에너지 전문가 커뮤니티가 곧 오픈됩니다.',
  openGraph: {
    title: '탄소이음 커뮤니티 — Coming Soon',
    description: '에너지·탄소중립 전문가 네트워크 플랫폼이 곧 오픈됩니다.',
  },
};

export default function CommunityPage() {
  const plannedFeatures = [
    { icon: MessageSquare, title: 'Q&A 게시판',       desc: '기술 문의, 사용 팁, 트러블슈팅 공유' },
    { icon: Users,         title: '성공 사례 공유',   desc: '에너지 절감·탄소중립 달성 사례 발표' },
    { icon: Bell,          title: '공지 & 업데이트',  desc: '신기능 안내, 정책 변경, 이벤트 소식' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-semibold">준비 중</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            탄소이음 커뮤니티
          </h1>
          <p className="text-xl text-slate-300 mb-4">
            에너지 전문가들이 함께 성장하는 공간을 만들고 있습니다.
          </p>
          <p className="text-slate-400 mb-10">
            오픈 시 알림을 받으시려면 아래 이메일로 연락해 주세요.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:carbonieum.official@gmail.com?subject=커뮤니티 오픈 알림 신청">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                <Mail className="mr-2 w-5 h-5" />
                오픈 알림 신청
              </Button>
            </a>
            <Link href="/support">
              <Button size="lg" variant="outline">
                문의하기
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 준비중 기능 미리보기 */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">
            준비 중인 기능
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {plannedFeatures.map((f) => (
              <div
                key={f.title}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center opacity-80"
              >
                <f.icon className="w-10 h-10 text-emerald-400/70 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 지금 시작하기 CTA */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            지금 바로 서비스를 시작해보세요
          </h2>
          <p className="text-slate-400 mb-8">
            커뮤니티 오픈 전에도 고객 지원 및 문의를 통해 전문가 도움을 받을 수 있습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                무료로 시작하기
              </Button>
            </Link>
            <Link href="/support">
              <Button size="lg" variant="outline">
                전문가 지원 문의
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
