# Morph

AI chat app where Claude dynamically generates interactive UI. Ask anything — Claude picks the right components (forms, tables, charts, maps, cards) and renders them inline. Results are clickable for drill-down detail.

Built with Claude's server-side web search and fetch tools for real-time data.

![Morph UI](https://img.shields.io/badge/AI-Powered_UI-D97706)

## Features

- **Dynamic UI generation** — Claude chooses and composes UI components on the fly
- **40+ component types** — Cards, DataTable, Charts, Maps, Calendars, Forms, Tabs, and more
- **Live web search** — Claude searches the web and renders results in rich UI
- **Clickable results** — Click any card, table row, chart bar, or map marker to drill down
- **Voice input** — Speak to chat or interact with UI via voice commands
- **Conversation history** — SQLite-backed persistence
- **Mobile responsive** — Hamburger nav on small screens

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 + TypeScript + Tailwind CSS v4 |
| Backend | Express + TypeScript |
| AI | Claude API (Sonnet 4.6 / Opus 4.6) with server-side web search |
| Database | SQLite via Drizzle ORM |
| Charts | Recharts |
| Maps | Leaflet + CartoDB Voyager tiles |

## Quick Start

```bash
# Clone
git clone https://github.com/mightiestboosh/morph-ui.git
cd morph-ui

# Install
npm install

# Start dev servers (frontend + backend)
npm run dev
```

On first load, Morph will prompt you for your [Anthropic API key](https://console.anthropic.com/settings/keys).

Alternatively, copy `.env.example` to `.env` and add your key:

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Project Structure

```
packages/
├── frontend/          # Vite + React app
│   └── src/
│       ├── components/
│       │   ├── a2ui/          # Dynamic component renderer (40+ types)
│       │   ├── chat/          # Chat UI (messages, input, surfaces)
│       │   └── layout/        # Sidebar, settings, API key modal
│       └── hooks/             # useChat, useConversations, useSettings
└── backend/           # Express API server
    └── src/
        ├── agent/             # Claude agent loop + system prompt
        │   └── tools/         # render_ui, get_location, web search
        ├── api/               # REST endpoints (chat SSE, conversations)
        └── db/                # Drizzle + SQLite schema
```

## How It Works

1. User sends a message
2. Claude analyzes the request and decides what UI to render
3. For data requests, Claude uses web search/fetch to find real information
4. Claude calls `render_ui` with a component tree — the frontend renders it
5. User clicks a result card/row → selection sent back to Claude → Claude drills down with more detail

## License

MIT
