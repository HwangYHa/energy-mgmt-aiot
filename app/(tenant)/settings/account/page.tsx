'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Building2,
  Lock,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { fetchWithCsrf } from '@/hooks/use-csrf';

interface UserProfile {
  name: string;
  email: string;
  organizationName: string;
  role: string;
  createdAt: string;
}

export default function AccountSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 프로필 수정 상태
  const [name, setName] = useState('');

  // 비밀번호 변경 상태
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
        setName(json.data.name || '');
      }
    } catch {
      // 프로필 로드 실패
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: '이름을 입력해주세요.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetchWithCsrf('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: '프로필이 저장되었습니다.' });
        setProfile((prev) => (prev ? { ...prev, name: name.trim() } : prev));
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: 'error',
          text: json.error || '저장에 실패했습니다.',
        });
      }
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (!passwordForm.currentPassword) {
      setPasswordMessage({
        type: 'error',
        text: '현재 비밀번호를 입력해주세요.',
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({
        type: 'error',
        text: '새 비밀번호는 8자 이상이어야 합니다.',
      });
      return;
    }

    if (
      !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(passwordForm.newPassword)
    ) {
      setPasswordMessage({
        type: 'error',
        text: '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다.',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: '새 비밀번호가 일치하지 않습니다.',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetchWithCsrf('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setPasswordMessage({
          type: 'success',
          text: '비밀번호가 변경되었습니다.',
        });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setTimeout(() => setPasswordMessage(null), 3000);
      } else {
        setPasswordMessage({
          type: 'error',
          text: json.error || '비밀번호 변경에 실패했습니다.',
        });
      }
    } catch {
      setPasswordMessage({
        type: 'error',
        text: '비밀번호 변경 중 오류가 발생했습니다.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: '슈퍼 관리자',
    tenant_admin: '테넌트 관리자',
    site_manager: '사이트 매니저',
    operator: '운영자',
    viewer: '뷰어',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로 가기 */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          설정으로 돌아가기
        </Link>

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            계정 설정
          </h1>
          <p className="text-slate-400 mt-1">프로필 정보 및 비밀번호 관리</p>
        </div>

        {/* 프로필 정보 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            프로필 정보
          </h2>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                message.type === 'error'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              {message.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <div className="space-y-5">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition"
                placeholder="이름 입력"
              />
            </div>

            {/* 이메일 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                이메일
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">
                  {profile?.email || '-'}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  (변경 불가)
                </span>
              </div>
            </div>

            {/* 조직 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                소속 조직
              </label>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">
                  {profile?.organizationName || '-'}
                </span>
              </div>
            </div>

            {/* 역할 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                역할
              </label>
              <span className="inline-flex items-center px-3 py-1 bg-cyan-500/10 text-cyan-400 text-sm rounded-full">
                {roleLabels[profile?.role || ''] || profile?.role || '-'}
              </span>
            </div>

            {/* 가입일 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                가입일
              </label>
              <span className="text-slate-400 text-sm">
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '-'}
              </span>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-slate-700/50">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              프로필 저장
            </button>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            비밀번호 변경
          </h2>

          {passwordMessage && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                passwordMessage.type === 'error'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              {passwordMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {passwordMessage.text}
            </div>
          )}

          <div className="space-y-4">
            <PasswordField
              label="현재 비밀번호"
              value={passwordForm.currentPassword}
              onChange={(v) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: v }))
              }
              show={showPasswords.current}
              onToggle={() =>
                setShowPasswords((prev) => ({
                  ...prev,
                  current: !prev.current,
                }))
              }
            />
            <PasswordField
              label="새 비밀번호"
              value={passwordForm.newPassword}
              onChange={(v) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: v }))
              }
              show={showPasswords.new}
              onToggle={() =>
                setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
              }
              hint="8자 이상, 대문자/소문자/숫자 포함"
            />
            <PasswordField
              label="새 비밀번호 확인"
              value={passwordForm.confirmPassword}
              onChange={(v) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: v }))
              }
              show={showPasswords.confirm}
              onToggle={() =>
                setShowPasswords((prev) => ({
                  ...prev,
                  confirm: !prev.confirm,
                }))
              }
            />
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-slate-700/50">
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium transition disabled:opacity-50"
            >
              {isChangingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              비밀번호 변경
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition"
          placeholder="••••••••"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
        >
          {show ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {hint && (
        <p className="text-xs text-slate-500 mt-1">{hint}</p>
      )}
    </div>
  );
}
