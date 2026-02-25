'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Shield, FileText, Lock, Eye, Server, CheckCircle,
  ArrowUp, Mail, Phone, MapPin, AlertTriangle, Info,
  ChevronDown, ChevronRight,
} from 'lucide-react';

type LegalType = 'privacy' | 'terms' | 'security';

interface LegalModalProps {
  type: LegalType;
  isOpen: boolean;
  onClose: () => void;
}

// ─── 탭 정의 ────────────────────────────────────────────────────────
const TABS = [
  { id: 'privacy'  as LegalType, label: '개인정보처리방침', short: '개인정보', icon: Shield,   accent: 'blue'    },
  { id: 'terms'    as LegalType, label: '이용약관',         short: '이용약관', icon: FileText,  accent: 'emerald' },
  { id: 'security' as LegalType, label: '보안정책',         short: '보안',     icon: Lock,      accent: 'green'   },
] as const;

// ─── TOC 정의 ───────────────────────────────────────────────────────
const TOC: Record<LegalType, { id: string; label: string; no: number }[]> = {
  privacy: [
    { id: 'p1', label: '수집하는 개인정보',  no: 1 },
    { id: 'p2', label: '이용 목적',          no: 2 },
    { id: 'p3', label: '보유 기간',          no: 3 },
    { id: 'p4', label: '제3자 제공',         no: 4 },
    { id: 'p5', label: '정보주체의 권리',    no: 5 },
    { id: 'p6', label: '보안 조치',          no: 6 },
    { id: 'p7', label: '문의',               no: 7 },
  ],
  terms: [
    { id: 't1', label: '서비스 이용',        no: 1 },
    { id: 't2', label: '요금 및 결제',       no: 2 },
    { id: 't3', label: '지적 재산권',        no: 3 },
    { id: 't4', label: '금지 행위',          no: 4 },
    { id: 't5', label: '서비스 중단 및 해지',no: 5 },
    { id: 't6', label: '면책 조항',          no: 6 },
    { id: 't7', label: '약관 변경',          no: 7 },
    { id: 't8', label: '준거법 및 관할',     no: 8 },
    { id: 't9', label: '문의',               no: 9 },
  ],
  security: [
    { id: 's1', label: '데이터 암호화',         no: 1 },
    { id: 's2', label: '접근 제어',             no: 2 },
    { id: 's3', label: '인프라 보안',           no: 3 },
    { id: 's4', label: '규정 준수',             no: 4 },
    { id: 's5', label: '데이터 보호 체계',      no: 5 },
    { id: 's6', label: '인증 및 컴플라이언스',  no: 6 },
    { id: 's7', label: '취약점 신고',           no: 7 },
  ],
};

