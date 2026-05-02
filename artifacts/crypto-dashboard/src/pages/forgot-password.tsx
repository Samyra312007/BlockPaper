import { useState } from "react";
import { Activity, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-sm text-white/50 mb-6 leading-relaxed">
                If <span className="text-white/75">{email}</span> is associated with a
                BlockPaper account, you'll receive a password reset link within a few minutes.
              </p>
              <p className="text-xs text-white/30 mb-6">
                Didn't get it? Check your spam folder or try again.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition font-medium"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-white mb-1">Forgot password?</h1>
                <p className="text-sm text-white/50">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-400/60 transition"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition shadow-lg shadow-cyan-500/25"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <a
          href="/signin"
          className="flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 transition mt-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </a>
      </div>
    </div>
  );
}
