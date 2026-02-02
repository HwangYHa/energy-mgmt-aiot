'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { AuthButton } from '@/components/auth/AuthButton';
import { Mail, ArrowLeft } from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    setLoading(true);

    try {
      // ✅ CSRF 토큰을 포함한 요청
      const res = await fetchWithCsrf('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '요청 처리에 실패했습니다.');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('요청 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthBackground>
      <AuthCard
        title="이메일을 확인하세요"
        subtitle="비밀번호 재설정 링크를 보냈습니다"
      >
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-neon-green" />
            </div>

            <div className="space-y-2">
              <p className="text-gray-300">
                비밀번호 재설정 링크를 다음 주소로 보냈습니다:
              </p>
              <p className="text-neon-blue font-medium">{email}</p>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm text-gray-400">
                이메일이 오지 않았나요? 스팸 폴더를 확인하거나 다시 시도해주세요.
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-neon-blue hover:text-neon-cyan transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                로그인으로 돌아가기
              </Link>
            </div>
          </div>
        </AuthCard>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <AuthCard
        title="비밀번호를 잊으셨나요?"
        subtitle="이메일로 재설정 링크를 보내드립니다"
      >
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <AuthInput
            id="email"
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            error={error}
            autoComplete="email"
          />

          <AuthButton type="submit" loading={loading} glow="green">
            재설정 링크 보내기
          </AuthButton>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthCard>
    </AuthBackground>
  );
}
