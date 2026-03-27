import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const queryClient = new QueryClient();

/** Hide status bar & navigation bar on Android for kiosk mode */
const initKioskMode = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    await StatusBar.hide();
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // plugin not available
  }
  try {
    // @capacitor/navigation-bar might not be installed; graceful fallback
    const mod = await import("@capacitor/navigation-bar" as string);
    if (mod?.NavigationBar?.hide) await mod.NavigationBar.hide();
  } catch {
    // plugin not available
  }
};

const App = () => {
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
