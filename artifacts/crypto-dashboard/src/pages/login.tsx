import { useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, ChevronDown, ArrowRight } from "lucide-react";

// ─── Particle Network Canvas ──────────────────────────────────────────────────

interface Dot { x: number; y: number; vx: number; vy: number; r: number }

function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const dots: Dot[] = [];
    const COUNT = 70;

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }
    function seed() {
      resize();
      dots.length = 0;
      for (let i = 0; i < COUNT; i++)
        dots.push({ x: Math.random() * canvas!.width, y: Math.random() * canvas!.height,
          vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.4 + 0.4 });
    }
    function frame() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas!.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas!.height) d.vy *= -1;
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(56,189,248,${(1 - dist / 130) * 0.25})`;
            ctx!.lineWidth = 0.6;
            ctx!.moveTo(dots[i].x, dots[i].y);
            ctx!.lineTo(dots[j].x, dots[j].y);
            ctx!.stroke();
          }
        }
      }
      for (const d of dots) {
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(125,211,252,0.55)";
        ctx!.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    seed(); frame();
    const ro = new ResizeObserver(seed);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ─── Animated Candlestick Background ─────────────────────────────────────────

const BG_CANDLES = [
  { h: 140, open: 40, close: 110, d: 0 }, { h: 100, open: 60, close: 30,  d: 0.3 },
  { h: 160, open: 25, close: 130, d: 0.6 }, { h: 80,  open: 50, close: 20, d: 0.9 },
  { h: 180, open: 20, close: 150, d: 1.2 }, { h: 110, open: 70, close: 40, d: 1.5 },
  { h: 150, open: 10, close: 120, d: 1.8 }, { h: 90,  open: 55, close: 70, d: 2.1 },
  { h: 130, open: 30, close: 100, d: 2.4 }, { h: 75,  open: 40, close: 60, d: 2.7 },
];

function CandleBg({ parallax }: { parallax: number }) {
  return (
    <div
      className="absolute inset-0 flex items-end justify-center gap-4 pb-20 pointer-events-none overflow-hidden opacity-[0.08]"
      style={{ transform: `translateY(${parallax}px)` }}
    >
      {BG_CANDLES.map((c, i) => {
        const up = c.close > c.open;
        const bodyH = Math.max(Math.abs(c.close - c.open), 5);
        const col = up ? "#26a641" : "#f85149";
        return (
          <div key={i} className="relative flex flex-col items-center" style={{ height: c.h, animationDelay: `${c.d}s` }}>
            <div className="w-px flex-1" style={{ background: col }} />
            <div className="w-7 rounded-sm shrink-0" style={{ height: bodyH, background: col,
              animation: `bpPulse 3s ease-in-out ${c.d}s infinite alternate` }} />
            <div className="w-px flex-1" style={{ background: col }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Typing Effect ────────────────────────────────────────────────────────────

const PHRASES = ["Master the markets.", "Risk nothing.", "Learn everything."];

function useTyping() {
  const [text, setText] = useState("");
  const [pi, setPi] = useState(0);
  const [ci, setCi] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const phrase = PHRASES[pi];
    let t: ReturnType<typeof setTimeout>;
    if (!del && ci < phrase.length)       t = setTimeout(() => setCi(c => c + 1), 75);
    else if (!del && ci === phrase.length) t = setTimeout(() => setDel(true), 2200);
    else if (del && ci > 0)               t = setTimeout(() => setCi(c => c - 1), 38);
    else if (del && ci === 0)             { setDel(false); setPi(p => (p + 1) % PHRASES.length); }
    setText(phrase.slice(0, ci));
    return () => clearTimeout(t);
  }, [ci, del, pi]);
  return text;
}

// ─── Scroll Reveal ────────────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, on };
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, on } = useReveal();
  return (
    <div ref={ref} className={`transition-all duration-700 ${on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Floating Ticker ──────────────────────────────────────────────────────────

const TICKS = [
  { s: "BTC", p: "$43,200", c: "+2.4%", up: true },
  { s: "ETH", p: "$2,281",  c: "+1.8%", up: true },
  { s: "SOL", p: "$98.40",  c: "-0.6%", up: false },
];

function FloatingTicker() {
  return (
    <div className="absolute top-5 right-5 hidden md:flex items-center gap-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-2.5 z-20">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
      </span>
      {TICKS.map(t => (
        <div key={t.s} className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-white">{t.s}</span>
          <span className="text-xs font-mono text-white/70">{t.p}</span>
          <span className={`text-[11px] font-mono font-semibold ${t.up ? "text-emerald-400" : "text-red-400"}`}>{t.c}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "📊", title: "Live Market Data",       desc: "Real-time candlestick charts and price feeds for BTC, ETH, SOL and more." },
  { icon: "🤖", title: "AI Trading Assistant",   desc: "Instant market insights, strategy ideas, and risk analysis powered by AI." },
  { icon: "🏆", title: "Quests & Gamification",  desc: "Complete trading challenges, unlock achievements and climb the leaderboard." },
  { icon: "👥", title: "Trading Rooms",          desc: "Join live rooms and compete alongside other traders in real time." },
  { icon: "🔔", title: "Smart Price Alerts",     desc: "Set target levels and get notified the moment the market moves." },
  { icon: "📈", title: "Strategy Backtesting",   desc: "Replay your strategy against historical data before you risk anything." },
];

// ─── Mock Terminal ────────────────────────────────────────────────────────────

const BARS = [30,45,38,55,48,60,52,70,63,80,72,85,78,90,82,95,88,75,82,90];

function MockChart() {
  const mx = Math.max(...BARS), mn = Math.min(...BARS), rng = mx - mn;
  return (
    <div className="flex-1 bg-[#0d1117] rounded-lg p-3 flex flex-col gap-2 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-white">BTC / USD · 1H</span>
        <span className="text-[11px] font-mono text-emerald-400">$43,200 ▲ 2.4%</span>
      </div>
      <div className="flex-1 flex items-end gap-px min-h-[80px]">
        {BARS.map((v, i) => {
          const h = ((v - mn) / rng) * 72 + 8;
          const up = i === 0 || v >= BARS[i - 1];
          return (
            <div key={`bar-${i}`} className="flex-1 flex items-end" style={{ height: "100%" }}>
              <div className="w-full rounded-[1px]" style={{ height: `${h}%`,
                backgroundColor: up ? "#26a641" : "#f85149",
                animation: `bpPulse 2s ease-in-out ${i * 0.08}s infinite alternate` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MockPanel() {
  const [side, setSide] = useState<"buy"|"sell">("buy");
  return (
    <div className="w-[155px] shrink-0 bg-[#161b22] border border-white/10 rounded-lg p-3 flex flex-col gap-2.5">
      <div className="flex rounded overflow-hidden border border-white/10 text-[11px] font-bold">
        <button onClick={() => setSide("buy")} className={`flex-1 py-1.5 transition-colors ${side==="buy" ? "bg-emerald-600 text-white" : "text-white/40"}`}>BUY</button>
        <button onClick={() => setSide("sell")} className={`flex-1 py-1.5 transition-colors ${side==="sell" ? "bg-red-600 text-white" : "text-white/40"}`}>SELL</button>
      </div>
      {[["Amount","0.25 BTC"],["Price","$43,200"],["Total","$10,800"]].map(([l,v]) => (
        <div key={l}>
          <div className="text-[9px] text-white/30 mb-0.5">{l}</div>
          <div className={`bg-[#0d1117] border border-white/10 rounded px-2 py-1 text-[11px] font-mono ${l==="Total" ? "text-emerald-400" : "text-white/70"}`}>{v}</div>
        </div>
      ))}
      <button className={`w-full py-1.5 rounded text-[11px] font-bold text-white ${side==="buy" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"} transition-colors`}>
        {side==="buy" ? "Buy BTC" : "Sell BTC"}
      </button>
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function Login() {
  const typed = useTyping();
  const heroRef = useRef<HTMLDivElement>(null);
  const [py, setPy] = useState(0);

  useEffect(() => {
    const onScroll = () => setPy(window.scrollY * 0.28);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#070b12] text-white overflow-x-hidden">
      <style>{`
        @keyframes bpPulse { from { opacity: 0.55 } to { opacity: 1 } }
        @keyframes bpFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
        @keyframes bpBlink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes bpGlow  { 0%,100% { box-shadow:0 0 14px rgba(56,189,248,.4) } 50% { box-shadow:0 0 32px rgba(56,189,248,.9),0 0 70px rgba(56,189,248,.25) } }
        @keyframes bpSlide { from { opacity:0;transform:translateY(22px) } to { opacity:1;transform:translateY(0) } }
        .bp-h1  { animation: bpSlide .75s .05s ease both }
        .bp-sub { animation: bpSlide .75s .18s ease both }
        .bp-tag { animation: bpSlide .75s .30s ease both }
        .bp-cta { animation: bpSlide .75s .42s ease both }
        .bp-cta-primary:hover { animation: bpGlow 1.6s ease infinite }
      `}</style>

      {/* ══════════════════════════ HERO ══════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0"><ParticleCanvas /></div>
        <CandleBg parallax={py} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(7,11,18,0)_0%,rgba(7,11,18,0.88)_65%)] pointer-events-none" />

        <FloatingTicker />

        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-5 px-4">
          {/* Badge */}
          <div className="bp-h1 inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/25 rounded-full px-4 py-1.5 text-[11px] font-bold text-sky-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Crypto Paper Trading Platform
          </div>

          {/* Headline */}
          <h1 className="bp-h1 text-5xl md:text-7xl font-black tracking-tight leading-[1.06]">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
              BlockPaper
            </span>
            <br />
            <span className="text-white/90">Trade Without</span>
            <span className="text-white/55"> the Risk.</span>
          </h1>

          {/* Typing tagline */}
          <p className="bp-tag text-xl md:text-2xl text-white/55 font-medium h-9 flex items-center justify-center gap-1">
            <span>{typed}</span>
            <span className="inline-block w-[2px] h-6 bg-sky-400 ml-0.5 align-middle" style={{ animation: "bpBlink 1s step-end infinite" }} />
          </p>

          {/* CTA row */}
          <div className="bp-cta flex flex-col sm:flex-row gap-3 items-center justify-center pt-1">
            <a
              href="/signup"
              className="bp-cta-primary group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all duration-300 shadow-lg shadow-blue-900/50"
            >
              Start Paper Trading
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          <p className="bp-cta text-[11px] text-white/25 pt-1 tracking-wide">
            Free forever · No credit card · Instant access
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 animate-bounce">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* ═════════════════════════ FEATURES ══════════════════════════════════ */}
      <section className="py-24 px-4 max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-5">
            Everything You Need
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Built for Serious Traders</h2>
          <p className="text-white/45 text-lg max-w-xl mx-auto">
            All the tools professionals use — without putting real money on the line.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="group h-full p-6 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-sky-500/40 hover:bg-sky-500/[0.05] transition-all duration-300 hover:scale-[1.025] hover:shadow-xl hover:shadow-sky-900/20 cursor-default">
                <div className="text-4xl mb-4 transition-transform duration-300 group-hover:scale-110" style={{ animation: `bpFloat 4s ease-in-out ${i * 0.4}s infinite` }}>{f.icon}</div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════ DEMO PREVIEW ═════════════════════════════════ */}
      <section id="demo" className="py-24 px-4 bg-white/[0.015] border-y border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-[11px] font-bold text-purple-400 uppercase tracking-widest mb-5">
              Live Preview
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-3">See It in Action</h2>
            <p className="text-white/40 text-base">
              See BlockPaper in action — fully functional dashboard
            </p>
          </Reveal>

          <Reveal>
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161b22] border-b border-white/[0.07]">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-[11px] text-white/25 font-mono">blockpaper.app / trade</span>
              </div>
              {/* Mock toolbar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-[#0d1117]">
                {["BTC","ETH","SOL","BNB"].map(s => (
                  <button key={s} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${s==="BTC" ? "bg-blue-500/20 text-blue-400" : "text-white/35 hover:text-white/60"}`}>{s}</button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-base font-mono font-bold text-white">$43,200</span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">+2.40%</span>
                </div>
              </div>
              {/* Chart + trade panel */}
              <div className="flex gap-3 p-4 h-[200px] bg-[#0d1117]">
                <MockChart />
                <MockPanel />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════ HOW IT WORKS ══════════════════════════════ */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 text-[11px] font-bold text-cyan-400 uppercase tracking-widest mb-5">
            Simple Setup
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-3">Up & Trading in Seconds</h2>
          <p className="text-white/40 text-base">No setup required. Just sign in and start.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-0">
          {[
            { icon: "👛", step: "01", title: "Sign Up",                   desc: "Create your free account in one click — no credit card, no friction." },
            { icon: "💰", step: "02", title: "Get $10,000 Virtual Funds", desc: "Your account is instantly credited with $10,000 in paper money." },
            { icon: "🚀", step: "03", title: "Start Trading",             desc: "Open positions, set alerts and compete with others immediately." },
          ].map((s, i) => (
            <div key={s.step} className="flex flex-col md:flex-row items-center">
              <Reveal className="flex-1 w-full" delay={i * 120}>
                <div className="flex flex-col items-center text-center p-8">
                  <div className="text-5xl mb-5" style={{ animation: `bpFloat 3.5s ease-in-out ${i * 0.6}s infinite` }}>{s.icon}</div>
                  <div className="text-[10px] font-black text-white/20 tracking-widest mb-2 uppercase">Step {s.step}</div>
                  <h3 className="text-white font-bold text-xl mb-3">{s.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed max-w-[220px]">{s.desc}</p>
                </div>
              </Reveal>
              {i < 2 && (
                <div className="hidden md:flex shrink-0 text-white/20 -mx-2">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════ BOTTOM CTA ══════════════════════════════ */}
      <section className="py-24 px-4">
        <Reveal>
          <div className="relative max-w-2xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950/60 via-cyan-950/30 to-transparent p-14 overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <h2 className="relative text-4xl md:text-5xl font-black text-white mb-4">Ready to Trade Smarter?</h2>
            <p className="relative text-white/45 mb-8 text-base">
              Join BlockPaper and start your paper trading journey today — completely free.
            </p>
            <a
              href="/signup"
              className="bp-cta-primary group relative inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all duration-300 shadow-xl shadow-blue-900/40"
            >
              Get Started Free
              <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-white/20 text-xs border-t border-white/[0.05]">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-sky-500/50" />
          <span className="font-bold text-white/35 tracking-wide">BlockPaper</span>
        </div>
      </footer>
    </div>
  );
}
