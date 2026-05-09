# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cola-Space is a NestJS service that automatically fetches VPN subscriptions, generates unified Clash YAML files, and provides subscription APIs. It supports scheduled refresh, manual refresh, local storage, and optional traffic threshold email alerts.

## Common Commands

```bash
pnpm install              # Install dependencies (postinstall runs playwright install chromium)
pnpm run start:dev        # Run in development mode (ts-node)
pnpm run build            # Compile TypeScript to dist/
pnpm run start            # Run compiled production build
```

## Architecture

```
src/main.ts → AppModule → SubscribeModule + SchedulerModule
```

**Entry point** (`src/main.ts`): Loads `.env` then `.env.local` (override), sets global prefix `/api`, optionally triggers initial refresh on startup.

**SubscribeModule** handles the core logic:
- `subscribe.service.ts` - `refresh()` is the main flow: tries stored URL first → falls back to Playwright crawler (5 attempts) → saves to `.data/`
- `subscribe.controller.ts` - HTTP endpoints (all prefixed `/api/subscribe/*`)

**SchedulerModule**: Uses `@nestjs/schedule` + `cron` to run refresh on a configurable cron expression.

**Services** (shared):
- `crawler.service.ts` - Playwright-based login and scraping
- `fetcher.service.ts` - Subscription URL fetching + YAML parsing
- `storage.service.ts` - File persistence to `.data/` directory
- `mail.service.ts` - nodemailer traffic alert emails

## Data Flow

One refresh cycle:
1. Read stored subscription URL from `.data/meta.json`
2. If URL exists, fetch directly; on failure, fall back to step 3
3. Use Playwright to login to subscription site and scrape fresh URL
4. Fetch subscription content, parse/proces
5. Save `latest.yml`, `nodes.json`, `meta.json` to `.data/`
6. If `MAIL_TO` is configured, check `subscription-userinfo` header and send alert if threshold exceeded

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscribe/clash` | Returns latest Clash YAML (supports ETag/304) |
| GET | `/api/subscribe/nodes` | Returns node list as JSON |
| GET | `/api/subscribe/shadowrocket?base64=1` | Generates ss:// links for Shadowrocket |
| GET | `/api/subscribe/sample` | Returns sample YAML from `data-sample/` |
| GET | `/api/subscribe/status` | HTML status page with refresh button |
| POST | `/api/subscribe/refresh` | Manual refresh (requires `x-api-key` header) |

## Key Files

- `.env` / `.env.local` - Environment variables (`.env.local` takes precedence and is git-ignored)
- `ecosystem.config.js` - PM2 process manager configuration
- `deploy/deploy.js` - Server-side deployment script (git pull → pnpm install → build → pm2 restart)
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD to Windows server via SSH

## Environment Variables

Critical (must be set for production):
- `API_KEY` - Manual refresh authentication (change from default)
- `COFFEE_USERNAME` / `COFFEE_PASSWORD` - Crawler login credentials
- `CRON_EXPR` - Cron schedule (default: `0 9,18 * * *`)

Traffic alert (optional):
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_TO`
- `TRAFFIC_THRESHOLD` - Alert threshold (default: 0.5 = 50%)

HTTPS (optional):
- `ENABLE_HTTPS=true`, `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH`

## Notes

- Data is stored under `./.data/` by default: `latest.yml`, `nodes.json`, `meta.json`
- Playwright runs in headless mode by default
- The status page (`/api/subscribe/status`) includes an interactive refresh button that prompts for API_KEY