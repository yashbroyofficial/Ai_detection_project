# CEOVA

CEOVA pairs a laptop viewer with one smartphone camera using a temporary QR
link, Socket.IO signaling, and a direct WebRTC connection. It has no accounts,
database, recording, device discovery, or automatic camera activation.

The frontend interface is being built independently by Google Antigravity.
Codex owns the server and `client/src/lib`. Read
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) before integrating the UI and
[`docs/OWNERSHIP.md`](docs/OWNERSHIP.md) before changing files.

## Requirements

- Node.js 22.12 or newer
- A laptop and phone on the same LAN
- A hostname/IP certificate trusted by both devices

Camera APIs require a secure browser context. A certificate warning that the
user clicks through is not consistently sufficient on mobile; install and trust
the development CA on both devices.

## Trusted LAN HTTPS with mkcert

The example below uses `192.168.1.25`; replace it with the laptop's current LAN
address (`ipconfig` on Windows). Do not use `localhost` in `PUBLIC_ORIGIN` because
that would refer to the phone itself after scanning.

1. Install [mkcert](https://github.com/FiloSottile/mkcert) and run `mkcert -install`.
2. From this project directory, create `certs`, then generate a certificate:

   ```powershell
   New-Item -ItemType Directory -Path certs -Force
   mkcert -cert-file certs/lan.pem -key-file certs/lan-key.pem 192.168.1.25 localhost 127.0.0.1
   ```

3. Run `mkcert -CAROOT`, securely transfer only `rootCA.pem` from that directory
   to the phone, and install it as a trusted user CA. Never transfer `rootCA-key.pem`.
   iOS also requires enabling full trust for the installed root certificate.
4. Copy `.env.example` to `.env`, put the same LAN IP in `PUBLIC_ORIGIN`, and keep
   the provided certificate paths.
5. Allow inbound TCP port 5173 through the laptop firewall on the private network.

For the certificate generated on this workstation, the phone-safe public CA copy
is `certs/ceova-local-rootCA.cer`. Import that certificate on the laptop and phone;
never transfer `lan-key.pem` or the `rootCA-key.pem` stored under the mkcert CA
directory. On Windows, approve the certificate import into **Current User → Trusted
Root Certification Authorities**. If `mkcert -install` is used instead, approve
the Windows certificate confirmation dialog.

The laptop's current Wi-Fi profile is public. For smartphone testing, prefer a
trusted home/private Wi-Fi network or a personal hotspot because institutional
networks commonly isolate wireless devices. On a trusted network, set its Windows
profile to Private and allow Node.js/Vite through the firewall when prompted. If
the LAN address changes, regenerate `lan.pem` for the new address and update
`PUBLIC_ORIGIN` in `.env` before creating a QR session.

For a deployed instance, use a normal trusted HTTPS certificate and reverse
proxy `/api` plus `/socket.io` to the backend. Keep the frontend, API, and socket
on one public origin.

For the Vercel frontend plus Render backend architecture, follow
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Production does not use the local
mkcert files.

## Run

```powershell
npm install
npm run dev
```

Open `https://192.168.1.25:5173` on the laptop. Vite listens on the LAN and
proxies `/api` and `/socket.io` to the backend, which listens only on loopback.
The phone opens the HTTPS URL encoded in the QR. The UI must call
`startCamera()` directly from the sender's explicit button click.

Useful commands:

```powershell
npm run check
npm test
npm run build
```

Until Antigravity supplies `client/src/App.tsx` and `client/src/index.css`, use
`npm run check -w server`, `npm run check:lib -w client`, and
`npm run test -w server` to verify Codex-owned code. The full client build is an
integration check after those UI-owned entry files exist.

## Library entry point

Import from `client/src/lib`:

- `useCameraSession()` for React pages
- `CameraSessionController` for framework-independent use
- `parseCameraLink()` for the `/camera` fragment
- `createQrDataUrl()` for QR image data
- `CeovaError` and the exported TypeScript types

The complete function, state, event, and error contract is in
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

The default ICE configuration uses public STUN servers and is suitable for the
same-LAN prototype. Connections across restrictive NAT/firewall environments may
need a TURN service; TURN credentials should be issued by the backend rather than
placed in frontend environment variables.
