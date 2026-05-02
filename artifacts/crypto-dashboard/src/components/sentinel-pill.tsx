import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield } from "lucide-react";

type SentinelStatus = "SECURE" | "REVIEW" | "ALERT";

interface SentinelResult {
  status: SentinelStatus;
  score: number | null;
  summary: string;
  findings: string[];
  checkedAt: string | null;
}

async function fetchSentinelStatus(): Promise<SentinelResult> {
  const res = await fetch("/api/sentinel/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch sentinel status");
  return res.json();
}

const STATUS_CONFIG: Record<SentinelStatus, { dot: string; text: string; pill: string; toastFn: typeof toast.success }> = {
  SECURE: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    pill: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    toastFn: toast.success,
  },
  REVIEW: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    pill: "bg-amber-400/10 border-amber-400/25 text-amber-400",
    toastFn: toast.warning,
  },
  ALERT: {
    dot: "bg-red-500",
    text: "text-red-400",
    pill: "bg-red-500/10 border-red-500/25 text-red-400",
    toastFn: toast.error,
  },
};

const STATUS_EMOJI: Record<SentinelStatus, string> = {
  SECURE: "🟢",
  REVIEW: "🟡",
  ALERT: "🔴",
};

export function SentinelPill() {
  const prevStatusRef = useRef<SentinelStatus | null>(null);

  const { data } = useQuery<SentinelResult>({
    queryKey: ["sentinel-status"],
    queryFn: fetchSentinelStatus,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const current = data.status;
    const prev = prevStatusRef.current;

    if (prev !== null && prev !== current) {
      const cfg = STATUS_CONFIG[current];
      cfg.toastFn(`Sentinel: ${STATUS_EMOJI[current]} ${current}`, {
        description: data.summary,
        duration: 6000,
      });
    }

    prevStatusRef.current = current;
  }, [data?.status]);

  if (!data) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary/30 text-muted-foreground text-xs font-medium">
        <Shield className="h-3 w-3" />
        <span>SENTINEL</span>
      </div>
    );
  }

  const status = data.status;
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.pill}`}
      title={`${data.summary}${data.score !== null ? ` (score: ${data.score}/100)` : ""}${data.checkedAt ? `\nChecked: ${new Date(data.checkedAt).toLocaleTimeString()}` : ""}`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot} animate-pulse`} />
      <Shield className="h-3 w-3" />
      <span>{status}</span>
    </div>
  );
}
