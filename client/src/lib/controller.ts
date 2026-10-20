import { asCeovaError, CeovaError } from "./errors";
import { apiUrl } from "./endpoint";
import { connectSocket, createSocket, emitAck, type CeovaSocket } from "./socket";
import { initialSnapshot, type ControllerOptions, type PairingCredentials, type SessionInfo, type SessionRole, type SessionSnapshot } from "./types";

type CreatedSession = { sessionId: string; viewerToken: string; joinUrl: string; expiresAt: number };
type JoinResult = { sessionId: string; role: SessionRole; expiresAt: number };
type EndPayload = { reason: string };

export class CameraSessionController {
  private snapshot: SessionSnapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private socket: CeovaSocket | null = null;
  private peer: RTCPeerConnection | null = null;
  private pendingIce: (RTCIceCandidateInit | null)[] = [];
  private disconnectTimer: number | null = null;
  private actionGeneration = 0;
  private offerStarted = false;
  private disposed = false;
  private ending = false;

  constructor(private readonly options: ControllerOptions = {}) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  async createSession(): Promise<SessionInfo> {
    this.assertStartable();
    const generation = ++this.actionGeneration;
    this.update({ status: "creating", error: null, endReason: null });
    try {
      const response = await fetch(apiUrl("/api/sessions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new CeovaError(body?.error?.code ?? "NETWORK_ERROR", body?.error?.message ?? "Could not create a camera session.");
      const created = body as CreatedSession;
      const info = { sessionId: created.sessionId, joinUrl: created.joinUrl, expiresAt: created.expiresAt };
      this.ensureCurrent(generation);
      this.update({ role: "viewer", session: info });
      await this.openAndJoin({ sessionId: created.sessionId, token: created.viewerToken }, "viewer", generation);
      this.update({ status: "waiting" });
      return info;
    } catch (error) { throw this.fail(error); }
  }

  async joinSession(pairing: PairingCredentials): Promise<void> {
    this.assertStartable();
    const generation = ++this.actionGeneration;
    this.update({ status: "joining", role: "sender", error: null, endReason: null });
    try {
      const joined = await this.openAndJoin(pairing, "sender", generation);
      this.update({ status: "waiting", session: { sessionId: joined.sessionId, expiresAt: joined.expiresAt } });
    } catch (error) { throw this.fail(error); }
  }

  async startCamera(constraints: MediaTrackConstraints = { facingMode: { ideal: "environment" } }): Promise<void> {
    if (this.snapshot.role !== "sender" || !this.socket?.connected || this.snapshot.status !== "waiting") {
      throw this.fail(new CeovaError("INVALID_STATE", "Join as the camera sender before starting the camera."));
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw this.fail(new CeovaError("INSECURE_CONTEXT", "Camera access requires a trusted HTTPS page."));
    }
    const generation = this.actionGeneration;
    this.update({ status: "requesting-camera", error: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
      if (generation !== this.actionGeneration || this.disposed) {
        stream.getTracks().forEach((track) => track.stop());
        throw new CeovaError("CANCELLED", "Camera start was cancelled.");
      }
      this.update({ localStream: stream, status: "connecting" });
      const peer = await this.ensurePeer();
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await emitAck(this.socket, "sender:ready", {});
    } catch (error) {
      await this.notifyEnd();
      throw this.fail(asCeovaError(error, "CAMERA_ERROR"));
    }
  }

  async endSession(): Promise<void> {
    if (this.snapshot.status === "idle" || this.snapshot.status === "ended") return;
    ++this.actionGeneration;
    const socket = this.socket;
    this.stopMediaAndPeer();
    this.update({ status: "ended", endReason: "ended", localStream: null, remoteStream: null, peerState: null });
    if (socket?.connected) {
      await emitAck<Record<string, never>>(socket, "session:end", {}).catch(() => undefined);
      socket.removeAllListeners();
      socket.disconnect();
    }
    this.socket = null;
  }

  clearError(): void { this.update({ error: null }); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.actionGeneration;
    void this.notifyEnd();
    this.cleanupLocal();
    this.listeners.clear();
  }

  private async openAndJoin(pairing: PairingCredentials, role: SessionRole, generation: number) {
    const socket = createSocket();
    this.socket = socket;
    this.attachSocketEvents(socket);
    await connectSocket(socket);
    this.ensureCurrent(generation);
    return emitAck<JoinResult>(socket, "session:join", { ...pairing, role });
  }

  private attachSocketEvents(socket: CeovaSocket) {
    socket.on("peer:ready", () => { if (this.snapshot.role === "viewer") void this.beginOffer(); });
    socket.on("signal:offer", (offer: RTCSessionDescriptionInit) => { if (this.snapshot.role === "sender") void this.receiveOffer(offer); });
    socket.on("signal:answer", (answer: RTCSessionDescriptionInit) => { if (this.snapshot.role === "viewer") void this.receiveAnswer(answer); });
    socket.on("signal:ice", (candidate: RTCIceCandidateInit | null) => { void this.receiveIce(candidate); });
    socket.on("session:ended", ({ reason }: EndPayload) => this.handleEnded(reason));
    socket.on("disconnect", (reason) => {
      if (!this.disposed && this.snapshot.status !== "ended" && reason !== "io client disconnect") this.handleEnded("peer-disconnected");
    });
  }

  private async ensurePeer() {
    if (this.peer) return this.peer;
    const iceServers = this.options.iceServers ?? await this.loadIceServers();
    const peer = new RTCPeerConnection({ iceServers });
    this.peer = peer;
    peer.onicecandidate = (event) => { if (this.socket?.connected) void emitAck(this.socket, "signal:ice", event.candidate?.toJSON() ?? null).catch((error) => this.fail(error)); };
    peer.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.update({ remoteStream: stream });
    };
    peer.onconnectionstatechange = () => this.handlePeerState(peer.connectionState);
    return peer;
  }

  private async beginOffer() {
    if (this.offerStarted || this.snapshot.role !== "viewer") return;
    this.offerStarted = true;
    try {
      this.update({ status: "connecting" });
      const peer = await this.ensurePeer();
      peer.addTransceiver("video", { direction: "recvonly" });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await emitAck(this.socket!, "signal:offer", { type: offer.type, sdp: offer.sdp });
    } catch (error) { this.fail(asCeovaError(error, "WEBRTC_ERROR")); }
  }

  private async receiveOffer(offer: RTCSessionDescriptionInit) {
    try {
      const peer = await this.ensurePeer();
      await peer.setRemoteDescription(offer);
      await this.flushIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await emitAck(this.socket!, "signal:answer", { type: answer.type, sdp: answer.sdp });
    } catch (error) { this.fail(asCeovaError(error, "WEBRTC_ERROR")); }
  }

  private async receiveAnswer(answer: RTCSessionDescriptionInit) {
    try {
      if (!this.peer) throw new CeovaError("WEBRTC_ERROR", "Received an answer before creating the connection.");
      await this.peer.setRemoteDescription(answer);
      await this.flushIce();
    } catch (error) { this.fail(asCeovaError(error, "WEBRTC_ERROR")); }
  }

  private async receiveIce(candidate: RTCIceCandidateInit | null) {
    try {
      if (!this.peer || !this.peer.remoteDescription) this.pendingIce.push(candidate);
      else await this.peer.addIceCandidate(candidate);
    } catch (error) { this.fail(asCeovaError(error, "WEBRTC_ERROR")); }
  }

  private async flushIce() {
    const queued = this.pendingIce.splice(0);
    for (const candidate of queued) await this.peer!.addIceCandidate(candidate);
  }

  private handlePeerState(state: RTCPeerConnectionState) {
    if (this.disposed || this.snapshot.status === "ended" || this.snapshot.status === "error") return;
    this.update({ peerState: state });
    if (this.socket?.connected) void emitAck(this.socket, "peer:state", { state }).catch(() => undefined);
    if (state === "connected") {
      if (this.disconnectTimer) window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
      this.update({ status: "connected" });
    } else if (state === "disconnected") {
      if (this.disconnectTimer) window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = window.setTimeout(() => { if (this.peer?.connectionState === "disconnected") void this.endDueToFailure(); }, 10_000);
    } else if (state === "failed" || state === "closed") void this.endDueToFailure();
  }

  private async endDueToFailure() {
    await this.notifyEnd();
    this.handleEnded("peer-disconnected");
  }

  private handleEnded(reason: string) {
    if (this.ending || this.snapshot.status === "ended") return;
    ++this.actionGeneration;
    this.cleanupLocal();
    this.update({ status: "ended", endReason: reason, localStream: null, remoteStream: null, peerState: null });
  }

  private cleanupLocal() {
    this.stopMediaAndPeer();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  private stopMediaAndPeer() {
    if (this.disconnectTimer) window.clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    this.snapshot.localStream?.getTracks().forEach((track) => track.stop());
    this.snapshot.remoteStream?.getTracks().forEach((track) => track.stop());
    this.peer?.close();
    this.peer = null;
    this.pendingIce = [];
  }

  private async notifyEnd() {
    const socket = this.socket;
    if (!socket?.connected) return;
    this.ending = true;
    try { await emitAck<Record<string, never>>(socket, "session:end", {}).catch(() => undefined); }
    finally { this.ending = false; }
  }

  private async loadIceServers() {
    const response = await fetch(apiUrl("/api/config"));
    if (!response.ok) throw new CeovaError("NETWORK_ERROR", "Could not load WebRTC configuration.");
    const body = await response.json();
    return Array.isArray(body.iceServers) ? body.iceServers as RTCIceServer[] : [];
  }

  private assertStartable() {
    if (this.disposed) throw new CeovaError("INVALID_STATE", "This camera session controller has been disposed.");
    if (this.snapshot.status !== "idle") throw new CeovaError("INVALID_STATE", "This controller already has a session.");
  }

  private ensureCurrent(generation: number) {
    if (generation !== this.actionGeneration || this.disposed) throw new CeovaError("CANCELLED", "The operation was cancelled.");
  }

  private fail(error: unknown) {
    const resolved = asCeovaError(error);
    this.cleanupLocal();
    this.update({ status: "error", error: { code: resolved.code, message: resolved.message }, localStream: null, remoteStream: null, peerState: null });
    return resolved;
  }

  private update(patch: Partial<SessionSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
