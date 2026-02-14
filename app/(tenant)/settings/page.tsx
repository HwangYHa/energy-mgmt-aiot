'use client';

import Link from 'next/link';
import {
  User,
  Bell,
  CreditCard,
  Settings,
  Shield,
  ChevronRight,
} from 'lucide-react';

export default function SettingsPage() {
  const settingsMenu = [
    {
      title: '계정 설정',
      description: '프로필 정보, 비밀번호 변경',
      href: '/settings/account',
      icon: User,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '알림 설정',
      description: '이메일, SMS, 푸시 알림 규칙 관리',
      href: '/settings/notifications',
      icon: Bell,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: '구독 관리',
      description: '현재 플랜, 결제 내역, 사용량 확인',
      href: '/settings/subscription',
      icon: CreditCard,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: '시스템 설정',
      description: '에너지 요금, 알림 임계값, 대시보드 설정',
      href: '/settings/system',
      icon: Settings,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Settings className="w-6 h-6 text-cyan-400" />
            </div>
            설정
          </h1>
          <p className="text-slate-400 mt-1">
            계정, 알림, 구독, 시스템 설정을 관리합니다
          </p>
        </div>

        {/* 설정 메뉴 목록 */}
        <div className="space-y-3">
          {settingsMenu.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-cyan-500/30 hover:bg-slate-800/70 transition-all group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 ${item.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}
                  >
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 보안 안내 */}
        <div className="mt-8 bg-slate-800/30 border border-slate-700/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-white">보안 안내</h4>
              <p className="text-xs text-slate-400 mt-1">
                비밀번호는 정기적으로 변경하시고, 공유 기기에서는 로그아웃을
                잊지 마세요. 의심스러운 활동이 감지되면 즉시 고객지원팀에
                연락해주세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
