import type { FileResult, NoteEntry, ClipboardEntry, BookmarkEntry } from "./types/electron";

export type SubSearchContext = {
  id: string;
  name: string;
  url: string;
  type: "web" | "ai";
};

export type ResultType =
  | "app"
  | "web"
  | "file"
  | "system"
  | "calculator"
  | "workspace"
  | "ai"
  | "note"
  | "timer"
  | "clipboard"
  | "bookmark"
  | "stats"
  | "weather"
  | "password"
  | "converter";

export type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: ResultType;
  tag?: string;
  icon?: string;
  action: () => void | Promise<void>;
  deleteAction?: () => Promise<void>; // for notes/bookmarks — delete on Ctrl+D
  keepOpen?: boolean; // do not hide window after executing
};

// ─── Helper: open a URL via Electron main process ───────────────────────────
function openUrl(url: string) {
  window.electronAPI.openUrl(url).catch(console.error);
}

import { UserSettings, WorkspaceConfig, InstalledApp } from "./types/electron";

// ─── Web Search Engines (Now from Settings) ───────────────────────────────────

// ─── Smart App List with browser fallback ────────────────────────────────────
const SMART_APPS: Array<{
  id: string;
  name: string;
  exe: string;
  browserUrl: string;
  aliases?: string[];
}> = [
  {
    id: "app-vscode",
    name: "VS Code",
    exe: "code",
    browserUrl: "https://vscode.dev",
    aliases: ["vscode", "vs code", "editor"],
  },
  {
    id: "app-chrome",
    name: "Google Chrome",
    exe: "chrome",
    browserUrl: "https://google.com",
    aliases: ["chrome", "browser"],
  },
  {
    id: "app-spotify",
    name: "Spotify",
    exe: "spotify",
    browserUrl: "https://open.spotify.com",
    aliases: ["music", "spotify"],
  },
  {
    id: "app-discord",
    name: "Discord",
    exe: "discord",
    browserUrl: "https://discord.com/app",
    aliases: ["discord", "chat"],
  },
  {
    id: "app-slack",
    name: "Slack",
    exe: "slack",
    browserUrl: "https://app.slack.com",
    aliases: ["slack"],
  },
  {
    id: "app-notion",
    name: "Notion",
    exe: "notion",
    browserUrl: "https://notion.so",
    aliases: ["notion", "notes"],
  },
  {
    id: "app-teams",
    name: "Microsoft Teams",
    exe: "teams",
    browserUrl: "https://teams.microsoft.com",
    aliases: ["teams", "meeting"],
  },
  {
    id: "app-figma",
    name: "Figma",
    exe: "figma",
    browserUrl: "https://figma.com",
    aliases: ["figma", "design"],
  },
  {
    id: "app-terminal",
    name: "Terminal",
    exe: "wt",
    browserUrl: "",
    aliases: ["terminal", "cmd", "powershell"],
  },
  {
    id: "app-explorer",
    name: "File Explorer",
    exe: "explorer",
    browserUrl: "",
    aliases: ["explorer", "files", "folder"],
  },
  {
    id: "app-notepad",
    name: "Notepad",
    exe: "notepad",
    browserUrl: "",
    aliases: ["notepad", "text"],
  },
  {
    id: "app-calculator",
    name: "Calculator",
    exe: "calc",
    browserUrl: "",
    aliases: ["calc", "calculator"],
  },
  {
    id: "app-youtube",
    name: "YouTube",
    exe: "",
    browserUrl: "https://youtube.com",
    aliases: ["youtube", "video"],
  },
  {
    id: "app-gmail",
    name: "Gmail",
    exe: "",
    browserUrl: "https://mail.google.com",
    aliases: ["gmail", "email", "mail"],
  },
  {
    id: "app-whatsapp",
    name: "WhatsApp",
    exe: "whatsapp",
    browserUrl: "https://web.whatsapp.com",
    aliases: ["whatsapp", "wa"],
  },
  {
    id: "app-zoom",
    name: "Zoom",
    exe: "zoom",
    browserUrl: "https://zoom.us/join",
    aliases: ["zoom", "meeting"],
  },
  {
    id: "app-obsidian",
    name: "Obsidian",
    exe: "obsidian",
    browserUrl: "https://obsidian.md",
    aliases: ["obsidian"],
  },
  {
    id: "app-postman",
    name: "Postman",
    exe: "postman",
    browserUrl: "https://web.postman.co",
    aliases: ["postman", "api"],
  },
];

