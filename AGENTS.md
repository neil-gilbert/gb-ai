# Agent Instructions

## Fasthosts Deployment (Web + API)

Use these rules when deploying this repository to Fasthosts.

### Directory layout and upload targets
- `htdocs` is the public web root. Upload website assets here.
- `cgi-bin` is only for executable CGI/perl/python content. Do not upload HTML/PHP/app files here unless they are meant to execute as CGI.
- `logfiles` is for host-managed logs only. Do not upload application files here.
- Create a sibling `private` directory alongside `htdocs` (and `logfiles`) for non-public runtime data and secrets.

### Security and secrets
- Never commit secrets to git.
- Keep API keys and sensitive runtime files outside public `htdocs`, preferably in `private`.
- For this app specifically, `Providers__OpenAI__ApiKey` must never be exposed in frontend code or `NEXT_PUBLIC_*` variables.

### Hyoka chat project mapping
- Frontend static export (`apps/web/out`) deploys to `htdocs`.
- Backend (`src/Hyoka.Api`) should run as server-side ASP.NET hosting; do not treat it as static content.
- Fasthosts runtime constraint for this project: keep backend target/runtime on `.NET 8` (`net8.0`) unless hosting support changes.
- Use MySQL (`ConnectionStrings:MySql`) for database configuration on this hosting setup.
- If Fasthosts plan supports ASP.NET app hosting, deploy API runtime/published output per host ASP.NET guidance and keep config secrets in non-public storage.
- If the plan does not support long-running ASP.NET Core API hosting, keep frontend on Fasthosts and host the API elsewhere (VPS/container platform), then point `NEXT_PUBLIC_API_BASE_URL` to that API URL.

### Default document behavior
- Ensure the site has a valid default document in `htdocs` so root URL requests resolve successfully.
- If multiple default documents exist, server precedence determines which is served.

### Existing workflow note
- `.github/workflows/deploy-fasthosts.yml` currently deploys only the frontend static site via FTPS.
- It does not deploy the ASP.NET API runtime.
