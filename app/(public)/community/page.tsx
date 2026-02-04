import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Users,
  MessageSquare,
  Star,
  TrendingUp,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

/**
 * 커뮤니티 페이지
 */
export const metadata = {
  title: '커뮤니티 - EnergyAI',
  description: 'EnergyAI 사용자 커뮤니티',
};

export default function CommunityPage() {
  const stats = [
    { label: '활성 사용자', value: '12,000+', icon: Users },
    { label: '월간 게시글', value: '3,500+', icon: MessageSquare },
    { label: '해결된 질문', value: '95%', icon: Star },
  ];

  const categories = [
    { name: '공지사항', posts: 45, icon: '📢', color: 'text-blue-400' },
    { name: '질문 & 답변', posts: 1230, icon: '❓', color: 'text-emerald-400' },
    { name: '사용 팁', posts: 856, icon: '💡', color: 'text-yellow-400' },
    { name: '기능 요청', posts: 342, icon: '🚀', color: 'text-purple-400' },
    { name: '버그 리포트', posts: 128, icon: '🐛', color: 'text-red-400' },
    { name: '성공 사례', posts: 267, icon: '🎯', color: 'text-green-400' },
  ];

  const recentPosts = [
    {
      title: 'AI 부하 예측 정확도를 95%까지 올린 방법',
      author: '김에너지',
      replies: 23,
      views: 1250,
      category: '사용 팁',
      time: '2시간 전',
    },
    {
      title: 'Modbus TCP 연결이 끊어지는 문제 해결',
      author: '박전력',
      replies: 15,
      views: 890,
      category: '질문 & 답변',
      time: '5시간 전',
    },
    {
      title: '제조업 현장에서 월 3천만원 절감한 사례',
      author: '이절약',
      replies: 42,
      views: 3200,
      category: '성공 사례',
      time: '1일 전',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
            <Users className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Community</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            EnergyAI 커뮤니티
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            전문가와 사용자들이 함께 성장하는 공간
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
              <MessageSquare className="mr-2 w-5 h-5" />
              게시글 작성
            </Button>
            <Button size="lg" variant="outline">
              회원가입
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center"
              >
                <stat.icon className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <div className="text-4xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">카테고리</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((category, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{category.icon}</span>
                    <h3 className={`text-lg font-semibold ${category.color}`}>
                      {category.name}
                    </h3>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                </div>
                <p className="text-slate-400 text-sm">
                  {category.posts.toLocaleString()} 게시글
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Posts Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">최근 게시글</h2>
            <Button variant="outline">
              전체 보기
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {recentPosts.map((post, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
                        {post.category}
                      </span>
                      <span className="text-slate-500 text-sm">{post.time}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2 hover:text-emerald-400 transition-colors">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>작성자: {post.author}</span>
                      <span>💬 {post.replies}</span>
                      <span>👁️ {post.views.toLocaleString()}</span>
                    </div>
                  </div>
                  <TrendingUp className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* External Links Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            소셜 채널
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Discord', icon: '💬', members: '5.2K' },
              { name: 'Slack', icon: '💼', members: '3.8K' },
              { name: 'GitHub', icon: '⭐', members: '2.1K' },
              { name: 'LinkedIn', icon: '🔗', members: '8.5K' },
            ].map((social, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="text-5xl mb-4">{social.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  {social.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {social.members} 멤버
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  참여하기
                  <ExternalLink className="ml-2 w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            지금 바로 참여하세요
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            12,000명의 에너지 전문가들과 함께하세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                무료 회원가입
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline">
                시작 가이드 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
