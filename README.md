# Hyoka Chat V1

Production-style AI chat application monorepo with a T3-inspired UI, .NET backend, plan limits, Stripe billing hooks, provider abstraction, and admin dashboard.

## Workspace layout

- `/Users/neilgilbert/Repo/hyoka-chat/apps/web` - Next.js web app (chat UI + admin + billing pages)
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Api` - ASP.NET Core API
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Domain` - domain entities/enums
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Application` - application contracts/services
- `/Users/neilgilbert/Repo/hyoka-chat/src/Hyoka.Infrastructure` - EF Core/MySQL, storage, providers, billing
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
- Web app uses Clerk sign-in/sign-up and sends JWT bearer tokens to `/api/v1/*`.
- Backend auto-provisions the user record on first authenticated request.
- Development fallback auth can be enabled via `Auth__EnableDevAuth=true` and request headers:
  - `x-dev-user-id`
  - `x-dev-email`
  - optional `x-dev-role` (`user` or `admin`)

## Environment setup

Copy `/Users/neilgilbert/Repo/hyoka-chat/.env.example` to `.env` and set real values for Clerk/Stripe/provider keys when needed.

## Run locally (without Docker)

1. Start infra services:
   - `docker compose -f deploy/docker-compose.yml up -d mysql minio`
2. Start API:
   - `dotnet run --project src/Hyoka.Api`
3. Start web:
   - `npm install`
   - `npm run dev:web`
4. Open `http://localhost:3000`

## Run full stack with Docker

- `docker compose -f deploy/docker-compose.yml up --build`

## Deploy bundled app to Fasthosts (GitHub Actions)

This repo uses `/Users/neilgilbert/Repo/hyoka-chat/.github/workflows/deploy-api-fasthosts.yml` as the primary deployment workflow.

What it does:

- Triggers on pushes to `main` when web or backend files change, and on manual runs.
- Builds the Next.js static export (`apps/web/out`).
- Publishes `src/Hyoka.Api` with `dotnet publish` into `output/api-publish` (`net8.0`, `win-x64`, framework-dependent, non-single-file).
- Copies the web export into `output/api-publish/wwwroot` so ASP.NET serves both frontend pages and `/api/v1/*`.
- Generates `appsettings.Production.json` from GitHub Actions secrets.
- Uploads the bundled output to Fasthosts via FTPS (`server-dir: ./`).

Set these GitHub repository secrets before running it:

- `FASTHOSTS_FTP_HOST` (for example `ftp.cluster0.hosting.ovh.net` or your Fasthosts FTP host)
- `FASTHOSTS_FTP_USERNAME`
- `FASTHOSTS_FTP_PASSWORD`
- `PROVIDERS__OPENAI__API_KEY`
- `CONNECTIONSTRINGS__MYSQL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK__ISSUER`

Optional secret:

- `NEXT_PUBLIC_API_BASE_URL` (leave empty for same-origin `/api` calls, or set explicitly when needed)

Optional secrets used by the workflow when provided:

- `CORS__ALLOWEDORIGINS` (comma-separated origins; defaults to `https://gb-ai.co.uk,https://www.gb-ai.co.uk,http://localhost:3000,http://127.0.0.1:3000`)
- `DATABASE__SEEDONSTARTUP` (`true`/`false`; defaults to `true` so first production deploy can self-initialize)
- `AUTH__ENABLEDEVAUTH` (`true`/`false`; defaults to `false` in production output)
- `CLERK__AUDIENCE`
- `STORAGE__SERVICEURL`
- `STORAGE__ACCESSKEY`
- `STORAGE__SECRETKEY`
- `STORAGE__BUCKET`
- `STORAGE__USEPATHSTYLE`
- `PROVIDERS__OPENAI__BASEURL`
- `PROVIDERS__ANTHROPIC__API_KEY`
- `PROVIDERS__ANTHROPIC__BASEURL`
- `PROVIDERS__OPENROUTER__API_KEY`
- `PROVIDERS__OPENROUTER__BASEURL`
- `STRIPE__SECRETKEY`
- `STRIPE__WEBHOOKSECRET`
- `STRIPE__SUCCESSURL`
- `STRIPE__CANCELURL`

Fasthosts directory notes used by this workflow:

- FTP login lands in `htdocs`; workflow uploads there by default (`server-dir: ./`).
- `cgi-bin` is reserved for executable CGI content; do not deploy site HTML/JS there.
- `logfiles` is for logs only; do not upload application files there.
- For ASP.NET/.NET private runtime data, create a sibling `private` folder (outside `htdocs`) and keep secrets/non-public files there.

## Legacy web-only workflow

`/Users/neilgilbert/Repo/hyoka-chat/.github/workflows/deploy-fasthosts.yml` is now manual-only and kept for emergency static-only rollbacks.

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
