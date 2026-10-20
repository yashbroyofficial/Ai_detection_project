# CEOVA production deployment

This guide deploys the existing Vite frontend to Vercel and the Express plus
Socket.IO signaling server to Render. Vercel and Render provide trusted HTTPS;
the files under local `certs/` are never uploaded or configured in production.

## Architecture

- Vercel serves the React application and `/camera` SPA route.
- Render serves `/api/*` and `/socket.io` from one Node web service.
- `VITE_API_ORIGIN` tells the browser library which Render origin to use.
- `PUBLIC_ORIGIN` tells the backend which Vercel origin to put in QR links.
- WebRTC media remains peer-to-peer. Render carries signaling messages only.

Origin values must look like `https://host.example` with no path, query, or
fragment. Never use `localhost` in production values and never add a wildcard
CORS origin.

## Before uploading source

This directory is not currently a Git repository, so there is no tracked-file
list or Git history to audit. Before the first push, initialize Git and verify
the ignore rules:

```powershell
git init
git status --ignored
git check-ignore .env certs/lan-key.pem node_modules client/dist server/dist
git add .
git status
git ls-files .env certs node_modules client/dist server/dist
```

The final `git ls-files` command must print nothing. Inspect the staged diff
before committing. Do not add `.env`, any file from `certs/`, private keys,
access tokens, or provider credentials. After commits exist, also audit history:

```powershell
git log --all --oneline
git log -p --all -- .env certs
git grep -n -I -E "(API_KEY|CLIENT_SECRET|ACCESS_TOKEN|PRIVATE KEY)" $(git rev-list --all)
```

If a real credential ever appears in a commit, removing the file later is not
enough. Revoke or rotate that credential before publishing and remove it from
history. The current working-tree scan found no API credential or private-key
content outside the ignored local certificate directory.

Do not push or connect the repository to a hosting provider until the user has
approved that external action.

## Vercel project preparation

Create/import the Vercel project first so Vercel assigns its stable production
origin. Antigravity owns this hosting-interface step and must add a rewrite from
`/(.*)` to `/index.html` so direct visits to `/camera` load the SPA.

For the monorepo configuration use:

- Project root: repository root
- Install command: `npm ci`
- Build command: `npm run build -w client`
- Output directory: `client/dist`
- Framework: Vite

The first deployment can be created before the backend origin is known. Once
Vercel assigns the final production origin, copy it exactly for the Render
configuration below.

## Render backend

The repository contains `render.yaml`. In Render, create a Blueprint from the
repository, review the settings, and create one web service. Do not scale it
beyond one instance.

Equivalent manual settings are:

- Runtime: Node
- Repository root: repository root
- Build command: `npm ci && npm run build -w server`
- Start command: `npm run start -w server`
- Health-check path: `/api/health`

Set these Render environment variables:

| Variable | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PUBLIC_ORIGIN` | Exact final Vercel HTTPS origin; used in every QR link |
| `ALLOWED_ORIGINS` | Exact allowed Vercel HTTPS origins, comma-separated; normally the same production origin |
| `STUN_URLS` | Optional comma-separated public STUN URLs; defaults are provided |
| `MAX_SESSIONS` | Optional in-memory session cap; default `500` |

Do not define `PORT`; Render injects it. Do not add TLS certificate paths,
private certificate keys, TURN secrets, or any frontend secret. When a Vercel
custom domain becomes the public site, update `PUBLIC_ORIGIN` and
`ALLOWED_ORIGINS` to that exact origin and restart the Render service.

After deployment, open:

```text
https://<render-service-host>/api/health
```

It must return `{ "status": "ok" }`. Render terminates public TLS, and Socket.IO
automatically uses WSS because the configured browser endpoint uses `https://`.

## Connect Vercel to Render

In the Vercel project settings, add this Production environment variable:

| Variable | Value |
| --- | --- |
| `VITE_API_ORIGIN` | Exact Render HTTPS origin, with no path |

This is a public endpoint embedded in the browser build. It is not a credential.
Redeploy the frontend after setting it; changing a Vite environment variable does
not alter an already-built deployment.

Render must simultaneously have the exact Vercel page origin in its allowed
origin configuration. Preview deployments have different origins and are
rejected unless each exact preview origin is added to `ALLOWED_ORIGINS`. Avoid
wildcards. For the first production verification, use the stable production URL.

## Production verification

1. Open the Vercel production URL and create a session.
2. Confirm the QR/link starts with the same Vercel production origin and uses
   `/camera#session=...`; the fragment is not sent in HTTP requests or provider
   access logs.
3. In browser developer tools, confirm `POST /api/sessions` targets Render and
   returns 201.
4. Confirm the Socket.IO request targets Render over WSS and returns status 101.
5. Open the generated link in a second browser/device, explicitly start the
   camera, and confirm both peers reach connected state.
6. End the session from each side in separate tests and confirm tracks stop.

## Limits of this prototype

Sessions and one-use credentials live only in the Render process memory. A
restart or deployment ends every session. Multiple Render instances would not
share sessions or Socket.IO rooms, so production preparation deliberately uses a
single instance. A shared session store and Socket.IO adapter would be required
before horizontal scaling.

The default configuration provides STUN but no TURN relay. Peer-to-peer video can
fail across restrictive NATs, carrier networks, or firewalls even when signaling
works. A production TURN service with short-lived backend-issued credentials is
the next connectivity improvement if physical cross-network testing shows that
need. This preparation does not add recording, accounts, a database, or human
detection.
