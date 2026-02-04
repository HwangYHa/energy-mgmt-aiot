/**
 * Iamport(PortOne) 결제 연동 서비스
 *
 * 주요 기능:
 * - 액세스 토큰 발급
 * - 결제 검증
 * - 결제 정보 조회
 */

import env from '@/lib/env';

const IAMPORT_API_URL = 'https://api.iamport.kr';

interface IamportTokenResponse {
  code: number;
  message: string | null;
  response: {
    access_token: string;
    expired_at: number;
    now: number;
  };
}

interface IamportPaymentResponse {
  code: number;
  message: string | null;
  response: {
    imp_uid: string;
    merchant_uid: string;
    pay_method: string;
    paid_amount: number;
    status: 'ready' | 'paid' | 'cancelled' | 'failed';
    paid_at: number;
    receipt_url: string;
    buyer_name: string;
    buyer_email: string;
    buyer_tel: string;
    custom_data?: string;
  };
}

/**
 * Iamport 액세스 토큰 발급
 */
export async function getIamportToken(): Promise<string> {
  const apiKey = env.IAMPORT_API_KEY;
  const apiSecret = env.IAMPORT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Iamport credentials not configured');
  }

  const response = await fetch(`${IAMPORT_API_URL}/users/getToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imp_key: apiKey,
      imp_secret: apiSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Iamport token: ${response.statusText}`);
  }

  const data: IamportTokenResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`Iamport API error: ${data.message}`);
  }

  return data.response.access_token;
}

/**
 * 결제 정보 조회 및 검증
 *
 * @param impUid - Iamport 고유 결제번호
 * @returns 결제 정보
 */
export async function verifyPayment(impUid: string) {
  const token = await getIamportToken();

  const response = await fetch(`${IAMPORT_API_URL}/payments/${impUid}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to verify payment: ${response.statusText}`);
  }

  const data: IamportPaymentResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`Iamport API error: ${data.message}`);
  }

  return data.response;
}

/**
 * 결제 상태가 유효한지 검증
 *
 * @param impUid - Iamport 고유 결제번호
 * @param expectedAmount - 예상 결제 금액
 * @param merchantUid - 가맹점 주문번호
 * @returns 검증 결과
 */
export async function validatePayment(
  impUid: string,
  expectedAmount: number,
  merchantUid: string
): Promise<{ valid: boolean; payment: IamportPaymentResponse['response'] | null }> {
  try {
    const payment = await verifyPayment(impUid);

    // 결제 상태 확인
    if (payment.status !== 'paid') {
      console.error(
        `[Iamport] Payment status is not paid: ${payment.status} (imp_uid: ${impUid})`
      );
      return { valid: false, payment: null };
    }

    // 결제 금액 확인
    if (payment.paid_amount !== expectedAmount) {
      console.error(
        `[Iamport] Payment amount mismatch: expected ${expectedAmount}, got ${payment.paid_amount} (imp_uid: ${impUid})`
      );
      return { valid: false, payment: null };
    }

    // 주문번호 확인
    if (payment.merchant_uid !== merchantUid) {
      console.error(
        `[Iamport] Merchant UID mismatch: expected ${merchantUid}, got ${payment.merchant_uid} (imp_uid: ${impUid})`
      );
      return { valid: false, payment: null };
    }

    return { valid: true, payment };
  } catch (error) {
    console.error('[Iamport] Payment validation error:', error);
    return { valid: false, payment: null };
  }
}

/**
 * 결제 취소
 *
 * @param impUid - Iamport 고유 결제번호
 * @param reason - 취소 사유
 * @param cancelAmount - 취소 금액 (부분 취소 시)
 */
export async function cancelPayment(
  impUid: string,
  reason: string,
  cancelAmount?: number
) {
  const token = await getIamportToken();

  const response = await fetch(`${IAMPORT_API_URL}/payments/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      imp_uid: impUid,
      reason,
      ...(cancelAmount ? { amount: cancelAmount } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel payment: ${response.statusText}`);
  }

  const data: IamportPaymentResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`Iamport API error: ${data.message}`);
  }

  return data.response;
}
