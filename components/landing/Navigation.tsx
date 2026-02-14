'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Zap,
  ChevronDown,
  Factory,
  Building2,
  Server,
  Warehouse,
  FileText,
  Code2,
  Users,
  Headphones,
  Menu,
  X,
} from 'lucide-react';

const SOLUTIONS = [
  { label: '제조업', href: '/solutions/manufacturing', icon: Factory, desc: '스마트 팩토리 에너지 관리' },
  { label: '빌딩', href: '/solutions/building', icon: Building2, desc: '빌딩 에너지 효율 최적화' },
  { label: '데이터센터', href: '/solutions/datacenter', icon: Server, desc: 'PUE 최적화 및 냉각 관리' },
  { label: '산업단지', href: '/solutions/industrial', icon: Warehouse, desc: '산업단지 통합 에너지 관리' },
];

const SUPPORT = [
  { label: '문서', href: '/docs', icon: FileText, desc: '시작 가이드 및 매뉴얼' },
  { label: 'API 문서', href: '/docs/api', icon: Code2, desc: 'REST API 레퍼런스' },
  { label: '커뮤니티', href: '/community', icon: Users, desc: '사용자 포럼 및 Q&A' },
  { label: '고객센터', href: '/support', icon: Headphones, desc: '기술 지원 및 문의' },
];

/**
 * 랜딩 페이지 네비게이션 (Client Component)
 *
 * 스크롤 감지로 배경 변경 + 드롭다운 메뉴 + 모바일 메뉴
 */
export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-900/95 backdrop-blur-lg shadow-lg border-b border-slate-700'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Zap className="w-8 h-8 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
            </div>
            <span className="font-bold text-xl text-white">
              Energy<span className="text-emerald-400">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1" ref={dropdownRef}>
            <Link
              href="/#features"
              className="px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              기능
            </Link>
            <Link
              href="/#metrics"
              className="px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              성과
            </Link>

            {/* 솔루션 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('solutions')}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
              >
                솔루션
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'solutions' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'solutions' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  {SOLUTIONS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenDropdown(null)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors"
                    >
                      <item.icon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 지원 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('support')}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
              >
                지원
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'support' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'support' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  {SUPPORT.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenDropdown(null)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors"
                    >
                      <item.icon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className="px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              가격
            </Link>
            <Link
              href="/faq"
              className="px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              FAQ
            </Link>
          </div>

          {/* CTA Buttons (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/demo" className="text-sm text-slate-300 hover:text-white transition-colors">
              데모 보기
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                로그인
              </Button>
            </Link>
            <Link href="/register?plan=trial">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                14일 무료 체험
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="메뉴"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-slate-300" />
            ) : (
              <Menu className="w-6 h-6 text-slate-300" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900/98 backdrop-blur-xl border-t border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              기능
            </Link>
            <Link
              href="/#metrics"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              성과
            </Link>

            {/* 솔루션 (모바일) */}
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">솔루션</p>
              <div className="space-y-1 pl-2">
                {SOLUTIONS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                  >
                    <item.icon className="w-4 h-4 text-emerald-400" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* 지원 (모바일) */}
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">지원</p>
              <div className="space-y-1 pl-2">
                {SUPPORT.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                  >
                    <item.icon className="w-4 h-4 text-emerald-400" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              가격
            </Link>
            <Link
              href="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              FAQ
            </Link>

            {/* CTA (모바일) */}
            <div className="border-t border-slate-700 pt-4 mt-4 space-y-2 px-4">
              <Link href="/demo" onClick={() => setMobileMenuOpen(false)} className="block">
                <Button variant="outline" size="sm" className="w-full">
                  데모 보기
                </Button>
              </Link>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block">
                <Button variant="outline" size="sm" className="w-full">
                  로그인
                </Button>
              </Link>
              <Link href="/register?plan=trial" onClick={() => setMobileMenuOpen(false)} className="block">
                <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600">
                  14일 무료 체험
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
