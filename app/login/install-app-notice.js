"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

function isIosSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/i.test(userAgent);
  const isWebkit = /WebKit/i.test(userAgent);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS/i.test(userAgent);

  return isIos && isWebkit && !isOtherBrowser;
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
}

export default function InstallAppNotice() {
  const deferredPromptRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (isStandaloneMode()) {
      setVisible(false);
      return;
    }

    const ios = isIosSafari();
    setIosMode(ios);

    if (ios) {
      setVisible(true);
      setInstallReady(false);
      setMessage("");
      return;
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setVisible(true);
      setInstallReady(true);
      setMessage("");
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setInstallReady(false);
      setVisible(false);
      setMessage("");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (iosMode) {
      setMessage("Di iPhone/iPad: tap Share lalu pilih Add to Home Screen.");
      return;
    }

    if (!deferredPromptRef.current) {
      setMessage("Prompt install belum tersedia. Refresh halaman dan coba lagi.");
      return;
    }

    const promptEvent = deferredPromptRef.current;
    promptEvent.prompt();

    const choiceResult = await promptEvent.userChoice;
    deferredPromptRef.current = null;
    setInstallReady(false);

    if (choiceResult?.outcome === "accepted") {
      setMessage("Permintaan install dikirim. Lanjutkan di browser.");
      return;
    }

    setMessage("Install dibatalkan.");
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="absolute left-4 right-4 bottom-4 z-50 sm:left-auto sm:right-6 sm:w-90">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 shadow-md">
        <p className="text-sm font-medium text-amber-900">Silakan install app ini pada device anda.</p>
        <Button type="button" variant="outline" className="mt-2 w-full" onClick={handleInstall} disabled={!iosMode && !installReady}>
          Install
        </Button>
        {message ? <p className="mt-2 text-xs text-amber-900">{message}</p> : null}
      </div>
    </div>
  );
}
