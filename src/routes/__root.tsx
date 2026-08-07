import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { CartProvider } from "@/lib/cart-context";
import { installChunkErrorRecovery, isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-recovery";
import appCss from "../styles.css?url";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const chunkError = isChunkLoadError(error);
  const [recovering, setRecovering] = useState(chunkError);

  useEffect(() => {
    if (!chunkError) return;
    if (!recoverFromChunkError()) setRecovering(false);
  }, [chunkError]);

  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BreezySocial — Smart Gadgets for Calm, Modern Living" },
      { name: "description", content: "Thoughtfully designed tools for better sleep, sharper focus, and easier travel. Free shipping over $50. 30-day returns." },
      { property: "og:site_name", content: "BreezySocial" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" },
    ],
    scripts: [
      { src: "https://www.googletagmanager.com/gtag/js?id=G-79NYCD5JM9", async: true },
      {
        children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-79NYCD5JM9');`,
      },
    ],
  }),

  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="rn4Co7u4RniBHEjW9QBQjctEBAY5I_dicODU2ir9s2w" />
        <meta name="google-site-verification" content="dBmj6auZVrnDJBXhq6BuCQvyj0EMnH94zmy6Shz2V90" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => installChunkErrorRecovery(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <AuthSync />
        <Outlet />
        <Toaster richColors position="top-right" />
      </CartProvider>
    </QueryClientProvider>
  );
}


function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Ignore TOKEN_REFRESHED / INITIAL_SESSION churn, and skip SIGNED_IN
      // (login pages navigate themselves — a parallel invalidate races them).
      if (event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