// ─── Workspaces (Now from Settings) ───────────────────────────────────────────
function makeWorkspaceResult(ws: WorkspaceConfig): SearchResult {
  return {
    id: `ws-${ws.id}`,
    title: ws.title,
    subtitle: ws.subtitle,
    type: "workspace",
    tag: "Workspace",
    action: async () => window.electronAPI.runWorkspace(ws.actions),
  };
}

// ─── AI Platform routing (Now from Settings) ──────────────────────────────────

// ─── System Commands ──────────────────────────────────────────────────────────
const SYS_COMMANDS: Record<string, { title: string; icon: string }> = {
  lock: { title: "Lock Screen", icon: "🔒" },
  "!lock": { title: "Lock Screen", icon: "🔒" },
  sleep: { title: "Sleep PC", icon: "😴" },
  shutdown: { title: "Shut Down", icon: "⏻" },
  restart: { title: "Restart PC", icon: "🔄" },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 1 FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Password Generator ──────────────────────────────────────────────────────
const PW_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
const PW_ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PW_DIGITS = "0123456789";

function generatePassword(length: number, charset: string): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => charset[n % charset.length]).join("");
}

function parsePasswordQuery(trimmed: string, settings: UserSettings): SearchResult[] {
  const results: SearchResult[] = [];
  const lower = trimmed.toLowerCase();

  const parts = lower.split(" ");
  const prefix = parts[0];

  if (settings.features.password.includes(prefix)) {
    const arg = parts[1];
    const isPin = prefix === "pin"; // simple heuristic

    if (isPin) {
      const length = arg ? Math.max(4, Math.min(12, parseInt(arg))) : 6;
      const pin = generatePassword(length, PW_DIGITS);
      results.push({
        id: "pin-result",
        title: pin,
        subtitle: `Numeric PIN · ${length} digits · Enter to copy`,
        type: "password",
        tag: "PIN",
        action: () => navigator.clipboard.writeText(pin),
      });
      return results;
    }

    let length = 16;
    let charset = PW_CHARS;
    let label = "Strong";

    if (arg) {
      const num = parseInt(arg);
      if (!isNaN(num)) {
        length = Math.max(4, Math.min(128, num));
      } else if (arg === "simple") {
        charset = PW_ALPHA;
        label = "Alphanumeric";
      }
    }

    const pw = generatePassword(length, charset);
    results.push({
      id: "pw-result",
      title: pw,
      subtitle: `${label} · ${length} characters · Enter to copy`,
      type: "password",
      tag: "Password",
      action: () => navigator.clipboard.writeText(pw),
    });

    // Also show a second option with different style
    if (charset === PW_CHARS) {
      const simplePw = generatePassword(length, PW_ALPHA);
      results.push({
        id: "pw-simple",
        title: simplePw,
        subtitle: `Alphanumeric · ${length} characters · Enter to copy`,
        type: "password",
        tag: "Password",
        action: () => navigator.clipboard.writeText(simplePw),
      });
    }
  }

  return results;
}

// ─── Unit & Currency Converter ────────────────────────────────────────────────
type ConversionDef = {
  from: string[];
  to: string[];
  factor: number;
  category: string;
};

