'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertTriangle, TrendingDown, DollarSign, Zap, Play, Pause, Trash2, Plus, Loader2 } from 'lucide-react';

interface DREvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  targetReductionKw: number;
  actualReductionKw?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  revenue?: number;
}

export default function DRPage() {
  const [events, setEvents] = useState<DREvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    targetReductionKw: 50,
  });

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/dr?status=scheduled,in_progress');
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch DR events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async () => {
    try {
      const response = await fetch('/api/dr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowCreateModal(false);
        fetchEvents();
      }
    } catch (error) {
      console.error('Failed to create DR event:', error);
    }
  };

  const executeEvent = async (eventId: string) => {
    // TODO: DR 이벤트 실행 API 호출
    console.log('Execute event:', eventId);
  };

  const statusColors = {
    scheduled: 'bg-blue-900 text-blue-200 border-blue-700',
    in_progress: 'bg-green-900 text-green-200 border-green-700',
    completed: 'bg-gray-900 text-gray-200 border-gray-700',
    cancelled: 'bg-red-900 text-red-200 border-red-700',
  };

  const statusLabels = {
    scheduled: '예약됨',
    in_progress: '진행 중',
    completed: '완료',
    cancelled: '취소됨',
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* 헤더 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Zap className="w-10 h-10 text-yellow-400" />
            📢 수요 반응 (DR)
          </h1>
          <p className="text-gray-400">전력 피크 시간대 수요 감축 프로그램</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-5 h-5" />
          새 이벤트
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-800 to-blue-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">진행 중</span>
            <Play className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold">
            {events.filter((e) => e.status === 'in_progress').length}
          </div>
          <div className="text-sm text-gray-400 mt-2">실시간 이벤트</div>
        </div>

        <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">목표 감축</span>
            <TrendingDown className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold">
            {events
              .filter((e) => e.status === 'in_progress')
              .reduce((sum, e) => sum + e.targetReductionKw, 0)
              .toFixed(0)}{' '}
            kW
          </div>
          <div className="text-sm text-gray-400 mt-2">예상 감축량</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-800 to-yellow-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">총 이벤트</span>
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold">{events.length}</div>
          <div className="text-sm text-gray-400 mt-2">월간 누적</div>
        </div>

        <div className="bg-gradient-to-br from-purple-800 to-purple-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">예상 수익</span>
            <DollarSign className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold">
            ₩{(events.reduce((sum, e) => sum + (e.revenue || 0), 0) / 1000000).toFixed(1)}M
          </div>
          <div className="text-sm text-gray-400 mt-2">DR 인센티브</div>
        </div>
      </div>

      {/* DR 이벤트 목록 */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-6">📋 DR 이벤트</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>진행 중인 DR 이벤트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-blue-500 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{event.title}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold border ${statusColors[event.status]}`}
                      >
                        {statusLabels[event.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300 mt-3">
                      <div>
                        <span className="text-gray-400">시작</span>
                        <div className="font-semibold">{new Date(event.startTime).toLocaleTimeString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">종료</span>
                        <div className="font-semibold">{new Date(event.endTime).toLocaleTimeString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">목표 감축</span>
                        <div className="font-semibold text-green-400">{event.targetReductionKw} kW</div>
                      </div>
                      <div>
                        <span className="text-gray-400">예상 수익</span>
                        <div className="font-semibold text-yellow-400">₩{(event.revenue || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 flex-shrink-0">
                    {event.status === 'scheduled' && (
                      <button
                        onClick={() => executeEvent(event.id)}
                        className="p-2 bg-green-600 hover:bg-green-700 rounded transition"
                        title="실행"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    )}
                    {event.status === 'in_progress' && (
                      <button className="p-2 bg-orange-600 hover:bg-orange-700 rounded transition" title="일시중지">
                        <Pause className="w-5 h-5" />
                      </button>
                    )}
                    <button className="p-2 bg-red-600 hover:bg-red-700 rounded transition" title="삭제">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 모달: 새 이벤트 생성 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">새 DR 이벤트</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-300 mb-2">이벤트명</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="예: 1월 피크 관리"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">시작 시간</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">종료 시간</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  목표 감축량: {formData.targetReductionKw} kW
                </label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={formData.targetReductionKw}
                  onChange={(e) => setFormData({ ...formData, targetReductionKw: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
              >
                취소
              </button>
              <button
                onClick={handleCreateEvent}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold transition"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
