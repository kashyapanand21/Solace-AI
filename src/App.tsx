import { useState, useEffect } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { ChatTab } from './components/ChatTab';
import { VisionTab } from './components/VisionTab';
import { VoiceTab } from './components/VoiceTab';
import { ToolsTab } from './components/ToolsTab';
import { indexText, runSearch } from "./pipeline/main";

type Tab = 'chat' | 'vision' | 'voice' | 'tools';

export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [query, setQuery] = useState("");
const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
  initSDK()
    .then(async () => {
      setSdkReady(true);

      // 🔥 INDEX DATA (MANDATORY)
      await indexText(
        "Machine learning is amazing. Neural networks learn patterns. JavaScript runs in browsers."
      );
    })
    .catch((err) =>
      setSdkError(err instanceof Error ? err.message : String(err))
    );
}, []);

  const handleSearch = async () => {
  if (!query.trim()) return;

  const res = await runSearch(query);
  setResults(res);
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

  <div style={{ marginTop: "20px" }}>
    {results.map((r, i) => (
      <div key={i}>
        {r.text} — score: {r.score.toFixed(3)}
      </div>
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
