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
  X,
  BookOpen,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';

// ─── 타입 ────────────────────────────────────────────────────────

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

// ─── 상수 ────────────────────────────────────────────────────────

const AVAILABLE_SCOPES = [
  { value: 'read:sites',     label: '사이트 조회',       desc: 'GET /api/sites' },
  { value: 'write:sites',    label: '사이트 수정',       desc: 'POST/PATCH /api/sites' },
  { value: 'read:devices',   label: '디바이스 조회',     desc: 'GET /api/devices' },
  { value: 'write:devices',  label: '디바이스 수정',     desc: 'POST/PATCH /api/devices' },
  { value: 'read:analytics', label: '분석 데이터 조회',  desc: 'GET /api/analytics/*' },
  { value: 'read:realtime',  label: '실시간 데이터 조회', desc: 'GET /api/measurements/*' },
  { value: 'write:control',  label: '설비 제어',         desc: 'POST /api/control/*' },
] as const;

const SCOPE_PRESETS = [
  { label: '읽기 전용',   scopes: ['read:sites', 'read:devices', 'read:analytics', 'read:realtime'] },
  { label: '기본',       scopes: ['read:sites', 'read:devices', 'read:analytics'] },
  { label: '전체 권한',  scopes: AVAILABLE_SCOPES.map(s => s.value) },
] as const;

const SCOPE_LABEL_MAP = Object.fromEntries(
  AVAILABLE_SCOPES.map(s => [s.value, s.label])
) as Record<string, string>;

