# CEOVA backend on Back4app Containers

This deployment runs the existing Express and Socket.IO backend as one
container. Back4app terminates public HTTPS, and Socket.IO upgrades connections
to secure WebSockets through the same public origin. WebRTC media remains
peer-to-peer; the container carries session creation and signaling only.

The repository-root `Dockerfile` builds only `server/`, listens on the platform
port, exposes TCP port 3000, and runs as an unprivileged user. Local development
continues to use the existing npm scripts and local certificates.

## Free-plan limitation

Back4app currently lists the free container as 0.25 shared CPU, 256 MB RAM, and
100 GB transfer. Back4app's September 2026 free-plan guidance also says the free
deployment URL lasts for 60 minutes after each deployment; a permanent URL
requires a paid plan. Therefore, the free plan can validate CEOVA during a test
window, but it cannot provide a stable `VITE_API_ORIGIN` for the public Vercel
site. Do not select a paid plan without the user's approval.

The 256 MB memory limit is modest but should be sufficient for this signaling
prototype because it does not relay or process video. Session state is in one
container's memory, so every restart or deployment clears all sessions. Keep the
deployment at one instance. The default ICE configuration provides STUN only;
some physical-device networks will need a TURN service even when signaling is
working.

## Files used by Back4app

- Dockerfile: repository root, `Dockerfile`
- Docker build context/root directory: repository root (`/` or blank in the UI)
- Branch: `main`
- Build command: none; Back4app executes the Dockerfile
- Start command: none; the Dockerfile command starts `server/dist/index.js`
- Container port: `3000`
- Health endpoint: `/api/health`

Keep `render.yaml`; it is inactive on Back4app and remains useful as deployment
history. Do not upload `.env`, local certificates, or private keys.

## Deploy from GitHub

The Docker files must first exist on GitHub. Review and commit them locally, then
push `main` only after the user explicitly approves the push.

1. Sign in to Back4app and choose **Build new app**.
2. Select **Web Deployment** or **Containers as a Service**.
3. Connect GitHub and grant access only to
   `yashbroyofficial/Ai_detection_project` if the GitHub prompt permits it.
4. Select that repository and choose branch `main`.
5. Leave **Root directory** blank or set it to `/`. The Dockerfile is at the
   repository root; do not select `server` as the root.
6. Select the **Free** plan. Stop if the dashboard asks for a card or shows a
   non-zero price.
7. Keep one container. Automatic deployment may be disabled for the first test
   so each deployment is intentional.
8. Add the environment variables below, then create/deploy the app.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `3000` |
| `PUBLIC_ORIGIN` | `https://ceova.vercel.app` |
| `ALLOWED_ORIGINS` | `https://ceova.vercel.app` |
| `MAX_SESSIONS` | `500` |

Do not configure certificate paths. Back4app provides the public certificate.
Do not add a trailing slash to either origin. Back4app environment variable names
must be uppercase, which these names already are.

Watch both build and runtime logs. A successful runtime log contains:

```text
CEOVA signaling server listening on http://0.0.0.0:3000
```

Copy the exact HTTPS URL Back4app assigns. Do not guess it.

## Verify the deployment

Replace `<BACK4APP_HTTPS_ORIGIN>` with the exact assigned origin, without a
trailing slash.

```powershell
$backendOrigin = "<BACK4APP_HTTPS_ORIGIN>"
Invoke-RestMethod "$backendOrigin/api/health"
```

The response must contain `status` equal to `ok`. Then test the production
origin check and session response:

```powershell
$backendOrigin = "<BACK4APP_HTTPS_ORIGIN>"
$headers = @{ Origin = "https://ceova.vercel.app" }
$session = Invoke-RestMethod -Method Post `
  -Uri "$backendOrigin/api/sessions" `
  -Headers $headers
$session.joinUrl
```

The returned `joinUrl` must begin with
`https://ceova.vercel.app/camera#session=`. Treat the returned owner and viewer
credentials as temporary secrets: do not paste them into logs or issue reports.

For the browser test, Antigravity must set the Vercel production variable to the
actual URL and redeploy the frontend:

```text
VITE_API_ORIGIN=<BACK4APP_HTTPS_ORIGIN>
```

Open the Vercel site during the free URL's active window. In browser developer
tools, verify that session creation returns HTTP 201 and that `/socket.io/`
connects to the Back4app host using `wss://` (normally shown as a successful 101
WebSocket upgrade). Create a session and open its generated camera link in a
second browser/device. This verifies session and signaling behavior; claim
physical camera streaming only after an actual phone test succeeds.

If the health check fails, confirm `PORT=3000`, `HOST=0.0.0.0`, the root directory,
and the runtime logs. If HTTP works but Socket.IO is rejected, confirm the page
origin is exactly `https://ceova.vercel.app` and that both production origin
variables have no trailing slash. If the container is killed, inspect Back4app's
memory metric; the free plan has only 256 MB RAM.