const CONVERSIONS: ConversionDef[] = [
  // Length
  { from: ["km", "kilometer", "kilometers"], to: ["mi", "mile", "miles"], factor: 0.621371, category: "Length" },
  { from: ["mi", "mile", "miles"], to: ["km", "kilometer", "kilometers"], factor: 1.60934, category: "Length" },
  { from: ["m", "meter", "meters"], to: ["ft", "foot", "feet"], factor: 3.28084, category: "Length" },
  { from: ["ft", "foot", "feet"], to: ["m", "meter", "meters"], factor: 0.3048, category: "Length" },
  { from: ["cm", "centimeter", "centimeters"], to: ["in", "inch", "inches"], factor: 0.393701, category: "Length" },
  { from: ["in", "inch", "inches"], to: ["cm", "centimeter", "centimeters"], factor: 2.54, category: "Length" },
  { from: ["m", "meter", "meters"], to: ["cm", "centimeter", "centimeters"], factor: 100, category: "Length" },
  { from: ["cm", "centimeter", "centimeters"], to: ["m", "meter", "meters"], factor: 0.01, category: "Length" },

  // Weight
  { from: ["kg", "kilogram", "kilograms"], to: ["lb", "lbs", "pound", "pounds"], factor: 2.20462, category: "Weight" },
  { from: ["lb", "lbs", "pound", "pounds"], to: ["kg", "kilogram", "kilograms"], factor: 0.453592, category: "Weight" },
  { from: ["g", "gram", "grams"], to: ["oz", "ounce", "ounces"], factor: 0.035274, category: "Weight" },
  { from: ["oz", "ounce", "ounces"], to: ["g", "gram", "grams"], factor: 28.3495, category: "Weight" },

  // Data
  { from: ["gb", "gigabyte", "gigabytes"], to: ["mb", "megabyte", "megabytes"], factor: 1024, category: "Data" },
  { from: ["mb", "megabyte", "megabytes"], to: ["gb", "gigabyte", "gigabytes"], factor: 1 / 1024, category: "Data" },
  { from: ["tb", "terabyte", "terabytes"], to: ["gb", "gigabyte", "gigabytes"], factor: 1024, category: "Data" },
  { from: ["gb", "gigabyte", "gigabytes"], to: ["tb", "terabyte", "terabytes"], factor: 1 / 1024, category: "Data" },
  { from: ["kb", "kilobyte", "kilobytes"], to: ["mb", "megabyte", "megabytes"], factor: 1 / 1024, category: "Data" },
  { from: ["mb", "megabyte", "megabytes"], to: ["kb", "kilobyte", "kilobytes"], factor: 1024, category: "Data" },

  // Speed
  { from: ["kmh", "km/h", "kph"], to: ["mph"], factor: 0.621371, category: "Speed" },
  { from: ["mph"], to: ["kmh", "km/h", "kph"], factor: 1.60934, category: "Speed" },

  // Time
  { from: ["hr", "hrs", "hour", "hours"], to: ["min", "mins", "minute", "minutes"], factor: 60, category: "Time" },
  { from: ["min", "mins", "minute", "minutes"], to: ["sec", "secs", "second", "seconds"], factor: 60, category: "Time" },
  { from: ["day", "days"], to: ["hr", "hrs", "hour", "hours"], factor: 24, category: "Time" },
];

// Embedded exchange rates (approximate, updated periodically)
const CURRENCY_RATES: Record<string, number> = {
  usd: 1, eur: 0.92, gbp: 0.79, inr: 83.5, jpy: 149.5, cad: 1.36,
  aud: 1.53, chf: 0.88, cny: 7.24, krw: 1320, sgd: 1.34, hkd: 7.82,
  nzd: 1.64, sek: 10.45, nok: 10.62, dkk: 6.88, brl: 4.97, mxn: 17.15,
  zar: 18.65, thb: 35.2, php: 56.1, myr: 4.72, idr: 15650, aed: 3.67,
  sar: 3.75, try: 27.5, rub: 92.5, pln: 4.02, czk: 22.8, huf: 356,
  pkr: 280, bdt: 110, lkr: 320, ngn: 780, egp: 30.9, vnd: 24300,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: "$", eur: "€", gbp: "£", inr: "₹", jpy: "¥", cny: "¥",
  krw: "₩", thb: "฿", php: "₱", brl: "R$", try: "₺", rub: "₽",
  ngn: "₦", pkr: "Rs", bdt: "৳", lkr: "Rs", egp: "E£", vnd: "₫",
};

