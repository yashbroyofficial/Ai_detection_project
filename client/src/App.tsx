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

interface ViewerAppContainerProps {
  onRestartSession: (createImmediately?: boolean) => void;
  autoCreate?: boolean;
}

function ViewerAppContainer({
  onRestartSession,
  autoCreate = false,
}: ViewerAppContainerProps) {
  const session = useCameraSession();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const autoCreatedRef = useRef(false);

  // If autoCreate was requested (e.g. from "Create New Session" button),
  // trigger session creation once the fresh controller mounts in "idle" state
  useEffect(() => {
    if (autoCreate && !autoCreatedRef.current && session.status === "idle") {
      autoCreatedRef.current = true;
      setIsCreatingSession(true);
      session.createSession().finally(() => {
        setIsCreatingSession(false);
      });
    }
  }, [autoCreate, session]);

  const handleCreateSession = async () => {
    // If the controller has ended or errored, it cannot be restarted in-place
    // per client/src/lib/controller.ts assertStartable(). Request a fresh controller.
    if (session.status === "ended" || session.status === "error") {
      onRestartSession(true);
      return;
    }
    if (isCreatingSession || session.status === "creating") return;
    setIsCreatingSession(true);
    try {
      await session.createSession();
    } catch {
      // Error is populated in session.error by the controller
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleEndSession = async () => {
    try {
      await session.endSession();
    } catch {
      // Handled
    }
  };

  const handleReturnHome = () => {
    onRestartSession(false);
  };

  const isCreating = isCreatingSession || session.status === "creating";

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar
        status={session.status}
        peerState={session.peerState}
        onEndSession={handleEndSession}
        showEndButton={
          session.status === "waiting" ||
          session.status === "connecting" ||
          session.status === "connected"
        }
      />
      <main className="flex-1">
        <ViewerDashboard
          status={session.status}
          session={session.session}
          remoteStream={session.remoteStream}
          mediaReceived={session.mediaReceived}
          peerState={session.peerState}
          error={session.error}
          endReason={session.endReason}
          isCreating={isCreating}
          onCreateSession={handleCreateSession}
          onEndSession={handleEndSession}
          onClearError={session.clearError}
          onReturnHome={handleReturnHome}
        />
      </main>

      {/* Global Error Modal for Viewer */}
      <ErrorModal
        error={session.error}
        onClear={session.clearError}
        onRetry={() => {
          session.clearError();
          onRestartSession(true);
        }}
        retryLabel="Create New Session"
      />
    </div>
  );
}

function SenderAppContainer() {
  const session = useCameraSession();
  const [localError, setLocalError] = useState<SessionError | null>(null);
  const [pairingCredentials, setPairingCredentials] = useState<PairingCredentials | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const creds = parseCameraLink(window.location.href);
      setPairingCredentials(creds);
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
  }, []);

  useEffect(() => {
    if (pairingCredentials && !joinedRef.current) {
      joinedRef.current = true;
      session.joinSession(pairingCredentials).catch(() => {
        // Handled in session.error
      });
    }
  }, [pairingCredentials, session]);

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
    <>
      <SenderCameraPage
        status={session.status}
        session={session.session}
        localStream={session.localStream}
        mediaReceived={session.mediaReceived}
        peerState={session.peerState}
        error={activeError}
        endReason={session.endReason}
        onStartCamera={session.startCamera}
        onEndSession={handleEndSession}
      />
      <ErrorModal
        error={activeError}
        onClear={handleClearError}
      />
    </>
  );
}

export default function App() {
  const [sessionKey, setSessionKey] = useState(0);
  const [autoCreateOnMount, setAutoCreateOnMount] = useState(false);

  const [isCameraRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname.startsWith("/camera") ||
      window.location.hash.includes("session=")
    );
  });

  const handleRestartSession = (createImmediately: boolean = false) => {
    setAutoCreateOnMount(createImmediately);
    setSessionKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f6] selection:bg-white/20 selection:text-white">
      {isCameraRoute ? (
        <SenderAppContainer />
      ) : (
        <ViewerAppContainer
          key={sessionKey}
          onRestartSession={handleRestartSession}
          autoCreate={autoCreateOnMount}
        />
      )}
    </div>
  );
}
