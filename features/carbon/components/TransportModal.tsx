'use client';

import { useState } from 'react';
import { Truck, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const VEHICLE_TYPES = [
  { value: 'car', label: '승용차' },
  { value: 'truck', label: '화물차' },
  { value: 'air', label: '항공' },
  { value: 'ship', label: '해운' },
  { value: 'rail', label: '철도' },
];

const FUEL_TYPES = [
  { value: 'diesel', label: '경유' },
  { value: 'lng', label: 'LNG' },
  { value: 'lpg', label: 'LPG' },
  { value: 'gasoline', label: '휘발유' },
  { value: 'kerosene', label: '등유' },
  { value: 'bunker_c', label: '벙커C유' },
];

interface TransportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function TransportModal({ onClose, onSuccess }: TransportModalProps) {
  const [form, setForm] = useState({
    vehicleType: 'truck',
    distance: '',
    fuelType: 'diesel',
    period: new Date().toISOString().slice(0, 7),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!form.distance) { setError('거리를 입력해주세요'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/analytics/carbon/register-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: form.vehicleType,
          distance: Number(form.distance),
          fuelType: form.fuelType,
          period: form.period,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { message?: string }).message ?? '등록 실패');
      }
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">운송 거리 등록</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">운송 수단</label>
              <select
                value={form.vehicleType}
                onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">사용 기간 (월)</label>
              <input
                type="month"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">거리 (km)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.distance}
                onChange={(e) => setForm((f) => ({ ...f, distance: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">연료 종류</label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm((f) => ({ ...f, fuelType: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                {FUEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
