import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Search, X, ArrowUp, ArrowDown, CornerDownLeft, 
  Terminal, Globe, File, Cpu, Calculator, Zap, Sparkles, 
  StickyNote, Timer, Clipboard as ClipboardIcon, Link2, 
  BarChart2, Cloud, Key, RefreshCcw, Folder, Image as ImageIcon,
  Video, Music, Archive, Code
} from "lucide-react";
import {
  parseQuery,
  searchFiles,
  fetchNotes,
  fetchClipboardHistory,
  fetchBookmarks,
  fetchSystemStats,
  fetchWeather,
  getSubSearchContext,
  SearchResult,
  SubSearchContext,
} from "./SearchEngine";
import SettingsView from "./Settings";
import { UserSettings, InstalledApp } from "./types/electron";
import { DEFAULT_SETTINGS } from "./config/defaultSettings";
import "./App.css";

const getIconForType = (type: string) => {
  switch (type) {
    case "app": return <Terminal size={16} strokeWidth={2} />;
    case "web": return <Globe size={16} strokeWidth={2} />;
    case "system": return <Cpu size={16} strokeWidth={2} />;
    case "calculator": return <Calculator size={16} strokeWidth={2} />;
    case "workspace": return <Zap size={16} strokeWidth={2} />;
    case "ai": return <Sparkles size={16} strokeWidth={2} />;
    case "note": return <StickyNote size={16} strokeWidth={2} />;
    case "timer": return <Timer size={16} strokeWidth={2} />;
    case "clipboard": return <ClipboardIcon size={16} strokeWidth={2} />;
    case "bookmark": return <Link2 size={16} strokeWidth={2} />;
    case "stats": return <BarChart2 size={16} strokeWidth={2} />;
    case "weather": return <Cloud size={16} strokeWidth={2} />;
    case "password": return <Key size={16} strokeWidth={2} />;
    case "converter": return <RefreshCcw size={16} strokeWidth={2} />;
    default: return <File size={16} strokeWidth={2} />;
  }
};

const getIconForFileExt = (ext: string, isFolder: boolean) => {
  if (isFolder) return <Folder size={16} strokeWidth={2} />;
  
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) return <ImageIcon size={16} strokeWidth={2} />;
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return <Video size={16} strokeWidth={2} />;
  if (['.mp3', '.wav', '.flac', '.m4a'].includes(ext)) return <Music size={16} strokeWidth={2} />;
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return <Archive size={16} strokeWidth={2} />;
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.html', '.css'].includes(ext)) return <Code size={16} strokeWidth={2} />;
  if (['.exe', '.msi', '.bat', '.ps1'].includes(ext)) return <Terminal size={16} strokeWidth={2} />;
  
  return <File size={16} strokeWidth={2} />;
};