// ─── 유틸 ────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min < 1)   return '방금 전';
  if (min < 60)  return `${min}분 전`;
  if (hr < 24)   return `${hr}시간 전`;
  if (day < 30)  return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys,          setKeys]          = useState<ApiKeyItem[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [showCreate,    setShowCreate]    = useState(false);
  const [newKeyName,    setNewKeyName]    = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:sites', 'read:devices']);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [isCreating,    setIsCreating]    = useState(false);
  const [createError,   setCreateError]   = useState<string | null>(null);
  const [newKey,        setNewKey]        = useState<NewKeyResult | null>(null);
  const [copiedKey,     setCopiedKey]     = useState(false);
  const [showKey,       setShowKey]       = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await apiGet<ApiKeyItem[]>('/api/api-keys');
      if (res.success) setKeys(res.data ?? []);
    } catch {
      // 키 목록 로드 실패
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await apiPost<NewKeyResult>('/api/api-keys', {
        name: newKeyName.trim(),
        scopes: selectedScopes,
        expiresInDays,
      });

      if (res.success && res.data) {
        setNewKey(res.data);
        setShowCreate(false);
        setNewKeyName('');
        setSelectedScopes(['read:sites', 'read:devices']);
        setExpiresInDays(null);
        fetchKeys();
      } else {
        setCreateError(res.error ?? 'API 키 생성에 실패했습니다.');
      }
    } catch {
      setCreateError('API 키 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);

    try {
      const res = await apiDelete(`/api/api-keys/${id}`);
      if (res.success) fetchKeys();
    } catch {
      // 삭제 실패
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

  const applyPreset = (scopes: readonly string[]) => {
    setSelectedScopes([...scopes]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const activeKeys = keys.filter(k => k.isActive);

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6 max-w-4xl mx-auto">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            API 키 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            외부 서버·스크립트가 탄소이음 API에 접근할 수 있는 인증 키를 발급·관리합니다
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setNewKey(null); setCreateError(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          새 API 키
        </button>
      </div>

      {/* 새로 생성된 키 표시 (한 번만) */}
      {newKey && (
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-amber-300">
                API 키 생성 완료 — 지금 바로 복사하세요
              </h3>
              <p className="text-amber-400/70 text-xs mt-1">
                이 창을 닫으면 키를 다시 볼 수 없습니다.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-3 flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-emerald-400 break-all">
              {showKey ? newKey.apiKey : '•'.repeat(newKey.apiKey.length)}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-1.5 hover:bg-slate-700 rounded transition"
              title={showKey ? '숨기기' : '보기'}
            >
              {showKey
                ? <EyeOff className="w-4 h-4 text-slate-400" />
                : <Eye    className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={() => copyToClipboard(newKey.apiKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs rounded-lg transition"
            >
              {copiedKey
                ? <><Check className="w-3.5 h-3.5" /> 복사됨</>
                : <><Copy  className="w-3.5 h-3.5" /> 복사</>}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>안전한 곳(서버 환경변수 등)에 보관 완료했으면 닫으세요.</span>
            <button
              onClick={() => setNewKey(null)}
              className="ml-auto text-slate-400 hover:text-white transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 키 생성 폼 */}
      {showCreate && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">새 API 키 생성</h3>
            <button
              onClick={() => { setShowCreate(false); setNewKeyName(''); setCreateError(null); }}
              className="p-1 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 키 이름 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              키 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isCreating && newKeyName.trim() && handleCreate()}
              placeholder="예: 프로덕션 서버, 모니터링 스크립트"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition text-sm"
              maxLength={200}
            />
          </div>

          {/* 권한 범위 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">
                권한 범위 (Scopes)
              </label>
              <div className="flex gap-1.5">
                {SCOPE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.scopes)}
                    className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <button
                  key={scope.value}
                  type="button"
                  onClick={() => toggleScope(scope.value)}
                  title={scope.desc}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    selectedScopes.includes(scope.value)
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                      : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:border-slate-500'
                  }`}
                >
                  {scope.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">버튼을 클릭해 필요한 권한만 선택하세요. 최소 권한 원칙을 적용하면 보안이 강화됩니다.</p>
          </div>

          {/* 만료 기간 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              만료 기간
            </label>
            <select
              value={expiresInDays ?? ''}
              onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition"
            >
              <option value="">만료 없음 (무기한)</option>
              <option value="30">30일</option>
              <option value="90">90일</option>
              <option value="180">6개월</option>
              <option value="365">1년</option>
            </select>
          </div>

          {createError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {createError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleCreate}
              disabled={isCreating || !newKeyName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              생성
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewKeyName(''); setCreateError(null); }}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* API 키 목록 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-700/50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">
            활성 API 키 ({activeKeys.length})
          </h3>
        </div>

        {keys.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">아직 발급된 API 키가 없습니다.</p>
            <p className="text-xs mt-1">위의 &quot;새 API 키&quot; 버튼으로 첫 번째 키를 발급하세요.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {keys.map((key) => {
              const expired    = key.expiresAt ? new Date(key.expiresAt) < new Date() : false;
              const expiringSoon = key.expiresAt && !expired ? daysUntil(key.expiresAt) <= 30 : false;

              return (
                <div
                  key={key.id}
                  className={`px-5 py-4 ${!key.isActive ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 이름 + 상태 배지 */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-medium text-white text-sm">{key.name}</span>
                        {!key.isActive && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">폐기됨</span>
                        )}
                        {expired && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">만료됨</span>
                        )}
                        {expiringSoon && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {daysUntil(key.expiresAt!)}일 후 만료
                          </span>
                        )}
                      </div>

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <code className="bg-slate-700/50 px-2 py-0.5 rounded font-mono text-slate-400">
                          {key.keyPrefix}
                        </code>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          발급: {relativeTime(key.createdAt)}
                        </span>
                        {key.lastUsedAt ? (
                          <span>마지막 사용: {relativeTime(key.lastUsedAt)}</span>
                        ) : (
                          <span className="text-slate-600">미사용</span>
                        )}
                        {key.expiresAt && !expired && (
                          <span>만료: {new Date(key.expiresAt).toLocaleDateString('ko-KR')}</span>
                        )}
                      </div>

                      {/* 스코프 태그 */}
                      {key.scopes && key.scopes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(key.scopes as string[]).map((scope) => (
                            <span
                              key={scope}
                              className="px-2 py-0.5 bg-blue-500/10 text-blue-400/80 text-xs rounded border border-blue-500/20"
                            >
                              {SCOPE_LABEL_MAP[scope] ?? scope}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 삭제 버튼 + 인라인 확인 */}
                    {key.isActive && (
                      <div className="flex-shrink-0">
                        {confirmDeleteId === key.id ? (
                          <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2 text-xs">
                            <span className="text-red-300">폐기하시겠습니까?</span>
                            <button
                              onClick={() => handleDelete(key.id)}
                              disabled={deletingId === key.id}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded transition disabled:opacity-50"
                            >
                              {deletingId === key.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : '폐기'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(key.id)}
                            className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition"
                            title="API 키 폐기"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* API 사용 가이드 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          API 사용 방법
        </h3>

        <div className="space-y-2 text-sm text-slate-400">
          <p>모든 API 요청에 <code className="text-cyan-400 bg-slate-700/50 px-1.5 py-0.5 rounded text-xs">Authorization</code> 헤더를 포함하세요.</p>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
            {`# cURL 예시\ncurl https://carboneum.kr/api/sites \\\n  -H "Authorization: Bearer ea_live_YOUR_API_KEY"`}
          </div>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-sky-400 overflow-x-auto leading-relaxed">
            {`# Node.js / JavaScript\nconst res = await fetch('https://carboneum.kr/api/sites', {\n  headers: { Authorization: \`Bearer \${process.env.API_KEY}\` }\n});`}
          </div>
        </div>

        {/* 보안 안내 */}
        <div className="flex items-start gap-2.5 p-3.5 bg-slate-700/30 border border-slate-600/30 rounded-lg">
          <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="text-slate-300 font-medium">API 키 보안 수칙</p>
            <ul className="space-y-0.5 list-disc list-inside text-slate-500">
              <li>키는 서버 환경변수(<code className="text-slate-400">.env</code>)에 저장하고 코드에 직접 작성하지 마세요.</li>
              <li>GitHub 등 공개 저장소에 키가 포함된 파일을 절대 커밋하지 마세요.</li>
              <li>사용 목적별로 키를 분리하고, 불필요한 키는 즉시 폐기하세요.</li>
              <li>의심스러운 사용이 감지되면 즉시 폐기 후 재발급하세요.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
