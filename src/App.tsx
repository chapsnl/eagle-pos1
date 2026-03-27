import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  // force rebuild v2
  useEffect(() => {
    let cancelled = false;

    const tryLock = async () => {
      try {
        // Best-effort: works in Chrome PWA; may fail in regular tabs.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orientation = (screen as any)?.orientation;
        if (!orientation?.lock) return;
        await orientation.lock("portrait");
      } catch {
        // ignore — browser/device may not allow locking
      }
    };

    void tryLock();

    // Some devices only allow lock after user gesture; retry on first interaction.
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
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (screen as any)?.orientation?.unlock?.();
      } catch {
        // ignore
      }
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
