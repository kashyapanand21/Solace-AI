import { useState, useEffect } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { ChatTab } from './components/ChatTab';
import { VisionTab } from './components/VisionTab';
import { VoiceTab } from './components/VoiceTab';
import { ToolsTab } from './components/ToolsTab';
import { indexText, runSearch } from "./pipeline/main";
import { loadCategories, classifyText } from "./pipeline/classifier";
// @ts-ignore — FileCard.jsx has no type declarations
import FileCard from "./components/FileCard";

type Tab = 'chat' | 'vision' | 'voice' | 'tools';

export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [query, setQuery] = useState("");
const [results, setResults] = useState<
    { text: string; score: number; label: string; confidence: number }[]
  >([]);

  useEffect(() => {
  initSDK()
    .then(async () => {
      setSdkReady(true);
      // PHASE 1 TEST — remove after testing
      await loadCategories();
      const testResult = await classifyText("invoice payment budget Q3 expenses");
      console.log("[Classifier Test] label:", testResult.label, "confidence:", testResult.confidence.toFixed(4));

      // 🔥 INDEX DATA (MANDATORY)
      await indexText(`
        Invoice #1042 total payment due budget expense tax revenue quarterly financial report.
        Resume curriculum vitae work experience software engineer skills candidate job application.
        Lecture notes study material university exam assignment homework course syllabus semester.
        Contract agreement legal terms conditions clause jurisdiction liability party shall hereby.
        Medical health doctor prescription diagnosis patient hospital treatment clinical symptoms.
        Meeting agenda project proposal business plan office team deliverable deadline client manager.
        Personal diary family travel vacation hobby memory photo journal weekend holiday.
        Machine learning neural networks JavaScript programming tutorial course study notes.
      `);
    })
    .catch((err) =>
      setSdkError(err instanceof Error ? err.message : String(err))
    );
}, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    const raw = await runSearch(query);
    const enriched = await Promise.all(
      raw.map(async (r: { text: string; score: number }) => {
        const { label, confidence } = await classifyText(r.text);
        return { ...r, label, confidence };
      })
    );
    setResults(enriched);
  };

  if (sdkError) {
    return (
      <div className="app-loading">
        <h2>SDK Error</h2>
        <p className="error-text">{sdkError}</p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>Loading RunAnywhere SDK...</h2>
        <p>Initializing on-device AI engine</p>
      </div>
    );
  }

  const accel = getAccelerationMode();

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ padding: "20px" }}>
  <input
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search..."
    style={{ marginRight: "10px" }}
  />

  <button onClick={handleSearch}>Search</button>

  <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
    {results.map((r, i) => (
      <FileCard
        key={i}
        file={{
          name: r.text.slice(0, 40),
          summary: r.text,
          date: "",
          tags: [r.label],
          score: r.score,
        }}
      />
    ))}
  </div>
</div>
        <h1>RunAnywhere AI</h1>
        {accel && <span className="badge">{accel === 'webgpu' ? 'WebGPU' : 'CPU'}</span>}
      </header>

      <nav className="tab-bar">
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          💬 Chat
        </button>
        <button className={activeTab === 'vision' ? 'active' : ''} onClick={() => setActiveTab('vision')}>
          📷 Vision
        </button>
        <button className={activeTab === 'voice' ? 'active' : ''} onClick={() => setActiveTab('voice')}>
          🎙️ Voice
        </button>
        <button className={activeTab === 'tools' ? 'active' : ''} onClick={() => setActiveTab('tools')}>
          🔧 Tools
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'vision' && <VisionTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'tools' && <ToolsTab />}
      </main>
    </div>
  );
}
