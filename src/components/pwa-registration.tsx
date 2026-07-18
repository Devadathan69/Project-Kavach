"use client";
import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.filter((cacheName) => cacheName.startsWith("kavach-shell-")).map((cacheName) => window.caches.delete(cacheName)));
        }
      })();
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("KAVACH service worker registration failed", error);
    });
  }, []);
  return null;
}
