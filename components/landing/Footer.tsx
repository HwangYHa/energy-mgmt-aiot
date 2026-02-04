import Link from 'next/link';
import { Zap } from 'lucide-react';
import { FOOTER_LINKS } from '@/lib/constants/landing-content';

/**
 * 푸터 (Server Component)
 */
export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-8 h-8 text-emerald-400" />
              <span className="font-bold text-xl text-white">
                Energy<span className="text-emerald-400">AI</span>
              </span>
            </div>
            <p className="text-slate-400 mb-4 leading-relaxed">
              AI 기반 에너지 관리 플랫폼으로 에너지 효율을 극대화하고 비용을
              절감하세요.
            </p>
            <div className="flex gap-4">
              {FOOTER_LINKS.social.map((social) => (
                <a
                  key={social.platform}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.ariaLabel}
                  className="text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  {social.platform === 'facebook' ? (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="font-semibold text-white mb-4">제품</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              {FOOTER_LINKS.products.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-emerald-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="font-semibold text-white mb-4">솔루션</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              {FOOTER_LINKS.solutions.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-emerald-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-white mb-4">지원</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-emerald-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            © 2026 EnergyAI Platform. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            {FOOTER_LINKS.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-emerald-400 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
