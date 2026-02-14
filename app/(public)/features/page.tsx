import { Features } from '@/components/landing/Features';

/**
 * 기능 소개 페이지
 */
export const metadata = {
  title: '기능 - EnergyAI',
  description:
    'AI 부하 예측(MAPE 8%), 이상 탐지(F1 0.92), 자동 최적화, 수요반응(DR), 탄소 추적까지. EnergyAI의 6대 핵심 에너지 관리 기능.',
  openGraph: {
    title: 'AI 에너지 관리 핵심 기능 - EnergyAI',
    description: '부하 예측, 이상 탐지, 에너지 최적화, DR, 탄소 추적, 보안 컴플라이언스',
  },
};

export default function FeaturesPage() {
  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 mb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          강력한 AI 기반 기능
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
          에너지 효율을 극대화하는 최첨단 기술
        </p>
      </div>
      <Features />
    </div>
  );
}
