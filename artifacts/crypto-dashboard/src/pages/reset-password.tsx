import { useState, useEffect } from "react";
import { Activity, Eye, EyeOff, Check, ArrowLeft, ShieldCheck, XCircle } from "lucide-react";

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-400", "bg-green-400"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : "bg-white/10"}`}
          />
        ))}
      </div>
      <p className="text-xs text-white/40">{labels[score]}</p>
    </div>
  );
}

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setError("No reset token found. Please request a new reset link.");
    } else {
      setToken(t);
    }
  }, []);

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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const passwordMatch = confirm.length > 0 && password === confirm;

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <a href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Block<span className="text-cyan-400">Paper</span>
          </span>
        </a>

        <div
          className="rounded-2xl border border-white/10 p-8"
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)" }}
        >
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
              <p className="text-sm text-white/50 mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <a
                href="/signin"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-sm font-semibold text-white transition shadow-lg shadow-cyan-500/25"
              >
                Go to Sign In
              </a>
            </div>
          ) : !token && error ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Invalid reset link</h2>
              <p className="text-sm text-white/50 mb-6">{error}</p>
              <a
                href="/forgot-password"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-sm font-semibold text-white transition"
              >
                Request a new link
              </a>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
                <p className="text-sm text-white/50">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-400/60 transition"
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <StrengthBar password={password} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 pr-11 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-400/60 transition ${
                        confirm.length > 0
                          ? passwordMatch
                            ? "border-green-400/50"
                            : "border-red-400/50"
                          : "border-white/10"
                      }`}
                      placeholder="Re-enter new password"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {passwordMatch && <Check className="w-4 h-4 text-green-400" />}
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="text-white/30 hover:text-white/60 transition"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    "Reset Password"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {!done && (
          <a
            href="/signin"
            className="flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 transition mt-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </a>
        )}
      </div>
    </div>
  );
}
