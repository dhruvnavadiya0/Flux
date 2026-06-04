const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  Notification,
  clipboard,
} = require("electron");
const path = require("path");
const { exec, spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");

// ─── Globals ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let fileIndex = []; // cached file list
let indexing = false;

const isDev = !app.isPackaged;

// ─── Paths for persistent data ────────────────────────────────────────────────
function getDataDir() {
  const dir = path.join(app.getPath("userData"), "commandlayer-data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getNotesPath() {
  return path.join(getDataDir(), "notes.json");
}

function getBookmarksPath() {
  return path.join(getDataDir(), "bookmarks.json");
}

// ─── Window Creation ──────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 520,
    minHeight: 60,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Hide instead of close
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Blur → hide (like Spotlight)
  mainWindow.on("blur", () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });
}

// ─── Toggle Window ────────────────────────────────────────────────────────────
function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.center();
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── System Tray ──────────────────────────────────────────────────────────────
function createTray() {
  // Create a simple 16x16 icon programmatically
  const icon = nativeImage.createFromBuffer(
    Buffer.alloc(16 * 16 * 4, 0),
    { width: 16, height: 16 }
  );
  // Try loading a real icon if available
  const iconPath = path.join(__dirname, "..", "public", "icon.png");
  let trayIcon = icon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip("CommandLayer");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => toggleWindow() },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => toggleWindow());
}

// ─── IPC: Open URL ────────────────────────────────────────────────────────────
ipcMain.handle("open-url", async (_event, url) => {
  await shell.openExternal(url);
});

// ─── IPC: Open URL and Auto-Submit ───────────────────────────────────────────
ipcMain.handle("open-url-and-submit", async (_event, url) => {
  await shell.openExternal(url);
  // Wait 3 seconds for the browser to open and page to load
  setTimeout(() => {
    // Use PowerShell to simulate the 'Enter' key press on the active window
    const script = `
      $wshell = New-Object -ComObject wscript.shell;
      $wshell.SendKeys('~');
    `;
    require("child_process").exec(`powershell.exe -Command "${script}"`);
  }, 3500);
});

// ─── IPC: Hide Window ─────────────────────────────────────────────────────────
ipcMain.handle("hide-window", async () => {
  if (mainWindow) mainWindow.hide();
});

// ─── IPC: Try Launch App ──────────────────────────────────────────────────────
ipcMain.handle("try-launch-app", async (_event, exe) => {
  return tryLaunchApp(exe);
});

function tryLaunchApp(exe) {
  const exeName = exe.toLowerCase().endsWith(".exe") ? exe : `${exe}.exe`;
  const baseName = exeName.slice(0, -4);

  // Capitalize first letter for folder name
  const folderName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const userProfile = os.homedir();

  const searchPaths = [
    `C:\\Program Files\\${exeName}`,
    `C:\\Program Files (x86)\\${exeName}`,
    `C:\\Program Files\\${folderName}\\${exeName}`,
    `C:\\Program Files (x86)\\${folderName}\\${exeName}`,
    `${userProfile}\\AppData\\Local\\${exeName}`,
    `${userProfile}\\AppData\\Roaming\\${exeName}`,
    `${userProfile}\\AppData\\Local\\${folderName}\\${exeName}`,
    `${userProfile}\\AppData\\Local\\Programs\\${folderName}\\${exeName}`,
    `${userProfile}\\AppData\\Local\\Programs\\${baseName}\\${exeName}`,
  ];

  // Try PATH first using `where`
  try {
    const result = require("child_process").execSync(`where ${exe}`, {
      stdio: "pipe",
      timeout: 3000,
    });
    if (result) {
      spawn("cmd", ["/C", exe], {
        detached: true,
        stdio: "ignore",
      }).unref();
      return true;
    }
  } catch (_) {
    // Not in PATH
  }

  // Try common full paths
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      spawn(searchPath, [], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
  }

  return false;
}

