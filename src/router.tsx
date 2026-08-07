import { QueryClient } from "@tanstack/react-query";
import { Link, createRouter, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkError } from "./lib/chunk-recovery";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const chunkError = isChunkLoadError(error);
  const [recovering, setRecovering] = useState(chunkError);

  useEffect(() => {
    if (!chunkError) return;
    // Stale deploy assets: reload once instead of showing an error page.
    if (!recoverFromChunkError()) setRecovering(false);
  }, [chunkError]);

  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <p className="text-sm text-muted-foreground">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Reload
          </button>
          <Link to="/" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}


function DefaultNotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">This page does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh 60s — drastically reduces DB load under high traffic.
        // Components that need real-time can override per-query.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnMount: false, // rely on staleTime; avoid refetch on tab switch
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Keep preloaded data fresh for 30s so hover-preload actually helps.
    defaultPreloadStaleTime: 30_000,
    defaultPreloadDelay: 50,
    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
    notFoundMode: "root",
  });

  return router;
};
