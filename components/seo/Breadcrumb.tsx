/**
 * components/seo/Breadcrumb.tsx
 *
 * 시각적 브레드크럼 네비게이션 + SEO 접근성 (aria-label, itemscope)
 * JSON-LD는 각 페이지의 서버 컴포넌트에서 별도 주입
 */

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;  // 마지막 항목은 href 없음
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      className={`flex items-center gap-1 text-xs text-slate-500 ${className}`}
    >
      <ol
        className="flex items-center gap-1 flex-wrap"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {/* 홈 */}
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center gap-1"
        >
          <Link
            href="/"
            itemProp="item"
            className="hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <Home className="w-3 h-3" />
            <span itemProp="name" className="sr-only">홈</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>

        {items.map((item, index) => (
          <li
            key={index}
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="flex items-center gap-1"
          >
            <ChevronRight className="w-3 h-3 text-slate-600" />
            {item.href ? (
              <Link
                href={item.href}
                itemProp="item"
                className="hover:text-slate-300 transition-colors"
              >
                <span itemProp="name">{item.label}</span>
              </Link>
            ) : (
              <span itemProp="name" className="text-slate-400 truncate max-w-[180px]">
                {item.label}
              </span>
            )}
            <meta itemProp="position" content={String(index + 2)} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
