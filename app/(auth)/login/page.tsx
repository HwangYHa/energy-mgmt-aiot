'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { AuthButton } from '@/components/auth/AuthButton';
import { SocialButton } from '@/components/auth/SocialButton';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  const registered = searchParams.get('registered') === 'true';
  const urlError = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(urlError || '');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // 저장된 이메일 복원
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('ems_remember_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }, []);

  // 세션 확인 - 이미 로그인된 경우 대시보드로
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // URL 에러 메시지 처리
  useEffect(() => {
    if (urlError) {
      const errorMessages: Record<string, string> = {
        OAuthSignin: '소셜 로그인 초기화에 실패했습니다.',
        OAuthCallback: '소셜 로그인 콜백 처리에 실패했습니다.',
        OAuthCreateAccount: '소셜 계정 생성에 실패했습니다.',
        EmailCreateAccount: '이메일 계정 생성에 실패했습니다.',
        Callback: '로그인 처리 중 오류가 발생했습니다.',
        OAuthAccountNotLinked: '이미 다른 방법으로 가입된 이메일입니다.',
        SessionRequired: '로그인이 필요합니다.',
        CredentialsSignin: '이메일 또는 비밀번호가 올바르지 않습니다.',
        Default: '로그인 중 오류가 발생했습니다.',
      };
      setError((errorMessages[urlError] || errorMessages.Default) as string);
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError('');
    setLoading(true);

    try {
      // NextAuth를 사용한 로그인
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false, // 수동 리디렉션 처리
      });

      if (result?.error) {
        // 에러 메시지 매핑
        const errorMessages: Record<string, string> = {
          'CredentialsSignin': '이메일 또는 비밀번호가 올바르지 않습니다.',
          'User not found': '등록되지 않은 이메일입니다.',
          'Invalid password': '비밀번호가 올바르지 않습니다.',
          'OAuth-only account': '이 계정은 소셜 로그인 전용입니다.',
          'Account is locked': '계정이 잠겼습니다. 나중에 다시 시도하세요.',
          'User account is inactive': '비활성화된 계정입니다.',
        };
        
        setError(errorMessages[result.error] || '로그인에 실패했습니다.');
        setLoading(false);
        return;
      }

      if (result?.ok) {
        // 로그인 정보 저장 처리
        try {
          if (rememberMe) {
            localStorage.setItem('ems_remember_email', email);
          } else {
            localStorage.removeItem('ems_remember_email');
          }
        } catch {
          // localStorage 접근 불가 시 무시
        }

        // 성공 시 콜백 URL로 리디렉션
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError('로그인에 실패했습니다.');
        setLoading(false);
      }
    } catch {
      setError('요청 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'naver') => {
    try {
      setSocialLoading(provider);
      setError('');

      if (provider === 'google') {
        // Google OAuth 로그인
        await signIn('google', {
          callbackUrl,
          redirect: true, // 자동 리디렉션
        });
      } else if (provider === 'naver') {
        // Naver는 별도 엔드포인트 사용
        window.location.href = `/api/auth/oauth/naver?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }
    } catch {
      setError(`${provider === 'google' ? '구글' : '네이버'} 로그인에 실패했습니다.`);
      setSocialLoading(null);
    }
  };

  return (
    <AuthBackground>
      <AuthCard
        title="환영합니다"
        subtitle="계정에 로그인하세요"
      >
        {registered && (
          <div className="mb-6 p-4 bg-neon-green/10 border border-neon-green/30 rounded-xl text-neon-green text-sm text-center animate-in fade-in slide-in-from-top-1">
            회원가입이 완료되었습니다. 로그인해주세요.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <AuthInput
              id="email"
              label="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              autoComplete="email"
              disabled={loading || socialLoading !== null}
            />
            {email && !loading && (
              <button
                type="button"
                onClick={() => {
                  setEmail('');
                  setError('');
                }}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-white transition-colors"
                aria-label="이메일 지우기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <AuthInput
            id="password"
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            showPasswordToggle
            autoComplete="current-password"
            disabled={loading || socialLoading !== null}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-neon-blue focus:ring-neon-blue/50"
                disabled={loading || socialLoading !== null}
              />
              <span>로그인 정보 저장</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-neon-blue hover:text-neon-cyan transition-colors"
            >
              비밀번호를 잊으셨나요?
            </Link>
          </div>

          <AuthButton 
            type="submit" 
            loading={loading} 
            disabled={socialLoading !== null || !email || !password}
            glow="blue"
          >
            {loading ? '로그인 중...' : '로그인'}
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
              disabled={loading || socialLoading !== null}
              loading={socialLoading === 'google'}
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
              {socialLoading === 'google' ? '구글 로그인 중...' : '구글로 로그인'}
            </SocialButton>
            <SocialButton
              onClick={() => handleSocialLogin('naver')}
              disabled={loading || socialLoading !== null}
              loading={socialLoading === 'naver'}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z" />
                </svg>
              }
            >
              {socialLoading === 'naver' ? '네이버 로그인 중...' : '네이버로 로그인'}
            </SocialButton>
          </div>
        </div>

        {/* 데모 체험 */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-dark-card text-gray-500">데모 체험</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail('demo@carbonieum.com');
              setPassword('Demo1234!');
              setError('');
            }}
            disabled={loading || socialLoading !== null}
            className="mt-4 w-full py-2.5 px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 hover:border-amber-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            데모 계정으로 체험하기
          </button>
          <p className="mt-2 text-center text-[11px] text-gray-600">
            demo@carbonieum.com · 모든 기능 체험 가능 (Enterprise 플랜)
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            계정이 없으신가요?{' '}
            <Link
              href="/register"
              className="text-neon-green hover:text-neon-cyan font-medium transition-colors"
            >
              회원가입
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthBackground>
        <AuthCard title="로딩 중..." subtitle="잠시만 기다려주세요">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
          </div>
        </AuthCard>
      </AuthBackground>
    }>
      <LoginPageContent />
    </Suspense>
  );
}