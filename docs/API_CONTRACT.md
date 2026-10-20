# CEOVA integration contract

Status: implementation in progress. This document defines the interfaces Codex
will implement. Antigravity owns the UI and should import only from
`client/src/lib/index.ts`. No UI files will be supplied by Codex.

## Deployment and URLs

Use one browser origin for the frontend, `/api`, and `/socket.io`. Vite proxies
the latter two to the loopback backend in development. Set root `.env`
`PUBLIC_ORIGIN=https://<laptop-LAN-IP>:5173` and configure a trusted TLS certificate
as described in README. The backend does not trust arbitrary Host headers for
QR generation. A missing, HTTP, or loopback PUBLIC_ORIGIN prevents session creation
with `PUBLIC_ORIGIN_REQUIRED`; the server health check still works.
During development, signaling accepts that public origin plus
`https://localhost:5173` and `https://127.0.0.1:5173`, so the laptop can use a
loopback URL while generated phone links still use the reachable LAN address.
Production accepts only `PUBLIC_ORIGIN` and explicitly configured
`ALLOWED_ORIGINS`.

For a separately hosted frontend, set the Vite build variable
`VITE_API_ORIGIN` to the Render HTTPS origin, with no path. The library uses
that origin for `/api/*` and `/socket.io`. Leave it unset locally so Vite's
same-origin proxy remains active. This variable is a public endpoint, not a
secret. Render must allow the exact Vercel page origin in `PUBLIC_ORIGIN` or
`ALLOWED_ORIGINS`; wildcard origins are not supported.

QR/direct sender link:
`https://<public-origin>/camera#session=<sessionId>&token=<senderToken>`.
Serve the SPA on `/camera`. Fragment credentials are not sent in HTTP requests.
The frontend must use the returned `joinUrl` without reconstructing it from
`localhost`. Only one viewer and one sender can join; a second join is rejected.
Tokens are consumed on first join. Refresh/reconnect requires a new session.

## HTTP

All API responses use `Cache-Control: no-store`. JSON errors are
`{ error: { code: string, message: string } }`.

| Endpoint | Result |
| --- | --- |
| `GET /api/health` | `{ status: "ok" }` |
| `GET /api/config` | `{ iceServers: RTCIceServer[] }` (public STUN only) |
| `POST /api/sessions` | HTTP 201, `CreatedSession` below; empty request body |
| `GET /api/sessions/:id` | `{ sessionId, status: "waiting" \| "paired" \| "active", expiresAt }`; 404 after deletion/expiry |

`CreatedSession`:
```ts
{
  sessionId: string;
  viewerToken: string; // private: never display, persist, or share
  joinUrl: string;     // sender bearer credential: show as QR/copy link
  expiresAt: number;   // epoch milliseconds; 5 minutes after creation
}
```

The pairing deadline remains in force until both peers join and the sender starts
the camera. Ready sessions have a maximum lifetime of two hours after creation.
Ending, disconnecting, camera-stop, expiry, or server restart invalidates the
session permanently. No sessions are persisted.

## Socket.IO

Default same-origin `/socket.io` path. Automatic reconnection is disabled by the
library. Each client command has an acknowledgement
`{ ok: true, data: T } | { ok: false, error: { code, message } }`.
Except `session:join`, commands require an authenticated socket membership.
Do not implement these events in UI code.

| Client event | Payload | Acknowledgement data |
| --- | --- | --- |
| `session:join` | `{ sessionId, token, role: "viewer" \| "sender" }` | `{ sessionId, role, expiresAt }` |
| `sender:ready` | `{}`; sender only, after permission and track acquisition | `{}` |
| `signal:offer` | `{ type: "offer", sdp: string }`; viewer only | `{}` |
| `signal:answer` | `{ type: "answer", sdp: string }`; sender only | `{}` |
| `signal:ice` | `RTCIceCandidateInit \| null` | `{}` |
| `peer:state` | `{ state: RTCPeerConnectionState }` | `{}` |
| `session:end` | `{}` | `{}` |

| Server event | Payload |
| --- | --- |
| `peer:ready` | `{}`; both peers are present and camera is ready |
| `signal:offer`, `signal:answer`, `signal:ice` | Validated other peer's payload |
| `peer:state` | `{ state }`; viewer reports `connected` after inbound video is confirmed |
| `session:ended` | `{ reason: "ended" \| "peer-disconnected" \| "expired" \| "server-shutdown" }` |

Signaling messages are routed only to the other member of the authenticated
session. Clients cannot choose a target socket or room. Payloads, role, ordering,
rate, and membership are validated. HTTP creation and socket traffic are bounded.

