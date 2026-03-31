import { useState, useEffect, useRef, useCallback } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { indexText, runSearch } from "./pipeline/main";
import { loadCategories, classifyText } from "./pipeline/classifier";

// ── Types ──────────────────────────────────────────────
interface Result {
  text: string;
  score: number;
  label: string;
  confidence: number;
  matchedKeywords: string[];
}

interface CategoryCount {
  label: string;
  count: number;
  color: string;
}

// ── Category colors ────────────────────────────────────
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

// ── Keyword extractor (for highlighting) ──────────────
function extractMatchedKeywords(text: string, query: string): string[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();
  return queryWords.filter(w => textLower.includes(w));
}

// ── Highlight matching words in snippet ───────────────
function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <span>{text}</span>;

  const regex = new RegExp(`(${keywords.map(k =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        keywords.some(k => part.toLowerCase() === k.toLowerCase())
          ? <mark key={i} style={{
              background: 'rgba(255,69,0,0.25)',
              color: '#ff6b35',
              borderRadius: '3px',
              padding: '0 2px',
              fontWeight: 600
            }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// ── Category distribution bar ─────────────────────────
function CategoryBar({ results }: { results: Result[] }) {
  if (!results.length) return null;

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.label] = (counts[r.label] || 0) + 1;
  }

  const categories: CategoryCount[] = Object.entries(counts)
    .map(([label, count]) => ({
      label, count,
      color: TAG_COLORS[label]?.bar || '#9ca3af'
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div style={{
      margin: '16px 0',
      padding: '14px 18px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '10px',
      alignItems: 'center'
    }}>
      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600,
        textTransform: 'uppercase' as const, letterSpacing: '1px', marginRight: '4px' }}>
        Topics found:
      </span>
      {categories.map(({ label, count, color }) => (
        <div key={label} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px',
          background: TAG_COLORS[label]?.bg || 'rgba(255,255,255,0.05)',
          borderRadius: '20px',
          border: `1px solid ${color}40`
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: color
          }} />
          <span style={{ fontSize: '12px', color, fontWeight: 600 }}>{label}</span>
          <span style={{
            fontSize: '11px', color: '#64748b',
            background: 'rgba(0,0,0,0.2)',
            padding: '1px 5px', borderRadius: '10px'
          }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Result Card ────────────────────────────────────────
function ResultCard({ result }: { result: Result }) {
  const colors = TAG_COLORS[result.label] || TAG_COLORS["Other"];
  const scorePercent = Math.round(result.score * 100);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `4px solid ${colors.bar}`,
      borderRadius: '12px',
      padding: '18px 20px',
      marginBottom: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)';
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
    }}>

      {/* Top row: tag + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '10px' }}>

        {/* Topic tag */}
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 10px',
          borderRadius: '20px', letterSpacing: '0.5px',
          background: colors.bg, color: colors.text,
          border: `1px solid ${colors.bar}40`
        }}>
          {result.label.toUpperCase()}
        </span>

        {/* Score */}
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
          {scorePercent}% match
        </span>
      </div>

      {/* Snippet with highlighted keywords */}
      <p style={{
        fontSize: '14px', color: '#cbd5e1', lineHeight: 1.6,
        margin: '0 0 12px 0'
      }}>
        <HighlightedText
          text={result.text.slice(0, 150) + (result.text.length > 150 ? '...' : '')}
          keywords={result.matchedKeywords}
        />
      </p>

      {/* Score bar */}
      <div style={{
        height: '3px', background: 'rgba(255,255,255,0.06)',
        borderRadius: '2px', overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', width: `${scorePercent}%`,
          background: colors.bar, borderRadius: '2px',
          transition: 'width 0.5s ease'
        }} />
      </div>

      {/* Matched keywords */}
      {result.matchedKeywords.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: '10px', color: '#475569' }}>matched:</span>
          {result.matchedKeywords.map(kw => (
            <span key={kw} style={{
              fontSize: '10px', padding: '2px 6px',
              background: 'rgba(255,69,0,0.1)',
              color: '#ff6b35', borderRadius: '4px',
              border: '1px solid rgba(255,69,0,0.2)'
            }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────
export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [totalIndexed, setTotalIndexed] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accelRef = useRef<string | null>(null);

  useEffect(() => {
    initSDK()
      .then(async () => {
        accelRef.current = getAccelerationMode();
        setSdkReady(true);
        await loadCategories();

        // Demo data — realistic content across all categories
        await indexText(`
          Invoice #1042 total payment due budget expense tax revenue quarterly financial report profit loss accounting.
          Resume curriculum vitae work experience software engineer skills candidate job application career internship.
          Lecture notes study material university exam assignment homework course syllabus machine learning neural networks.
          Contract agreement legal terms conditions clause jurisdiction liability party shall hereby compliance regulation.
          Medical health doctor prescription diagnosis patient hospital treatment clinical symptoms pharmacy wellness.
          Meeting agenda project proposal business plan office team deliverable deadline client manager stakeholder kpi.
          Personal diary family travel vacation hobby memory photo journal weekend holiday private reminder.
          JavaScript programming tutorial web development frontend backend database algorithms data structures computer science.
          Budget planning fiscal year quarterly report revenue streams cost analysis investment portfolio tax filing.
          Software engineering resume skills React TypeScript Node.js Python candidate hiring senior developer position.
        `);

        setTotalIndexed(10);
      })
      .catch(err =>
        setSdkError(err instanceof Error ? err.message : String(err))
      );
  }, []);

  // ── Real-time search with 300ms debounce ────────────
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim() || !sdkReady) {
      setResults([]);
      setSearchTime(null);
      return;
    }

    setSearching(true);
    const start = performance.now();

    try {
      const raw = await runSearch(q);
      const enriched = await Promise.all(
        raw.map(async (r: { text: string; score: number }) => {
          const { label, confidence } = await classifyText(r.text);
          const matchedKeywords = extractMatchedKeywords(r.text, q);
          return { ...r, label, confidence, matchedKeywords };
        })
      );
      setResults(enriched);
      setSearchTime(Math.round(performance.now() - start));
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  }, [sdkReady]);

  // Debounced input handler
  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // ── Loading screen ───────────────────────────────────
  if (sdkError) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100vh', background:'#0a0a0f', color:'white' }}>
      <h2>SDK Error</h2>
      <p style={{ color: '#ef4444' }}>{sdkError}</p>
    </div>
  );

  if (!sdkReady) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100vh', background:'#0a0a0f', color:'white', gap:'16px' }}>
      <div style={{
        width:'40px', height:'40px', border:'3px solid #1e293b',
        borderTopColor:'#ff4500', borderRadius:'50%',
        animation:'spin 0.8s linear infinite'
      }} />
      <h2 style={{ margin:0 }}>Loading VaultFind</h2>
      <p style={{ color:'#64748b', margin:0 }}>Initializing on-device AI...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Main UI ──────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: 'white',
      fontFamily: "'Segoe UI', sans-serif"
    }}>

      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden'
      }}>
        <div style={{
          position:'absolute', top:'-10%', left:'-10%',
          width:'50%', height:'50%',
          background:'radial-gradient(circle, rgba(255,69,0,0.08) 0%, transparent 70%)',
          borderRadius:'50%'
        }} />
        <div style={{
          position:'absolute', bottom:'-10%', right:'-10%',
          width:'50%', height:'50%',
          background:'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)',
          borderRadius:'50%'
        }} />
      </div>

      <div style={{ position:'relative', zIndex:1, maxWidth:'800px',
        margin:'0 auto', padding:'40px 24px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'48px' }}>
          <div style={{ display:'flex', alignItems:'center',
            justifyContent:'center', gap:'10px', marginBottom:'12px' }}>
            <span style={{ fontSize:'32px' }}>🔍</span>
            <h1 style={{ margin:0, fontSize:'36px', fontWeight:900,
              letterSpacing:'-1px', color:'white' }}>
              Vault<span style={{ color:'#ff4500' }}>Find</span>
            </h1>
            {accelRef.current && (
              <span style={{
                fontSize:'11px', fontWeight:700, padding:'3px 8px',
                borderRadius:'6px', background:'#ff4500', color:'white',
                textTransform:'uppercase', letterSpacing:'1px'
              }}>
                {accelRef.current === 'webgpu' ? 'WebGPU' : 'CPU'}
              </span>
            )}
          </div>
          <p style={{ color:'#475569', margin:0, fontSize:'15px', letterSpacing:'0.05em' }}>
            ON-DEVICE AI · OFFLINE · PRIVATE
          </p>
        </div>

        {/* Search bar */}
        <div style={{ position:'relative', marginBottom:'8px' }}>
          <span style={{
            position:'absolute', left:'18px', top:'50%',
            transform:'translateY(-50%)', fontSize:'20px', pointerEvents:'none'
          }}>🔍</span>
          <input
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Search your files by meaning... try 'budget report' or 'resume skills'"
            style={{
              width: '100%',
              padding: '16px 20px 16px 52px',
              fontSize: '16px',
              background: 'rgba(255,255,255,0.04)',
              border: query
                ? '2px solid rgba(255,69,0,0.6)'
                : '2px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              color: 'white',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => {
              (e.target as HTMLInputElement).style.border = '2px solid rgba(255,69,0,0.6)';
            }}
            onBlur={e => {
              if (!query) (e.target as HTMLInputElement).style.border = '2px solid rgba(255,255,255,0.08)';
            }}
          />
          {searching && (
            <div style={{
              position:'absolute', right:'18px', top:'50%',
              transform:'translateY(-50%)',
              width:'18px', height:'18px',
              border:'2px solid rgba(255,255,255,0.1)',
              borderTopColor:'#ff4500',
              borderRadius:'50%',
              animation:'spin 0.6s linear infinite'
            }} />
          )}
        </div>

        {/* Search meta — result count + time */}
        <div style={{
          height: '24px', marginBottom: '4px',
          display:'flex', alignItems:'center'
        }}>
          {searchTime !== null && results.length > 0 && (
            <p style={{ margin:0, fontSize:'12px', color:'#475569' }}>
              Found{' '}
              <span style={{ color:'#ff4500', fontWeight:600 }}>
                {results.length}
              </span>
              {' '}result{results.length !== 1 ? 's' : ''} in{' '}
              <span style={{ color:'#10b981', fontWeight:600 }}>
                {searchTime}ms
              </span>
              {' '}— all processed on-device
            </p>
          )}
          {query && !searching && results.length === 0 && searchTime !== null && (
            <p style={{ margin:0, fontSize:'12px', color:'#475569' }}>
              No results found for "{query}"
            </p>
          )}
        </div>

        {/* Category distribution */}
        {results.length > 0 && <CategoryBar results={results} />}

        {/* Results */}
        <div style={{ marginTop: '8px' }}>
          {results.map((r, i) => (
            <ResultCard key={i} result={r} />
          ))}
        </div>

        {/* Empty state */}
        {!query && (
          <div style={{
            textAlign:'center', padding:'60px 0', color:'#1e293b'
          }}>
            <div style={{ fontSize:'64px', marginBottom:'16px', opacity:0.3 }}>🗂️</div>
            <p style={{ margin:0, fontSize:'14px', color:'#334155' }}>
              Start typing to search across all your indexed files
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '48px', paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display:'flex', justifyContent:'space-between', alignItems:'center'
        }}>
          <span style={{ fontSize:'12px', color:'#1e293b' }}>
            {totalIndexed} documents indexed
          </span>
          <span style={{ fontSize:'12px', color:'#1e293b' }}>
            🔒 All data stays on your device
          </span>
          <span style={{ fontSize:'12px', color:'#1e293b' }}>
            ⚡ Powered by RunAnywhere
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}