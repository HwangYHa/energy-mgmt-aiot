/**
 * 다운로드 파일명 생성 유틸리티
 *
 * 규칙: [한글설명]_[단축ID]_[YYYYMMDD]_[HHMM].[확장자]
 * 예시: 에너지보고서_A1B2C3D4_20260219_1430.pdf
 */

/**
 * 날짜를 YYYYMMDD 형식으로 포맷
 */
function formatDate(date: Date): string {
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  return `${Y}${M}${D}`;
}

/**
 * 시각을 HHMM 형식으로 포맷
 */
function formatTime(date: Date): string {
  const H = String(date.getHours()).padStart(2, '0');
  const I = String(date.getMinutes()).padStart(2, '0');
  return `${H}${I}`;
}

/**
 * 다운로드용 파일명 생성
 *
 * @param koreanName - 한글 설명 (예: '에너지보고서', '원시데이터', '탄소배출보고서')
 * @param uniqueId   - UUID 또는 레코드 ID (앞 8자를 사용)
 * @param extension  - 파일 확장자 (pdf, xlsx, csv 등, 점 제외)
 * @param date       - 기준 날짜 (기본값: 현재 시각)
 * @returns 파일명 문자열
 *
 * @example
 * generateDownloadFilename('에너지보고서', 'abc123', 'pdf')
 * // → '에너지보고서_ABC12300_20260219_1430.pdf'
 */
export function generateDownloadFilename(
  koreanName: string,
  uniqueId: string,
  extension: string,
  date: Date = new Date(),
): string {
  // UUID 하이픈 제거 후 앞 8자 대문자
  const shortId = uniqueId.replace(/-/g, '').slice(0, 8).toUpperCase();
  // 파일명에 사용 불가한 문자 제거
  const safeName = koreanName.replace(/[/\\:*?"<>|\s]/g, '_');
  const safeExt = extension.replace(/^\./, ''); // 앞 점 제거
  return `${safeName}_${shortId}_${formatDate(date)}_${formatTime(date)}.${safeExt}`;
}

/**
 * Content-Disposition 헤더 값 생성 (RFC 5987 인코딩)
 *
 * @param filename - generateDownloadFilename() 반환값
 * @param inline   - true면 브라우저에서 열기, false면 다운로드
 */
export function contentDispositionHeader(filename: string, inline = false): string {
  const disposition = inline ? 'inline' : 'attachment';
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}
