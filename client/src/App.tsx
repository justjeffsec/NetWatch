import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import TrafficAnalysis from "@/pages/traffic";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/lib/theme";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/traffic" component={TrafficAnalysis} />
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
            {/* Cyberpunk footer */}
            <footer className="border-t border-border/60 px-4 py-1.5 flex items-center justify-between"
              style={{ background: "hsl(128 95% 2%)", boxShadow: "0 -1px 12px rgba(0,230,65,0.08)" }}>
              <div className="flex items-center gap-2">
                <NetwatchLogo />
                <span className="font-mono text-[11px] tracking-widest uppercase"
                  style={{ color: "hsl(128 80% 50%)", textShadow: "0 0 8px rgba(0,230,65,0.5)" }}>
                  NetWatch
                </span>
                <span className="text-[10px] font-mono opacity-40 tracking-wider">v1.0</span>
                <span className="text-[10px] font-mono animate-blink ml-1"
                  style={{ color: "hsl(128 100% 45%)" }}>█</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono opacity-30 tracking-widest uppercase">
                  SYS::ACTIVE
                </span>
              </div>
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
      width="18" height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="NetWatch logo"
      style={{ color: "hsl(128 100% 45%)", filter: "drop-shadow(0 0 4px rgba(0,230,65,0.7))" }}
    >
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
