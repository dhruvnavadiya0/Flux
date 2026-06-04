import { useState, useEffect } from "react";
import { UserSettings, InstalledApp, WorkspaceConfig, WorkspaceAction, WebEngineConfig } from "./types/electron";
import { X, Plus, Trash2, Save, Monitor, Globe } from "lucide-react";
import "./Settings.css";

interface SettingsProps {
  initialSettings: UserSettings;
  onClose: () => void;
  onSave: (settings: UserSettings) => void;
}

export default function SettingsView({ initialSettings, onClose, onSave }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<"features" | "web" | "ai" | "workspaces">("workspaces");
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingApps(true);
    window.electronAPI.getInstalledApps().then(apps => {
      if (mounted) {
        setInstalledApps(apps);
        setLoadingApps(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const handleSave = () => {
    onSave(settings);
  };

  // ─── Workspace Editing ────────────────────────────────────────────────────────
  const addWorkspace = () => {
    const newWs: WorkspaceConfig = {
      id: `ws-${Date.now()}`,
      title: "New Workspace",
      subtitle: "Custom workflow",
      keywords: ["new"],
      actions: []
    };
    setSettings({ ...settings, workspaces: [...settings.workspaces, newWs] });
  };

  const updateWorkspace = (index: number, updates: Partial<WorkspaceConfig>) => {
    const updated = [...settings.workspaces];
    updated[index] = { ...updated[index], ...updates };
    setSettings({ ...settings, workspaces: updated });
  };

  const removeWorkspace = (index: number) => {
    const updated = [...settings.workspaces];
    updated.splice(index, 1);
    setSettings({ ...settings, workspaces: updated });
  };

  const addAction = (wsIndex: number, type: "app" | "url") => {
    const updated = [...settings.workspaces];
    updated[wsIndex].actions.push(type === "app" ? { type: "app", path: "" } : { type: "url", url: "" });
    setSettings({ ...settings, workspaces: updated });
  };

  const updateAction = (wsIndex: number, actionIndex: number, updates: Partial<WorkspaceAction>) => {
    const updated = [...settings.workspaces];
    updated[wsIndex].actions[actionIndex] = { ...updated[wsIndex].actions[actionIndex], ...updates };
    setSettings({ ...settings, workspaces: updated });
  };

  const removeAction = (wsIndex: number, actionIndex: number) => {
    const updated = [...settings.workspaces];
    updated[wsIndex].actions.splice(actionIndex, 1);
    setSettings({ ...settings, workspaces: updated });
  };

  // ─── Web & AI Engine Editing ──────────────────────────────────────────────────
  const updateEngine = (category: "webEngines" | "aiPlatforms", index: number, updates: Partial<WebEngineConfig>) => {
    const updated = [...settings[category]];
    updated[index] = { ...updated[index], ...updates };
    setSettings({ ...settings, [category]: updated });
  };

  const addEngine = (category: "webEngines" | "aiPlatforms") => {
    const updated = [...settings[category]];
    updated.push({ name: "New Engine", url: "https://example.com/search?q=", alias: "new" });
    setSettings({ ...settings, [category]: updated });
  };

  const removeEngine = (category: "webEngines" | "aiPlatforms", index: number) => {
    const updated = [...settings[category]];
    updated.splice(index, 1);
    setSettings({ ...settings, [category]: updated });
  };

  return (
    <div className="settings-overlay">
      <div className="settings-container">
        <div className="settings-header">
          <h2>Settings</h2>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}><Save size={14} /> Save</button>
          </div>
        </div>

        <div className="settings-body">
          <div className="settings-sidebar">
            <button className={activeTab === "workspaces" ? "active" : ""} onClick={() => setActiveTab("workspaces")}>Workspaces</button>
            <button className={activeTab === "web" ? "active" : ""} onClick={() => setActiveTab("web")}>Web Searches</button>
            <button className={activeTab === "ai" ? "active" : ""} onClick={() => setActiveTab("ai")}>AI Platforms</button>
          </div>

          <div className="settings-content">
            {activeTab === "workspaces" && (
              <div className="settings-panel">
                <div className="panel-header">
                  <h3>Workspaces</h3>
                  <button className="btn-small" onClick={addWorkspace}><Plus size={14} /> Add Workspace</button>
                </div>
                
                {settings.workspaces.map((ws, wsIdx) => (
                  <div key={ws.id} className="workspace-card">
                    <div className="ws-header">
                      <input className="input-title" value={ws.title} onChange={e => updateWorkspace(wsIdx, { title: e.target.value })} placeholder="Workspace Title" />
                      <button className="btn-icon danger" onClick={() => removeWorkspace(wsIdx)}><Trash2 size={14} /></button>
                    </div>
                    <input className="input-subtitle" value={ws.subtitle} onChange={e => updateWorkspace(wsIdx, { subtitle: e.target.value })} placeholder="Subtitle (e.g. VS Code, Chrome)" />
                    
                    <div className="form-group">
                      <label>Keywords (comma separated)</label>
                      <input 
                        value={ws.keywords.join(", ")} 
                        onChange={e => updateWorkspace(wsIdx, { keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })} 
                        placeholder="code, dev"
                      />
                    </div>

                    <div className="ws-actions-list">
                      <h4>Actions ({ws.actions.length})</h4>
                      {ws.actions.map((action, actIdx) => (
                        <div key={actIdx} className="action-row">
                          <span className="action-icon">{action.type === "app" ? <Monitor size={14}/> : <Globe size={14}/>}</span>
                          
                          {action.type === "app" ? (
                            <select 
                              value={action.path || action.exe || ""} 
                              onChange={e => updateAction(wsIdx, actIdx, { path: e.target.value, exe: undefined })}
                            >
                              <option value="">Select installed app...</option>
                              {installedApps.map(app => (
                                <option key={app.path} value={app.path}>{app.name}</option>
                              ))}
                            </select>
                          ) : (
                            <input 
                              type="text" 
                              value={action.url || ""} 
                              onChange={e => updateAction(wsIdx, actIdx, { url: e.target.value })}
                              placeholder="https://..."
                            />
                          )}
                          <button className="btn-icon danger" onClick={() => removeAction(wsIdx, actIdx)}><X size={14} /></button>
                        </div>
                      ))}
                      
                      <div className="add-action-btns">
                        <button className="btn-small secondary" onClick={() => addAction(wsIdx, "app")} disabled={loadingApps}>
                          <Plus size={12} /> Add App
                        </button>
                        <button className="btn-small secondary" onClick={() => addAction(wsIdx, "url")}>
                          <Plus size={12} /> Add Website
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(activeTab === "web" || activeTab === "ai") && (
              <div className="settings-panel">
                <div className="panel-header">
                  <h3>{activeTab === "web" ? "Web Searches" : "AI Platforms"}</h3>
                  <button className="btn-small" onClick={() => addEngine(activeTab === "web" ? "webEngines" : "aiPlatforms")}>
                    <Plus size={14} /> Add {activeTab === "web" ? "Engine" : "Platform"}
                  </button>
                </div>

                <div className="engine-list">
                  {(activeTab === "web" ? settings.webEngines : settings.aiPlatforms).map((engine, idx) => (
                    <div key={idx} className="engine-row">
                      <input className="engine-alias" value={engine.alias} onChange={e => updateEngine(activeTab === "web" ? "webEngines" : "aiPlatforms", idx, { alias: e.target.value })} placeholder="Alias (e.g. yt)" />
                      <input className="engine-name" value={engine.name} onChange={e => updateEngine(activeTab === "web" ? "webEngines" : "aiPlatforms", idx, { name: e.target.value })} placeholder="Name" />
                      <input className="engine-url" value={engine.url} onChange={e => updateEngine(activeTab === "web" ? "webEngines" : "aiPlatforms", idx, { url: e.target.value })} placeholder="https://...search?q=" />
                      <button className="btn-icon danger" onClick={() => removeEngine(activeTab === "web" ? "webEngines" : "aiPlatforms", idx)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
