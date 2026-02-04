import { Lock } from 'lucide-react';

export function ReadOnlyBadge() {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex">
        <Lock className="h-5 w-5 text-yellow-400" />
        <p className="ml-3 text-sm text-yellow-700">
          이 페이지는 읽기 전용입니다. 수정 권한이 필요한 경우 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
