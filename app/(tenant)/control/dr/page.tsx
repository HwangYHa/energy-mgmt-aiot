'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Zap, TrendingDown, Calendar } from 'lucide-react';

interface DREvent {
  id: string;
  name: string;
  eventType: string;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled';
  scheduledAt: string;
  startedAt?: string;
  duration: number;
  targetReduction: number;
  actualReduction: number;
  responseRate: number;
  compensation: number;
  devices: { id: string; name: string; type: string }[];
}

export default function DRDashboardPage() {
  const [events, setEvents] = useState<DREvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_activeEvent, _setActiveEvent] = useState<DREvent | null>(null);

  useEffect(() => {
    fetchDREvents();
  }, []);

  const fetchDREvents = async () => {
    try {
      // Mock data for demonstration
      const mockEvents: DREvent[] = [
        {
          id: '1',
          name: '여름철 피크 대응',
          eventType: 'peak-shaving',
          status: 'completed',
          scheduledAt: '2026-01-28T09:00:00Z',
          duration: 120,
          targetReduction: 50,
          actualReduction: 52.3,
          responseRate: 98.5,
          compensation: 1500000,
          devices: [
            { id: 'd1', name: 'HVAC System', type: 'hvac' },
            { id: 'd2', name: '조명 시스템', type: 'lighting' },
          ],
        },
        {
          id: '2',
          name: '정전 대비 DR',
          eventType: 'emergency',
          status: 'scheduled',
          scheduledAt: '2026-01-30T14:30:00Z',
          duration: 180,
          targetReduction: 80,
          actualReduction: 0,
          responseRate: 0,
          compensation: 2500000,
          devices: [
            { id: 'd1', name: 'HVAC System', type: 'hvac' },
            { id: 'd3', name: '생산 장비', type: 'production' },
          ],
        },
        {
          id: '3',
          name: '겨울철 부하관리',
          eventType: 'peak-shaving',
          status: 'running',
          scheduledAt: '2026-01-29T18:00:00Z',
          startedAt: '2026-01-29T18:00:00Z',
          duration: 120,
          targetReduction: 40,
          actualReduction: 41.5,
          responseRate: 97.2,
          compensation: 1200000,
          devices: [
            { id: 'd2', name: '조명 시스템', type: 'lighting' },
            { id: 'd4', name: 'ESS System', type: 'ess' },
          ],
        },
      ];

      setEvents(mockEvents);
    } catch (error) {
      console.error('Failed to fetch DR events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeEvent = async (eventId: string) => {
    try {
      // Mock execution
      const updated = events.map((e) =>
        e.id === eventId ? { ...e, status: 'running' as const } : e
      );
      setEvents(updated);
    } catch (error) {
      console.error('Failed to execute event:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-900 text-green-200 border-green-700';
      case 'scheduled':
        return 'bg-blue-900 text-blue-200 border-blue-700';
      case 'completed':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'cancelled':
        return 'bg-red-900 text-red-200 border-red-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running':
        return '실행 중';
      case 'scheduled':
        return '예정됨';
      case 'completed':
        return '완료됨';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p>DR 이벤트 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">수요반응 관리</h1>
          <p className="text-slate-400">
            DR 이벤트 실행, 성과 분석 및 보상 관리
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">실행 중인 이벤트</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">
                  {events.filter((e) => e.status === 'running').length}
                </p>
              </div>
              <Zap className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">이번 달 절감</p>
                <p className="text-3xl font-bold text-amber-400 mt-2">
                  {events
                    .reduce((sum, e) => sum + e.actualReduction, 0)
                    .toFixed(1)}
                  kW
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">이번 달 보상</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">
                  ₩
                  {(
                    events.reduce((sum, e) => sum + e.compensation, 0) /
                    1000000
                  ).toFixed(1)}
                  M
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">평균 응답률</p>
                <p className="text-3xl font-bold text-green-400 mt-2">
                  {events.length > 0
                    ? (
                        events.reduce((sum, e) => sum + e.responseRate, 0) /
                        events.length
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">DR 이벤트 목록</h2>

          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {event.name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {getStatusLabel(event.status)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {new Date(event.scheduledAt).toLocaleString('ko-KR')} •{' '}
                      {event.duration}분
                    </p>
                  </div>

                  {event.status === 'scheduled' && (
                    <button
                      onClick={() => executeEvent(event.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold transition"
                    >
                      실행
                    </button>
                  )}

                  {event.status === 'running' && (
                    <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition">
                      중지
                    </button>
                  )}
                </div>

                {/* Event Details */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">목표 감축</p>
                    <p className="text-lg font-bold text-amber-400">
                      {event.targetReduction}kW
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">실제 감축</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {event.actualReduction}kW
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">응답률</p>
                    <p className="text-lg font-bold text-blue-400">
                      {event.responseRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">보상</p>
                    <p className="text-lg font-bold text-green-400">
                      ₩{Math.round(event.compensation / 1000000)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">참여 장비</p>
                    <p className="text-lg font-bold text-slate-300">
                      {event.devices.length}개
                    </p>
                  </div>
                </div>

                {/* Devices */}
                <div className="flex flex-wrap gap-2">
                  {event.devices.map((device) => (
                    <span
                      key={device.id}
                      className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300"
                    >
                      {device.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Analysis */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6">성과 분석</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Compliance Rate */}
            <div>
              <h3 className="text-lg font-semibold mb-4">준수율</h3>
              <div className="space-y-3">
                {events
                  .filter((e) => e.status === 'completed')
                  .map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{event.name}</span>
                      <div className="flex-1 mx-4 h-2 bg-slate-800 rounded">
                        <div
                          className="h-full bg-emerald-500 rounded"
                          style={{
                            width: `${
                              (event.actualReduction / event.targetReduction) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-300">
                        {(
                          (event.actualReduction / event.targetReduction) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div>
              <h3 className="text-lg font-semibold mb-4">수익 구성</h3>
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-slate-800 rounded"
                  >
                    <span className="text-sm text-slate-300">{event.name}</span>
                    <span className="font-semibold text-emerald-400">
                      ₩{Math.round(event.compensation / 1000000)}M
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-slate-700 rounded border border-slate-600">
                  <span className="font-semibold text-slate-200">합계</span>
                  <span className="font-bold text-xl text-emerald-400">
                    ₩
                    {(
                      events.reduce((sum, e) => sum + e.compensation, 0) /
                      1000000
                    ).toFixed(1)}
                    M
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
