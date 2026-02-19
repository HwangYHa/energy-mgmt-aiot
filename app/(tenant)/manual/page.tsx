'use client';

import { useState } from 'react';
import {
  BookOpen,
  Search,
  ChevronRight,
  Monitor,
  BarChart3,
  Zap,
  Settings,
  Shield,
  Bell,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface ManualSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  color: string;
  articles: { title: string; description: string }[];
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'getting-started',
    title: '시작하기',
    icon: BookOpen,
    color: 'text-cyan-400',
    articles: [
      { title: '시스템 개요', description: 'EMS AIoT 시스템의 전체 구조와 주요 기능을 설명합니다.' },
      { title: '초기 설정 가이드', description: '사이트 등록, 디바이스 연결, 센서 설정 방법을 안내합니다.' },
      { title: '사용자 역할 및 권한', description: '뷰어, 운영자, 관리자 등 역할별 접근 권한을 설명합니다.' },
      { title: '로그인 및 인증', description: 'Google OAuth, Naver 로그인, 이메일 인증 방법을 안내합니다.' },
    ],
  },
  {
    id: 'monitoring',
    title: '모니터링',
    icon: Monitor,
    color: 'text-emerald-400',
    articles: [
      { title: '종합 모니터링 대시보드', description: '전력 사용량, 설비 상태, KPI를 실시간으로 확인합니다.' },
      { title: '실시간 데이터 현황', description: '실시간 전력 소비 그래프와 피크 관리 방법을 설명합니다.' },
      { title: '데이터 수집 상태', description: '센서/디바이스 연결 상태와 데이터 품질 모니터링 방법입니다.' },
      { title: '설비 모니터링', description: '개별 설비의 가동 상태와 에너지 소비를 확인합니다.' },
    ],
  },
  {
    id: 'analytics',
    title: '분석 & 예측',
    icon: BarChart3,
    color: 'text-yellow-400',
    articles: [
      { title: '에너지 분석', description: '기간별 전력 사용량 추이, 피크 분석, 부하율을 확인합니다.' },
      { title: '비용 분석', description: '전력 요금 구성, 시간대별 비용, 절감 가능 금액을 분석합니다.' },
      { title: '이상 탐지', description: 'AI 기반 에너지 사용 이상 패턴 탐지 기능을 설명합니다.' },
      { title: '절감 시뮬레이터', description: 'LED, HVAC, 태양광 등 시나리오별 절감 효과를 시뮬레이션합니다.' },
      { title: '분석 템플릿', description: '사전 정의된 분석 리포트를 빠르게 실행하는 방법입니다.' },
      { title: '데이터 다운로드', description: '수집 데이터를 CSV, Excel, JSON으로 내보내는 방법입니다.' },
    ],
  },
  {
    id: 'control',
    title: '설비 제어',
    icon: Zap,
    color: 'text-blue-400',
    articles: [
      { title: '수동 제어', description: '개별 설비에 직접 제어 명령을 보내는 방법을 설명합니다.' },
      { title: '스케줄 제어', description: '시간 기반 자동 제어 스케줄을 설정하는 방법입니다.' },
      { title: 'AI 최적 제어', description: 'AI가 에너지 효율을 최적화하는 자동 제어 기능입니다.' },
      { title: 'DR 참여', description: '수요반응 이벤트 참여 및 관리 방법을 안내합니다.' },
    ],
  },
  {
    id: 'settings',
    title: '설정 & 관리',
    icon: Settings,
    color: 'text-purple-400',
    articles: [
      { title: '알림 설정', description: '이메일, SMS, 웹훅 알림 규칙 설정 방법입니다.' },
      { title: 'API 키 관리', description: '외부 시스템 연동을 위한 API 키 생성 및 관리 방법입니다.' },
      { title: '사이트 관리', description: '사업장 정보, 운영 시간, 관리자 설정 방법입니다.' },
      { title: '구독 관리', description: '플랜 변경, 결제 이력, 사용량 확인 방법입니다.' },
    ],
  },
  {
    id: 'compliance',
    title: '규제 & 컴플라이언스',
    icon: Shield,
    color: 'text-amber-400',
    articles: [
      { title: '감사 추적', description: '시스템 활동 기록 조회 및 감사 로그 관리 방법입니다.' },
      { title: '배출계수 관리', description: '탄소 배출 계산에 사용되는 배출계수 설정 방법입니다.' },
      { title: '규제 리포트', description: '법정 보고서 생성 및 제출 관리 방법을 설명합니다.' },
    ],
  },
];

export default function ManualPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const filteredSections = MANUAL_SECTIONS.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.includes(query) ||
      section.articles.some(
        (a) => a.title.includes(query) || a.description.includes(query)
      )
    );
  });

  const activeSection = selectedSection
    ? MANUAL_SECTIONS.find((s) => s.id === selectedSection)
    : null;

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-cyan-400" />
            </div>
            사용자 매뉴얼
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            EMS AIoT 시스템 사용 가이드
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedSection(null); }}
            placeholder="매뉴얼 검색..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      {activeSection ? (
        /* 섹션 상세 */
        <div>
          <button
            onClick={() => setSelectedSection(null)}
            className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-1 transition"
          >
            전체 목록으로 돌아가기
          </button>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <activeSection.icon className={`w-6 h-6 ${activeSection.color}`} />
              <h2 className="text-xl font-bold">{activeSection.title}</h2>
            </div>
            <div className="space-y-4">
              {activeSection.articles.map((article, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-slate-600 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white mb-1">{article.title}</h3>
                      <p className="text-sm text-slate-400">{article.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 섹션 그리드 */
        <>
          {/* 퀵 링크 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5">
              <HelpCircle className="w-6 h-6 text-cyan-400 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">빠른 시작 가이드</h3>
              <p className="text-sm text-slate-400 mb-3">처음 사용하시나요? 5분만에 시작하세요.</p>
              <button
                onClick={() => setSelectedSection('getting-started')}
                className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                가이드 보기 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <Bell className="w-6 h-6 text-emerald-400 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">알림 설정</h3>
              <p className="text-sm text-slate-400 mb-3">중요한 이벤트 알림을 설정하세요.</p>
              <button
                onClick={() => setSelectedSection('settings')}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              >
                설정 가이드 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <ExternalLink className="w-6 h-6 text-blue-400 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">API 문서</h3>
              <p className="text-sm text-slate-400 mb-3">외부 시스템 연동을 위한 API 문서입니다.</p>
              <a
                href="/docs/api"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
              >
                API 문서 보기 <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* 섹션 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-left hover:border-slate-600 transition"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className={`w-5 h-5 ${section.color}`} />
                    <h3 className="text-base font-semibold text-white">{section.title}</h3>
                  </div>
                  <div className="space-y-1.5">
                    {section.articles.slice(0, 3).map((article, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-400">
                        <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        <span className="truncate">{article.title}</span>
                      </div>
                    ))}
                    {section.articles.length > 3 && (
                      <p className="text-xs text-slate-500 pl-5">
                        +{section.articles.length - 3}개 더보기
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredSections.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">검색 결과가 없습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
