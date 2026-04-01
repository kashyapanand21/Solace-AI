import { useState, useEffect, useRef, useCallback } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { indexText, runSearch } from "./pipeline/main";
import { loadCategories, classifyText } from "./pipeline/classifier";

// ── Types ──────────────────────────────────────────────
interface FileResult {
  text: string;
  score: number;
  label: string;
  confidence: number;
  matchedKeywords: string[];
  fileName: string;
  filePath: string;
  relativePath: string;
  fileType: string;
  fileSize: number;
}

interface IndexedFile {
  filePath: string;
  fileName: string;
  relativePath: string;
  fileType: string;
  fileSize: number;
  text: string;
}

// ── Constants ──────────────────────────────────────────
const TAG_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "Finance":     { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b", bar: "#f59e0b" },
  "Resume":      { bg: "rgba(16,185,129,0.15)",  text: "#10b981", bar: "#10b981" },
  "Study Notes": { bg: "rgba(99,102,241,0.15)",  text: "#818cf8", bar: "#818cf8" },
  "Legal":       { bg: "rgba(239,68,68,0.15)",   text: "#f87171", bar: "#f87171" },
  "Medical":     { bg: "rgba(236,72,153,0.15)",  text: "#f472b6", bar: "#f472b6" },
  "Work":        { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa", bar: "#60a5fa" },
  "Personal":    { bg: "rgba(139,92,246,0.15)",  text: "#a78bfa", bar: "#a78bfa" },
  "Other":       { bg: "rgba(107,114,128,0.15)", text: "#9ca3af", bar: "#9ca3af" },
};

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', docx: '📝', doc: '📝', txt: '📃', md: '📃',
  js: '💻', ts: '💻', jsx: '💻', tsx: '💻', py: '🐍',
  c: '⚙️', cpp: '⚙️', h: '⚙️', java: '☕',
  json: '📊', csv: '📊', html: '🌐', css: '🎨',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function extractMatchedKeywords(text: string, query: string): string[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();
  return queryWords.filter(w => textLower.includes(w));
}

// ── Components ─────────────────────────────────────────
function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <span>{text}</span>;
  const regex = new RegExp(
    `(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'
  );
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        keywords.some(k => part.toLowerCase() === k.toLowerCase())
          ? <mark key={i} style={{
              background: 'rgba(255,69,0,0.25)', color: '#ff6b35',
              borderRadius: '3px', padding: '0 2px', fontWeight: 600
            }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

function CategoryBar({ results }: { results: FileResult[] }) {
  if (!results.length) return null;
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.label] = (counts[r.label] || 0) + 1;
  const categories = Object.entries(counts)
    .map(([label, count]) => ({ label, count, color: TAG_COLORS[label]?.bar || '#9ca3af' }))
    .sort((a, b) => b.count - a.count);

  return (
    <div style={{
      margin: '12px 0', padding: '12px 16px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px', display: 'flex',
      flexWrap: 'wrap' as const, gap: '8px', alignItems: 'center'
    }}>
      <span style={{ fontSize: '10px', color: '#475569', fontWeight: 700,
        textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
        Topics:
      </span>
      {categories.map(({ label, count, color }) => (
        <div key={label} style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px',
          background: TAG_COLORS[label]?.bg || 'rgba(255,255,255,0.05)',
          borderRadius: '20px', border: `1px solid ${color}40`
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
          <span style={{ fontSize: '11px', color, fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: '10px', color: '#64748b',
            background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '10px'
          }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function ResultCard({
  result, onOpen, onCopy, copied
}: {
  result: FileResult;
  onOpen: (path: string) => void;
  onCopy: (path: string) => void;
  copied: string | null;
}) {
  const colors = TAG_COLORS[result.label] || TAG_COLORS["Other"];
  const scorePercent = Math.round(result.score * 100);
  const icon = FILE_ICONS[result.fileType] || '📄';
  const isCopied = copied === result.filePath;

  return (
    <div
      onClick={() => onOpen(result.filePath)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `4px solid ${colors.bar}`,
        borderRadius: '12px', padding: '16px 18px',
        marginBottom: '10px', cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.3)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '8px' }}>

        {/* File info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span style={{ fontSize: '22px' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'white',
              marginBottom: '2px' }}>
              {result.fileName}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
              {result.relativePath || result.filePath}
            </div>
          </div>
        </div>

        {/* Right side: tag + score */}
        <div style={{ display: 'flex', flexDirection: 'column' as const,
          alignItems: 'flex-end', gap: '4px', marginLeft: '12px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 8px',
            borderRadius: '20px', letterSpacing: '0.5px',
            background: colors.bg, color: colors.text,
            border: `1px solid ${colors.bar}40`,
            whiteSpace: 'nowrap' as const
          }}>
            {result.label.toUpperCase()}
          </span>
          <span style={{ fontSize: '11px', color: '#475569' }}>
            {scorePercent}% match
          </span>
        </div>
      </div>

      {/* Snippet */}
      <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6,
        margin: '0 0 10px 0' }}>
        <HighlightedText
          text={result.text.slice(0, 120) + (result.text.length > 120 ? '...' : '')}
          keywords={result.matchedKeywords}
        />
      </p>

      {/* Score bar */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)',
        borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{
          height: '100%', width: `${scorePercent}%`,
          background: colors.bar, borderRadius: '2px',
          transition: 'width 0.5s ease'
        }} />
      </div>

      {/* Bottom row: keywords + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center' }}>

        {/* Matched keywords */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' as const }}>
          {result.matchedKeywords.map(kw => (
            <span key={kw} style={{
              fontSize: '10px', padding: '2px 6px',
              background: 'rgba(255,69,0,0.1)', color: '#ff6b35',
              borderRadius: '4px', border: '1px solid rgba(255,69,0,0.2)'
            }}>
              {kw}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}
          onClick={e => e.stopPropagation()}>

          {/* Copy path */}
          <button
            onClick={() => onCopy(result.filePath)}
            title="Copy file path"
            style={{
              padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
              background: isCopied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isCopied ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '6px',
              color: isCopied ? '#10b981' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {isCopied ? '✓ Copied' : '📋 Copy Path'}
          </button>

          {/* Open file */}
          <button
            onClick={() => onOpen(result.filePath)}
            title="Open file"
            style={{
              padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
              background: 'rgba(255,69,0,0.1)',
              border: '1px solid rgba(255,69,0,0.3)',
              borderRadius: '6px', color: '#ff4500',
              transition: 'all 0.2s'
            }}
          >
            ↗ Open
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────
export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [totalIndexed, setTotalIndexed] = useState(0);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState('');
  const [currentFile, setCurrentFile] = useState('');
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'type'>('score');
  const [copied, setCopied] = useState<string | null>(null);
  const [folderSize, setFolderSize] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accelRef = useRef<string | null>(null);

  useEffect(() => {
    initSDK()
      .then(async () => {
        accelRef.current = getAccelerationMode();
        setSdkReady(true);
        await loadCategories();
      })
      .catch(err => setSdkError(err instanceof Error ? err.message : String(err)));
  }, []);

  // ── Sort results ───────────────────────────────────
  const getSortedResults = (res: FileResult[]) => {
    if (sortBy === 'score') return [...res].sort((a, b) => b.score - a.score);
    if (sortBy === 'name') return [...res].sort((a, b) =>
      a.fileName.localeCompare(b.fileName));
    if (sortBy === 'type') return [...res].sort((a, b) =>
      a.fileType.localeCompare(b.fileType));
    return res;
  };

  // ── Search ─────────────────────────────────────────
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim() || !sdkReady || indexedFiles.length === 0) {
      setResults([]);
      setSearchTime(null);
      return;
    }

    setSearching(true);
    const start = performance.now();

    try {
      const raw = await runSearch(q);
      const enriched = await Promise.all(
        raw.map(async (r: { text: string; score: number }, i: number) => {
          const { label, confidence } = await classifyText(r.text);
          const matchedKeywords = extractMatchedKeywords(r.text, q);
          const fileInfo = indexedFiles[i] || {};
          return {
            ...r, label, confidence, matchedKeywords,
            fileName: fileInfo.fileName || 'Unknown',
            filePath: fileInfo.filePath || '',
            relativePath: fileInfo.relativePath || '',
            fileType: fileInfo.fileType || 'txt',
            fileSize: fileInfo.fileSize || 0,
          };
        })
      );

      setResults(enriched);
      setSearchTime(Math.round(performance.now() - start));

      // Save to recent searches
      if (q.trim()) {
        setRecentSearches(prev => {
          const updated = [q, ...prev.filter(s => s !== q)].slice(0, 5);
          return updated;
        });
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  }, [sdkReady, indexedFiles]);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  // ── Folder indexing ────────────────────────────────
  const handleFolderIndex = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const folder = await api.pickFolder();
    if (!folder) return;

    setFolderPath(folder);
    setIndexing(true);
    setResults([]);
    setQuery('');
    setIndexedFiles([]);

    // Listen for per-file progress
    api.onIndexProgress(({ fileName, current, total }: any) => {
      setCurrentFile(fileName);
      setIndexProgress(`${current}/${total}`);
    });

    const { files, folderSize: fSize } = await api.scanFolder(folder);
    setFolderSize(fSize);

    for (const file of files) {
      await indexText(file.text);
    }

    setIndexedFiles(files);
    setTotalIndexed(files.length);
    api.removeIndexProgress();
    setIndexing(false);
    setIndexProgress('');
    setCurrentFile('');
  };

  // ── Open file ──────────────────────────────────────
  const handleOpenFile = async (filePath: string) => {
    const api = (window as any).electronAPI;
    if (api && filePath) await api.openFile(filePath);
  };

  // ── Copy path ──────────────────────────────────────
  const handleCopyPath = (filePath: string) => {
    navigator.clipboard.writeText(filePath);
    setCopied(filePath);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Loading screen ─────────────────────────────────
  if (sdkError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: 'white' }}>
      <h2>SDK Error</h2>
      <p style={{ color: '#ef4444' }}>{sdkError}</p>
    </div>
  );

  if (!sdkReady) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#0a0a0f',
      color: 'white', gap: '16px' }}>
      <div style={{
        width: '40px', height: '40px', border: '3px solid #1e293b',
        borderTopColor: '#ff4500', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <h2 style={{ margin: 0 }}>Loading VaultFind</h2>
      <p style={{ color: '#64748b', margin: 0 }}>Initializing on-device AI...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const sortedResults = getSortedResults(results);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f',
      color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%',
          width: '50%', height: '50%',
          background: 'radial-gradient(circle, rgba(255,69,0,0.07) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '40%', height: '40%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1,
        maxWidth: '820px', margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px' }}>🔍</span>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900,
              letterSpacing: '-1px' }}>
              Vault<span style={{ color: '#ff4500' }}>Find</span>
            </h1>
            {accelRef.current && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '6px', background: '#ff4500', color: 'white',
                textTransform: 'uppercase', letterSpacing: '1px'
              }}>
                {accelRef.current === 'webgpu' ? 'WebGPU ⚡' : 'CPU'}
              </span>
            )}
          </div>
          <p style={{ color: '#334155', margin: '0 0 20px', fontSize: '12px',
            letterSpacing: '0.15em' }}>
            ON-DEVICE AI · OFFLINE · PRIVATE
          </p>

          {/* Folder picker */}
          {!folderPath ? (
            <button onClick={handleFolderIndex} style={{
              padding: '12px 28px',
              background: 'rgba(255,69,0,0.08)',
              border: '2px solid rgba(255,69,0,0.35)',
              borderRadius: '12px', color: '#ff4500',
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.5px',
              transition: 'all 0.2s'
            }}>
              📁 SELECT FOLDER TO INDEX
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center',
              gap: '10px', justifyContent: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                📁 <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                  {folderPath.split(/[\\/]/).pop()}
                </span>
              </span>
              <span style={{ color: '#1e293b' }}>·</span>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                {totalIndexed} files indexed
              </span>
              <button onClick={handleFolderIndex} style={{
                padding: '4px 12px', fontSize: '11px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: '#475569', cursor: 'pointer'
              }}>
                Change
              </button>
            </div>
          )}

          {/* Indexing progress */}
          {indexing && (
            <div style={{ marginTop: '16px', padding: '14px 18px',
              background: 'rgba(255,69,0,0.05)',
              border: '1px solid rgba(255,69,0,0.15)',
              borderRadius: '10px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center',
                gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '14px', height: '14px',
                  border: '2px solid rgba(255,69,0,0.2)',
                  borderTopColor: '#ff4500', borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite', flexShrink: 0
                }} />
                <span style={{ fontSize: '13px', color: '#ff4500', fontWeight: 600 }}>
                  Indexing {indexProgress}
                </span>
              </div>
              {currentFile && (
                <div style={{ fontSize: '11px', color: '#475569',
                  fontFamily: 'monospace', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  ⚙️ {currentFile}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search bar — only show after indexing done */}
        {totalIndexed > 0 && !indexing && (
          <>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <span style={{
                position: 'absolute', left: '16px', top: '50%',
                transform: 'translateY(-50%)', fontSize: '18px', pointerEvents: 'none'
              }}>🔍</span>
              <input
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Search by meaning... try 'sorting algorithm' or 'main function'"
                autoFocus
                style={{
                  width: '100%', padding: '14px 18px 14px 48px',
                  fontSize: '15px',
                  background: 'rgba(255,255,255,0.04)',
                  border: query
                    ? '2px solid rgba(255,69,0,0.5)'
                    : '2px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', color: 'white',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
              {searching && (
                <div style={{
                  position: 'absolute', right: '16px', top: '50%',
                  transform: 'translateY(-50%)', width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#ff4500', borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
              )}
            </div>

            {/* Recent searches */}
            {!query && recentSearches.length > 0 && (
              <div style={{ display: 'flex', gap: '6px',
                flexWrap: 'wrap' as const, marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: '#334155',
                  alignSelf: 'center' }}>Recent:</span>
                {recentSearches.map(s => (
                  <button key={s} onClick={() => handleInput(s)} style={{
                    padding: '3px 10px', fontSize: '12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px', color: '#64748b',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>
                    🕐 {s}
                  </button>
                ))}
              </div>
            )}

            {/* Results meta + sort */}
            {results.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                  Found{' '}
                  <span style={{ color: '#ff4500', fontWeight: 600 }}>
                    {results.length}
                  </span> results in{' '}
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    {searchTime}ms
                  </span> — all on-device
                </p>

                {/* Sort buttons */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['score', 'name', 'type'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)} style={{
                      padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
                      background: sortBy === s
                        ? 'rgba(255,69,0,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${sortBy === s
                        ? 'rgba(255,69,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '6px',
                      color: sortBy === s ? '#ff4500' : '#475569',
                      transition: 'all 0.15s', fontWeight: sortBy === s ? 700 : 400
                    }}>
                      {s === 'score' ? '🎯 Best' : s === 'name' ? '🔤 Name' : '📂 Type'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category bar */}
            {results.length > 0 && <CategoryBar results={sortedResults} />}

            {/* Results */}
            <div style={{ marginTop: '8px' }}>
              {sortedResults.map((r, i) => (
                <ResultCard
                  key={i} result={r}
                  onOpen={handleOpenFile}
                  onCopy={handleCopyPath}
                  copied={copied}
                />
              ))}
            </div>

            {/* No results */}
            {query && !searching && results.length === 0 && searchTime !== null && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                <p style={{ margin: 0 }}>No results for "{query}"</p>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#1e293b' }}>
                  Try different keywords
                </p>
              </div>
            )}
          </>
        )}

        {/* Empty state before indexing */}
        {!folderPath && !indexing && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.15 }}>🗂️</div>
            <p style={{ color: '#1e293b', margin: 0, fontSize: '14px' }}>
              Select a folder to begin indexing your files
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '10px 24px',
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', color: '#1e293b' }}>
          {totalIndexed > 0
            ? `📦 ${totalIndexed} files · ${formatSize(folderSize)}`
            : '📦 No files indexed'}
        </span>
        <span style={{ fontSize: '11px', color: '#1e293b' }}>
          🔒 All data stays on your device
        </span>
        <span style={{ fontSize: '11px', color: '#1e293b' }}>
          ⚡ RunAnywhere {accelRef.current === 'webgpu' ? 'WebGPU' : 'CPU'}
        </span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #334155; }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}