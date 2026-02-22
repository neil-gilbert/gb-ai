# Hyoka Chat V1

Production-style AI chat application monorepo with a T3-inspired UI, .NET backend, plan limits, Stripe billing hooks, provider abstraction, and admin dashboard.

## Workspace layout

- `/Users/neilgilbert/Repo/hyoka-chat/apps/web` - Next.js web app (chat UI + admin + billing pages)
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Api` - ASP.NET Core API
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Domain` - domain entities/enums
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Application` - application contracts/services
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Infrastructure` - EF Core/Postgres, storage, providers, billing
- `/Users/neilgilbert/Repo/hyoka-chat/tests` - unit and integration tests
- `/Users/neilgilbert/Repo/hyoka-chat/deploy/docker-compose.yml` - local orchestration

## Features implemented

- Sidebar chat UI with collapse toggle, search, grouped chat history, and new chat button disabled when current chat is empty.
- Main chat panel with empty-state example prompts, message bubbles, and assistant waiting signal.
- Composer with model selector, attachment picker (images + docs), 1MB file limit enforcement.
- SSE streaming endpoint and incremental assistant rendering in the UI.
- Attachments flow: presign -> upload -> finalize -> inline extraction for docs.
- Plan-based limits: RPM + daily + monthly request/credit quotas.
- Weighted credit metering based on model input/output weights.
- Model catalog with provider mapping and optional fallback model.
- Basic per-user memory facts and rolling chat summary context injection.
- Stripe checkout/portal/webhook endpoints.
- Admin dashboard for users/plans/models/usage.

## Auth behavior

- Backend supports Clerk JWT validation (`Authorization: Bearer ...`) and maps user identity from `sub`.
- Development fallback auth is enabled via request headers:
  - `x-dev-user-id`
  - `x-dev-email`
  - optional `x-dev-role` (`user` or `admin`)
- Web app includes a sidebar login form that sets those dev headers automatically for local use.

## Environment setup

Copy `/Users/neilgilbert/Repo/hyoka-chat/.env.example` to `.env` and set real values for Clerk/Stripe/provider keys when needed.

## Run locally (without Docker)

1. Start infra services:
   - `docker compose -f deploy/docker-compose.yml up -d postgres minio`
2. Start API:
   - `dotnet run --project src/Hyoka.Api`
3. Start web:
   - `npm install`
   - `npm run dev:web`
4. Open `http://localhost:3000`

## Run full stack with Docker

- `docker compose -f deploy/docker-compose.yml up --build`

## Deploy web to Fasthosts (GitHub Actions)

This repo includes `/Users/neilgilbert/Repo/hyoka-chat/.github/workflows/deploy-fasthosts.yml`.

What it does:

- Triggers on pushes to `main` (when web files change) and manual runs.
- Builds the Next.js app as a static export (`apps/web/out`).
- Uploads that output directory to Fasthosts via FTPS.

Set these GitHub repository secrets before running it:

- `FASTHOSTS_FTP_HOST` (for example `ftp.cluster0.hosting.ovh.net` or your Fasthosts FTP host)
- `FASTHOSTS_FTP_USERNAME`
- `FASTHOSTS_FTP_PASSWORD`
- `FASTHOSTS_FTP_TARGET_DIR` (for example `/public_html/`)
- `NEXT_PUBLIC_API_BASE_URL` (public URL of your API, for example `https://api.gb-ai.co.uk`)

## Quality checks

- Backend tests:
  - `dotnet test HyokaChat.sln`
- Frontend lint:
  - `npm run lint:web`
- Frontend production build:
  - `npm run build:web`

## API notes

Primary API group: `/api/v1`

Implemented endpoints include:

- `GET /api/v1/auth/me`
- `GET /api/v1/models`
- `POST /api/v1/chats`
- `GET /api/v1/chats`
- `GET /api/v1/chats/{chatId}/messages`
- `POST /api/v1/chats/{chatId}/messages/stream`
- `POST /api/v1/attachments/presign`
- `PUT /api/v1/attachments/{attachmentId}/upload`
- `POST /api/v1/attachments/{attachmentId}/finalize`
- `GET /api/v1/usage`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal`
- `POST /api/v1/webhooks/stripe`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/plans`
- `PUT /api/v1/admin/plans/{planId}`
- `GET /api/v1/admin/models`
- `PUT /api/v1/admin/models/{modelId}`
- `GET /api/v1/admin/usage`