## Public frontend library

```ts
import {
  useCameraSession, CameraSessionController, CeovaError,
  parseCameraLink, createQrDataUrl,
} from "./lib";
```

`useCameraSession(options?: { iceServers?: RTCIceServer[] })` returns the
snapshot fields below plus stable methods:

- `createSession(): Promise<SessionInfo>`: create and join as the laptop viewer.
  Returns `{ sessionId, joinUrl, expiresAt }`.
- `joinSession(pairing: PairingCredentials): Promise<void>`: join as sender without
  requesting the camera. Call once for the `/camera` route.
- `startCamera(constraints?: MediaTrackConstraints): Promise<void>`: sender only.
  **Call directly from the "Allow & Start Camera" click/tap handler** after joining.
  Requests video only (no microphone), prefers the environment-facing camera,
  then signals readiness. Never call from a mount effect.
- `endSession(): Promise<void>`: immediately stop tracks/close peer; notify server.
  Works for either role and also cancels an outstanding permission request
  logically (any subsequently returned tracks are stopped immediately).
- `clearError(): void`: clear displayed error.

All async action failures reject `CeovaError` and set `error` in the snapshot.
Catch promises in UI handlers to avoid unhandled rejections.

Snapshot:
```ts
type ConnectionStatus =
  | "idle" | "creating" | "joining" | "waiting"
  | "requesting-camera" | "connecting" | "connected" | "ended" | "error";
type SessionInfo = { sessionId: string; joinUrl?: string; expiresAt: number };
type PairingCredentials = { sessionId: string; token: string };
type SessionSnapshot = {
  status: ConnectionStatus;
  role: "viewer" | "sender" | null;
  session: SessionInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  mediaReceived: boolean; // viewer has confirmed inbound video frames
  framesReceived: number; // latest inbound video frame count
  peerState: RTCPeerConnectionState | null;
  error: { code: string; message: string } | null;
  endReason: string | null;
};
```

`parseCameraLink(url?: string): PairingCredentials` parses and validates the
fragment of the supplied URL, defaulting to `window.location.href`. It does not
join, capture, mutate browser history, or consume the token. Keep the result in
memory; the UI may remove the fragment via `history.replaceState` after parsing.
`createQrDataUrl(joinUrl: string): Promise<string>` returns a PNG data URL.

For non-React use, `new CameraSessionController(options?)` exposes the same
methods plus `getSnapshot()`, `subscribe(listener): () => void`, and `dispose()`.
React hook unmount calls `dispose()`, ending the session and stopping tracks.
Use a single hook instance at a stable route/provider level per device.

## UI integration checklist

1. Viewer button calls `createSession()`; render `session.joinUrl` as a QR using
   `createQrDataUrl()` and provide a copyable link and expiry countdown.
2. Sender `/camera` route parses the fragment and joins once without capture.
   Show an explicit permission/start button, which calls `startCamera()`.
3. Set viewer video `srcObject = remoteStream`; use `autoPlay` and `playsInline`.
   Local sender preview uses `localStream`, `muted`, `autoPlay`, `playsInline`.
   Handle playback rejection with a user-controlled Play action.
4. Either page's End button calls `endSession()`. Clear previews when stream
   becomes null. Display errors and `endReason`.
5. Do not persist credentials or automatically retry consumed tokens. Ask the
   viewer to create a new session after any disconnect/expiry/refresh.

Representative errors: `INVALID_REQUEST`, `SESSION_UNAVAILABLE`,
`INVALID_TOKEN`, `ROLE_TAKEN`, `ALREADY_JOINED`, `NOT_JOINED`, `WRONG_ROLE`,
`PEER_NOT_READY`, `INVALID_SIGNAL`, `RATE_LIMITED`, `PUBLIC_ORIGIN_REQUIRED`,
`NETWORK_ERROR`, `ACK_TIMEOUT`, `INSECURE_CONTEXT`, `CAMERA_DENIED`,
`CAMERA_NOT_FOUND`, `CAMERA_BUSY`, `CAMERA_ERROR`, `WEBRTC_ERROR`,
`WEBRTC_NO_VIDEO`, `INVALID_STATE`, `CANCELLED`.

Permission denial or device failure ends the reserved session and stops any
tracks; create a new pairing to try again. A transient WebRTC `disconnected`
state gets a ten-second grace period; signaling disconnect and WebRTC `failed`
end immediately. No recording, background capture, device scanning, or accounts.
