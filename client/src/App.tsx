import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { useEffect, useState } from "react";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Default to dark for a network monitor
  useEffect(() => {
    setDark(true);
    document.documentElement.classList.add("dark");
  }, []);

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="flex flex-col h-screen w-full bg-background text-foreground">
            <main className="flex-1 overflow-hidden">
              <Router hook={useHashLocation}>
                <AppRouter />
              </Router>
            </main>
            <footer className="border-t border-border px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NetwatchLogo />
                <span className="text-xs font-medium tracking-tight">NetWatch</span>
              </div>
              <PerplexityAttribution />
            </footer>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function NetwatchLogo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="NetWatch logo"
      className="text-primary"
    >
      {/* Network node pattern */}
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <line x1="12" y1="7" x2="12" y2="10.5" />
      <line x1="10.7" y1="13.2" x2="6.5" y2="17.5" />
      <line x1="13.3" y1="13.2" x2="17.5" y2="17.5" />
    </svg>
  );
}
