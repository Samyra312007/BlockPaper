import { useState, useEffect } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Activity, Eye, EyeOff, ArrowRight, Check } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-400", "bg-green-400"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-white/40">{labels[score]}</p>
    </div>
  );
}

export default function SignUp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated, isLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Sign up failed. Please try again.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleSignUp() {
    window.location.href = "/api/auth/google";
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const passwordMatch = confirm.length > 0 && password === confirm;

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <a
          href="/"
          className="flex items-center justify-center gap-2 mb-8"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Block<span className="text-cyan-400">Paper</span>
          </span>
        </a>

        <div
          className="rounded-2xl border border-white/10 p-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
            <p className="text-sm text-white/50">
              Start paper trading with $10,000 virtual cash
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-sm font-medium text-white mb-5"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-400/60 transition"
                placeholder="Satoshi Nakamoto"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-400/60 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-400/60 transition"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <StrengthBar password={password} />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 pr-11 text-sm text-white placeholder:text-white/25 outline-none transition ${
                    confirm.length > 0
                      ? passwordMatch
                        ? "border-green-400/50"
                        : "border-red-400/50"
                      : "border-white/10"
                  } focus:border-cyan-400/60`}
                  placeholder="Re-enter password"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {passwordMatch && (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="text-white/30 hover:text-white/60 transition"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition shadow-lg shadow-cyan-500/25 mt-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Create Account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-white/25 mt-5">
            By creating an account you agree to our{" "}
            <span className="text-white/40">Terms of Service</span>
          </p>
        </div>

        <p className="text-center text-sm text-white/40 mt-6">
          Already have an account?{" "}
          <a
            href="/signin"
            className="text-cyan-400 hover:text-cyan-300 font-medium transition"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