// ─── Helper: open URL (with delay for rapid-fire) ─────────────────────────────
function openUrl(url) {
  shell.openExternal(url);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helper: launch or browser fallback ───────────────────────────────────────
function launchOrBrowser(exe, fallbackUrl) {
  if (!tryLaunchApp(exe) && fallbackUrl) {
    openUrl(fallbackUrl);
  }
}

// ─── IPC: Run Dynamic Workspace ────────────────────────────────────────────────
ipcMain.handle("run-workspace", async (_event, actions) => {
  for (const action of actions) {
    if (action.type === "app") {
      // If it's a direct .lnk or .exe path, open it
      if (action.path && fs.existsSync(action.path)) {
        shell.openPath(action.path);
      } else if (action.exe) {
        // Fallback to legacy tryLaunchApp if path is missing
        tryLaunchApp(action.exe);
      }
    } else if (action.type === "url" && action.url) {
      shell.openExternal(action.url);
    }
    await sleep(300); // small delay between actions
  }
});

// ─── IPC: Settings ────────────────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");

ipcMain.handle("get-settings", async () => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = await fs.promises.readFile(SETTINGS_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading settings:", err);
  }
  return null; // Return null to signal client should use defaults
});

ipcMain.handle("save-settings", async (_event, settingsObj) => {
  try {
    await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(settingsObj, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error saving settings:", err);
    return false;
  }
});

// ─── IPC: Get Installed Apps ──────────────────────────────────────────────────
let cachedInstalledApps = null;

ipcMain.handle("get-installed-apps", async () => {
  if (cachedInstalledApps) return cachedInstalledApps;

  const apps = [];
  const startMenuPaths = [
    path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.PROGRAMDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu"),
    path.join(process.env.PROGRAMDATA || "", "Microsoft", "Windows", "Start Menu"),
    path.join(os.homedir(), "Desktop"),
    path.join(process.env.PUBLIC || "", "Desktop")
  ];

  function crawlLinks(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          crawlLinks(fullPath);
        } else if (fullPath.toLowerCase().endsWith(".lnk")) {
          // Exclude uninstallers and help files usually
          const lowerName = file.toLowerCase();
          if (!lowerName.includes("uninstall") && !lowerName.includes("help") && !lowerName.includes("setup")) {
            apps.push({
              name: file.replace(/\.lnk$/i, ""),
              path: fullPath
            });
          }
        }
      }
    } catch (e) {
      // ignore access denied
    }
  }

  for (const smPath of startMenuPaths) {
    crawlLinks(smPath);
  }

  // Deduplicate by name
  const seen = new Set();
  const deduped = [];
  for (const app of apps) {
    if (!seen.has(app.name)) {
      seen.add(app.name);
      deduped.push(app);
    }
  }

  // Sort alphabetically
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  const appsWithIcons = await Promise.all(deduped.map(async (a) => {
    try {
      const icon = await app.getFileIcon(a.path, { size: "normal" });
      return { ...a, icon: icon.toDataURL() };
    } catch (e) {
      return a;
    }
  }));

  cachedInstalledApps = appsWithIcons;
  return appsWithIcons;
});


