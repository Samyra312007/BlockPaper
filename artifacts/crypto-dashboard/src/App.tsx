import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";

import Terminal from "@/pages/terminal";
import Portfolio from "@/pages/portfolio";
import History from "@/pages/history";
import Login from "@/pages/login";
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

function ProtectedRoute({ component: Component, ...rest }: { component: any, [key: string]: any }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-mono">Loading Terminal...</div>;
  }
  
  if (!isAuthenticated) {
    return <Login />;
  }
  
  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Terminal} />} />
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
