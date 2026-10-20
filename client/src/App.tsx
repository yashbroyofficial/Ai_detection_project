import { useEffect, useRef, useState } from "react";
import {
  parseCameraLink,
  useCameraSession,
  type PairingCredentials,
  type SessionError,
} from "./lib";
import { Navbar } from "./components/Navbar";
import { ErrorModal } from "./components/ErrorModal";
import { ViewerDashboard } from "./pages/ViewerDashboard";
import { SenderCameraPage } from "./pages/SenderCameraPage";
import "./App.css";

export default function App() {
  const session = useCameraSession();
  const [localError, setLocalError] = useState<SessionError | null>(null);
  const [pairingCredentials, setPairingCredentials] = useState<PairingCredentials | null>(null);
  const [isCameraRoute, setIsCameraRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname.startsWith("/camera") ||
      window.location.hash.includes("session=")
    );
  });

  const joinedRef = useRef(false);

  // Check route and parse camera pairing credentials if on /camera
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onCameraRoute =
      window.location.pathname.startsWith("/camera") ||
      window.location.hash.includes("session=");

    setIsCameraRoute(onCameraRoute);

    if (onCameraRoute) {
      try {
        const creds = parseCameraLink(window.location.href);
        setPairingCredentials(creds);
        // Strip sensitive fragment credentials from address bar to prevent history leaking
        window.history.replaceState(null, "", window.location.pathname);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "The camera link is invalid or incomplete.";
        setLocalError({
          code: "INVALID_REQUEST",
          message,
        });
      }
    }
  }, []);

  // Join session as sender once pairing credentials are parsed
  useEffect(() => {
    if (isCameraRoute && pairingCredentials && !joinedRef.current) {
      joinedRef.current = true;
      session.joinSession(pairingCredentials).catch(() => {
        // Error will be populated in session.error by the controller
      });
    }
  }, [isCameraRoute, pairingCredentials, session]);

  const handleCreateSession = async () => {
    try {
      await session.createSession();
    } catch {
      // Error is stored in session.error
    }
  };

  const handleEndSession = async () => {
    try {
      await session.endSession();
    } catch {
      // Handled
    }
  };

  const handleClearError = () => {
    setLocalError(null);
    session.clearError();
  };

  const activeError = localError ?? session.error;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f6] selection:bg-white/20 selection:text-white">
      {/* Route Switch */}
      {isCameraRoute ? (
        <SenderCameraPage
          status={session.status}
          session={session.session}
          localStream={session.localStream}
          peerState={session.peerState}
          error={activeError}
          endReason={session.endReason}
          onStartCamera={session.startCamera}
          onEndSession={handleEndSession}
        />
      ) : (
        <div className="flex flex-col min-h-screen">
          <Navbar
            status={session.status}
            peerState={session.peerState}
            onEndSession={handleEndSession}
            showEndButton={session.status === "waiting" || session.status === "connecting" || session.status === "connected"}
          />
          <main className="flex-1">
            <ViewerDashboard
              status={session.status}
              session={session.session}
              remoteStream={session.remoteStream}
              peerState={session.peerState}
              error={activeError}
              endReason={session.endReason}
              onCreateSession={handleCreateSession}
              onEndSession={handleEndSession}
              onClearError={handleClearError}
            />
          </main>
        </div>
      )}

      {/* Global Error Modal */}
      <ErrorModal
        error={activeError}
        onClear={handleClearError}
        onRetry={
          isCameraRoute
            ? undefined
            : () => {
                handleClearError();
                void handleCreateSession();
              }
        }
        retryLabel={isCameraRoute ? "Dismiss" : "Create New Session"}
      />
    </div>
  );
}
