/**
 * lib/services/toss.service.ts
 *
 * 토스페이먼츠 서버 사이드 서비스
 * - 결제 승인 (confirmPayment)
 * - 환경변수: TOSS_SECRET_KEY (토스페이먼츠 시크릿 키)
 */

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

export interface TossPaymentResult {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;         // DONE | CANCELED | PARTIAL_CANCELED | ABORTED | EXPIRED
  method: string;         // 카드 | 가상계좌 | 간편결제 | 휴대폰 | ...
  totalAmount: number;
  approvedAt: string;     // ISO 8601
  receipt?: { url: string };
  card?: {
    issuerCode: string;
    acquirerCode: string;
    number: string;       // 마스킹된 카드번호
    installmentPlanMonths: number;
    approveNo: string;
    useCardPoint: boolean;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
    isInterestFree: boolean;
  };
}

export class TossService {
  private static authHeader(): string {
    const key = process.env.TOSS_SECRET_KEY;
    if (!key) {
      throw new Error('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다');
    }
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  }

  /**
   * 결제 승인 (서버 → 토스페이먼츠 API)
   *
   * @see https://docs.tosspayments.com/reference#결제-승인
   */
  static async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<TossPaymentResult> {
    const res = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await res.json();

    if (!res.ok) {
      // 토스페이먼츠 에러 응답 구조: { code, message }
      throw new Error(data.message || `토스페이먼츠 결제 확인 실패 (${res.status})`);
    }

    return data as TossPaymentResult;
  }
}
