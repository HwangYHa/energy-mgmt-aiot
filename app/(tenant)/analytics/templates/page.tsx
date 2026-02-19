'use client';

import { useState } from 'react';
import {
  FileBarChart,
  Clock,
  Zap,
  DollarSign,
  Leaf,
  AlertTriangle,
  TrendingUp,
  Play,
  Copy,
  Star,
  Search,
  Loader2,
} from 'lucide-react';

interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  category: 'energy' | 'cost' | 'carbon' | 'anomaly' | 'forecast';
  parameters: string[];
  estimatedTime: string;
  popularity: number;
  isNew?: boolean;
}

const CATEGORY_CONFIG = {
  energy: { icon: Zap, label: '에너지', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  cost: { icon: DollarSign, label: '비용', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  carbon: { icon: Leaf, label: '탄소', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  anomaly: { icon: AlertTriangle, label: '이상탐지', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  forecast: { icon: TrendingUp, label: '예측', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
};

const TEMPLATES: AnalysisTemplate[] = [
  {
    id: 't1',
    name: '월간 에너지 소비 리포트',
    description: '월별 전력 사용량, 피크 분석, 전월 대비 추이를 종합적으로 분석합니다.',
    category: 'energy',
    parameters: ['기간 (월)', '사이트'],
    estimatedTime: '약 30초',
    popularity: 95,
  },
  {
    id: 't2',
    name: '시간대별 전력 패턴 분석',
    description: '경부하/중간부하/최대부하 시간대별 전력 사용 패턴을 분석합니다.',
    category: 'energy',
    parameters: ['기간', '사이트'],
    estimatedTime: '약 20초',
    popularity: 88,
  },
  {
    id: 't3',
    name: '전력 요금 절감 분석',
    description: '현재 요금 구조 대비 절감 가능 금액과 최적 계약전력을 분석합니다.',
    category: 'cost',
    parameters: ['계약전력', '기간', '요금제'],
    estimatedTime: '약 45초',
    popularity: 92,
  },
  {
    id: 't4',
    name: '피크 부하 분석',
    description: '최대 수요 전력 발생 패턴과 피크 감소 전략을 제시합니다.',
    category: 'cost',
    parameters: ['기간', '목표 감소율'],
    estimatedTime: '약 40초',
    popularity: 78,
  },
  {
    id: 't5',
    name: '탄소 배출 현황 분석',
    description: 'Scope 1/2/3 탄소 배출량 분석 및 감축 목표 대비 진행률을 확인합니다.',
    category: 'carbon',
    parameters: ['기간', '배출 계수'],
    estimatedTime: '약 25초',
    popularity: 85,
  },
  {
    id: 't6',
    name: '탄소 중립 로드맵',
    description: '현재 배출량 기반 탄소 중립 달성 시나리오를 분석합니다.',
    category: 'carbon',
    parameters: ['목표 연도', '감축 전략'],
    estimatedTime: '약 60초',
    popularity: 70,
    isNew: true,
  },
  {
    id: 't7',
    name: '이상 패턴 탐지 리포트',
    description: 'AI 기반 에너지 사용 이상 패턴을 탐지하고 원인을 분석합니다.',
    category: 'anomaly',
    parameters: ['감도', '기간', '센서 그룹'],
    estimatedTime: '약 90초',
    popularity: 82,
  },
  {
    id: 't8',
    name: '설비 이상 진단',
    description: '설비별 에너지 소비 이상 징후를 진단하고 예방 조치를 제안합니다.',
    category: 'anomaly',
    parameters: ['설비 ID', '기간'],
    estimatedTime: '약 50초',
    popularity: 75,
    isNew: true,
  },
  {
    id: 't9',
    name: '전력 수요 예측',
    description: '과거 패턴 기반 향후 전력 수요를 예측합니다.',
    category: 'forecast',
    parameters: ['예측 기간', '모델'],
    estimatedTime: '약 120초',
    popularity: 90,
  },
  {
    id: 't10',
    name: '비용 예측 분석',
    description: '전력 수요 예측 기반 향후 전기 요금을 예측합니다.',
    category: 'forecast',
    parameters: ['예측 기간', '요금제', '계약전력'],
    estimatedTime: '약 90초',
    popularity: 80,
  },
];

export default function AnalysisTemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [runningTemplate, setRunningTemplate] = useState<string | null>(null);
  const [completedTemplates, setCompletedTemplates] = useState<Set<string>>(new Set());

  const filteredTemplates = TEMPLATES.filter((t) => {
    const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchSearch = !searchQuery || t.name.includes(searchQuery) || t.description.includes(searchQuery);
    return matchCategory && matchSearch;
  });

  const handleRun = (templateId: string) => {
    setRunningTemplate(templateId);
    setTimeout(() => {
      setRunningTemplate(null);
      setCompletedTemplates(prev => new Set(prev).add(templateId));
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileBarChart className="w-6 h-6 text-indigo-400" />
            </div>
            분석 템플릿
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            사전 정의된 분석 시나리오를 빠르게 실행하세요
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="템플릿 검색..."
            className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none w-64"
          />
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            selectedCategory === 'all'
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
          }`}
        >
          전체 ({TEMPLATES.length})
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const count = TEMPLATES.filter(t => t.category === key).length;
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedCategory === key
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 템플릿 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const catConfig = CATEGORY_CONFIG[template.category];
          const CatIcon = catConfig.icon;
          const isRunning = runningTemplate === template.id;
          const isCompleted = completedTemplates.has(template.id);

          return (
            <div
              key={template.id}
              className={`bg-slate-800/50 border rounded-xl p-5 transition-all hover:border-slate-600 ${
                isCompleted ? 'border-emerald-500/30' : 'border-slate-700/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${catConfig.bg}`}>
                    <CatIcon className={`w-5 h-5 ${catConfig.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{template.name}</h3>
                      {template.isNew && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">NEW</span>
                      )}
                    </div>
                    <span className={`text-xs ${catConfig.color}`}>{catConfig.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Star className="w-3 h-3 text-amber-400" />
                  {template.popularity}
                </div>
              </div>

              <p className="text-sm text-slate-400 mb-4">{template.description}</p>

              <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {template.estimatedTime}
                </div>
                <div>
                  파라미터: {template.parameters.join(', ')}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRun(template.id)}
                  disabled={isRunning}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  } disabled:opacity-50`}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      실행 중...
                    </>
                  ) : isCompleted ? (
                    <>
                      <Play className="w-4 h-4" />
                      다시 실행
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      실행
                    </>
                  )}
                </button>
                <button className="px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 transition">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <FileBarChart className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">검색 조건에 맞는 템플릿이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
