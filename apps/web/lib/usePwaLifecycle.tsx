"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

type PwaLifecycleValue = {
  isInstallable: boolean;
  promptInstall: () => Promise<void>;
  updateAvailable: boolean;
  applyUpdate: () => void;
  isOffline: boolean;
};

const noopAsync = async () => {};
const noop = () => {};

const PwaLifecycleContext = createContext<PwaLifecycleValue>({
  isInstallable: false,
  promptInstall: noopAsync,
  updateAvailable: false,
  applyUpdate: noop,
  isOffline: false,
});

type PwaLifecycleProviderProps = {
  children: React.ReactNode;
};

export function PwaLifecycleProvider({ children }: PwaLifecycleProviderProps) {
  const value = useProvidePwaLifecycle();

  return <PwaLifecycleContext.Provider value={value}>{children}</PwaLifecycleContext.Provider>;
}

export function usePwaLifecycle(): PwaLifecycleValue {
  return useContext(PwaLifecycleContext);
}

function useProvidePwaLifecycle(): PwaLifecycleValue {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hasReloadedRef = useRef(false);

  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsOffline(!window.navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(appVersion)}`;

    let disposed = false;

    const markUpdateAvailable = () => {
      const waitingWorker = registrationRef.current?.waiting;
      if (waitingWorker && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: "/" });

        if (disposed) {
          return;
        }

        registrationRef.current = registration;
        markUpdateAvailable();

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        await registration.update();
        markUpdateAvailable();
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    const handleControllerChange = () => {
      if (hasReloadedRef.current) {
        return;
      }

      hasReloadedRef.current = true;
      window.location.reload();
    };

    const refreshWorkerState = () => {
      void registrationRef.current?.update();
      markUpdateAvailable();
    };

    void registerServiceWorker();

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("focus", refreshWorkerState);

    const intervalId = window.setInterval(refreshWorkerState, 5 * 60_000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWorkerState);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    try {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    } finally {
      setDeferredInstallPrompt(null);
    }
  }, [deferredInstallPrompt]);

  const applyUpdate = useCallback(() => {
    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) {
      void registrationRef.current?.update();
      return;
    }

    setUpdateAvailable(false);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return useMemo(
    () => ({
      isInstallable: Boolean(deferredInstallPrompt),
      promptInstall,
      updateAvailable,
      applyUpdate,
      isOffline,
    }),
    [applyUpdate, deferredInstallPrompt, isOffline, promptInstall, updateAvailable],
  );
}
