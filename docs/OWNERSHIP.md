# CEOVA ownership and collaboration

This directory is shared by Codex and Google Antigravity. Do not overwrite,
delete, recreate, or refactor another agent's files without the user's explicit
authorization. Inspect existing files before writing. Do not run scaffold
generators over the project or destructive Git commands.

## Codex

- `server/**`: Express, sessions, Socket.IO, validation, backend tests.
- `client/src/lib/**`: WebRTC, socket client, session controller, React hooks,
  related types and library tests.
- `docs/API_CONTRACT.md` and this document.
- Root configuration, server package configuration, initial client scaffolding
  and package configuration, shared dependencies, environment examples, initial
  `README.md`.

## Google Antigravity

- `client/src/components/**`
- `client/src/pages/**`
- `client/src/styles/**`
- `client/src/assets/**`
- `client/src/App.tsx`, `client/src/App.css`, `client/src/index.css`

Antigravity owns the complete interface, previews, QR presentation, animations,
and visual styling. Codex must not implement these. The initial entry point will
import `App.tsx`; Antigravity supplies that component. There is deliberately no
generated placeholder UI in the owned paths.

Antigravity must use the exports from `client/src/lib/index.ts` and must not
independently implement signaling, WebRTC, camera capture, or socket lifecycle.
Request dependency/configuration changes from Codex. Both agents should preserve
in-progress work in this shared directory.

## Integration

Read `API_CONTRACT.md` before building the frontend. Keep camera start behind an
explicit click/tap. A page load, mount effect, QR scan, or socket event must never
start capture. Render streams through video elements with `srcObject`; clear
those references when the library returns `null`.

Keep credentials in memory. Do not put viewer tokens in URLs or log pairing
tokens. Do not add recording, accounts, databases, LAN discovery, or AI services.
