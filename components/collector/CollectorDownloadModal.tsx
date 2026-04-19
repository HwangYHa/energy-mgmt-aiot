'use client';

/**
 * 탄소이음 Collector 다운로드 모달 (공유 컴포넌트)
 *
 * 사용:
 *   <CollectorDownloadModal gateway={gw} onClose={() => setGw(null)} />
 *   <CollectorDownloadModal gateway={null} onClose={() => setShow(false)} />
 *     → gateway=null 이면 EXE만 다운로드 가능, 설정파일은 게이트웨이 등록 후 이용
 *
 * API: GET /api/gateways/{id}/installer-config?type=windows|docker|linux
 *   → 인증 토큰 포함 config.yaml / docker-compose.yml / install.sh 반환
 */

import { useState } from 'react';
import {
  Download, Monitor, Container, Terminal,
  X, Copy, Check, AlertTriangle, Loader2, Info,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface CollectorGateway {
  id: string;
  name: string | null;
  serialNumber: string;
}

interface Props {
  gateway: CollectorGateway | null;
  onClose: () => void;
}

export default function CollectorDownloadModal({ gateway, onClose }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);

  const gwName = gateway ? (gateway.name ?? gateway.serialNumber) : null;

  const handleDownload = async (type: 'windows' | 'docker' | 'linux') => {
    if (!gateway) {
      toast.error('게이트웨이를 먼저 등록하세요.');
      return;
    }
    setDownloading(type);
    try {
      const res = await fetch(`/api/gateways/${gateway.id}/installer-config?type=${type}`);
      if (!res.ok) { toast.error('다운로드 실패'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const cd   = res.headers.get('content-disposition') ?? '';
      const name = cd.match(/filename="(.+?)"/)?.[1]
        ?? (type === 'windows' ? `tansoeum-collector-config-${gateway.id}.yaml`
          : type === 'docker'  ? `tansoeum-collector-${gateway.id}.docker-compose.yml`
          : `tansoeum-install-${gateway.id}.sh`);
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast.success('다운로드 완료');
    } catch {
      toast.error('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(null);
    }
  };

  const linuxOneLiner = gateway && typeof window !== 'undefined'
    ? `curl -sSL "${window.location.origin}/api/gateways/${gateway.id}/installer-config?type=linux" | bash`
    : '';

  const copyOneLiner = () => {
    if (!linuxOneLiner) return;
    navigator.clipboard.writeText(linuxOneLiner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              수집기 다운로드
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {gwName ? `${gwName} · ${gateway!.id}` : '게이트웨이 미등록 — EXE만 먼저 다운로드 가능'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 게이트웨이 미등록 안내 배너 */}
        {!gateway && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300">
              <span className="font-semibold">등록된 게이트웨이가 없습니다.</span><br />
              수집기 EXE는 지금 바로 다운로드할 수 있습니다. 설정 파일(config.yaml)과 Docker 설치는
              게이트웨이를 먼저 등록하신 후 이용하세요.
            </div>
          </div>
        )}

        {/* 바디 */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-300 mb-4">
            환경에 맞는 방법을 선택하세요. 인증 정보가 자동 포함된 파일이 다운로드됩니다.
          </p>

          {/* Windows */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Monitor className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Windows (현장 PC)</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  EXE와 config.yaml을 같은 폴더에 배치 후 실행
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="/downloads/TansoEum-Collector.exe"
                download="TansoEum-Collector.exe"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                TansoEum-Collector.exe
              </a>
              <button
                onClick={() => handleDownload('windows')}
                disabled={!!downloading || !gateway}
                title={!gateway ? '게이트웨이 등록 후 이용 가능' : undefined}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition"
              >
                {downloading === 'windows'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                config.yaml
              </button>
            </div>
            <div className="mt-3 bg-slate-900/60 rounded-lg px-3 py-2 text-xs text-slate-400 space-y-0.5">
              <div><span className="text-slate-500">1. </span>EXE와 config.yaml을 <span className="text-white font-mono">C:\TansoEum\</span> 폴더에 배치</div>
              <div><span className="text-slate-500">2. </span>백신 소프트웨어에서 <span className="text-white font-mono">C:\TansoEum\</span> 폴더를 검사 제외 설정</div>
              <div><span className="text-slate-500">3. </span>TansoEum-Collector.exe 실행</div>
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-400/80">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Windows Defender 오탐 방지: <span className="font-mono">C:\TansoEum\</span> 폴더를 바이러스 검사 제외 목록에 추가하세요.</span>
            </div>
          </div>

          {/* Docker */}
          <div className={`bg-slate-800/60 border rounded-xl p-4 ${!gateway ? 'border-slate-700/40 opacity-60' : 'border-slate-700'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Container className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Docker (Linux 서버)</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {!gateway
                      ? '게이트웨이 등록 후 이용 가능'
                      : 'docker-compose.yml 다운로드 → docker compose up -d'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownload('docker')}
                disabled={!!downloading || !gateway}
                title={!gateway ? '게이트웨이 등록 후 이용 가능' : undefined}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition"
              >
                {downloading === 'docker'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                compose.yml
              </button>
            </div>
            {gateway && (
              <div className="mt-3 bg-slate-900/60 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400">
                docker compose up -d
              </div>
            )}
          </div>

          {/* Linux 원클릭 */}
          <div className={`bg-slate-800/60 border rounded-xl p-4 ${!gateway ? 'border-slate-700/40 opacity-60' : 'border-slate-700'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Terminal className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Linux 원클릭 설치</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {!gateway
                    ? '게이트웨이 등록 후 이용 가능'
                    : '서버 터미널에서 아래 명령어 실행 (Docker 자동 설치 포함)'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/80 rounded-lg px-3 py-2.5">
              <code className="flex-1 text-xs text-emerald-400 font-mono break-all">
                {gateway
                  ? `curl -sSL "…/installer-config?type=linux" | bash`
                  : '게이트웨이 등록 후 명령어가 표시됩니다'}
              </code>
              {gateway && (
                <button
                  onClick={copyOneLiner}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                  title="복사"
                >
                  {copied
                    ? <Check className="w-4 h-4 text-emerald-400" />
                    : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-amber-400/70 flex items-center gap-1.5 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            다운로드 파일에는 인증 토큰이 포함됩니다. 외부 공유하지 마세요.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
