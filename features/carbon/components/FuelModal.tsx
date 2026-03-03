'use client';

import { useState } from 'react';
import { Flame, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { apiPost, ApiError } from '@/lib/api/client';

const FUEL_TYPES = [
  { value: 'diesel',   label: '경유' },
  { value: 'lng',      label: 'LNG' },
  { value: 'lpg',      label: 'LPG' },
  { value: 'gasoline', label: '휘발유' },
  { value: 'kerosene', label: '등유' },
  { value: 'bunker_c', label: '벙커C유' },
];
const FUEL_UNITS = ['L', 'm³', 'kg', 'ton'];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function FuelModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    fuelType: 'diesel',
    quantity:  '',
    unit:      'L',
    period:    new Date().toISOString().slice(0, 7),
    facility:  '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.quantity) { setError('사용량을 입력해주세요'); return; }
    setIsSubmitting(true);
    try {
      // normalize bunker type since backend expects hyphen
      const src = form.fuelType.replace('bunker_c', 'bunker-c');
      await apiPost('/api/analytics/carbon/register-fuel', {
        fuelType: src,
        quantity: Number(form.quantity),
        unit: form.unit,
        period: form.period,
        facility: form.facility || undefined,
      });
      setDone(true);
      toast.success('연료 사용량이 등록되었습니다.');
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">연료 사용량 등록</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">연료 종류</label>
              <select
                value={form.fuelType}
                onChange={(e) => set('fuelType', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {FUEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">사용 기간 (월)</label>
              <input
                type="month"
                value={form.period}
                onChange={(e) => set('period', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">사용량</label>
              <input
                type="number" min="0" step="0.1"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">단위</label>
              <select
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {FUEL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">시설명 (선택)</label>
            <input
              type="text"
              value={form.facility}
              onChange={(e) => set('facility', e.target.value)}
              placeholder="예: 본관 보일러실"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />{error}
            </p>
          )}
          {done && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />등록 완료!
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
