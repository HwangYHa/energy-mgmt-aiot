'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Leaf,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface EmissionFactor {
  id: string;
  name: string;
  code: string;
  category: string;
  sourceType: string;
  factor: number;
  unit: string;
  inputUnit: string;
  source: string;
  year: number;
  region: string;
  isDefault: boolean;
  version: number;
  tenantId: string | null;
}

const CATEGORIES: Record<string, string> = {
  electricity: '전력',
  fuel: '연료',
  transport: '수송',
  process: '공정',
};

export default function EmissionFactorsPage() {
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchFactors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/compliance/emission-factors?${params}`);
      const json = await res.json();
      if (json.success) setFactors(json.data);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => { fetchFactors(); }, [fetchFactors]);

  const filtered = factors.filter((f) =>
    search ? f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()) : true
  );

  // 카테고리별 그룹핑
  const grouped = new Map<string, EmissionFactor[]>();
  for (const f of filtered) {
    const existing = grouped.get(f.category) || [];
    existing.push(f);
    grouped.set(f.category, existing);
  }

  return (
    <div className="h-full bg-slate-950 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Leaf className="w-6 h-6 text-emerald-400" />
            </div>
            배출계수 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">온실가스 배출량 산정을 위한 배출계수 관리</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchFactors} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm"
          >
            <Plus className="w-4 h-4" /> 계수 등록
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="계수명 또는 코드 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">모든 카테고리</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">전체 계수</div>
          <div className="text-2xl font-bold text-emerald-400">{factors.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">카테고리</div>
          <div className="text-2xl font-bold text-blue-400">{grouped.size}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">글로벌 기본</div>
          <div className="text-2xl font-bold text-cyan-400">{factors.filter((f) => !f.tenantId).length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">커스텀</div>
          <div className="text-2xl font-bold text-purple-400">{factors.filter((f) => f.tenantId).length}</div>
        </div>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([category, items]) => (
            <section key={category}>
              <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-400" />
                {CATEGORIES[category] || category} ({items.length})
              </h3>
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">계수명</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">코드</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">배출원</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">계수값</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">단위</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">출처</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-medium">연도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((f) => (
                      <tr key={f.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-white font-medium">
                          {f.name}
                          {f.isDefault && <span className="ml-2 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">기본</span>}
                          {f.tenantId && <span className="ml-2 text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">커스텀</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-xs">{f.code}</td>
                        <td className="py-3 px-4 text-slate-300">{f.sourceType}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-mono font-bold">{f.factor}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs">{f.unit}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs truncate max-w-[200px]">{f.source}</td>
                        <td className="py-3 px-4 text-center text-slate-300">{f.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <CreateFactorModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchFactors(); }}
        />
      )}
    </div>
  );
}

function CreateFactorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', category: 'electricity', sourceType: '',
    factor: '', unit: 'tCO2eq/MWh', inputUnit: 'kWh',
    source: '', year: new Date().getFullYear(), region: 'KR',
    isDefault: false, validFrom: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const { fetchWithCsrf } = await import('@/hooks/use-csrf');
      const res = await fetchWithCsrf('/api/compliance/emission-factors', {
        method: 'POST',
        body: JSON.stringify({ ...form, factor: parseFloat(form.factor) }),
      });
      const json = await res.json();
      if (json.success) onCreated();
      else setError(json.error || '등록 실패');
    } catch { setError('등록에 실패했습니다.'); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">배출계수 등록</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}

          <div>
            <label className="text-sm text-slate-300 block mb-1">계수명 *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-300 block mb-1">카테고리</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                {Object.entries(CATEGORIES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">배출원 *</label>
              <input type="text" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" required placeholder="예: 전력(한전)" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-300 block mb-1">계수값 *</label>
              <input type="number" step="any" value={form.factor} onChange={(e) => setForm({ ...form, factor: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" required placeholder="0.4567" />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">단위 *</label>
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">입력 단위 *</label>
              <input type="text" value={form.inputUnit} onChange={(e) => setForm({ ...form, inputUnit: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-300 block mb-1">출처 *</label>
              <input type="text" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" required placeholder="국가 온실가스 인벤토리" />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">기준연도</label>
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm">취소</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} 등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
