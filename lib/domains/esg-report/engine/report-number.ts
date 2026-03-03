/**
 * ESG Report 채번 (ESG-YYYYMMDD-NNNN)
 * activity_log_seq 테이블과 동일한 방식으로 MySQL 원자적 채번
 */

import { prisma } from '@/lib/db/prisma';

export async function generateReportNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const seqKey = `ESG_${dateStr}`;

  // MySQL ON DUPLICATE KEY UPDATE로 원자적 채번
  await prisma.$executeRaw`
    INSERT INTO activity_log_seq (seq_key, last_seq)
    VALUES (${seqKey}, 1)
    ON DUPLICATE KEY UPDATE last_seq = last_seq + 1
  `;

  const result = await prisma.$queryRaw<Array<{ last_seq: number }>>`
    SELECT last_seq FROM activity_log_seq WHERE seq_key = ${seqKey}
  `;

  const seq = result[0]?.last_seq ?? 1;
  const seqStr = String(seq).padStart(4, '0');
  return `ESG-${dateStr}-${seqStr}`;
}