function parseConversionQuery(trimmed: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Pattern: <number> <unit> to <unit>   OR   <number> <unit> in <unit>
  const match = trimmed.match(/^([\d,.]+)\s*([a-zA-Z°/]+)\s+(?:to|in|=)\s+([a-zA-Z°/]+)$/i);
  if (!match) return results;

  const value = parseFloat(match[1].replace(/,/g, ""));
  const fromUnit = match[2].toLowerCase().replace("°", "");
  const toUnit = match[3].toLowerCase().replace("°", "");

  if (isNaN(value)) return results;

  // Temperature special handling
  if ((fromUnit === "f" || fromUnit === "fahrenheit") && (toUnit === "c" || toUnit === "celsius")) {
    const result = ((value - 32) * 5) / 9;
    results.push({
      id: "conv-temp",
      title: `${value}°F = ${result.toFixed(1)}°C`,
      subtitle: "Temperature conversion · Enter to copy",
      type: "converter",
      tag: "Convert",
      action: () => navigator.clipboard.writeText(result.toFixed(1)),
    });
    return results;
  }
  if ((fromUnit === "c" || fromUnit === "celsius") && (toUnit === "f" || toUnit === "fahrenheit")) {
    const result = (value * 9) / 5 + 32;
    results.push({
      id: "conv-temp",
      title: `${value}°C = ${result.toFixed(1)}°F`,
      subtitle: "Temperature conversion · Enter to copy",
      type: "converter",
      tag: "Convert",
      action: () => navigator.clipboard.writeText(result.toFixed(1)),
    });
    return results;
  }

  // Currency conversion
  if (CURRENCY_RATES[fromUnit] && CURRENCY_RATES[toUnit]) {
    const inUsd = value / CURRENCY_RATES[fromUnit];
    const result = inUsd * CURRENCY_RATES[toUnit];
    const fromSymbol = CURRENCY_SYMBOLS[fromUnit] || fromUnit.toUpperCase();
    const toSymbol = CURRENCY_SYMBOLS[toUnit] || toUnit.toUpperCase();
    const formatted = result < 1 ? result.toFixed(4) : result < 100 ? result.toFixed(2) : result.toLocaleString("en", { maximumFractionDigits: 0 });

    results.push({
      id: "conv-currency",
      title: `${fromSymbol}${value.toLocaleString()} = ${toSymbol}${formatted}`,
      subtitle: `${fromUnit.toUpperCase()} → ${toUnit.toUpperCase()} · Enter to copy`,
      type: "converter",
      tag: "Currency",
      action: () => navigator.clipboard.writeText(formatted),
    });
    return results;
  }

  // Unit conversion
  const conv = CONVERSIONS.find(
    (c) => c.from.includes(fromUnit) && c.to.includes(toUnit)
  );
  if (conv) {
    const result = value * conv.factor;
    const formatted = result < 0.01 ? result.toExponential(2) : result < 100 ? result.toFixed(2) : result.toLocaleString("en", { maximumFractionDigits: 1 });
    results.push({
      id: "conv-unit",
      title: `${value} ${fromUnit} = ${formatted} ${toUnit}`,
      subtitle: `${conv.category} conversion · Enter to copy`,
      type: "converter",
      tag: "Convert",
      action: () => navigator.clipboard.writeText(formatted),
    });
  }

  return results;
}

// ─── Timer Parser ─────────────────────────────────────────────────────────────
function parseTimerQuery(trimmed: string, settings: UserSettings): SearchResult[] {
  const results: SearchResult[] = [];
  const lower = trimmed.toLowerCase();
  const parts = lower.split(" ");
  const prefix = parts[0];

  if (!settings.features.timer.includes(prefix)) {
    return results;
  }

  // Pomodoro shortcut
  if (prefix === "pomo" || prefix === "pomodoro") {
    results.push({
      id: "timer-pomo",
      title: "🍅 Start Pomodoro (25 min focus)",
      subtitle: "25 min focus → 5 min break · Notification when done",
      type: "timer",
      tag: "Pomodoro",
      action: async () => {
        await window.electronAPI.startTimer(25 * 60, "Pomodoro Focus (25 min)");
      },
    });
    results.push({
      id: "timer-pomo-short",
      title: "☕ Short Break (5 min)",
      subtitle: "Quick break timer",
      type: "timer",
      tag: "Break",
      action: async () => {
        await window.electronAPI.startTimer(5 * 60, "Break Time (5 min)");
      },
    });
    return results;
  }

  // Show active timers
  if (prefix === "timers" || parts.length === 1) {
    results.push({
      id: "timer-view",
      title: "⏱️ View Active Timers",
      subtitle: "See all running timers",
      type: "timer",
      tag: "Timers",
      action: async () => {},
    });
    // Don't return, allow them to also start a timer if they typed e.g. "timer 5"
  }

  // Timer command: timer 25m, timer 5s
  if (parts.length > 1) {
    const timeArg = parts[1];
    const match = timeArg.match(/^(\d+)(s|sec|secs|m|min|mins|h|hr|hrs|hour|hours)?$/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2] || "m";
      let seconds = num;
      let label = "";

      if (unit.startsWith("h")) {
        seconds = num * 3600;
        label = `${num} hour${num > 1 ? "s" : ""}`;
      } else if (unit.startsWith("m")) {
        seconds = num * 60;
        label = `${num} minute${num > 1 ? "s" : ""}`;
      } else {
        seconds = num;
        label = `${num} second${num > 1 ? "s" : ""}`;
      }

      results.push({
        id: "timer-custom",
        title: `⏱️ Start Timer — ${label}`,
        subtitle: `Notification when done · Press Enter to start`,
        type: "timer",
        tag: "Timer",
        action: async () => {
          await window.electronAPI.startTimer(seconds, `Timer (${label})`);
        },
      });
    }
  }

  return results;
}

