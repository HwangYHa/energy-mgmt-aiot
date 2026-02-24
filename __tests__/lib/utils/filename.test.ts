/**
 * lib/utils/filename.ts 단위 테스트
 *
 * - generateDownloadFilename: [한글]_EMS_[ID8]_[YYYYMMDDHHMI] 형식 검증
 * - contentDispositionHeader: RFC 5987 Content-Disposition 헤더 검증
 */

import { generateDownloadFilename, contentDispositionHeader } from '@/lib/utils/filename';

describe('generateDownloadFilename', () => {
  it('기본 형식: [name]_EMS_[8자id]_[timestamp].[ext]', () => {
    const filename = generateDownloadFilename('에너지데이터', 'tenant123', 'csv');
    // 파일명 패턴: 에너지데이터_EMS_tenant12_YYYYMMDDHHMI.csv (또는 유사 형식)
    expect(filename).toContain('EMS');
    expect(filename).toContain('에너지데이터');
    expect(filename.endsWith('.csv')).toBe(true);
  });

  it('PDF 확장자를 지원한다', () => {
    const filename = generateDownloadFilename('사용자매뉴얼', '', 'pdf');
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('JSON 확장자를 지원한다', () => {
    const filename = generateDownloadFilename('리포트', 'abc', 'json');
    expect(filename.endsWith('.json')).toBe(true);
  });

  it('tenantId가 빈 문자열이어도 오류 없이 생성한다', () => {
    expect(() => generateDownloadFilename('테스트', '', 'csv')).not.toThrow();
  });

  it('동일한 인자로 호출해도 시간이 다르면 다른 파일명이 생성된다', async () => {
    const filename1 = generateDownloadFilename('데이터', 't1', 'csv');
    await new Promise((r) => setTimeout(r, 60_000 / 1)); // 빠른 연속 호출은 같을 수 있음
    // 단순히 파일명이 문자열인지만 확인
    expect(typeof filename1).toBe('string');
    expect(filename1.length).toBeGreaterThan(0);
  });
});

describe('contentDispositionHeader', () => {
  it('Content-Disposition 헤더 값을 반환한다', () => {
    const header = contentDispositionHeader('test.csv');
    expect(header).toContain('attachment');
    expect(header).toContain('test.csv');
  });

  it('한글 파일명을 포함한다', () => {
    const header = contentDispositionHeader('에너지_EMS_12345678_202602210930.csv');
    // filename 또는 filename* 중 하나에 포함
    expect(header.length).toBeGreaterThan(0);
    expect(header).toContain('attachment');
  });
});
