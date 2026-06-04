import { UserSettings } from "../types/electron";

export const DEFAULT_SETTINGS: UserSettings = {
  webEngines: [
    { name: "Google", url: "https://google.com/search?q=", alias: "g" },
    { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", alias: "d" },
    { name: "YouTube", url: "https://www.youtube.com/results?search_query=", alias: "yt" },
    { name: "GitHub", url: "https://github.com/search?q=", alias: "gh" },
    { name: "Google Maps", url: "https://www.google.com/maps/search/", alias: "maps" },
    { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Special:Search?search=", alias: "wiki" },
    { name: "Reddit", url: "https://www.reddit.com/search/?q=", alias: "r" },
    { name: "X / Twitter", url: "https://x.com/search?q=", alias: "tw" },
    { name: "LinkedIn", url: "https://www.linkedin.com/search/results/all/?keywords=", alias: "li" },
    { name: "Pinterest", url: "https://www.pinterest.com/search/pins/?q=", alias: "pin" },
  ],
  workspaces: [
    {
      id: "code",
      title: "Coding Session",
      subtitle: "VS Code · GitHub · ChatGPT",
      keywords: ["code", "coding", "dev", "develop", "program"],
      actions: [
        { type: "app", exe: "code" },
        { type: "url", url: "https://github.com" },
        { type: "url", url: "https://chatgpt.com" },
      ],
    },
    {
      id: "design",
      title: "Design Session",
      subtitle: "Figma · Dribbble · Pinterest",
      keywords: ["design", "figma", "ui", "ux", "creative"],
      actions: [
        { type: "app", exe: "Figma" },
        { type: "url", url: "https://dribbble.com" },
        { type: "url", url: "https://pinterest.com" },
      ],
    },
    {
      id: "study",
      title: "Study / Research",
      subtitle: "Classroom · ChatGPT",
      keywords: ["study", "research", "learn", "reading"],
      actions: [
        { type: "url", url: "https://classroom.google.com" },
        { type: "url", url: "https://chatgpt.com" },
      ],
    },
    {
      id: "meeting",
      title: "Meeting Mode",
      subtitle: "Google Classroom",
      keywords: ["meeting", "standup", "call", "teams", "zoom"],
      actions: [
        { type: "url", url: "https://classroom.google.com" },
      ],
    },
    {
      id: "morning",
      title: "Morning Routine",
      subtitle: "Gmail · HackerNews",
      keywords: ["morning", "start", "day", "routine"],
      actions: [
        { type: "url", url: "https://mail.google.com" },
        { type: "url", url: "https://news.ycombinator.com" },
      ],
    },
  ],
  aiPlatforms: [
    { name: "ChatGPT", url: "https://chatgpt.com/?q=", alias: "chatgpt" },
    { name: "Claude", url: "https://claude.ai/new?q=", alias: "claude" },
    { name: "Gemini", url: "https://gemini.google.com/app?q=", alias: "gemini" },
    { name: "ChatGPT", url: "https://chatgpt.com/?q=", alias: "gpt" },
    { name: "Perplexity", url: "https://www.perplexity.ai/search?q=", alias: "perplexity" },
  ],
  features: {
    notes: ["note", "notes", "note?"],
    clipboard: ["clip", "clipboard", "v"],
    bookmarks: ["save", "go", "bm", "bookmarks"],
    weather: ["weather"],
    system: ["sys", "stats", "system"],
    timer: ["timer", "timers", "pomo", "pomodoro"],
    password: ["pw", "password", "pass", "pin"],
  },
};
