'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Bug,
  CreditCard,
  User,
  History,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { apiPost, apiGet, ApiError } from '@/lib/api/client';

interface InquiryHistory {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'general', label: '일반 문의', icon: HelpCircle, color: 'text-gray-400' },
  { value: 'technical', label: '기술 지원', icon: AlertCircle, color: 'text-cyan-400' },
  { value: 'billing', label: '결제/구독', icon: CreditCard, color: 'text-amber-400' },
  { value: 'feature', label: '기능 요청', icon: Lightbulb, color: 'text-purple-400' },
  { value: 'bug', label: '버그 신고', icon: Bug, color: 'text-red-400' },
  { value: 'account', label: '계정 관련', icon: User, color: 'text-green-400' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '접수됨', color: 'text-gray-400' },
  in_progress: { label: '처리중', color: 'text-cyan-400' },
  resolved: { label: '해결됨', color: 'text-green-400' },
  closed: { label: '종료', color: 'text-gray-500' },
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: '낮음', description: '일반적인 문의' },
  { value: 'normal', label: '보통', description: '업무에 영향이 있는 문제' },
  { value: 'high', label: '높음', description: '즉각적인 처리가 필요한 문제' },
];

interface FormState {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  priority: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  category: '',
  subject: '',
  message: '',
  priority: 'normal',
};

export default function SupportPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [history, setHistory] = useState<InquiryHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // 사용자 프로필 자동 채우기 (세션)
  useEffect(() => {
    apiGet<{ user?: { name?: string; email?: string } }>('/api/auth/session')
      .then((res) => {
        const user = res.data?.user;
        if (user) {
          setForm((prev) => ({
            ...prev,
            name:  user.name  ?? prev.name,
            email: user.email ?? prev.email,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiGet<{ inquiries: InquiryHistory[] }>('/api/support?limit=20');
      setHistory(res.data?.inquiries ?? []);
    } catch {
      // 권한 없거나 조회 실패 → 내역 없음 표시
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTabChange = (tab: 'new' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history') fetchHistory();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) {
      toast.error('문의 유형을 선택해주세요.');
      return;
    }
    if (!form.message.trim()) {
      toast.error('문의 내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      // priority는 DB 스키마에 없으므로 제외하고 전송
      const { priority: _priority, ...submitData } = form;
      void _priority;
      const data = await apiPost<{ id?: string }>('/api/support', submitData);
      setSubmitted(true);
      setSubmittedId(data.data?.id ?? null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : '네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewInquiry = () => {
    setSubmitted(false);
    setSubmittedId(null);
    setForm((prev) => ({ ...INITIAL_FORM, name: prev.name, email: prev.email }));
    setCharCount(0);
  };

  // 성공 화면
  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">문의가 접수되었습니다</h2>
          <p className="text-gray-400 mb-1">24시간 이내에 이메일로 답변 드리겠습니다.</p>
          {submittedId && (
            <p className="text-xs text-gray-500 mb-6">
              접수 번호: <span className="font-mono text-gray-400">{submittedId.substring(0, 8).toUpperCase()}</span>
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleNewInquiry}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
            >
              새 문의 작성
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              내 문의 내역
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          고객 지원 &amp; 피드백
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          문의 사항이나 개선 요청을 남겨주세요. 전담팀이 신속히 답변드립니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => handleTabChange('new')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'new'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          새 문의
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          내 문의 내역
        </button>
      </div>

      {/* New Inquiry Form */}
      {activeTab === 'new' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              문의 유형 <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, category: cat.value }))}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      form.category === cat.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${form.category === cat.value ? 'text-cyan-400' : cat.color}`} />
                    <span className="text-sm">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="홍길동"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                이메일 <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="your@company.com"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="문의 제목을 간략하게 입력해주세요"
              maxLength={200}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">우선순위</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, priority: opt.value }))}
                  title={opt.description}
                  className={`px-4 py-1.5 rounded-lg text-sm border transition-all ${
                    form.priority === opt.value
                      ? opt.value === 'high'
                        ? 'border-red-500 bg-red-500/10 text-red-300'
                        : opt.value === 'normal'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-gray-400 bg-gray-400/10 text-gray-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              문의 내용 <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={form.message}
              onChange={(e) => {
                setForm((p) => ({ ...p, message: e.target.value }));
                setCharCount(e.target.value.length);
              }}
              placeholder={
                form.category === 'bug'
                  ? '버그 재현 절차, 예상 동작, 실제 동작을 상세히 기술해주세요.'
                  : form.category === 'feature'
                  ? '원하시는 기능과 사용 목적, 기대 효과를 설명해주세요.'
                  : '문의 내용을 상세히 입력해주세요.'
              }
              rows={6}
              maxLength={5000}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500 resize-none"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">스크린샷이나 오류 메시지를 포함하면 더 빠른 지원이 가능합니다.</p>
              <span className={`text-xs ${charCount > 4500 ? 'text-amber-400' : 'text-gray-500'}`}>
                {charCount.toLocaleString()} / 5,000
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.category}
            className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                접수 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                문의 접수
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            접수된 문의는 등록하신 이메일로 처리 현황을 안내 드립니다.
          </p>
        </form>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>이전 문의 내역이 없습니다.</p>
            </div>
          ) : (
            history.map((item) => {
              const cat = CATEGORIES.find((c) => c.value === item.category);
              const Icon = cat?.icon ?? HelpCircle;
              const statusCfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'text-gray-400' };
              return (
                <div
                  key={item.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cat?.color ?? 'text-gray-400'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{cat?.label ?? item.category}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
