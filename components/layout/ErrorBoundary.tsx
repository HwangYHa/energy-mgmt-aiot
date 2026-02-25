'use client';

/**
 * components/layout/ErrorBoundary.tsx
 *
 * React Error Boundary — 자식 컴포넌트 렌더링 오류를 포착하여
 * 전체 레이아웃 crash 대신 에러 UI를 표시합니다.
 *
 * 사용:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** 에러 발생 시 표시할 대체 UI (미제공 시 기본 에러 화면) */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 프로덕션에서는 에러 트래킹 서비스로 전송 (Sentry 등)
    console.error('[ErrorBoundary] 렌더링 오류:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">
            페이지를 불러오는 중 오류가 발생했습니다
          </h2>
          <p className="text-slate-400 text-sm mb-2 max-w-md">
            예상치 못한 오류가 발생했습니다.
            문제가 지속되면 지원팀에 문의해 주세요.
          </p>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mb-6 text-left max-w-lg w-full">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 mb-2">
                오류 상세 (개발 환경)
              </summary>
              <pre className="text-xs text-red-400 bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-auto max-h-40">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
