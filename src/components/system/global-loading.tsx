"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type LoadingContextValue = {
  setLoading: (source: string, active: boolean) => void;
};

const GlobalLoadingContext = React.createContext<LoadingContextValue | null>(null);

export function useGlobalLoading() {
  return React.useContext(GlobalLoadingContext);
}

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sources, setSources] = React.useState<Set<string>>(() => new Set());
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLoading = React.useCallback((source: string, active: boolean) => {
    setSources((current) => {
      const alreadyActive = current.has(source);
      if (alreadyActive === active) return current;
      const next = new Set(current);
      if (active) next.add(source);
      else next.delete(source);
      return next;
    });
  }, []);

  const clearNavigation = React.useCallback(() => {
    setLoading("navigation", false);
  }, [setLoading]);

  React.useEffect(() => {
    clearNavigation();
  }, [pathname, searchParams, clearNavigation]);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;

      setLoading("navigation", true);
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || event.defaultPrevented) return;
      // GET forms perform a navigation (filters/search). Server Action POST forms
      // are tracked by the submit Button through useFormStatus instead.
      if ((form.method || "get").toLowerCase() === "get") {
        setLoading("navigation", true);
      }
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [setLoading]);

  const active = sources.size > 0;

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (active) {
      // Safety valve: a failed request must never leave the interface permanently blocked.
      timeoutRef.current = setTimeout(() => setSources(new Set()), 30000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [active]);

  const contextValue = React.useMemo(() => ({ setLoading }), [setLoading]);

  return (
    <GlobalLoadingContext.Provider value={contextValue}>
      {children}
      {active ? <GlobalLoadingOverlay /> : null}
    </GlobalLoadingContext.Provider>
  );
}

function GlobalLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[2147483647] flex cursor-wait items-center justify-center bg-background/75 p-6 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
      aria-busy="true"
      aria-label="Carregando"
    >
      <div className="flex min-w-[220px] flex-col items-center gap-4 rounded-xl border bg-card px-8 py-7 text-center shadow-2xl">
        <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
        <div>
          <p className="font-semibold">Processando...</p>
          <p className="mt-1 text-sm text-muted-foreground">Aguarde enquanto concluímos esta operação.</p>
        </div>
      </div>
    </div>
  );
}
