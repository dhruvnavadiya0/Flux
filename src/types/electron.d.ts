export interface FileResult {
  name: string;
  path: string;
  isDir: boolean;
  ext: string;
  size: number;
  modified: number;
  score: number;
  sizeFormatted: string;
  icon?: string;
}

// ─── Notes ────────────────────────────────────────────────────────────────────
export interface NoteEntry {
  id: string;
  text: string;
  createdAt: number;
}

// ─── Clipboard History ────────────────────────────────────────────────────────
export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
  preview: string; // truncated for display
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────
export interface BookmarkEntry {
  id: string;
  alias: string;
  url: string;
  createdAt: number;
}

// ─── System Stats ─────────────────────────────────────────────────────────────
export interface SystemStats {
  cpuUsage: number; // percentage
  memTotal: number; // bytes
  memUsed: number;  // bytes
  diskTotal: number; // bytes
  diskFree: number;  // bytes
  uptime: number;    // seconds
  battery: number;   // percentage, -1 if no battery
  batteryCharging: boolean;
}

// ─── Weather ──────────────────────────────────────────────────────────────────
export interface WeatherData {
  city: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  forecast: Array<{
    day: string;
    tempMax: number;
    tempMin: number;
    condition: string;
  }>;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface WorkspaceAction {
  type: "app" | "url";
  exe?: string;
  path?: string;
  url?: string;
}

export interface WorkspaceConfig {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  actions: WorkspaceAction[];
}

export interface WebEngineConfig {
  name: string;
  url: string;
  alias: string;
}

export interface UserSettings {
  webEngines: WebEngineConfig[];
  aiPlatforms: WebEngineConfig[];
  workspaces: WorkspaceConfig[];
  features: {
    notes: string[];
    clipboard: string[];
    bookmarks: string[];
    weather: string[];
    system: string[];
    timer: string[];
    password: string[];
  };
}

export interface InstalledApp {
  name: string;
  path: string;
  icon?: string;
}

export interface ElectronAPI {
  // Existing
  openUrl: (url: string) => Promise<void>;
  openAndSubmitUrl: (url: string) => Promise<void>;
  hideWindow: () => Promise<void>;
  tryLaunchApp: (exe: string) => Promise<boolean>;
  runWorkspace: (actions: WorkspaceAction[]) => Promise<void>;
  systemCommand: (cmd: string) => Promise<void>;
  searchFiles: (query: string) => Promise<FileResult[]>;
  openPath: (filePath: string) => Promise<void>;

  // Settings
  getSettings: () => Promise<UserSettings | null>;
  saveSettings: (settings: UserSettings) => Promise<boolean>;
  getInstalledApps: () => Promise<InstalledApp[]>;

  // Phase 1: Notes
  saveNote: (text: string) => Promise<NoteEntry>;
  getNotes: () => Promise<NoteEntry[]>;
  deleteNote: (id: string) => Promise<void>;

  // Phase 1: Timer
  startTimer: (seconds: number, label: string) => Promise<string>;
  cancelTimer: (id: string) => Promise<void>;
  getActiveTimers: () => Promise<Array<{ id: string; label: string; remaining: number }>>;

  // Phase 2: Clipboard History
  getClipboardHistory: () => Promise<ClipboardEntry[]>;
  setClipboard: (text: string) => Promise<void>;

  // Phase 2: Bookmarks
  saveBookmark: (alias: string, url: string) => Promise<BookmarkEntry>;
  getBookmarks: () => Promise<BookmarkEntry[]>;
  deleteBookmark: (id: string) => Promise<void>;

  // Phase 2: System Stats
  getSystemStats: () => Promise<SystemStats>;

  // Phase 2: Weather
  getWeather: (city?: string) => Promise<WeatherData>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
