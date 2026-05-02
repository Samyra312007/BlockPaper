import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

import Terminal from "@/pages/terminal";
import Portfolio from "@/pages/portfolio";
import History from "@/pages/history";
import Login from "@/pages/login";
import SignIn from "@/pages/signin";
import SignUp from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AiAssistant from "@/pages/ai-assistant";
import RoomPage from "@/pages/room";
import RoomsLobby from "@/pages/rooms-lobby";
import Quests from "@/pages/quests";
import Backtest from "@/pages/backtest";
import Heatmap from "@/pages/heatmap";
import SentimentPage from "@/pages/sentiment";
import AlertsPage from "@/pages/alerts";
import FeedPage from "@/pages/feed";

const queryClient = new QueryClient();

function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function ProtectedRoute({
  component: Component,
  showLanding = false,
  ...rest
}: {
  component: React.ComponentType<Record<string, unknown>>;
  showLanding?: boolean;
  [key: string]: unknown;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showLanding) return <Login />;
    return <RedirectTo to="/signin" />;
  }

  return <Component {...(rest as Record<string, unknown>)} />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <RedirectTo to="/" />;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/signin" component={() => <PublicOnlyRoute component={SignIn} />} />
      <Route path="/signup" component={() => <PublicOnlyRoute component={SignUp} />} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/" component={() => <ProtectedRoute component={Terminal} showLanding />} />
      <Route path="/portfolio" component={() => <ProtectedRoute component={Portfolio} />} />
      <Route path="/history" component={() => <ProtectedRoute component={History} />} />
      <Route path="/ai" component={() => <ProtectedRoute component={AiAssistant} />} />
      <Route path="/rooms" component={() => <ProtectedRoute component={RoomsLobby} />} />
      <Route path="/room/:code" component={() => <ProtectedRoute component={RoomPage} />} />
      <Route path="/quests" component={() => <ProtectedRoute component={Quests} />} />
      <Route path="/backtest" component={() => <ProtectedRoute component={Backtest} />} />
      <Route path="/heatmap" component={() => <ProtectedRoute component={Heatmap} />} />
      <Route path="/sentiment" component={() => <ProtectedRoute component={SentimentPage} />} />
      <Route path="/alerts" component={() => <ProtectedRoute component={AlertsPage} />} />
      <Route path="/feed" component={() => <ProtectedRoute component={FeedPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster theme="dark" position="bottom-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
