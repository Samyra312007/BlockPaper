import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export default function Login() {
  const { login, isLoading } = useAuth();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="flex flex-col items-center space-y-8 max-w-md w-full">
        <div className="flex items-center gap-3">
          <Activity className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">BlockPaper</h1>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="text-muted-foreground">Your crypto trading dashboard.</p>
        </div>

        <Button
          className="w-full h-12 text-lg font-medium"
          onClick={login}
          disabled={isLoading}
        >
          {isLoading ? "Authenticating..." : "Log in to start trading"}
        </Button>
      </div>
    </div>
  );
}
