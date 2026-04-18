import { Metadata } from 'next';
import DigitalTwinComingSoon from './DigitalTwinComingSoon';

/**
 * 디지털 트윈 페이지
 * 현재 개발 중 — Coming Soon 안내
 */
export const metadata: Metadata = {
  title: '디지털 트윈 | 탄소이음',
  description: '시설 디지털 트윈 — 개발 중',
};

export default function DigitalTwinPage() {
  return <DigitalTwinComingSoon />;
}