function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fileResults, setFileResults] = useState<SearchResult[]>([]);
  const [asyncResults, setAsyncResults] = useState<SearchResult[]>([]);
  const [subSearch, setSubSearch] = useState<SubSearchContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asyncFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allResults = [...results, ...asyncResults, ...fileResults];

  useEffect(() => {
    inputRef.current?.focus();
    
    // Load settings and installed apps
    Promise.all([
      window.electronAPI.getSettings(),
      window.electronAPI.getInstalledApps()
    ]).then(([saved, apps]) => {
      if (saved) setSettings(saved);
      if (apps) setInstalledApps(apps);
      setSettingsLoaded(true);
    });
  }, []);

  // Parse query whenever it changes (sync results)
  useEffect(() => {
    if (subSearch) {
      setResults([{
        id: `subsearch-${subSearch.id}`,
        title: `Search ${subSearch.name} for "${query}"`,
        subtitle: subSearch.url + encodeURIComponent(query),
        type: subSearch.type,
        tag: subSearch.name,
        action: () => {
          const fullUrl = `${subSearch.url}${encodeURIComponent(query)}`;
          if (subSearch.type === "ai") {
            window.electronAPI.openAndSubmitUrl(fullUrl).catch(console.error);
          } else {
            window.electronAPI.openUrl(fullUrl).catch(console.error);
          }
        }
      }]);
      setSelectedIndex(0);
    } else {
      if (query.trim().toLowerCase() === "settings") {
        setResults([{
          id: "open-settings",
          title: "⚙️ Open Settings",
          subtitle: "Manage your shortcuts, workspaces, and preferences",
          type: "system",
          tag: "Settings",
          keepOpen: true,
          action: () => {
            setIsSettingsOpen(true);
            setQuery("");
            setResults([]);
          }
        }]);
        setSelectedIndex(0);
        return;
      }
      const parsed = parseQuery(query, settings, installedApps);
      setResults(parsed);
      setSelectedIndex(0);
    }
  }, [query, subSearch, settings, installedApps]);

  // Async data fetching
  useEffect(() => {
    if (asyncFetchTimer.current) clearTimeout(asyncFetchTimer.current);

    const trimmed = query.trim();
    if (!trimmed || subSearch) {
      setAsyncResults([]);
      return;
    }

    const lowerTrimmed = trimmed.toLowerCase();
    const parts = lowerTrimmed.split(" ");
    const firstWord = parts[0];
    const searchQuery = parts.slice(1).join(" ");

    let asyncType: string | undefined;
    
    // Dynamic matching from settings
    if (settings.features.bookmarks.includes(firstWord) && searchQuery) asyncType = "bookmarks";
    else if (settings.features.weather.includes(firstWord)) asyncType = "weather";
    else if (settings.features.notes.includes(firstWord) && searchQuery) asyncType = "notes";
    else if (settings.features.clipboard.includes(firstWord)) asyncType = "clipboard";
    else if (settings.features.system.includes(firstWord)) asyncType = "stats";

    if (!asyncType) {
      setAsyncResults([]);
      return;
    }

    setIsSearching(true);
    asyncFetchTimer.current = setTimeout(async () => {
      try {
        let fetchedResults: SearchResult[] = [];
        switch (asyncType) {
          case "notes": fetchedResults = await fetchNotes(searchQuery || undefined); break;
          case "clipboard": fetchedResults = await fetchClipboardHistory(); break;
          case "bookmarks": fetchedResults = await fetchBookmarks(searchQuery || undefined); break;
          case "stats": fetchedResults = await fetchSystemStats(); break;
          case "weather": fetchedResults = await fetchWeather(searchQuery || undefined); break;
        }
        setAsyncResults(fetchedResults);
      } catch (err) {
        console.error("Async fetch error:", err);
        setAsyncResults([]);
      }
      setIsSearching(false);
    }, 150);

    return () => { if (asyncFetchTimer.current) clearTimeout(asyncFetchTimer.current); };
  }, [query, subSearch, settings]);

  // Debounced file search
  useEffect(() => {
    if (fileSearchTimer.current) clearTimeout(fileSearchTimer.current);

    const trimmed = query.trim();
    if (!trimmed || subSearch || trimmed.startsWith("=") || trimmed === "/" || ["workspace", "ws"].includes(trimmed.toLowerCase())) {
      setFileResults([]);
      setIsSearching(false);
      return;
    }

    const firstWord = trimmed.split(" ")[0].toLowerCase();
    const hasRest = trimmed.split(" ").length > 1;
    const WEB_PREFIXES = settings.webEngines.map(e => e.alias);
    const AI_PREFIXES = settings.aiPlatforms.map(e => e.alias);
    const SKIP_PREFIXES = [
      ...settings.features.clipboard,
      ...settings.features.bookmarks,
      ...settings.features.weather,
      ...settings.features.notes,
      ...settings.features.system,
      ...settings.features.timer,
      ...settings.features.password,
    ];

    if ((WEB_PREFIXES.includes(firstWord) && hasRest) || (AI_PREFIXES.includes(firstWord) && hasRest) || SKIP_PREFIXES.includes(firstWord)) {
      setFileResults([]);
      setIsSearching(false);
      return;
    }

    if (/^\d+[\d,.]*\s*[a-zA-Z°/]+\s+(?:to|in|=)\s+[a-zA-Z°/]+$/i.test(trimmed)) {
      setFileResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    fileSearchTimer.current = setTimeout(async () => {
      const files = await searchFiles(trimmed);
      setFileResults(files);
      setIsSearching(false);
    }, 200);

    return () => { if (fileSearchTimer.current) clearTimeout(fileSearchTimer.current); };
  }, [query, settings]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return;
      }
      if (subSearch) {
        setSubSearch(null);
        setQuery("");
      } else {
        window.electronAPI.hideWindow().catch(console.error);
        setQuery("");
        setResults([]);
        setFileResults([]);
        setAsyncResults([]);
      }
    } else if (e.key === "Tab") {
      if (!subSearch && query.trim().length > 0) {
        const firstWord = query.trim().split(" ")[0].toLowerCase();
        const context = getSubSearchContext(firstWord, settings);
        if (context) {
          e.preventDefault();
          setSubSearch(context);
          setQuery(query.trim().substring(firstWord.length).trim());
        }
      }
    } else if (e.key === "Backspace" && query === "" && subSearch) {
      setSubSearch(null);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeResult(allResults[selectedIndex]);
    } else if (e.key === "d" && e.ctrlKey) {
      e.preventDefault();
      const selected = allResults[selectedIndex];
      if (selected?.deleteAction) {
        selected.deleteAction().then(() => {
          setQuery((q) => q + " ");
          setTimeout(() => setQuery((q) => q.trimEnd()), 50);
        });
      }
    }
  }, [allResults, selectedIndex, subSearch, query, isSettingsOpen, settings]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const executeResult = (result: SearchResult | undefined) => {
    if (!result) return;
    Promise.resolve(result.action()).then(() => {
      if (!result.keepOpen) {
        window.electronAPI.hideWindow().catch(console.error);
      }
      setQuery("");
      setSubSearch(null);
      setResults([]);
      setFileResults([]);
      setAsyncResults([]);
    });
  };

  const getResultIcon = (result: SearchResult) => {
    if (result.icon) {
      return <img src={result.icon} alt={result.title} width={18} height={18} style={{ borderRadius: '4px', objectFit: 'contain' }} />;
    }
    if (result.type === "file") {
      const ext = result.title.substring(result.title.lastIndexOf(".")).toLowerCase();
      return getIconForFileExt(ext, result.tag === "Folder");
    }
    return getIconForType(result.type);
  };

  const getAsyncGroupLabel = (): string | null => {
    if (asyncResults.length === 0) return null;
    switch (asyncResults[0]?.type) {
      case "note": return "Notes";
      case "clipboard": return "Clipboard History";
      case "bookmark": return "Bookmarks";
      case "stats": return "System Stats";
      case "weather": return "Weather";
      default: return null;
    }
  };

  const asyncGroup = getAsyncGroupLabel();
  const selectedResult = allResults[selectedIndex];
  const isCopyable = selectedResult?.type === "calculator" || selectedResult?.type === "password" || selectedResult?.type === "converter";

  if (!settingsLoaded) return <div className="app loading" />;

  if (isSettingsOpen) {
    return (
      <SettingsView 
        initialSettings={settings} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(newSettings) => {
          setSettings(newSettings);
          setIsSettingsOpen(false);
          window.electronAPI.saveSettings(newSettings);
        }}
      />
    );
  }

  return (
    <div className="app command-bar" id="command-bar">
      {/* Input Row */}
      <div className="input-row" id="input-row">
        <div className="search-icon-wrap">
          <Search size={18} strokeWidth={2} />
        </div>
        
        {subSearch && (
          <div className="subsearch-pill" onClick={() => setSubSearch(null)}>
            {subSearch.name}
          </div>
        )}

        <input
          ref={inputRef}
          id="search-input"
          type="text"
          className="command-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={subSearch ? `Search ${subSearch.name}...` : "Type a command or search..."}
          autoFocus
          spellCheck={false}
        />
        {isSearching && <div className="search-spinner" />}
        {query && (
          <button className="clear-btn" onClick={() => {
            setQuery("");
            setSubSearch(null);
            setResults([]);
            setFileResults([]);
            setAsyncResults([]);
            inputRef.current?.focus();
          }}>
            <X size={16} strokeWidth={2} className="search-icon-wrap" />
          </button>
        )}
      </div>

      {/* Results */}
      {allResults.length > 0 && (
        <div className="results-list" id="results-list">
          {results.length > 0 && (
            <div className="result-group">
              {results.map((r, idx) => (
                <div
                  key={r.id}
                  className={`result-row ${idx === selectedIndex ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => executeResult(r)}
                >
                  <span className="result-icon">{getResultIcon(r)}</span>
                  <div className="result-text">
                    <span className="result-title">{r.title}</span>
                    <span className="result-subtitle">{r.subtitle}</span>
                  </div>
                  {r.tag && <span className="result-tag">{r.tag}</span>}
                </div>
              ))}
            </div>
          )}

          {asyncResults.length > 0 && (
            <div className="result-group">
              {asyncGroup && <div className="group-header">{asyncGroup}</div>}
              {asyncResults.map((r, idx) => {
                const globalIdx = results.length + idx;
                return (
                  <div
                    key={r.id}
                    className={`result-row ${globalIdx === selectedIndex ? "selected" : ""}`}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    onClick={() => executeResult(r)}
                  >
                    <span className="result-icon">{getResultIcon(r)}</span>
                    <div className="result-text">
                      <span className="result-title">{r.title}</span>
                      <span className="result-subtitle">{r.subtitle}</span>
                    </div>
                    {r.tag && <span className="result-tag">{r.tag}</span>}
                    {r.deleteAction && globalIdx === selectedIndex && (
                      <span className="delete-hint">Ctrl+D</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {fileResults.length > 0 && (
            <div className="result-group">
              <div className="group-header">Files</div>
              {fileResults.map((r, idx) => {
                const globalIdx = results.length + asyncResults.length + idx;
                return (
                  <div
                    key={r.id}
                    className={`result-row ${globalIdx === selectedIndex ? "selected" : ""}`}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    onClick={() => executeResult(r)}
                  >
                    <span className="result-icon">{getResultIcon(r)}</span>
                    <div className="result-text">
                      <span className="result-title">{r.title}</span>
                      <span className="result-subtitle">{r.subtitle}</span>
                    </div>
                    {r.tag && <span className="result-tag">{r.tag}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!query && !subSearch && (
        <div className="empty-state">
          <div className="hint-section">
            <div className="hint-label">Quick Actions</div>
            <div className="hint-chips">
              {["code", "design", "study", "meeting", "morning"].map((chip) => (
                <button key={chip} className="hint-chip" onClick={() => setQuery(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <div className="hint-section">
            <div className="hint-label">Shortcuts</div>
            <div className="hint-shortcuts">
              <span className="shortcut-item"><kbd>g</kbd> Google</span>
              <span className="shortcut-item"><kbd>yt</kbd> YouTube</span>
              <span className="shortcut-item"><kbd>=</kbd> Calculator</span>
              <span className="shortcut-item"><kbd>pw</kbd> Password</span>
              <span className="shortcut-item"><kbd>clip</kbd> Clipboard</span>
              <span className="shortcut-item"><kbd>sys</kbd> System</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bar-footer">
        <span className="footer-item">
          <span className="footer-keys">
            <kbd><ArrowUp size={10} /></kbd>
            <kbd><ArrowDown size={10} /></kbd>
          </span>
          navigate
        </span>
        <span className="footer-item">
          <kbd><CornerDownLeft size={10} /></kbd>
          {isCopyable ? "copy to clipboard" : "execute"}
        </span>
        <span className="footer-item">
          <kbd>esc</kbd> close
        </span>
        {selectedResult?.deleteAction && (
          <span className="footer-item highlight-danger">
            <kbd>ctrl+d</kbd> delete
          </span>
        )}
      </div>
    </div>
  );
}

export default App;
