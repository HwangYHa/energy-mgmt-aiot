'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Shield,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[] | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface NewKeyResult {
  id: string;
  name: string;
  apiKey: string;
  scopes: string[] | null;
  message: string;
}

const AVAILABLE_SCOPES = [
  { value: 'read:sites', label: '사이트 조회' },
  { value: 'write:sites', label: '사이트 수정' },
  { value: 'read:devices', label: '디바이스 조회' },
  { value: 'write:devices', label: '디바이스 수정' },
  { value: 'read:analytics', label: '분석 데이터 조회' },
  { value: 'read:realtime', label: '실시간 데이터 조회' },
  { value: 'write:control', label: '설비 제어' },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:sites', 'read:devices']);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      if (data.success) {
        setKeys(data.data || []);
      }
    } catch {
      // 키 목록 로드 실패
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetchWithCsrf('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: selectedScopes,
          expiresInDays,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNewKey(data.data);
        setShowCreate(false);
        setNewKeyName('');
        setSelectedScopes(['read:sites', 'read:devices']);
        setExpiresInDays(null);
        fetchKeys();
      }
    } catch {
      // 키 생성 실패
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 API 키를 폐기하시겠습니까? 이 작업은 취소할 수 없습니다.')) return;
    setDeletingId(id);

    try {
      const res = await fetchWithCsrf(`/api/api-keys/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchKeys();
      }
    } catch {
      // 키 삭제 실패
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Key className="w-6 h-6 text-blue-400" />
            </div>
            API 키 관리
          </h1>
          <p className="text-slate-400 mt-1">API 키를 생성하고 관리합니다</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setNewKey(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition"
        >
          <Plus className="w-5 h-5" />
          새 API 키
        </button>
      </div>

      {/* 새로 생성된 키 표시 (한 번만) */}
      {newKey && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-yellow-400">API 키 생성 완료</h3>
              <p className="text-yellow-300/80 text-sm mt-1">
                이 키는 다시 표시되지 않습니다. 지금 안전한 곳에 저장하세요.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 flex items-center gap-3">
            <code className="flex-1 text-sm font-mono text-emerald-400 break-all">
              {showKey ? newKey.apiKey : '•'.repeat(40)}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-2 hover:bg-slate-700 rounded-lg transition"
              title={showKey ? '숨기기' : '보기'}
            >
              {showKey ? (
                <EyeOff className="w-4 h-4 text-slate-400" />
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <button
              onClick={() => copyToClipboard(newKey.apiKey)}
              className="p-2 hover:bg-slate-700 rounded-lg transition"
              title="복사"
            >
              {copiedKey ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-sm text-slate-400 hover:text-white transition"
          >
            확인했습니다 - 닫기
          </button>
        </div>
      )}

      {/* 키 생성 폼 */}
      {showCreate && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">새 API 키 생성</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                키 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="예: 프로덕션 서버, 모니터링 스크립트"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                권한 범위 (Scopes)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <button
                    key={scope.value}
                    type="button"
                    onClick={() => toggleScope(scope.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      selectedScopes.includes(scope.value)
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                만료 기간
              </label>
              <select
                value={expiresInDays || ''}
                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition"
              >
                <option value="">만료 없음</option>
                <option value="30">30일</option>
                <option value="90">90일</option>
                <option value="180">180일</option>
                <option value="365">1년</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={isCreating || !newKeyName.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                생성
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewKeyName(''); }}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API 키 목록 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold">활성 API 키 ({keys.filter(k => k.isActive).length})</h3>
        </div>

        {keys.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>API 키가 없습니다.</p>
            <p className="text-sm mt-1">위의 &quot;새 API 키&quot; 버튼을 클릭하여 생성하세요.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {keys.map((key) => (
              <div key={key.id} className={`px-6 py-4 ${!key.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-white">{key.name}</span>
                      {!key.isActive && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                          폐기됨
                        </span>
                      )}
                      {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                          만료됨
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <code className="text-xs bg-slate-700/50 px-2 py-0.5 rounded font-mono">
                        {key.keyPrefix}
                      </code>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        생성: {new Date(key.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      {key.lastUsedAt && (
                        <span>
                          마지막 사용: {new Date(key.lastUsedAt).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span>
                          만료: {new Date(key.expiresAt).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                    {key.scopes && Array.isArray(key.scopes) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(key.scopes as string[]).map((scope) => (
                          <span
                            key={scope}
                            className="px-2 py-0.5 bg-slate-700/50 text-slate-400 text-xs rounded"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {key.isActive && (
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deletingId === key.id}
                      className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition"
                      title="API 키 폐기"
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사용 안내 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          API 키 사용 방법
        </h3>
        <div className="space-y-3 text-sm text-slate-400">
          <p>모든 API 요청에 <code className="text-emerald-400 bg-slate-700/50 px-1.5 py-0.5 rounded">Authorization</code> 헤더를 포함하세요:</p>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto">
            {`curl https://api.energyai.io/api/sites \\
  -H "Authorization: Bearer ea_live_YOUR_API_KEY"`}
          </div>
          <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <span className="text-yellow-300/80 text-xs">
              API 키는 비밀번호와 동일하게 취급하세요. 코드에 하드코딩하지 말고 환경변수로 관리하세요.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
