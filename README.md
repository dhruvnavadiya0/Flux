# Flux 🚀

CommandLayer is a lightning-fast, highly customizable, spotlight-like productivity command bar for Windows. Designed with a premium dark theme and smooth animations, it allows you to instantly search the web, launch applications, manage dynamic workspaces, and access various built-in utility tools—all from a single keystroke.

## ✨ Features

- **Global Hotkey:** Press `Alt + Space` from anywhere in Windows to instantly summon the command bar.
- **Dynamic Workspaces:** Launch multiple applications and websites simultaneously using custom keywords.
- **Built-in App Scanner:** Automatically scans your Windows Start Menu, making it easy to add installed apps to your workspaces.
- **Web & AI Search Engines:** Type quick aliases (e.g., `g search`, `chatgpt query`) to directly search the web or ask AI platforms.
- **Settings Dashboard:** Type `settings` to open an intuitive, built-in UI for managing your workspaces, web engines, and AI platform shortcuts.
- **Local File Search:** Instantly locate and open files on your computer.
- **Built-in Utilities:**
  - 🧮 **Calculator & Converter:** Perform math or convert units on the fly.
  - 📋 **Clipboard Manager:** Access your clipboard history.
  - 🔖 **Bookmarks:** Quickly access your saved links.
  - 🌤️ **Weather:** Check real-time weather stats.
  - 📊 **System Stats:** View CPU, RAM, and system resource usage.
  - 🔐 **Password Generator:** Generate secure passwords instantly.
  - ⏱️ **Timers:** Set quick countdowns or Pomodoro timers.
- **Premium Aesthetics:** Features a modern dark theme, soft shadows, rounded borders, and fluid cubic-bezier animations.
- **Auto-Start on Boot:** Automatically runs seamlessly in the background when your computer turns on.

## 🛠️ Tech Stack

- **Frameworks:** [Electron](https://www.electronjs.org/) & [React](https://react.dev/)
- **Build Tools:** [Vite](https://vitejs.dev/) & [TypeScript](https://www.typescriptlang.org/)
- **Packaging:** `@electron/packager`
- **Styling:** Vanilla CSS with custom design tokens.
- **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your system:
- **Node.js** (v18 or higher)
- **npm** (Node Package Manager)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/CommandLayer.git
   cd CommandLayer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in Development Mode:**
   ```bash
   npm run electron:dev
   ```
   *This starts the Vite development server and launches the Electron app simultaneously with hot-reloading.*

### Packaging for Production

To build a standalone Windows executable (`.exe`):

1. Run the build script:
   ```bash
   npm run build
   npx @electron/packager . CommandLayer --platform=win32 --arch=x64 --out=release --overwrite
   ```
2. The packaged executable will be located in the `release/CommandLayer-win32-x64/` directory.

## ⚙️ Configuration & Settings

You don't need to manually edit configuration files! CommandLayer comes with a visual settings UI.
1. Open the command bar (`Alt + Space`).
2. Type `settings` and press `Enter`.
3. Here you can:
   - Create new **Workspaces** and assign them keywords.
   - Add installed apps (via the auto-dropdown) or websites to a workspace.
   - Add or remove **Web Search** engines and **AI Platforms** with custom trigger aliases.

All settings are securely persisted in your user data directory (`%APPDATA%\commandlayer\settings.json`).

## 📜 License

This project is open-source and available under the MIT License.
