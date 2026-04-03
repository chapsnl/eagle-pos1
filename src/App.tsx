import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import PinLockScreen from "@/components/PinLockScreen";
import { useGlobalInactivityTimer } from "@/hooks/useGlobalInactivityTimer";

const queryClient = new QueryClient();

/** Force local network permission prompt on iOS by pinging the printer */
const triggerNetworkPermission = () => {
  fetch('http://192.168.178.82', { mode: 'no-cors' }).catch(() => {
    // Expected to fail silently – the goal is triggering the iOS permission dialog
  });
};

/** Hide status bar & navigation bar on Android for kiosk mode */
const initKioskMode = async () => {
  triggerNetworkPermission();
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    await StatusBar.hide();
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // plugin not available
  }
  try {
    // navigation-bar plugin only available in native builds
  } catch {
    // plugin not available
  }
};

const App = () => {
  const [isLocked, setIsLocked] = useState(true);

  const handleLock = useCallback(() => setIsLocked(true), []);
  const handleUnlock = useCallback(() => setIsLocked(false), []);

  // 5-hour global inactivity timer – only ticks when unlocked
  useGlobalInactivityTimer(!isLocked, handleLock);

  useEffect(() => {
    let cancelled = false;

    void initKioskMode();

    const tryLock = async () => {
      try {
        const orientation = (screen as any)?.orientation;
        if (!orientation?.lock) return;
        await orientation.lock("portrait");
      } catch {}
    };

    void tryLock();

    const onFirstGesture = () => {
      if (cancelled) return;
      void tryLock();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { passive: true });
    window.addEventListener("touchstart", onFirstGesture, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
      try { (screen as any)?.orientation?.unlock?.(); } catch {}
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