// ─── IPC: System Command ──────────────────────────────────────────────────────
ipcMain.handle("system-command", async (_event, cmd) => {
  switch (cmd) {
    case "lock":
      exec("rundll32.exe user32.dll,LockWorkStation");
      break;
    case "shutdown":
      exec("shutdown /s /t 5");
      break;
    case "restart":
      exec("shutdown /r /t 5");
      break;
    case "sleep":
      exec("rundll32.exe powrprof.dll,SetSuspendState 0 1 0");
      break;
    default:
      throw new Error(`Unknown system command: ${cmd}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FILE SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".vscode",
  "__pycache__",
  ".cache",
  "AppData",
  "$Recycle.Bin",
  "System Volume Information",
  ".next",
  "dist",
  "build",
  ".idea",
  "target",
]);

const SEARCH_DIRS = [
  path.join(os.homedir(), "Desktop"),
  path.join(os.homedir(), "Documents"),
  path.join(os.homedir(), "Downloads"),
  path.join(os.homedir(), "Pictures"),
  path.join(os.homedir(), "Videos"),
  path.join(os.homedir(), "Music"),
];

const MAX_DEPTH = 5;

async function walkDir(dir, depth = 0) {
  if (depth > MAX_DEPTH) return [];

  let results = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push({
          name: entry.name,
          path: fullPath,
          isDir: true,
          ext: "",
          size: 0,
          modified: 0,
        });
        const subResults = await walkDir(fullPath, depth + 1);
        results = results.concat(subResults);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          results.push({
            name: entry.name,
            path: fullPath,
            isDir: false,
            ext: path.extname(entry.name).toLowerCase(),
            size: stat.size,
            modified: stat.mtimeMs,
          });
        } catch (_) {
          // Permission denied or other error, skip
        }
      }
    }
  } catch (_) {
    // Permission denied or other error, skip
  }
  return results;
}

async function buildFileIndex() {
  if (indexing) return;
  indexing = true;
  console.log("[FileSearch] Building file index...");
  const startTime = Date.now();

  let allFiles = [];
  for (const dir of SEARCH_DIRS) {
    if (fs.existsSync(dir)) {
      const files = await walkDir(dir);
      allFiles = allFiles.concat(files);
    }
  }
  fileIndex = allFiles;
  indexing = false;
  console.log(
    `[FileSearch] Indexed ${fileIndex.length} files in ${Date.now() - startTime}ms`
  );
}

function fuzzyMatch(query, text) {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact substring match scores highest
  if (lowerText.includes(lowerQuery)) return 100;

  // Check if all query chars appear in order
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++;
  }
  if (qi === lowerQuery.length) return 50;

  return 0;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

ipcMain.handle("search-files", async (_event, query) => {
  if (!query || query.length < 2) return [];

  const scored = fileIndex
    .map((file) => ({
      ...file,
      score: fuzzyMatch(query, file.name),
      sizeFormatted: file.isDir ? "Folder" : formatFileSize(file.size),
    }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const resultsWithIcons = await Promise.all(scored.map(async (file) => {
    if (!file.isDir && (file.ext === '.exe' || file.ext === '.lnk')) {
      try {
        const icon = await app.getFileIcon(file.path, { size: "normal" });
        return { ...file, icon: icon.toDataURL() };
      } catch (e) {
        return file;
      }
    }
    return file;
  }));

  return resultsWithIcons;
});

// ─── IPC: Open file/folder with system default ────────────────────────────────
ipcMain.handle("open-path", async (_event, filePath) => {
  await shell.openPath(filePath);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 1: NOTES
// ═══════════════════════════════════════════════════════════════════════════════
function loadNotes() {
  try {
    const data = fs.readFileSync(getNotesPath(), "utf-8");
    return JSON.parse(data);
  } catch (_) {
    return [];
  }
}

function saveNotesToDisk(notes) {
  fs.writeFileSync(getNotesPath(), JSON.stringify(notes, null, 2));
}

ipcMain.handle("save-note", async (_event, text) => {
  const notes = loadNotes();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: Date.now(),
  };
  notes.unshift(entry); // newest first
  saveNotesToDisk(notes);
  return entry;
});

ipcMain.handle("get-notes", async () => {
  return loadNotes();
});

ipcMain.handle("delete-note", async (_event, id) => {
  const notes = loadNotes();
  const filtered = notes.filter((n) => n.id !== id);
  saveNotesToDisk(filtered);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 1: TIMER
// ═══════════════════════════════════════════════════════════════════════════════
const activeTimers = new Map(); // id → { label, timeout, endsAt }

ipcMain.handle("start-timer", async (_event, seconds, label) => {
  const id = `timer-${Date.now()}`;
  const endsAt = Date.now() + seconds * 1000;

  const timeout = setTimeout(() => {
    // Show native notification
    if (Notification.isSupported()) {
      const notif = new Notification({
        title: "⏱️ Timer Complete!",
        body: label || `Your ${seconds}s timer is done`,
        icon: path.join(__dirname, "..", "public", "icon.png"),
        silent: false,
      });
      notif.show();
    }
    activeTimers.delete(id);

    // Flash the tray icon
    if (mainWindow) {
      mainWindow.flashFrame(true);
      setTimeout(() => mainWindow.flashFrame(false), 3000);
    }
  }, seconds * 1000);

  activeTimers.set(id, { label, timeout, endsAt });
  return id;
});

ipcMain.handle("cancel-timer", async (_event, id) => {
  const timer = activeTimers.get(id);
  if (timer) {
    clearTimeout(timer.timeout);
    activeTimers.delete(id);
  }
});

ipcMain.handle("get-active-timers", async () => {
  const now = Date.now();
  const result = [];
  for (const [id, timer] of activeTimers) {
    const remaining = Math.max(0, Math.round((timer.endsAt - now) / 1000));
    result.push({ id, label: timer.label, remaining });
  }
  return result;
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 2: CLIPBOARD HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
const clipboardHistory = []; // { id, text, timestamp, preview }
const MAX_CLIPBOARD_ENTRIES = 50;
let lastClipboardText = "";

function pollClipboard() {
  try {
    const current = clipboard.readText();
    if (current && current !== lastClipboardText && current.trim().length > 0) {
      lastClipboardText = current;
      const entry = {
        id: `clip-${Date.now()}`,
        text: current,
        timestamp: Date.now(),
        preview: current.length > 100 ? current.substring(0, 100) + "…" : current,
      };
      // Remove duplicates
      const existingIdx = clipboardHistory.findIndex((e) => e.text === current);
      if (existingIdx >= 0) clipboardHistory.splice(existingIdx, 1);
      clipboardHistory.unshift(entry);
      if (clipboardHistory.length > MAX_CLIPBOARD_ENTRIES) {
        clipboardHistory.pop();
      }
    }
  } catch (_) {
    // Clipboard might be locked by another app
  }
}

ipcMain.handle("get-clipboard-history", async () => {
  return clipboardHistory;
});

ipcMain.handle("set-clipboard", async (_event, text) => {
  clipboard.writeText(text);
  lastClipboardText = text; // prevent re-adding
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 2: BOOKMARKS
// ═══════════════════════════════════════════════════════════════════════════════
function loadBookmarks() {
  try {
    const data = fs.readFileSync(getBookmarksPath(), "utf-8");
    return JSON.parse(data);
  } catch (_) {
    return [];
  }
}

function saveBookmarksToDisk(bookmarks) {
  fs.writeFileSync(getBookmarksPath(), JSON.stringify(bookmarks, null, 2));
}

ipcMain.handle("save-bookmark", async (_event, alias, url) => {
  const bookmarks = loadBookmarks();
  // Update if alias already exists
  const existingIdx = bookmarks.findIndex(
    (b) => b.alias.toLowerCase() === alias.toLowerCase()
  );
  const entry = {
    id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    alias,
    url,
    createdAt: Date.now(),
  };
  if (existingIdx >= 0) {
    entry.id = bookmarks[existingIdx].id;
    bookmarks[existingIdx] = entry;
  } else {
    bookmarks.unshift(entry);
  }
  saveBookmarksToDisk(bookmarks);
  return entry;
});

ipcMain.handle("get-bookmarks", async () => {
  return loadBookmarks();
});

ipcMain.handle("delete-bookmark", async (_event, id) => {
  const bookmarks = loadBookmarks();
  const filtered = bookmarks.filter((b) => b.id !== id);
  saveBookmarksToDisk(filtered);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 2: SYSTEM STATS
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.handle("get-system-stats", async () => {
  // CPU usage — sample over 200ms
  const cpus1 = os.cpus();
  await sleep(200);
  const cpus2 = os.cpus();

  let totalIdle = 0,
    totalTick = 0;
  for (let i = 0; i < cpus1.length; i++) {
    const idle1 = cpus1[i].times.idle;
    const idle2 = cpus2[i].times.idle;
    const total1 = Object.values(cpus1[i].times).reduce((a, b) => a + b, 0);
    const total2 = Object.values(cpus2[i].times).reduce((a, b) => a + b, 0);
    totalIdle += idle2 - idle1;
    totalTick += total2 - total1;
  }
  const cpuUsage = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100) : 0;

  // Memory
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = memTotal - memFree;

  // Disk — use PowerShell for C: drive
  let diskTotal = 0,
    diskFree = 0;
  try {
    const diskInfo = execSync(
      'powershell.exe -Command "Get-PSDrive C | Select-Object Used,Free | ConvertTo-Json"',
      { stdio: "pipe", timeout: 5000 }
    );
    const parsed = JSON.parse(diskInfo.toString());
    diskTotal = (parsed.Used || 0) + (parsed.Free || 0);
    diskFree = parsed.Free || 0;
  } catch (_) {
    // Fallback: set to 0
  }

  // Battery — use PowerShell
  let battery = -1;
  let batteryCharging = false;
  try {
    const batInfo = execSync(
      'powershell.exe -Command "Get-WmiObject Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json"',
      { stdio: "pipe", timeout: 5000 }
    );
    const parsed = JSON.parse(batInfo.toString());
    if (parsed && parsed.EstimatedChargeRemaining != null) {
      battery = parsed.EstimatedChargeRemaining;
      batteryCharging = parsed.BatteryStatus === 2; // 2 = charging
    }
  } catch (_) {
    // No battery (desktop PC)
  }

  return {
    cpuUsage,
    memTotal,
    memUsed,
    diskTotal,
    diskFree,
    uptime: os.uptime(),
    battery,
    batteryCharging,
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 2: WEATHER
// ═══════════════════════════════════════════════════════════════════════════════
let weatherCache = null;
let weatherCacheTime = 0;
const WEATHER_CACHE_MS = 15 * 60 * 1000; // 15 minutes

ipcMain.handle("get-weather", async (_event, city) => {
  const targetCity = city || "Delhi"; // default city

  // Check cache
  if (
    weatherCache &&
    weatherCache.city.toLowerCase() === targetCity.toLowerCase() &&
    Date.now() - weatherCacheTime < WEATHER_CACHE_MS
  ) {
    return weatherCache;
  }

  // Step 1: Geocode city name using Open-Meteo geocoding
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetCity)}&count=1&language=en&format=json`;
  const geoResponse = await fetch(geoUrl);
  const geoData = await geoResponse.json();

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`City "${targetCity}" not found`);
  }

  const { latitude, longitude, name } = geoData.results[0];

  // Step 2: Fetch weather from Open-Meteo
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
  const weatherResponse = await fetch(weatherUrl);
  const weatherData = await weatherResponse.json();

  // Weather code to condition string
  const weatherCodeToCondition = (code) => {
    if (code === 0) return "Clear";
    if (code <= 3) return "Partly cloudy";
    if (code <= 48) return "Fog";
    if (code <= 55) return "Drizzle";
    if (code <= 57) return "Drizzle";
    if (code <= 65) return "Rain";
    if (code <= 67) return "Sleet";
    if (code <= 75) return "Snow";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Rain";
    if (code <= 86) return "Snow";
    if (code >= 95) return "Thunderstorm";
    return "Cloudy";
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const result = {
    city: name,
    temperature: Math.round(weatherData.current.temperature_2m),
    feelsLike: Math.round(weatherData.current.apparent_temperature),
    condition: weatherCodeToCondition(weatherData.current.weather_code),
    humidity: weatherData.current.relative_humidity_2m,
    windSpeed: Math.round(weatherData.current.wind_speed_10m),
    forecast: weatherData.daily.time.slice(1, 4).map((date, idx) => ({
      day: dayNames[new Date(date).getDay()],
      tempMax: Math.round(weatherData.daily.temperature_2m_max[idx + 1]),
      tempMin: Math.round(weatherData.daily.temperature_2m_min[idx + 1]),
      condition: weatherCodeToCondition(weatherData.daily.weather_code[idx + 1]),
    })),
  };

  weatherCache = result;
  weatherCacheTime = Date.now();
  return result;
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Register global shortcut: Alt+Space
  const ret = globalShortcut.register("Alt+Space", () => {
    toggleWindow();
  });
  if (!ret) {
    console.error("Failed to register Alt+Space shortcut");
  }

  // Autostart on login
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }

  // Build file index on startup, then refresh every 5 minutes
  await buildFileIndex();
  setInterval(() => buildFileIndex(), 5 * 60 * 1000);

  // Start clipboard polling (Phase 2)
  setInterval(pollClipboard, 500);
  // Initialize with current clipboard
  lastClipboardText = clipboard.readText() || "";
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // Don't quit on window close — keep running in tray
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      toggleWindow();
    }
  });
}