// ─── Notes Parser (Phase 1) ──────────────────────────────────────────────────
export async function fetchNotes(query?: string): Promise<SearchResult[]> {
  try {
    const notes: NoteEntry[] = await window.electronAPI.getNotes();
    let filtered = notes;
    if (query) {
      const lowerQ = query.toLowerCase();
      filtered = notes.filter((n) => n.text.toLowerCase().includes(lowerQ));
    }

    return filtered.slice(0, 15).map((n) => {
      const date = new Date(n.createdAt);
      const timeAgo = getTimeAgo(date);
      return {
        id: `note-${n.id}`,
        title: n.text,
        subtitle: `${timeAgo} · Ctrl+D to delete · Enter to copy`,
        type: "note" as ResultType,
        tag: "Note",
        action: () => navigator.clipboard.writeText(n.text),
        deleteAction: async () => {
          await window.electronAPI.deleteNote(n.id);
        },
      };
    });
  } catch (err) {
    console.error("Notes fetch error:", err);
    return [];
  }
}

function getTimeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 2 FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Clipboard History (Phase 2) ──────────────────────────────────────────────
export async function fetchClipboardHistory(): Promise<SearchResult[]> {
  try {
    const entries: ClipboardEntry[] = await window.electronAPI.getClipboardHistory();
    return entries.slice(0, 20).map((e, idx) => {
      const timeAgo = getTimeAgo(new Date(e.timestamp));
      return {
        id: `clip-${e.id}`,
        title: e.preview,
        subtitle: `${timeAgo} · Enter to copy`,
        type: "clipboard" as ResultType,
        tag: idx === 0 ? "Latest" : "Clipboard",
        action: async () => {
          await window.electronAPI.setClipboard(e.text);
        },
      };
    });
  } catch (err) {
    console.error("Clipboard fetch error:", err);
    return [];
  }
}

// ─── Bookmarks (Phase 2) ──────────────────────────────────────────────────────
export async function fetchBookmarks(query?: string): Promise<SearchResult[]> {
  try {
    const bookmarks: BookmarkEntry[] = await window.electronAPI.getBookmarks();
    let filtered = bookmarks;
    if (query) {
      const lowerQ = query.toLowerCase();
      filtered = bookmarks.filter(
        (b) => b.alias.toLowerCase().includes(lowerQ) || b.url.toLowerCase().includes(lowerQ)
      );
    }

    return filtered.slice(0, 15).map((b) => ({
      id: `bm-${b.id}`,
      title: b.alias,
      subtitle: `${b.url} · Ctrl+D to delete`,
      type: "bookmark" as ResultType,
      tag: "Bookmark",
      action: () => openUrl(b.url),
      deleteAction: async () => {
        await window.electronAPI.deleteBookmark(b.id);
      },
    }));
  } catch (err) {
    console.error("Bookmarks fetch error:", err);
    return [];
  }
}

