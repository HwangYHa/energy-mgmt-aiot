import { Features } from '@/components/landing/Features';

/**
 * 기능 소개 페이지
 */
export const metadata = {
  title: '기능 - EnergyAI',
  description: 'EnergyAI의 강력한 AI 기반 에너지 관리 기능을 확인하세요.',
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
