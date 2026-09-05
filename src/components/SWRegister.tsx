"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // In development, unregister any active SW to prevent cache conflicts & HMR request loops
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failed silently
    });
  }, []);

  return null;
}
