/**
 * GET /api/manual/pdf — 사용자 매뉴얼 PDF 생성 (PDFKit)
 *
 * lib/data/manual-content.ts (Single Source of Truth)에서 데이터를 가져와
 * PDFKit으로 직접 PDF를 생성합니다. (Puppeteer 불필요)
 *
 * 한글 폰트 우선순위:
 *   1. public/fonts/NanumGothic.ttf  (프로젝트 내 배포 폰트)
 *   2. C:\Windows\Fonts\malgun.ttf   (Windows 개발 환경)
 *   3. /usr/share/fonts/.../NanumGothic.ttf (Linux/Docker)
 *   4. Helvetica 폴백 (한글 미표시, 긴급용)
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { verifyAuth } from '@/lib/auth/verify';
import { generateDownloadFilename, contentDispositionHeader } from '@/lib/utils/filename';
import { MANUAL_DATA, type Block, type Chapter } from '@/lib/data/manual-content';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// 폰트 탐색
// ──────────────────────────────────────────────

const FONT_CANDIDATES = [
  path.join(process.cwd(), 'public/fonts/NanumGothic.ttf'),
  'C:\\Windows\\Fonts\\malgun.ttf',
  'C:\\Windows\\Fonts\\NanumGothic.ttf',
  '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
  '/usr/share/fonts/nanum/NanumGothic.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/System/Library/Fonts/AppleSDGothicNeo.ttc',
];

function findKoreanFont(): string | null {
  for (const p of FONT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ──────────────────────────────────────────────
// PDF 생성
// ──────────────────────────────────────────────

const COLORS = {
  primary: '#0369a1',
  heading2Bg: '#f1f5f9',
  heading2Border: '#0369a1',
  heading3: '#1e40af',
  body: '#334155',
  tip: '#0369a1',
  tipBg: '#f0f9ff',
  warn: '#92400e',
  warnBg: '#fffbeb',
  muted: '#64748b',
  border: '#e2e8f0',
  rolePrimary: '#0369a1',
  tableHeader: '#f1f5f9',
  white: '#ffffff',
  black: '#1e293b',
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function generateManualPdf(fontPath: string | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit') as typeof import('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
      info: {
        Title: '탄소이음 사용자 매뉴얼',
        Author: '탄소이음',
        Subject: '에너지 관리 시스템 사용 가이드',
        Keywords: '탄소이음, EMS, 에너지, 탄소중립',
        CreationDate: new Date(),
      },
    });

    // 폰트 등록
    const FONT = 'BodyFont';
    const FONT_BOLD = 'BoldFont';
    if (fontPath) {
      doc.registerFont(FONT, fontPath);
      doc.registerFont(FONT_BOLD, fontPath); // Bold 별도 파일 없으면 동일 사용
    } else {
      doc.registerFont(FONT, 'Helvetica');
      doc.registerFont(FONT_BOLD, 'Helvetica-Bold');
      console.warn('[PDF] 한글 폰트 없음 — public/fonts/NanumGothic.ttf 파일을 배치하세요.');
    }

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // 페이지 번호 삽입 (각 페이지 완료 이벤트)
    doc.on('pageAdded', () => {
      const pageNum = doc.bufferedPageRange().start + doc.bufferedPageRange().count;
      doc.switchToPage(pageNum - 1);
      doc
        .font(FONT)
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`탄소이음 사용자 매뉴얼 v${MANUAL_DATA.version}`, MARGIN, PAGE_WIDTH + 5, {
          width: CONTENT_WIDTH / 2,
          align: 'left',
        });
    });

    // ── 1. 표지 ──────────────────────────────
    const generatedAt = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    doc.font(FONT_BOLD).fontSize(22).fillColor(COLORS.primary)
      .text('탄소이음 사용자 매뉴얼', { align: 'center' });
    doc.moveDown(0.4);
    doc.font(FONT).fontSize(11).fillColor(COLORS.muted)
      .text('탄소이음 — 에너지 데이터로 세상을 잇다', { align: 'center' });
    doc.moveDown(0.3);
    doc.font(FONT).fontSize(9).fillColor('#94a3b8')
      .text(
        `버전 ${MANUAL_DATA.version}  ·  최종 업데이트: ${MANUAL_DATA.updatedAt}  ·  발행일: ${generatedAt}`,
        { align: 'center' }
      );
    doc.moveDown(1.5);

    // 제목 구분선
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y)
      .strokeColor(COLORS.primary).lineWidth(2).stroke();
    doc.moveDown(1.5);

    // ── 2. 목차 ──────────────────────────────
    const tocY = doc.y;
    doc.rect(MARGIN, tocY - 6, CONTENT_WIDTH, 26).fill(COLORS.heading2Bg);
    doc.font(FONT_BOLD).fontSize(13).fillColor(COLORS.black)
      .text('목차 (Table of Contents)', MARGIN + 8, tocY + 2);
    doc.moveDown(0.8);

    MANUAL_DATA.chapters.forEach((chapter, ci) => {
      doc.font(FONT_BOLD).fontSize(10).fillColor(COLORS.black)
        .text(`${ci + 1}. ${chapter.title}`, MARGIN + 4, doc.y);
      doc.font(FONT).fontSize(9).fillColor(COLORS.muted)
        .text(chapter.articles.map((a) => a.title).join('  /  '), MARGIN + 16, doc.y, {
          width: CONTENT_WIDTH - 16,
        });
      doc.moveDown(0.3);
    });

    doc.moveDown(1);

    // ── 3. 챕터 본문 ─────────────────────────
    MANUAL_DATA.chapters.forEach((chapter, ci) => {
      renderChapter(doc, chapter, ci, FONT, FONT_BOLD);
    });

    doc.end();
  });
}

// ──────────────────────────────────────────────
// 챕터 / 아티클 렌더러
// ──────────────────────────────────────────────

function renderChapter(
  doc: InstanceType<typeof import('pdfkit')>,
  chapter: Chapter,
  chapterIndex: number,
  FONT: string,
  FONT_BOLD: string
): void {
  // 챕터 헤더
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 28).fill(COLORS.heading2Bg);
  doc.rect(MARGIN, y, 4, 28).fill(COLORS.heading2Border);
  doc.font(FONT_BOLD).fontSize(14).fillColor(COLORS.black)
    .text(`${chapterIndex + 1}. ${chapter.title}`, MARGIN + 12, y + 7, { width: CONTENT_WIDTH - 16 });
  doc.moveDown(1.2);

  // 아티클 목록
  chapter.articles.forEach((article, ai) => {
    // H3 아티클 제목
    doc.font(FONT_BOLD).fontSize(11).fillColor(COLORS.heading3)
      .text(`${chapterIndex + 1}.${ai + 1} ${article.title}`, { paragraphGap: 3 });
    doc.moveDown(0.4);

    // 본문 블록
    article.body.forEach((block) => {
      renderBlock(doc, block, FONT, FONT_BOLD);
    });

    doc.moveDown(0.6);
  });
}

function renderBlock(
  doc: InstanceType<typeof import('pdfkit')>,
  block: Block,
  FONT: string,
  FONT_BOLD: string
): void {
  switch (block.type) {
    case 'p':
      doc.font(FONT).fontSize(10).fillColor(COLORS.body)
        .text(block.text, MARGIN + 2, doc.y, { width: CONTENT_WIDTH - 4, paragraphGap: 2 });
      doc.moveDown(0.4);
      break;

    case 'steps':
      block.items.forEach((item, i) => {
        const stepY = doc.y;
        // 번호 원형 배경
        doc.circle(MARGIN + 8, stepY + 7, 8).fill('#e0f2fe');
        doc.font(FONT_BOLD).fontSize(8).fillColor(COLORS.primary)
          .text(`${i + 1}`, MARGIN + 5, stepY + 3.5, { width: 10, align: 'center' });
        doc.font(FONT).fontSize(10).fillColor(COLORS.body)
          .text(item, MARGIN + 22, stepY, { width: CONTENT_WIDTH - 26 });
        doc.moveDown(0.4);
      });
      break;

    case 'list':
      block.items.forEach((item) => {
        doc.font(FONT).fontSize(10).fillColor(COLORS.body)
          .text(`• ${item}`, MARGIN + 8, doc.y, { width: CONTENT_WIDTH - 12, paragraphGap: 2 });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.2);
      break;

    case 'tip': {
      const tipY = doc.y;
      // 배경박스
      doc.save();
      doc.rect(MARGIN, tipY, CONTENT_WIDTH, 1).fill(COLORS.tipBg); // placeholder height
      doc.restore();
      const beforeY = doc.y;
      doc.rect(MARGIN, beforeY, 3, 1).fill('#38bdf8'); // left border placeholder
      doc.font(FONT).fontSize(9.5).fillColor(COLORS.tip)
        .text(`💡  ${block.text}`, MARGIN + 10, beforeY + 4, {
          width: CONTENT_WIDTH - 14,
        });
      const afterY = doc.y + 4;
      // Draw background rect retroactively
      doc.rect(MARGIN, beforeY, CONTENT_WIDTH, afterY - beforeY + 2).fill(COLORS.tipBg);
      doc.rect(MARGIN, beforeY, 3, afterY - beforeY + 2).fill('#38bdf8');
      // Re-render text on top
      doc.font(FONT).fontSize(9.5).fillColor(COLORS.tip)
        .text(`💡  ${block.text}`, MARGIN + 10, beforeY + 4, {
          width: CONTENT_WIDTH - 14,
        });
      doc.moveDown(0.6);
      break;
    }

    case 'warn': {
      const warnBeforeY = doc.y;
      doc.font(FONT).fontSize(9.5).fillColor(COLORS.warn)
        .text(`⚠️  ${block.text}`, MARGIN + 10, warnBeforeY + 4, {
          width: CONTENT_WIDTH - 14,
        });
      const warnAfterY = doc.y + 4;
      doc.rect(MARGIN, warnBeforeY, CONTENT_WIDTH, warnAfterY - warnBeforeY + 2).fill(COLORS.warnBg);
      doc.rect(MARGIN, warnBeforeY, 3, warnAfterY - warnBeforeY + 2).fill('#f59e0b');
      doc.font(FONT).fontSize(9.5).fillColor(COLORS.warn)
        .text(`⚠️  ${block.text}`, MARGIN + 10, warnBeforeY + 4, {
          width: CONTENT_WIDTH - 14,
        });
      doc.moveDown(0.6);
      break;
    }

    case 'roles': {
      // 테이블 헤더
      const colRole = 120;
      const colDesc = CONTENT_WIDTH - colRole;
      const rowH = 18;
      let tableY = doc.y;

      // Header row
      doc.rect(MARGIN, tableY, colRole, rowH).fill(COLORS.tableHeader);
      doc.rect(MARGIN + colRole, tableY, colDesc, rowH).fill(COLORS.tableHeader);
      doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.muted)
        .text('역할', MARGIN + 4, tableY + 5, { width: colRole - 8 });
      doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.muted)
        .text('설명', MARGIN + colRole + 4, tableY + 5, { width: colDesc - 8 });
      tableY += rowH;

      block.items.forEach((r) => {
        // 텍스트 높이 계산 (동적 행 높이)
        const descHeight = Math.max(rowH, doc.heightOfString(r.desc, { width: colDesc - 8 }) + 8);
        doc.rect(MARGIN, tableY, colRole, descHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.rect(MARGIN + colRole, tableY, colDesc, descHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.rolePrimary)
          .text(r.role, MARGIN + 4, tableY + 5, { width: colRole - 8 });
        doc.font(FONT).fontSize(9).fillColor(COLORS.body)
          .text(r.desc, MARGIN + colRole + 4, tableY + 5, { width: colDesc - 8 });
        tableY += descHeight;
        doc.y = tableY;
      });

      doc.moveDown(0.6);
      break;
    }
  }
}

// ──────────────────────────────────────────────
// API 핸들러
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fontPath = findKoreanFont();
    const pdfBuffer = await generateManualPdf(fontPath);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionHeader(
          generateDownloadFilename('사용자매뉴얼', '', 'pdf')
        ),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[manual/pdf GET]', error);
    return NextResponse.json(
      { error: 'PDF 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
