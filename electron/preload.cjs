const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ─── Existing ───────────────────────────────────────────────────────────────
  // Open a URL in the default browser
  openUrl: (url) => ipcRenderer.invoke("open-url", url),

  // Open a URL and auto-submit using Enter key simulation
  openAndSubmitUrl: (url) => ipcRenderer.invoke("open-url-and-submit", url),

  // Hide the main window
  hideWindow: () => ipcRenderer.invoke("hide-window"),

  // Try to launch a Windows app by exe name. Returns true if launched.
  tryLaunchApp: (exe) => ipcRenderer.invoke("try-launch-app", exe),

  // Execute a dynamic workspace
  runWorkspace: (actions) =>
    ipcRenderer.invoke("run-workspace", actions),

  // ─── Settings ───────────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settingsObj) => ipcRenderer.invoke("save-settings", settingsObj),
  getInstalledApps: () => ipcRenderer.invoke("get-installed-apps"),

  // Execute system commands: lock, sleep, shutdown, restart
  systemCommand: (cmd) => ipcRenderer.invoke("system-command", cmd),

  // Search files on the local filesystem. Returns array of file results.
  searchFiles: (query) => ipcRenderer.invoke("search-files", query),

  // Open a file or folder with the system default application
  openPath: (filePath) => ipcRenderer.invoke("open-path", filePath),

  // ─── Phase 1: Notes ─────────────────────────────────────────────────────────
  saveNote: (text) => ipcRenderer.invoke("save-note", text),
  getNotes: () => ipcRenderer.invoke("get-notes"),
  deleteNote: (id) => ipcRenderer.invoke("delete-note", id),

  // ─── Phase 1: Timer ─────────────────────────────────────────────────────────
  startTimer: (seconds, label) =>
    ipcRenderer.invoke("start-timer", seconds, label),
  cancelTimer: (id) => ipcRenderer.invoke("cancel-timer", id),
  getActiveTimers: () => ipcRenderer.invoke("get-active-timers"),

  // ─── Phase 2: Clipboard History ─────────────────────────────────────────────
  getClipboardHistory: () => ipcRenderer.invoke("get-clipboard-history"),
  setClipboard: (text) => ipcRenderer.invoke("set-clipboard", text),

  // ─── Phase 2: Bookmarks ─────────────────────────────────────────────────────
  saveBookmark: (alias, url) =>
    ipcRenderer.invoke("save-bookmark", alias, url),
  getBookmarks: () => ipcRenderer.invoke("get-bookmarks"),
  deleteBookmark: (id) => ipcRenderer.invoke("delete-bookmark", id),

  // ─── Phase 2: System Stats ──────────────────────────────────────────────────
  getSystemStats: () => ipcRenderer.invoke("get-system-stats"),

  // ─── Phase 2: Weather ───────────────────────────────────────────────────────
  getWeather: (city) => ipcRenderer.invoke("get-weather", city),
});