// ─── 공통 섹션 헤더 ─────────────────────────────────────────────────
function SectionTitle({ id, no, title, color = 'cyan' }: {
  id: string; no: number; title: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  };
  const cls = colorMap[color] ?? colorMap.cyan;
  return (
    <h3 id={id} className="flex items-center gap-3 text-base font-bold text-white mb-4 pt-2 scroll-mt-4">
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold border ${cls}`}>
        {no}
      </span>
      {title}
    </h3>
  );
}

function Callout({ type, children }: {
  type: 'info' | 'warning' | 'success'; children: React.ReactNode
}) {
  const styles = {
    info:    { cls: 'bg-blue-500/10 border-blue-500/30 text-blue-300', Icon: Info },
    warning: { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300', Icon: AlertTriangle },
    success: { cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', Icon: CheckCircle },
  }[type];
  return (
    <div className={`flex gap-3 p-3 rounded-lg border text-sm mb-4 ${styles.cls}`}>
      <styles.Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ContactBlock() {
  return (
    <div className="grid sm:grid-cols-3 gap-3 mt-3">
      {[
        { icon: Mail,    label: '이메일', value: 'support@carboneum.kr', href: 'mailto:support@carboneum.kr' },
        { icon: Phone,   label: '전화',   value: '1588-1234',            href: 'tel:15881234' },
        { icon: MapPin,  label: '주소',   value: '서울특별시 강남구 테헤란로 123', href: undefined },
      ].map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="flex items-start gap-2.5 p-3 bg-slate-800 rounded-lg border border-slate-700">
          <Icon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">{label}</p>
            {href ? (
              <a href={href} className="text-sm text-cyan-400 hover:text-cyan-300 transition break-all">{value}</a>
            ) : (
              <p className="text-sm text-slate-300 break-all">{value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 개인정보처리방침 ────────────────────────────────────────────────
function PrivacyContent() {
  return (
    <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
      <Callout type="info">
        본 방침은 <strong>탄소이음</strong>이 이용자의 개인정보를 어떻게 수집·이용·보호하는지 안내합니다.
        최종 업데이트: <span className="text-white font-medium">2026년 2월 3일</span>
      </Callout>

      <section>
        <SectionTitle id="p1" no={1} title="수집하는 개인정보" color="blue" />
        <p className="text-slate-400 mb-3">탄소이음은 서비스 제공을 위해 아래 정보를 수집합니다.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: '필수 정보', items: ['이메일 주소', '이름', '회사명'], color: 'red' },
            { title: '선택 정보', items: ['전화번호', '부서·직책', '프로필 이미지'], color: 'slate' },
            { title: '자동 수집', items: ['IP 주소', '쿠키·세션 정보', '접속 로그'], color: 'amber' },
            { title: '서비스 데이터', items: ['사이트·디바이스 에너지 사용량', 'IoT 센서 측정값'], color: 'cyan' },
          ].map(({ title, items, color }) => (
            <div key={title} className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg">
              <p className={`text-xs font-semibold mb-2 text-${color}-400`}>{title}</p>
              <ul className="space-y-1">
                {items.map(i => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full bg-${color}-400 flex-shrink-0`} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle id="p2" no={2} title="개인정보 이용 목적" color="blue" />
        <BulletList items={[
          '서비스 제공 및 운영 (에너지 데이터 분석, AI 예측)',
          '회원 관리 및 본인 확인',
          '고객 지원 및 문의 응대',
          '서비스 개선 및 신규 서비스 개발',
          '법령 및 규정 준수',
        ]} />
      </section>

      <section>
        <SectionTitle id="p3" no={3} title="개인정보 보유 기간" color="blue" />
        <p className="text-slate-400 mb-3">회원 탈퇴 시까지 보유하며, 법령에 따라 일정 기간 추가 보관합니다.</p>
        <div className="space-y-2">
          {[
            { label: '계약·청약 철회 기록', period: '5년', law: '전자상거래법' },
            { label: '대금결제·재화 공급 기록', period: '5년', law: '전자상거래법' },
            { label: '소비자 불만·분쟁처리 기록', period: '3년', law: '전자상거래법' },
            { label: '로그인 기록', period: '3개월', law: '통신비밀보호법' },
          ].map(({ label, period, law }) => (
            <div key={label} className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-300">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{law}</span>
                <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{period}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle id="p4" no={4} title="제3자 제공" color="blue" />
        <Callout type="warning">
          원칙적으로 제3자에게 개인정보를 제공하지 않습니다. 다만, 아래 예외가 적용됩니다.
        </Callout>
        <BulletList items={[
          '사용자가 사전 동의한 경우',
          '법령에 의거하거나 수사 목적으로 요구된 경우',
          '결제 처리를 위한 PG사 제공 (아임포트, Stripe)',
        ]} />
      </section>

      <section>
        <SectionTitle id="p5" no={5} title="정보주체의 권리" color="blue" />
        <p className="text-slate-400 mb-3">귀하는 언제든지 아래 권리를 행사할 수 있습니다.</p>
        <div className="grid grid-cols-2 gap-2">
          {['개인정보 열람 요구', '개인정보 정정 요구', '개인정보 삭제 요구', '처리 정지 요구'].map(r => (
            <div key={r} className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-slate-300">{r}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          설정 페이지 또는 <a href="mailto:support@carboneum.kr" className="text-cyan-400 hover:underline">support@carboneum.kr</a>로 요청하세요.
        </p>
      </section>

      <section>
        <SectionTitle id="p6" no={6} title="보안 조치" color="blue" />
        <BulletList items={[
          '데이터 전송·저장 암호화 (TLS 1.3 / AES-256)',
          '역할 기반 접근 제어 (RBAC)',
          '정기 보안 감사 및 취약점 점검',
          '침입 탐지 시스템 (IDS) 운영',
        ]} />
      </section>

      <section>
        <SectionTitle id="p7" no={7} title="문의" color="blue" />
        <p className="text-slate-400 mb-2">개인정보 관련 문의사항은 아래 채널로 연락해 주세요.</p>
        <ContactBlock />
      </section>
    </div>
  );
}

// ─── 이용약관 ────────────────────────────────────────────────────────
function TermsContent() {
  return (
    <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
      <Callout type="info">
        탄소이음 서비스를 이용함으로써 귀하는 본 약관에 동의합니다.
        최종 업데이트: <span className="text-white font-medium">2026년 2월 3일</span>
      </Callout>

      <section>
        <SectionTitle id="t1" no={1} title="서비스 이용" color="emerald" />
        <BulletList items={[
          '서비스는 만 14세 이상 법인 또는 개인이 이용할 수 있습니다',
          '정확한 회원 정보를 제공하고 변경 시 즉시 수정해야 합니다',
          '계정 정보(아이디·비밀번호)는 안전하게 관리해야 합니다',
          '타인의 계정을 무단으로 사용할 수 없습니다',
        ]} />
      </section>

      <section>
        <SectionTitle id="t2" no={2} title="요금 및 결제" color="emerald" />
        <div className="space-y-2 mb-4">
          {[
            { label: '결제 방식', value: '신용카드, 계좌이체, 세금계산서 발행 가능' },
            { label: '청구 주기', value: '월간(선불) 또는 연간(선불, 최대 20% 할인)' },
            { label: '자동 갱신', value: '구독 만료 전 자동 갱신 (이메일 사전 안내)' },
            { label: '환불 정책', value: '최초 결제 후 7일 이내 미사용 시 전액 환불' },
            { label: '플랜 변경', value: '업그레이드 즉시 적용, 차액 일할 계산' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start gap-3 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700 text-xs">
              <span className="text-emerald-400 font-medium w-20 flex-shrink-0">{label}</span>
              <span className="text-slate-300">{value}</span>
            </div>
          ))}
        </div>
        <Callout type="success">
          연간 구독 시 최대 <strong>20% 할인</strong>이 적용됩니다.
        </Callout>
      </section>

      <section>
        <SectionTitle id="t3" no={3} title="지적 재산권" color="emerald" />
        <p className="text-slate-400 mb-3">서비스의 모든 콘텐츠·기술·디자인은 회사의 지적 재산입니다.</p>
        <BulletList items={[
          'AI 알고리즘 및 예측 모델',
          '대시보드 UI/UX 디자인 및 소스 코드',
          '문서, 튜토리얼 및 교육 자료',
          '탄소이음 로고 및 브랜드 요소',
        ]} />
        <Callout type="success">
          귀하의 <strong>에너지 데이터</strong>는 귀하의 소유이며, 서비스 해지 시 데이터 내보내기를 제공합니다.
        </Callout>
      </section>

      <section>
        <SectionTitle id="t4" no={4} title="금지 행위" color="emerald" />
        <Callout type="warning">
          아래 행위는 약관 위반으로 즉시 서비스 해지 및 법적 조치가 취해질 수 있습니다.
        </Callout>
        <BulletList items={[
          '서비스의 역설계, 복제, 수정 또는 재배포',
          '해킹, DDoS 공격 등 불법 사이버 공격',
          '타인의 계정 또는 데이터 무단 접근',
          '스팸 발송, 악성 코드 유포',
          '서비스에 과도한 부하를 유발하는 크롤링·스크래핑',
        ]} />
      </section>

      <section>
        <SectionTitle id="t5" no={5} title="서비스 중단 및 해지" color="emerald" />
        <p className="text-slate-400 mb-3">회사는 다음의 경우 사전 통보 후 서비스를 중단하거나 계정을 해지할 수 있습니다.</p>
        <BulletList items={[
          '약관 위반 또는 금지 행위 적발',
          '결제 실패가 30일 이상 지속되는 경우',
          '사기 의심 또는 부정 사용 감지',
          '1년 이상 장기 미사용 계정 (30일 전 사전 안내)',
          '법령에 의한 서비스 제공 불가',
        ]} />
        <Callout type="info">
          귀하는 언제든지 설정 페이지에서 계정을 삭제하고 데이터를 내보낼 수 있습니다.
        </Callout>
      </section>

      <section>
        <SectionTitle id="t6" no={6} title="면책 조항" color="emerald" />
        <BulletList items={[
          'AI 예측의 정확도는 참고용이며 투자·경영 결정의 보장이 아닙니다',
          '제3자 통합 서비스(한국전력 API 등)의 장애에 대해 책임지지 않습니다',
          '천재지변, 통신망 장애 등 불가항력으로 인한 서비스 중단',
          '사용자 부주의로 인한 데이터 손실 (정기 백업 권장)',
        ]} />
      </section>

      <section>
        <SectionTitle id="t7" no={7} title="약관 변경" color="emerald" />
        <p className="mb-3">회사는 필요 시 약관을 변경할 수 있으며, 변경 사항은 시행 <strong className="text-white">7일 전</strong>에 이메일 및 서비스 내 공지로 안내합니다.</p>
        <Callout type="warning">
          변경 후 서비스를 계속 이용하시면 변경된 약관에 동의한 것으로 간주됩니다.
        </Callout>
      </section>

      <section>
        <SectionTitle id="t8" no={8} title="준거법 및 관할" color="emerald" />
        <p>본 약관은 <strong className="text-white">대한민국 법률</strong>에 따라 해석되며, 분쟁 발생 시 <strong className="text-white">서울중앙지방법원</strong>을 합의 관할 법원으로 합니다.</p>
      </section>

      <section>
        <SectionTitle id="t9" no={9} title="문의" color="emerald" />
        <p className="text-slate-400 mb-2">약관 관련 문의사항은 아래 채널로 연락해 주세요.</p>
        <ContactBlock />
      </section>
    </div>
  );
}

// ─── 보안 정책 ───────────────────────────────────────────────────────
function SecurityContent() {
  const shields = [
    {
      id: 's1', icon: Lock, title: '데이터 암호화', color: 'green',
      desc: '전송 중·저장 중 데이터를 최신 암호화 표준으로 보호합니다.',
      items: ['전송 암호화: HTTPS / TLS 1.3', '저장 암호화: AES-256-GCM', '키 관리: AWS KMS 전용 키'],
    },
    {
      id: 's2', icon: Eye, title: '접근 제어', color: 'blue',
      desc: '역할 기반 최소 권한 원칙으로 데이터 접근을 제한합니다.',
      items: ['RBAC: viewer → super_admin 5단계', '2단계 인증(2FA) 지원', 'IP 화이트리스트 설정 가능'],
    },
    {
      id: 's3', icon: Server, title: '인프라 보안', color: 'purple',
      desc: '엔터프라이즈급 클라우드 인프라와 24/7 보안 모니터링.',
      items: ['AWS/GCP 엔터프라이즈 인프라 (VPC 격리)', 'DDoS 방어 (Cloudflare WAF)', '24/7 SIEM 보안 모니터링'],
    },
    {
      id: 's4', icon: Shield, title: '규정 준수', color: 'emerald',
      desc: '국제 보안 표준 및 국내 규정을 준수합니다.',
      items: ['ISO 27001 인증', 'SOC 2 Type II', 'GDPR · K-ISMS 준수'],
    },
  ] as const;

  const colorMap: Record<string, string> = {
    green:   'text-green-400 bg-green-500/10 border-green-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
      <Callout type="success">
        탄소이음은 엔터프라이즈 수준의 보안으로 고객 데이터를 보호합니다.
      </Callout>

      <div className="grid sm:grid-cols-2 gap-4">
        {shields.map(({ id, icon: Icon, title, color, desc, items }) => (
          <div key={id} id={id} className="scroll-mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${colorMap[color]}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-bold text-white text-sm">{title}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">{desc}</p>
            <ul className="space-y-1.5">
              {items.map(item => (
                <li key={item} className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section>
        <SectionTitle id="s5" no={5} title="데이터 보호 체계" color="green" />
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: '데이터 백업', icon: '💾', items: ['일일 자동 백업', '30일 버전 보관', '지역별 다중 복제', '즉시 복구 지원'] },
            { title: '재해 복구',   icon: '⚡', items: ['RPO: 1시간', 'RTO: 4시간', '다중 리전 배포', '자동 페일오버'] },
            { title: '감사 로그',   icon: '📋', items: ['모든 API 호출 기록', '데이터 접근 이력', '관리자 활동 추적', '최소 90일 보관'] },
          ].map(({ title, icon, items }) => (
            <div key={title} className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{icon}</span>
                <h4 className="font-semibold text-white text-sm">{title}</h4>
              </div>
              <ul className="space-y-1.5">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle id="s6" no={6} title="인증 및 컴플라이언스" color="green" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'ISO 27001',   desc: '정보보안 관리',        flag: '🌐' },
            { name: 'SOC 2 Type II', desc: '서비스 조직 통제',   flag: '🛡' },
            { name: 'GDPR',        desc: '개인정보 보호 (EU)',   flag: '🇪🇺' },
            { name: 'K-ISMS',      desc: '국내 정보보호 인증',   flag: '🇰🇷' },
          ].map(cert => (
            <div key={cert.name} className="text-center p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
              <div className="text-2xl mb-2">{cert.flag}</div>
              <div className="font-semibold text-white text-xs mb-1">{cert.name}</div>
              <div className="text-xs text-slate-400">{cert.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle id="s7" no={7} title="취약점 신고 (Bug Bounty)" color="green" />
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-400 font-semibold text-sm mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />책임감 있는 취약점 공개 정책
          </p>
          <p className="text-sm text-slate-300 mb-3">
            서비스 보안 취약점을 발견하셨다면 즉시 신고해 주세요. 유효한 취약점에 대해 리워드를 제공합니다.
          </p>
          <div className="grid sm:grid-cols-3 gap-2 mb-3">
            {[
              { level: 'Critical', reward: '최대 $10,000', color: 'red' },
              { level: 'High',     reward: '최대 $3,000',  color: 'orange' },
              { level: 'Medium',   reward: '최대 $500',    color: 'yellow' },
            ].map(({ level, reward, color }) => (
              <div key={level} className={`p-2.5 rounded-lg bg-${color}-500/10 border border-${color}-500/30 text-center`}>
                <p className={`text-xs font-bold text-${color}-400`}>{level}</p>
                <p className="text-xs text-slate-300 mt-0.5">{reward}</p>
              </div>
            ))}
          </div>
          <a
            href="mailto:security@carboneum.kr"
            className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition font-medium"
          >
            <Mail className="w-4 h-4" />security@carboneum.kr
          </a>
        </div>
      </section>
    </div>
  );
}

// ─── 메인 모달 ──────────────────────────────────────────────────────
export function LegalModal({ type, isOpen, onClose }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalType>(type);
  const [activeSection, setActiveSection] = useState<string>('');
  const [showBackTop, setShowBackTop] = useState(false);
  const [tocOpen, setTocOpen] = useState(false); // mobile TOC
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // type prop 변경 시 탭 동기화
  useEffect(() => { setActiveTab(type); }, [type]);

  // 탭 변경 시 스크롤 초기화
  const handleTabChange = useCallback((t: LegalType) => {
    setActiveTab(t);
    setActiveSection('');
    setTocOpen(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  // Intersection Observer로 현재 섹션 추적
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    observerRef.current?.disconnect();

    const toc = TOC[activeTab];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { root: contentRef.current, rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    const timeout = setTimeout(() => {
      toc.forEach(({ id }) => {
        const el = contentRef.current?.querySelector(`#${id}`);
        if (el) observer.observe(el);
      });
    }, 100);

    observerRef.current = observer;
    return () => { clearTimeout(timeout); observer.disconnect(); };
  }, [isOpen, activeTab]);

  // 스크롤 시 Back-to-top 표시
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = () => setShowBackTop(el.scrollTop > 200);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // body 스크롤 잠금
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = 'hidden'; }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const scrollToSection = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
    setTocOpen(false);
  }, []);

  const scrollToTop = useCallback(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  if (!isOpen) return null;

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const toc = TOC[activeTab];

  const accentMap: Record<string, string> = {
    blue: 'border-blue-500 text-blue-400 bg-blue-500/10',
    emerald: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
    green: 'border-green-500 text-green-400 bg-green-500/10',
  };
  const activeAccent = accentMap[currentTab.accent];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* ── 헤더 ── */}
        <div className="flex-shrink-0 border-b border-slate-700">
          {/* 탭 바 */}
          <div className="flex items-center gap-1 px-4 pt-4 pb-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-t-lg text-xs sm:text-sm font-medium transition-all border-b-2 -mb-px ${
                    isActive
                      ? `${accentMap[tab.accent]} border-b-current`
                      : 'text-slate-500 hover:text-slate-300 border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span>
                </button>
              );
            })}
            <button
              onClick={onClose}
              className="ml-auto p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white flex-shrink-0"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 본문 영역 (TOC + 콘텐츠) ── */}
        <div className="flex flex-1 min-h-0">

          {/* 사이드바 TOC (데스크탑) */}
          <aside className="hidden lg:flex flex-col w-52 flex-shrink-0 border-r border-slate-700/60 bg-slate-900/50">
            <div className="p-3 border-b border-slate-700/60">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">목차</p>
            </div>
            <nav className="overflow-y-auto flex-1 p-2">
              {toc.map(({ id, label, no }) => {
                const isActive = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all text-xs group ${
                      isActive
                        ? `${activeAccent} font-semibold`
                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-current/20' : 'bg-slate-800 group-hover:bg-slate-700'
                    }`}>
                      {no}
                    </span>
                    <span className="leading-tight">{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* 모바일 TOC 드롭다운 */}
          <div className="lg:hidden absolute top-[108px] left-4 right-14 z-10">
            <button
              onClick={() => setTocOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-300 font-medium shadow"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {toc.find(t => t.id === activeSection)?.label ?? '목차 보기'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${tocOpen ? 'rotate-180' : ''}`} />
            </button>
            {tocOpen && (
              <div className="mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl overflow-hidden">
                {toc.map(({ id, label, no }) => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs border-b border-slate-700 last:border-0 transition ${
                      activeSection === id ? `${activeAccent} font-semibold` : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-5 h-5 rounded bg-slate-700 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">{no}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 콘텐츠 */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto p-5 sm:p-6 relative scroll-smooth"
          >
            {/* 모바일 TOC용 여백 */}
            <div className="lg:hidden h-10 mb-2" />

            {activeTab === 'privacy'  && <PrivacyContent />}
            {activeTab === 'terms'    && <TermsContent />}
            {activeTab === 'security' && <SecurityContent />}

            {/* Back to top */}
            {showBackTop && (
              <button
                onClick={scrollToTop}
                className="fixed bottom-20 right-6 sm:right-8 w-9 h-9 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-full flex items-center justify-center shadow-lg transition z-20"
                aria-label="맨 위로"
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 flex-shrink-0 bg-slate-900/80">
          <p className="text-xs text-slate-500">
            최종 업데이트: 2026년 2월 3일 · 탄소이음
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white font-medium transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 푸터 링크 컴포넌트 ──────────────────────────────────────────────
export function FooterLegalLinks() {
  const [modalType, setModalType] = useState<LegalType | null>(null);

  const items: { label: string; type: LegalType }[] = [
    { label: '개인정보처리방침', type: 'privacy'  },
    { label: '이용약관',         type: 'terms'    },
    { label: '보안정책',         type: 'security' },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-4 sm:gap-6 text-sm text-slate-400">
        {items.map(item => (
          <button
            key={item.type}
            onClick={() => setModalType(item.type)}
            className="hover:text-emerald-400 transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>
      {modalType && (
        <LegalModal
          type={modalType}
          isOpen={true}
          onClose={() => setModalType(null)}
        />
      )}
    </>
  );
}
