'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock, Receipt, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api/client';

interface PaymentRecord {
  id: string;
  amount: string | number;
  currency: string;
  status: string;
  method: string | null;
  paidAt: string | null;
  createdAt: string;
  failReason: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  paid: { label: '결제 완료', color: 'text-emerald-400', icon: CheckCircle2 },
  pending: { label: '대기 중', color: 'text-amber-400', icon: Clock },
  failed: { label: '실패', color: 'text-red-400', icon: XCircle },
  refunded: { label: '환불', color: 'text-blue-400', icon: Receipt },
};

export function PaymentTimeline() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const res = await apiGet<PaymentRecord[]>('/api/payment/history');
        if (res.success && res.data) {
          setPayments(res.data);
        }
      } catch (error) {
        console.error('결제 내역 조회 실패:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPayments();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: string | number, currency: string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (currency === 'KRW') {
      return `₩${num.toLocaleString('ko-KR')}`;
    }
    return `${currency} ${num.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-400 mb-3">결제 내역</h3>
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-slate-400 mb-3">결제 내역</h3>

      {payments.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
          <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">결제 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl divide-y divide-slate-700/50">
          {payments.map((payment) => {
            const fallback = { label: '대기 중', color: 'text-amber-400', icon: Clock };
            const config = statusConfig[payment.status] || fallback;
            const { icon: StatusIcon, color, label } = config;

            return (
              <div key={payment.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusIcon className={cn('w-4 h-4', color)} />
                  <div>
                    <p className="text-sm text-white">
                      {formatAmount(payment.amount, payment.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(payment.paidAt || payment.createdAt)}
                      {payment.method && ` · ${payment.method}`}
                    </p>
                  </div>
                </div>
                <span className={cn('text-xs font-medium', color)}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
