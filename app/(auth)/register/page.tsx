'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { AuthButton } from '@/components/auth/AuthButton';
import { SocialButton } from '@/components/auth/SocialButton';
import { fetchWithCsrf } from '@/hooks/use-csrf';
import { LegalModal } from '@/components/landing/LegalModal';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    industryType: 'manufacturing',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // 필드 변경 시 해당 필드의 에러 제거
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.';
    }

    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다.';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(formData.password)) {
      newErrors.password = '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다.';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      // ✅ CSRF 토큰을 포함한 요청
      const res = await fetchWithCsrf('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          organizationName: formData.organizationName || undefined,
          industryType: formData.industryType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        
        // ✅ 상세한 에러 메시지 처리
        if (data.details && Array.isArray(data.details)) {
          const fieldErrors: Record<string, string> = {};
          data.details.forEach((detail: { path: string; message: string }) => {
            fieldErrors[detail.path] = detail.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ submit: data.error || '회원가입에 실패했습니다.' });
        }
        return;
      }

      // ✅ 성공 시 로그인 페이지로 리다이렉트
      router.push('/login?registered=true');
    } catch (err) {
      setErrors({ submit: '요청 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'naver') => {
    try {
      if (provider === 'google') {
        await signIn('google', {
          callbackUrl: '/dashboard',
          redirect: true,
        });
      } else if (provider === 'naver') {
        // Naver는 별도 엔드포인트 사용
        window.location.href = '/api/auth/oauth/naver';
      }
    } catch (err) {
      setErrors({ submit: `${provider === 'google' ? '구글' : '네이버'} 로그인에 실패했습니다.` });
    }
  };

  return (
    <AuthBackground>
      <AuthCard
        title="계정 생성"
        subtitle="에너지 관리 시스템을 시작하세요"
      >
        {errors.submit && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthInput
            id="name"
            label="이름"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="홍길동"
            required
            error={errors.name}
            autoComplete="name"
          />

          <AuthInput
            id="organizationName"
            label="회사/조직명"
            type="text"
            name="organizationName"
            value={formData.organizationName}
            onChange={handleChange}
            placeholder="ABC 에너지 (선택사항)"
            error={errors.organizationName}
            autoComplete="organization"
          />

          <div>
            <label htmlFor="industryType" className="block text-sm font-medium text-gray-300 mb-1.5">
              산업 분류
            </label>
            <select
              id="industryType"
              name="industryType"
              value={formData.industryType}
              onChange={(e) => setFormData((prev) => ({ ...prev, industryType: e.target.value }))}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/30 transition-all"
            >
              <option value="manufacturing">제조업</option>
              <option value="building">빌딩/건물</option>
              <option value="industrial_complex">산업단지</option>
              <option value="datacenter">데이터센터</option>
              <option value="other">기타</option>
            </select>
          </div>

          <AuthInput
            id="email"
            label="이메일"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="user@company.com"
            required
            error={errors.email}
            autoComplete="email"
          />

          <AuthInput
            id="password"
            label="비밀번호"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            error={errors.password}
            showPasswordToggle
            autoComplete="new-password"
          />

          <AuthInput
            id="confirmPassword"
            label="비밀번호 확인"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            required
            error={errors.confirmPassword}
            showPasswordToggle
            autoComplete="new-password"
          />

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="terms"
              required
              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue/50"
            />
            <label htmlFor="terms" className="text-sm text-gray-400">
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-neon-blue hover:underline"
              >
                이용약관
              </button>
              과{' '}
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-neon-blue hover:underline"
              >
                개인정보처리방침
              </button>
              에 동의합니다.
            </label>
          </div>

          <AuthButton type="submit" loading={loading} glow="purple">
            계정 생성
          </AuthButton>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-dark-card text-gray-400">OR</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <SocialButton
              onClick={() => handleSocialLogin('google')}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              }
            >
              구글로 회원가입
            </SocialButton>
            <SocialButton
              onClick={() => handleSocialLogin('naver')}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z" />
                </svg>
              }
            >
              네이버로 회원가입
            </SocialButton>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            이미 계정이 있으신가요?{' '}
            <Link
              href="/login"
              className="text-neon-green hover:text-neon-cyan font-medium transition-colors"
            >
              로그인
            </Link>
          </p>
        </div>
      </AuthCard>

      {legalModal && (
        <LegalModal
          type={legalModal}
          isOpen={true}
          onClose={() => setLegalModal(null)}
        />
      )}
    </AuthBackground>
  );
}