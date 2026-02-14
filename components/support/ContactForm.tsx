'use client';

import { useState } from 'react';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'general', label: '일반 문의' },
  { value: 'technical', label: '기술 지원' },
  { value: 'billing', label: '결제/요금' },
  { value: 'account', label: '계정 문제' },
  { value: 'feature', label: '기능 요청' },
  { value: 'bug', label: '버그 신고' },
];

export function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setResult({ type: 'error', text: '모든 필수 항목을 입력해주세요.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setResult({ type: 'error', text: '올바른 이메일 주소를 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: 실제 백엔드 API 연동 시 변경
      // 현재는 성공 메시지만 표시 (이메일 전송 서비스 연동 필요)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setResult({
        type: 'success',
        text: '문의가 접수되었습니다. 24시간 이내에 답변 드리겠습니다.',
      });
      setForm({
        name: '',
        email: '',
        category: 'general',
        subject: '',
        message: '',
      });
    } catch {
      setResult({
        type: 'error',
        text: '문의 접수 중 오류가 발생했습니다. 이메일로 직접 문의해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {result && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            result.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {result.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          )}
          <span className="text-sm">{result.text}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            이름 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="홍길동"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            이메일 <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="user@company.com"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            문의 유형
          </label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            제목 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            placeholder="문의 제목을 입력해주세요"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          문의 내용 <span className="text-red-400">*</span>
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          rows={6}
          placeholder="문의 내용을 상세히 작성해주세요. 스크린샷이나 에러 메시지를 포함하면 더 빠른 답변이 가능합니다."
          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition resize-none"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-slate-500">
          24시간 이내에 이메일로 답변 드립니다
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold text-white transition disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          문의 보내기
        </button>
      </div>
    </form>
  );
}
