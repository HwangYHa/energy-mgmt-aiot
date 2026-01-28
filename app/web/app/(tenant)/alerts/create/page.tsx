// app/web/app/(tenant)/alerts/rules/create/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function CreateAlertRulePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'energy',
    severity: 'warning',
    metricId: '',
    operator: '>',
    threshold: 0,
    cooldownMinutes: 15,
    notificationChannels: ['email'],
    recipients: [''],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:4000/api/alert-rules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          condition: {
            operator: formData.operator,
            threshold: Number(formData.threshold),
          },
          recipients: formData.recipients.filter(r => r.trim() !== ''),
        }),
      });

      if (response.ok) {
        alert('알람 규칙이 생성되었습니다.');
        router.push('/alerts/rules');
      } else {
        const error = await response.json();
        alert(`오류: ${error.message || '알람 규칙 생성에 실패했습니다.'}`);
      }
    } catch (error) {
      console.error('Failed to create alert rule:', error);
      alert('알람 규칙 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addRecipient = () => {
    setFormData({
      ...formData,
      recipients: [...formData.recipients, ''],
    });
  };

  const updateRecipient = (index: number, value: string) => {
    const newRecipients = [...formData.recipients];
    newRecipients[index] = value;
    setFormData({ ...formData, recipients: newRecipients });
  };

  const removeRecipient = (index: number) => {
    const newRecipients = formData.recipients.filter((_, i) => i !== index);
    setFormData({ ...formData, recipients: newRecipients });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">새 알람 규칙</h1>
          <p className="text-gray-600 mt-1">알람 조건을 설정합니다</p>
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* 기본 정보 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">기본 정보</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              규칙명 *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 전력 사용량 초과"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="알람 규칙에 대한 설명"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리 *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="energy">에너지</option>
                <option value="device">설비</option>
                <option value="system">시스템</option>
                <option value="environment">환경</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                심각도 *
              </label>
              <select
                required
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="critical">긴급</option>
                <option value="warning">경고</option>
                <option value="info">정보</option>
              </select>
            </div>
          </div>
        </div>

        {/* 조건 설정 */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold">조건 설정</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메트릭 ID *
            </label>
            <input
              type="text"
              required
              value={formData.metricId}
              onChange={(e) => setFormData({ ...formData, metricId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="측정 항목 ID"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연산자 *
              </label>
              <select
                required
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value=">">초과 (&gt;)</option>
                <option value="<">미만 (&lt;)</option>
                <option value=">=">이상 (&gt;=)</option>
                <option value="<=">이하 (&lt;=)</option>
                <option value="==">같음 (==)</option>
                <option value="!=">다름 (!=)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                임계값 *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쿨다운 시간 (분)
            </label>
            <input
              type="number"
              min="1"
              value={formData.cooldownMinutes}
              onChange={(e) => setFormData({ ...formData, cooldownMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              동일한 알람이 다시 발생하기까지 대기 시간
            </p>
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold">알림 설정</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              알림 채널
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notificationChannels.includes('email')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        notificationChannels: [...formData.notificationChannels, 'email'],
                      });
                    } else {
                      setFormData({
                        ...formData,
                        notificationChannels: formData.notificationChannels.filter(c => c !== 'email'),
                      });
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-sm">이메일</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notificationChannels.includes('sms')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        notificationChannels: [...formData.notificationChannels, 'sms'],
                      });
                    } else {
                      setFormData({
                        ...formData,
                        notificationChannels: formData.notificationChannels.filter(c => c !== 'sms'),
                      });
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-sm">SMS</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수신자
            </label>
            {formData.recipients.map((recipient, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => updateRecipient(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="example@company.com"
                />
                {formData.recipients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRecipient(index)}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                  >
                    제거
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRecipient}
              className="text-sm text-blue-600 hover:underline"
            >
              + 수신자 추가
            </button>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '생성 중...' : '규칙 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}