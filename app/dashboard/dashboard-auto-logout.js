"use client";

import { useEffect, useRef } from "react";

import { logoutAction } from "@/app/dashboard/actions";

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

export default function DashboardAutoLogout() {
  const formRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    function clearTimer() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function scheduleLogout() {
      clearTimer();
      timeoutRef.current = window.setTimeout(() => {
        formRef.current?.requestSubmit();
      }, INACTIVITY_TIMEOUT_MS);
    }

    scheduleLogout();

    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown"];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, scheduleLogout, { passive: true });
    }

    window.addEventListener("focus", scheduleLogout);

    return () => {
      clearTimer();

      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, scheduleLogout);
      }

      window.removeEventListener("focus", scheduleLogout);
    };
  }, []);

  return (
    <form ref={formRef} action={logoutAction} aria-hidden="true" className="hidden" tabIndex={-1}>
      <button type="submit" tabIndex={-1} aria-hidden="true">
        Logout
      </button>
    </form>
  );
}