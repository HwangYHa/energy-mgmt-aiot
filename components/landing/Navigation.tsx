'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Zap } from 'lucide-react';

/**
 * 랜딩 페이지 네비게이션 (Client Component)
 *
 * 스크롤 감지로 배경 변경 → Client Component 필수
 */
export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-slate-300 hover:text-white transition-colors"
            >
              기능
            </a>
            <a
              href="#metrics"
              className="text-slate-300 hover:text-white transition-colors"
            >
              성과
            </a>
            <Link
              href="/pricing"
              className="text-slate-300 hover:text-white transition-colors"
            >
              가격
            </Link>
            <Link
              href="/faq"
              className="text-slate-300 hover:text-white transition-colors"
            >
              FAQ
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm">
                로그인
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                무료 시작
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