// ─── System Stats (Phase 2) ───────────────────────────────────────────────────
export async function fetchSystemStats(): Promise<SearchResult[]> {
  try {
    const stats = await window.electronAPI.getSystemStats();

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };

    const formatUptime = (seconds: number) => {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    };

    const memPercent = Math.round((stats.memUsed / stats.memTotal) * 100);
    const diskUsedPercent = Math.round(((stats.diskTotal - stats.diskFree) / stats.diskTotal) * 100);

    const results: SearchResult[] = [
      {
        id: "stats-cpu",
        title: `🖥️ CPU Usage: ${stats.cpuUsage}%`,
        subtitle: progressBar(stats.cpuUsage),
        type: "stats",
        tag: "CPU",
        action: () => {},
      },
      {
        id: "stats-ram",
        title: `💾 RAM: ${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)}`,
        subtitle: `${memPercent}% used  ${progressBar(memPercent)}`,
        type: "stats",
        tag: "Memory",
        action: () => {},
      },
      {
        id: "stats-disk",
        title: `💿 Disk: ${formatBytes(stats.diskTotal - stats.diskFree)} / ${formatBytes(stats.diskTotal)}`,
        subtitle: `${diskUsedPercent}% used  ${progressBar(diskUsedPercent)}`,
        type: "stats",
        tag: "Disk",
        action: () => {},
      },
      {
        id: "stats-uptime",
        title: `⏰ Uptime: ${formatUptime(stats.uptime)}`,
        subtitle: "System uptime since last boot",
        type: "stats",
        tag: "Uptime",
        action: () => {},
      },
    ];

    if (stats.battery >= 0) {
      results.push({
        id: "stats-battery",
        title: `🔋 Battery: ${stats.battery}%${stats.batteryCharging ? " ⚡ Charging" : ""}`,
        subtitle: progressBar(stats.battery),
        type: "stats",
        tag: "Battery",
        action: () => {},
      });
    }

    return results;
  } catch (err) {
    console.error("System stats error:", err);
    return [];
  }
}

function progressBar(percent: number): string {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return "█".repeat(filled) + "░".repeat(empty) + ` ${percent}%`;
}

// ─── Weather (Phase 2) ────────────────────────────────────────────────────────
export async function fetchWeather(city?: string): Promise<SearchResult[]> {
  try {
    const data = await window.electronAPI.getWeather(city);

    const conditionEmoji: Record<string, string> = {
      "Clear": "☀️", "Sunny": "☀️", "Partly cloudy": "⛅",
      "Cloudy": "☁️", "Overcast": "☁️", "Rain": "🌧️",
      "Light rain": "🌦️", "Heavy rain": "🌧️", "Thunderstorm": "⛈️",
      "Snow": "🌨️", "Fog": "🌫️", "Mist": "🌫️", "Haze": "🌫️",
      "Drizzle": "🌦️", "Sleet": "🌨️",
    };

    const emoji = conditionEmoji[data.condition] || "🌡️";
    const results: SearchResult[] = [
      {
        id: "weather-now",
        title: `${emoji} ${data.temperature}°C — ${data.condition}`,
        subtitle: `Feels like ${data.feelsLike}°C · Humidity ${data.humidity}% · Wind ${data.windSpeed} km/h`,
        type: "weather",
        tag: data.city,
        action: () => openUrl(`https://www.google.com/search?q=weather+${encodeURIComponent(data.city)}`),
      },
    ];

    // Add forecast
    data.forecast.slice(0, 3).forEach((day, idx) => {
      const dayEmoji = conditionEmoji[day.condition] || "🌡️";
      results.push({
        id: `weather-day-${idx}`,
        title: `${dayEmoji} ${day.day}: ${day.tempMax}°C / ${day.tempMin}°C`,
        subtitle: day.condition,
        type: "weather",
        tag: "Forecast",
        action: () => openUrl(`https://www.google.com/search?q=weather+${encodeURIComponent(data.city)}`),
      });
    });

    return results;
  } catch (err) {
    console.error("Weather error:", err);
    return [{
      id: "weather-error",
      title: "❌ Could not fetch weather",
      subtitle: String(err),
      type: "weather",
      tag: "Error",
      action: () => {},
    }];
  }
}

