# FamilyCalendar · Household Operations & AI Planner

A lightweight, self-hosted **family operations calendar** built on **Cloudflare Workers + Workers Static Assets + D1 (SQLite) + Hono + React + Gemini AI**.

Designed for households where standard calendars fall short: irregular shift schedules, school A/B timetables & holidays, school strike alerts, electricity tariff alerts (e.g. French EDF Tempo), advance deadline/payment radar, quick multi-line family inbox, and AI-assisted human-in-the-loop scheduling.

> **零成本、全栈单项目部署**：前端 SPA + 后端 CRUD API + D1 SQLite 数据库 + 每日定时任务全在一个 Cloudflare Worker 内；支持 Cloudflare Access 零代码家庭白名单锁权。

---

## Features / 核心特性

- **2-Week Default View + Month View + Mobile Agenda Cards**: Desktop defaults to a spacious 2-week grid with true **multi-day spanning bars**; mobile (`< 760px`) automatically switches to a vertical daily card feed.
- **Daily Household Status Layer (`daily_status`)**: Compact per-day status pills without cluttering events:
  - Irregular shift schedule with exact hours & quick-fill presets (e.g. `09:45-17:45`, `11:45-19:45`, `Repos`, `Leave`)
  - Second adult status (`Work`, `WFH`, `Leave`, `Travel`, `Off`)
  - School status (`Normal`, `Strike / Grève`, `Partial strike`, `Holiday`)
  - Live **EDF Tempo** daily sync (`api-couleur-tempo.fr`, silent on Blue days, alerts on White/Red days)
- **Collapsible 7-Day Upcoming Radar**: Surfaces urgent Tempo White/Red days, school strikes, upcoming deadlines, bill payments, exams, and unbooked outings with one-click completion.
- **Batch Weekly Recurring Events**: Create full-semester recurring activities (e.g. sports/music/language classes) while automatically skipping school vacation windows.
- **Folded A/B Week Timetable & Quick Links**: Keeps school timetables folded by default with automatic Semaine A/B & holiday detection, plus a collapsible family links/info bar.
- **Human-in-the-Loop AI Organizer + Schedule Photo Import**:
  - Multi-line family Todo Inbox (natural language in any language) → nightly Cron or manual button parses into a **Pending Review Queue** (manual confirmation required before writing to calendar).
  - Upload a photo/screenshot of a shift roster → Gemini multimodal vision extracts shifts into the review queue with inline time editing and one-click batch confirm.
  - **Built-in Demo AI Mode (`DEMO_AI_MODE=true`)**: Try the AI review workflow locally even without configuring a `GEMINI_API_KEY`!
- **3 Eye-Friendly Themes**: One-click switch between **Nord** (default dark), **Tokyo Night** (deep indigo dark), and **Warm Parchment** (soft non-white light).

---

## Quick Start (Local SQLite Demo in 30 Seconds)

Prerequisites: **Node.js 20+**

```bash
# 1. Install dependencies
npm install

# 2. Initialize local D1 SQLite database with dynamic demo data (anchored to today)
npm run demo:setup

# 3. Start local full-stack dev server (React + Hono + local SQLite D1)
npm run dev
```

Open **http://localhost:5173** in your browser!

- All demo dates are generated relative to `date('now')`, so you immediately see today's shifts, a multi-day trip bar, 7-day alerts, A/B timetable, sample todos, and a pending AI review proposal.
- Clicking **「AI 整理」** works immediately via the built-in offline `DEMO_AI_MODE` simulator. To enable real Google Gemini parsing & shift-photo vision locally, copy `.dev.vars.example` to `.dev.vars` and add your `GEMINI_API_KEY`.

---

## Customize for Your Own Family

Edit a single file: **`src/shared/household.ts`** to set:
- Household member names & colors
- Shift quick-fill hour presets
- School vacation windows & A/B week anchor

---

## Deploy to Cloudflare (Free Tier)

1. **Authenticate Wrangler**:
   ```bash
   npx wrangler login
   ```
2. **Create a remote D1 database** (choose region closest to you, e.g. `weur`, `wnam`, `apac`):
   ```bash
   npx wrangler d1 create family-calendar-db --location weur
   ```
3. Paste the returned `database_id` into `wrangler.jsonc`.
4. **Apply schema migrations to remote D1**:
   ```bash
   npx wrangler d1 execute DB --remote --file=migrations/0001_init.sql
   npx wrangler d1 execute DB --remote --file=migrations/0002_ab_and_links.sql
   ```
5. **Deploy the Worker** (and disable Demo AI mode once using real Gemini):
   ```bash
   npm run deploy
   npx wrangler secret put GEMINI_API_KEY
   ```
6. **Lock down access with Cloudflare Access (Zero Trust)**:
   - In Cloudflare Zero Trust Dashboard (`one.dash.cloudflare.com`), create an **Allow** policy with Selector **`Emails`** listing only your household email addresses (One-time PIN works with any email provider, session duration up to 7d/1m).
   - Attach the policy to your production Worker domain (`*.workers.dev` or your custom domain).

---

## Optional: Gmail Sync via Google Apps Script

See [`gas/README.md`](./gas/README.md) and [`gas/Code.gs`](./gas/Code.gs) for an optional zero-OAuth-expiry Google Apps Script bridge that pushes selected school/appointment/booking emails into `/api/ingest/gmail`.

---

## Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript, Lucide Icons, Pure CSS Variables
- **Backend**: Cloudflare Workers + Workers Static Assets + Hono + Cron Triggers
- **Database**: Cloudflare D1 (SQLite)
- **AI**: Google Gemini API (`gemini-3.8-flash` default, configurable via `GEMINI_MODEL`)

## License

[MIT](./LICENSE)
