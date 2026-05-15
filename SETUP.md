# SVA Platform — Setup Guide

## Prerequisites
- Node.js 20+  
- Docker Desktop  
- npm 10+  

---

## 1. Clone & Install

```bash
git clone <your-repo>
cd sva-platform
npm install
```

---

## 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` — at minimum, change these:

| Variable | What to set |
|---|---|
| `JWT_SECRET` | Run: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Run: `openssl rand -hex 32` again |
| `ANTHROPIC_API_KEY` | Your key from https://console.anthropic.com |

All marketplace API keys have `REPLACE_WITH_` placeholders — **leave them as-is until you add credentials**.  
The app will run fine without them — just connect channels later via Settings.

For the frontend, create `apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any-random-32-char-string
```

---

## 3. Start All Services

```bash
docker-compose up -d
```

This starts:
| Service | URL |
|---|---|
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| MinIO (file storage) | http://localhost:9001 (admin UI) |
| MailHog (dev email) | http://localhost:8025 |

---

## 4. Run DB Migrations

```bash
cd packages/db
npx prisma generate
npx prisma migrate dev --name init
cd ../..
```

---

## 5. Start Dev Servers

```bash
npm run dev
```

| App | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| API Docs | http://localhost:4000/docs |

---

## 6. First Login

1. Go to http://localhost:3000/register
2. Create your workspace (Org: `SVA Organics`, Slug: `sva-organics`)
3. You'll be logged in as SUPER_ADMIN
4. Go to **Settings → Channel Integrations** to connect Amazon, Shopify, etc.

---

## Adding API Credentials Later

Each marketplace has a settings card under **Settings → Channel Integrations**.  
Just fill in the credentials and hit **Save & Connect**.

When you're ready to add credentials, also update your `.env` file  
(the env vars are only used if you need server-side marketplace sync jobs).

### Where to get credentials:

| Channel | Where |
|---|---|
| Amazon SP-API | https://sellercentral.amazon.com → Apps & Services → Develop Apps |
| Shopify | your-store.myshopify.com/admin → Settings → Apps → Private Apps |
| Walmart | https://developer.walmart.com → My Applications |
| TikTok Shop | https://partner.tiktokshop.com → Open Platform |
| Myntra | Contact partnersupport@myntra.com |
| Flipkart | https://seller.flipkart.com/api-docs → Register App |

---

## Production Deployment

```bash
docker-compose -f docker-compose.prod.yml up -d
```

*(Production compose file — to be added in Phase 2)*

---

## Architecture

```
sva-platform/
├── apps/
│   ├── web/          # Next.js 14 frontend (port 3000)
│   └── api/          # Fastify API backend (port 4000)
├── packages/
│   ├── db/           # Prisma schema + client
│   ├── types/        # Shared TypeScript types
│   └── ui/           # Shared components (future)
├── docker-compose.yml
└── .env.example
```