// ─── File Search (async, calls Electron backend) ──────────────────────────────
export async function searchFiles(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const files: FileResult[] = await window.electronAPI.searchFiles(query);
    return files.map((file) => ({
      id: `file-${file.path}`,
      title: file.name,
      subtitle: `${file.path}  ·  ${file.sizeFormatted}`,
      type: "file" as ResultType,
      tag: file.isDir ? "Folder" : file.ext.replace(".", "").toUpperCase() || "File",
      icon: file.icon,
      action: async () => window.electronAPI.openPath(file.path),
    }));
  } catch (err) {
    console.error("File search error:", err);
    return [];
  }
}

// ─── Main Query Parser (synchronous results) ─────────────────────────────────
export function parseQuery(query: string, settings: UserSettings, installedApps: InstalledApp[] = []): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: SearchResult[] = [];
  const parts = trimmed.split(" ");
  const prefix = parts[0].toLowerCase();
  const rest = parts.slice(1).join(" ");

  // 1. CALCULATOR: starts with "="
  if (trimmed.startsWith("=")) {
    const expr = trimmed.substring(1).trim();
    if (/^[0-9+\-*/().%\s]+$/.test(expr)) {
      try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${expr}`)();
        if (typeof result === "number" && isFinite(result)) {
          results.push({
            id: "calc-result",
            title: `= ${result}`,
            subtitle: `${expr} → Press Enter to copy`,
            type: "calculator",
            tag: "Calculator",
            action: () => navigator.clipboard.writeText(String(result)),
          });
        }
      } catch (_) {
        /* bad expression */
      }
    }
    return results;
  }

  // 2. PASSWORD GENERATOR: pw, password, pin
  const pwResults = parsePasswordQuery(trimmed, settings);
  if (pwResults.length > 0) return pwResults;

  // 3. UNIT/CURRENCY CONVERTER: <number> <unit> to <unit>
  const convResults = parseConversionQuery(trimmed);
  if (convResults.length > 0) return convResults;

  // 4. TIMER: timer 25m, pomo
  const timerResults = parseTimerQuery(trimmed, settings);
  if (timerResults.length > 0) return timerResults;

  // 5. NOTES: note <text> to save, notes to list
  if (settings.features.notes.includes(prefix) && rest.length > 0) {
    results.push({
      id: "note-save",
      title: `📝 Save note: "${rest}"`,
      subtitle: "Press Enter to save this note",
      type: "note",
      tag: "Save",
      action: async () => {
        await window.electronAPI.saveNote(rest);
      },
    });
    return results;
  }

  // 6. BOOKMARKS: save <alias> <url>, go <alias>, bookmarks
  if (settings.features.bookmarks.includes(prefix) && parts.length >= 3) {
    const alias = parts[1];
    const url = parts.slice(2).join(" ");
    if (url.match(/^https?:\/\//) || url.match(/^[a-zA-Z0-9].*\.[a-zA-Z]{2,}/)) {
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      results.push({
        id: "bm-save",
        title: `🔗 Save bookmark: "${alias}" → ${fullUrl}`,
        subtitle: "Press Enter to save this bookmark",
        type: "bookmark",
        tag: "Save",
        action: async () => {
          await window.electronAPI.saveBookmark(alias, fullUrl);
        },
      });
      return results;
    }
  }

  // 7. WEB SEARCH ROUTING
  const webEngine = settings.webEngines.find(e => e.alias === prefix);
  if (webEngine && rest.length > 0) {
    results.push({
      id: `web-${prefix}`,
      title: `Search ${webEngine.name} for "${rest}"`,
      subtitle: webEngine.url + encodeURIComponent(rest),
      type: "web",
      tag: "Web Search",
      action: () =>
        openUrl(`${webEngine.url}${encodeURIComponent(rest)}`),
    });
    return results;
  }

  // 8. AI PLATFORM ROUTING
  const aiPlatform = settings.aiPlatforms.find(e => e.alias === prefix);
  if (aiPlatform && rest.length > 0) {
    results.push({
      id: `ai-${prefix}`,
      title: `Ask ${aiPlatform.name}: "${rest}"`,
      subtitle: `Opens ${aiPlatform.name} in browser and auto-submits your prompt`,
      type: "ai",
      tag: "AI",
      action: () => window.electronAPI.openAndSubmitUrl(`${aiPlatform.url}${encodeURIComponent(rest)}`),
    });
    return results;
  }

  // 9. WORKSPACE MATCHING: keyword fuzzy search across all workspaces
  const lowerTrimmed = trimmed.toLowerCase();

  // Show all workspaces if user types 'workspace', 'ws', or just '/'
  if (["workspace", "ws", "/"].includes(lowerTrimmed)) {
    settings.workspaces.forEach((ws) => results.push(makeWorkspaceResult(ws)));
    return results;
  }

  // Fuzzy match workspace by keyword (only if it's a short query to avoid sentence overlap)
  const isSingleWord = !lowerTrimmed.includes(" ");
  const matchedWorkspaces = settings.workspaces.filter((ws) =>
    ws.keywords.some((kw) => 
      isSingleWord ? kw.startsWith(lowerTrimmed) || lowerTrimmed.startsWith(kw) : kw === lowerTrimmed
    )
  );
  matchedWorkspaces
    .slice(0, 3)
    .forEach((ws) => results.push(makeWorkspaceResult(ws)));

  // 10. SYSTEM COMMANDS
  if (SYS_COMMANDS[prefix]) {
    const cmd = SYS_COMMANDS[prefix];
    results.push({
      id: `sys-${prefix}`,
      title: `${cmd.icon} ${cmd.title}`,
      subtitle: "System Command",
      type: "system",
      tag: "System",
      action: () =>
        window.electronAPI
          .systemCommand(prefix.replace("!", ""))
          .catch(console.error),
    });
  }

  // 11. SMART APP SEARCH & INSTALLED APPS
  if (results.length === 0) {
    const lowerQuery = trimmed.toLowerCase();
    
    // First check SMART_APPS
    const matchedApps = SMART_APPS.filter(
      (app) =>
        app.name.toLowerCase().includes(lowerQuery) ||
        app.aliases?.some((a) => a.includes(lowerQuery))
    );

    matchedApps.slice(0, 4).forEach((app) => {
      results.push({
        id: app.id,
        title: app.name,
        subtitle: app.exe
          ? `Launch app or open ${app.browserUrl ? "web version" : "locally"}`
          : `Open in browser → ${app.browserUrl}`,
        type: "app",
        tag: "App",
        action: async () => {
          if (app.exe) {
            const launched: boolean = await window.electronAPI.tryLaunchApp(
              app.exe
            );
            if (!launched && app.browserUrl) {
              openUrl(app.browserUrl);
            }
          } else if (app.browserUrl) {
            openUrl(app.browserUrl);
          }
        },
      });
    });

    // Then check installed apps if we have room
    if (results.length < 4 && installedApps.length > 0) {
      const remainingSlots = 4 - results.length;
      const matchedInstalled = installedApps.filter((app) => 
        app.name.toLowerCase().includes(lowerQuery)
      );

      // Filter out apps that are already in SMART_APPS (rough heuristic by name)
      const newInstalled = matchedInstalled.filter(instApp => 
        !results.some(r => r.title.toLowerCase() === instApp.name.toLowerCase())
      );

      newInstalled.slice(0, remainingSlots).forEach((app) => {
        results.push({
          id: `installed-${app.path}`,
          title: app.name,
          subtitle: "Local Application",
          type: "app",
          tag: "App",
          icon: app.icon,
          action: async () => {
            await window.electronAPI.runWorkspace([{ type: "app", path: app.path }]);
          },
        });
      });
    }
  }

  // 12. FALLBACK: Default Google search (always shown at the bottom)
  results.push({
    id: "default-web",
    title: `Search Google for "${trimmed}"`,
    subtitle: "Press Enter to search",
    type: "web",
    tag: "Web",
    action: () =>
      openUrl(
        `https://google.com/search?q=${encodeURIComponent(trimmed)}`
      ),
  });

  return results;
}

// ─── Sub-search Context Resolver ──────────────────────────────────────────────
export function getSubSearchContext(prefix: string, settings: UserSettings): SubSearchContext | null {
  const p = prefix.toLowerCase();
  
  const web = settings.webEngines.find(e => e.alias === p);
  if (web) {
    return { id: p, name: web.name, url: web.url, type: "web" };
  }

  const ai = settings.aiPlatforms.find(e => e.alias === p);
  if (ai) {
    return { id: p, name: ai.name, url: ai.url, type: "ai" };
  }
  
  return null;
}
