export type SessionRole = "viewer" | "sender";
export type ConnectionStatus =
  | "idle" | "creating" | "joining" | "waiting"
  | "requesting-camera" | "connecting" | "connected" | "ended" | "error";

export type SessionInfo = { sessionId: string; joinUrl?: string; expiresAt: number };
export type PairingCredentials = { sessionId: string; token: string };
export type SessionError = { code: string; message: string };
export type SessionSnapshot = {
  status: ConnectionStatus;
  role: SessionRole | null;
  session: SessionInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  mediaReceived: boolean;
  framesReceived: number;
  peerState: RTCPeerConnectionState | null;
  error: SessionError | null;
  endReason: string | null;
};
export type ControllerOptions = { iceServers?: RTCIceServer[] };

export const initialSnapshot: SessionSnapshot = {
  status: "idle", role: null, session: null, localStream: null,
  remoteStream: null, mediaReceived: false, framesReceived: 0,
  peerState: null, error: null, endReason: null,
};
