'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  ChevronRight,
  ChevronLeft,
  Monitor,
  BarChart3,
  Zap,
  Settings,
  Shield,
  FileDown,
  Loader2,
  Lightbulb,
  AlertTriangle,
  List,
  Hash,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateDownloadFilename } from '@/lib/utils/filename';
import {
  MANUAL_DATA,
  getChapter,
  getArticle,
  getAdjacentArticles,
  searchManual,
  type Chapter,
  type Article,
  type Block,
} from '@/lib/data/manual-content';
import { toast } from '@/lib/toast';

// ──────────────────────────────────────────────
// 아이콘 매핑 (챕터별)
// ──────────────────────────────────────────────
const CHAPTER_ICONS: Record<string, React.ElementType> = {
  'getting-started': BookOpen,
  monitoring:        Monitor,
  analytics:         BarChart3,
  control:           Zap,
  management:        Settings,
  compliance:        Shield,
};

function getChapterIcon(id: string): React.ElementType {
  return CHAPTER_ICONS[id] ?? BookOpen;
}

// ──────────────────────────────────────────────
// 콘텐츠 블록 렌더러
// ──────────────────────────────────────────────
function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'p':
      return <p className="text-slate-300 text-sm leading-relaxed">{block.text}</p>;

    case 'steps':
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );

    case 'list':
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'tip':
      return (
        <div className="flex gap-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-4 py-3">
          <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-cyan-300 leading-relaxed">{block.text}</p>
        </div>
      );

    case 'warn':
      return (
        <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300 leading-relaxed">{block.text}</p>
        </div>
      );

    case 'roles':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 pr-4 text-slate-400 font-medium w-48">역할</th>
                <th className="text-left py-2 text-slate-400 font-medium">설명</th>
              </tr>
            </thead>
            <tbody>
              {block.items.map((row, i) => (
                <tr key={i} className="border-b border-slate-800">
                  <td className="py-2.5 pr-4 text-cyan-300 font-medium whitespace-nowrap">{row.role}</td>
                  <td className="py-2.5 text-slate-300">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

// ──────────────────────────────────────────────
// 뷰 타입
// ──────────────────────────────────────────────
type View =
  | { type: 'toc' }
  | { type: 'chapter'; chapterId: string }
  | { type: 'article'; chapterId: string; articleId: string };

// ──────────────────────────────────────────────
// TOC 화면 — 챕터 그리드
// ──────────────────────────────────────────────
function TocView({ onSelectChapter }: { onSelectChapter: (id: string) => void }) {
  const totalArticles = MANUAL_DATA.chapters.reduce(
    (acc, c) => acc + c.articles.length, 0
  );

  return (
    <div className="space-y-6">
      {/* 메타 정보 */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5" />
          {MANUAL_DATA.chapters.length}개 챕터
        </span>
        <span className="flex items-center gap-1.5">
          <List className="w-3.5 h-3.5" />
          {totalArticles}개 아티클
        </span>
        <span>최종 업데이트: {MANUAL_DATA.updatedAt}</span>
        <span>v{MANUAL_DATA.version}</span>
      </div>

      {/* 챕터 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MANUAL_DATA.chapters.map((chapter, idx) => {
          const Icon = getChapterIcon(chapter.id);
          return (
            <button
              key={chapter.id}
              onClick={() => onSelectChapter(chapter.id)}
              className="group bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 text-left transition-all hover:bg-slate-800"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-slate-700/50">
                  <Icon className={cn('w-5 h-5', chapter.color)} />
                </div>
                <span className="text-xs text-slate-600 font-mono">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                {chapter.title}
              </h3>
              <div className="space-y-1">
                {chapter.articles.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                    <span className="truncate">{a.title}</span>
                  </div>
                ))}
                {chapter.articles.length > 3 && (
                  <p className="text-xs text-slate-600 pl-4">
                    +{chapter.articles.length - 3}개 더보기
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 챕터 화면 — 아티클 목록
// ──────────────────────────────────────────────
function ChapterView({
  chapter,
  onSelectArticle,
  onBack,
}: {
  chapter: Chapter;
  onSelectArticle: (articleId: string) => void;
  onBack: () => void;
}) {
  const Icon = getChapterIcon(chapter.id);
  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        전체 목차
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-800 rounded-xl">
          <Icon className={cn('w-6 h-6', chapter.color)} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{chapter.title}</h2>
          <p className="text-xs text-slate-500">{chapter.articles.length}개 아티클</p>
        </div>
      </div>

      <div className="space-y-2">
        {chapter.articles.map((article, idx) => (
          <button
            key={article.id}
            onClick={() => onSelectArticle(article.id)}
            className="w-full flex items-center gap-4 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-5 py-4 text-left transition-all hover:bg-slate-800 group"
          >
            <span className="text-xs text-slate-600 font-mono w-6 flex-shrink-0">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors truncate">
                {article.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{article.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 아티클 화면 — 상세 콘텐츠
// ──────────────────────────────────────────────
function ArticleView({
  chapterId,
  article,
  onBack,
  onNavigate,
}: {
  chapterId: string;
  article: Article;
  onBack: () => void;
  onNavigate: (chapterId: string, articleId: string) => void;
}) {
  const chapter = getChapter(chapterId)!;
  const { prev, next } = getAdjacentArticles(chapterId, article.id);

  return (
    <div className="space-y-6">
      {/* 브레드크럼 */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
        <button
          onClick={() => onNavigate('', '')}
          className="hover:text-slate-300 transition-colors"
        >
          매뉴얼
        </button>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        <button onClick={onBack} className="hover:text-slate-300 transition-colors">
          {chapter.title}
        </button>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-slate-300 font-medium">{article.title}</span>
      </nav>

      {/* 아티클 헤더 */}
      <div className="border-b border-slate-700/50 pb-5">
        <h2 className="text-2xl font-bold text-white mb-1">{article.title}</h2>
        <p className="text-slate-400 text-sm">{article.description}</p>
      </div>

      {/* 본문 */}
      <div className="space-y-5">
        {article.body.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>

      {/* 이전 / 다음 */}
      <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-700/50">
        {prev ? (
          <button
            onClick={() => onNavigate(prev.chapterId, prev.article.id)}
            className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition text-left group"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0 mt-0.5 transition-colors" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">이전</p>
              <p className="text-sm text-slate-300 group-hover:text-white truncate transition-colors">
                {prev.article.title}
              </p>
            </div>
          </button>
        ) : <div />}

        {next ? (
          <button
            onClick={() => onNavigate(next.chapterId, next.article.id)}
            className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition text-right group justify-end"
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">다음</p>
              <p className="text-sm text-slate-300 group-hover:text-white truncate transition-colors">
                {next.article.title}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0 mt-0.5 transition-colors" />
          </button>
        ) : <div />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 검색 결과 화면
// ──────────────────────────────────────────────
function SearchResultsView({
  query,
  onSelectArticle,
  onClear,
}: {
  query: string;
  onSelectArticle: (chapterId: string, articleId: string) => void;
  onClear: () => void;
}) {
  const results = useMemo(() => searchManual(query), [query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="text-white font-medium">"{query}"</span> 검색 결과{' '}
          <span className="text-cyan-400">{results.length}건</span>
        </p>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          초기화
        </button>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base">검색 결과가 없습니다.</p>
          <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(({ chapterId, chapterTitle, article, matchIn }) => (
            <button
              key={`${chapterId}-${article.id}`}
              onClick={() => onSelectArticle(chapterId, article.id)}
              className="w-full flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 rounded-xl px-5 py-4 text-left transition-all hover:bg-slate-800 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">
                    {chapterTitle}
                  </span>
                  {matchIn === 'title' && (
                    <span className="text-[10px] text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      제목 일치
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
                  {article.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{article.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
export default function ManualPage() {
  const [view, setView] = useState<View>({ type: 'toc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const goToc     = ()                                       => { setView({ type: 'toc' }); setSearchQuery(''); };
  const goChapter = (chapterId: string)                     => setView({ type: 'chapter', chapterId });
  const goArticle = (chapterId: string, articleId: string)  => {
    if (!chapterId && !articleId) { goToc(); return; }
    setView({ type: 'article', chapterId, articleId });
    setSearchQuery('');
  };

  const currentChapter = view.type !== 'toc' ? getChapter(view.chapterId) : undefined;
  const currentArticle = view.type === 'article' ? getArticle(view.chapterId, view.articleId) : undefined;

  async function handleDownloadPdf() {
    setIsPdfLoading(true);
    try {
      const res = await fetch('/api/manual/pdf');
      if (!res.ok) throw new Error('PDF 생성 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateDownloadFilename('사용자매뉴얼', '', 'pdf');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsPdfLoading(false);
    }
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#051225] text-white overflow-hidden">

      {/* ─── 좌측 TOC 사이드바 ─────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-slate-900/60 border-r border-slate-700/50 overflow-y-auto flex-shrink-0">
        {/* 헤더 */}
        <div className="px-4 py-5 border-b border-slate-700/50">
          <button
            onClick={goToc}
            className="flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-300 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            사용자 매뉴얼
          </button>
          <p className="text-[10px] text-slate-500 mt-1">
            v{MANUAL_DATA.version} · {MANUAL_DATA.updatedAt}
          </p>
        </div>

        {/* 챕터 + 아티클 목록 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {MANUAL_DATA.chapters.map((chapter, idx) => {
            const Icon = getChapterIcon(chapter.id);
            const isActiveChapter = view.type !== 'toc' && view.chapterId === chapter.id;

            return (
              <div key={chapter.id}>
                <button
                  onClick={() => goChapter(chapter.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActiveChapter
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', chapter.color)} />
                  <span className="font-medium truncate">{chapter.title}</span>
                  <span className="ml-auto text-[10px] text-slate-600">{idx + 1}</span>
                </button>

                {/* 활성 챕터의 아티클 서브 목록 */}
                {isActiveChapter && (
                  <div className="ml-3 pl-3 border-l border-slate-700/50 mt-1 mb-2 space-y-0.5">
                    {chapter.articles.map((article) => {
                      const isActive =
                        view.type === 'article' && view.articleId === article.id;
                      return (
                        <button
                          key={article.id}
                          onClick={() => goArticle(chapter.id, article.id)}
                          className={cn(
                            'w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors truncate',
                            isActive
                              ? 'text-cyan-400 bg-cyan-500/10 font-medium'
                              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                          )}
                        >
                          {article.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* PDF 다운로드 */}
        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={handleDownloadPdf}
            disabled={isPdfLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isPdfLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileDown className="w-3.5 h-3.5" />}
            {isPdfLoading ? 'PDF 생성 중...' : 'PDF 전체 다운로드'}
          </button>
        </div>
      </aside>

      {/* ─── 본문 영역 ──────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">

          {/* 헤더 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                사용자 매뉴얼
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">탄소이음 에너지 관리 시스템 가이드</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* PDF 다운로드 (모바일) */}
              <button
                onClick={handleDownloadPdf}
                disabled={isPdfLoading}
                className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
              >
                {isPdfLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />}
                PDF
              </button>

              {/* 검색 */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="매뉴얼 전체 검색..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 콘텐츠 라우팅 */}
          {isSearching ? (
            <SearchResultsView
              query={searchQuery}
              onSelectArticle={goArticle}
              onClear={() => setSearchQuery('')}
            />
          ) : view.type === 'toc' ? (
            <>
              <TocView onSelectChapter={goChapter} />
              <div className="pt-2 border-t border-slate-700/50">
                <Link
                  href="/docs/api"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  외부 연동용 API 문서 보기
                </Link>
              </div>
            </>
          ) : view.type === 'chapter' && currentChapter ? (
            <ChapterView
              chapter={currentChapter}
              onSelectArticle={(aId) => goArticle(view.chapterId, aId)}
              onBack={goToc}
            />
          ) : view.type === 'article' && currentArticle ? (
            <ArticleView
              chapterId={view.chapterId}
              article={currentArticle}
              onBack={() => goChapter(view.chapterId)}
              onNavigate={goArticle}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
